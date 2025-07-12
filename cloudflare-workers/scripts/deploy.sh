#!/bin/bash

# COM2000 API Deployment Script
# This script handles deployment to different environments

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="staging"
SKIP_TESTS=false
SKIP_BUILD=false
VERBOSE=false

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

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --env ENVIRONMENT    Target environment (staging|production) [default: staging]"
    echo "  -s, --skip-tests         Skip running tests"
    echo "  -b, --skip-build         Skip build step"
    echo "  -v, --verbose            Enable verbose output"
    echo "  -h, --help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --env production      Deploy to production"
    echo "  $0 --skip-tests          Deploy to staging without running tests"
    echo "  $0 -e staging -v         Deploy to staging with verbose output"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -s|--skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        -b|--skip-build)
            SKIP_BUILD=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    print_error "Invalid environment: $ENVIRONMENT. Must be 'staging' or 'production'."
    exit 1
fi

# Enable verbose output if requested
if [[ "$VERBOSE" == "true" ]]; then
    set -x
fi

print_status "Starting deployment to $ENVIRONMENT environment..."

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    print_error "Wrangler CLI not found. Please install it with: npm install -g wrangler"
    exit 1
fi

# Check if user is logged in to Cloudflare
if ! wrangler whoami &> /dev/null; then
    print_error "Not logged in to Cloudflare. Please run: wrangler login"
    exit 1
fi

# Install dependencies
print_status "Installing dependencies..."
npm ci

# Run type checking
print_status "Running type checking..."
npm run type-check

# Run linting
print_status "Running linting..."
npm run lint

# Run tests (unless skipped)
if [[ "$SKIP_TESTS" != "true" ]]; then
    print_status "Running tests..."
    npm test
else
    print_warning "Skipping tests as requested"
fi

# Build the project (unless skipped)
if [[ "$SKIP_BUILD" != "true" ]]; then
    print_status "Building project..."
    npm run build
else
    print_warning "Skipping build as requested"
fi

# Run database migrations
print_status "Running database migrations..."
wrangler d1 migrations apply --env $ENVIRONMENT

# Deploy to Cloudflare Workers
print_status "Deploying to Cloudflare Workers ($ENVIRONMENT)..."
if [[ "$ENVIRONMENT" == "production" ]]; then
    # Production deployment requires confirmation
    echo ""
    print_warning "You are about to deploy to PRODUCTION!"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Deployment cancelled."
        exit 0
    fi
fi

wrangler deploy --env $ENVIRONMENT

# Verify deployment
print_status "Verifying deployment..."
if [[ "$ENVIRONMENT" == "production" ]]; then
    HEALTH_URL="https://api.com2000.org/api/health"
else
    HEALTH_URL="https://api-staging.com2000.org/api/health"
fi

# Wait a moment for deployment to propagate
sleep 5

# Check health endpoint
if curl -f -s "$HEALTH_URL" > /dev/null; then
    print_success "Deployment successful! Health check passed."
else
    print_warning "Deployment completed but health check failed. Please verify manually."
fi

# Show deployment info
print_status "Deployment Summary:"
echo "  Environment: $ENVIRONMENT"
echo "  Health URL: $HEALTH_URL"
echo "  Timestamp: $(date)"

if [[ "$ENVIRONMENT" == "production" ]]; then
    echo "  Production URL: https://api.com2000.org"
else
    echo "  Staging URL: https://api-staging.com2000.org"
fi

print_success "Deployment to $ENVIRONMENT completed successfully!"

# Optional: Open the deployed URL
read -p "Would you like to open the deployed application? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v open &> /dev/null; then
        open "$HEALTH_URL"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$HEALTH_URL"
    else
        print_status "Please open $HEALTH_URL in your browser"
    fi
fi