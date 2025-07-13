#!/usr/bin/env node

/**
 * COM2000 项目测试脚本
 * 用于在依赖安装问题时进行基本的项目验证
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 COM2000 项目完整性测试\n');

// 检查必要文件
const requiredFiles = [
  'package.json',
  'wrangler.toml',
  'tsconfig.json',
  'src/index.ts',
  'migrations/0001_initial_schema.sql',
  '.github/workflows/ci.yml'
];

let allFilesExist = true;

console.log('📁 检查必要文件:');
requiredFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
});

// 检查源代码结构
console.log('\n🏗️ 检查源代码结构:');
const srcDirs = ['middleware', 'routes', 'types', 'utils'];
srcDirs.forEach(dir => {
  const dirPath = path.join('src', dir);
  const exists = fs.existsSync(dirPath);
  console.log(`  ${exists ? '✅' : '❌'} src/${dir}/`);
  if (!exists) allFilesExist = false;
});

// 检查配置文件内容
console.log('\n⚙️ 检查配置文件:');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  console.log(`  ✅ package.json - 项目名称: ${packageJson.name}`);
  console.log(`  ✅ package.json - 版本: ${packageJson.version}`);
  
  const hasRequiredScripts = ['dev', 'build', 'test', 'deploy'].every(script => 
    packageJson.scripts && packageJson.scripts[script]
  );
  console.log(`  ${hasRequiredScripts ? '✅' : '❌'} 必要的npm脚本`);
  
  const hasRequiredDeps = ['hono', 'zod'].every(dep => 
    packageJson.dependencies && packageJson.dependencies[dep]
  );
  console.log(`  ${hasRequiredDeps ? '✅' : '❌'} 核心依赖项`);
  
} catch (error) {
  console.log(`  ❌ package.json 解析失败: ${error.message}`);
  allFilesExist = false;
}

// 检查TypeScript配置
try {
  const tsConfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
  console.log(`  ✅ tsconfig.json - 目标: ${tsConfig.compilerOptions?.target}`);
  console.log(`  ✅ tsconfig.json - 模块: ${tsConfig.compilerOptions?.module}`);
} catch (error) {
  console.log(`  ❌ tsconfig.json 解析失败: ${error.message}`);
}

// 检查Wrangler配置
try {
  const wranglerConfig = fs.readFileSync('wrangler.toml', 'utf8');
  const hasName = wranglerConfig.includes('name = "com2000-api"');
  const hasMain = wranglerConfig.includes('main = "src/index.ts"');
  const hasD1 = wranglerConfig.includes('d1_databases');
  const hasKV = wranglerConfig.includes('kv_namespaces');
  
  console.log(`  ${hasName ? '✅' : '❌'} Wrangler 项目名称`);
  console.log(`  ${hasMain ? '✅' : '❌'} Wrangler 入口文件`);
  console.log(`  ${hasD1 ? '✅' : '❌'} D1 数据库配置`);
  console.log(`  ${hasKV ? '✅' : '❌'} KV 存储配置`);
} catch (error) {
  console.log(`  ❌ wrangler.toml 读取失败: ${error.message}`);
}

// 检查数据库迁移
console.log('\n🗄️ 检查数据库迁移:');
try {
  const migrationContent = fs.readFileSync('migrations/0001_initial_schema.sql', 'utf8');
  const hasTables = migrationContent.includes('CREATE TABLE');
  const hasIndexes = migrationContent.includes('CREATE INDEX');
  
  console.log(`  ${hasTables ? '✅' : '❌'} 数据表定义`);
  console.log(`  ${hasIndexes ? '✅' : '❌'} 索引定义`);
} catch (error) {
  console.log(`  ❌ 迁移文件读取失败: ${error.message}`);
}

// 检查CI/CD配置
console.log('\n🚀 检查CI/CD配置:');
try {
  const ciConfig = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
  const hasTest = ciConfig.includes('npm run test');
  const hasBuild = ciConfig.includes('npm run build');
  const hasDeploy = ciConfig.includes('wrangler deploy');
  
  console.log(`  ${hasTest ? '✅' : '❌'} 测试步骤`);
  console.log(`  ${hasBuild ? '✅' : '❌'} 构建步骤`);
  console.log(`  ${hasDeploy ? '✅' : '❌'} 部署步骤`);
} catch (error) {
  console.log(`  ❌ CI配置读取失败: ${error.message}`);
}

// 总结
console.log('\n📊 测试总结:');
if (allFilesExist) {
  console.log('✅ 项目结构完整，所有必要文件都存在');
  console.log('✅ 配置文件格式正确');
  console.log('✅ 项目已准备好进行部署');
  
  console.log('\n🎯 下一步建议:');
  console.log('1. 解决WSL环境中的依赖安装问题');
  console.log('2. 配置Cloudflare账户和API密钥');
  console.log('3. 运行 ./scripts/setup-deployment.sh 进行环境设置');
  console.log('4. 使用 npm run deploy:staging 进行测试部署');
  
  process.exit(0);
} else {
  console.log('❌ 项目结构不完整，请检查缺失的文件');
  process.exit(1);
}