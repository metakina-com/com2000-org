import { defineConfig } from 'vitest/config';
import path from 'path';
export default defineConfig({
    test: {
        globals: true,
        environment: 'miniflare',
        environmentOptions: {
            modules: true,
            scriptPath: './src/index.ts',
            bindings: {
                ENVIRONMENT: 'test',
                API_VERSION: '1.0.0-test',
                JWT_SECRET: 'test-jwt-secret',
                ENCRYPTION_KEY: 'test-encryption-key',
                CORS_ORIGINS: 'http://localhost:3000',
                RATE_LIMIT_REQUESTS: '100',
                RATE_LIMIT_WINDOW: '900',
                SESSION_TIMEOUT: '3600',
                MAX_FILE_SIZE: '1048576',
                CACHE_TTL: '10'
            },
            kvNamespaces: {
                SESSION_STORE: 'test-session-store',
                PROJECT_CACHE: 'test-project-cache',
                RATE_LIMITER: 'test-rate-limiter'
            },
            d1Databases: {
                DB: 'test-database'
            },
            r2Buckets: {
                ASSETS: 'test-assets'
            },
            analyticsEngineDatasets: {
                ANALYTICS: 'test-analytics'
            }
        },
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/**',
                'dist/**',
                'coverage/**',
                '**/*.d.ts',
                '**/*.config.*',
                '**/migrations/**'
            ],
            thresholds: {
                global: {
                    branches: 80,
                    functions: 80,
                    lines: 80,
                    statements: 80
                }
            }
        },
        setupFiles: ['./test/setup.ts'],
        testTimeout: 10000,
        hookTimeout: 10000
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@/types': path.resolve(__dirname, './src/types'),
            '@/utils': path.resolve(__dirname, './src/utils'),
            '@/routes': path.resolve(__dirname, './src/routes'),
            '@/middleware': path.resolve(__dirname, './src/middleware')
        }
    },
    esbuild: {
        target: 'es2022'
    }
});
//# sourceMappingURL=vitest.config.js.map