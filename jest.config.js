/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'miniflare',
  testEnvironmentOptions: {
    modules: true,
    scriptPath: 'dist/index.js',
    bindings: {
      ENVIRONMENT: 'test',
      API_VERSION: 'v1',
      JWT_SECRET: 'test-jwt-secret-key',
      ENCRYPTION_KEY: 'test-encryption-key-32-chars-long',
      CORS_ORIGINS: 'http://localhost:3000',
      RATE_LIMIT_REQUESTS: '100',
      RATE_LIMIT_WINDOW: '900',
      SESSION_TIMEOUT: '86400',
      MAX_FILE_SIZE: '10485760',
      CACHE_TTL: '3600',
    },
    kvNamespaces: {
      SESSION_STORE: 'test-session-store',
      PROJECT_CACHE: 'test-project-cache',
      RATE_LIMITER: 'test-rate-limiter',
    },
    d1Databases: {
      DB: 'test-database',
    },
    r2Buckets: {
      ASSETS: 'test-assets',
    },
    analyticsEngineDatasets: {
      ANALYTICS: 'test-analytics',
    },
  },
  
  roots: ['<rootDir>/src', '<rootDir>/test'],
  
  testMatch: [
    '<rootDir>/test/**/*.test.ts',
    '<rootDir>/src/**/*.test.ts',
  ],
  
  transform: {
    '^.+\.tsx?$': 'ts-jest',
  },
  
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@routes/(.*)$': '<rootDir>/src/routes/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
  },
  
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/types/**/*',
  ],
  
  coverageDirectory: 'coverage',
  
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary',
  ],
  
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  
  testTimeout: 30000,
  
  verbose: true,
  
  bail: false,
  
  errorOnDeprecated: true,
  
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
};