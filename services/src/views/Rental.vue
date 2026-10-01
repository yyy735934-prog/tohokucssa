<template>
  <div class="page">
    <div class="hero">
      <h1>物资租赁</h1>
      <p>学友会公益物资借用服务</p>
    </div>

    <div class="category-grid">
      <div v-for="cat in categories" :key="cat.key" class="card category-card">
        <span class="cat-icon">{{ cat.icon }}</span>
        <div class="cat-body">
          <h3>{{ cat.label }}</h3>
          <p>{{ cat.desc }}</p>
          <span class="cat-status">{{ cat.status }}</span>
        </div>
      </div>
    </div>

    <div class="card info-card">
      <h2>借用须知</h2>
      <ul>
        <li>借用对象：東北地区中国学友会成员</li>
        <li>借用流程：在线预约 → 确认取用时间 → 归还检查</li>
        <li>押金规则：根据物资类型收取相应押金，归还后退还</li>
        <li>损坏赔偿：使用过程中损坏需按折旧价赔偿</li>
      </ul>
    </div>

    <!-- TODO: Phase 3 完整实现
         后端需要：
         1. rental_items 表 (id, category, name, description, images, quantity, available, deposit, created_at)
         2. rental_bookings 表 (id, item_id, user_email, user_name, book_date, return_date, status, deposit_paid, created_at)
         3. worker/routes/rental.js — CRUD + 预约/归还 API
         4. admin/views/RentalManagement.vue — 管理后台

         前端参考：
         - costco-h5 HomeView.vue 的左栏分类 + 右栏卡片模式
         - 小程序 detail.vue 的商品详情 + 加入清单模式
         - 小程序 request.vue 的预约表单模式
    -->

    <router-link to="/" class="back-link">← 返回服务大厅</router-link>
  </div>
</template>

<script setup>
const categories = [
  { key: 'boardgame', icon: '🎲', label: '桌游', desc: '三国杀、狼人杀、UNO 等聚会桌游', status: '待上架' },
  { key: 'camping', icon: '⛺', label: '露营设备', desc: '帐篷、烤架、折叠桌椅、睡袋', status: '待上架' },
  { key: 'hanfu', icon: '👘', label: '汉服', desc: '传统汉服出借，可用于活动拍照', status: '待上架' },
  { key: 'vehicle', icon: '🚗', label: '车辆', desc: '学友会公用车辆预约', status: '待上架' },
]
</script>

<style scoped>
.hero { margin-bottom: 24px; }
.hero h1 { font-size: 26px; font-weight: 700; }
.hero p { color: var(--c-text-2); font-size: 14px; margin-top: 4px; }

.category-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
@media (max-width: 520px) { .category-grid { grid-template-columns: 1fr; } }

.category-card { display: flex; gap: 12px; align-items: flex-start; }
.cat-icon { font-size: 32px; flex-shrink: 0; }
.cat-body { flex: 1; }
.cat-body h3 { font-size: 15px; font-weight: 600; }
.cat-body p { font-size: 12px; color: var(--c-text-2); margin-top: 2px; }
.cat-status { display: inline-block; margin-top: 6px; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; background: #fef3c7; color: #92400e; }

.info-card h2 { font-size: 16px; font-weight: 700; margin-bottom: 10px; }
.info-card ul { list-style: none; display: flex; flex-direction: column; gap: 8px; }
.info-card li { font-size: 13px; color: var(--c-text-2); padding-left: 16px; position: relative; line-height: 1.5; }
.info-card li::before { content: '·'; position: absolute; left: 0; color: var(--c-primary); font-weight: 700; }

.back-link { display: block; text-align: center; font-size: 13px; margin-top: 24px; color: var(--c-text-3); }
</style>
