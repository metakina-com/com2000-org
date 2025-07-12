#!/bin/bash

# COM2000 API Database Management Script
# This script provides utilities for managing the D1 database

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="development"
COMMAND=""
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
    echo "Usage: $0 COMMAND [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  migrate              Run database migrations"
    echo "  seed                 Seed database with sample data"
    echo "  reset                Reset database (drop all tables and recreate)"
    echo "  backup               Create database backup"
    echo "  restore FILE         Restore database from backup file"
    echo "  query QUERY          Execute SQL query"
    echo "  shell                Open interactive database shell"
    echo "  status               Show database status and info"
    echo "  create               Create new database"
    echo "  list                 List all databases"
    echo ""
    echo "Options:"
    echo "  -e, --env ENV        Target environment (development|staging|production) [default: development]"
    echo "  -v, --verbose        Enable verbose output"
    echo "  -h, --help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 migrate --env staging"
    echo "  $0 seed"
    echo "  $0 query \"SELECT * FROM project_cache LIMIT 5\""
    echo "  $0 backup --env production"
    echo "  $0 reset --env development"
}

# Parse command line arguments
if [[ $# -eq 0 ]]; then
    show_usage
    exit 1
fi

COMMAND="$1"
shift

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
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
            # For commands that take additional arguments
            if [[ "$COMMAND" == "query" ]]; then
                QUERY="$1"
                shift
            elif [[ "$COMMAND" == "restore" ]]; then
                BACKUP_FILE="$1"
                shift
            else
                print_error "Unknown option: $1"
                show_usage
                exit 1
            fi
            ;;
    esac
done

# Validate environment
if [[ "$ENVIRONMENT" != "development" && "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    print_error "Invalid environment: $ENVIRONMENT. Must be 'development', 'staging', or 'production'."
    exit 1
fi

# Enable verbose output if requested
if [[ "$VERBOSE" == "true" ]]; then
    set -x
fi

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

# Set database name based on environment
if [[ "$ENVIRONMENT" == "development" ]]; then
    DB_NAME="com2000-db"
    ENV_FLAG="--local"
elif [[ "$ENVIRONMENT" == "staging" ]]; then
    DB_NAME="com2000-db-staging"
    ENV_FLAG="--env staging"
else
    DB_NAME="com2000-db-production"
    ENV_FLAG="--env production"
fi

print_status "Managing database: $DB_NAME (environment: $ENVIRONMENT)"

# Execute command
case $COMMAND in
    migrate)
        print_status "Running database migrations..."
        if [[ "$ENVIRONMENT" == "development" ]]; then
            wrangler d1 migrations apply --local
        else
            wrangler d1 migrations apply $ENV_FLAG
        fi
        print_success "Migrations completed successfully!"
        ;;
    
    seed)
        print_status "Seeding database with sample data..."
        if [[ ! -f "scripts/seed.sql" ]]; then
            print_error "Seed file not found: scripts/seed.sql"
            exit 1
        fi
        
        if [[ "$ENVIRONMENT" == "development" ]]; then
            wrangler d1 execute --local --file=scripts/seed.sql
        else
            print_warning "You are about to seed the $ENVIRONMENT database!"
            read -p "Are you sure you want to continue? (y/N): " -n 1 -r
            echo ""
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                print_status "Seeding cancelled."
                exit 0
            fi
            wrangler d1 execute $ENV_FLAG --file=scripts/seed.sql
        fi
        print_success "Database seeded successfully!"
        ;;
    
    reset)
        print_warning "You are about to RESET the $ENVIRONMENT database!"
        print_warning "This will DELETE ALL DATA and recreate the schema."
        read -p "Are you sure you want to continue? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Reset cancelled."
            exit 0
        fi
        
        print_status "Resetting database..."
        
        # Create reset script
        cat > temp_reset.sql << EOF
-- Drop all tables
DROP TABLE IF EXISTS user_investment_cache;
DROP TABLE IF EXISTS ido_pool_cache;
DROP TABLE IF EXISTS project_cache;
DROP TABLE IF EXISTS price_cache;
DROP TABLE IF EXISTS analytics_events;
DROP TABLE IF EXISTS system_metrics;
DROP TABLE IF EXISTS error_logs;
DROP TABLE IF EXISTS rate_limits;
DROP TABLE IF EXISTS cache_metadata;

-- Drop all views
DROP VIEW IF EXISTS active_projects;
DROP VIEW IF EXISTS trending_projects;
DROP VIEW IF EXISTS active_ido_pools;
DROP VIEW IF EXISTS price_movements;
DROP VIEW IF EXISTS user_investment_summary;
EOF
        
        if [[ "$ENVIRONMENT" == "development" ]]; then
            wrangler d1 execute --local --file=temp_reset.sql
            wrangler d1 migrations apply --local
        else
            wrangler d1 execute $ENV_FLAG --file=temp_reset.sql
            wrangler d1 migrations apply $ENV_FLAG
        fi
        
        rm temp_reset.sql
        print_success "Database reset completed!"
        ;;
    
    backup)
        print_status "Creating database backup..."
        BACKUP_FILE="backup_${DB_NAME}_$(date +%Y%m%d_%H%M%S).sql"
        
        if [[ "$ENVIRONMENT" == "development" ]]; then
            print_warning "Local database backup not supported by Wrangler CLI"
            print_status "Consider using SQLite tools directly for local backups"
        else
            # Note: D1 doesn't have direct backup command, so we'll export data
            print_status "Exporting data to $BACKUP_FILE..."
            
            cat > temp_export.sql << EOF
.output $BACKUP_FILE
.dump
EOF
            
            wrangler d1 execute $ENV_FLAG --file=temp_export.sql
            rm temp_export.sql
            print_success "Backup created: $BACKUP_FILE"
        fi
        ;;
    
    restore)
        if [[ -z "$BACKUP_FILE" ]]; then
            print_error "Backup file not specified. Usage: $0 restore FILE"
            exit 1
        fi
        
        if [[ ! -f "$BACKUP_FILE" ]]; then
            print_error "Backup file not found: $BACKUP_FILE"
            exit 1
        fi
        
        print_warning "You are about to RESTORE the $ENVIRONMENT database from $BACKUP_FILE!"
        print_warning "This will OVERWRITE ALL EXISTING DATA."
        read -p "Are you sure you want to continue? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Restore cancelled."
            exit 0
        fi
        
        print_status "Restoring database from $BACKUP_FILE..."
        
        if [[ "$ENVIRONMENT" == "development" ]]; then
            wrangler d1 execute --local --file="$BACKUP_FILE"
        else
            wrangler d1 execute $ENV_FLAG --file="$BACKUP_FILE"
        fi
        
        print_success "Database restored successfully!"
        ;;
    
    query)
        if [[ -z "$QUERY" ]]; then
            print_error "SQL query not specified. Usage: $0 query \"SELECT * FROM table\""
            exit 1
        fi
        
        print_status "Executing query: $QUERY"
        
        if [[ "$ENVIRONMENT" == "development" ]]; then
            wrangler d1 execute --local --command="$QUERY"
        else
            wrangler d1 execute $ENV_FLAG --command="$QUERY"
        fi
        ;;
    
    shell)
        print_status "Opening interactive database shell..."
        print_status "Type .exit to quit the shell"
        
        if [[ "$ENVIRONMENT" == "development" ]]; then
            print_warning "Interactive shell not available for local development"
            print_status "Use 'wrangler d1 execute --local --command=\"YOUR_QUERY\"' instead"
        else
            print_warning "Interactive shell not directly supported by Wrangler CLI"
            print_status "Use '$0 query \"YOUR_QUERY\"' to execute individual queries"
        fi
        ;;
    
    status)
        print_status "Database Status for $ENVIRONMENT:"
        echo ""
        
        # Show database info
        print_status "Database: $DB_NAME"
        print_status "Environment: $ENVIRONMENT"
        
        # Show table counts
        print_status "Table Statistics:"
        
        TABLES=("project_cache" "ido_pool_cache" "user_investment_cache" "price_cache" "analytics_events" "system_metrics" "error_logs" "rate_limits" "cache_metadata")
        
        for table in "${TABLES[@]}"; do
            if [[ "$ENVIRONMENT" == "development" ]]; then
                COUNT=$(wrangler d1 execute --local --command="SELECT COUNT(*) as count FROM $table" 2>/dev/null | grep -o '[0-9]\+' | tail -1 || echo "0")
            else
                COUNT=$(wrangler d1 execute $ENV_FLAG --command="SELECT COUNT(*) as count FROM $table" 2>/dev/null | grep -o '[0-9]\+' | tail -1 || echo "0")
            fi
            printf "  %-25s %s records\n" "$table:" "$COUNT"
        done
        ;;
    
    create)
        print_status "Creating new database: $DB_NAME"
        wrangler d1 create $DB_NAME
        print_success "Database created successfully!"
        print_status "Don't forget to update wrangler.toml with the new database ID"
        ;;
    
    list)
        print_status "Available databases:"
        wrangler d1 list
        ;;
    
    *)
        print_error "Unknown command: $COMMAND"
        show_usage
        exit 1
        ;;
esac

print_success "Database operation completed successfully!"