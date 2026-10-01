# 東北地区中国学友会 — 协作者开发指南

## 项目全局架构

学友会平台由多个独立子项目组成，各自独立开发和部署，统一在 `tohokucssa.org` 域名下：

| 子项目 | 域名 | GitHub 仓库 | 说明 |
|--------|------|-------------|------|
| 活动管理平台 | `events.tohokucssa.org` | （管理员维护） | 活动发布、报名、签到 |
| 生活服务中心 | `services.tohokucssa.org` | `yyy735934-prog/tohokucssa-services` | 校车查询、生活指南、应急信息 |
| 二手信息平台 | `market.tohokucssa.org` | 协作者 A 自建 | 闲置物品发布与浏览 |
| 物资租赁 | `rental.tohokucssa.org` | `yyy735934-prog/tohoku-rental` | 桌游/露营/汉服/车辆借用 |

每个子项目 = 一个 GitHub 仓库 + 一个 Cloudflare Pages 部署。协作者各自负责自己的子项目，独立开发、独立部署。

## 分工与上手方式

### 协作者 A — 二手信息平台（独立子项目）
- **仓库**：你自己在 GitHub 上创建
- **域名**：`market.tohokucssa.org`
- **做什么**：继续完善你已有的 Next.js 二手平台代码，自己建仓库推代码
- **上手**：把你的项目目录 `git init` → `git add .` → `git commit` → `gh repo create` → `git push`
- **部署**：用管理员提供的 Cloudflare Token 部署（见下方"部署到线上"章节）

### 协作者 B — 生活服务中心框架维护
- **仓库**：`yyy735934-prog/tohokucssa-services`
- **分支**：`feature/services-framework`
- **域名**：`services.tohokucssa.org`
- **做什么**：维护整体框架、首页体验、审核合并 C 和 E 的 PR、部署上线
- **上手**：
```bash
git clone https://github.com/yyy735934-prog/tohokucssa-services.git
cd tohokucssa-services
git checkout feature/services-framework
cat TASK.md    # 阅读详细任务说明
npm install && npm run dev
```

### 协作者 C — 生活指南内容填充
- **仓库**：`yyy735934-prog/tohokucssa-services`（fork 或直接在分支上改）
- **分支**：`feature/local-guide`
- **做什么**：补充医疗/租房/VPN/驾照/美食各板块的具体内容
- **上手**：
```bash
git clone https://github.com/yyy735934-prog/tohokucssa-services.git
cd tohokucssa-services
git checkout feature/local-guide
cat TASK.md    # 阅读详细任务说明
npm install && npm run dev
# 主要编辑 src/views/LocalGuide.vue
```

### 协作者 D — 物资租赁系统（独立子项目）
- **仓库**：`yyy735934-prog/tohoku-rental`
- **域名**：`rental.tohokucssa.org`
- **做什么**：实现完整的物资借用预约系统（前端 + 后端 + 数据库）
- **上手**：
```bash
git clone https://github.com/yyy735934-prog/tohoku-rental.git
cd tohoku-rental
cat TASK.md    # 阅读详细任务说明（含数据库设计、API 规范）
npm install && npm run dev
```

### 协作者 E — 灾害应急 + 新生指南
- **仓库**：`yyy735934-prog/tohokucssa-services`（fork 或直接在分支上改）
- **分支**：`feature/emergency-newcomer`
- **做什么**：完善灾害应急页面、新建新生入学指南页面
- **上手**：
```bash
git clone https://github.com/yyy735934-prog/tohokucssa-services.git
cd tohokucssa-services
git checkout feature/emergency-newcomer
cat TASK.md    # 阅读详细任务说明
npm install && npm run dev
# 主要编辑 src/views/Emergency.vue，新建 src/views/NewcomerGuide.vue
```

### 使用 AI（ChatGPT / Claude）辅助开发

每个分支和子项目里都有一份 `TASK.md`，里面写了完整的任务说明、技术细节和示例代码。
你可以直接把 `TASK.md` 的内容发给 AI，让它帮你写代码。AI 改完文件后，回到终端提交即可。

---

## 你需要准备的工具

1. **Git** — 代码版本管理
2. **Node.js**（v18+）— 运行项目
3. **GitHub 账号** — 托管代码
4. **GitHub CLI**（推荐，非必须）— 命令行操作 GitHub

### 安装 GitHub CLI（可选但推荐）

```bash
# macOS
brew install gh

# Windows
winget install GitHub.cli

# 登录
gh auth login
```

---

## 第一步：初始化你的项目并推送到 GitHub

如果你的代码目前还是本地文件夹（没有 git），按以下步骤操作：

```bash
# 1. 进入你的项目目录
cd 你的项目文件夹

# 2. 初始化 git 仓库
git init

# 3. 创建 .gitignore（如果没有的话）
echo "node_modules\ndist\n.DS_Store\n*.local\n.env\n.env.*" > .gitignore

# 4. 提交所有代码
git add .
git commit -m "feat: initial commit"

# 5. 在 GitHub 上创建仓库并推送（二选一）

# 方式 A：用 GitHub CLI（推荐，一条命令搞定）
gh repo create tohoku-market --public --source=. --push

# 方式 B：手动操作
#   → 去 github.com 手动创建仓库
#   → 然后执行：
git remote add origin https://github.com/你的用户名/tohoku-market.git
git push -u origin main
```

完成后你的代码就在 GitHub 上了。

---

## 第二步：日常开发流程

每次写完代码，三行命令提交并推送：

```bash
git add .
git commit -m "简要描述你改了什么"
git push
```

### 提交信息写法参考

```
feat: 添加物品发布表单
fix: 修复图片上传失败的问题
docs: 更新 README
style: 调整卡片间距
```

### 如果你用 ChatGPT / Claude 写代码

AI 帮你改完文件后，回到终端执行上面三行就行。不需要手动复制粘贴文件。

---

## 第三步：部署到线上

所有子项目统一部署到学友会的 Cloudflare 账户，这样域名、数据库、存储都由学友会统一管理。

### 首次配置（只需做一次）

你会收到两个值（由管理员提供，请勿外泄）：

- `CLOUDFLARE_API_TOKEN` — 部署权限令牌
- `CLOUDFLARE_ACCOUNT_ID` — 学友会的账户 ID

在终端设置环境变量：

```bash
# macOS / Linux —— 加到 ~/.zshrc 或 ~/.bashrc
export CLOUDFLARE_API_TOKEN=收到的token值
export CLOUDFLARE_ACCOUNT_ID=收到的账户ID

# 加完后执行
source ~/.zshrc

# Windows PowerShell
$env:CLOUDFLARE_API_TOKEN="收到的token值"
$env:CLOUDFLARE_ACCOUNT_ID="收到的账户ID"
```

### 每次部署

```bash
# 构建
npm run build

# 部署（项目名替换成你自己的）
npx wrangler pages deploy dist --project-name=你的项目名
```

例如二手平台：

```bash
npx wrangler pages deploy dist --project-name=tohoku-market
```

部署成功后终端会输出一个 URL，打开就能看到线上效果。管理员会把 `xxx.tohokucssa.org` 的 DNS 指向这个地址。

### 推荐：在 package.json 里加一条 deploy 脚本

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "deploy": "vite build && npx wrangler pages deploy dist --project-name=你的项目名"
  }
}
```

这样以后一条命令就能部署：

```bash
npm run deploy
```

---

## 完整工作流总结

```
写代码（本地 or AI 辅助）
    ↓
npm run dev          ← 本地预览确认效果
    ↓
git add . && git commit -m "xxx" && git push    ← 提交到 GitHub
    ↓
npm run deploy       ← 部署到线上，立即可以在线访问
```

---

## 如果你的项目需要后端（D1 数据库 / R2 存储）

Cloudflare Workers 的后端资源（D1 数据库、R2 对象存储、KV）也在学友会账户下。配置方法：

### 1. 在项目根目录创建 `wrangler.toml`

```toml
name = "你的项目名"
compatibility_date = "2024-09-23"

[[d1_databases]]
binding = "DB"
database_name = "你的数据库名"
database_id = "管理员提供的数据库ID"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "你的存储桶名"
```

### 2. 数据库迁移

```bash
# 本地创建迁移文件
npx drizzle-kit generate

# 应用到远程数据库
npx wrangler d1 execute 你的数据库名 --remote --file=drizzle/xxxx.sql
```

如果需要新建 D1 数据库或 R2 存储桶，联系管理员创建后把 ID 给你。

---

## 常见问题

### Q: 我 push 不了，提示 permission denied
检查你的 GitHub 账号是否已登录：
```bash
gh auth status
```
如果没登录，执行 `gh auth login` 按提示操作。

### Q: deploy 报错 authentication error
检查环境变量是否设置正确：
```bash
echo $CLOUDFLARE_API_TOKEN
echo $CLOUDFLARE_ACCOUNT_ID
```
如果为空，说明没生效，重新设置并 `source ~/.zshrc`。

### Q: 我不小心把 .env 或 token 提交了
```bash
# 立即从 git 历史中移除
git rm --cached .env
echo ".env" >> .gitignore
git commit -m "fix: remove .env from tracking"
git push
```
然后通知管理员重新生成 token。

### Q: 怎么在本地预览别人的子项目
```bash
git clone https://github.com/xxx/tohoku-market.git
cd tohoku-market
npm install
npm run dev
```

---

## 安全须知

- **不要** 把 `CLOUDFLARE_API_TOKEN` 提交到 GitHub 或发在群里
- **不要** 把 `.env` 文件提交到仓库（`.gitignore` 已排除）
- 如果 token 泄露，立即通知管理员作废并重新生成
- 部署权限令牌只允许部署 Pages 和操作指定的 D1/R2，不能修改账户设置

---

## 联系

- 遇到 git / 部署问题：群里直接问
- 需要新建数据库或存储桶：联系管理员
- 域名配置（`xxx.tohokucssa.org`）：联系管理员
