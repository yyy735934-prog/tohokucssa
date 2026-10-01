# 東北地区中国学友会（Tohoku CSSA）网站群

东北地区中国学友会的四个 Web 项目，合并为一个仓库（2026-10-01）。每个子目录是一个独立项目，有自己的 `package.json`，在各自目录里安装、开发、部署。

| 子目录 | 项目 | 线上地址 | 技术栈 |
|---|---|---|---|
| `homepage/` | 我们在東北 · 学友会门户（含匿名求助 AI 分流） | https://tohokucssa.org | React + Vite，Cloudflare Worker |
| `events/` | 活动管理平台 | https://events.tohokucssa.org | Vue 3 + Vite（`web/` 前台、`admin/` 后台），Cloudflare Worker + D1 + KV + R2 + Workers AI |
| `services/` | 生活服务中心 | 计划 `services.tohokucssa.org`，尚未部署 | Vue 3 + Vite，Cloudflare Pages |
| `rental/` | 物资租赁平台（脚手架） | 计划 `rental.tohokucssa.org`，尚未部署 | Vue 3 + Vite |

## 开发与部署

```bash
git clone https://github.com/yyy735934-prog/tohokucssa.git
cd tohokucssa/events      # 或 homepage / services / rental
npm install
npm run dev
```

部署都在本地手动执行（需先 `npx wrangler login`），没有接 GitHub 自动部署：

| 子目录 | 部署命令 |
|---|---|
| `homepage/` | `npm run build && npx wrangler deploy` |
| `events/` | `npm run deploy` |
| `services/` | `npm run deploy`（Cloudflare Pages 项目 `tohokucssa-services`） |
| `rental/` | `npm run deploy`（Cloudflare Pages 项目 `tohoku-rental`） |

Worker 用到的密钥保存在 Cloudflare（`wrangler secret`），不在仓库里。

## 来源与分支

本仓库由以下 4 个旧仓库合并，每个子目录保留了原仓库的完整提交历史：

| 子目录 | 原仓库 |
|---|---|
| `homepage/` | `yyy735934-prog/tohokucssa-homepage` |
| `events/` | `yyy735934-prog/event-platform` |
| `services/` | `yyy735934-prog/tohokucssa-services` |
| `rental/` | `yyy735934-prog/tohoku-rental` |

旧仓库的分支以子目录名为前缀保留：

| 分支 | 内容 |
|---|---|
| `events/feat/settlement-local` | AI 决算书功能（原本地未提交，尚未上线） |
| `events/feat/event-detail-test-preview` | 活动详情预览页、CometChat 汉化（18 个提交，未并入 main） |
| `homepage/wip-readme-uncommitted` | 门户 README（原本地未提交） |
| `services/feature/services-framework` | 协作者任务分支：框架维护 |
| `services/feature/local-guide` | 协作者任务分支：生活指南 |
| `services/feature/emergency-newcomer` | 协作者任务分支：灾害应急与新生指南 |

`events/` 的 main 与 `events.tohokucssa.org` 线上版本一致（原仓库 `6b20f97`）。`services/COLLABORATION.md` 中的克隆命令和分支名已改为本仓库。
