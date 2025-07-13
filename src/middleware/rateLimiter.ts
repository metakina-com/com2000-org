import { Context, Next } from 'hono';
import { Env, RateLimitData } from '../types/env';

export async function rateLimiter(c: Context<{ Bindings: Env }>, next: Next) {
  try {
    const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    const userAgent = c.req.header('User-Agent') || 'unknown';
    const path = c.req.path;
    const method = c.req.method;
    
    // Get rate limit configuration
    const maxRequests = parseInt(c.env.RATE_LIMIT_REQUESTS || '100');
    const windowSeconds = parseInt(c.env.RATE_LIMIT_WINDOW || '60');
    
    // Create rate limit key
    const rateLimitKey = `rate_limit:${clientIP}:${method}:${path}`;
    
    // Get current rate limit data
    const currentData = await c.env.USER_SESSIONS.get(rateLimitKey);
    const now = Math.floor(Date.now() / 1000);
    const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
    
    let rateLimitData: RateLimitData;
    
    if (currentData) {
      rateLimitData = JSON.parse(currentData);
      
      // Reset if we're in a new window
      if (rateLimitData.windowStart < windowStart) {
        rateLimitData = {
          count: 1,
          resetTime: windowStart + windowSeconds,
          windowStart
        };
      } else {
        rateLimitData.count++;
      }
    } else {
      rateLimitData = {
        count: 1,
        resetTime: windowStart + windowSeconds,
        windowStart
      };
    }
    
    // Check if rate limit exceeded
    if (rateLimitData.count > maxRequests) {
      // Log rate limit violation
      c.env.ANALYTICS.writeDataPoint({
        blobs: ['rate-limit-exceeded', clientIP, userAgent, path],
        doubles: [now, rateLimitData.count],
        indexes: ['rate-limit']
      });
      
      return c.json({
        error: 'Rate Limit Exceeded',
        message: `Too many requests. Limit: ${maxRequests} requests per ${windowSeconds} seconds`,
        retryAfter: rateLimitData.resetTime - now,
        timestamp: new Date().toISOString()
      }, 429, {
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': rateLimitData.resetTime.toString(),
        'Retry-After': (rateLimitData.resetTime - now).toString()
      });
    }
    
    // Store updated rate limit data
    await c.env.USER_SESSIONS.put(rateLimitKey, JSON.stringify(rateLimitData), {
      expirationTtl: windowSeconds + 10 // Add buffer
    });
    
    // Add rate limit headers
    const remaining = Math.max(0, maxRequests - rateLimitData.count);
    c.header('X-RateLimit-Limit', maxRequests.toString());
    c.header('X-RateLimit-Remaining', remaining.toString());
    c.header('X-RateLimit-Reset', rateLimitData.resetTime.toString());
    
    // Log successful request
    c.env.ANALYTICS.writeDataPoint({
      blobs: ['request', clientIP, userAgent, method, path],
      doubles: [now, rateLimitData.count],
      indexes: ['request']
    });
    
    await next();
  } catch (error) {
    console.error('Rate limiter error:', error);
    // Continue on error to avoid blocking requests
    await next();
  }
}

export async function strictRateLimiter(maxRequests: number, windowSeconds: number) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    try {
      const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
      const path = c.req.path;
      const method = c.req.method;
      
      const rateLimitKey = `strict_rate_limit:${clientIP}:${method}:${path}`;
      const now = Math.floor(Date.now() / 1000);
      const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
      
      const currentData = await c.env.USER_SESSIONS.get(rateLimitKey);
      let rateLimitData: RateLimitData;
      
      if (currentData) {
        rateLimitData = JSON.parse(currentData);
        
        if (rateLimitData.windowStart < windowStart) {
          rateLimitData = {
            count: 1,
            resetTime: windowStart + windowSeconds,
            windowStart
          };
        } else {
          rateLimitData.count++;
        }
      } else {
        rateLimitData = {
          count: 1,
          resetTime: windowStart + windowSeconds,
          windowStart
        };
      }
      
      if (rateLimitData.count > maxRequests) {
        return c.json({
          error: 'Rate Limit Exceeded',
          message: `Too many requests. Limit: ${maxRequests} requests per ${windowSeconds} seconds`,
          retryAfter: rateLimitData.resetTime - now,
          timestamp: new Date().toISOString()
        }, 429);
      }
      
      await c.env.USER_SESSIONS.put(rateLimitKey, JSON.stringify(rateLimitData), {
        expirationTtl: windowSeconds + 10
      });
      
      await next();
    } catch (error) {
      console.error('Strict rate limiter error:', error);
      await next();
    }
  };
}

export async function userBasedRateLimiter(maxRequests: number, windowSeconds: number) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    try {
      const user = c.get('user');
      const clientIP = c.req.header('CF-Connecting-IP') || 'unknown';
      
      // Use user ID if authenticated, otherwise fall back to IP
      const identifier = user?.userId || clientIP;
      const rateLimitKey = `user_rate_limit:${identifier}`;
      
      const now = Math.floor(Date.now() / 1000);
      const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
      
      const currentData = await c.env.USER_SESSIONS.get(rateLimitKey);
      let rateLimitData: RateLimitData;
      
      if (currentData) {
        rateLimitData = JSON.parse(currentData);
        
        if (rateLimitData.windowStart < windowStart) {
          rateLimitData = {
            count: 1,
            resetTime: windowStart + windowSeconds,
            windowStart
          };
        } else {
          rateLimitData.count++;
        }
      } else {
        rateLimitData = {
          count: 1,
          resetTime: windowStart + windowSeconds,
          windowStart
        };
      }
      
      if (rateLimitData.count > maxRequests) {
        return c.json({
          error: 'Rate Limit Exceeded',
          message: `Too many requests. Limit: ${maxRequests} requests per ${windowSeconds} seconds`,
          retryAfter: rateLimitData.resetTime - now,
          timestamp: new Date().toISOString()
        }, 429);
      }
      
      await c.env.USER_SESSIONS.put(rateLimitKey, JSON.stringify(rateLimitData), {
        expirationTtl: windowSeconds + 10
      });
      
      await next();
    } catch (error) {
      console.error('User-based rate limiter error:', error);
      await next();
    }
  };
}