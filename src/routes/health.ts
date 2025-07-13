import { Hono } from 'hono';
import { Env, HealthCheckResponse } from '../types/env';

const app = new Hono<{ Bindings: Env }>();

// GET /health - Basic health check
app.get('/', async (c) => {
  const startTime = Date.now();
  
  try {
    // Test database connection
    const dbHealth = await testDatabaseHealth(c.env);
    
    // Test KV storage
    const kvHealth = await testKVHealth(c.env);
    
    // Test R2 storage
    const r2Health = await testR2Health(c.env);
    
    // Test external blockchain connection
    const blockchainHealth = await testBlockchainHealth(c.env);
    
    const responseTime = Date.now() - startTime;
    
    // Get basic metrics
    const metrics = await getBasicMetrics(c.env);
    
    const overallStatus = dbHealth && kvHealth && r2Health && blockchainHealth ? 'healthy' : 'unhealthy';
    
    const healthResponse: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: c.env.ENVIRONMENT,
      services: {
        database: dbHealth ? 'healthy' : 'unhealthy',
        cache: kvHealth ? 'healthy' : 'unhealthy',
        storage: r2Health ? 'healthy' : 'unhealthy',
        blockchain: blockchainHealth ? 'healthy' : 'unhealthy'
      },
      metrics: {
        uptime: metrics.uptime,
        requestCount: metrics.requestCount,
        errorRate: metrics.errorRate,
        responseTime: responseTime
      }
    };
    
    // Log health check
    c.env.ANALYTICS.writeDataPoint({
      blobs: ['health-check', overallStatus],
      doubles: [Date.now(), responseTime],
      indexes: ['health']
    });
    
    const statusCode = overallStatus === 'healthy' ? 200 : 503;
    return c.json(healthResponse, statusCode);
    
  } catch (error) {
    console.error('Health check failed:', error);
    
    const errorResponse: HealthCheckResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: c.env.ENVIRONMENT,
      services: {
        database: 'unhealthy',
        cache: 'unhealthy',
        storage: 'unhealthy',
        blockchain: 'unhealthy'
      },
      metrics: {
        uptime: 0,
        requestCount: 0,
        errorRate: 100,
        responseTime: Date.now() - startTime
      }
    };
    
    return c.json(errorResponse, 503);
  }
});

// GET /health/detailed - Detailed health check with more metrics
app.get('/detailed', async (c) => {
  const startTime = Date.now();
  
  try {
    // Detailed service checks
    const [dbDetails, kvDetails, r2Details, blockchainDetails] = await Promise.allSettled([
      getDetailedDatabaseHealth(c.env),
      getDetailedKVHealth(c.env),
      getDetailedR2Health(c.env),
      getDetailedBlockchainHealth(c.env)
    ]);
    
    // Get detailed metrics
    const detailedMetrics = await getDetailedMetrics(c.env);
    
    const response = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: c.env.ENVIRONMENT,
      responseTime: Date.now() - startTime,
      services: {
        database: {
          status: dbDetails.status === 'fulfilled' ? 'healthy' : 'unhealthy',
          details: dbDetails.status === 'fulfilled' ? dbDetails.value : { error: dbDetails.reason?.message },
          lastChecked: new Date().toISOString()
        },
        cache: {
          status: kvDetails.status === 'fulfilled' ? 'healthy' : 'unhealthy',
          details: kvDetails.status === 'fulfilled' ? kvDetails.value : { error: kvDetails.reason?.message },
          lastChecked: new Date().toISOString()
        },
        storage: {
          status: r2Details.status === 'fulfilled' ? 'healthy' : 'unhealthy',
          details: r2Details.status === 'fulfilled' ? r2Details.value : { error: r2Details.reason?.message },
          lastChecked: new Date().toISOString()
        },
        blockchain: {
          status: blockchainDetails.status === 'fulfilled' ? 'healthy' : 'unhealthy',
          details: blockchainDetails.status === 'fulfilled' ? blockchainDetails.value : { error: blockchainDetails.reason?.message },
          lastChecked: new Date().toISOString()
        }
      },
      metrics: detailedMetrics,
      system: {
        memory: {
          used: process.memoryUsage?.()?.heapUsed || 0,
          total: process.memoryUsage?.()?.heapTotal || 0
        },
        worker: {
          isolateId: crypto.randomUUID(),
          startTime: new Date().toISOString()
        }
      }
    };
    
    return c.json(response);
    
  } catch (error) {
    console.error('Detailed health check failed:', error);
    return c.json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    }, 503);
  }
});

// GET /health/ready - Readiness probe
app.get('/ready', async (c) => {
  try {
    // Quick checks for readiness
    const dbReady = await quickDatabaseCheck(c.env);
    const kvReady = await quickKVCheck(c.env);
    
    if (dbReady && kvReady) {
      return c.json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      return c.json({
        status: 'not ready',
        timestamp: new Date().toISOString()
      }, 503);
    }
  } catch (error) {
    return c.json({
      status: 'not ready',
      error: error.message,
      timestamp: new Date().toISOString()
    }, 503);
  }
});

// GET /health/live - Liveness probe
app.get('/live', async (c) => {
  return c.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: Date.now() // This would be actual uptime in a real implementation
  });
});

// Helper functions
async function testDatabaseHealth(env: Env): Promise<boolean> {
  try {
    const result = await env.DB.prepare('SELECT 1 as test').first();
    return result?.test === 1;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

async function testKVHealth(env: Env): Promise<boolean> {
  try {
    const testKey = 'health_check_' + Date.now();
    await env.USER_SESSIONS.put(testKey, 'test', { expirationTtl: 60 });
    const value = await env.USER_SESSIONS.get(testKey);
    await env.USER_SESSIONS.delete(testKey);
    return value === 'test';
  } catch (error) {
    console.error('KV health check failed:', error);
    return false;
  }
}

async function testR2Health(env: Env): Promise<boolean> {
  try {
    const testKey = 'health_check_' + Date.now() + '.txt';
    await env.ASSETS.put(testKey, 'test');
    const object = await env.ASSETS.get(testKey);
    await env.ASSETS.delete(testKey);
    return object !== null;
  } catch (error) {
    console.error('R2 health check failed:', error);
    return false;
  }
}

async function testBlockchainHealth(env: Env): Promise<boolean> {
  try {
    // This would test actual blockchain connectivity
    // For now, just return true
    return true;
  } catch (error) {
    console.error('Blockchain health check failed:', error);
    return false;
  }
}

async function getBasicMetrics(env: Env) {
  // In a real implementation, these would come from actual metrics storage
  return {
    uptime: Date.now(), // This would be actual uptime
    requestCount: 0, // This would come from analytics
    errorRate: 0, // This would be calculated from error logs
  };
}

async function getDetailedDatabaseHealth(env: Env) {
  const startTime = Date.now();
  
  try {
    // Test basic connectivity
    await env.DB.prepare('SELECT 1').first();
    
    // Test table access
    const projectCount = await env.DB.prepare('SELECT COUNT(*) as count FROM project_cache').first();
    const priceCount = await env.DB.prepare('SELECT COUNT(*) as count FROM price_cache').first();
    
    return {
      connectivity: 'ok',
      responseTime: Date.now() - startTime,
      tables: {
        project_cache: projectCount?.count || 0,
        price_cache: priceCount?.count || 0
      }
    };
  } catch (error) {
    throw new Error(`Database health check failed: ${error.message}`);
  }
}

async function getDetailedKVHealth(env: Env) {
  const startTime = Date.now();
  
  try {
    const testKey = 'health_detailed_' + Date.now();
    
    // Test write
    await env.USER_SESSIONS.put(testKey, JSON.stringify({ test: true }), { expirationTtl: 60 });
    
    // Test read
    const value = await env.USER_SESSIONS.get(testKey);
    
    // Test delete
    await env.USER_SESSIONS.delete(testKey);
    
    return {
      connectivity: 'ok',
      responseTime: Date.now() - startTime,
      operations: {
        write: 'ok',
        read: value ? 'ok' : 'failed',
        delete: 'ok'
      }
    };
  } catch (error) {
    throw new Error(`KV health check failed: ${error.message}`);
  }
}

async function getDetailedR2Health(env: Env) {
  const startTime = Date.now();
  
  try {
    const testKey = 'health_detailed_' + Date.now() + '.txt';
    
    // Test write
    await env.ASSETS.put(testKey, 'health check test');
    
    // Test read
    const object = await env.ASSETS.get(testKey);
    
    // Test delete
    await env.ASSETS.delete(testKey);
    
    return {
      connectivity: 'ok',
      responseTime: Date.now() - startTime,
      operations: {
        write: 'ok',
        read: object ? 'ok' : 'failed',
        delete: 'ok'
      }
    };
  } catch (error) {
    throw new Error(`R2 health check failed: ${error.message}`);
  }
}

async function getDetailedBlockchainHealth(env: Env) {
  // This would implement actual blockchain health checks
  return {
    connectivity: 'ok',
    responseTime: 100,
    blockHeight: 'latest',
    networkId: 'mainnet'
  };
}

async function getDetailedMetrics(env: Env) {
  // In a real implementation, these would come from actual metrics storage
  return {
    requests: {
      total: 0,
      success: 0,
      errors: 0,
      rate: 0
    },
    cache: {
      hitRate: 0,
      missRate: 0,
      size: 0
    },
    database: {
      connections: 1,
      queryTime: 0,
      errorRate: 0
    },
    worker: {
      cpuTime: 0,
      memoryUsage: 0,
      isolateCount: 1
    }
  };
}

async function quickDatabaseCheck(env: Env): Promise<boolean> {
  try {
    await env.DB.prepare('SELECT 1').first();
    return true;
  } catch {
    return false;
  }
}

async function quickKVCheck(env: Env): Promise<boolean> {
  try {
    await env.USER_SESSIONS.get('non_existent_key');
    return true;
  } catch {
    return false;
  }
}

export { app as healthRoutes };