# 任务：物资租赁平台 — 全栈开发

## 你的角色

你是 `rental.tohokucssa.org` 的独立负责人，从零搭建一个物资借用预约系统。
项目骨架已搭好（Vue 3 + Vite），你需要实现完整的前端页面和后端 API。

## 技术栈

- **前端**：Vue 3 + Vite + vue-router
- **后端**：Cloudflare Workers（在 `worker/` 目录）
- **数据库**：Cloudflare D1（SQLite 兼容，用 Drizzle ORM 或直接写 SQL 都行）
- **文件存储**：Cloudflare R2（物品图片）
- **样式**：CSS 变量设计系统（已有 `src/styles/base.css`，与学友会其他站点统一风格）
- **部署**：Cloudflare Pages

## 项目结构

```
tohoku-rental/
├── package.json
├── vite.config.js
├── index.html
├── src/
│   ├── main.js
│   ├── router.js              # 已有 5 条路由
│   ├── App.vue                # 全局导航
│   ├── styles/base.css        # 设计系统（已有）
│   └── views/
│       ├── Home.vue           # 首页（已有分类卡片骨架）
│       ├── ItemDetail.vue     # 物品详情（待实现）
│       ├── BookingForm.vue    # 预约表单（待实现）
│       ├── MyBookings.vue     # 我的借用（待实现）
│       └── Admin.vue          # 管理后台（待实现）
├── worker/
│   └── routes/                # 后端 API（待实现）
└── db/                        # 数据库 schema（待实现）
```

## 需要实现的功能

### Phase 1：物品展示（纯前端）
- [ ] Home.vue：物品卡片列表（图片、名称、分类、可借数量）
- [ ] Home.vue：按分类筛选（桌游/露营/汉服/车辆）
- [ ] ItemDetail.vue：物品详情页（大图轮播、描述、押金金额、可借时段）
- [ ] 静态 JSON 数据先跑通页面，后面再接 API

### Phase 2：预约流程（前后端）
- [ ] 数据库设计（见下方 schema 建议）
- [ ] Worker API：GET /api/items（列表）、GET /api/items/:id（详情）
- [ ] Worker API：POST /api/bookings（创建预约）
- [ ] Worker API：GET /api/bookings?email=xxx（我的预约）
- [ ] BookingForm.vue：选择日期、填写姓名/邮箱/手机、确认预约
- [ ] MyBookings.vue：查看预约状态（待确认/已借出/已归还）

### Phase 3：管理后台
- [ ] Admin.vue：物品 CRUD（添加/编辑/删除/上传图片）
- [ ] Admin.vue：预约审批（确认借出/确认归还/标记损坏）
- [ ] Worker API：POST /api/items（添加物品）、PUT /api/items/:id（编辑）
- [ ] Worker API：PUT /api/bookings/:id（更新状态）
- [ ] R2 图片上传 API

## 数据库 schema 建议

### rental_items 表
```sql
CREATE TABLE rental_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,          -- boardgame / camping / hanfu / vehicle
  name TEXT NOT NULL,
  description TEXT,
  images TEXT,                     -- JSON 数组，存 R2 图片 URL
  quantity INTEGER DEFAULT 1,      -- 总数量
  available INTEGER DEFAULT 1,     -- 当前可借数量
  deposit INTEGER DEFAULT 0,       -- 押金（日元）
  rules TEXT,                      -- 借用须知
  created_at TEXT DEFAULT (datetime('now'))
);
```

### rental_bookings 表
```sql
CREATE TABLE rental_bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_phone TEXT,
  book_date TEXT NOT NULL,         -- 借用日期
  return_date TEXT,                -- 预计归还日期
  actual_return_date TEXT,         -- 实际归还日期
  status TEXT DEFAULT 'pending',   -- pending / confirmed / out / returned / damaged
  deposit_paid INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (item_id) REFERENCES rental_items(id)
);
```

## Worker API 示例

在 `worker/routes/` 下创建 API 文件，参考结构：

```js
// worker/routes/items.js
export async function handleItems(request, env) {
  const url = new URL(request.url)
  
  if (request.method === 'GET') {
    const category = url.searchParams.get('category')
    let query = 'SELECT * FROM rental_items'
    if (category) query += ` WHERE category = '${category}'`
    const { results } = await env.DB.prepare(query).all()
    return Response.json(results)
  }
  
  // POST, PUT, DELETE...
}
```

注意：上面的示例有 SQL 注入风险，实际实现时请用参数化查询：
```js
await env.DB.prepare('SELECT * FROM rental_items WHERE category = ?').bind(category).all()
```

## 配置 D1 数据库

需要管理员创建 D1 数据库后给你 database_id。拿到后在项目根目录创建 `wrangler.toml`：

```toml
name = "tohoku-rental"
compatibility_date = "2024-09-23"

[[d1_databases]]
binding = "DB"
database_name = "tohoku-rental-db"
database_id = "管理员提供的ID"
```

## 运行

```bash
npm install
npm run dev          # 前端开发
npm run deploy       # 部署到 Cloudflare Pages
```

## 部署

使用管理员提供的 Cloudflare Token（见 COLLABORATION.md）：

```bash
export CLOUDFLARE_API_TOKEN=管理员给的token
export CLOUDFLARE_ACCOUNT_ID=管理员给的账户ID
npm run deploy
```

## 设计参考

- 整体风格与学友会其他站点一致（base.css 已有统一设计系统）
- 物品卡片参考电商产品卡片：图片 + 名称 + 简述 + 状态标签
- 预约表单参考酒店预订流程：选日期 → 填信息 → 确认
- 管理后台参考简易 CMS：左侧列表 + 右侧编辑

## 注意事项

- 这是一个独立部署的子项目，不依赖其他仓库
- 安全：API 管理接口需要鉴权（可以简单用 token 验证）
- SQL 必须使用参数化查询，防止注入
- 图片上传到 R2 后返回公开 URL，存入 rental_items.images
