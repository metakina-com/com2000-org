import { Hono } from 'hono';
import { sign, verify } from 'hono/jwt';
import { z } from 'zod';
import { Env } from '../types/env';
import { rateLimiter, strictRateLimiter } from '../middleware/rateLimiter';
import { ValidationError, AuthenticationError, ConflictError } from '../middleware/errorHandler';
import { generateId, hashPassword, verifyPassword } from '../utils/crypto';
import { validateEmail, sanitizeInput } from '../utils/validation';

const auth = new Hono<{ Bindings: Env }>();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  remember: z.boolean().optional().default(false)
});

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
           'Password must contain uppercase, lowercase, number and special character'),
  confirmPassword: z.string(),
  username: z.string().min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be less than 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscore and dash'),
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  acceptTerms: z.boolean().refine(val => val === true, 'You must accept the terms and conditions')
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format')
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
           'Password must contain uppercase, lowercase, number and special character'),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
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

// Helper functions
async function createUserSession(env: Env, userId: string, email: string, remember: boolean = false) {
  const sessionId = generateId();
  const expiresAt = Date.now() + (remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000); // 30 days or 1 day
  
  const session = {
    id: sessionId,
    userId,
    email,
    createdAt: Date.now(),
    expiresAt,
    lastActivity: Date.now(),
    ipAddress: '',
    userAgent: ''
  };
  
  // Store session in KV
  await env.USER_SESSIONS.put(`session:${sessionId}`, JSON.stringify(session), {
    expirationTtl: Math.floor((expiresAt - Date.now()) / 1000)
  });
  
  return sessionId;
}

async function generateTokens(env: Env, userId: string, email: string, remember: boolean = false) {
  const sessionId = await createUserSession(env, userId, email, remember);
  
  const accessTokenPayload = {
    sub: userId,
    email,
    sessionId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes
    type: 'access'
  };
  
  const refreshTokenPayload = {
    sub: userId,
    sessionId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (remember ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60), // 30 days or 7 days
    type: 'refresh'
  };
  
  const [accessToken, refreshToken] = await Promise.all([
    sign(accessTokenPayload, env.JWT_SECRET),
    sign(refreshTokenPayload, env.JWT_SECRET)
  ]);
  
  return { accessToken, refreshToken, sessionId };
}

async function getUserByEmail(env: Env, email: string) {
  const stmt = env.DB.prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL');
  return await stmt.bind(email).first();
}

async function getUserById(env: Env, userId: string) {
  const stmt = env.DB.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL');
  return await stmt.bind(userId).first();
}

async function createUser(env: Env, userData: any) {
  const userId = generateId();
  const hashedPassword = await hashPassword(userData.password);
  const now = Date.now();
  
  const stmt = env.DB.prepare(`
    INSERT INTO users (
      id, email, username, password_hash, first_name, last_name, 
      role, status, email_verified, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  await stmt.bind(
    userId,
    userData.email.toLowerCase(),
    userData.username,
    hashedPassword,
    sanitizeInput(userData.firstName),
    sanitizeInput(userData.lastName),
    'user',
    'active',
    false,
    now,
    now
  ).run();
  
  return userId;
}

// Routes

// POST /auth/login
auth.post('/login', strictRateLimiter({ requests: 5, windowMs: 15 * 60 * 1000 }), async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = loginSchema.parse(body);
    
    // Get user by email
    const user = await getUserByEmail(c.env, validatedData.email.toLowerCase());
    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }
    
    // Check if user is active
    if (user.status !== 'active') {
      throw new AuthenticationError('Account is not active');
    }
    
    // Verify password
    const isValidPassword = await verifyPassword(validatedData.password, user.password_hash);
    if (!isValidPassword) {
      throw new AuthenticationError('Invalid email or password');
    }
    
    // Generate tokens
    const { accessToken, refreshToken, sessionId } = await generateTokens(
      c.env, 
      user.id, 
      user.email, 
      validatedData.remember
    );
    
    // Update last login
    const updateStmt = c.env.DB.prepare('UPDATE users SET last_login = ? WHERE id = ?');
    await updateStmt.bind(Date.now(), user.id).run();
    
    // Log analytics
    await c.env.ANALYTICS.writeDataPoint({
      blobs: [
        'user_login',
        user.id,
        c.req.header('cf-connecting-ip') || 'unknown'
      ],
      doubles: [Date.now()],
      indexes: [user.id]
    });
    
    return c.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          emailVerified: user.email_verified
        },
        tokens: {
          accessToken,
          refreshToken
        },
        sessionId
      }
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid input data', error.errors);
    }
    throw error;
  }
});

// POST /auth/register
auth.post('/register', strictRateLimiter({ requests: 3, windowMs: 60 * 60 * 1000 }), async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = registerSchema.parse(body);
    
    // Check if email already exists
    const existingUser = await getUserByEmail(c.env, validatedData.email.toLowerCase());
    if (existingUser) {
      throw new ConflictError('Email already registered');
    }
    
    // Check if username already exists
    const usernameStmt = c.env.DB.prepare('SELECT id FROM users WHERE username = ? AND deleted_at IS NULL');
    const existingUsername = await usernameStmt.bind(validatedData.username).first();
    if (existingUsername) {
      throw new ConflictError('Username already taken');
    }
    
    // Create user
    const userId = await createUser(c.env, validatedData);
    
    // Generate tokens
    const { accessToken, refreshToken, sessionId } = await generateTokens(
      c.env, 
      userId, 
      validatedData.email.toLowerCase()
    );
    
    // Log analytics
    await c.env.ANALYTICS.writeDataPoint({
      blobs: [
        'user_register',
        userId,
        c.req.header('cf-connecting-ip') || 'unknown'
      ],
      doubles: [Date.now()],
      indexes: [userId]
    });
    
    return c.json({
      success: true,
      data: {
        user: {
          id: userId,
          email: validatedData.email.toLowerCase(),
          username: validatedData.username,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          role: 'user',
          emailVerified: false
        },
        tokens: {
          accessToken,
          refreshToken
        },
        sessionId
      }
    }, 201);
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid input data', error.errors);
    }
    throw error;
  }
});

// POST /auth/refresh
auth.post('/refresh', rateLimiter({ requests: 10, windowMs: 60 * 1000 }), async (c) => {
  try {
    const body = await c.req.json();
    const { refreshToken } = refreshTokenSchema.parse(body);
    
    // Verify refresh token
    const payload = await verify(refreshToken, c.env.JWT_SECRET);
    if (payload.type !== 'refresh') {
      throw new AuthenticationError('Invalid token type');
    }
    
    // Check if session exists
    const sessionData = await c.env.USER_SESSIONS.get(`session:${payload.sessionId}`);
    if (!sessionData) {
      throw new AuthenticationError('Session not found');
    }
    
    const session = JSON.parse(sessionData);
    if (session.expiresAt < Date.now()) {
      throw new AuthenticationError('Session expired');
    }
    
    // Get user
    const user = await getUserById(c.env, payload.sub as string);
    if (!user || user.status !== 'active') {
      throw new AuthenticationError('User not found or inactive');
    }
    
    // Generate new access token
    const accessTokenPayload = {
      sub: user.id,
      email: user.email,
      sessionId: payload.sessionId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes
      type: 'access'
    };
    
    const accessToken = await sign(accessTokenPayload, c.env.JWT_SECRET);
    
    // Update session last activity
    session.lastActivity = Date.now();
    await c.env.USER_SESSIONS.put(`session:${payload.sessionId}`, JSON.stringify(session), {
      expirationTtl: Math.floor((session.expiresAt - Date.now()) / 1000)
    });
    
    return c.json({
      success: true,
      data: {
        accessToken
      }
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid input data', error.errors);
    }
    throw error;
  }
});

// POST /auth/logout
auth.post('/logout', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: true, message: 'Logged out successfully' });
    }
    
    const token = authHeader.substring(7);
    const payload = await verify(token, c.env.JWT_SECRET);
    
    // Remove session
    if (payload.sessionId) {
      await c.env.USER_SESSIONS.delete(`session:${payload.sessionId}`);
    }
    
    // Log analytics
    await c.env.ANALYTICS.writeDataPoint({
      blobs: [
        'user_logout',
        payload.sub as string,
        c.req.header('cf-connecting-ip') || 'unknown'
      ],
      doubles: [Date.now()],
      indexes: [payload.sub as string]
    });
    
    return c.json({
      success: true,
      message: 'Logged out successfully'
    });
    
  } catch (error) {
    // Even if token verification fails, we consider logout successful
    return c.json({
      success: true,
      message: 'Logged out successfully'
    });
  }
});

// POST /auth/forgot-password
auth.post('/forgot-password', strictRateLimiter({ requests: 3, windowMs: 60 * 60 * 1000 }), async (c) => {
  try {
    const body = await c.req.json();
    const { email } = forgotPasswordSchema.parse(body);
    
    // Always return success to prevent email enumeration
    const response = {
      success: true,
      message: 'If an account with this email exists, a password reset link has been sent.'
    };
    
    const user = await getUserByEmail(c.env, email.toLowerCase());
    if (!user || user.status !== 'active') {
      return c.json(response);
    }
    
    // Generate reset token
    const resetToken = generateId();
    const expiresAt = Date.now() + (60 * 60 * 1000); // 1 hour
    
    // Store reset token
    await c.env.USER_SESSIONS.put(`reset:${resetToken}`, JSON.stringify({
      userId: user.id,
      email: user.email,
      expiresAt
    }), {
      expirationTtl: 60 * 60 // 1 hour
    });
    
    // In a real implementation, you would send an email here
    // For now, we'll just log it
    console.log(`Password reset token for ${email}: ${resetToken}`);
    
    // Log analytics
    await c.env.ANALYTICS.writeDataPoint({
      blobs: [
        'password_reset_requested',
        user.id,
        c.req.header('cf-connecting-ip') || 'unknown'
      ],
      doubles: [Date.now()],
      indexes: [user.id]
    });
    
    return c.json(response);
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid input data', error.errors);
    }
    throw error;
  }
});

// POST /auth/reset-password
auth.post('/reset-password', strictRateLimiter({ requests: 5, windowMs: 60 * 60 * 1000 }), async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = resetPasswordSchema.parse(body);
    
    // Get reset token data
    const resetData = await c.env.USER_SESSIONS.get(`reset:${validatedData.token}`);
    if (!resetData) {
      throw new AuthenticationError('Invalid or expired reset token');
    }
    
    const resetInfo = JSON.parse(resetData);
    if (resetInfo.expiresAt < Date.now()) {
      throw new AuthenticationError('Reset token has expired');
    }
    
    // Get user
    const user = await getUserById(c.env, resetInfo.userId);
    if (!user || user.status !== 'active') {
      throw new AuthenticationError('User not found or inactive');
    }
    
    // Update password
    const hashedPassword = await hashPassword(validatedData.password);
    const updateStmt = c.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?');
    await updateStmt.bind(hashedPassword, Date.now(), user.id).run();
    
    // Remove reset token
    await c.env.USER_SESSIONS.delete(`reset:${validatedData.token}`);
    
    // Invalidate all user sessions
    // In a real implementation, you might want to keep a list of session IDs per user
    
    // Log analytics
    await c.env.ANALYTICS.writeDataPoint({
      blobs: [
        'password_reset_completed',
        user.id,
        c.req.header('cf-connecting-ip') || 'unknown'
      ],
      doubles: [Date.now()],
      indexes: [user.id]
    });
    
    return c.json({
      success: true,
      message: 'Password reset successfully'
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid input data', error.errors);
    }
    throw error;
  }
});

export default auth;