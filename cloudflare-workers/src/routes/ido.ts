import { Hono } from 'hono';
import { z } from 'zod';
import { Env } from '../types/env';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { rateLimiter, strictRateLimiter } from '../middleware/rateLimiter';
import { ValidationError, NotFoundError, ConflictError, AuthorizationError } from '../middleware/errorHandler';
import { generateId, sanitizeInput } from '../utils/validation';

const ido = new Hono<{ Bindings: Env }>();

// Validation schemas
const getIdoPoolsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['upcoming', 'active', 'completed', 'cancelled']).optional(),
  category: z.string().optional(),
  sort: z.enum(['created_at', 'start_time', 'end_time', 'total_raised', 'participant_count']).default('start_time'),
  order: z.enum(['asc', 'desc']).default('asc'),
  search: z.string().optional()
});

const investSchema = z.object({
  amount: z.number().positive('Investment amount must be positive'),
  paymentMethod: z.enum(['USDT', 'USDC', 'ETH', 'BNB']).default('USDT'),
  walletAddress: z.string().min(1, 'Wallet address is required'),
  transactionHash: z.string().optional()
});

const createIdoPoolSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  name: z.string().min(1, 'Pool name is required').max(100),
  symbol: z.string().min(1, 'Token symbol is required').max(10),
  totalTokens: z.number().positive('Total tokens must be positive'),
  tokenPrice: z.number().positive('Token price must be positive'),
  minInvestment: z.number().positive('Minimum investment must be positive'),
  maxInvestment: z.number().positive('Maximum investment must be positive'),
  softCap: z.number().positive('Soft cap must be positive'),
  hardCap: z.number().positive('Hard cap must be positive'),
  startTime: z.number().positive('Start time must be a valid timestamp'),
  endTime: z.number().positive('End time must be a valid timestamp'),
  vestingSchedule: z.array(z.object({
    cliff: z.number().min(0, 'Cliff period must be non-negative'),
    duration: z.number().positive('Duration must be positive'),
    percentage: z.number().min(0).max(100, 'Percentage must be between 0 and 100')
  })).min(1, 'At least one vesting schedule is required'),
  description: z.string().optional(),
  terms: z.string().optional()
}).refine(data => data.endTime > data.startTime, {
  message: 'End time must be after start time',
  path: ['endTime']
}).refine(data => data.maxInvestment >= data.minInvestment, {
  message: 'Maximum investment must be greater than or equal to minimum investment',
  path: ['maxInvestment']
}).refine(data => data.hardCap >= data.softCap, {
  message: 'Hard cap must be greater than or equal to soft cap',
  path: ['hardCap']
});

const updateIdoPoolSchema = createIdoPoolSchema.partial().omit({ projectId: true });

// Helper functions
async function getIdoPoolById(env: Env, poolId: string) {
  const stmt = env.DB.prepare(`
    SELECT i.*, p.name as project_name, p.logo as project_logo, p.website as project_website
    FROM ido_pool_cache i
    LEFT JOIN project_cache p ON i.project_id = p.id
    WHERE i.id = ?
  `);
  return await stmt.bind(poolId).first();
}

async function getUserInvestment(env: Env, userId: string, poolId: string) {
  const stmt = env.DB.prepare(`
    SELECT * FROM user_investment_cache 
    WHERE user_id = ? AND ido_pool_id = ?
    ORDER BY created_at DESC
  `);
  return await stmt.bind(userId, poolId).all();
}

async function getTotalUserInvestment(env: Env, userId: string, poolId: string) {
  const stmt = env.DB.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_amount,
           COALESCE(SUM(token_amount), 0) as total_tokens,
           COUNT(*) as investment_count
    FROM user_investment_cache 
    WHERE user_id = ? AND ido_pool_id = ? AND status = 'confirmed'
  `);
  return await stmt.bind(userId, poolId).first();
}

async function checkInvestmentLimits(env: Env, poolId: string, userId: string, newAmount: number) {
  const pool = await getIdoPoolById(env, poolId);
  if (!pool) {
    throw new NotFoundError('IDO pool not found');
  }

  // Check pool status
  if (pool.status !== 'active') {
    throw new ConflictError('IDO pool is not active');
  }

  // Check time limits
  const now = Date.now();
  if (now < pool.start_time) {
    throw new ConflictError('IDO has not started yet');
  }
  if (now > pool.end_time) {
    throw new ConflictError('IDO has ended');
  }

  // Check hard cap
  if (pool.total_raised + newAmount > pool.hard_cap) {
    throw new ConflictError('Investment would exceed hard cap');
  }

  // Check user investment limits
  const userTotal = await getTotalUserInvestment(env, userId, poolId);
  const totalUserInvestment = (userTotal?.total_amount || 0) + newAmount;
  
  if (newAmount < pool.min_investment) {
    throw new ConflictError(`Minimum investment is ${pool.min_investment}`);
  }
  
  if (totalUserInvestment > pool.max_investment) {
    throw new ConflictError(`Maximum investment per user is ${pool.max_investment}`);
  }

  return pool;
}

async function updatePoolStats(env: Env, poolId: string, amountChange: number, participantChange: number = 0) {
  const stmt = env.DB.prepare(`
    UPDATE ido_pool_cache 
    SET total_raised = total_raised + ?, 
        participant_count = participant_count + ?,
        updated_at = ?
    WHERE id = ?
  `);
  await stmt.bind(amountChange, participantChange, Date.now(), poolId).run();
}

// Routes

// GET /ido/pools - Get IDO pools with filtering and pagination
ido.get('/pools', optionalAuth, rateLimiter({ requests: 100, windowMs: 60 * 1000 }), async (c) => {
  try {
    const query = getIdoPoolsSchema.parse(c.req.query());
    const offset = (query.page - 1) * query.limit;
    
    // Build WHERE clause
    const conditions = [];
    const params = [];
    
    if (query.status) {
      conditions.push('i.status = ?');
      params.push(query.status);
    }
    
    if (query.category) {
      conditions.push('p.category = ?');
      params.push(query.category);
    }
    
    if (query.search) {
      conditions.push('(i.name LIKE ? OR i.symbol LIKE ? OR p.name LIKE ?)');
      const searchTerm = `%${sanitizeInput(query.search)}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Build ORDER BY clause
    const orderBy = `ORDER BY i.${query.sort} ${query.order.toUpperCase()}`;
    
    // Get total count
    const countStmt = env.DB.prepare(`
      SELECT COUNT(*) as total
      FROM ido_pool_cache i
      LEFT JOIN project_cache p ON i.project_id = p.id
      ${whereClause}
    `);
    const countResult = await countStmt.bind(...params).first();
    const total = countResult?.total || 0;
    
    // Get pools
    const stmt = env.DB.prepare(`
      SELECT 
        i.*,
        p.name as project_name,
        p.logo as project_logo,
        p.website as project_website,
        p.category as project_category,
        CASE 
          WHEN i.total_raised >= i.hard_cap THEN 'sold_out'
          WHEN ? < i.start_time THEN 'upcoming'
          WHEN ? > i.end_time THEN 'ended'
          ELSE i.status
        END as computed_status,
        ROUND((i.total_raised * 100.0 / i.hard_cap), 2) as progress_percentage,
        CASE 
          WHEN i.end_time > ? THEN i.end_time - ?
          ELSE 0
        END as time_remaining
      FROM ido_pool_cache i
      LEFT JOIN project_cache p ON i.project_id = p.id
      ${whereClause}
      ${orderBy}
      LIMIT ? OFFSET ?
    `);
    
    const now = Date.now();
    const pools = await stmt.bind(...params, now, now, now, now, query.limit, offset).all();
    
    // Parse JSON fields
    const formattedPools = pools.results?.map(pool => ({
      ...pool,
      vesting_schedule: pool.vesting_schedule ? JSON.parse(pool.vesting_schedule) : [],
      social_links: pool.social_links ? JSON.parse(pool.social_links) : {},
      progress_percentage: parseFloat(pool.progress_percentage || '0'),
      time_remaining: parseInt(pool.time_remaining || '0')
    })) || [];
    
    // Cache the response
    const cacheKey = `ido_pools:${JSON.stringify(query)}`;
    await c.env.PROJECT_CACHE.put(cacheKey, JSON.stringify({
      pools: formattedPools,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      }
    }), { expirationTtl: 300 }); // 5 minutes
    
    // Log analytics
    await c.env.ANALYTICS.writeDataPoint({
      blobs: ['ido_pools_viewed', query.status || 'all'],
      doubles: [Date.now(), query.page, query.limit],
      indexes: [c.get('user')?.id || 'anonymous']
    });
    
    return c.json({
      success: true,
      data: {
        pools: formattedPools,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit)
        }
      }
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid query parameters', error.errors);
    }
    throw error;
  }
});

// GET /ido/pools/:id - Get specific IDO pool details
ido.get('/pools/:id', optionalAuth, rateLimiter({ requests: 200, windowMs: 60 * 1000 }), async (c) => {
  const poolId = c.req.param('id');
  
  // Try cache first
  const cacheKey = `ido_pool:${poolId}`;
  const cached = await c.env.PROJECT_CACHE.get(cacheKey);
  if (cached) {
    const data = JSON.parse(cached);
    return c.json({ success: true, data });
  }
  
  const pool = await getIdoPoolById(c.env, poolId);
  if (!pool) {
    throw new NotFoundError('IDO pool not found');
  }
  
  // Get additional statistics
  const statsStmt = c.env.DB.prepare(`
    SELECT 
      COUNT(DISTINCT user_id) as unique_investors,
      AVG(amount) as avg_investment,
      MIN(amount) as min_investment_actual,
      MAX(amount) as max_investment_actual
    FROM user_investment_cache 
    WHERE ido_pool_id = ? AND status = 'confirmed'
  `);
  const stats = await statsStmt.bind(poolId).first();
  
  // Calculate progress and status
  const now = Date.now();
  let computedStatus = pool.status;
  if (pool.total_raised >= pool.hard_cap) {
    computedStatus = 'sold_out';
  } else if (now < pool.start_time) {
    computedStatus = 'upcoming';
  } else if (now > pool.end_time) {
    computedStatus = 'ended';
  }
  
  const formattedPool = {
    ...pool,
    vesting_schedule: pool.vesting_schedule ? JSON.parse(pool.vesting_schedule) : [],
    computed_status: computedStatus,
    progress_percentage: Math.round((pool.total_raised * 100) / pool.hard_cap * 100) / 100,
    time_remaining: Math.max(0, pool.end_time - now),
    statistics: {
      unique_investors: stats?.unique_investors || 0,
      avg_investment: stats?.avg_investment || 0,
      min_investment_actual: stats?.min_investment_actual || 0,
      max_investment_actual: stats?.max_investment_actual || 0
    }
  };
  
  // Add user investment info if authenticated
  if (c.get('user')) {
    const userInvestments = await getUserInvestment(c.env, c.get('user').id, poolId);
    const userTotal = await getTotalUserInvestment(c.env, c.get('user').id, poolId);
    
    formattedPool.user_investment = {
      investments: userInvestments.results || [],
      total_amount: userTotal?.total_amount || 0,
      total_tokens: userTotal?.total_tokens || 0,
      investment_count: userTotal?.investment_count || 0,
      remaining_allocation: Math.max(0, pool.max_investment - (userTotal?.total_amount || 0))
    };
  }
  
  // Cache the response
  await c.env.PROJECT_CACHE.put(cacheKey, JSON.stringify(formattedPool), { expirationTtl: 60 }); // 1 minute
  
  // Log analytics
  await c.env.ANALYTICS.writeDataPoint({
    blobs: ['ido_pool_viewed', poolId],
    doubles: [Date.now()],
    indexes: [c.get('user')?.id || 'anonymous']
  });
  
  return c.json({
    success: true,
    data: formattedPool
  });
});

// POST /ido/pools/:id/invest - Invest in an IDO pool
ido.post('/pools/:id/invest', authMiddleware, strictRateLimiter({ requests: 10, windowMs: 60 * 1000 }), async (c) => {
  try {
    const poolId = c.req.param('id');
    const user = c.get('user');
    const body = await c.req.json();
    const validatedData = investSchema.parse(body);
    
    // Check investment limits and pool status
    const pool = await checkInvestmentLimits(c.env, poolId, user.id, validatedData.amount);
    
    // Calculate token amount
    const tokenAmount = validatedData.amount / pool.token_price;
    
    // Create investment record
    const investmentId = generateId();
    const now = Date.now();
    
    const stmt = c.env.DB.prepare(`
      INSERT INTO user_investment_cache (
        id, user_id, ido_pool_id, amount, token_amount, 
        transaction_hash, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    await stmt.bind(
      investmentId,
      user.id,
      poolId,
      validatedData.amount,
      tokenAmount,
      validatedData.transactionHash || null,
      'pending',
      now,
      now
    ).run();
    
    // Check if this is the user's first investment in this pool
    const userTotal = await getTotalUserInvestment(c.env, user.id, poolId);
    const isFirstInvestment = (userTotal?.investment_count || 0) === 0;
    
    // Update pool statistics (optimistically)
    await updatePoolStats(c.env, poolId, validatedData.amount, isFirstInvestment ? 1 : 0);
    
    // Invalidate cache
    await c.env.PROJECT_CACHE.delete(`ido_pool:${poolId}`);
    
    // Log analytics
    await c.env.ANALYTICS.writeDataPoint({
      blobs: ['ido_investment', poolId, user.id, validatedData.paymentMethod],
      doubles: [Date.now(), validatedData.amount, tokenAmount],
      indexes: [user.id, poolId]
    });
    
    return c.json({
      success: true,
      data: {
        investmentId,
        amount: validatedData.amount,
        tokenAmount,
        status: 'pending',
        message: 'Investment submitted successfully. Please complete the payment to confirm your investment.'
      }
    }, 201);
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid investment data', error.errors);
    }
    throw error;
  }
});

// GET /ido/pools/:id/investments - Get user's investments in a specific pool
ido.get('/pools/:id/investments', authMiddleware, rateLimiter({ requests: 50, windowMs: 60 * 1000 }), async (c) => {
  const poolId = c.req.param('id');
  const user = c.get('user');
  
  const investments = await getUserInvestment(c.env, user.id, poolId);
  const userTotal = await getTotalUserInvestment(c.env, user.id, poolId);
  
  return c.json({
    success: true,
    data: {
      investments: investments.results || [],
      summary: {
        total_amount: userTotal?.total_amount || 0,
        total_tokens: userTotal?.total_tokens || 0,
        investment_count: userTotal?.investment_count || 0
      }
    }
  });
});

// GET /ido/my-investments - Get all user's investments
ido.get('/my-investments', authMiddleware, rateLimiter({ requests: 50, windowMs: 60 * 1000 }), async (c) => {
  const user = c.get('user');
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const offset = (page - 1) * limit;
  
  // Get user's investments with pool details
  const stmt = c.env.DB.prepare(`
    SELECT 
      ui.*,
      i.name as pool_name,
      i.symbol as token_symbol,
      i.token_price,
      i.status as pool_status,
      p.name as project_name,
      p.logo as project_logo
    FROM user_investment_cache ui
    JOIN ido_pool_cache i ON ui.ido_pool_id = i.id
    LEFT JOIN project_cache p ON i.project_id = p.id
    WHERE ui.user_id = ?
    ORDER BY ui.created_at DESC
    LIMIT ? OFFSET ?
  `);
  
  const investments = await stmt.bind(user.id, limit, offset).all();
  
  // Get total count
  const countStmt = c.env.DB.prepare('SELECT COUNT(*) as total FROM user_investment_cache WHERE user_id = ?');
  const countResult = await countStmt.bind(user.id).first();
  const total = countResult?.total || 0;
  
  // Get summary statistics
  const summaryStmt = c.env.DB.prepare(`
    SELECT 
      COUNT(DISTINCT ido_pool_id) as pools_invested,
      SUM(CASE WHEN status = 'confirmed' THEN amount ELSE 0 END) as total_invested,
      SUM(CASE WHEN status = 'confirmed' THEN token_amount ELSE 0 END) as total_tokens,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_investments
    FROM user_investment_cache 
    WHERE user_id = ?
  `);
  const summary = await summaryStmt.bind(user.id).first();
  
  return c.json({
    success: true,
    data: {
      investments: investments.results || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      summary: {
        pools_invested: summary?.pools_invested || 0,
        total_invested: summary?.total_invested || 0,
        total_tokens: summary?.total_tokens || 0,
        pending_investments: summary?.pending_investments || 0
      }
    }
  });
});

export default ido;