# 旧仓库 Pull Request 存档

2026-10-01 合并为本仓库时，从 4 个旧仓库导出的全部 PR（共 6 个，均已合并）。这些 PR 没有评论、行内评论或审查记录，下面保留了标题、作者、分支、日期和描述原文。PR 中的提交都在本仓库历史里，「本仓库提交」是对应的合并提交。

## `events/`（原 yyy735934-prog/event-platform）

### #1 Feat/weekly gatherings

- 作者：@DarwinDing，分支 `DarwinDing:feat/weekly-gatherings` → `main`
- 创建 2026-08-26，合并 2026-09-02
- 原合并提交 `17cdc12` → 本仓库提交 `c4ad907`

> 增加活动的平台的一个小功能

### #2 feat: support multiple gathering hosts

- 作者：@DarwinDing，分支 `DarwinDing:feat/weekly-gatherings` → `main`
- 创建 2026-09-03，合并 2026-09-03
- 原合并提交 `ea558c6` → 本仓库提交 `d3bae7b`

> （无描述）

### #3 feat: unify activity feed and add gathering covers

- 作者：@DarwinDing，分支 `DarwinDing:feat/unified-activity-feed` → `main`
- 创建 2026-09-03，合并 2026-09-03
- 原合并提交 `23b6fb5` → 本仓库提交 `ce24c23`

> （无描述）

### #4 feat: add gathering communications and event posters

- 作者：@DarwinDing，分支 `DarwinDing:feat/gathering-comms-posters` → `main`
- 创建 2026-09-04，合并 2026-09-04
- 原合并提交 `7dcdd94` → 本仓库提交 `6ad62ac`

> # Conflicts:
> #	docs/组个局-部署清单.md

### #5 feat: complete four activity types and CometChat chats

- 作者：@DarwinDing，分支 `DarwinDing:feat/gathering-comms-posters` → `main`
- 创建 2026-09-06，合并 2026-09-06
- 原合并提交 `3f44314` → 本仓库提交 `0c8bf58`

> Implements the two-category/four-subtype event model, D1 migration, scheduled/date-choice gathering flows, permissions, and CometChat activity chats.
> 
> Validation: npm test (8/8), npm run build, Wrangler dry-run.

## `homepage/`（原 yyy735934-prog/tohokucssa-homepage）

### #1 feat: 匿名求助 AI 分流后端接入 DeepSeek

- 作者：@HZNSENDAI，分支 `HZNSENDAI:feat/ai-worker` → `main`
- 创建 2026-07-05，合并 2026-07-05
- 原合并提交 `e17295f` → 本仓库提交 `02b5e0a`

> 新增 Cloudflare Worker 后端（worker/），实现匿名求助的 AI 分流：
> 关键词知识库检索 + DeepSeek API 分类 + 安全关键词硬性兜底转人工 +
> 自动通知运营人员。接入 index.html 现有的匿名求助原型，替换掉原本
> 纯前端正则表达式的假 AI 逻辑。附 scripts/test-deepseek.mjs 用于验证
> API Key 和分流逻辑。

