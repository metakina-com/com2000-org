/**
 * Database utilities for D1, KV, and R2 operations
 */

import { Env } from '../types/env';
import { generateId } from './crypto';

// D1 Database utilities
export class D1Helper {
  constructor(private db: D1Database) {}

  // Execute a query with parameters
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      const result = await this.db.prepare(sql).bind(...params).all();
      return result.results as T[];
    } catch (error) {
      console.error('D1 Query Error:', error);
      throw new Error(`Database query failed: ${error}`);
    }
  }

  // Execute a single query and return first result
  async queryFirst<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    try {
      const result = await this.db.prepare(sql).bind(...params).first();
      return result as T | null;
    } catch (error) {
      console.error('D1 Query First Error:', error);
      throw new Error(`Database query failed: ${error}`);
    }
  }

  // Execute an insert/update/delete query
  async execute(sql: string, params: any[] = []): Promise<D1Result> {
    try {
      const result = await this.db.prepare(sql).bind(...params).run();
      return result;
    } catch (error) {
      console.error('D1 Execute Error:', error);
      throw new Error(`Database execution failed: ${error}`);
    }
  }

  // Execute multiple queries in a transaction
  async transaction(queries: Array<{ sql: string; params?: any[] }>): Promise<D1Result[]> {
    try {
      const statements = queries.map(q => 
        this.db.prepare(q.sql).bind(...(q.params || []))
      );
      const results = await this.db.batch(statements);
      return results;
    } catch (error) {
      console.error('D1 Transaction Error:', error);
      throw new Error(`Database transaction failed: ${error}`);
    }
  }

  // Get table info
  async getTableInfo(tableName: string): Promise<any[]> {
    return this.query(`PRAGMA table_info(${tableName})`);
  }

  // Check if table exists
  async tableExists(tableName: string): Promise<boolean> {
    const result = await this.queryFirst(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
      [tableName]
    );
    return !!result;
  }

  // Get row count
  async getRowCount(tableName: string, whereClause?: string, params: any[] = []): Promise<number> {
    const sql = whereClause 
      ? `SELECT COUNT(*) as count FROM ${tableName} WHERE ${whereClause}`
      : `SELECT COUNT(*) as count FROM ${tableName}`;
    
    const result = await this.queryFirst<{ count: number }>(sql, params);
    return result?.count || 0;
  }

  // Paginated query
  async paginatedQuery<T = any>(
    sql: string,
    params: any[] = [],
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: T[]; total: number; page: number; limit: number; totalPages: number }> {
    const offset = (page - 1) * limit;
    
    // Get total count
    const countSql = sql.replace(/SELECT .+ FROM/, 'SELECT COUNT(*) as count FROM').split('ORDER BY')[0];
    const countResult = await this.queryFirst<{ count: number }>(countSql, params);
    const total = countResult?.count || 0;
    
    // Get paginated data
    const paginatedSql = `${sql} LIMIT ? OFFSET ?`;
    const data = await this.query<T>(paginatedSql, [...params, limit, offset]);
    
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  // Upsert operation
  async upsert(
    tableName: string,
    data: Record<string, any>,
    conflictColumns: string[]
  ): Promise<D1Result> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map(() => '?').join(', ');
    
    const updateClause = columns
      .filter(col => !conflictColumns.includes(col))
      .map(col => `${col} = excluded.${col}`)
      .join(', ');
    
    const sql = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT(${conflictColumns.join(', ')}) DO UPDATE SET
      ${updateClause}
    `;
    
    return this.execute(sql, values);
  }

  // Bulk insert
  async bulkInsert(
    tableName: string,
    records: Record<string, any>[],
    batchSize: number = 100
  ): Promise<D1Result[]> {
    if (records.length === 0) return [];
    
    const columns = Object.keys(records[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
    
    const results: D1Result[] = [];
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const statements = batch.map(record => 
        this.db.prepare(sql).bind(...columns.map(col => record[col]))
      );
      
      const batchResults = await this.db.batch(statements);
      results.push(...batchResults);
    }
    
    return results;
  }
}

// KV Storage utilities
export class KVHelper {
  constructor(private kv: KVNamespace) {}

  // Get value with optional JSON parsing
  async get<T = any>(key: string, parseJson: boolean = true): Promise<T | null> {
    try {
      const value = await this.kv.get(key);
      if (value === null) return null;
      
      return parseJson ? JSON.parse(value) : value as T;
    } catch (error) {
      console.error('KV Get Error:', error);
      return null;
    }
  }

  // Set value with optional JSON stringification
  async set(
    key: string,
    value: any,
    options: {
      expirationTtl?: number;
      expiration?: number;
      metadata?: any;
      stringifyJson?: boolean;
    } = {}
  ): Promise<void> {
    try {
      const { stringifyJson = true, ...kvOptions } = options;
      const serializedValue = stringifyJson ? JSON.stringify(value) : value;
      
      await this.kv.put(key, serializedValue, kvOptions);
    } catch (error) {
      console.error('KV Set Error:', error);
      throw new Error(`KV storage failed: ${error}`);
    }
  }

  // Delete key
  async delete(key: string): Promise<void> {
    try {
      await this.kv.delete(key);
    } catch (error) {
      console.error('KV Delete Error:', error);
      throw new Error(`KV deletion failed: ${error}`);
    }
  }

  // List keys with prefix
  async list(prefix?: string, limit?: number): Promise<KVNamespaceListResult<any, string>> {
    try {
      return await this.kv.list({ prefix, limit });
    } catch (error) {
      console.error('KV List Error:', error);
      throw new Error(`KV list failed: ${error}`);
    }
  }

  // Get with metadata
  async getWithMetadata<T = any>(key: string): Promise<KVNamespaceGetWithMetadataResult<T, any>> {
    try {
      return await this.kv.getWithMetadata(key, 'json');
    } catch (error) {
      console.error('KV Get With Metadata Error:', error);
      throw new Error(`KV get with metadata failed: ${error}`);
    }
  }

  // Increment counter
  async increment(key: string, delta: number = 1, ttl?: number): Promise<number> {
    try {
      const current = await this.get<number>(key, true) || 0;
      const newValue = current + delta;
      await this.set(key, newValue, { expirationTtl: ttl });
      return newValue;
    } catch (error) {
      console.error('KV Increment Error:', error);
      throw new Error(`KV increment failed: ${error}`);
    }
  }

  // Set if not exists
  async setIfNotExists(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const existing = await this.get(key);
      if (existing !== null) return false;
      
      await this.set(key, value, { expirationTtl: ttl });
      return true;
    } catch (error) {
      console.error('KV Set If Not Exists Error:', error);
      return false;
    }
  }

  // Batch operations
  async batchGet<T = any>(keys: string[]): Promise<(T | null)[]> {
    const promises = keys.map(key => this.get<T>(key));
    return Promise.all(promises);
  }

  async batchSet(items: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    const promises = items.map(item => 
      this.set(item.key, item.value, { expirationTtl: item.ttl })
    );
    await Promise.all(promises);
  }

  async batchDelete(keys: string[]): Promise<void> {
    const promises = keys.map(key => this.delete(key));
    await Promise.all(promises);
  }

  // Cache with TTL
  async cache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = 3600
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    
    const fresh = await fetcher();
    await this.set(key, fresh, { expirationTtl: ttl });
    return fresh;
  }
}

// R2 Storage utilities
export class R2Helper {
  constructor(private bucket: R2Bucket) {}

  // Upload object
  async put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
    options: R2PutOptions = {}
  ): Promise<R2Object | null> {
    try {
      return await this.bucket.put(key, value, options);
    } catch (error) {
      console.error('R2 Put Error:', error);
      throw new Error(`R2 upload failed: ${error}`);
    }
  }

  // Get object
  async get(key: string, options: R2GetOptions = {}): Promise<R2ObjectBody | null> {
    try {
      return await this.bucket.get(key, options);
    } catch (error) {
      console.error('R2 Get Error:', error);
      return null;
    }
  }

  // Delete object
  async delete(key: string): Promise<void> {
    try {
      await this.bucket.delete(key);
    } catch (error) {
      console.error('R2 Delete Error:', error);
      throw new Error(`R2 deletion failed: ${error}`);
    }
  }

  // Head object (get metadata only)
  async head(key: string): Promise<R2Object | null> {
    try {
      return await this.bucket.head(key);
    } catch (error) {
      console.error('R2 Head Error:', error);
      return null;
    }
  }

  // List objects
  async list(options: R2ListOptions = {}): Promise<R2Objects> {
    try {
      return await this.bucket.list(options);
    } catch (error) {
      console.error('R2 List Error:', error);
      throw new Error(`R2 list failed: ${error}`);
    }
  }

  // Check if object exists
  async exists(key: string): Promise<boolean> {
    const object = await this.head(key);
    return object !== null;
  }

  // Get object as text
  async getText(key: string): Promise<string | null> {
    const object = await this.get(key);
    return object ? await object.text() : null;
  }

  // Get object as JSON
  async getJson<T = any>(key: string): Promise<T | null> {
    const text = await this.getText(key);
    return text ? JSON.parse(text) : null;
  }

  // Put text
  async putText(key: string, text: string, options: R2PutOptions = {}): Promise<R2Object | null> {
    return this.put(key, text, {
      ...options,
      httpMetadata: {
        contentType: 'text/plain',
        ...options.httpMetadata
      }
    });
  }

  // Put JSON
  async putJson(key: string, data: any, options: R2PutOptions = {}): Promise<R2Object | null> {
    return this.put(key, JSON.stringify(data), {
      ...options,
      httpMetadata: {
        contentType: 'application/json',
        ...options.httpMetadata
      }
    });
  }

  // Generate presigned URL
  async createPresignedUrl(
    key: string,
    options: {
      expiresIn?: number;
      method?: 'GET' | 'PUT';
    } = {}
  ): Promise<string> {
    const { expiresIn = 3600, method = 'GET' } = options;
    
    // Note: This is a simplified implementation
    // In a real scenario, you'd need to implement proper presigned URL generation
    // using AWS S3 compatible signing
    throw new Error('Presigned URL generation not implemented');
  }

  // Copy object
  async copy(sourceKey: string, destinationKey: string): Promise<R2Object | null> {
    const source = await this.get(sourceKey);
    if (!source) return null;
    
    const arrayBuffer = await source.arrayBuffer();
    return this.put(destinationKey, arrayBuffer, {
      httpMetadata: source.httpMetadata,
      customMetadata: source.customMetadata
    });
  }

  // Batch delete
  async batchDelete(keys: string[]): Promise<void> {
    const promises = keys.map(key => this.delete(key));
    await Promise.all(promises);
  }
}

// Cache utilities
export class CacheHelper {
  constructor(
    private kv: KVNamespace,
    private defaultTtl: number = 3600
  ) {}

  // Generate cache key
  private generateKey(prefix: string, identifier: string): string {
    return `${prefix}:${identifier}`;
  }

  // Set cache with metadata
  async set(
    prefix: string,
    identifier: string,
    data: any,
    ttl: number = this.defaultTtl,
    tags: string[] = []
  ): Promise<void> {
    const key = this.generateKey(prefix, identifier);
    const metadata = {
      createdAt: Date.now(),
      ttl,
      tags
    };
    
    const kvHelper = new KVHelper(this.kv);
    await kvHelper.set(key, data, {
      expirationTtl: ttl,
      metadata
    });
  }

  // Get from cache
  async get<T = any>(prefix: string, identifier: string): Promise<T | null> {
    const key = this.generateKey(prefix, identifier);
    const kvHelper = new KVHelper(this.kv);
    return kvHelper.get<T>(key);
  }

  // Delete from cache
  async delete(prefix: string, identifier: string): Promise<void> {
    const key = this.generateKey(prefix, identifier);
    const kvHelper = new KVHelper(this.kv);
    await kvHelper.delete(key);
  }

  // Invalidate by tag
  async invalidateByTag(tag: string): Promise<void> {
    const kvHelper = new KVHelper(this.kv);
    const list = await kvHelper.list();
    
    const keysToDelete: string[] = [];
    
    for (const key of list.keys) {
      const result = await kvHelper.getWithMetadata(key.name);
      if (result.metadata?.tags?.includes(tag)) {
        keysToDelete.push(key.name);
      }
    }
    
    await kvHelper.batchDelete(keysToDelete);
  }

  // Cache with function
  async remember<T>(
    prefix: string,
    identifier: string,
    fetcher: () => Promise<T>,
    ttl: number = this.defaultTtl,
    tags: string[] = []
  ): Promise<T> {
    const cached = await this.get<T>(prefix, identifier);
    if (cached !== null) return cached;
    
    const fresh = await fetcher();
    await this.set(prefix, identifier, fresh, ttl, tags);
    return fresh;
  }
}

// Analytics utilities
export class AnalyticsHelper {
  constructor(private analytics: AnalyticsEngineDataset) {}

  // Write analytics event
  async writeEvent(
    event: string,
    data: Record<string, any> = {},
    timestamp?: Date
  ): Promise<void> {
    try {
      await this.analytics.writeDataPoint({
        blobs: [event],
        doubles: Object.entries(data)
          .filter(([_, value]) => typeof value === 'number')
          .map(([key, value]) => ({ [key]: value }))
          .reduce((acc, curr) => ({ ...acc, ...curr }), {}),
        indexes: Object.entries(data)
          .filter(([_, value]) => typeof value === 'string')
          .map(([key, value]) => ({ [key]: value }))
          .reduce((acc, curr) => ({ ...acc, ...curr }), {}),
        timestamp: timestamp || new Date()
      });
    } catch (error) {
      console.error('Analytics Write Error:', error);
      // Don't throw error for analytics failures
    }
  }

  // Write multiple events
  async writeEvents(events: Array<{
    event: string;
    data?: Record<string, any>;
    timestamp?: Date;
  }>): Promise<void> {
    const promises = events.map(({ event, data, timestamp }) => 
      this.writeEvent(event, data, timestamp)
    );
    await Promise.all(promises);
  }

  // Track user action
  async trackUserAction(
    userId: string,
    action: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.writeEvent('user_action', {
      userId,
      action,
      ...metadata
    });
  }

  // Track API request
  async trackApiRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    userId?: string
  ): Promise<void> {
    await this.writeEvent('api_request', {
      method,
      path,
      statusCode,
      duration,
      userId
    });
  }

  // Track error
  async trackError(
    error: string,
    stack?: string,
    userId?: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.writeEvent('error', {
      error,
      stack,
      userId,
      ...metadata
    });
  }
}

// Helper function to create database helpers
export function createDatabaseHelpers(env: Env) {
  return {
    d1: new D1Helper(env.DB),
    projectCache: new KVHelper(env.PROJECT_CACHE),
    userSessions: new KVHelper(env.USER_SESSIONS),
    priceCache: new KVHelper(env.PRICE_CACHE),
    trendingCache: new KVHelper(env.TRENDING_CACHE),
    uploads: new R2Helper(env.UPLOADS),
    cache: new CacheHelper(env.PROJECT_CACHE),
    analytics: new AnalyticsHelper(env.ANALYTICS)
  };
}

// Database connection health check
export async function checkDatabaseHealth(env: Env): Promise<{
  d1: boolean;
  kv: boolean;
  r2: boolean;
  analytics: boolean;
}> {
  const results = {
    d1: false,
    kv: false,
    r2: false,
    analytics: false
  };

  // Test D1
  try {
    const d1Helper = new D1Helper(env.DB);
    await d1Helper.queryFirst('SELECT 1 as test');
    results.d1 = true;
  } catch (error) {
    console.error('D1 Health Check Failed:', error);
  }

  // Test KV
  try {
    const kvHelper = new KVHelper(env.PROJECT_CACHE);
    const testKey = `health_check_${Date.now()}`;
    await kvHelper.set(testKey, 'test', { expirationTtl: 60 });
    const value = await kvHelper.get(testKey);
    await kvHelper.delete(testKey);
    results.kv = value === 'test';
  } catch (error) {
    console.error('KV Health Check Failed:', error);
  }

  // Test R2
  try {
    const r2Helper = new R2Helper(env.UPLOADS);
    const testKey = `health_check_${Date.now()}.txt`;
    await r2Helper.putText(testKey, 'test');
    const content = await r2Helper.getText(testKey);
    await r2Helper.delete(testKey);
    results.r2 = content === 'test';
  } catch (error) {
    console.error('R2 Health Check Failed:', error);
  }

  // Test Analytics
  try {
    const analyticsHelper = new AnalyticsHelper(env.ANALYTICS);
    await analyticsHelper.writeEvent('health_check', { timestamp: Date.now() });
    results.analytics = true;
  } catch (error) {
    console.error('Analytics Health Check Failed:', error);
  }

  return results;
}