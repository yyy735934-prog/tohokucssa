# Tohoku CSSA 生活服务中心 — 协作者交接文档

## 项目概述

这是东北地区中国学友会（Tohoku CSSA）的**生活服务平台**，独立于活动管理平台（events.tohokucssa.org），
计划部署到 `services.tohokucssa.org`，同属 Tohokucssa 主域名。

技术栈：Vue 3 + Vite + vue-router，纯前端 SPA，部署目标 Cloudflare Pages。

## 快速开始

```bash
npm install
npm run dev        # 本地开发 http://localhost:5173
npm run build      # 构建到 dist/
npm run deploy     # 部署到 Cloudflare Pages（需先 wrangler login）
```

## 项目结构

```
src/
├── main.js                # 入口
├── router.js              # 路由配置
├── App.vue                # 全局布局 + 顶部导航
├── styles/
│   └── base.css           # 设计系统（CSS变量、组件样式、暗色模式）
├── data/
│   ├── serviceCategories.js  # 服务分类配置（SERVICE_GROUPS + SERVICE_ITEMS）
│   └── tohokuBusData.json    # 校车时刻表数据
└── views/
    ├── ServicesHub.vue    # 服务大厅首页（入口卡片网格）
    ├── CampusBus.vue      # 校车查询（完整功能，已从旧项目迁移）
    ├── LocalGuide.vue     # 在地生活指南（医疗/租房/驾照/VPN/美食）
    ├── Emergency.vue      # 灾害应对（紧急电话/地震指南/有用链接）
    ├── Market.vue         # 二手信息（骨架页，待实现）
    └── Rental.vue         # 物资租赁（骨架页，待实现）
```

## 路由

| 路径 | 页面 | 状态 |
|------|------|------|
| `/` | 服务大厅 | 已完成 |
| `/bus` | 校车查询 | 已完成（含定位/换乘/时刻表） |
| `/local` | 生活指南 | 骨架+示例内容 |
| `/emergency` | 灾害应对 | 骨架+实用信息 |
| `/market` | 二手信息 | 占位页 |
| `/rental` | 物资租赁 | 占位页 |

## 开发分阶段计划

### Phase 1（纯前端，当前阶段）
- [x] 校车查询功能完整
- [x] 服务大厅入口
- [ ] 完善 LocalGuide 各板块的详细内容
- [ ] 美食地图（考虑用静态 JSON 数据 + 地图标注）
- [ ] 完善页面间导航和面包屑

### Phase 2（轻后端）
- [ ] 二手信息板块
  - 物品卡片列表（图片 + 标题 + 价格 + 联系方式）
  - 分类筛选（家具、电器、书籍、自行车、其他）
  - 发布表单
  - 后端可用 Cloudflare Workers + D1

### Phase 3（完整后端）
- [ ] 物资租赁系统
  - rental_items 表 (id, category, name, images, quantity, available, deposit)
  - rental_bookings 表 (id, item_id, user_email, book_date, return_date, status)
  - 预约/归还 API
  - 管理后台页面

## 设计系统

项目使用 CSS 变量系统，定义在 `src/styles/base.css`，支持亮色/暗色主题自动切换。

主要颜色变量：
- `--c-primary` 主色（深绿）
- `--c-bg` / `--c-surface` 背景色
- `--c-text` / `--c-text-2` / `--c-text-3` 文字层级
- `--c-border` 边框色
- `--c-warning` / `--c-danger` 状态色

组件类名：`.card` `.btn` `.btn-primary` `.badge` `.page`

## 服务分类配置

在 `src/data/serviceCategories.js` 中定义，修改此文件即可增减首页服务入口：

```js
SERVICE_ITEMS: [
  { key: 'bus', label: '校车查询', icon: '🚌', path: '/bus', group: 'campus', status: 'active' },
  // 添加新服务只需在此追加条目
]
```

`status` 字段：`active` = 正常显示, `coming` = 显示"即将上线"标签

## 校车数据

`src/data/tohokuBusData.json` 包含 12 个站点和 8 条线路的完整时刻表。
如需更新时刻表，直接修改此 JSON 文件即可，格式为：

```json
{
  "stops": [{ "id": "xxx", "name_cn": "站名", "name_en": "English", "lat": 38.xxx, "lon": 140.xxx }],
  "routes": [{ "route": "线路名", "direction": "A→B", "stops": ["站名1","站名2"], "timetable": [["8:00","8:10"]], "service_days": {"type":"weekday"} }]
}
```

## 部署

项目配置了 Cloudflare Pages 部署：

```bash
npm run deploy
```

首次部署需要：
1. `npx wrangler login` 登录 Cloudflare
2. 会自动创建 `tohokucssa-services` 项目
3. 之后在 Cloudflare Dashboard 绑定 `services.tohokucssa.org` 域名

## 与活动平台的关系

- 活动平台：`events.tohokucssa.org`（独立仓库 event-platform-pro）
- 本项目：`services.tohokucssa.org`（独立仓库 tohokucssa-services）
- 两者通过顶部导航互相跳转，无代码依赖
- 共享同一个 Cloudflare 账号和 Tohokucssa 域名

## 注意事项

- 本项目**不依赖**任何 UI 框架（无 Vant、无 Element Plus），所有样式在 base.css 中
- 校车查询页面的 toast 提示是自定义实现（`alert()`），如需美化可替换为自定义组件
- `select` 元素在 base.css 中已有统一样式，直接使用即可
- 暗色模式通过 `prefers-color-scheme: dark` 媒体查询自动适配
