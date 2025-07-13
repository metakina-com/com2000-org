# COM2000 技术实施指南

## 🏗️ 架构设计

### 整体架构图
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Cloudflare    │    │   External      │
│   (React SPA)   │◄──►│   Workers API   │◄──►│   Services      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Cloudflare     │    │   Cloudflare    │    │   Blockchain    │
│  Pages          │    │   D1 Database   │    │   Networks      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CDN & Cache   │    │   KV Storage    │    │   Price APIs    │
│   Optimization  │    │   & R2 Bucket   │    │   & Data Feeds  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📁 项目结构重构

### 前端项目结构
```
frontend/
├── public/
│   ├── index.html
│   ├── manifest.json
│   └── assets/
│       ├── icons/
│       ├── images/
│       └── logos/
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Table.tsx
│   │   │   └── index.ts
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Layout.tsx
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   ├── ForgotPassword.tsx
│   │   │   ├── KYCForm.tsx
│   │   │   └── ProfileSettings.tsx
│   │   ├── projects/
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── ProjectList.tsx
│   │   │   ├── ProjectDetail.tsx
│   │   │   ├── ProjectFilters.tsx
│   │   │   └── ProjectSearch.tsx
│   │   ├── ido/
│   │   │   ├── IDOCard.tsx
│   │   │   ├── IDOList.tsx
│   │   │   ├── IDODetail.tsx
│   │   │   ├── InvestmentForm.tsx
│   │   │   ├── InvestmentHistory.tsx
│   │   │   └── IDOProgress.tsx
│   │   ├── incubator/
│   │   │   ├── ApplicationForm.tsx
│   │   │   ├── ApplicationList.tsx
│   │   │   ├── MentorProfile.tsx
│   │   │   ├── ProgressTracker.tsx
│   │   │   └── ResourceCenter.tsx
│   │   ├── wallet/
│   │   │   ├── WalletConnect.tsx
│   │   │   ├── WalletInfo.tsx
│   │   │   ├── TransactionHistory.tsx
│   │   │   └── NetworkSelector.tsx
│   │   ├── admin/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── UserManagement.tsx
│   │   │   ├── ProjectManagement.tsx
│   │   │   ├── IDOManagement.tsx
│   │   │   └── Analytics.tsx
│   │   └── charts/
│   │       ├── PriceChart.tsx
│   │       ├── VolumeChart.tsx
│   │       ├── PortfolioChart.tsx
│   │       └── TrendChart.tsx
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Projects.tsx
│   │   ├── ProjectDetail.tsx
│   │   ├── IDO.tsx
│   │   ├── IDODetail.tsx
│   │   ├── Incubator.tsx
│   │   ├── Portfolio.tsx
│   │   ├── Profile.tsx
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   └── Admin.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useWallet.ts
│   │   ├── useProjects.ts
│   │   ├── useIDO.ts
│   │   ├── useIncubator.ts
│   │   ├── useAPI.ts
│   │   └── useLocalStorage.ts
│   ├── stores/
│   │   ├── authStore.ts
│   │   ├── walletStore.ts
│   │   ├── projectStore.ts
│   │   ├── idoStore.ts
│   │   └── uiStore.ts
│   ├── services/
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   ├── wallet.ts
│   │   ├── projects.ts
│   │   ├── ido.ts
│   │   └── incubator.ts
│   ├── utils/
│   │   ├── constants.ts
│   │   ├── helpers.ts
│   │   ├── validation.ts
│   │   ├── formatting.ts
│   │   └── blockchain.ts
│   ├── types/
│   │   ├── auth.ts
│   │   ├── project.ts
│   │   ├── ido.ts
│   │   ├── incubator.ts
│   │   ├── wallet.ts
│   │   └── api.ts
│   ├── styles/
│   │   ├── globals.css
│   │   ├── components.css
│   │   └── utilities.css
│   ├── i18n/
│   │   ├── index.ts
│   │   ├── en.json
│   │   ├── zh.json
│   │   └── ja.json
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

### 后端项目结构扩展
```
src/
├── routes/
│   ├── auth.ts          # 认证路由
│   ├── users.ts         # 用户管理
│   ├── projects.ts      # 项目管理
│   ├── ido.ts          # IDO 管理
│   ├── incubator.ts    # 孵化器
│   ├── kyc.ts          # KYC 验证
│   ├── admin.ts        # 管理后台
│   ├── analytics.ts    # 数据分析
│   ├── notifications.ts # 通知系统
│   ├── compliance.ts   # 合规性
│   ├── prices.ts       # 价格数据
│   └── health.ts       # 健康检查
├── middleware/
│   ├── auth.ts         # 认证中间件
│   ├── rateLimiter.ts  # 速率限制
│   ├── errorHandler.ts # 错误处理
│   ├── validation.ts   # 数据验证
│   ├── cors.ts         # CORS 处理
│   ├── logging.ts      # 日志记录
│   └── security.ts     # 安全中间件
├── services/
│   ├── auth/
│   │   ├── jwt.ts
│   │   ├── oauth.ts
│   │   └── session.ts
│   ├── blockchain/
│   │   ├── ethereum.ts
│   │   ├── bsc.ts
│   │   ├── polygon.ts
│   │   └── wallet.ts
│   ├── external/
│   │   ├── priceAPI.ts
│   │   ├── kycProvider.ts
│   │   ├── emailService.ts
│   │   └── smsService.ts
│   ├── database/
│   │   ├── queries.ts
│   │   ├── migrations.ts
│   │   └── seeds.ts
│   └── cache/
│       ├── redis.ts
│       ├── kv.ts
│       └── strategies.ts
├── utils/
│   ├── crypto.ts       # 加密工具
│   ├── validation.ts   # 验证工具
│   ├── database.ts     # 数据库工具
│   ├── formatting.ts   # 格式化工具
│   ├── constants.ts    # 常量定义
│   ├── helpers.ts      # 辅助函数
│   └── logger.ts       # 日志工具
├── types/
│   ├── env.ts          # 环境类型
│   ├── auth.ts         # 认证类型
│   ├── project.ts      # 项目类型
│   ├── ido.ts          # IDO 类型
│   ├── incubator.ts    # 孵化器类型
│   ├── kyc.ts          # KYC 类型
│   ├── admin.ts        # 管理类型
│   └── api.ts          # API 类型
├── jobs/
│   ├── priceUpdater.ts # 价格更新任务
│   ├── dataSync.ts     # 数据同步任务
│   ├── cleanup.ts      # 清理任务
│   └── reports.ts      # 报告生成任务
├── config/
│   ├── database.ts     # 数据库配置
│   ├── cache.ts        # 缓存配置
│   ├── blockchain.ts   # 区块链配置
│   └── external.ts     # 外部服务配置
├── index.ts            # 主入口
└── index-simple.ts     # 简化版本
```

## 🔧 核心功能实现

### 1. 用户认证系统

#### JWT Token 管理
```typescript
// src/services/auth/jwt.ts
import { sign, verify } from '@tsndr/cloudflare-worker-jwt';

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'user' | 'admin' | 'moderator';
  kycStatus: 'pending' | 'verified' | 'rejected';
  iat: number;
  exp: number;
}

export class JWTService {
  constructor(private secret: string) {}

  async generateTokens(payload: Omit<JWTPayload, 'iat' | 'exp'>) {
    const now = Math.floor(Date.now() / 1000);
    
    const accessToken = await sign({
      ...payload,
      iat: now,
      exp: now + (15 * 60) // 15 minutes
    }, this.secret);

    const refreshToken = await sign({
      userId: payload.userId,
      type: 'refresh',
      iat: now,
      exp: now + (7 * 24 * 60 * 60) // 7 days
    }, this.secret);

    return { accessToken, refreshToken };
  }

  async verifyToken(token: string): Promise<JWTPayload | null> {
    try {
      const isValid = await verify(token, this.secret);
      if (!isValid) return null;
      
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload;
    } catch {
      return null;
    }
  }
}
```

#### 认证中间件增强
```typescript
// src/middleware/auth.ts
import { Context, Next } from 'hono';
import { JWTService } from '../services/auth/jwt';

export const authMiddleware = (required = true) => {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      if (required) {
        return c.json({ error: 'Authentication required' }, 401);
      }
      await next();
      return;
    }

    const jwtService = new JWTService(c.env.JWT_SECRET);
    const payload = await jwtService.verifyToken(token);

    if (!payload) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    // Check token expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return c.json({ error: 'Token expired' }, 401);
    }

    c.set('user', payload);
    await next();
  };
};

export const adminOnly = async (c: Context, next: Next) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }
  await next();
};

export const kycRequired = async (c: Context, next: Next) => {
  const user = c.get('user');
  if (!user || user.kycStatus !== 'verified') {
    return c.json({ error: 'KYC verification required' }, 403);
  }
  await next();
};
```

### 2. 钱包连接系统

#### 前端钱包管理
```typescript
// frontend/src/hooks/useWallet.ts
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  balance: string | null;
  chainId: number | null;
  provider: ethers.providers.Web3Provider | null;
}

export const useWallet = () => {
  const [wallet, setWallet] = useState<WalletState>({
    isConnected: false,
    address: null,
    balance: null,
    chainId: null,
    provider: null
  });

  const connectMetaMask = async () => {
    if (!window.ethereum) {
      throw new Error('MetaMask not installed');
    }

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      const balance = await provider.getBalance(address);
      const network = await provider.getNetwork();

      setWallet({
        isConnected: true,
        address,
        balance: ethers.utils.formatEther(balance),
        chainId: network.chainId,
        provider
      });

      // Store connection in localStorage
      localStorage.setItem('walletConnected', 'true');
      localStorage.setItem('walletAddress', address);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  };

  const disconnect = () => {
    setWallet({
      isConnected: false,
      address: null,
      balance: null,
      chainId: null,
      provider: null
    });
    localStorage.removeItem('walletConnected');
    localStorage.removeItem('walletAddress');
  };

  const switchNetwork = async (chainId: number) => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }]
      });
    } catch (error: any) {
      if (error.code === 4902) {
        // Network not added, add it
        await addNetwork(chainId);
      }
    }
  };

  const addNetwork = async (chainId: number) => {
    const networks = {
      56: {
        chainId: '0x38',
        chainName: 'Binance Smart Chain',
        nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
        rpcUrls: ['https://bsc-dataseed.binance.org/'],
        blockExplorerUrls: ['https://bscscan.com/']
      },
      137: {
        chainId: '0x89',
        chainName: 'Polygon',
        nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
        rpcUrls: ['https://polygon-rpc.com/'],
        blockExplorerUrls: ['https://polygonscan.com/']
      }
    };

    const network = networks[chainId as keyof typeof networks];
    if (!network) return;

    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [network]
    });
  };

  // Auto-connect on page load
  useEffect(() => {
    const autoConnect = async () => {
      const wasConnected = localStorage.getItem('walletConnected');
      if (wasConnected && window.ethereum) {
        try {
          await connectMetaMask();
        } catch (error) {
          console.error('Auto-connect failed:', error);
        }
      }
    };

    autoConnect();
  }, []);

  return {
    wallet,
    connectMetaMask,
    disconnect,
    switchNetwork
  };
};
```

### 3. KYC 验证系统

#### KYC 数据模型
```sql
-- migrations/0002_kyc_system.sql
CREATE TABLE IF NOT EXISTS kyc_verifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    verification_level TEXT CHECK (verification_level IN ('basic', 'advanced', 'institutional')) DEFAULT 'basic',
    status TEXT CHECK (status IN ('pending', 'under_review', 'verified', 'rejected', 'expired')) DEFAULT 'pending',
    
    -- Personal Information
    first_name TEXT,
    last_name TEXT,
    date_of_birth TEXT,
    nationality TEXT,
    
    -- Address Information
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state_province TEXT,
    postal_code TEXT,
    country TEXT,
    
    -- Documents
    identity_document_type TEXT, -- 'passport', 'drivers_license', 'national_id'
    identity_document_number TEXT,
    identity_document_front TEXT, -- R2 bucket URL
    identity_document_back TEXT,
    proof_of_address TEXT,
    selfie_with_document TEXT,
    
    -- Verification Details
    verification_notes TEXT,
    verified_by TEXT, -- admin user ID
    verified_at INTEGER,
    expires_at INTEGER,
    rejection_reason TEXT,
    
    -- Metadata
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_kyc_user_id ON kyc_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON kyc_verifications(status);
CREATE INDEX IF NOT EXISTS idx_kyc_level ON kyc_verifications(verification_level);
CREATE INDEX IF NOT EXISTS idx_kyc_created_at ON kyc_verifications(created_at DESC);
```

#### KYC API 路由
```typescript
// src/routes/kyc.ts
import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { uploadToR2 } from '../utils/storage';

const kyc = new Hono();

const kycSubmissionSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nationality: z.string().length(2), // ISO country code
  addressLine1: z.string().min(1).max(100),
  addressLine2: z.string().max(100).optional(),
  city: z.string().min(1).max(50),
  stateProvince: z.string().max(50),
  postalCode: z.string().min(1).max(20),
  country: z.string().length(2),
  identityDocumentType: z.enum(['passport', 'drivers_license', 'national_id']),
  identityDocumentNumber: z.string().min(1).max(50)
});

// Submit KYC application
kyc.post('/submit', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const data = kycSubmissionSchema.parse(body);

    // Check if user already has pending/verified KYC
    const existing = await c.env.DB.prepare(`
      SELECT id, status FROM kyc_verifications 
      WHERE user_id = ? AND status IN ('pending', 'under_review', 'verified')
      ORDER BY created_at DESC LIMIT 1
    `).bind(user.userId).first();

    if (existing) {
      if (existing.status === 'verified') {
        return c.json({ error: 'KYC already verified' }, 400);
      }
      if (existing.status === 'pending' || existing.status === 'under_review') {
        return c.json({ error: 'KYC application already in progress' }, 400);
      }
    }

    const kycId = crypto.randomUUID();
    const now = Date.now();

    await c.env.DB.prepare(`
      INSERT INTO kyc_verifications (
        id, user_id, verification_level, status,
        first_name, last_name, date_of_birth, nationality,
        address_line1, address_line2, city, state_province, postal_code, country,
        identity_document_type, identity_document_number,
        ip_address, user_agent, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      kycId, user.userId, 'basic', 'pending',
      data.firstName, data.lastName, data.dateOfBirth, data.nationality,
      data.addressLine1, data.addressLine2 || null, data.city, data.stateProvince, data.postalCode, data.country,
      data.identityDocumentType, data.identityDocumentNumber,
      c.req.header('CF-Connecting-IP'), c.req.header('User-Agent'),
      now, now
    ).run();

    return c.json({
      success: true,
      kycId,
      status: 'pending',
      message: 'KYC application submitted successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid data', details: error.errors }, 400);
    }
    throw error;
  }
});

// Upload KYC documents
kyc.post('/upload/:kycId', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');
    const kycId = c.req.param('kycId');
    const formData = await c.req.formData();

    // Verify KYC belongs to user
    const kycRecord = await c.env.DB.prepare(`
      SELECT id, status FROM kyc_verifications 
      WHERE id = ? AND user_id = ?
    `).bind(kycId, user.userId).first();

    if (!kycRecord) {
      return c.json({ error: 'KYC record not found' }, 404);
    }

    if (kycRecord.status !== 'pending') {
      return c.json({ error: 'Cannot upload documents for this KYC status' }, 400);
    }

    const uploads: Record<string, string> = {};
    const allowedTypes = ['identity_document_front', 'identity_document_back', 'proof_of_address', 'selfie_with_document'];

    for (const [key, file] of formData.entries()) {
      if (allowedTypes.includes(key) && file instanceof File) {
        // Validate file type and size
        if (!file.type.startsWith('image/')) {
          return c.json({ error: `Invalid file type for ${key}` }, 400);
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
          return c.json({ error: `File too large for ${key}` }, 400);
        }

        const fileName = `kyc/${kycId}/${key}_${Date.now()}.${file.type.split('/')[1]}`;
        const url = await uploadToR2(c.env.ASSETS, fileName, file);
        uploads[key] = url;
      }
    }

    if (Object.keys(uploads).length === 0) {
      return c.json({ error: 'No valid files uploaded' }, 400);
    }

    // Update KYC record with document URLs
    const updateFields = Object.keys(uploads).map(key => `${key} = ?`).join(', ');
    const updateValues = Object.values(uploads);
    
    await c.env.DB.prepare(`
      UPDATE kyc_verifications 
      SET ${updateFields}, status = 'under_review', updated_at = ?
      WHERE id = ?
    `).bind(...updateValues, Date.now(), kycId).run();

    return c.json({
      success: true,
      uploads,
      status: 'under_review',
      message: 'Documents uploaded successfully'
    });
  } catch (error) {
    console.error('KYC upload error:', error);
    return c.json({ error: 'Upload failed' }, 500);
  }
});

// Get KYC status
kyc.get('/status', authMiddleware(), async (c) => {
  const user = c.get('user');
  
  const kycRecord = await c.env.DB.prepare(`
    SELECT id, verification_level, status, verified_at, expires_at, rejection_reason, created_at
    FROM kyc_verifications 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 1
  `).bind(user.userId).first();

  if (!kycRecord) {
    return c.json({
      hasKYC: false,
      status: null,
      message: 'No KYC application found'
    });
  }

  return c.json({
    hasKYC: true,
    kycId: kycRecord.id,
    level: kycRecord.verification_level,
    status: kycRecord.status,
    verifiedAt: kycRecord.verified_at,
    expiresAt: kycRecord.expires_at,
    rejectionReason: kycRecord.rejection_reason,
    submittedAt: kycRecord.created_at
  });
});

export default kyc;
```

### 4. 项目孵化器系统

#### 孵化器数据模型
```sql
-- migrations/0003_incubator.sql
CREATE TABLE IF NOT EXISTS incubator_applications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    project_name TEXT NOT NULL,
    project_description TEXT NOT NULL,
    project_category TEXT NOT NULL,
    
    -- Team Information
    team_size INTEGER,
    team_members TEXT, -- JSON array
    founder_background TEXT,
    
    -- Project Details
    problem_statement TEXT,
    solution_description TEXT,
    target_market TEXT,
    business_model TEXT,
    competitive_advantage TEXT,
    
    -- Technical Details
    technology_stack TEXT,
    development_stage TEXT CHECK (development_stage IN ('idea', 'prototype', 'mvp', 'beta', 'production')),
    github_repository TEXT,
    demo_url TEXT,
    whitepaper_url TEXT,
    
    -- Funding Information
    funding_required REAL,
    funding_purpose TEXT,
    previous_funding REAL DEFAULT 0,
    revenue_model TEXT,
    
    -- Application Status
    status TEXT CHECK (status IN ('submitted', 'under_review', 'accepted', 'rejected', 'graduated')) DEFAULT 'submitted',
    review_notes TEXT,
    reviewed_by TEXT,
    reviewed_at INTEGER,
    
    -- Program Details (if accepted)
    program_start_date INTEGER,
    program_end_date INTEGER,
    assigned_mentor TEXT,
    milestone_plan TEXT, -- JSON array
    
    -- Metadata
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS incubator_mentors (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    title TEXT,
    company TEXT,
    bio TEXT,
    expertise_areas TEXT, -- JSON array
    linkedin_url TEXT,
    twitter_url TEXT,
    availability_status TEXT CHECK (availability_status IN ('available', 'busy', 'unavailable')) DEFAULT 'available',
    max_mentees INTEGER DEFAULT 3,
    current_mentees INTEGER DEFAULT 0,
    rating REAL DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS incubator_milestones (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    due_date INTEGER,
    status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')) DEFAULT 'pending',
    completion_date INTEGER,
    mentor_feedback TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    FOREIGN KEY (application_id) REFERENCES incubator_applications(id)
);

CREATE TABLE IF NOT EXISTS incubator_resources (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    resource_type TEXT CHECK (resource_type IN ('document', 'video', 'tool', 'template', 'contact')) NOT NULL,
    resource_url TEXT,
    category TEXT,
    access_level TEXT CHECK (access_level IN ('public', 'applicant', 'accepted', 'mentor')) DEFAULT 'public',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_incubator_applications_user_id ON incubator_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_incubator_applications_status ON incubator_applications(status);
CREATE INDEX IF NOT EXISTS idx_incubator_applications_category ON incubator_applications(project_category);
CREATE INDEX IF NOT EXISTS idx_incubator_mentors_availability ON incubator_mentors(availability_status);
CREATE INDEX IF NOT EXISTS idx_incubator_milestones_application ON incubator_milestones(application_id);
CREATE INDEX IF NOT EXISTS idx_incubator_milestones_status ON incubator_milestones(status);
```

## 🚀 部署和运维

### Cloudflare 配置

#### wrangler.toml 完整配置
```toml
name = "com2000-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# Environment variables
[env.production.vars]
ENVIRONMENT = "production"
API_VERSION = "1.0.0"
CORS_ORIGINS = "https://com2000.org,https://app.com2000.org"
CACHE_TTL_PROJECTS = "300"
CACHE_TTL_PRICES = "60"
CACHE_TTL_IDO = "120"

[env.staging.vars]
ENVIRONMENT = "staging"
API_VERSION = "1.0.0-staging"
CORS_ORIGINS = "https://staging.com2000.org"
CACHE_TTL_PROJECTS = "60"
CACHE_TTL_PRICES = "30"
CACHE_TTL_IDO = "60"

[env.development.vars]
ENVIRONMENT = "development"
API_VERSION = "1.0.0-dev"
CORS_ORIGINS = "http://localhost:3000,http://localhost:5173"
CACHE_TTL_PROJECTS = "30"
CACHE_TTL_PRICES = "15"
CACHE_TTL_IDO = "30"

# Database bindings
[[env.production.d1_databases]]
binding = "DB"
database_name = "com2000-production"
database_id = "your-production-db-id"

[[env.staging.d1_databases]]
binding = "DB"
database_name = "com2000-staging"
database_id = "your-staging-db-id"

[[env.development.d1_databases]]
binding = "DB"
database_name = "com2000-development"
database_id = "your-development-db-id"

# KV bindings
[[env.production.kv_namespaces]]
binding = "SESSION_STORE"
id = "your-session-kv-id"
preview_id = "your-session-kv-preview-id"

[[env.production.kv_namespaces]]
binding = "PROJECT_CACHE"
id = "your-project-cache-kv-id"
preview_id = "your-project-cache-kv-preview-id"

[[env.production.kv_namespaces]]
binding = "RATE_LIMITER"
id = "your-rate-limiter-kv-id"
preview_id = "your-rate-limiter-kv-preview-id"

# R2 bindings
[[env.production.r2_buckets]]
binding = "ASSETS"
bucket_name = "com2000-assets"
preview_bucket_name = "com2000-assets-preview"

# Cron triggers
[[env.production.triggers]]
crons = ["0 */5 * * * *"]  # Every 5 minutes - price updates

[[env.production.triggers]]
crons = ["0 */15 * * * *"] # Every 15 minutes - trending updates

[[env.production.triggers]]
crons = ["0 0 * * * *"]   # Every hour - cleanup

[[env.production.triggers]]
crons = ["0 0 0 * * *"]   # Daily - reports
```

### CI/CD 流水线

#### GitHub Actions 工作流
```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Run linting
        run: npm run lint
      
      - name: Type check
        run: npm run type-check

  deploy-api:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Deploy to Cloudflare Workers
        run: npx wrangler deploy --env production
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          cd frontend
          npm ci
      
      - name: Build frontend
        run: |
          cd frontend
          npm run build
        env:
          VITE_API_URL: https://api.com2000.org
          VITE_ENVIRONMENT: production
      
      - name: Deploy to Cloudflare Pages
        run: |
          cd frontend
          npx wrangler pages deploy dist --project-name=com2000-frontend
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

  migrate-database:
    needs: [deploy-api]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Run database migrations
        run: |
          npx wrangler d1 migrations apply com2000-production --env production
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

### 监控和日志

#### 错误监控集成
```typescript
// src/utils/monitoring.ts
export class MonitoringService {
  constructor(private env: Env) {}

  async logError(error: Error, context: any = {}) {
    const errorLog = {
      id: crypto.randomUUID(),
      error_type: error.name,
      error_message: error.message,
      stack_trace: error.stack,
      context: JSON.stringify(context),
      timestamp: Date.now()
    };

    // Store in D1 database
    await this.env.DB.prepare(`
      INSERT INTO error_logs (id, error_type, error_message, stack_trace, request_id, user_id, endpoint, method, ip_address, user_agent, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      errorLog.id,
      errorLog.error_type,
      errorLog.error_message,
      errorLog.stack_trace,
      context.requestId,
      context.userId,
      context.endpoint,
      context.method,
      context.ipAddress,
      context.userAgent,
      errorLog.timestamp
    ).run();

    // Send to external monitoring service (optional)
    if (this.env.SENTRY_DSN) {
      await this.sendToSentry(error, context);
    }
  }

  async logMetric(name: string, value: number, type: 'counter' | 'gauge' | 'histogram', labels: any = {}) {
    await this.env.DB.prepare(`
      INSERT INTO system_metrics (id, metric_name, metric_value, metric_type, labels, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      name,
      value,
      type,
      JSON.stringify(labels),
      Date.now()
    ).run();
  }

  private async sendToSentry(error: Error, context: any) {
    // Implement Sentry integration
    // This would typically use the Sentry SDK
  }
}
```

---

这个技术实施指南提供了详细的代码结构、实现方案和部署配置。接下来可以按照这个指南逐步实现各个功能模块。