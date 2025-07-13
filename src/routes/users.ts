import { Hono } from 'hono';
import { z } from 'zod';
import { Env } from '../types/env';
import { authMiddleware, requireRole } from '../middleware/auth';
import { rateLimiter, strictRateLimiter } from '../middleware/rateLimiter';
import { ValidationError, NotFoundError, ConflictError, AuthorizationError } from '../middleware/errorHandler';
import { hashPassword, verifyPassword } from '../utils/crypto';
import { sanitizeInput, validateEmail } from '../utils/validation';

const users = new Hono<{ Bindings: Env }>();

// Validation schemas
const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50).optional(),
  lastName: z.string().min(1, 'Last name is required').max(50).optional(),
  username: z.string().min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be less than 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscore and dash')
    .optional(),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  location: z.string().max(100, 'Location must be less than 100 characters').optional(),
  avatar: z.string().url('Invalid avatar URL').optional().or(z.literal('')),
  socialLinks: z.object({
    twitter: z.string().optional(),
    telegram: z.string().optional(),
    discord: z.string().optional(),
    linkedin: z.string().optional()
  }).optional()
});

const updateSettingsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
  twoFactorEnabled: z.boolean().optional(),
  language: z.enum(['en', 'zh', 'es', 'fr', 'de', 'ja', 'ko']).optional(),
  timezone: z.string().optional(),
  currency: z.enum(['USD', 'EUR', 'CNY', 'JPY', 'KRW']).optional(),
  theme: z.enum(['light', 'dark', 'auto']).optional()
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
           'Password must contain uppercase, lowercase, number and special character'),
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

const updateKycSchema = z.object({
  documentType: z.enum(['passport', 'driver_license', 'national_id']),
  documentNumber: z.string().min(1, 'Document number is required'),
  documentFront: z.string().url('Invalid document front URL'),
  documentBack: z.string().url('Invalid document back URL').optional(),
  selfie: z.string().url('Invalid selfie URL'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  nationality: z.string().min(2, 'Nationality is required'),
  address: z.object({
    street: z.string().min(1, 'Street address is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().optional(),
    postalCode: z.string().min(1, 'Postal code is required'),
    country: z.string().min(2, 'Country is required')
  })
});

const getUsersSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  role: z.enum(['user', 'admin', 'moderator']).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  search: z.string().optional(),
  sort: z.enum(['created_at', 'last_login', 'email', 'username']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc')
});

// Helper functions
async function getUserById(env: Env, userId: string, includePrivate: boolean = false) {
  const fields = includePrivate 
    ? '*'
    : 'id, email, username, first_name, last_name, bio, website, location, avatar, social_links, role, status, email_verified, created_at, last_login';
    
  const stmt = env.DB.prepare(`SELECT ${fields} FROM users WHERE id = ? AND deleted_at IS NULL`);
  return await stmt.bind(userId).first();
}

async function getUserByUsername(env: Env, username: string) {
  const stmt = env.DB.prepare(`
    SELECT id, email, username, first_name, last_name, bio, website, location, 
           avatar, social_links, role, status, email_verified, created_at, last_login
    FROM users 
    WHERE username = ? AND deleted_at IS NULL
  `);
  return await stmt.bind(username).first();
}

async function updateUserProfile(env: Env, userId: string, data: any) {
  const fields = [];
  const values = [];
  
  if (data.firstName !== undefined) {
    fields.push('first_name = ?');
    values.push(sanitizeInput(data.firstName));
  }
  
  if (data.lastName !== undefined) {
    fields.push('last_name = ?');
    values.push(sanitizeInput(data.lastName));
  }
  
  if (data.username !== undefined) {
    fields.push('username = ?');
    values.push(data.username);
  }
  
  if (data.bio !== undefined) {
    fields.push('bio = ?');
    values.push(sanitizeInput(data.bio));
  }
  
  if (data.website !== undefined) {
    fields.push('website = ?');
    values.push(data.website || null);
  }
  
  if (data.location !== undefined) {
    fields.push('location = ?');
    values.push(sanitizeInput(data.location));
  }
  
  if (data.avatar !== undefined) {
    fields.push('avatar = ?');
    values.push(data.avatar || null);
  }
  
  if (data.socialLinks !== undefined) {
    fields.push('social_links = ?');
    values.push(JSON.stringify(data.socialLinks));
  }
  
  if (fields.length === 0) {
    return;
  }
  
  fields.push('updated_at = ?');
  values.push(Date.now());
  values.push(userId);
  
  const stmt = env.DB.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
  await stmt.bind(...values).run();
}

async function getUserSettings(env: Env, userId: string) {
  const stmt = env.DB.prepare('SELECT settings FROM user_settings WHERE user_id = ?');
  const result = await stmt.bind(userId).first();
  return result ? JSON.parse(result.settings) : {};
}

async function updateUserSettings(env: Env, userId: string, settings: any) {
  const currentSettings = await getUserSettings(env, userId);
  const newSettings = { ...currentSettings, ...settings };
  
  const stmt = env.DB.prepare(`
    INSERT OR REPLACE INTO user_settings (user_id, settings, updated_at)
    VALUES (?, ?, ?)
  `);
  
  await stmt.bind(userId, JSON.stringify(newSettings), Date.now()).run();
}

// Routes

// GET /users/me - Get current user profile
users.get('/me', authMiddleware, async (c) => {
  const user = c.get('user');
  const userDetails = await getUserById(c.env, user.id, true);
  
  if (!userDetails) {
    throw new NotFoundError('User not found');
  }
  
  // Get user settings
  const settings = await getUserSettings(c.env, user.id);
  
  // Get user statistics
  const statsStmt = c.env.DB.prepare(`
    SELECT 
      COUNT(DISTINCT ido_pool_id) as pools_invested,
      SUM(CASE WHEN status = 'confirmed' THEN amount ELSE 0 END) as total_invested,
      COUNT(*) as total_investments
    FROM user_investment_cache 
    WHERE user_id = ?
  `);
  const stats = await statsStmt.bind(user.id).first();
  
  const formattedUser = {
    ...userDetails,
    social_links: userDetails.social_links ? JSON.parse(userDetails.social_links) : {},
    settings,
    statistics: {
      pools_invested: stats?.pools_invested || 0,
      total_invested: stats?.total_invested || 0,
      total_investments: stats?.total_investments || 0
    }
  };
  
  // Remove sensitive fields
  delete formattedUser.password_hash;
  delete formattedUser.deleted_at;
  
  return c.json({
    success: true,
    data: formattedUser
  });
});

// PUT /users/me - Update current user profile
users.put('/me', authMiddleware, strictRateLimiter({ requests: 10, windowMs: 60 * 1000 }), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const validatedData = updateProfileSchema.parse(body);
    
    // Check if username is already taken (if being updated)
    if (validatedData.username && validatedData.username !== user.username) {
      const existingUser = await getUserByUsername(c.env, validatedData.username);
      if (existingUser && existingUser.id !== user.id) {
        throw new ConflictError('Username already taken');
      }
    }
    
    // Update user profile
    await updateUserProfile(c.env, user.id, validatedData);
    
    // Get updated user data
    const updatedUser = await getUserById(c.env, user.id);
    
    // Log analytics
    await c.env.ANALYTICS.writeDataPoint({
      blobs: ['profile_updated', user.id],
      doubles: [Date.now()],
      indexes: [user.id]
    });
    
    return c.json({
      success: true,
      data: {
        ...updatedUser,
        social_links: updatedUser.social_links ? JSON.parse(updatedUser.social_links) : {}
      },
      message: 'Profile updated successfully'
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid profile data', error.errors);
    }
    throw error;
  }
});

// GET /users/me/settings - Get user settings
users.get('/me/settings', authMiddleware, async (c) => {
  const user = c.get('user');
  const settings = await getUserSettings(c.env, user.id);
  
  return c.json({
    success: true,
    data: settings
  });
});

// PUT /users/me/settings - Update user settings
users.put('/me/settings', authMiddleware, rateLimiter({ requests: 20, windowMs: 60 * 1000 }), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const validatedData = updateSettingsSchema.parse(body);
    
    await updateUserSettings(c.env, user.id, validatedData);
    
    // Get updated settings
    const updatedSettings = await getUserSettings(c.env, user.id);
    
    // Log analytics
    await c.env.ANALYTICS.writeDataPoint({
      blobs: ['settings_updated', user.id],
      doubles: [Date.now()],
      indexes: [user.id]
    });
    
    return c.json({
      success: true,
      data: updatedSettings,
      message: 'Settings updated successfully'
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid settings data', error.errors);
    }
    throw error;
  }
});

// POST /users/me/change-password - Change user password
users.post('/me/change-password', authMiddleware, strictRateLimiter({ requests: 5, windowMs: 60 * 60 * 1000 }), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const validatedData = changePasswordSchema.parse(body);
    
    // Get current user data
    const userData = await getUserById(c.env, user.id, true);
    if (!userData) {
      throw new NotFoundError('User not found');
    }
    
    // Verify current password
    const isValidPassword = await verifyPassword(validatedData.currentPassword, userData.password_hash);
    if (!isValidPassword) {
      throw new AuthorizationError('Current password is incorrect');
    }
    
    // Hash new password
    const hashedPassword = await hashPassword(validatedData.newPassword);
    
    // Update password
    const stmt = c.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?');
    await stmt.bind(hashedPassword, Date.now(), user.id).run();
    
    // Invalidate all user sessions (force re-login)
    // In a real implementation, you might want to keep a list of session IDs per user
    
    // Log analytics
    await c.env.ANALYTICS.writeDataPoint({
      blobs: ['password_changed', user.id],
      doubles: [Date.now()],
      indexes: [user.id]
    });
    
    return c.json({
      success: true,
      message: 'Password changed successfully'
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid password data', error.errors);
    }
    throw error;
  }
});

// GET /users/:username - Get user profile by username (public)
users.get('/:username', rateLimiter({ requests: 100, windowMs: 60 * 1000 }), async (c) => {
  const username = c.req.param('username');
  
  const user = await getUserByUsername(c.env, username);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  // Get public statistics
  const statsStmt = c.env.DB.prepare(`
    SELECT 
      COUNT(DISTINCT ido_pool_id) as pools_invested,
      COUNT(*) as total_investments
    FROM user_investment_cache 
    WHERE user_id = ? AND status = 'confirmed'
  `);
  const stats = await statsStmt.bind(user.id).first();
  
  const publicUser = {
    id: user.id,
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
    bio: user.bio,
    website: user.website,
    location: user.location,
    avatar: user.avatar,
    socialLinks: user.social_links ? JSON.parse(user.social_links) : {},
    joinedAt: user.created_at,
    statistics: {
      pools_invested: stats?.pools_invested || 0,
      total_investments: stats?.total_investments || 0
    }
  };
  
  // Log analytics
  await c.env.ANALYTICS.writeDataPoint({
    blobs: ['profile_viewed', user.id, username],
    doubles: [Date.now()],
    indexes: [user.id]
  });
  
  return c.json({
    success: true,
    data: publicUser
  });
});

// Admin routes

// GET /users - Get all users (admin only)
users.get('/', authMiddleware, requireRole('admin'), async (c) => {
  try {
    const query = getUsersSchema.parse(c.req.query());
    const offset = (query.page - 1) * query.limit;
    
    // Build WHERE clause
    const conditions = ['deleted_at IS NULL'];
    const params = [];
    
    if (query.role) {
      conditions.push('role = ?');
      params.push(query.role);
    }
    
    if (query.status) {
      conditions.push('status = ?');
      params.push(query.status);
    }
    
    if (query.search) {
      conditions.push('(email LIKE ? OR username LIKE ? OR first_name LIKE ? OR last_name LIKE ?)');
      const searchTerm = `%${sanitizeInput(query.search)}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const orderBy = `ORDER BY ${query.sort} ${query.order.toUpperCase()}`;
    
    // Get total count
    const countStmt = c.env.DB.prepare(`SELECT COUNT(*) as total FROM users ${whereClause}`);
    const countResult = await countStmt.bind(...params).first();
    const total = countResult?.total || 0;
    
    // Get users
    const stmt = c.env.DB.prepare(`
      SELECT id, email, username, first_name, last_name, role, status, 
             email_verified, created_at, last_login, updated_at
      FROM users 
      ${whereClause}
      ${orderBy}
      LIMIT ? OFFSET ?
    `);
    
    const users = await stmt.bind(...params, query.limit, offset).all();
    
    return c.json({
      success: true,
      data: {
        users: users.results || [],
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

// PUT /users/:id/status - Update user status (admin only)
users.put('/:id/status', authMiddleware, requireRole('admin'), async (c) => {
  const userId = c.req.param('id');
  const { status } = await c.req.json();
  
  if (!['active', 'inactive', 'suspended'].includes(status)) {
    throw new ValidationError('Invalid status');
  }
  
  const stmt = c.env.DB.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?');
  await stmt.bind(status, Date.now(), userId).run();
  
  // Log analytics
  await c.env.ANALYTICS.writeDataPoint({
    blobs: ['user_status_updated', userId, status, c.get('user').id],
    doubles: [Date.now()],
    indexes: [userId, c.get('user').id]
  });
  
  return c.json({
    success: true,
    message: `User status updated to ${status}`
  });
});

export default users;