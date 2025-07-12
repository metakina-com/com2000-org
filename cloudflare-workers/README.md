# COM2000 API - Cloudflare Workers

🚀 **COM2000 Platform API** - A high-performance, scalable backend built on Cloudflare Workers for cryptocurrency project management and IDO (Initial DEX Offering) platform.

## 🌟 Features

- **🔐 Authentication & Authorization**: JWT-based auth with role-based access control
- **💰 IDO Management**: Complete IDO lifecycle management with investment tracking
- **👥 User Management**: User profiles, settings, and admin controls
- **📊 Analytics**: Real-time analytics with Cloudflare Analytics Engine
- **🗄️ Database**: Cloudflare D1 SQL database with migrations
- **💾 Caching**: Multi-layer caching with KV storage
- **📁 File Storage**: R2 object storage for assets
- **🛡️ Security**: Rate limiting, input validation, and secure headers
- **⚡ Performance**: Edge computing with global distribution

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │  Cloudflare     │    │   External      │
│   (React/Vue)   │◄──►│   Workers       │◄──►│   APIs          │
│                 │    │   (Hono.js)     │    │   (Blockchain)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Cloudflare     │
                    │  Services       │
                    │                 │
                    │ • D1 Database   │
                    │ • KV Storage    │
                    │ • R2 Storage    │
                    │ • Analytics     │
                    │ • Rate Limiting │
                    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Cloudflare account
- Wrangler CLI

### Installation

```bash
# Clone the repository
git clone https://github.com/com2000-org/cloudflare-workers.git
cd cloudflare-workers

# Install dependencies
npm install

# Install Wrangler CLI globally
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

### Configuration

1. **Update `wrangler.toml`** with your Cloudflare account details:
   ```toml
   # Replace placeholder IDs with actual values
   database_id = "your-actual-database-id"
   ```

2. **Set up environment variables** in Cloudflare dashboard or `.dev.vars`:
   ```bash
   JWT_SECRET=your-super-secret-jwt-key
   ENCRYPTION_KEY=your-32-character-encryption-key
   ```

3. **Create Cloudflare resources**:
   ```bash
   # Create D1 database
   wrangler d1 create com2000-db
   
   # Create KV namespaces
   wrangler kv:namespace create SESSION_STORE
   wrangler kv:namespace create PROJECT_CACHE
   wrangler kv:namespace create RATE_LIMITER
   
   # Create R2 bucket
   wrangler r2 bucket create com2000-assets
   ```

### Development

```bash
# Run database migrations
npm run db:migrate

# Start development server
npm run dev

# The API will be available at http://localhost:8787
```

### Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Deployment

```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```

## 📚 API Documentation

### Base URL
- **Development**: `http://localhost:8787`
- **Staging**: `https://api-staging.com2000.org`
- **Production**: `https://api.com2000.org`

### Authentication

All protected endpoints require a Bearer token:
```bash
Authorization: Bearer <your-jwt-token>
```

### Endpoints

#### 🔐 Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

#### 👥 Users
- `GET /api/users/me` - Get user profile
- `PUT /api/users/me` - Update user profile
- `GET /api/users/me/settings` - Get user settings
- `PUT /api/users/me/settings` - Update user settings
- `POST /api/users/me/change-password` - Change password
- `GET /api/users/:username` - Get public profile
- `GET /api/users` - List users (admin only)
- `PUT /api/users/:id/status` - Update user status (admin only)

#### 💰 IDO Management
- `GET /api/ido/pools` - List IDO pools
- `GET /api/ido/pools/:id` - Get IDO pool details
- `POST /api/ido/pools/:id/invest` - Invest in IDO pool
- `GET /api/ido/pools/:id/investments` - Get user investments
- `GET /api/ido/my-investments` - Get all user investments

#### 🏥 Health & Monitoring
- `GET /api/health` - Health check
- `GET /api/health/detailed` - Detailed health status
- `GET /status` - API status

### Response Format

All API responses follow this structure:

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Success message",
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_123456789"
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    // Additional error details
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_123456789"
}
```

## 🗄️ Database Schema

The database includes the following main tables:

- **users** - User accounts and profiles
- **user_settings** - User preferences and settings
- **ido_pools** - IDO pool information
- **user_investments** - Investment records
- **project_cache** - Cached project data
- **price_cache** - Cached price data
- **analytics_events** - Analytics and tracking
- **rate_limits** - Rate limiting data
- **error_logs** - Error logging

See `migrations/0001_initial_schema.sql` for complete schema.

## 🛠️ Development

### Project Structure

```
src/
├── index.ts              # Main application entry
├── types/               # TypeScript type definitions
│   ├── env.ts          # Environment types
│   ├── api.ts          # API types
│   └── database.ts     # Database types
├── middleware/          # Hono middleware
│   ├── auth.ts         # Authentication middleware
│   ├── cors.ts         # CORS middleware
│   ├── rateLimit.ts    # Rate limiting
│   └── errorHandler.ts # Error handling
├── routes/             # API route handlers
│   ├── auth.ts         # Authentication routes
│   ├── users.ts        # User management
│   ├── ido.ts          # IDO management
│   └── health.ts       # Health checks
└── utils/              # Utility functions
    ├── crypto.ts       # Cryptographic functions
    ├── validation.ts   # Input validation
    └── database.ts     # Database utilities
```

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Airbnb configuration with TypeScript
- **Prettier**: Consistent code formatting
- **Husky**: Pre-commit hooks for quality

### Scripts

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm run type-check       # TypeScript type checking

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues
npm run format           # Format with Prettier
npm run format:check     # Check Prettier formatting

# Testing
npm test                 # Run tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report

# Database
npm run db:migrate       # Run migrations
npm run db:seed          # Seed database
npm run db:backup        # Backup database

# Deployment
npm run deploy:staging   # Deploy to staging
npm run deploy:production # Deploy to production

# Monitoring
npm run logs             # View logs
npm run analytics        # View analytics
```

## 🔒 Security

- **Authentication**: JWT tokens with secure signing
- **Authorization**: Role-based access control (RBAC)
- **Rate Limiting**: Per-IP and per-user limits
- **Input Validation**: Zod schema validation
- **SQL Injection**: Prepared statements
- **XSS Protection**: Content Security Policy
- **CORS**: Configurable origins
- **Encryption**: AES-256-GCM for sensitive data

## 📊 Monitoring

- **Analytics**: Cloudflare Analytics Engine
- **Logging**: Structured logging with request IDs
- **Health Checks**: Automated health monitoring
- **Error Tracking**: Comprehensive error logging
- **Performance**: Edge computing metrics

## 🚀 Performance

- **Edge Computing**: Global distribution via Cloudflare
- **Caching**: Multi-layer caching strategy
- **Database**: Optimized queries with indexes
- **CDN**: Static asset delivery
- **Compression**: Automatic response compression

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write comprehensive tests
- Update documentation
- Follow conventional commits
- Ensure all checks pass

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs.com2000.org](https://docs.com2000.org)
- **Issues**: [GitHub Issues](https://github.com/com2000-org/cloudflare-workers/issues)
- **Discord**: [COM2000 Community](https://discord.gg/com2000)
- **Email**: support@com2000.org

## 🙏 Acknowledgments

- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge computing platform
- [Hono.js](https://hono.dev/) - Fast web framework
- [Zod](https://zod.dev/) - TypeScript-first schema validation
- [Vitest](https://vitest.dev/) - Fast testing framework

---

**Built with ❤️ by the COM2000 Team**