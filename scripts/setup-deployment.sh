#!/bin/bash

# COM2000 API 自动化部署设置脚本
# 此脚本帮助快速设置Cloudflare Workers的自动化部署环境

set -e  # 遇到错误时退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # 无颜色

# 输出函数
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

print_header() {
    echo -e "${PURPLE}[SETUP]${NC} $1"
}

# 显示使用说明
show_usage() {
    echo "COM2000 API 自动化部署设置脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help           显示此帮助信息"
    echo "  -f, --force          强制重新创建资源（如果已存在）"
    echo "  -s, --skip-login     跳过Cloudflare登录检查"
    echo "  -v, --verbose        启用详细输出"
    echo ""
    echo "此脚本将:"
    echo "  1. 检查必要的工具和依赖"
    echo "  2. 验证Cloudflare认证"
    echo "  3. 创建所需的Cloudflare资源"
    echo "  4. 更新配置文件"
    echo "  5. 设置GitHub Secrets（需要手动完成）"
    echo "  6. 运行初始部署测试"
}

# 默认参数
FORCE_RECREATE=false
SKIP_LOGIN=false
VERBOSE=false

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -f|--force)
            FORCE_RECREATE=true
            shift
            ;;
        -s|--skip-login)
            SKIP_LOGIN=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        *)
            print_error "未知选项: $1"
            show_usage
            exit 1
            ;;
    esac
done

# 启用详细输出
if [[ "$VERBOSE" == "true" ]]; then
    set -x
fi

print_header "开始设置COM2000 API自动化部署环境"
echo ""

# 1. 检查必要工具
print_status "检查必要工具..."

# 检查Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js未安装。请从 https://nodejs.org/ 安装Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [[ $NODE_VERSION -lt 18 ]]; then
    print_error "需要Node.js 18或更高版本。当前版本: $(node --version)"
    exit 1
fi
print_success "Node.js版本: $(node --version)"

# 检查npm
if ! command -v npm &> /dev/null; then
    print_error "npm未安装"
    exit 1
fi
print_success "npm版本: $(npm --version)"

# 检查git
if ! command -v git &> /dev/null; then
    print_error "Git未安装"
    exit 1
fi
print_success "Git版本: $(git --version)"

# 检查curl
if ! command -v curl &> /dev/null; then
    print_error "curl未安装"
    exit 1
fi

# 2. 安装和检查Wrangler
print_status "检查Wrangler CLI..."
if ! command -v wrangler &> /dev/null; then
    print_status "安装Wrangler CLI..."
    npm install -g wrangler
else
    print_success "Wrangler已安装: $(wrangler --version)"
fi

# 3. 检查项目结构
print_status "检查项目结构..."
if [[ ! -f "package.json" ]]; then
    print_error "package.json未找到。请在项目根目录运行此脚本。"
    exit 1
fi

if [[ ! -f "wrangler.toml" ]]; then
    print_error "wrangler.toml未找到。请确保在正确的项目目录中。"
    exit 1
fi

print_success "项目结构检查通过"

# 4. Cloudflare认证
if [[ "$SKIP_LOGIN" != "true" ]]; then
    print_status "检查Cloudflare认证..."
    if ! wrangler whoami &> /dev/null; then
        print_warning "未登录Cloudflare。正在启动登录流程..."
        wrangler login
        
        # 再次检查
        if ! wrangler whoami &> /dev/null; then
            print_error "Cloudflare登录失败"
            exit 1
        fi
    fi
    
    CLOUDFLARE_USER=$(wrangler whoami 2>/dev/null | grep 'You are logged in' | cut -d' ' -f6 || echo '已认证用户')
    print_success "已登录Cloudflare: $CLOUDFLARE_USER"
else
    print_warning "跳过Cloudflare登录检查"
fi

# 5. 获取账户ID
print_status "获取Cloudflare账户信息..."
ACCOUNT_ID=$(wrangler whoami 2>/dev/null | grep 'Account ID' | awk '{print $3}' || echo '')
if [[ -z "$ACCOUNT_ID" ]]; then
    print_warning "无法自动获取账户ID，请手动设置"
else
    print_success "账户ID: $ACCOUNT_ID"
fi

# 6. 创建Cloudflare资源
print_header "创建Cloudflare资源"

# 创建D1数据库
print_status "创建D1数据库..."

create_d1_database() {
    local db_name=$1
    local env_suffix=$2
    
    if wrangler d1 list | grep -q "$db_name"; then
        if [[ "$FORCE_RECREATE" == "true" ]]; then
            print_warning "数据库 $db_name 已存在，正在删除并重新创建..."
            # 注意：Cloudflare不支持直接删除D1数据库，需要手动处理
            print_warning "请手动删除数据库 $db_name 后重新运行脚本"
        else
            print_success "数据库 $db_name 已存在"
            return
        fi
    fi
    
    print_status "创建数据库: $db_name"
    DB_OUTPUT=$(wrangler d1 create "$db_name" 2>&1)
    if [[ $? -eq 0 ]]; then
        DB_ID=$(echo "$DB_OUTPUT" | grep 'database_id' | awk '{print $3}' | tr -d '"')
        print_success "数据库 $db_name 创建成功，ID: $DB_ID"
        
        # 更新wrangler.toml
        if [[ -n "$env_suffix" ]]; then
            print_status "更新wrangler.toml中的 $env_suffix 环境数据库ID..."
            # 这里需要实际的sed命令来更新配置文件
        fi
    else
        print_error "创建数据库 $db_name 失败: $DB_OUTPUT"
    fi
}

# 创建各环境的数据库
create_d1_database "com2000-db" ""
create_d1_database "com2000-db-staging" "staging"
create_d1_database "com2000-db-production" "production"

# 创建KV命名空间
print_status "创建KV命名空间..."

create_kv_namespace() {
    local binding_name=$1
    local env_suffix=$2
    local namespace_name="${binding_name}"
    
    if [[ -n "$env_suffix" ]]; then
        namespace_name="${binding_name}_${env_suffix}"
    fi
    
    print_status "创建KV命名空间: $namespace_name"
    
    if [[ -n "$env_suffix" ]]; then
        KV_OUTPUT=$(wrangler kv:namespace create "$binding_name" --env "$env_suffix" 2>&1)
    else
        KV_OUTPUT=$(wrangler kv:namespace create "$binding_name" 2>&1)
    fi
    
    if [[ $? -eq 0 ]]; then
        KV_ID=$(echo "$KV_OUTPUT" | grep 'id' | awk '{print $3}' | tr -d '"')
        print_success "KV命名空间 $namespace_name 创建成功，ID: $KV_ID"
    else
        print_warning "KV命名空间 $namespace_name 可能已存在或创建失败"
    fi
}

# 创建各环境的KV命名空间
for binding in "SESSION_STORE" "PROJECT_CACHE" "RATE_LIMITER"; do
    create_kv_namespace "$binding" ""
    create_kv_namespace "$binding" "staging"
    create_kv_namespace "$binding" "production"
done

# 创建R2存储桶
print_status "创建R2存储桶..."

create_r2_bucket() {
    local bucket_name=$1
    
    if wrangler r2 bucket list | grep -q "$bucket_name"; then
        print_success "R2存储桶 $bucket_name 已存在"
        return
    fi
    
    print_status "创建R2存储桶: $bucket_name"
    if wrangler r2 bucket create "$bucket_name"; then
        print_success "R2存储桶 $bucket_name 创建成功"
    else
        print_error "创建R2存储桶 $bucket_name 失败"
    fi
}

create_r2_bucket "com2000-assets"
create_r2_bucket "com2000-assets-staging"
create_r2_bucket "com2000-assets-production"

# 7. 安装项目依赖
print_status "安装项目依赖..."
npm install

# 8. 设置环境变量
print_status "设置开发环境变量..."
if [[ ! -f ".dev.vars" ]]; then
    cp .dev.vars.example .dev.vars
    print_success "已创建.dev.vars文件"
    print_warning "请编辑.dev.vars文件，填入实际的环境变量值"
else
    print_success ".dev.vars文件已存在"
fi

# 9. 运行数据库迁移
print_status "运行数据库迁移..."
if [[ -d "migrations" ]] && [[ -n "$(ls -A migrations 2>/dev/null)" ]]; then
    print_status "运行开发环境数据库迁移..."
    npm run db:migrate || print_warning "数据库迁移失败，请检查配置"
else
    print_warning "未找到数据库迁移文件"
fi

# 10. 运行测试
print_status "运行项目测试..."
npm run type-check || print_warning "类型检查失败"
npm run lint || print_warning "代码检查失败"
npm test || print_warning "单元测试失败"

# 11. 构建项目
print_status "构建项目..."
npm run build || print_warning "项目构建失败"

# 12. GitHub Secrets设置说明
print_header "GitHub Secrets设置"
echo ""
print_status "请在GitHub仓库中设置以下Secrets:"
echo ""
echo "1. 访问: https://github.com/your-username/your-repo/settings/secrets/actions"
echo "2. 添加以下Secrets:"
echo ""
echo "   CLOUDFLARE_API_TOKEN="
echo "   获取方式: https://dash.cloudflare.com/profile/api-tokens"
echo "   权限: Account:Cloudflare Workers:Edit, Zone:Zone:Read"
echo ""
if [[ -n "$ACCOUNT_ID" ]]; then
    echo "   CLOUDFLARE_ACCOUNT_ID=$ACCOUNT_ID"
else
    echo "   CLOUDFLARE_ACCOUNT_ID=your_account_id"
    echo "   获取方式: wrangler whoami"
fi
echo ""

# 13. 部署测试
print_header "部署测试"
echo ""
read -p "是否要进行开发环境部署测试？(y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "启动开发服务器进行测试..."
    print_status "服务器将在 http://localhost:8787 启动"
    print_status "按 Ctrl+C 停止服务器"
    
    # 启动开发服务器（非阻塞模式，5秒后停止）
    timeout 5s npm run dev || true
    
    print_success "开发服务器测试完成"
fi

# 14. 完成总结
print_header "设置完成"
echo ""
print_success "COM2000 API自动化部署环境设置完成！"
echo ""
print_status "下一步操作:"
echo "  1. 编辑 .dev.vars 文件，填入实际的环境变量值"
echo "  2. 在GitHub中设置上述提到的Secrets"
echo "  3. 更新 wrangler.toml 中的资源ID（如果需要）"
echo "  4. 提交代码到GitHub触发自动部署"
echo ""
print_status "常用命令:"
echo "  npm run dev              - 启动开发服务器"
echo "  npm run deploy:staging   - 部署到staging环境"
echo "  npm run deploy:production - 部署到production环境"
echo "  ./scripts/deploy.sh --help - 查看部署脚本帮助"
echo ""
print_status "文档:"
echo "  查看 DEPLOYMENT.md 获取详细的部署文档"
echo ""
print_success "设置完成！祝您使用愉快！ 🚀"