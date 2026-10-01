<template>
  <div class="page">
    <div class="hero">
      <h1>物资租赁</h1>
      <p>学友会公益物资借用服务</p>
    </div>
    <div class="category-grid">
      <router-link v-for="cat in categories" :key="cat.key" :to="`/?category=${cat.key}`" class="card category-card">
        <span class="cat-icon">{{ cat.icon }}</span>
        <div class="cat-body">
          <h3>{{ cat.label }}</h3>
          <p>{{ cat.desc }}</p>
        </div>
      </router-link>
    </div>
    <p class="placeholder-msg">物品列表开发中 — 请参考 TASK.md 开始实现</p>
  </div>
</template>

<script setup>
const categories = [
  { key: 'boardgame', icon: '🎲', label: '桌游', desc: '三国杀、狼人杀、UNO 等聚会桌游' },
  { key: 'camping', icon: '⛺', label: '露营设备', desc: '帐篷、烤架、折叠桌椅、睡袋' },
  { key: 'hanfu', icon: '👘', label: '汉服', desc: '传统汉服出借，可用于活动拍照' },
  { key: 'vehicle', icon: '🚗', label: '车辆', desc: '学友会公用车辆预约' },
]
</script>

<style scoped>
.hero { margin-bottom: 24px; }
.hero h1 { font-size: 26px; font-weight: 700; }
.hero p { color: var(--c-text-2); font-size: 14px; margin-top: 4px; }
.category-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 520px) { .category-grid { grid-template-columns: 1fr; } }
.category-card { display: flex; gap: 12px; align-items: flex-start; text-decoration: none; color: inherit; }
.cat-icon { font-size: 32px; flex-shrink: 0; }
.cat-body h3 { font-size: 15px; font-weight: 600; }
.cat-body p { font-size: 12px; color: var(--c-text-2); margin-top: 2px; }
.placeholder-msg { text-align: center; color: var(--c-text-3); font-size: 13px; margin-top: 32px; }
</style>
