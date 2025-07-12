import { Hono } from 'hono';
import { z } from 'zod';
import { Env, PriceData, ApiResponse } from '../types/env';
import { optionalAuth } from '../middleware/auth';
import { strictRateLimiter } from '../middleware/rateLimiter';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';

const app = new Hono<{ Bindings: Env }>();

// Validation schemas
const priceQuerySchema = z.object({
  symbols: z.string().optional(),
  vs_currency: z.string().optional().default('usd'),
  include_24hr_change: z.string().optional().transform(val => val === 'true'),
  include_24hr_vol: z.string().optional().transform(val => val === 'true'),
  include_market_cap: z.string().optional().transform(val => val === 'true')
});

const symbolSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required').toUpperCase()
});

const compareSchema = z.object({
  symbols: z.string().min(1, 'Symbols are required'),
  vs_currency: z.string().optional().default('usd')
});

// Apply optional auth to all routes
app.use('*', optionalAuth);

// Apply rate limiting to price endpoints
app.use('*', strictRateLimiter(60, 60)); // 60 requests per minute

// GET /api/v1/prices - Get multiple token prices
app.get('/', async (c) => {
  try {
    const query = priceQuerySchema.parse({
      symbols: c.req.query('symbols'),
      vs_currency: c.req.query('vs_currency'),
      include_24hr_change: c.req.query('include_24hr_change'),
      include_24hr_vol: c.req.query('include_24hr_vol'),
      include_market_cap: c.req.query('include_market_cap')
    });

    let symbols: string[];
    if (query.symbols) {
      symbols = query.symbols.split(',').map(s => s.trim().toUpperCase());
    } else {
      // Get top 50 tokens by default
      symbols = await getTopTokenSymbols(c.env, 50);
    }

    if (symbols.length > 100) {
      throw new ValidationError('Maximum 100 symbols allowed per request');
    }

    // Try to get from cache first
    const cacheKey = `prices:${symbols.sort().join(',')}:${query.vs_currency}`;
    const cachedData = await c.env.PRICE_CACHE.get(cacheKey);
    
    if (cachedData) {
      const response: ApiResponse<Record<string, PriceData>> = JSON.parse(cachedData);
      c.header('X-Cache', 'HIT');
      return c.json(response);
    }

    // Get prices from database
    const placeholders = symbols.map(() => '?').join(',');
    const sql = `
      SELECT symbol, price, price_usd, change_24h, volume_24h, market_cap, last_updated, source
      FROM price_cache 
      WHERE symbol IN (${placeholders})
      ORDER BY symbol
    `;

    const result = await c.env.DB.prepare(sql).bind(...symbols).all();
    
    if (!result.success) {
      throw new Error('Database query failed');
    }

    const pricesData: Record<string, PriceData> = {};
    
    result.results.forEach(row => {
      pricesData[row.symbol.toLowerCase()] = {
        symbol: row.symbol,
        price: row.price,
        priceUsd: row.price_usd,
        change24h: query.include_24hr_change ? row.change_24h : undefined,
        volume24h: query.include_24hr_vol ? row.volume_24h : undefined,
        marketCap: query.include_market_cap ? row.market_cap : undefined,
        lastUpdated: row.last_updated,
        source: row.source
      };
    });

    // Check for missing symbols and fetch from external API if needed
    const missingSymbols = symbols.filter(symbol => !pricesData[symbol.toLowerCase()]);
    if (missingSymbols.length > 0) {
      const externalPrices = await fetchExternalPrices(missingSymbols, query.vs_currency);
      Object.assign(pricesData, externalPrices);
      
      // Cache the external prices
      await cacheExternalPrices(c.env, externalPrices);
    }

    const response: ApiResponse<Record<string, PriceData>> = {
      success: true,
      data: pricesData,
      timestamp: new Date().toISOString()
    };

    // Cache the response
    const cacheTtl = parseInt(c.env.CACHE_TTL_PRICES || '30');
    await c.env.PRICE_CACHE.put(cacheKey, JSON.stringify(response), {
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

// GET /api/v1/prices/:symbol - Get single token price
app.get('/:symbol', async (c) => {
  try {
    const { symbol } = symbolSchema.parse({ symbol: c.req.param('symbol') });
    const vsCurrency = c.req.query('vs_currency') || 'usd';
    
    // Try cache first
    const cacheKey = `price:${symbol}:${vsCurrency}`;
    const cachedData = await c.env.PRICE_CACHE.get(cacheKey);
    
    if (cachedData) {
      c.header('X-Cache', 'HIT');
      return c.json(JSON.parse(cachedData));
    }

    // Get from database
    const sql = `
      SELECT symbol, price, price_usd, change_24h, volume_24h, market_cap, last_updated, source
      FROM price_cache 
      WHERE symbol = ?
    `;

    const result = await c.env.DB.prepare(sql).bind(symbol).first();
    
    let priceData: PriceData;
    
    if (result) {
      priceData = {
        symbol: result.symbol,
        price: result.price,
        priceUsd: result.price_usd,
        change24h: result.change_24h,
        volume24h: result.volume_24h,
        marketCap: result.market_cap,
        lastUpdated: result.last_updated,
        source: result.source
      };
    } else {
      // Fetch from external API
      const externalPrices = await fetchExternalPrices([symbol], vsCurrency);
      const externalPrice = externalPrices[symbol.toLowerCase()];
      
      if (!externalPrice) {
        throw new NotFoundError(`Price data for ${symbol}`);
      }
      
      priceData = externalPrice;
      
      // Cache the external price
      await cacheExternalPrices(c.env, { [symbol.toLowerCase()]: externalPrice });
    }

    const response: ApiResponse<PriceData> = {
      success: true,
      data: priceData,
      timestamp: new Date().toISOString()
    };

    // Cache the response
    const cacheTtl = parseInt(c.env.CACHE_TTL_PRICES || '30');
    await c.env.PRICE_CACHE.put(cacheKey, JSON.stringify(response), {
      expirationTtl: cacheTtl
    });

    c.header('X-Cache', 'MISS');
    return c.json(response);

  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid symbol format');
    }
    throw error;
  }
});

// GET /api/v1/prices/compare - Compare multiple token prices
app.get('/compare', async (c) => {
  try {
    const query = compareSchema.parse({
      symbols: c.req.query('symbols'),
      vs_currency: c.req.query('vs_currency')
    });

    const symbols = query.symbols.split(',').map(s => s.trim().toUpperCase());
    
    if (symbols.length < 2) {
      throw new ValidationError('At least 2 symbols required for comparison');
    }
    
    if (symbols.length > 10) {
      throw new ValidationError('Maximum 10 symbols allowed for comparison');
    }

    // Get prices for all symbols
    const placeholders = symbols.map(() => '?').join(',');
    const sql = `
      SELECT symbol, price, price_usd, change_24h, volume_24h, market_cap, last_updated
      FROM price_cache 
      WHERE symbol IN (${placeholders})
      ORDER BY market_cap DESC
    `;

    const result = await c.env.DB.prepare(sql).bind(...symbols).all();
    
    if (!result.success) {
      throw new Error('Database query failed');
    }

    const pricesData = result.results.map(row => ({
      symbol: row.symbol,
      price: row.price,
      priceUsd: row.price_usd,
      change24h: row.change_24h,
      volume24h: row.volume_24h,
      marketCap: row.market_cap,
      lastUpdated: row.last_updated
    }));

    // Calculate comparison metrics
    const comparison = {
      symbols: symbols,
      prices: pricesData,
      analysis: {
        highest_price: pricesData.reduce((max, p) => p.price > max.price ? p : max, pricesData[0]),
        lowest_price: pricesData.reduce((min, p) => p.price < min.price ? p : min, pricesData[0]),
        highest_change: pricesData.reduce((max, p) => p.change24h > max.change24h ? p : max, pricesData[0]),
        lowest_change: pricesData.reduce((min, p) => p.change24h < min.change24h ? p : min, pricesData[0]),
        highest_volume: pricesData.reduce((max, p) => p.volume24h > max.volume24h ? p : max, pricesData[0]),
        total_market_cap: pricesData.reduce((sum, p) => sum + (p.marketCap || 0), 0)
      }
    };

    const response: ApiResponse = {
      success: true,
      data: comparison,
      timestamp: new Date().toISOString()
    };

    return c.json(response);

  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(`Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
});

// GET /api/v1/prices/trending - Get trending price movements
app.get('/trending', async (c) => {
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
    const timeframe = c.req.query('timeframe') || '24h';
    
    // Try cache first
    const cacheKey = `trending_prices:${limit}:${timeframe}`;
    const cachedData = await c.env.PRICE_CACHE.get(cacheKey);
    
    if (cachedData) {
      c.header('X-Cache', 'HIT');
      return c.json(JSON.parse(cachedData));
    }

    // Get trending prices from database
    const sql = `
      SELECT symbol, price, price_usd, change_24h, volume_24h, market_cap, last_updated,
             ABS(change_24h) as abs_change
      FROM price_cache 
      WHERE change_24h IS NOT NULL
      ORDER BY abs_change DESC, volume_24h DESC
      LIMIT ?
    `;

    const result = await c.env.DB.prepare(sql).bind(limit).all();
    
    if (!result.success) {
      throw new Error('Database query failed');
    }

    const trendingPrices = result.results.map(row => ({
      symbol: row.symbol,
      price: row.price,
      priceUsd: row.price_usd,
      change24h: row.change_24h,
      volume24h: row.volume_24h,
      marketCap: row.market_cap,
      lastUpdated: row.last_updated,
      trend: row.change_24h > 0 ? 'up' : 'down',
      volatility: Math.abs(row.change_24h)
    }));

    const response: ApiResponse = {
      success: true,
      data: trendingPrices,
      timestamp: new Date().toISOString()
    };

    // Cache for shorter time due to dynamic nature
    await c.env.PRICE_CACHE.put(cacheKey, JSON.stringify(response), {
      expirationTtl: 120 // 2 minutes
    });

    c.header('X-Cache', 'MISS');
    return c.json(response);

  } catch (error) {
    throw error;
  }
});

// Helper functions
async function getTopTokenSymbols(env: Env, limit: number): Promise<string[]> {
  const sql = `
    SELECT symbol 
    FROM price_cache 
    WHERE market_cap IS NOT NULL 
    ORDER BY market_cap DESC 
    LIMIT ?
  `;
  
  const result = await env.DB.prepare(sql).bind(limit).all();
  return result.results.map(row => row.symbol);
}

async function fetchExternalPrices(symbols: string[], vsCurrency: string): Promise<Record<string, PriceData>> {
  // This would integrate with external price APIs like CoinGecko, CoinMarketCap, etc.
  // For now, return mock data
  const prices: Record<string, PriceData> = {};
  
  symbols.forEach(symbol => {
    prices[symbol.toLowerCase()] = {
      symbol: symbol,
      price: Math.random() * 1000,
      priceUsd: Math.random() * 1000,
      change24h: (Math.random() - 0.5) * 20,
      volume24h: Math.random() * 1000000,
      marketCap: Math.random() * 1000000000,
      lastUpdated: Date.now(),
      source: 'external_api'
    };
  });
  
  return prices;
}

async function cacheExternalPrices(env: Env, prices: Record<string, PriceData>) {
  const promises = Object.entries(prices).map(([symbol, priceData]) => {
    const sql = `
      INSERT OR REPLACE INTO price_cache 
      (symbol, price, price_usd, change_24h, volume_24h, market_cap, last_updated, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    return env.DB.prepare(sql).bind(
      priceData.symbol,
      priceData.price,
      priceData.priceUsd,
      priceData.change24h,
      priceData.volume24h,
      priceData.marketCap,
      priceData.lastUpdated,
      priceData.source
    ).run();
  });
  
  await Promise.all(promises);
}

export { app as priceRoutes };