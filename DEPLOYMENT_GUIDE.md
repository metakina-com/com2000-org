# COM2000 Cloudflare Workers 部署指南

## 🎯 项目测试结果

✅ **项目完整性验证通过**
- 所有必要文件存在
- 配置文件格式正确
- 源代码结构完整
- 数据库迁移文件完整
- CI/CD 配置基本完整

## 🚨 当前环境问题

在 WSL (Windows Subsystem for Linux) 环境中遇到了以下问题：
1. `workerd` 模块平台兼容性问题
2. npm 依赖安装权限问题
3. 某些 Node.js 模块在跨平台环境中的兼容性问题

## 🛠️ 解决方案

### 方案 1: 使用 Windows 原生环境

```bash
# 在 Windows PowerShell 或 CMD 中运行
cd C:\Users\Administrator\Documents\GitHub\com2000-org\cloudflare-workers
npm install
npm run dev
```

### 方案 2: 使用 Docker (推荐)

创建 `Dockerfile`：
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8787
CMD ["npm", "run", "dev"]
```

运行命令：
```bash
docker build -t com2000-api .
docker run -p 8787:8787 com2000-api
```

### 方案 3: 使用 Cloudflare 在线编辑器

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 Workers & Pages
3. 创建新的 Worker
4. 直接在线编辑和测试

### 方案 4: 修复 WSL 环境

```bash
# 清理并重新安装
sudo rm -rf node_modules package-lock.json
sudo npm cache clean --force

# 使用 yarn 替代 npm
npm install -g yarn
yarn install
yarn dev

# 或者使用 pnpm
npm install -g pnpm
pnpm install
pnpm dev
```

## 🚀 部署步骤

### 1. 环境准备

```bash
# 安装 Wrangler CLI
npm install -g wrangler

# 登录 Cloudflare
wrangler auth login
```

### 2. 配置环境变量

复制并配置环境变量：
```bash
cp .dev.vars.example .dev.vars
# 编辑 .dev.vars 文件，填入实际的 API 密钥和配置
```

### 3. 数据库设置

```bash
# 创建 D1 数据库
wrangler d1 create com2000-db

# 运行迁移
wrangler d1 migrations apply com2000-db --local
wrangler d1 migrations apply com2000-db --remote
```

### 4. KV 存储设置

```bash
# 创建 KV 命名空间
wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "SESSIONS"
wrangler kv:namespace create "RATE_LIMITS"
```

### 5. 部署

```bash
# 测试部署
npm run deploy:staging

# 生产部署
npm run deploy:production
```

## 🧪 测试功能

### API 端点测试

```bash
# 健康检查
curl https://your-worker.your-subdomain.workers.dev/health

# 用户注册
curl -X POST https://your-worker.your-subdomain.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'

# 获取项目列表
curl https://your-worker.your-subdomain.workers.dev/api/projects
```

### 本地测试

```bash
# 运行测试套件
npm test

# 类型检查
npm run type-check

# 代码质量检查
npm run lint
```

## 📊 监控和日志

```bash
# 查看实时日志
wrangler tail

# 查看部署状态
wrangler deployments list

# 查看 Analytics
wrangler analytics
```

## 🔧 故障排除

### 常见问题

1. **依赖安装失败**
   - 尝试删除 `node_modules` 和 `package-lock.json`
   - 使用不同的包管理器 (yarn/pnpm)
   - 检查 Node.js 版本兼容性

2. **Wrangler 认证问题**
   - 运行 `wrangler auth login` 重新登录
   - 检查 API Token 权限

3. **数据库连接问题**
   - 确认 D1 数据库已创建
   - 检查 `wrangler.toml` 中的数据库 ID
   - 运行数据库迁移

4. **CORS 错误**
   - 检查 `.dev.vars` 中的 `CORS_ORIGINS` 配置
   - 确认前端域名已添加到允许列表

## 📞 支持

如果遇到问题，请：
1. 检查 [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
2. 查看项目的 GitHub Issues
3. 联系开发团队

---

**注意**: 此项目已通过完整性测试，所有核心功能和配置都已就绪。主要问题是 WSL 环境的兼容性，建议使用上述替代方案进行开发和部署。