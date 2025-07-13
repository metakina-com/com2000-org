# COM2000 前端部署指南

## 问题说明

您的项目已成功部署到 Cloudflare Workers，但看不到页面的原因是：

1. **当前部署的是 API Worker**：https://com2000-api.dappweb.workers.dev/ 是后端 API 服务
2. **前端页面需要单独部署**：项目中的 `index.html` 是前端静态页面，需要部署到 Cloudflare Pages

## 当前状态

✅ **后端 API 已部署成功**
- URL: https://com2000-api.dappweb.workers.dev/
- 数据库连接正常
- KV 存储正常
- 所有 API 端点工作正常

❌ **前端页面未部署**
- `index.html` 文件存在但未部署
- 需要使用 Cloudflare Pages 部署静态网站

## 解决方案

### 方案 1：使用 Cloudflare Pages 部署前端（推荐）

1. **创建 Pages 项目**
```bash
npx wrangler pages project create com2000-frontend
```

2. **部署静态文件**
```bash
npx wrangler pages deploy . --project-name=com2000-frontend
```

3. **配置自定义域名**（可选）
```bash
npx wrangler pages domain add com2000-frontend your-domain.com
```

### 方案 2：修改当前 Worker 同时提供 API 和静态文件

修改 `wrangler.toml` 添加静态资源配置：

```toml
[site]
bucket = "./"
entry-point = "workers-site"
```

### 方案 3：使用 GitHub Pages 自动部署

1. 在 GitHub 仓库设置中启用 Pages
2. 选择 `main` 分支作为源
3. 自动部署到 `https://your-username.github.io/com2000-org/`

## 推荐架构

```
前端 (Cloudflare Pages)
├── https://com2000.pages.dev/
└── 调用后端 API

后端 (Cloudflare Workers)
├── https://com2000-api.dappweb.workers.dev/
├── D1 数据库
├── KV 存储
└── R2 存储
```

## 下一步操作

1. **立即部署前端**：使用方案 1 快速部署
2. **配置 API 端点**：在前端代码中配置正确的 API URL
3. **设置 CORS**：确保前端可以调用后端 API
4. **配置域名**：为前端和后端配置自定义域名

## 测试当前 API

您可以访问以下端点测试后端功能：

- 主页：https://com2000-api.dappweb.workers.dev/
- 健康检查：https://com2000-api.dappweb.workers.dev/health
- 数据库测试：https://com2000-api.dappweb.workers.dev/api/test/db
- KV 测试：https://com2000-api.dappweb.workers.dev/api/test/kv

所有端点都正常工作，数据库和存储连接正常。