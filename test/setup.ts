import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Global test setup
beforeAll(async () => {
  console.log('🧪 Starting test suite...');
});

afterAll(async () => {
  console.log('✅ Test suite completed');
});

// Setup before each test
beforeEach(async () => {
  // Reset any global state if needed
});

// Cleanup after each test
afterEach(async () => {
  // Clean up any test data
});

// Mock console methods for cleaner test output
const originalConsole = { ...console };

// Override console methods during tests
console.log = (...args: any[]) => {
  if (process.env.VITEST_VERBOSE) {
    originalConsole.log(...args);
  }
};

console.warn = (...args: any[]) => {
  if (process.env.VITEST_VERBOSE) {
    originalConsole.warn(...args);
  }
};

// Keep error and debug for important messages
console.error = originalConsole.error;
console.debug = originalConsole.debug;

// Global test utilities
global.testUtils = {
  // Mock environment for tests
  createMockEnv: () => ({
    ENVIRONMENT: 'test',
    API_VERSION: '1.0.0-test',
    JWT_SECRET: 'test-jwt-secret',
    ENCRYPTION_KEY: 'test-encryption-key',
    CORS_ORIGINS: 'http://localhost:3000',
    RATE_LIMIT_REQUESTS: '100',
    RATE_LIMIT_WINDOW: '900',
    SESSION_TIMEOUT: '3600',
    MAX_FILE_SIZE: '1048576',
    CACHE_TTL: '10',
    // Mock Cloudflare bindings
    DB: {
      prepare: () => ({
        bind: () => ({
          all: () => Promise.resolve({ results: [], meta: {} }),
          first: () => Promise.resolve(null),
          run: () => Promise.resolve({ success: true, meta: {} })
        })
      })
    },
    SESSION_STORE: {
      get: () => Promise.resolve(null),
      put: () => Promise.resolve(),
      delete: () => Promise.resolve()
    },
    PROJECT_CACHE: {
      get: () => Promise.resolve(null),
      put: () => Promise.resolve(),
      delete: () => Promise.resolve()
    },
    RATE_LIMITER: {
      get: () => Promise.resolve(null),
      put: () => Promise.resolve(),
      delete: () => Promise.resolve()
    },
    ASSETS: {
      get: () => Promise.resolve(null),
      put: () => Promise.resolve(),
      delete: () => Promise.resolve()
    },
    ANALYTICS: {
      writeDataPoint: () => Promise.resolve()
    }
  }),

  // Create mock request
  createMockRequest: (url: string, options: RequestInit = {}) => {
    return new Request(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
  },

  // Create mock execution context
  createMockContext: () => ({
    waitUntil: (promise: Promise<any>) => promise,
    passThroughOnException: () => {}
  }),

  // Helper to create authenticated request
  createAuthenticatedRequest: (url: string, token: string, options: RequestInit = {}) => {
    return new Request(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      },
      ...options
    });
  },

  // Helper to parse response
  parseResponse: async (response: Response) => {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
};

// Type declarations for global test utilities
declare global {
  var testUtils: {
    createMockEnv: () => any;
    createMockRequest: (url: string, options?: RequestInit) => Request;
    createMockContext: () => any;
    createAuthenticatedRequest: (url: string, token: string, options?: RequestInit) => Request;
    parseResponse: (response: Response) => Promise<any>;
  };
}