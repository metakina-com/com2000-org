# COM2000 API 自动化部署指南

本文档详细说明了COM2000 API项目在Cloudflare Workers上的自动化部署配置和流程。

## 目录

- [部署架构](#部署架构)
- [环境配置](#环境配置)
- [GitHub Actions CI/CD](#github-actions-cicd)
- [手动部署](#手动部署)
- [环境变量配置](#环境变量配置)
- [数据库迁移](#数据库迁移)
- [监控和日志](#监控和日志)
- [故障排除](#故障排除)

## 部署架构

项目采用多环境部署策略：

- **开发环境 (Development)**: 本地开发，使用 `wrangler dev`
- **预发布环境 (Staging)**: 自动部署，当代码推送到 `develop` 分支时触发
- **生产环境 (Production)**: 自动部署，当代码推送到 `main` 分支时触发

### 部署流程图

```
开发者推送代码 → GitHub Actions 触发 → 运行测试 → 构建项目 → 部署到对应环境
```

## 环境配置

### 1. Cloudflare 账户设置

首先确保你有Cloudflare账户并获取必要的凭证：

```bash
# 登录Cloudflare
wrangler login

# 查看账户信息
wrangler whoami
```

### 2. GitHub Secrets 配置

在GitHub仓库的Settings > Secrets and variables > Actions中添加以下secrets：

```
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
```

获取API Token的步骤：
1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. 点击 "Create Token"
3. 使用 "Custom token" 模板
4. 设置权限：
   - Account: Cloudflare Workers:Edit
   - Zone: Zone:Read
   - Zone Resources: Include All zones

### 3. Cloudflare 资源创建

运行以下命令创建必要的Cloudflare资源：

```bash
# 创建D1数据库
wrangler d1 create com2000-db
wrangler d1 create com2000-db-staging
wrangler d1 create com2000-db-production

# 创建KV命名空间
wrangler kv:namespace create SESSION_STORE
wrangler kv:namespace create SESSION_STORE --env staging
wrangler kv:namespace create SESSION_STORE --env production

wrangler kv:namespace create PROJECT_CACHE
wrangler kv:namespace create PROJECT_CACHE --env staging
wrangler kv:namespace create PROJECT_CACHE --env production

wrangler kv:namespace create RATE_LIMITER
wrangler kv:namespace create RATE_LIMITER --env staging
wrangler kv:namespace create RATE_LIMITER --env production

# 创建R2存储桶
wrangler r2 bucket create com2000-assets
wrangler r2 bucket create com2000-assets-staging
wrangler r2 bucket create com2000-assets-production
```

创建资源后，更新 `wrangler.toml` 文件中的相应ID。

## GitHub Actions CI/CD

### 当前CI/CD流程

项目已配置完整的CI/CD流程，包含以下阶段：

#### 1. 测试阶段 (Test)
- 代码检出
- Node.js环境设置
- 依赖安装
- TypeScript类型检查
- ESLint代码检查
- 单元测试和覆盖率报告
- 上传覆盖率到Codecov

#### 2. 构建阶段 (Build)
- 项目构建
- 构建产物上传

#### 3. 部署阶段

**预发布部署 (deploy-staging)**:
- 触发条件：推送到 `develop` 分支
- 自动部署到staging环境
- 无需人工确认

**生产部署 (deploy-production)**:
- 触发条件：推送到 `main` 分支
- 自动部署到production环境
- 使用GitHub Environment保护规则

#### 4. 安全扫描 (security-scan)
- 使用Trivy进行漏洞扫描
- 结果上传到GitHub Security tab

### 部署触发条件

```yaml
# 自动触发条件
on:
  push:
    branches: [ main, develop ]  # 推送到主分支或开发分支
  pull_request:
    branches: [ main, develop ]  # 针对主分支的PR
```

### 环境保护规则

建议在GitHub中设置环境保护规则：

1. 进入仓库 Settings > Environments
2. 创建 `staging` 和 `production` 环境
3. 为 `production` 环境设置：
   - Required reviewers（必需审查者）
   - Wait timer（等待时间）
   - Deployment branches（部署分支限制）

## 手动部署

### 使用部署脚本

项目提供了便捷的部署脚本：

```bash
# 部署到staging环境
./scripts/deploy.sh --env staging

# 部署到production环境
./scripts/deploy.sh --env production

# 跳过测试的快速部署
./scripts/deploy.sh --env staging --skip-tests

# 详细输出模式
./scripts/deploy.sh --env production --verbose
```

### 使用npm脚本

```bash
# 开发环境
npm run dev

# 部署到staging
npm run deploy:staging

# 部署到production
npm run deploy:production
```

### 使用Wrangler直接部署

```bash
# 部署到staging
wrangler deploy --env staging

# 部署到production
wrangler deploy --env production
```

## 环境变量配置

### 开发环境

1. 复制环境变量模板：
```bash
cp .dev.vars.example .dev.vars
```

2. 编辑 `.dev.vars` 文件，填入实际值：
```bash
# 必需的环境变量
JWT_SECRET=your-super-secret-jwt-key
ENCRYPTION_KEY=your-32-character-encryption-key

# 可选的外部API密钥
COINGECKO_API_KEY=your-coingecko-api-key
COINMARKETCAP_API_KEY=your-coinmarketcap-api-key
```

### 生产环境

生产环境变量在 `wrangler.toml` 中配置，敏感信息应使用Cloudflare的secrets管理：

```bash
# 设置生产环境secrets
wrangler secret put JWT_SECRET --env production
wrangler secret put ENCRYPTION_KEY --env production
wrangler secret put COINGECKO_API_KEY --env production

# 查看已设置的secrets
wrangler secret list --env production
```

## 数据库迁移

### 自动迁移

部署脚本会自动运行数据库迁移，但你也可以手动执行：

```bash
# 开发环境迁移
npm run db:migrate

# Staging环境迁移
npm run db:migrate:staging

# Production环境迁移
npm run db:migrate:production
```

### 数据库种子数据

```bash
# 添加种子数据
npm run db:seed

# 备份数据库
npm run db:backup
```

### 迁移文件管理

迁移文件位于 `migrations/` 目录：

```
migrations/
├── 0001_initial_schema.sql
├── 0002_add_user_tables.sql
└── 0003_add_project_tables.sql
```

创建新迁移：
```bash
# 创建新的迁移文件
wrangler d1 migrations create com2000-db "add_new_feature"
```

## 监控和日志

### 实时日志查看

```bash
# 查看开发环境日志
npm run logs

# 查看staging环境日志
npm run logs:staging

# 查看production环境日志
npm run logs:production
```

### 分析和监控

```bash
# 查看分析数据
npm run analytics

# 查看KV存储使用情况
npm run kv:list

# 查看R2存储使用情况
npm run r2:list
```

### 健康检查

部署完成后，脚本会自动进行健康检查：

- Staging: `https://api-staging.com2000.org/api/health`
- Production: `https://api.com2000.org/api/health`

## 故障排除

### 常见问题

#### 1. 部署失败

**问题**: Wrangler部署时出现认证错误
```
Error: Authentication error
```

**解决方案**:
```bash
# 重新登录Cloudflare
wrangler logout
wrangler login

# 检查API Token权限
wrangler whoami
```

#### 2. 数据库连接失败

**问题**: D1数据库连接错误
```
Error: D1_ERROR: Database not found
```

**解决方案**:
1. 检查 `wrangler.toml` 中的数据库ID是否正确
2. 确认数据库已创建：`wrangler d1 list`
3. 运行迁移：`npm run db:migrate`

#### 3. 环境变量问题

**问题**: 环境变量未定义
```
Error: JWT_SECRET is not defined
```

**解决方案**:
1. 检查 `.dev.vars` 文件（开发环境）
2. 检查 `wrangler.toml` 配置（staging/production）
3. 设置secrets：`wrangler secret put JWT_SECRET`

#### 4. 构建错误

**问题**: TypeScript编译错误
```
Error: Type checking failed
```

**解决方案**:
```bash
# 运行类型检查
npm run type-check

# 修复linting问题
npm run lint:fix

# 格式化代码
npm run format
```

### 调试技巧

1. **启用详细日志**:
```bash
./scripts/deploy.sh --env staging --verbose
```

2. **本地测试**:
```bash
# 本地运行
npm run dev

# 本地测试
npm run test:watch
```

3. **检查资源状态**:
```bash
# 检查Workers状态
wrangler status

# 检查KV命名空间
wrangler kv:namespace list

# 检查D1数据库
wrangler d1 list
```

### 回滚策略

如果部署出现问题，可以快速回滚：

1. **使用Git回滚**:
```bash
# 回滚到上一个commit
git revert HEAD
git push origin main
```

2. **手动部署上一个版本**:
```bash
# 切换到上一个稳定版本
git checkout <previous-stable-commit>
./scripts/deploy.sh --env production
```

3. **使用Cloudflare Dashboard**:
- 访问Cloudflare Workers Dashboard
- 选择对应的Worker
- 在Deployments标签中回滚到之前的版本

## 最佳实践

1. **分支策略**:
   - `main` 分支用于生产环境
   - `develop` 分支用于预发布环境
   - 功能开发使用feature分支

2. **测试策略**:
   - 所有代码必须通过测试才能部署
   - 保持高测试覆盖率（>80%）
   - 在staging环境充分测试后再部署到生产环境

3. **安全策略**:
   - 定期更新依赖包
   - 使用强密码和密钥
   - 定期轮换API密钥
   - 监控安全扫描结果

4. **监控策略**:
   - 设置错误告警
   - 监控性能指标
   - 定期检查日志
   - 备份重要数据

## 联系支持

如果遇到部署问题，请：

1. 查看GitHub Actions日志
2. 检查Cloudflare Workers日志
3. 参考本文档的故障排除部分
4. 联系开发团队获取支持

---

**注意**: 本文档会随着项目发展持续更新，请定期查看最新版本。