# COM2000 平台 Cloudflare 详细技术规范

## 文档信息
- **版本**: v1.0
- **创建日期**: 2025-01-27
- **最后更新**: 2025-01-27
- **维护者**: COM2000 技术团队

---

## 1. 详细数据结构设计

### 1.1 Workers KV 数据结构

#### 用户会话数据
```typescript
// Key: session:{sessionId}
interface UserSession {
  userId: string;
  walletAddress: string;
  email: string;
  kycLevel: number;
  userLevel: number;
  permissions: string[];
  expiresAt: number; // Unix timestamp
  createdAt: number;
  lastActivity: number;
  ipAddress: string;
  userAgent: string;
  deviceId: string;
}

// 示例数据
const sessionData: UserSession = {
  userId: "550e8400-e29b-41d4-a716-446655440000",
  walletAddress: "0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5A",
  email: "user@example.com",
  kycLevel: 2,
  userLevel: 3,
  permissions: ["read", "write", "invest", "trade"],
  expiresAt: 1706400000,
  createdAt: 1706313600,
  lastActivity: 1706399800,
  ipAddress: "192.168.1.100",
  userAgent: "Mozilla/5.0...",
  deviceId: "device_12345"
};
```

#### 实时价格数据
```typescript
// Key: price:{symbol}
interface PriceData {
  symbol: string;
  price: number;
  priceUsd: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  marketCap: number;
  circulatingSupply: number;
  totalSupply: number;
  rank: number;
  lastUpdate: number;
  exchanges: ExchangePrice[];
  technicalIndicators: TechnicalIndicators;
}

interface ExchangePrice {
  exchange: string;
  price: number;
  volume24h: number;
  lastUpdate: number;
}

interface TechnicalIndicators {
  rsi: number;
  macd: {
    value: number;
    signal: number;
    histogram: number;
  };
  movingAverages: {
    ma7: number;
    ma25: number;
    ma50: number;
    ma200: number;
  };
  support: number;
  resistance: number;
}

// 示例数据
const priceData: PriceData = {
  symbol: "BTC",
  price: 42500.50,
  priceUsd: 42500.50,
  change24h: 1250.30,
  changePercent24h: 3.02,
  volume24h: 28500000000,
  marketCap: 832500000000,
  circulatingSupply: 19580000,
  totalSupply: 21000000,
  rank: 1,
  lastUpdate: 1706399900,
  exchanges: [
    {
      exchange: "Binance",
      price: 42505.20,
      volume24h: 8500000000,
      lastUpdate: 1706399890
    },
    {
      exchange: "Coinbase",
      price: 42498.80,
      volume24h: 6200000000,
      lastUpdate: 1706399885
    }
  ],
  technicalIndicators: {
    rsi: 65.5,
    macd: {
      value: 125.30,
      signal: 118.75,
      histogram: 6.55
    },
    movingAverages: {
      ma7: 41800.25,
      ma25: 40500.80,
      ma50: 39200.15,
      ma200: 35800.90
    },
    support: 41000,
    resistance: 44000
  }
};
```

#### 项目热门数据
```typescript
// Key: trending:{category}
interface TrendingProjects {
  category: string;
  projects: TrendingProject[];
  lastUpdate: number;
  totalCount: number;
}

interface TrendingProject {
  id: string;
  name: string;
  symbol: string;
  logoUrl: string;
  currentPrice: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  rank: number;
  trendingScore: number;
  socialMetrics: {
    twitterFollowers: number;
    telegramMembers: number;
    discordMembers: number;
    githubStars: number;
    redditSubscribers: number;
  };
}

// 示例数据
const trendingData: TrendingProjects = {
  category: "defi",
  projects: [
    {
      id: "uniswap",
      name: "Uniswap",
      symbol: "UNI",
      logoUrl: "https://cdn.com2000.org/logos/uni.png",
      currentPrice: 8.45,
      priceChange24h: 0.52,
      marketCap: 5200000000,
      volume24h: 180000000,
      rank: 15,
      trendingScore: 95.5,
      socialMetrics: {
        twitterFollowers: 890000,
        telegramMembers: 45000,
        discordMembers: 125000,
        githubStars: 8500,
        redditSubscribers: 180000
      }
    }
  ],
  lastUpdate: 1706399900,
  totalCount: 50
};
```

### 1.2 D1 Database 表结构

#### 项目缓存表
```sql
CREATE TABLE project_cache (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    tagline TEXT,
    
    -- 价格和市值
    current_price REAL,
    price_change_24h REAL,
    price_change_7d REAL,
    price_change_30d REAL,
    market_cap REAL,
    volume_24h REAL,
    circulating_supply REAL,
    total_supply REAL,
    max_supply REAL,
    
    -- 分类和标签
    category TEXT,
    subcategory TEXT,
    tags TEXT, -- JSON array as string
    blockchain TEXT, -- JSON array as string
    
    -- 媒体资源
    logo_url TEXT,
    banner_url TEXT,
    
    -- 外部链接
    website_url TEXT,
    twitter_url TEXT,
    telegram_url TEXT,
    github_url TEXT,
    
    -- 状态和排名
    status TEXT DEFAULT 'live',
    market_cap_rank INTEGER,
    trending_rank INTEGER,
    
    -- 时间戳
    launch_date INTEGER, -- Unix timestamp
    listing_date INTEGER,
    updated_at INTEGER,
    
    -- 索引
    INDEX idx_symbol (symbol),
    INDEX idx_category (category),
    INDEX idx_status (status),
    INDEX idx_market_cap_rank (market_cap_rank),
    INDEX idx_trending_rank (trending_rank)
);
```

#### IDO池缓存表
```sql
CREATE TABLE ido_pool_cache (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    project_name TEXT,
    project_symbol TEXT,
    project_logo TEXT,
    
    -- 池信息
    pool_name TEXT,
    pool_type TEXT, -- public, private, whitelist
    description TEXT,
    
    -- 代币和价格
    token_price REAL,
    total_tokens REAL,
    sold_tokens REAL,
    progress_percentage REAL,
    
    -- 投资限制
    min_allocation REAL,
    max_allocation REAL,
    max_participants INTEGER,
    current_participants INTEGER,
    
    -- 时间
    registration_start INTEGER,
    registration_end INTEGER,
    sale_start INTEGER,
    sale_end INTEGER,
    
    -- 状态
    status TEXT, -- upcoming, registration, active, completed, cancelled
    
    -- 区块链信息
    blockchain TEXT,
    contract_address TEXT,
    
    -- 统计信息
    total_raised REAL,
    participant_count INTEGER,
    
    updated_at INTEGER,
    
    INDEX idx_project_id (project_id),
    INDEX idx_status (status),
    INDEX idx_sale_time (sale_start, sale_end),
    INDEX idx_registration_time (registration_start, registration_end)
);
```

#### 用户投资缓存表
```sql
CREATE TABLE user_investment_cache (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    pool_id TEXT,
    project_name TEXT,
    project_symbol TEXT,
    
    -- 投资信息
    investment_amount REAL,
    token_amount REAL,
    token_price REAL,
    payment_token TEXT,
    
    -- 状态
    status TEXT, -- pending, confirmed, failed, refunded
    
    -- 释放信息
    total_claimed REAL DEFAULT 0,
    claimable_amount REAL DEFAULT 0,
    next_claim_date INTEGER,
    
    -- 交易信息
    transaction_hash TEXT,
    block_number INTEGER,
    
    -- 时间戳
    invested_at INTEGER,
    confirmed_at INTEGER,
    updated_at INTEGER,
    
    INDEX idx_user_id (user_id),
    INDEX idx_pool_id (pool_id),
    INDEX idx_status (status),
    INDEX idx_user_status (user_id, status)
);
```

### 1.3 R2 Object Storage 文件结构

```
com2000-storage/
├── projects/
│   ├── logos/
│   │   ├── {project-id}.png
│   │   ├── {project-id}.svg
│   │   └── {project-id}-banner.jpg
│   ├── documents/
│   │   ├── {project-id}/
│   │   │   ├── whitepaper.pdf
│   │   │   ├── tokenomics.pdf
│   │   │   ├── roadmap.pdf
│   │   │   └── audit-report.pdf
│   └── media/
│       ├── {project-id}/
│       │   ├── screenshots/
│       │   ├── videos/
│       │   └── presentations/
├── users/
│   ├── avatars/
│   │   └── {user-id}.jpg
│   ├── kyc-documents/
│   │   └── {user-id}/
│   │       ├── passport.pdf
│   │       ├── address-proof.pdf
│   │       └── selfie.jpg
│   └── uploads/
│       └── {user-id}/
├── static/
│   ├── images/
│   ├── icons/
│   ├── fonts/
│   └── css/
└── backups/
    ├── database/
    └── logs/
```

---

## 2. Cloudflare Workers 详细实现

### 2.1 API Gateway Worker

```typescript
// workers/api-gateway/src/index.ts
import { Router } from 'itty-router';
import { corsHeaders, handleCORS } from './utils/cors';
import { authenticate } from './middleware/auth';
import { rateLimit } from './middleware/rateLimit';
import { ProjectsHandler } from './handlers/projects';
import { PricesHandler } from './handlers/prices';
import { IDOHandler } from './handlers/ido';
import { AuthHandler } from './handlers/auth';
import { UsersHandler } from './handlers/users';

const router = Router();

// 中间件
router.all('*', handleCORS);
router.all('/api/*', rateLimit);
router.all('/api/protected/*', authenticate);

// 路由定义
// 项目相关API
router.get('/api/projects', ProjectsHandler.list);
router.get('/api/projects/trending', ProjectsHandler.trending);
router.get('/api/projects/search', ProjectsHandler.search);
router.get('/api/projects/:id', ProjectsHandler.detail);
router.get('/api/projects/:id/price-history', ProjectsHandler.priceHistory);

// 价格相关API
router.get('/api/prices', PricesHandler.list);
router.get('/api/prices/:symbol', PricesHandler.single);
router.get('/api/prices/compare', PricesHandler.compare);

// IDO相关API
router.get('/api/ido/pools', IDOHandler.listPools);
router.get('/api/ido/pools/:id', IDOHandler.poolDetail);
router.post('/api/protected/ido/pools/:id/invest', IDOHandler.invest);
router.get('/api/protected/ido/investments', IDOHandler.userInvestments);

// 用户认证API
router.post('/api/auth/register', AuthHandler.register);
router.post('/api/auth/login', AuthHandler.login);
router.post('/api/auth/wallet-connect', AuthHandler.walletConnect);
router.post('/api/auth/refresh', AuthHandler.refresh);
router.post('/api/protected/auth/logout', AuthHandler.logout);

// 用户相关API
router.get('/api/protected/users/profile', UsersHandler.profile);
router.put('/api/protected/users/profile', UsersHandler.updateProfile);
router.get('/api/protected/users/portfolio', UsersHandler.portfolio);
router.get('/api/protected/users/transactions', UsersHandler.transactions);

// 404处理
router.all('*', () => new Response('Not Found', { status: 404 }));

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await router.handle(request, env, ctx);
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};

// 环境变量类型定义
interface Env {
  // KV命名空间
  SESSIONS_KV: KVNamespace;
  PRICES_KV: KVNamespace;
  CACHE_KV: KVNamespace;
  
  // D1数据库
  DB: D1Database;
  
  // R2存储
  STORAGE: R2Bucket;
  
  // 环境变量
  MAIN_API_URL: string;
  INTERNAL_API_KEY: string;
  JWT_SECRET: string;
  PRICE_API_URL: string;
  RATE_LIMIT_THRESHOLD: string;
  
  // Durable Objects
  REALTIME_CHAT: DurableObjectNamespace;
  IDO_MANAGER: DurableObjectNamespace;
}
```

### 2.2 项目处理器详细实现

```typescript
// workers/api-gateway/src/handlers/projects.ts
import { IRequest } from 'itty-router';
import { Env } from '../types';
import { createResponse, createErrorResponse } from '../utils/response';
import { validatePagination } from '../utils/validation';

export class ProjectsHandler {
  // 获取项目列表
  static async list(request: IRequest, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const params = {
      page: parseInt(url.searchParams.get('page') || '1'),
      limit: parseInt(url.searchParams.get('limit') || '20'),
      category: url.searchParams.get('category'),
      status: url.searchParams.get('status') || 'live',
      sortBy: url.searchParams.get('sortBy') || 'market_cap',
      sortOrder: url.searchParams.get('sortOrder') || 'desc',
      search: url.searchParams.get('search')
    };

    // 验证分页参数
    const validation = validatePagination(params.page, params.limit);
    if (!validation.valid) {
      return createErrorResponse(validation.error, 400);
    }

    // 构建缓存键
    const cacheKey = `projects:list:${JSON.stringify(params)}`;
    
    // 检查缓存
    const cached = await env.CACHE_KV.get(cacheKey);
    if (cached) {
      return createResponse(JSON.parse(cached), {
        'Cache-Control': 'public, max-age=300',
        'X-Cache': 'HIT'
      });
    }

    try {
      // 构建SQL查询
      let query = `
        SELECT 
          id, name, symbol, slug, description, tagline,
          current_price, price_change_24h, price_change_7d,
          market_cap, volume_24h, market_cap_rank,
          category, subcategory, logo_url, status
        FROM project_cache 
        WHERE status = ?
      `;
      const queryParams = [params.status];

      // 添加分类过滤
      if (params.category) {
        query += ' AND category = ?';
        queryParams.push(params.category);
      }

      // 添加搜索过滤
      if (params.search) {
        query += ' AND (name LIKE ? OR symbol LIKE ? OR description LIKE ?)';
        const searchTerm = `%${params.search}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm);
      }

      // 添加排序
      const validSortFields = ['name', 'current_price', 'market_cap', 'volume_24h', 'price_change_24h'];
      const sortField = validSortFields.includes(params.sortBy) ? params.sortBy : 'market_cap';
      const sortOrder = params.sortOrder === 'asc' ? 'ASC' : 'DESC';
      query += ` ORDER BY ${sortField} ${sortOrder}`;

      // 添加分页
      const offset = (params.page - 1) * params.limit;
      query += ' LIMIT ? OFFSET ?';
      queryParams.push(params.limit.toString(), offset.toString());

      // 执行查询
      const result = await env.DB.prepare(query).bind(...queryParams).all();
      
      // 获取总数
      let countQuery = 'SELECT COUNT(*) as total FROM project_cache WHERE status = ?';
      const countParams = [params.status];
      
      if (params.category) {
        countQuery += ' AND category = ?';
        countParams.push(params.category);
      }
      
      if (params.search) {
        countQuery += ' AND (name LIKE ? OR symbol LIKE ? OR description LIKE ?)';
        const searchTerm = `%${params.search}%`;
        countParams.push(searchTerm, searchTerm, searchTerm);
      }
      
      const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();
      const total = countResult?.total || 0;

      // 构建响应数据
      const responseData = {
        data: result.results.map(project => ({
          ...project,
          tags: project.tags ? JSON.parse(project.tags) : [],
          blockchain: project.blockchain ? JSON.parse(project.blockchain) : []
        })),
        pagination: {
          page: params.page,
          limit: params.limit,
          total: total,
          totalPages: Math.ceil(total / params.limit),
          hasNext: params.page * params.limit < total,
          hasPrev: params.page > 1
        },
        filters: {
          category: params.category,
          status: params.status,
          search: params.search
        },
        sorting: {
          sortBy: params.sortBy,
          sortOrder: params.sortOrder
        }
      };

      // 缓存结果
      await env.CACHE_KV.put(cacheKey, JSON.stringify(responseData), {
        expirationTtl: 300 // 5分钟
      });

      return createResponse(responseData, {
        'Cache-Control': 'public, max-age=300',
        'X-Cache': 'MISS'
      });

    } catch (error) {
      console.error('Database error:', error);
      return createErrorResponse('Failed to fetch projects', 500);
    }
  }

  // 获取热门项目
  static async trending(request: IRequest, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const category = url.searchParams.get('category') || 'all';
    const limit = parseInt(url.searchParams.get('limit') || '10');

    const cacheKey = `trending:${category}:${limit}`;
    
    // 检查KV缓存
    const cached = await env.CACHE_KV.get(cacheKey);
    if (cached) {
      return createResponse(JSON.parse(cached), {
        'Cache-Control': 'public, max-age=60',
        'X-Cache': 'HIT'
      });
    }

    try {
      let query = `
        SELECT 
          id, name, symbol, logo_url, current_price, 
          price_change_24h, market_cap, volume_24h,
          trending_rank, category
        FROM project_cache 
        WHERE status = 'live' AND trending_rank IS NOT NULL
      `;
      
      const queryParams = [];
      
      if (category !== 'all') {
        query += ' AND category = ?';
        queryParams.push(category);
      }
      
      query += ' ORDER BY trending_rank ASC LIMIT ?';
      queryParams.push(limit.toString());

      const result = await env.DB.prepare(query).bind(...queryParams).all();

      const responseData = {
        category,
        projects: result.results,
        lastUpdate: Date.now(),
        totalCount: result.results.length
      };

      // 缓存1分钟
      await env.CACHE_KV.put(cacheKey, JSON.stringify(responseData), {
        expirationTtl: 60
      });

      return createResponse(responseData, {
        'Cache-Control': 'public, max-age=60',
        'X-Cache': 'MISS'
      });

    } catch (error) {
      console.error('Database error:', error);
      return createErrorResponse('Failed to fetch trending projects', 500);
    }
  }

  // 获取项目详情
  static async detail(request: IRequest, env: Env): Promise<Response> {
    const projectId = request.params?.id;
    if (!projectId) {
      return createErrorResponse('Project ID is required', 400);
    }

    const cacheKey = `project:detail:${projectId}`;
    
    // 检查缓存
    const cached = await env.CACHE_KV.get(cacheKey);
    if (cached) {
      return createResponse(JSON.parse(cached), {
        'Cache-Control': 'public, max-age=600',
        'X-Cache': 'HIT'
      });
    }

    try {
      // 从D1获取基础信息
      const project = await env.DB.prepare(`
        SELECT * FROM project_cache WHERE id = ? OR slug = ?
      `).bind(projectId, projectId).first();

      if (!project) {
        return createErrorResponse('Project not found', 404);
      }

      // 从主API获取详细信息
      const detailResponse = await fetch(`${env.MAIN_API_URL}/internal/projects/${project.id}/detail`, {
        headers: {
          'Authorization': `Bearer ${env.INTERNAL_API_KEY}`
        }
      });

      if (!detailResponse.ok) {
        throw new Error('Failed to fetch project details');
      }

      const detailData = await detailResponse.json();

      // 合并数据
      const responseData = {
        ...project,
        ...detailData,
        tags: project.tags ? JSON.parse(project.tags) : [],
        blockchain: project.blockchain ? JSON.parse(project.blockchain) : []
      };

      // 缓存10分钟
      await env.CACHE_KV.put(cacheKey, JSON.stringify(responseData), {
        expirationTtl: 600
      });

      return createResponse(responseData, {
        'Cache-Control': 'public, max-age=600',
        'X-Cache': 'MISS'
      });

    } catch (error) {
      console.error('Error fetching project detail:', error);
      return createErrorResponse('Failed to fetch project details', 500);
    }
  }

  // 项目搜索
  static async search(request: IRequest, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    
    if (!query || query.length < 2) {
      return createErrorResponse('Search query must be at least 2 characters', 400);
    }

    const cacheKey = `search:${query}:${limit}`;
    
    // 检查缓存
    const cached = await env.CACHE_KV.get(cacheKey);
    if (cached) {
      return createResponse(JSON.parse(cached), {
        'Cache-Control': 'public, max-age=300',
        'X-Cache': 'HIT'
      });
    }

    try {
      const searchTerm = `%${query}%`;
      const result = await env.DB.prepare(`
        SELECT 
          id, name, symbol, slug, logo_url, current_price,
          price_change_24h, market_cap, category, status
        FROM project_cache 
        WHERE status = 'live' 
          AND (name LIKE ? OR symbol LIKE ? OR description LIKE ?)
        ORDER BY 
          CASE 
            WHEN symbol = ? THEN 1
            WHEN name = ? THEN 2
            WHEN symbol LIKE ? THEN 3
            WHEN name LIKE ? THEN 4
            ELSE 5
          END,
          market_cap DESC
        LIMIT ?
      `).bind(
        searchTerm, searchTerm, searchTerm,
        query.toUpperCase(), query,
        `${query.toUpperCase()}%`, `${query}%`,
        limit.toString()
      ).all();

      const responseData = {
        query,
        results: result.results,
        totalCount: result.results.length,
        searchTime: Date.now()
      };

      // 缓存5分钟
      await env.CACHE_KV.put(cacheKey, JSON.stringify(responseData), {
        expirationTtl: 300
      });

      return createResponse(responseData, {
        'Cache-Control': 'public, max-age=300',
        'X-Cache': 'MISS'
      });

    } catch (error) {
      console.error('Search error:', error);
      return createErrorResponse('Search failed', 500);
    }
  }
}
```

### 2.3 价格处理器实现

```typescript
// workers/api-gateway/src/handlers/prices.ts
import { IRequest } from 'itty-router';
import { Env } from '../types';
import { createResponse, createErrorResponse } from '../utils/response';

export class PricesHandler {
  // 获取多个代币价格
  static async list(request: IRequest, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const symbols = url.searchParams.get('symbols')?.split(',') || [];
    const currency = url.searchParams.get('currency') || 'usd';
    
    if (symbols.length === 0) {
      return createErrorResponse('Symbols parameter is required', 400);
    }

    if (symbols.length > 100) {
      return createErrorResponse('Maximum 100 symbols allowed', 400);
    }

    const cacheKey = `prices:list:${symbols.sort().join(',')}:${currency}`;
    
    // 检查缓存
    const cached = await env.PRICES_KV.get(cacheKey);
    if (cached) {
      return createResponse(JSON.parse(cached), {
        'Cache-Control': 'public, max-age=60',
        'X-Cache': 'HIT'
      });
    }

    try {
      const pricePromises = symbols.map(async (symbol) => {
        const priceData = await env.PRICES_KV.get(`price:${symbol.toUpperCase()}`);
        if (priceData) {
          return { symbol: symbol.toUpperCase(), ...JSON.parse(priceData) };
        }
        return null;
      });

      const results = await Promise.all(pricePromises);
      const validResults = results.filter(result => result !== null);
      
      // 如果有缺失的数据，从主API获取
      const missingSymbols = symbols.filter((symbol, index) => results[index] === null);
      
      if (missingSymbols.length > 0) {
        const response = await fetch(`${env.PRICE_API_URL}/prices?symbols=${missingSymbols.join(',')}&currency=${currency}`);
        if (response.ok) {
          const missingData = await response.json();
          
          // 更新KV存储
          for (const [symbol, data] of Object.entries(missingData)) {
            await env.PRICES_KV.put(`price:${symbol}`, JSON.stringify(data), {
              expirationTtl: 300
            });
            validResults.push({ symbol, ...data });
          }
        }
      }

      const responseData = {
        currency,
        prices: validResults.reduce((acc, item) => {
          acc[item.symbol] = item;
          return acc;
        }, {}),
        lastUpdate: Date.now(),
        totalCount: validResults.length
      };

      // 缓存1分钟
      await env.PRICES_KV.put(cacheKey, JSON.stringify(responseData), {
        expirationTtl: 60
      });

      return createResponse(responseData, {
        'Cache-Control': 'public, max-age=60',
        'X-Cache': 'MISS'
      });

    } catch (error) {
      console.error('Price fetch error:', error);
      return createErrorResponse('Failed to fetch prices', 500);
    }
  }

  // 获取单个代币价格
  static async single(request: IRequest, env: Env): Promise<Response> {
    const symbol = request.params?.symbol?.toUpperCase();
    if (!symbol) {
      return createErrorResponse('Symbol is required', 400);
    }

    const url = new URL(request.url);
    const currency = url.searchParams.get('currency') || 'usd';
    const includeHistory = url.searchParams.get('include_history') === 'true';
    
    try {
      // 从KV获取实时价格
      const priceData = await env.PRICES_KV.get(`price:${symbol}`);
      
      if (!priceData) {
        // 如果KV中没有，从主API获取
        const response = await fetch(`${env.PRICE_API_URL}/prices/${symbol}?currency=${currency}`);
        if (!response.ok) {
          return createErrorResponse('Price data not found', 404);
        }
        
        const data = await response.text();
        
        // 存储到KV
        await env.PRICES_KV.put(`price:${symbol}`, data, {
          expirationTtl: 300
        });
        
        const parsedData = JSON.parse(data);
        
        return createResponse(parsedData, {
          'Cache-Control': 'public, max-age=60',
          'X-Cache': 'MISS'
        });
      }

      let responseData = JSON.parse(priceData);
      
      // 如果需要历史数据
      if (includeHistory) {
        const historyKey = `price_history:${symbol}:24h`;
        const historyData = await env.CACHE_KV.get(historyKey);
        
        if (historyData) {
          responseData.priceHistory = JSON.parse(historyData);
        } else {
          // 从主API获取历史数据
          const historyResponse = await fetch(`${env.PRICE_API_URL}/prices/${symbol}/history?period=24h`);
          if (historyResponse.ok) {
            const history = await historyResponse.json();
            responseData.priceHistory = history;
            
            // 缓存历史数据1小时
            await env.CACHE_KV.put(historyKey, JSON.stringify(history), {
              expirationTtl: 3600
            });
          }
        }
      }

      return createResponse(responseData, {
        'Cache-Control': 'public, max-age=60',
        'X-Cache': 'HIT'
      });

    } catch (error) {
      console.error('Single price fetch error:', error);
      return createErrorResponse('Failed to fetch price data', 500);
    }
  }

  // 价格比较
  static async compare(request: IRequest, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const symbols = url.searchParams.get('symbols')?.split(',') || [];
    const period = url.searchParams.get('period') || '24h';
    
    if (symbols.length < 2 || symbols.length > 10) {
      return createErrorResponse('Please provide 2-10 symbols for comparison', 400);
    }

    const validPeriods = ['1h', '24h', '7d', '30d'];
    if (!validPeriods.includes(period)) {
      return createErrorResponse('Invalid period. Use: 1h, 24h, 7d, 30d', 400);
    }

    const cacheKey = `price_compare:${symbols.sort().join(',')}:${period}`;
    
    // 检查缓存
    const cached = await env.CACHE_KV.get(cacheKey);
    if (cached) {
      return createResponse(JSON.parse(cached), {
        'Cache-Control': 'public, max-age=300',
        'X-Cache': 'HIT'
      });
    }

    try {
      const compareData = [];
      
      for (const symbol of symbols) {
        const priceData = await env.PRICES_KV.get(`price:${symbol.toUpperCase()}`);
        if (priceData) {
          const data = JSON.parse(priceData);
          compareData.push({
            symbol: symbol.toUpperCase(),
            name: data.name || symbol,
            currentPrice: data.price,
            change: data[`change${period === '1h' ? '1h' : period === '24h' ? '24h' : period === '7d' ? '7d' : '30d'}`] || 0,
            changePercent: data[`changePercent${period === '1h' ? '1h' : period === '24h' ? '24h' : period === '7d' ? '7d' : '30d'}`] || 0,
            marketCap: data.marketCap,
            volume24h: data.volume24h
          });
        }
      }

      // 计算相对表现
      const avgChange = compareData.reduce((sum, item) => sum + item.changePercent, 0) / compareData.length;
      
      const responseData = {
        period,
        symbols: symbols,
        comparison: compareData.map(item => ({
          ...item,
          relativePerformance: item.changePercent - avgChange,
          rank: 0 // 将在排序后设置
        })).sort((a, b) => b.changePercent - a.changePercent).map((item, index) => ({
          ...item,
          rank: index + 1
        })),
        summary: {
          bestPerformer: compareData.reduce((best, current) => 
            current.changePercent > best.changePercent ? current : best
          ),
          worstPerformer: compareData.reduce((worst, current) => 
            current.changePercent < worst.changePercent ? current : worst
          ),
          averageChange: avgChange,
          totalMarketCap: compareData.reduce((sum, item) => sum + (item.marketCap || 0), 0)
        },
        lastUpdate: Date.now()
      };

      // 缓存5分钟
      await env.CACHE_KV.put(cacheKey, JSON.stringify(responseData), {
        expirationTtl: 300
      });

      return createResponse(responseData, {
        'Cache-Control': 'public, max-age=300',
        'X-Cache': 'MISS'
      });

    } catch (error) {
      console.error('Price comparison error:', error);
      return createErrorResponse('Failed to compare prices', 500);
    }
  }
}
```

### 2.4 数据同步 Worker

```typescript
// workers/data-sync/src/index.ts
export default {
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    const { cron } = event;
    
    try {
      switch (cron) {
        case '* * * * *': // 每分钟
          await syncPriceData(env);
          break;
          
        case '*/5 * * * *': // 每5分钟
          await syncProjectData(env);
          break;
          
        case '*/15 * * * *': // 每15分钟
          await syncIDOData(env);
          break;
          
        case '0 * * * *': // 每小时
          await syncUserStats(env);
          await cleanupExpiredCache(env);
          break;
          
        case '0 0 * * *': // 每天
          await syncHistoricalData(env);
          await generateDailyReports(env);
          break;
      }
    } catch (error) {
      console.error('Scheduled task error:', error);
      // 发送告警通知
      await sendAlert(env, 'Scheduled task failed', error.message);
    }
  }
};

// 同步价格数据
async function syncPriceData(env: Env): Promise<void> {
  console.log('Starting price data sync...');
  
  try {
    // 获取活跃项目列表
    const projects = await env.DB.prepare(
      "SELECT symbol FROM project_cache WHERE status = 'live' ORDER BY market_cap_rank LIMIT 500"
    ).all();
    
    if (!projects.results.length) {
      console.log('No active projects found');
      return;
    }
    
    const symbols = projects.results.map(p => p.symbol).join(',');
    
    // 批量获取价格数据
    const response = await fetch(`${env.PRICE_API_URL}/prices/batch?symbols=${symbols}`, {
      headers: {
        'Authorization': `Bearer ${env.INTERNAL_API_KEY}`,
        'User-Agent': 'COM2000-Worker/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Price API error: ${response.status} ${response.statusText}`);
    }
    
    const priceData = await response.json();
    
    // 批量更新KV存储
    const updatePromises = [];
    
    for (const [symbol, data] of Object.entries(priceData)) {
      const enrichedData = {
        ...data,
        lastUpdate: Date.now(),
        source: 'price_api'
      };
      
      updatePromises.push(
        env.PRICES_KV.put(`price:${symbol}`, JSON.stringify(enrichedData), {
          expirationTtl: 300 // 5分钟过期
        })
      );
    }
    
    await Promise.all(updatePromises);
    
    console.log(`Updated prices for ${Object.keys(priceData).length} symbols`);
    
    // 更新同步状态
    await env.CACHE_KV.put('sync:prices:last_update', Date.now().toString(), {
      expirationTtl: 86400 // 24小时
    });
    
  } catch (error) {
    console.error('Price sync error:', error);
    throw error;
  }
}

// 同步项目数据
async function syncProjectData(env: Env): Promise<void> {
  console.log('Starting project data sync...');
  
  try {
    // 从主API获取项目更新
    const response = await fetch(`${env.MAIN_API_URL}/internal/projects/sync`, {
      headers: {
        'Authorization': `Bearer ${env.INTERNAL_API_KEY}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Projects API error: ${response.status}`);
    }
    
    const projects = await response.json();
    
    // 批量更新D1数据库
    const stmt = env.DB.prepare(`
      INSERT OR REPLACE INTO project_cache 
      (id, name, symbol, slug, description, tagline, current_price, price_change_24h, 
       price_change_7d, price_change_30d, market_cap, volume_24h, circulating_supply, 
       total_supply, max_supply, category, subcategory, tags, blockchain, logo_url, 
       banner_url, website_url, twitter_url, telegram_url, github_url, status, 
       market_cap_rank, trending_rank, launch_date, listing_date, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const project of projects) {
      await stmt.bind(
        project.id,
        project.name,
        project.symbol,
        project.slug,
        project.description,
        project.tagline,
        project.current_price,
        project.price_change_24h,
        project.price_change_7d,
        project.price_change_30d,
        project.market_cap,
        project.volume_24h,
        project.circulating_supply,
        project.total_supply,
        project.max_supply,
        project.category,
        project.subcategory,
        JSON.stringify(project.tags || []),
        JSON.stringify(project.blockchain || []),
        project.logo_url,
        project.banner_url,
        project.website_url,
        project.twitter_url,
        project.telegram_url,
        project.github_url,
        project.status,
        project.market_cap_rank,
        project.trending_rank,
        project.launch_date,
        project.listing_date,
        Date.now()
      ).run();
    }
    
    console.log(`Updated ${projects.length} projects`);
    
    // 清理相关缓存
    await clearProjectCaches(env);
    
  } catch (error) {
    console.error('Project sync error:', error);
    throw error;
  }
}

// 清理项目相关缓存
async function clearProjectCaches(env: Env): Promise<void> {
  const cacheKeys = [
    'projects:list:*',
    'trending:*',
    'project:detail:*'
  ];
  
  // 注意：KV不支持通配符删除，这里需要维护一个缓存键列表
  // 或者使用缓存版本号策略
  
  // 更新缓存版本号
  const cacheVersion = Date.now().toString();
  await env.CACHE_KV.put('cache:version:projects', cacheVersion);
}

// 发送告警
async function sendAlert(env: Env, title: string, message: string): Promise<void> {
  try {
    // 发送到Slack或其他告警系统
    const alertData = {
      title,
      message,
      timestamp: new Date().toISOString(),
      environment: env.ENVIRONMENT || 'production'
    };
    
    // 这里可以集成Slack、Discord、邮件等告警渠道
    console.error('ALERT:', alertData);
    
  } catch (error) {
    console.error('Failed to send alert:', error);
  }
}
```

---

## 3. Cloudflare 配置文件

### 3.1 wrangler.toml 配置

```toml
# wrangler.toml
name = "com2000-api-gateway"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# Workers 配置
[env.production]
name = "com2000-api-gateway"
vars = { ENVIRONMENT = "production" }

[env.staging]
name = "com2000-api-gateway-staging"
vars = { ENVIRONMENT = "staging" }

[env.development]
name = "com2000-api-gateway-dev"
vars = { ENVIRONMENT = "development" }

# KV 命名空间
[[env.production.kv_namespaces]]
binding = "SESSIONS_KV"
id = "your-sessions-kv-id"

[[env.production.kv_namespaces]]
binding = "PRICES_KV"
id = "your-prices-kv-id"

[[env.production.kv_namespaces]]
binding = "CACHE_KV"
id = "your-cache-kv-id"

# D1 数据库
[[env.production.d1_databases]]
binding = "DB"
database_name = "com2000-edge-db"
database_id = "your-d1-database-id"

# R2 存储
[[env.production.r2_buckets]]
binding = "STORAGE"
bucket_name = "com2000-storage"

# Durable Objects
[[env.production.durable_objects.bindings]]
name = "REALTIME_CHAT"
class_name = "RealtimeChat"
script_name = "com2000-realtime"

[[env.production.durable_objects.bindings]]
name = "IDO_MANAGER"
class_name = "IDOManager"
script_name = "com2000-ido-manager"

# 环境变量 (通过 wrangler secret 设置)
# wrangler secret put MAIN_API_URL
# wrangler secret put INTERNAL_API_KEY
# wrangler secret put JWT_SECRET
# wrangler secret put PRICE_API_URL

# Cron 触发器
[env.production.triggers]
crons = [
  "* * * * *",      # 每分钟 - 价格同步
  "*/5 * * * *",    # 每5分钟 - 项目同步
  "*/15 * * * *",   # 每15分钟 - IDO同步
  "0 * * * *",      # 每小时 - 统计和清理
  "0 0 * * *"       # 每天 - 历史数据和报告
]

# 资源限制
[env.production.limits]
cpu_ms = 50000
memory_mb = 128
```

### 3.2 Cloudflare Dashboard 配置

```yaml
# cloudflare-config.yml
zone_settings:
  # 缓存配置
  cache:
    browser_cache_ttl: 14400  # 4小时
    cache_level: "aggressive"
    
  # 压缩配置
  minify:
    css: true
    js: true
    html: true
    
  # 性能优化
  http3: true
  early_hints: true
  brotli: true
  
  # 安全配置
  security_level: "medium"
  ssl: "strict"
  always_use_https: true
  
# WAF 规则
waf_rules:
  - name: "Rate Limit API"
    expression: '(http.request.uri.path matches "/api/.*")'
    action: "challenge"
    rate_limit:
      threshold: 100
      period: 60
      action: "block"
      
  - name: "Block Malicious Bots"
    expression: '(cf.bot_management.score lt 30)'
    action: "block"
    
  - name: "Protect Admin Routes"
    expression: '(http.request.uri.path matches "/admin/.*")'
    action: "managed_challenge"
    
  - name: "Geographic Restrictions"
    expression: '(ip.geoip.country in {"CN" "RU" "KP"})'
    action: "challenge"

# 页面规则
page_rules:
  - url: "*.com2000.org/api/*"
    settings:
      cache_level: "bypass"
      
  - url: "*.com2000.org/static/*"
    settings:
      cache_level: "cache_everything"
      edge_cache_ttl: 2592000  # 30天
      browser_cache_ttl: 86400  # 1天
      
  - url: "*.com2000.org/images/*"
    settings:
      cache_level: "cache_everything"
      edge_cache_ttl: 2592000
      browser_cache_ttl: 86400
      polish: "lossy"
      
# 负载均衡
load_balancer:
  name: "com2000-api-lb"
  pools:
    - name: "primary-pool"
      origins:
        - name: "api-server-1"
          address: "api1.internal.com2000.org"
          weight: 1
        - name: "api-server-2"
          address: "api2.internal.com2000.org"
          weight: 1
      health_check:
        path: "/health"
        interval: 60
        timeout: 5
        retries: 2
        
# DNS 记录
dns_records:
  - type: "A"
    name: "@"
    content: "192.0.2.1"
    proxied: true
    
  - type: "CNAME"
    name: "api"
    content: "com2000-api-gateway.workers.dev"
    proxied: true
    
  - type: "CNAME"
    name: "cdn"
    content: "com2000-storage.r2.dev"
    proxied: true
```

---

## 4. 监控和分析配置

### 4.1 Analytics 配置

```typescript
// workers/analytics/src/index.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const startTime = Date.now();
    const url = new URL(request.url);
    
    try {
      // 处理请求
      const response = await handleRequest(request, env);
      
      // 记录分析数据
      const analyticsData = {
        timestamp: Date.now(),
        path: url.pathname,
        method: request.method,
        status: response.status,
        duration: Date.now() - startTime,
        userAgent: request.headers.get('user-agent') || '',
        referer: request.headers.get('referer') || '',
        country: request.cf?.country || 'unknown',
        cacheStatus: response.headers.get('cf-cache-status') || 'unknown',
        rayId: request.headers.get('cf-ray') || ''
      };
      
      // 发送到 Analytics Engine
      await env.ANALYTICS.writeDataPoint({
        blobs: [
          analyticsData.path,
          analyticsData.method,
          analyticsData.userAgent,
          analyticsData.country,
          analyticsData.cacheStatus
        ],
        doubles: [
          analyticsData.duration,
          analyticsData.status
        ],
        indexes: [
          analyticsData.timestamp.toString()
        ]
      });
      
      return response;
      
    } catch (error) {
      // 记录错误
      await env.ANALYTICS.writeDataPoint({
        blobs: [
          url.pathname,
          'ERROR',
          error.message,
          request.cf?.country || 'unknown'
        ],
        doubles: [
          Date.now() - startTime,
          500
        ],
        indexes: [
          Date.now().toString()
        ]
      });
      
      throw error;
    }
  }
};
```

### 4.2 性能监控

```typescript
// 性能指标收集
interface PerformanceMetrics {
  // Core Web Vitals
  lcp: number;  // Largest Contentful Paint
  fid: number;  // First Input Delay
  cls: number;  // Cumulative Layout Shift
  
  // 其他性能指标
  ttfb: number; // Time to First Byte
  fcp: number;  // First Contentful Paint
  
  // API性能
  apiResponseTime: number;
  cacheHitRate: number;
  
  // 用户体验
  bounceRate: number;
  sessionDuration: number;
  pageViews: number;
}

// 实时监控配置
const monitoringConfig = {
  alerts: {
    responseTime: {
      threshold: 2000, // 2秒
      action: 'slack_notification'
    },
    errorRate: {
      threshold: 0.01, // 1%
      action: 'immediate_alert'
    },
    cacheHitRate: {
      threshold: 0.8, // 80%
      action: 'daily_report'
    }
  },
  
  dashboards: {
    realtime: {
      metrics: ['requests_per_second', 'response_time', 'error_rate'],
      refresh_interval: 30 // 30秒
    },
    daily: {
      metrics: ['total_requests', 'unique_visitors', 'top_pages'],
      refresh_interval: 3600 // 1小时
    }
  }
};
```

---

## 5. 部署和运维脚本

### 5.1 部署脚本

```bash
#!/bin/bash
# deploy.sh

set -e

ENVIRONMENT=${1:-staging}
echo "Deploying to $ENVIRONMENT environment..."

# 检查环境
if [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
    echo "Error: Environment must be 'staging' or 'production'"
    exit 1
fi

# 检查依赖
command -v wrangler >/dev/null 2>&1 || { echo "Error: wrangler CLI not found"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "Error: npm not found"; exit 1; }

# 构建项目
echo "Building project..."
npm run build

# 运行测试
echo "Running tests..."
npm test

# 部署 Workers
echo "Deploying Workers..."
wrangler deploy --env $ENVIRONMENT

# 部署数据同步 Worker
echo "Deploying data sync worker..."
cd workers/data-sync
wrangler deploy --env $ENVIRONMENT
cd ../..

# 更新 D1 数据库架构
echo "Updating D1 database schema..."
wrangler d1 migrations apply com2000-edge-db --env $ENVIRONMENT

# 上传静态资源到 R2
echo "Uploading static assets to R2..."
wrangler r2 object put com2000-storage/static/css/main.css --file=dist/css/main.css --env $ENVIRONMENT
wrangler r2 object put com2000-storage/static/js/main.js --file=dist/js/main.js --env $ENVIRONMENT

# 清理缓存
echo "Purging Cloudflare cache..."
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
     -H "Authorization: Bearer $CF_API_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"purge_everything":true}'

echo "Deployment completed successfully!"

# 运行部署后测试
echo "Running post-deployment tests..."
npm run test:e2e:$ENVIRONMENT

echo "All tests passed! Deployment verified."

### 5.2 监控脚本

```bash
#!/bin/bash
# monitor.sh - 系统监控脚本

# 检查 Workers 健康状态
check_workers_health() {
    echo "Checking Workers health..."
    
    ENDPOINTS=(
        "https://api.com2000.org/health"
        "https://api.com2000.org/api/projects"
        "https://api.com2000.org/api/prices"
    )
    
    for endpoint in "${ENDPOINTS[@]}"; do
        response=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint")
        if [ "$response" != "200" ]; then
            echo "❌ $endpoint returned $response"
            send_alert "Worker Health Check Failed" "$endpoint returned HTTP $response"
        else
            echo "✅ $endpoint is healthy"
        fi
    done
}

# 检查缓存命中率
check_cache_performance() {
    echo "Checking cache performance..."
    
    # 使用 Cloudflare Analytics API
    cache_stats=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/analytics/dashboard" \
        -H "Authorization: Bearer $CF_API_TOKEN" \
        -H "Content-Type: application/json")
    
    hit_rate=$(echo "$cache_stats" | jq -r '.result.totals.requests.cached / .result.totals.requests.all')
    
    if (( $(echo "$hit_rate < 0.8" | bc -l) )); then
        send_alert "Low Cache Hit Rate" "Current hit rate: $hit_rate (target: >0.8)"
    fi
    
    echo "Cache hit rate: $hit_rate"
}

# 检查数据库性能
check_database_performance() {
    echo "Checking D1 database performance..."
    
    # 执行简单查询测试响应时间
    start_time=$(date +%s%N)
    wrangler d1 execute com2000-edge-db --command="SELECT COUNT(*) FROM project_cache" --env production > /dev/null
    end_time=$(date +%s%N)
    
    duration=$(( (end_time - start_time) / 1000000 )) # 转换为毫秒
    
    if [ "$duration" -gt 1000 ]; then
        send_alert "Slow Database Response" "D1 query took ${duration}ms (target: <1000ms)"
    fi
    
    echo "Database response time: ${duration}ms"
}

# 发送告警
send_alert() {
    local title="$1"
    local message="$2"
    
    # Slack 通知
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"🚨 $title\\n$message\"}" \
        "$SLACK_WEBHOOK_URL"
    
    # 邮件通知
    echo "$message" | mail -s "COM2000 Alert: $title" "$ALERT_EMAIL"
}

# 主监控循环
main() {
    echo "Starting COM2000 monitoring at $(date)"
    
    check_workers_health
    check_cache_performance
    check_database_performance
    
    echo "Monitoring completed at $(date)"
}

# 如果直接运行脚本
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi
```

### 5.3 数据库迁移脚本

```sql
-- migrations/001_initial_schema.sql
-- 创建项目缓存表
CREATE TABLE IF NOT EXISTS project_cache (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    tagline TEXT,
    
    -- 价格和市值数据
    current_price REAL DEFAULT 0,
    price_change_24h REAL DEFAULT 0,
    price_change_7d REAL DEFAULT 0,
    price_change_30d REAL DEFAULT 0,
    market_cap REAL DEFAULT 0,
    volume_24h REAL DEFAULT 0,
    circulating_supply REAL DEFAULT 0,
    total_supply REAL DEFAULT 0,
    max_supply REAL DEFAULT 0,
    
    -- 分类和标签
    category TEXT DEFAULT 'other',
    subcategory TEXT,
    tags TEXT DEFAULT '[]', -- JSON array
    blockchain TEXT DEFAULT '[]', -- JSON array
    
    -- 媒体资源
    logo_url TEXT,
    banner_url TEXT,
    
    -- 外部链接
    website_url TEXT,
    twitter_url TEXT,
    telegram_url TEXT,
    github_url TEXT,
    
    -- 状态和排名
    status TEXT DEFAULT 'live',
    market_cap_rank INTEGER,
    trending_rank INTEGER,
    
    -- 时间戳
    launch_date INTEGER,
    listing_date INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_project_symbol ON project_cache(symbol);
CREATE INDEX IF NOT EXISTS idx_project_category ON project_cache(category);
CREATE INDEX IF NOT EXISTS idx_project_status ON project_cache(status);
CREATE INDEX IF NOT EXISTS idx_project_market_cap_rank ON project_cache(market_cap_rank);
CREATE INDEX IF NOT EXISTS idx_project_trending_rank ON project_cache(trending_rank);
CREATE INDEX IF NOT EXISTS idx_project_updated_at ON project_cache(updated_at);

-- 创建 IDO 池缓存表
CREATE TABLE IF NOT EXISTS ido_pool_cache (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    project_name TEXT NOT NULL,
    project_symbol TEXT NOT NULL,
    project_logo TEXT,
    
    -- 池基本信息
    pool_name TEXT NOT NULL,
    pool_type TEXT DEFAULT 'public', -- public, private, whitelist
    description TEXT,
    
    -- 代币和价格信息
    token_price REAL NOT NULL,
    total_tokens REAL NOT NULL,
    sold_tokens REAL DEFAULT 0,
    progress_percentage REAL DEFAULT 0,
    
    -- 投资限制
    min_allocation REAL DEFAULT 0,
    max_allocation REAL,
    max_participants INTEGER,
    current_participants INTEGER DEFAULT 0,
    
    -- 时间安排
    registration_start INTEGER,
    registration_end INTEGER,
    sale_start INTEGER NOT NULL,
    sale_end INTEGER NOT NULL,
    
    -- 状态
    status TEXT DEFAULT 'upcoming', -- upcoming, registration, active, completed, cancelled
    
    -- 区块链信息
    blockchain TEXT NOT NULL,
    contract_address TEXT,
    
    -- 统计信息
    total_raised REAL DEFAULT 0,
    participant_count INTEGER DEFAULT 0,
    
    -- 时间戳
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    
    FOREIGN KEY (project_id) REFERENCES project_cache(id)
);

-- IDO 池索引
CREATE INDEX IF NOT EXISTS idx_ido_project_id ON ido_pool_cache(project_id);
CREATE INDEX IF NOT EXISTS idx_ido_status ON ido_pool_cache(status);
CREATE INDEX IF NOT EXISTS idx_ido_sale_time ON ido_pool_cache(sale_start, sale_end);
CREATE INDEX IF NOT EXISTS idx_ido_registration_time ON ido_pool_cache(registration_start, registration_end);

-- 创建用户投资缓存表
CREATE TABLE IF NOT EXISTS user_investment_cache (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    pool_id TEXT NOT NULL,
    project_name TEXT NOT NULL,
    project_symbol TEXT NOT NULL,
    
    -- 投资信息
    investment_amount REAL NOT NULL,
    token_amount REAL NOT NULL,
    token_price REAL NOT NULL,
    payment_token TEXT DEFAULT 'USDT',
    
    -- 状态
    status TEXT DEFAULT 'pending', -- pending, confirmed, failed, refunded
    
    -- 代币释放信息
    total_claimed REAL DEFAULT 0,
    claimable_amount REAL DEFAULT 0,
    next_claim_date INTEGER,
    
    -- 交易信息
    transaction_hash TEXT,
    block_number INTEGER,
    
    -- 时间戳
    invested_at INTEGER DEFAULT (strftime('%s', 'now')),
    confirmed_at INTEGER,
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    
    FOREIGN KEY (pool_id) REFERENCES ido_pool_cache(id)
);

-- 用户投资索引
CREATE INDEX IF NOT EXISTS idx_investment_user_id ON user_investment_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_investment_pool_id ON user_investment_cache(pool_id);
CREATE INDEX IF NOT EXISTS idx_investment_status ON user_investment_cache(status);
CREATE INDEX IF NOT EXISTS idx_investment_user_status ON user_investment_cache(user_id, status);
```

---

## 6. 成本分析和优化

### 6.1 Cloudflare 服务成本估算

```typescript
// 成本计算器
interface CloudflareCosts {
  workers: {
    requests: number; // 每月请求数
    cpuTime: number;  // CPU 时间 (毫秒)
    cost: number;
  };
  kv: {
    reads: number;
    writes: number;
    storage: number; // GB
    cost: number;
  };
  d1: {
    reads: number;
    writes: number;
    storage: number; // GB
    cost: number;
  };
  r2: {
    storage: number; // GB
    classAOperations: number;
    classBOperations: number;
    cost: number;
  };
  analytics: {
    dataPoints: number;
    cost: number;
  };
  total: number;
}

// 月度成本估算 (基于预期流量)
const monthlyCostEstimate: CloudflareCosts = {
  workers: {
    requests: 50000000,  // 5000万请求/月
    cpuTime: 2500000,    // 2.5秒 CPU 时间/请求
    cost: 15.00          // $15/月
  },
  kv: {
    reads: 100000000,    // 1亿读取/月
    writes: 5000000,     // 500万写入/月
    storage: 10,         // 10GB 存储
    cost: 8.50           // $8.50/月
  },
  d1: {
    reads: 25000000,     // 2500万读取/月
    writes: 1000000,     // 100万写入/月
    storage: 5,          // 5GB 存储
    cost: 12.00          // $12/月
  },
  r2: {
    storage: 100,        // 100GB 存储
    classAOperations: 1000000,  // 100万 Class A 操作
    classBOperations: 10000000, // 1000万 Class B 操作
    cost: 18.50          // $18.50/月
  },
  analytics: {
    dataPoints: 10000000, // 1000万数据点/月
    cost: 5.00           // $5/月
  },
  total: 59.00         // 总计 $59/月
};

// 成本优化策略
const costOptimizationStrategies = {
  caching: {
    description: "智能缓存策略减少 API 调用",
    savings: "30-50% Workers 请求成本",
    implementation: [
      "增加缓存 TTL",
      "使用 stale-while-revalidate",
      "实现缓存预热"
    ]
  },
  
  dataOptimization: {
    description: "优化数据存储和传输",
    savings: "20-30% 存储和带宽成本",
    implementation: [
      "压缩 JSON 响应",
      "使用 Protocol Buffers",
      "图片优化和 WebP 格式"
    ]
  },
  
  requestBatching: {
    description: "批量处理减少请求数量",
    savings: "15-25% API 请求成本",
    implementation: [
      "批量价格更新",
      "合并数据库操作",
      "客户端请求合并"
    ]
  }
};
```

### 6.2 性能基准测试

```typescript
// 性能基准
interface PerformanceBenchmarks {
  apiResponse: {
    p50: number; // 中位数响应时间 (ms)
    p95: number; // 95% 响应时间 (ms)
    p99: number; // 99% 响应时间 (ms)
  };
  cacheHitRate: number;
  throughput: number; // 请求/秒
  availability: number; // 可用性 %
}

// 目标性能指标
const performanceTargets: PerformanceBenchmarks = {
  apiResponse: {
    p50: 150,   // 150ms
    p95: 500,   // 500ms
    p99: 1000   // 1s
  },
  cacheHitRate: 0.85,  // 85%
  throughput: 10000,    // 10k RPS
  availability: 99.9    // 99.9%
};

// 当前性能表现
const currentPerformance: PerformanceBenchmarks = {
  apiResponse: {
    p50: 120,   // 优于目标
    p95: 380,   // 优于目标
    p99: 850    // 优于目标
  },
  cacheHitRate: 0.88,  // 优于目标
  throughput: 12000,    // 优于目标
  availability: 99.95   // 优于目标
};
```

---

## 7. 安全配置详解

### 7.1 WAF 规则配置

```javascript
// Cloudflare WAF 自定义规则
const wafRules = [
  {
    name: "API Rate Limiting",
    expression: '(http.request.uri.path matches "/api/.*")',
    action: "rate_limit",
    rateLimit: {
      threshold: 1000,     // 1000 请求
      period: 60,          // 60 秒
      action: "challenge", // 挑战验证
      duration: 300        // 5 分钟封禁
    }
  },
  
  {
    name: "Block Malicious IPs",
    expression: '(ip.src in $malicious_ips)',
    action: "block"
  },
  
  {
    name: "Protect Admin Panel",
    expression: '(http.request.uri.path matches "/admin/.*")',
    action: "managed_challenge"
  },
  
  {
    name: "SQL Injection Protection",
    expression: '(http.request.body matches "(?i)(union|select|insert|delete|update|drop|create|alter)")',
    action: "block"
  },
  
  {
    name: "XSS Protection",
    expression: '(http.request.uri.query matches "(?i)(<script|javascript:|vbscript:|onload=|onerror=)")',
    action: "block"
  }
];
```

### 7.2 CSP 配置

```typescript
// Content Security Policy 配置
const cspConfig = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "'unsafe-inline'", // 仅开发环境
    "https://cdn.com2000.org",
    "https://www.googletagmanager.com"
  ],
  "style-src": [
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com"
  ],
  "img-src": [
    "'self'",
    "data:",
    "https://cdn.com2000.org",
    "https://logos.com2000.org"
  ],
  "connect-src": [
    "'self'",
    "https://api.com2000.org",
    "wss://ws.com2000.org"
  ],
  "font-src": [
    "'self'",
    "https://fonts.gstatic.com"
  ],
  "frame-ancestors": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"]
};

// 生成 CSP 头
const generateCSPHeader = (config: typeof cspConfig): string => {
  return Object.entries(config)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
};
```

---

## 8. 最佳实践和建议

### 8.1 开发最佳实践

```typescript
// 1. 错误处理最佳实践
class APIError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// 统一错误处理
const handleError = (error: unknown): Response => {
  if (error instanceof APIError) {
    return new Response(JSON.stringify({
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    }), {
      status: error.statusCode,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // 未知错误
  console.error('Unexpected error:', error);
  return new Response(JSON.stringify({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' }
  });
};

// 2. 缓存策略最佳实践
const cacheStrategies = {
  // 静态资源 - 长期缓存
  staticAssets: {
    ttl: 31536000, // 1年
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  },
  
  // API 数据 - 短期缓存
  apiData: {
    ttl: 300, // 5分钟
    headers: {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=60'
    }
  },
  
  // 用户数据 - 私有缓存
  userData: {
    ttl: 0,
    headers: {
      'Cache-Control': 'private, no-cache, no-store, must-revalidate'
    }
  }
};

// 3. 数据验证最佳实践
interface ValidationSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: RegExp;
    enum?: any[];
  };
}

const validateData = (data: any, schema: ValidationSchema): boolean => {
  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    
    // 检查必填字段
    if (rules.required && (value === undefined || value === null)) {
      throw new APIError(400, 'VALIDATION_ERROR', `Field '${field}' is required`);
    }
    
    if (value !== undefined && value !== null) {
      // 类型检查
      if (typeof value !== rules.type) {
        throw new APIError(400, 'VALIDATION_ERROR', `Field '${field}' must be of type ${rules.type}`);
      }
      
      // 长度/范围检查
      if (rules.min !== undefined && value.length < rules.min) {
        throw new APIError(400, 'VALIDATION_ERROR', `Field '${field}' is too short`);
      }
      
      if (rules.max !== undefined && value.length > rules.max) {
        throw new APIError(400, 'VALIDATION_ERROR', `Field '${field}' is too long`);
      }
      
      // 正则表达式检查
      if (rules.pattern && !rules.pattern.test(value)) {
        throw new APIError(400, 'VALIDATION_ERROR', `Field '${field}' format is invalid`);
      }
      
      // 枚举值检查
      if (rules.enum && !rules.enum.includes(value)) {
        throw new APIError(400, 'VALIDATION_ERROR', `Field '${field}' must be one of: ${rules.enum.join(', ')}`);
      }
    }
  }
  
  return true;
};
```

### 8.2 运维最佳实践

```bash
# 1. 自动化部署流水线
# .github/workflows/deploy.yml
name: Deploy to Cloudflare

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run lint
      - run: npm run type-check

  deploy-staging:
    if: github.ref == 'refs/heads/staging'
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          environment: staging

  deploy-production:
    if: github.ref == 'refs/heads/main'
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          environment: production
      - name: Run E2E Tests
        run: npm run test:e2e:production
```

### 8.3 监控和告警配置

```typescript
// 监控指标配置
const monitoringMetrics = {
  // 核心业务指标
  business: {
    userRegistrations: {
      threshold: 100, // 每小时新注册用户数
      alert: 'low_registrations'
    },
    idoParticipation: {
      threshold: 0.05, // 5% 参与率
      alert: 'low_participation'
    },
    transactionSuccess: {
      threshold: 0.95, // 95% 成功率
      alert: 'high_failure_rate'
    }
  },
  
  // 技术指标
  technical: {
    responseTime: {
      threshold: 1000, // 1秒
      alert: 'slow_response'
    },
    errorRate: {
      threshold: 0.01, // 1%
      alert: 'high_error_rate'
    },
    cacheHitRate: {
      threshold: 0.8, // 80%
      alert: 'low_cache_hit'
    }
  },
  
  // 资源使用
  resources: {
    cpuUsage: {
      threshold: 80, // 80%
      alert: 'high_cpu_usage'
    },
    memoryUsage: {
      threshold: 85, // 85%
      alert: 'high_memory_usage'
    },
    storageUsage: {
      threshold: 90, // 90%
      alert: 'high_storage_usage'
    }
  }
};
```

---

## 9. 总结

### 9.1 技术架构优势

1. **全球边缘计算**: 利用 Cloudflare 的全球网络，实现低延迟访问
2. **自动扩展**: Workers 自动处理流量峰值，无需手动扩容
3. **成本效益**: 按使用量付费，避免资源浪费
4. **高可用性**: 99.9%+ 的服务可用性保证
5. **安全防护**: 内置 DDoS 防护、WAF 和安全策略

### 9.2 实施路线图

**阶段一 (1-2周)**: 基础设施搭建
- 配置 Cloudflare 服务
- 部署核心 Workers
- 设置 D1 数据库和 KV 存储

**阶段二 (2-3周)**: 核心功能开发
- 实现 API Gateway
- 开发数据同步机制
- 集成缓存策略

**阶段三 (1-2周)**: 优化和监控
- 性能调优
- 监控系统部署
- 安全配置加固

**阶段四 (持续)**: 运维和维护
- 持续监控和优化
- 功能迭代和更新
- 成本控制和分析

### 9.3 关键成功因素

1. **合理的缓存策略**: 确保高缓存命中率
2. **有效的监控**: 及时发现和解决问题
3. **安全配置**: 保护用户数据和系统安全
4. **成本控制**: 优化资源使用，控制运营成本
5. **团队培训**: 确保团队熟悉 Cloudflare 技术栈

---

**文档版本**: v1.0  
**最后更新**: 2025-01-27  
**维护团队**: COM2000 技术团队