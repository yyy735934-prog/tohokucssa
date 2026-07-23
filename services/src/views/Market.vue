<template>
  <div class="page">
    <div class="hero">
      <h1>二手信息</h1>
      <p>同学之间的闲置物品信息</p>
    </div>

    <div class="card placeholder-card">
      <p class="placeholder-icon">♻️</p>
      <h2>功能建设中</h2>
      <p class="placeholder-desc">
        二手信息板块正在开发中。<br>
        计划支持：物品发布、分类浏览、联系撮合。
      </p>
    </div>

    <!-- TODO: 参考 costco-h5/src/views/MarketView.vue 实现
         - 物品卡片列表（图片 + 标题 + 价格 + 联系方式）
         - 分类筛选（家具、电器、书籍、自行车、其他）
         - 发布表单（需登录）
         - 考虑是否接入后端 DB 或纯 JSON 静态数据
    -->

    <router-link to="/" class="back-link">← 返回服务大厅</router-link>
  </div>
</template>

<style scoped>
.hero { margin-bottom: 24px; }
.hero h1 { font-size: 26px; font-weight: 700; }
.hero p { color: var(--c-text-2); font-size: 14px; margin-top: 4px; }
.placeholder-card { text-align: center; padding: 48px 20px; }
.placeholder-icon { font-size: 48px; margin-bottom: 12px; }
.placeholder-card h2 { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
.placeholder-desc { font-size: 14px; color: var(--c-text-2); line-height: 1.6; }
.back-link { display: block; text-align: center; font-size: 13px; margin-top: 24px; color: var(--c-text-3); }
</style>
