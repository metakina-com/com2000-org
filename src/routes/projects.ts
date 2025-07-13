import { Hono } from 'hono';
import { z } from 'zod';
import { Env, Project, ApiResponse } from '../types/env';
import { optionalAuth } from '../middleware/auth';
import { strictRateLimiter } from '../middleware/rateLimiter';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';

const app = new Hono<{ Bindings: Env }>();

// Validation schemas
const projectQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? Math.min(parseInt(val), 100) : 20),
  category: z.string().optional(),
  status: z.enum(['active', 'upcoming', 'completed', 'cancelled']).optional(),
  sort: z.enum(['name', 'price', 'marketCap', 'volume24h', 'createdAt']).optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().optional()
});

const projectIdSchema = z.object({
  id: z.string().uuid('Invalid project ID format')
});

// Apply optional auth to all routes
app.use('*', optionalAuth);

// Apply rate limiting to search endpoints
app.use('/search', strictRateLimiter(30, 60)); // 30 requests per minute

// GET /api/v1/projects - Get projects list
app.get('/', async (c) => {
  try {
    const query = projectQuerySchema.parse({
      page: c.req.query('page'),
      limit: c.req.query('limit'),
      category: c.req.query('category'),
      status: c.req.query('status'),
      sort: c.req.query('sort'),
      order: c.req.query('order'),
      search: c.req.query('search')
    });

    // Try to get from cache first
    const cacheKey = `projects:${JSON.stringify(query)}`;
    const cachedData = await c.env.PROJECT_CACHE.get(cacheKey);
    
    if (cachedData) {
      const response: ApiResponse<Project[]> = JSON.parse(cachedData);
      c.header('X-Cache', 'HIT');
      return c.json(response);
    }

    // Build SQL query
    let sql = `
      SELECT p.*, 
             COUNT(*) OVER() as total_count
      FROM project_cache p
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (query.category) {
      sql += ` AND p.category = ?${paramIndex}`;
      params.push(query.category);
      paramIndex++;
    }

    if (query.status) {
      sql += ` AND p.status = ?${paramIndex}`;
      params.push(query.status);
      paramIndex++;
    }

    if (query.search) {
      sql += ` AND (p.name LIKE ?${paramIndex} OR p.symbol LIKE ?${paramIndex + 1} OR p.description LIKE ?${paramIndex + 2})`;
      const searchTerm = `%${query.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
      paramIndex += 3;
    }

    // Add sorting
    const sortColumn = query.sort === 'createdAt' ? 'created_at' : 
                      query.sort === 'marketCap' ? 'market_cap' : 
                      query.sort === 'volume24h' ? 'volume_24h' : query.sort;
    sql += ` ORDER BY p.${sortColumn} ${query.order.toUpperCase()}`;

    // Add pagination
    const offset = (query.page - 1) * query.limit;
    sql += ` LIMIT ?${paramIndex} OFFSET ?${paramIndex + 1}`;
    params.push(query.limit, offset);

    // Execute query
    const result = await c.env.DB.prepare(sql).bind(...params).all();
    
    if (!result.success) {
      throw new Error('Database query failed');
    }

    const projects: Project[] = result.results.map(row => ({
      id: row.id,
      name: row.name,
      symbol: row.symbol,
      description: row.description,
      website: row.website,
      whitepaper: row.whitepaper,
      logo: row.logo,
      banner: row.banner,
      category: row.category,
      tags: JSON.parse(row.tags || '[]'),
      totalSupply: row.total_supply,
      circulatingSupply: row.circulating_supply,
      marketCap: row.market_cap,
      price: row.price,
      change24h: row.change_24h,
      volume24h: row.volume_24h,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      socialLinks: JSON.parse(row.social_links || '{}'),
      team: JSON.parse(row.team || '[]'),
      roadmap: JSON.parse(row.roadmap || '[]')
    }));

    const totalCount = result.results.length > 0 ? result.results[0].total_count : 0;
    const totalPages = Math.ceil(totalCount / query.limit);

    const response: ApiResponse<Project[]> = {
      success: true,
      data: projects,
      timestamp: new Date().toISOString(),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: totalCount,
        totalPages
      }
    };

    // Cache the response
    const cacheTtl = parseInt(c.env.CACHE_TTL_PROJECTS || '300');
    await c.env.PROJECT_CACHE.put(cacheKey, JSON.stringify(response), {
      expirationTtl: cacheTtl
    });

    c.header('X-Cache', 'MISS');
    return c.json(response);

  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(`Invalid query parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
});

// GET /api/v1/projects/trending - Get trending projects
app.get('/trending', async (c) => {
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);
    
    // Try cache first
    const cacheKey = `trending:${limit}`;
    const cachedData = await c.env.TRENDING_CACHE.get(cacheKey);
    
    if (cachedData) {
      c.header('X-Cache', 'HIT');
      return c.json(JSON.parse(cachedData));
    }

    // Get trending projects from database
    const sql = `
      SELECT p.*, 
             (p.volume_24h * 0.4 + ABS(p.change_24h) * 0.3 + p.market_cap * 0.3) as trend_score
      FROM project_cache p
      WHERE p.status = 'active'
      ORDER BY trend_score DESC
      LIMIT ?
    `;

    const result = await c.env.DB.prepare(sql).bind(limit).all();
    
    if (!result.success) {
      throw new Error('Database query failed');
    }

    const trendingProjects = result.results.map((row, index) => ({
      projectId: row.id,
      name: row.name,
      symbol: row.symbol,
      logo: row.logo,
      price: row.price,
      change24h: row.change_24h,
      volume24h: row.volume_24h,
      marketCap: row.market_cap,
      rank: index + 1,
      score: row.trend_score,
      lastUpdated: Date.now()
    }));

    const response: ApiResponse = {
      success: true,
      data: trendingProjects,
      timestamp: new Date().toISOString()
    };

    // Cache for shorter time due to dynamic nature
    const cacheTtl = parseInt(c.env.CACHE_TTL_TRENDING || '600');
    await c.env.TRENDING_CACHE.put(cacheKey, JSON.stringify(response), {
      expirationTtl: cacheTtl
    });

    c.header('X-Cache', 'MISS');
    return c.json(response);

  } catch (error) {
    throw error;
  }
});

// GET /api/v1/projects/:id - Get project details
app.get('/:id', async (c) => {
  try {
    const { id } = projectIdSchema.parse({ id: c.req.param('id') });
    
    // Try cache first
    const cacheKey = `project:${id}`;
    const cachedData = await c.env.PROJECT_CACHE.get(cacheKey);
    
    if (cachedData) {
      c.header('X-Cache', 'HIT');
      return c.json(JSON.parse(cachedData));
    }

    // Get from database
    const sql = `SELECT * FROM project_cache WHERE id = ?`;
    const result = await c.env.DB.prepare(sql).bind(id).first();
    
    if (!result) {
      throw new NotFoundError('Project');
    }

    const project: Project = {
      id: result.id,
      name: result.name,
      symbol: result.symbol,
      description: result.description,
      website: result.website,
      whitepaper: result.whitepaper,
      logo: result.logo,
      banner: result.banner,
      category: result.category,
      tags: JSON.parse(result.tags || '[]'),
      totalSupply: result.total_supply,
      circulatingSupply: result.circulating_supply,
      marketCap: result.market_cap,
      price: result.price,
      change24h: result.change_24h,
      volume24h: result.volume_24h,
      status: result.status,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      socialLinks: JSON.parse(result.social_links || '{}'),
      team: JSON.parse(result.team || '[]'),
      roadmap: JSON.parse(result.roadmap || '[]')
    };

    const response: ApiResponse<Project> = {
      success: true,
      data: project,
      timestamp: new Date().toISOString()
    };

    // Cache the response
    const cacheTtl = parseInt(c.env.CACHE_TTL_PROJECTS || '300');
    await c.env.PROJECT_CACHE.put(cacheKey, JSON.stringify(response), {
      expirationTtl: cacheTtl
    });

    c.header('X-Cache', 'MISS');
    return c.json(response);

  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid project ID');
    }
    throw error;
  }
});

// GET /api/v1/projects/search - Search projects
app.get('/search', async (c) => {
  try {
    const query = c.req.query('q');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
    
    if (!query || query.length < 2) {
      throw new ValidationError('Search query must be at least 2 characters long');
    }

    // Try cache first
    const cacheKey = `search:${query}:${limit}`;
    const cachedData = await c.env.PROJECT_CACHE.get(cacheKey);
    
    if (cachedData) {
      c.header('X-Cache', 'HIT');
      return c.json(JSON.parse(cachedData));
    }

    // Search in database
    const sql = `
      SELECT *, 
             CASE 
               WHEN name LIKE ? THEN 3
               WHEN symbol LIKE ? THEN 2
               WHEN description LIKE ? THEN 1
               ELSE 0
             END as relevance_score
      FROM project_cache 
      WHERE name LIKE ? OR symbol LIKE ? OR description LIKE ?
      ORDER BY relevance_score DESC, market_cap DESC
      LIMIT ?
    `;
    
    const searchTerm = `%${query}%`;
    const exactTerm = `${query}%`;
    
    const result = await c.env.DB.prepare(sql).bind(
      exactTerm, exactTerm, searchTerm,
      searchTerm, searchTerm, searchTerm,
      limit
    ).all();
    
    if (!result.success) {
      throw new Error('Search query failed');
    }

    const projects: Project[] = result.results.map(row => ({
      id: row.id,
      name: row.name,
      symbol: row.symbol,
      description: row.description,
      website: row.website,
      whitepaper: row.whitepaper,
      logo: row.logo,
      banner: row.banner,
      category: row.category,
      tags: JSON.parse(row.tags || '[]'),
      totalSupply: row.total_supply,
      circulatingSupply: row.circulating_supply,
      marketCap: row.market_cap,
      price: row.price,
      change24h: row.change_24h,
      volume24h: row.volume_24h,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      socialLinks: JSON.parse(row.social_links || '{}'),
      team: JSON.parse(row.team || '[]'),
      roadmap: JSON.parse(row.roadmap || '[]')
    }));

    const response: ApiResponse<Project[]> = {
      success: true,
      data: projects,
      timestamp: new Date().toISOString()
    };

    // Cache search results for shorter time
    await c.env.PROJECT_CACHE.put(cacheKey, JSON.stringify(response), {
      expirationTtl: 180 // 3 minutes
    });

    c.header('X-Cache', 'MISS');
    return c.json(response);

  } catch (error) {
    throw error;
  }
});

export { app as projectRoutes };