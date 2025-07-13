/**
 * COM2000 Cloudflare Worker - 简化版本
 * 用于测试部署
 */

export interface Env {
  // KV Namespaces
  SESSION_STORE: KVNamespace;
  PROJECT_CACHE: KVNamespace;
  RATE_LIMITER: KVNamespace;
  
  // D1 Database
  DB: D1Database;
  
  // R2 Bucket
  ASSETS: R2Bucket;
  
  // Environment Variables
  ENVIRONMENT: string;
  API_VERSION: string;
  JWT_SECRET: string;
  CORS_ORIGINS: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }
    
    try {
      // Health check endpoint
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          environment: env.ENVIRONMENT || 'development',
          version: env.API_VERSION || '1.0.0',
          services: {
            database: 'connected',
            cache: 'connected',
            storage: 'connected'
          }
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }
      
      // Status endpoint
      if (url.pathname === '/status') {
        return new Response(JSON.stringify({
          message: 'COM2000 API is running',
          timestamp: new Date().toISOString(),
          environment: env.ENVIRONMENT || 'development'
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }
      
      // Test database connection
      if (url.pathname === '/api/test/db') {
        try {
          const result = await env.DB.prepare('SELECT 1 as test').first();
          return new Response(JSON.stringify({
            database: 'connected',
            test_result: result,
            timestamp: new Date().toISOString()
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          });
        } catch (error) {
          return new Response(JSON.stringify({
            database: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          });
        }
      }
      
      // Test KV storage
      if (url.pathname === '/api/test/kv') {
        try {
          const testKey = 'test_' + Date.now();
          const testValue = { message: 'Hello from KV', timestamp: new Date().toISOString() };
          
          await env.SESSION_STORE.put(testKey, JSON.stringify(testValue));
          const retrieved = await env.SESSION_STORE.get(testKey);
          
          return new Response(JSON.stringify({
            kv: 'connected',
            test_key: testKey,
            stored_value: testValue,
            retrieved_value: retrieved ? JSON.parse(retrieved) : null,
            timestamp: new Date().toISOString()
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          });
        } catch (error) {
          return new Response(JSON.stringify({
            kv: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          });
        }
      }
      
      // Root endpoint
      if (url.pathname === '/') {
        return new Response(JSON.stringify({
          message: 'Welcome to COM2000 API',
          version: env.API_VERSION || '1.0.0',
          environment: env.ENVIRONMENT || 'development',
          endpoints: {
            health: '/health',
            status: '/status',
            test_db: '/api/test/db',
            test_kv: '/api/test/kv'
          },
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }
      
      // 404 for other routes
      return new Response(JSON.stringify({
        error: 'Not Found',
        message: `Route ${url.pathname} not found`,
        timestamp: new Date().toISOString()
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
      
    } catch (error) {
      console.error('Worker error:', error);
      
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }
  },
};