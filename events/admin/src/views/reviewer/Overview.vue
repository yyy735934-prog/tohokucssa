<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">数据总览</h1>
    </div>

    <div v-if="loading" class="empty"><p>加载中…</p></div>
    <template v-else>
      <div class="stats">
        <div class="card stat-card">
          <div class="stat-value" style="color:var(--c-pending)">{{ stats.pending }}</div>
          <div class="stat-label">待审核</div>
        </div>
        <div class="card stat-card">
          <div class="stat-value" style="color:var(--c-success)">{{ stats.open }}</div>
          <div class="stat-label">报名中</div>
        </div>
        <div class="card stat-card">
          <div class="stat-value" style="color:var(--c-primary)">{{ stats.active }}</div>
          <div class="stat-label">进行中</div>
        </div>
        <div class="card stat-card">
          <div class="stat-value">{{ stats.closed }}</div>
          <div class="stat-label">已结束</div>
        </div>
      </div>

      <div class="stats">
        <div class="card stat-card">
          <div class="stat-value">{{ stats.totalSignups }}</div>
          <div class="stat-label">总报名人次</div>
        </div>
        <div class="card stat-card">
          <div class="stat-value">{{ stats.totalCheckins }}</div>
          <div class="stat-label">总签到人次</div>
        </div>
        <div class="card stat-card">
          <div class="stat-value">{{ checkinRate }}%</div>
          <div class="stat-label">签到率</div>
        </div>
        <div class="card stat-card">
          <div class="stat-value">{{ totalEvents }}</div>
          <div class="stat-label">总活动数</div>
        </div>
      </div>

      <!-- Checkin rate bar -->
      <div class="card mb-16">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:12px">签到率</h3>
        <div class="bar-bg">
          <div class="bar-fill" :style="{ width: checkinRate + '%' }"></div>
        </div>
        <div class="flex justify-between mt-12" style="font-size:13px;color:var(--c-text-2)">
          <span>已签到 {{ stats.totalCheckins }}</span>
          <span>未签到 {{ stats.totalSignups - stats.totalCheckins }}</span>
        </div>
      </div>

      <!-- Quick actions -->
      <div class="card">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:12px">快捷操作</h3>
        <div class="quick-actions">
          <router-link to="/admin/review" class="action-card">
            <span class="action-icon" style="background:var(--c-pending-bg);color:var(--c-pending)">审</span>
            <span>审核队列</span>
            <span v-if="stats.pending" class="count-badge">{{ stats.pending }}</span>
          </router-link>
          <router-link to="/admin/events/new" class="action-card">
            <span class="action-icon" style="background:var(--c-primary-light);color:var(--c-primary)">+</span>
            <span>创建活动</span>
          </router-link>
          <router-link to="/admin/scan" class="action-card">
            <span class="action-icon" style="background:var(--c-success-bg);color:var(--c-success)">扫</span>
            <span>扫码签到</span>
          </router-link>
          <router-link to="/admin/users" class="action-card">
            <span class="action-icon" style="background:var(--c-warning-bg);color:var(--c-warning)">人</span>
            <span>用户管理</span>
          </router-link>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../../api.js'

const stats = ref({ pending: 0, open: 0, active: 0, closed: 0, totalSignups: 0, totalCheckins: 0 })
const loading = ref(true)

const totalEvents = computed(() => stats.value.pending + stats.value.open + stats.value.active + stats.value.closed)
const checkinRate = computed(() => {
  if (!stats.value.totalSignups) return 0
  return Math.round(stats.value.totalCheckins / stats.value.totalSignups * 100)
})

onMounted(async () => {
  try {
    const data = await api.dashboardStats()
    stats.value = data.stats
  } catch {}
  loading.value = false
})
</script>

<style scoped>
.bar-bg {
  height: 24px; background: var(--c-bg); border-radius: 99px; overflow: hidden;
}
.bar-fill {
  height: 100%; background: var(--c-success); border-radius: 99px;
  transition: width .6s ease; min-width: 2px;
}
.quick-actions { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.action-card {
  display: flex; align-items: center; gap: 10px;
  padding: 14px; border-radius: var(--radius); border: 1px solid var(--c-border);
  color: var(--c-text); font-weight: 500; font-size: 14px;
  transition: all .15s;
}
.action-card:hover { background: var(--c-bg); border-color: var(--c-primary); }
.action-icon {
  width: 32px; height: 32px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 16px; flex-shrink: 0;
}
.count-badge {
  background: var(--c-danger); color: #fff; font-size: 11px; font-weight: 700;
  padding: 1px 7px; border-radius: 99px; margin-left: auto;
}
</style>
