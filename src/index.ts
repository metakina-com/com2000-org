/**
 * Main entry point for the COM2000 Cloudflare Worker
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';
import { timing } from 'hono/timing';

import { Env } from './types/env';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';

// Import route handlers
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import priceRoutes from './routes/prices';
import idoRoutes from './routes/ido';
import userRoutes from './routes/users';
import healthRoutes from './routes/health';

// Create main Hono app
const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', timing());
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'", 'https:'],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"]
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use('*', cors({
  origin: (origin, c) => {
    const env = c.env;
    
    // Allow requests from configured origins
    const allowedOrigins = [
      'https://com2000.org',
      'https://www.com2000.org',
      'https://app.com2000.org',
      'https://admin.com2000.org'
    ];
    
    // In development, allow localhost
    if (env.ENVIRONMENT === 'development') {
      allowedOrigins.push(
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:8080',
        'http://127.0.0.1:3000'
      );
    }
    
    // Allow if origin is in allowed list or if no origin (same-origin)
    return !origin || allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-API-Key',
    'X-Client-Version',
    'X-Request-ID'
  ],
  exposeHeaders: [
    'X-Request-ID',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset'
  ],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Global rate limiting
app.use('*', rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 1000, // 1000 requests per window
  keyGenerator: (c) => {
    // Use IP address as key
    return c.req.header('CF-Connecting-IP') || 
           c.req.header('X-Forwarded-For') || 
           'unknown';
  }
}));

// Request ID middleware
app.use('*', async (c, next) => {
  const requestId = c.req.header('X-Request-ID') || 
                   crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-ID', requestId);
  await next();
});

// API version middleware
app.use('/api/*', async (c, next) => {
  c.header('X-API-Version', '1.0.0');
  await next();
});

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'COM2000 API',
    version: '1.0.0',
    description: 'Decentralized investment platform API',
    environment: c.env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      projects: '/api/projects',
      prices: '/api/prices',
      ido: '/api/ido',
      users: '/api/users',
      health: '/api/health'
    },
    documentation: 'https://docs.com2000.org/api',
    support: 'https://support.com2000.org'
  });
});

// API status endpoint
app.get('/status', (c) => {
  return c.json({
    status: 'operational',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: c.env.ENVIRONMENT,
    region: c.req.header('CF-Ray')?.split('-')[1] || 'unknown'
  });
});

// Mount route handlers
app.route('/api/auth', authRoutes);
app.route('/api/projects', projectRoutes);
app.route('/api/prices', priceRoutes);
app.route('/api/ido', idoRoutes);
app.route('/api/users', userRoutes);
app.route('/api/health', healthRoutes);

// API documentation endpoint
app.get('/api', (c) => {
  return c.json({
    name: 'COM2000 API',
    version: '1.0.0',
    description: 'RESTful API for the COM2000 decentralized investment platform',
    baseUrl: new URL(c.req.url).origin + '/api',
    authentication: {
      type: 'Bearer Token (JWT)',
      header: 'Authorization: Bearer <token>',
      endpoints: {
        login: 'POST /auth/login',
        register: 'POST /auth/register',
        refresh: 'POST /auth/refresh'
      }
    },
    rateLimit: {
      global: '1000 requests per 15 minutes',
      authenticated: '5000 requests per 15 minutes',
      strict: '100 requests per 15 minutes (search, etc.)'
    },
    endpoints: {
      authentication: {
        'POST /auth/login': 'User login',
        'POST /auth/register': 'User registration',
        'POST /auth/logout': 'User logout',
        'POST /auth/refresh': 'Refresh access token',
        'POST /auth/forgot-password': 'Request password reset',
        'POST /auth/reset-password': 'Reset password with token'
      },
      projects: {
        'GET /projects': 'List projects with filtering and pagination',
        'GET /projects/trending': 'Get trending projects',
        'GET /projects/:id': 'Get project details'
      },
      prices: {
        'GET /prices': 'Get multiple token prices',
        'GET /prices/:symbol': 'Get single token price',
        'GET /prices/compare': 'Compare multiple tokens',
        'GET /prices/trending': 'Get trending price movements'
      },
      ido: {
        'GET /ido/pools': 'List IDO pools',
        'GET /ido/pools/:id': 'Get IDO pool details',
        'POST /ido/pools/:id/invest': 'Invest in IDO pool',
        'GET /ido/pools/:id/investments': 'Get user investments in pool',
        'GET /ido/my-investments': 'Get all user investments'
      },
      users: {
        'GET /users/me': 'Get current user profile',
        'PUT /users/me': 'Update user profile',
        'GET /users/me/settings': 'Get user settings',
        'PUT /users/me/settings': 'Update user settings',
        'POST /users/me/change-password': 'Change password',
        'GET /users/:username': 'Get public user profile',
        'GET /users': 'List users (admin only)',
        'PUT /users/:id/status': 'Update user status (admin only)'
      },
      health: {
        'GET /health': 'Basic health check',
        'GET /health/detailed': 'Detailed health check',
        'GET /health/ready': 'Readiness probe',
        'GET /health/live': 'Liveness probe'
      }
    },
    errors: {
      format: {
        error: 'Error type',
        message: 'Human readable message',
        details: 'Additional error details (optional)',
        requestId: 'Request ID for tracking',
        timestamp: 'ISO 8601 timestamp'
      },
      codes: {
        400: 'Bad Request - Invalid input',
        401: 'Unauthorized - Authentication required',
        403: 'Forbidden - Insufficient permissions',
        404: 'Not Found - Resource not found',
        409: 'Conflict - Resource already exists',
        422: 'Unprocessable Entity - Validation failed',
        429: 'Too Many Requests - Rate limit exceeded',
        500: 'Internal Server Error - Server error',
        502: 'Bad Gateway - External service error',
        503: 'Service Unavailable - Service temporarily unavailable'
      }
    },
    support: {
      documentation: 'https://docs.com2000.org/api',
      github: 'https://github.com/com2000-org/api',
      discord: 'https://discord.gg/com2000',
      email: 'support@com2000.org'
    }
  });
});

// 404 handler for API routes
app.notFound((c) => {
  const path = c.req.path;
  
  if (path.startsWith('/api/')) {
    return c.json({
      error: 'Not Found',
      message: `API endpoint ${path} not found`,
      requestId: c.get('requestId'),
      timestamp: new Date().toISOString(),
      availableEndpoints: [
        '/api/auth',
        '/api/projects',
        '/api/prices',
        '/api/ido',
        '/api/users',
        '/api/health'
      ]
    }, 404);
  }
  
  return c.json({
    error: 'Not Found',
    message: 'The requested resource was not found',
    requestId: c.get('requestId'),
    timestamp: new Date().toISOString()
  }, 404);
});

// Global error handler (must be last)
app.onError(errorHandler);

// Export for Cloudflare Workers
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },
  
  // Scheduled event handler for cron jobs
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Scheduled event triggered:', event.cron);
    
    // Add your scheduled tasks here
    switch (event.cron) {
      case '0 */5 * * * *': // Every 5 minutes
        await updatePriceCache(env);
        break;
        
      case '0 */15 * * * *': // Every 15 minutes
        await updateTrendingProjects(env);
        break;
        
      case '0 0 * * * *': // Every hour
        await cleanupExpiredSessions(env);
        break;
        
      case '0 0 0 * * *': // Daily at midnight
        await generateDailyReports(env);
        break;
        
      default:
        console.log('Unknown cron schedule:', event.cron);
    }
  }
};

// Scheduled task functions
async function updatePriceCache(env: Env): Promise<void> {
  try {
    console.log('Updating price cache...');
    
    // Import price update logic
    const { updateAllPrices } = await import('./utils/priceUpdater');
    await updateAllPrices(env);
    
    console.log('Price cache updated successfully');
  } catch (error) {
    console.error('Failed to update price cache:', error);
  }
}

async function updateTrendingProjects(env: Env): Promise<void> {
  try {
    console.log('Updating trending projects...');
    
    // Import trending update logic
    const { updateTrendingProjects: updateTrending } = await import('./utils/trendingUpdater');
    await updateTrending(env);
    
    console.log('Trending projects updated successfully');
  } catch (error) {
    console.error('Failed to update trending projects:', error);
  }
}

async function cleanupExpiredSessions(env: Env): Promise<void> {
  try {
    console.log('Cleaning up expired sessions...');
    
    // Import session cleanup logic
    const { cleanupExpiredSessions: cleanup } = await import('./utils/sessionCleanup');
    await cleanup(env);
    
    console.log('Expired sessions cleaned up successfully');
  } catch (error) {
    console.error('Failed to cleanup expired sessions:', error);
  }
}

async function generateDailyReports(env: Env): Promise<void> {
  try {
    console.log('Generating daily reports...');
    
    // Import report generation logic
    const { generateDailyReport } = await import('./utils/reportGenerator');
    await generateDailyReport(env);
    
    console.log('Daily reports generated successfully');
  } catch (error) {
    console.error('Failed to generate daily reports:', error);
  }
}