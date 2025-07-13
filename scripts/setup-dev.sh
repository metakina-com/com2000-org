#!/bin/bash

# COM2000 API Development Environment Setup Script
# This script sets up the development environment for the COM2000 API

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_status "Setting up COM2000 API development environment..."

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# Check Node.js version
print_status "Checking Node.js version..."
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [[ $NODE_VERSION -lt 18 ]]; then
    print_error "Node.js 18 or higher is required. Current version: $(node --version)"
    print_status "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi
print_success "Node.js version: $(node --version)"

# Check npm version
print_status "Checking npm version..."
NPM_VERSION=$(npm --version | cut -d'.' -f1)
if [[ $NPM_VERSION -lt 9 ]]; then
    print_warning "npm 9 or higher is recommended. Current version: $(npm --version)"
    print_status "Consider upgrading with: npm install -g npm@latest"
else
    print_success "npm version: $(npm --version)"
fi

# Install dependencies
print_status "Installing dependencies..."
npm install

# Install Wrangler CLI globally if not present
if ! command -v wrangler &> /dev/null; then
    print_status "Installing Wrangler CLI..."
    npm install -g wrangler
else
    print_success "Wrangler CLI already installed: $(wrangler --version)"
fi

# Check if user is logged in to Cloudflare
print_status "Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    print_warning "Not logged in to Cloudflare."
    print_status "Please run: wrangler login"
    print_status "This will open a browser window to authenticate with Cloudflare."
else
    print_success "Logged in to Cloudflare as: $(wrangler whoami 2>/dev/null | grep 'You are logged in' | cut -d' ' -f6 || echo 'authenticated user')"
fi

# Create .dev.vars file if it doesn't exist
if [[ ! -f ".dev.vars" ]]; then
    print_status "Creating .dev.vars file from template..."
    cp .dev.vars.example .dev.vars
    print_warning "Please update .dev.vars with your actual values before running the development server."
else
    print_success ".dev.vars file already exists"
fi

# Setup Git hooks with Husky
print_status "Setting up Git hooks..."
npx husky install
npx husky add .husky/pre-commit "npx lint-staged && npm run type-check && npm test"
npx husky add .husky/pre-push "npm run test:coverage && npm run build && npm run lint"

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p logs
mkdir -p temp
mkdir -p coverage

# Run type checking
print_status "Running type checking..."
npm run type-check

# Run linting
print_status "Running linting..."
npm run lint

# Run tests
print_status "Running tests..."
npm test

# Build the project
print_status "Building project..."
npm run build

# Check Cloudflare resources
print_status "Checking Cloudflare resources..."
echo ""
print_status "Available KV namespaces:"
wrangler kv:namespace list 2>/dev/null || print_warning "Could not list KV namespaces. Please check your Cloudflare authentication."

echo ""
print_status "Available D1 databases:"
wrangler d1 list 2>/dev/null || print_warning "Could not list D1 databases. Please check your Cloudflare authentication."

echo ""
print_status "Available R2 buckets:"
wrangler r2 bucket list 2>/dev/null || print_warning "Could not list R2 buckets. Please check your Cloudflare authentication."

# Setup instructions
echo ""
print_success "Development environment setup completed!"
echo ""
print_status "Next steps:"
echo "  1. Update .dev.vars with your actual environment variables"
echo "  2. Create Cloudflare resources if they don't exist:"
echo "     - wrangler d1 create com2000-db"
echo "     - wrangler kv:namespace create SESSION_STORE"
echo "     - wrangler kv:namespace create PROJECT_CACHE"
echo "     - wrangler kv:namespace create RATE_LIMITER"
echo "     - wrangler r2 bucket create com2000-assets"
echo "  3. Update wrangler.toml with the actual resource IDs"
echo "  4. Run database migrations: npm run db:migrate"
echo "  5. Seed the database: npm run db:seed"
echo "  6. Start the development server: npm run dev"
echo ""
print_status "Useful commands:"
echo "  npm run dev              - Start development server"
echo "  npm test                 - Run tests"
echo "  npm run test:watch       - Run tests in watch mode"
echo "  npm run test:coverage    - Run tests with coverage"
echo "  npm run lint             - Run linting"
echo "  npm run lint:fix         - Fix linting issues"
echo "  npm run format           - Format code with Prettier"
echo "  npm run type-check       - Run TypeScript type checking"
echo "  npm run build            - Build for production"
echo "  npm run deploy:staging   - Deploy to staging"
echo "  npm run deploy:production - Deploy to production"
echo ""
print_success "Happy coding! 🚀"