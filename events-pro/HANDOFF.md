# HANDOFF — 2026-07-06

## 项目概况
event-platform-pro 是学友会/校友会共用的活动管理平台（Vue 3 + Hono + Cloudflare Workers + D1）。
单仓库多组织部署：`deploy/cssa/` (学友会) 和 `deploy/cumt/` (矿大校友会)。
部署命令：`npm run deploy:cssa` / `npm run deploy:cumt` / `npm run deploy:all`

GitHub: https://github.com/yyy735934-prog/event-platform-pro

## 本次 session 完成的工作

### 1. GitHub 仓库创建
- 新建了 event-platform-pro 私有仓库并推送了所有历史提交

### 2. 邮件发送 bug 修复
- **问题**：批量邮件用 `waitUntil()` 并发发送，触发 Resend 429 rate limit，部分邮件静默失败但前端显示"全部成功"
- **修复**：改为串行发送 + 550ms 间隔，`sendEmail` 返回成功/失败状态，前端显示真实发送结果
- 涉及文件：`worker/lib/email.js`, `worker/routes/events.js`, `worker/routes/signups.js`

### 3. 邮件日志功能 (新增)
- `email_logs` 表记录每封邮件的收件人、主题、HTML 内容、状态、错误
- 管理后台新增「邮件记录」页面 (`/admin/emails`)，可按活动/状态筛选，点击预览邮件内容
- 涉及文件：`schema.sql`, `admin/src/views/super/EmailLogs.vue` (新文件), `admin/src/router.js`, `admin/src/App.vue`, `admin/src/api.js`

### 4. 邮件配额管理 (新增)
- `getEmailQuota()` 统计当日已发送量，默认上限 100 封/天 (Resend 免费版)
- 后端：批量发送前检查额度不足直接返回 429
- 前端：邮件记录页顶部显示配额进度条，发送弹窗显示剩余额度，额度不足时阻止发送
- 可通过 `wrangler secret put EMAIL_DAILY_LIMIT` 调整上限
- 涉及文件：`worker/lib/email.js`, `worker/routes/events.js`, `admin/src/views/host/EventDetail.vue`, `admin/src/views/super/EmailLogs.vue`

### 5. 龙舟赛通知重发
- 已成功重发 32 封带微信群二维码的通知邮件
- 今日已用 86/100 额度

## 当前状态
- CSSA 已部署最新代码
- CUMT 未部署本次更新（需要先在 CUMT 的 D1 建 email_logs 表再部署）
- 本次改动**尚未 git commit 和 push**

## 待办 / 下一步
- [ ] commit + push 本次改动
- [ ] CUMT 数据库建 email_logs 表 + 部署：`npx wrangler d1 execute cumt-alumni-db --remote --file=schema.sql` 然后 `npm run deploy:cumt`
- [ ] 旧仓库 (event-platform, event-platform-cumt) 可以 archive
- [ ] DeepSeek API key 待 HZNSENDAI 提供 (tohokucssa-homepage AI 帮助功能)

## 关键约束（新 AI 必须知道的）
- 测试邮件一律发 yyy735934@gmail.com，**绝不发** pan.xuanwen.p6@dc.tohoku.ac.jp
- Admin token 在 public JS bundle 里是已知问题，推迟到 Cloudflare Access 后修复
- `my-events` 接口无认证 — 用户明确说不用修
- Google 无门槛注册 — 用户明确说先不修
- Vue 3 script setup 用 `ref()` 不用 `$refs`（反复踩过的坑）
- Resend 免费版限制：100 封/天，2 请求/秒

## 技术栈
- 前端：Vue 3 (script setup) + Vue Router + Vite
- 后端：Hono (Cloudflare Workers)
- 数据库：Cloudflare D1 (SQLite)
- 存储：Cloudflare R2 (图片)
- 会话：Cloudflare KV
- 邮件：Resend API
- Slack：Bot API (自动邀请)
- 部署：`deploy/` 目录下按组织分配 branding.js + wrangler.toml
