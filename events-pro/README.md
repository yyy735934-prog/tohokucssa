# 活动管理平台（白标版）

面向学校/学生组织的一站式活动管理平台。基于 Cloudflare Workers 全家桶（D1 + KV + R2 + Workers AI），零服务器运维，免费额度内可支撑中小型组织日常使用。

## 功能一览

- **活动全流程**：草稿 → 提交审核 → 审核通过开放报名 → 开始活动（签到模式）→ 结束
- **角色体系**：普通用户 / 活动主理人 / 审核管理员 / 超级管理员，支持角色申请-审批流
- **登录方式**：邮箱密码 + Google OAuth（自动注册）
- **报名管理**：自定义报名字段、人数上限、手动锁定报名、邀请报名（邮件/链接/代填）
- **签到**：二维码扫码签到 + 邮箱兜底签到，活动前一天自动邮件发送签到码（cron）
- **通知**：报名确认 / 活动提醒 / 变更通知 / 审核结果 / 角色变更，站内铃铛 + 邮件双通道
- **AI 计划书**：根据活动信息一键生成九节结构的活动计划书草稿（Workers AI）
- **数据**：报名数据 CSV/JSON 导出、数据总览仪表盘、操作审计日志

## 给新客户部署（约 15 分钟）

### 1. 改品牌配置

编辑根目录 [branding.js](branding.js)：平台名称、组织名、部署域名、学校列表。

### 2. 创建 Cloudflare 资源

```bash
npx wrangler d1 create <客户名>-db          # 记下 database_id
npx wrangler kv namespace create SESSIONS  # 记下 id
npx wrangler r2 bucket create <客户名>-images
```

### 3. 改 wrangler.toml

把所有 `change-me` 占位符换成上一步的实际值，详见文件头部注释。

### 4. 建表 + 部署

```bash
npx wrangler d1 execute <客户名>-db --remote --file=schema.sql
npm install
npm run deploy
```

### 5. 配置密钥

```bash
npx wrangler secret put RESEND_API_KEY    # resend.com 邮件服务
npx wrangler secret put EMAIL_FROM        # 如: 活动平台 <no-reply@客户域名>
npx wrangler secret put GOOGLE_CLIENT_ID  # 谷歌登录（可选）
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

### 6. 初始化超级管理员

首次访问 `/admin/login`，用任意邮箱+密码登录会自动创建第一个账号；
然后在 D1 里把该账号提升为超级管理员：

```bash
npx wrangler d1 execute <客户名>-db --remote \
  --command "UPDATE admin_users SET role='reviewer', is_super=1 WHERE email='客户管理员邮箱'"
```

## 本地开发

```bash
npm install
npx wrangler dev          # 后端 :8787
npm run dev:web           # 公开前端
npm run dev:admin         # 管理后台
```

## 项目结构

```
branding.js      ← 品牌配置（每客户唯一需要改的代码文件）
wrangler.toml    ← 部署配置（每客户改资源 ID）
schema.sql       ← 完整数据库结构
worker/          ← Hono 后端（路由/邮件/AI/定时任务）
web/             ← 公开前端（活动广场/报名/我的）
admin/           ← 管理后台（活动管理/审核/用户管理）
```
