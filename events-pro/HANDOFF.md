# HANDOFF — 2026-07-07

## 项目概况
event-platform-pro 是学友会/校友会共用的活动管理平台（Vue 3 + Hono + Cloudflare Workers + D1）。
单仓库多组织部署：`deploy/cssa/` (学友会) 和 `deploy/cumt/` (矿大校友会)。
部署命令：`npm run deploy:cssa` / `npm run deploy:cumt` / `npm run deploy:all`

GitHub: https://github.com/yyy735934-prog/event-platform-pro

- CSSA 线上：https://events.tohokucssa.org （自定义域名）
- CUMT 线上：https://cumt-alumni.2026zyh.workers.dev （workers.dev 共享域，见待办）

---

## 本次 session（07-07）完成的工作

### 1. CUMT 部署邮件功能（补上个待办）
- 已在 CUMT 远程 D1 建 `email_logs` 表并部署，CUMT 后台「邮件记录」页可用

### 2. CUMT 会长账号 = 超级管理员
- 直接写入 CUMT 数据库：`REDACTED-EMAIL`，`role=reviewer` + `is_super=1`，display_name「会长」
- **初始密码 `REDACTED-PASSWORD`**（邮箱密码 / Google 登录均可，登录后应尽快自行修改）
- 平台没有独立“超管”角色，最高权限 = `role=reviewer` + `is_super=1`
- 已核对：Google 登录、邀请注册流程都不会降级 is_super

### 3. 社交分享卡片（og meta + logo）
- `web/vite.config.js` 加构建时插件：按各组织 branding 注入 `<title>` + og 标签到静态 HTML
- branding 新增字段 `description`、`ogImage`（CSSA 已填 `/logo.png`，CUMT 留空）
- CSSA logo 处理成 600×600 白底方图 `web/public/logo.png`，同时作为 favicon
- ⚠️ **微信聊天里直接粘贴链接不显示卡片**（微信策略，无解）；浏览器分享/QQ/飞书/Edge 转发可正常显示卡片。微信内 100% 可控卡片需 JS-SDK + 公众号 + 备案域名

### 4. 角色申请引导文案
- `admin/src/App.vue`：普通用户看到「申请成为管理员（含主理人权限）」+ 一行说明，避免重复申请主理人

### 5. 审核员自动通过 bug 修复
- 之前**任何审核员**提交自己的草稿会自动通过（曾导致三个同学的活动被误直接结束）
- 改为 `worker/routes/events.js` submit：**只有 `is_super` 自动通过**，普通审核员进 pending 走人工审核

### 6. 活动回退到草稿功能（新增）
- 新接口 `POST /events/:id/revert`：审核员/超管可把**没有报名、没有签到**的活动从任意状态回退到 draft
- 前端活动详情页加橙色「回退到编辑」按钮（`admin/src/views/host/EventDetail.vue`）
- 有报名/签到会被拦下并提示

### 7. 满员状态一致性修复
- 「锁定报名」= 把当前报名数写进 `lock_at` 当上限；满员判断口径全站统一为 `capacity || lock_at` vs `signupCount`
- 修复活动广场/报名页/「我创建的活动」：锁定/满员时一致显示红色「报名已满」
- 「参加的活动」区保留活动阶段标签（对已报名者语义正确，故意不改）

### 8. Git
- 以上代码改动已拆成 5 个 commit 并 push 到 GitHub main（`af98e4c..15aa58c`）
- CSSA 已部署全部改动

---

## 当前状态
- **CSSA**：代码库 / 线上 / GitHub 三者对齐，全部最新
- **CUMT**：已部署到「邮件功能 + 会长账号」；**本次 3~7 的前端/后端改动尚未部署到 CUMT**（共享代码，需 `npm run deploy:cumt`）

## 待办 / 下一步
- [ ] 同步本次改动到 CUMT：`npm run deploy:cumt`（用户说 CUMT 随意，按需）
- [ ] 提醒会长登录后修改初始密码 `REDACTED-PASSWORD`
- [ ] CUMT 换独立域名（脱离 workers.dev，最能降低微信拦截 + 显正规；不需备案）
- [ ] 旧仓库 (event-platform, event-platform-cumt) 可以 archive
- [ ] DeepSeek API key 待 HZNSENDAI 提供 (tohokucssa-homepage AI 帮助功能)

## 关键约束（新 AI 必须知道的）
- 测试邮件一律发 yyy735934@gmail.com，**绝不发** pan.xuanwen.p6@dc.tohoku.ac.jp
- 最高权限 = `role=reviewer` + `is_super=1`；只有 is_super 自己的活动自动通过审核
- 「锁定报名」复用 `lock_at` 字段存锁定时的报名数；满员口径 = `capacity || lock_at`
- 微信聊天粘贴外链不出卡片是微信策略，非配置问题；要卡片走浏览器分享或上公众号+备案
- Admin token 在 public JS bundle 里是已知问题，推迟到 Cloudflare Access 后修复
- `my-events` 接口无认证 — 用户明确说不用修
- Google 无门槛注册 — 用户明确说先不修
- Vue 3 script setup 用 `ref()` 不用 `$refs`（反复踩过的坑）
- Resend 免费版限制：100 封/天，2 请求/秒
- 根目录 `branding.js` 是部署时从 `deploy/<org>/` 复制的构建产物（已 gitignore），改配置改 `deploy/` 下的源文件

## 技术栈
- 前端：Vue 3 (script setup) + Vue Router + Vite
- 后端：Hono (Cloudflare Workers)
- 数据库：Cloudflare D1 (SQLite)
- 存储：Cloudflare R2 (图片)
- 会话：Cloudflare KV
- 邮件：Resend API
- Slack：Bot API (自动邀请)
- 部署：`deploy/` 目录下按组织分配 branding.js + wrangler.toml
