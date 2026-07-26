# 任务：生活服务中心 — 框架维护与整合

## 你的角色

你是 `services.tohokucssa.org` 的主要开发者，负责：
1. 维护整体框架（路由、导航、设计系统）
2. 完善 ServicesHub.vue 首页的交互体验
3. 审核并合并其他协作者的 PR（生活指南内容、灾害应急内容）
4. 部署上线

## 技术栈

- Vue 3 + Vite + vue-router
- 纯 CSS 变量设计系统（见 `src/styles/base.css`）
- 无 UI 框架依赖
- 部署目标：Cloudflare Pages

## 项目结构

```
src/
├── main.js                # 入口
├── router.js              # 路由配置
├── App.vue                # 全局布局 + 顶部导航
├── styles/base.css        # 设计系统
├── data/
│   ├── serviceCategories.js  # 服务分类配置
│   └── tohokuBusData.json    # 校车数据
└── views/
    ├── ServicesHub.vue    # ★ 首页（你负责完善）
    ├── CampusBus.vue      # 校车查询（已完成）
    ├── LocalGuide.vue     # 生活指南（协作者C负责内容）
    ├── Emergency.vue      # 灾害应对（协作者E负责内容）
    ├── Market.vue         # 二手信息（指向独立子站）
    └── Rental.vue         # 物资租赁（指向独立子站）
```

## 当前待办

### 优先级高
- [ ] ServicesHub.vue 首页体验优化：搜索/筛选、常用服务置顶、访问统计
- [ ] 完善页面间的导航和面包屑
- [ ] Market 和 Rental 卡片改为外链跳转（指向各自子域名）
- [ ] 添加 PWA 支持（离线可用对留学生很重要）

### 优先级中
- [ ] 响应式优化：确保所有页面在手机端体验良好
- [ ] 暗色模式检查：确认所有组件在暗色下正常显示
- [ ] 添加页面切换动画（vue-router transition）
- [ ] SEO：每个页面设置合适的 title 和 meta

### 优先级低
- [ ] 国际化（中文/日文/英文切换）
- [ ] 用户反馈入口

## 运行

```bash
npm install
npm run dev      # 本地开发
npm run deploy   # 部署上线
```

## 合并其他人的 PR

其他协作者会提交生活指南和灾害应急的内容 PR，你负责审核合并：
- 确认内容准确（尤其是电话号码、地址等事实信息）
- 确认样式与整体设计一致
- 合并后重新部署
