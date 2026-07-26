# 任务：灾害应急 + 新生入学指南

## 你的角色

你负责两部分内容：
1. 完善 `src/views/Emergency.vue` — 灾害应急指南
2. 新建 `src/views/NewcomerGuide.vue` — 新生入学手册

都是内容为主的页面，不需要写后端。

## 需要改的文件

```
src/views/Emergency.vue      ← 已有骨架，补充内容
src/views/NewcomerGuide.vue   ← 新建
src/router.js                 ← 加一条新路由
src/data/serviceCategories.js ← 加一个入口
```

---

## 一、灾害应急（Emergency.vue）

### 当前状态
已有：紧急电话（110/119/#7119/领事馆）、地震三步骤、3个有用链接。

### 需要补充

#### 台风应对
- 台风前准备（储水、充电、确认避难所位置）
- 台风中注意事项（不要外出、远离河川）
- 仙台常见台风季节（8-10月）

#### 避难所信息
- 东北大学各校区指定避难所
- 如何查询最近避难所（仙台市防灾アプリ）
- 避难所需要带的物品清单

#### 地震补充
- 海啸警报应对（仙台靠海，这很重要）
- 余震期间注意事项
- 确认自家建筑抗震等级的方法

#### 防灾准备
- 防灾背包清单（水、手电、收音机、护照复印件、现金、药品）
- NTT 171 灾害留言的详细使用方法
- 家人报平安的推荐方式（LINE、微信、171）

### 数据结构参考
当前用的是硬编码的 HTML 结构。你可以直接在现有结构上添加新的 `<div class="card">` 区块，
或者改成数据驱动（像 LocalGuide.vue 那样用 sections 数组），由你决定。

---

## 二、新生入学指南（NewcomerGuide.vue）— 新建

### 建议内容结构

```
1. 来日前准备
   - 签证办理（在留资格认定 → 签证申请）
   - 必带物品清单
   - 机票和行李建议

2. 到达后第一周
   - 机场到仙台的交通方式
   - 区役所手续（住民登录、国民健康保险、银行开户）
   - 手机卡办理推荐

3. 入学手续
   - 东北大学入学流程
   - 学生证、Sub-ID、大学邮箱
   - 选课和教务系统

4. 生活安顿
   - 购买生活用品（百均、ニトリ、メルカリ）
   - 自行车购买和防犯登录
   - 垃圾分类规则（仙台版）
```

### 创建新页面的步骤

1. 新建 `src/views/NewcomerGuide.vue`，参考 `Emergency.vue` 或 `LocalGuide.vue` 的结构
2. 在 `src/router.js` 里添加路由：
```js
{
  path: '/newcomer',
  component: () => import('./views/NewcomerGuide.vue'),
}
```
3. 在 `src/data/serviceCategories.js` 的 SERVICE_ITEMS 数组里添加入口：
```js
{
  key: 'newcomer',
  label: '新生指南',
  icon: '🎓',
  path: '/newcomer',
  group: 'local',
  desc: '来日准备、入学手续、生活安顿',
  status: 'ready',
}
```

### 页面风格参考

参照 `LocalGuide.vue` 的样式——用 sections 数组组织数据，每个 section 有 icon、title、desc 和 items 列表。
用已有的 CSS class（`.card`、`.page`、`.hero` 等），不需要引入新的样式库。

---

## 运行预览

```bash
npm install
npm run dev
```

- 灾害应急：http://localhost:5180/emergency
- 新生指南：http://localhost:5180/newcomer（你加完路由后）

## 提交方式

```bash
git add .
git commit -m "docs: 补充灾害应急台风和避难所信息"
git push
```

改完后在 GitHub 上创建 Pull Request。

## 注意

- 电话号码和地址请务必核实准确
- 签证和手续流程可能每年有变化，标注信息的参考时间
- 如果有官方链接（东北大学、仙台市役所等）尽量附上
