export interface Env {
  // Environment variables
  ENVIRONMENT: string;
  API_BASE_URL: string;
  BLOCKCHAIN_RPC_URL: string;
  JWT_SECRET: string;
  CORS_ORIGINS: string;
  RATE_LIMIT_REQUESTS: string;
  RATE_LIMIT_WINDOW: string;
  CACHE_TTL_PRICES: string;
  CACHE_TTL_PROJECTS: string;
  CACHE_TTL_TRENDING: string;

  // KV Namespaces
  USER_SESSIONS: KVNamespace;
  PRICE_CACHE: KVNamespace;
  PROJECT_CACHE: KVNamespace;
  TRENDING_CACHE: KVNamespace;

  // D1 Database
  DB: D1Database;

  // R2 Bucket
  ASSETS: R2Bucket;

  // Durable Objects
  PRICE_UPDATER: DurableObjectNamespace;
  PROJECT_SYNC: DurableObjectNamespace;

  // Analytics Engine
  ANALYTICS: AnalyticsEngineDataset;

  // Workers AI
  AI: any;
}

// User session data structure
export interface UserSession {
  userId: string;
  walletAddress: string;
  email?: string;
  role: 'user' | 'admin' | 'moderator';
  permissions: string[];
  loginTime: number;
  lastActivity: number;
  ipAddress: string;
  userAgent: string;
  sessionId: string;
}

// Price data structure
export interface PriceData {
  symbol: string;
  price: number;
  priceUsd: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  lastUpdated: number;
  source: string;
}

// Project data structure
export interface Project {
  id: string;
  name: string;
  symbol: string;
  description: string;
  website: string;
  whitepaper: string;
  logo: string;
  banner: string;
  category: string;
  tags: string[];
  totalSupply: number;
  circulatingSupply: number;
  marketCap: number;
  price: number;
  change24h: number;
  volume24h: number;
  status: 'active' | 'upcoming' | 'completed' | 'cancelled';
  createdAt: number;
  updatedAt: number;
  socialLinks: {
    twitter?: string;
    telegram?: string;
    discord?: string;
    medium?: string;
    github?: string;
  };
  team: {
    name: string;
    role: string;
    avatar: string;
    bio: string;
    linkedin?: string;
  }[];
  roadmap: {
    phase: string;
    title: string;
    description: string;
    status: 'completed' | 'in-progress' | 'upcoming';
    date: string;
  }[];
}

// IDO Pool data structure
export interface IdoPool {
  id: string;
  projectId: string;
  name: string;
  symbol: string;
  totalTokens: number;
  tokenPrice: number;
  minInvestment: number;
  maxInvestment: number;
  softCap: number;
  hardCap: number;
  startTime: number;
  endTime: number;
  vestingSchedule: {
    cliff: number; // in days
    duration: number; // in days
    percentage: number;
  }[];
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  totalRaised: number;
  participantCount: number;
  createdAt: number;
  updatedAt: number;
}

// User investment data structure
export interface UserInvestment {
  id: string;
  userId: string;
  idoPoolId: string;
  amount: number;
  tokenAmount: number;
  transactionHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  createdAt: number;
  updatedAt: number;
}

// Trending project data structure
export interface TrendingProject {
  projectId: string;
  name: string;
  symbol: string;
  logo: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  rank: number;
  score: number;
  lastUpdated: number;
}

// API Response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Rate limiting data structure
export interface RateLimitData {
  count: number;
  resetTime: number;
  windowStart: number;
}

// Analytics event data structure
export interface AnalyticsEvent {
  event: string;
  userId?: string;
  sessionId?: string;
  properties: Record<string, any>;
  timestamp: number;
  ipAddress: string;
  userAgent: string;
}

// Cache metadata
export interface CacheMetadata {
  key: string;
  ttl: number;
  createdAt: number;
  lastAccessed: number;
  hitCount: number;
}

// Error response structure
export interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: any;
  timestamp: string;
  requestId?: string;
}

// JWT payload structure
export interface JwtPayload {
  userId: string;
  walletAddress: string;
  email?: string;
  role: string;
  permissions: string[];
  iat: number;
  exp: number;
  sessionId: string;
}

// Blockchain transaction structure
export interface BlockchainTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  blockNumber: number;
  blockHash: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
}

// Health check response
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  services: {
    database: 'healthy' | 'unhealthy';
    cache: 'healthy' | 'unhealthy';
    blockchain: 'healthy' | 'unhealthy';
    storage: 'healthy' | 'unhealthy';
  };
  metrics: {
    uptime: number;
    requestCount: number;
    errorRate: number;
    responseTime: number;
  };
}