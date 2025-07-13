import { Context, Next } from 'hono';
import { verify } from 'jose';
import { Env, JwtPayload, UserSession } from '../types/env';

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header',
        timestamp: new Date().toISOString()
      }, 401);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify JWT token
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const { payload } = await verify(token, secret);
    const jwtPayload = payload as JwtPayload;

    // Check if token is expired
    if (jwtPayload.exp < Math.floor(Date.now() / 1000)) {
      return c.json({
        error: 'Unauthorized',
        message: 'Token has expired',
        timestamp: new Date().toISOString()
      }, 401);
    }

    // Get user session from KV
    const sessionKey = `session:${jwtPayload.sessionId}`;
    const sessionData = await c.env.USER_SESSIONS.get(sessionKey);
    
    if (!sessionData) {
      return c.json({
        error: 'Unauthorized',
        message: 'Session not found or expired',
        timestamp: new Date().toISOString()
      }, 401);
    }

    const session: UserSession = JSON.parse(sessionData);
    
    // Update last activity
    session.lastActivity = Date.now();
    await c.env.USER_SESSIONS.put(sessionKey, JSON.stringify(session), {
      expirationTtl: 24 * 60 * 60 // 24 hours
    });

    // Add user info to context
    c.set('user', {
      userId: jwtPayload.userId,
      walletAddress: jwtPayload.walletAddress,
      email: jwtPayload.email,
      role: jwtPayload.role,
      permissions: jwtPayload.permissions,
      sessionId: jwtPayload.sessionId
    });

    // Log analytics
    c.env.ANALYTICS.writeDataPoint({
      blobs: ['auth-success', jwtPayload.userId],
      doubles: [Date.now()],
      indexes: ['auth']
    });

    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    // Log analytics
    c.env.ANALYTICS.writeDataPoint({
      blobs: ['auth-failed', error.message],
      doubles: [Date.now()],
      indexes: ['auth']
    });

    return c.json({
      error: 'Unauthorized',
      message: 'Invalid token',
      timestamp: new Date().toISOString()
    }, 401);
  }
}

export function requireRole(requiredRole: string) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get('user');
    
    if (!user) {
      return c.json({
        error: 'Unauthorized',
        message: 'Authentication required',
        timestamp: new Date().toISOString()
      }, 401);
    }

    if (user.role !== requiredRole && user.role !== 'admin') {
      return c.json({
        error: 'Forbidden',
        message: `Role '${requiredRole}' required`,
        timestamp: new Date().toISOString()
      }, 403);
    }

    await next();
  };
}

export function requirePermission(requiredPermission: string) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get('user');
    
    if (!user) {
      return c.json({
        error: 'Unauthorized',
        message: 'Authentication required',
        timestamp: new Date().toISOString()
      }, 401);
    }

    if (!user.permissions.includes(requiredPermission) && user.role !== 'admin') {
      return c.json({
        error: 'Forbidden',
        message: `Permission '${requiredPermission}' required`,
        timestamp: new Date().toISOString()
      }, 403);
    }

    await next();
  };
}

export async function optionalAuth(c: Context<{ Bindings: Env }>, next: Next) {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const secret = new TextEncoder().encode(c.env.JWT_SECRET);
      const { payload } = await verify(token, secret);
      const jwtPayload = payload as JwtPayload;

      if (jwtPayload.exp >= Math.floor(Date.now() / 1000)) {
        c.set('user', {
          userId: jwtPayload.userId,
          walletAddress: jwtPayload.walletAddress,
          email: jwtPayload.email,
          role: jwtPayload.role,
          permissions: jwtPayload.permissions,
          sessionId: jwtPayload.sessionId
        });
      }
    }
  } catch (error) {
    // Ignore auth errors for optional auth
    console.log('Optional auth failed:', error.message);
  }

  await next();
}