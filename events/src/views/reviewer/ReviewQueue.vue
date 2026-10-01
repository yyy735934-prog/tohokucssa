<template>
  <div class="container">
    <h1 style="font-size:20px;margin-bottom:20px">审核队列</h1>

    <div v-if="loading" class="empty-state">加载中…</div>
    <div v-else-if="error" class="empty-state" style="color:var(--c-danger)">{{ error }}</div>

    <template v-else>
      <!-- 统计卡片 -->
      <div class="stats-row mb-16">
        <div class="stat-card card">
          <div class="stat-num" style="color:#b45309">{{ counts.pending }}</div>
          <div class="stat-label">待审核</div>
        </div>
        <div class="stat-card card">
          <div class="stat-num" style="color:#047857">{{ counts.open }}</div>
          <div class="stat-label">报名中</div>
        </div>
        <div class="stat-card card">
          <div class="stat-num" style="color:var(--c-primary)">{{ counts.active }}</div>
          <div class="stat-label">进行中</div>
        </div>
        <div class="stat-card card">
          <div class="stat-num">{{ totalSignups }}</div>
          <div class="stat-label">总报名</div>
        </div>
      </div>

      <!-- 待审 -->
      <div v-if="pending.length">
        <h2 class="section-title">待审核 ({{ pending.length }})</h2>
        <div class="event-list">
          <router-link v-for="e in pending" :key="e.id" :to="`/review/${e.id}`" class="event-card card">
            <div class="flex-between">
              <h3>{{ e.title }}</h3>
              <span class="badge badge-pending">待审核</span>
            </div>
            <div class="event-meta">
              <span>{{ e.event_date }}</span>
              <span v-if="e.location"> · {{ e.location }}</span>
              <span v-if="e.creator_name || e.creator_email"> · {{ e.creator_name || e.creator_email }}</span>
              <span> · 提交于 {{ formatDate(e.submitted_at) }}</span>
            </div>
          </router-link>
        </div>
      </div>
      <div v-else class="empty-state" style="padding:32px">没有待审活动</div>

      <!-- 所有活动 -->
      <div v-if="others.length" class="mt-24">
        <div class="flex-between mb-16">
          <h2 class="section-title" style="margin-bottom:0">所有活动 ({{ filteredOthers.length }})</h2>
        </div>

        <div class="filter-tabs mb-16">
          <button v-for="f in otherFilters" :key="f.key" class="filter-tab" :class="{ active: statusFilter === f.key }" @click="statusFilter = f.key">
            {{ f.label }}
            <span v-if="f.count" class="filter-count">{{ f.count }}</span>
          </button>
        </div>

        <div class="event-list">
          <router-link v-for="e in filteredOthers" :key="e.id" :to="`/review/${e.id}`" class="event-card card">
            <div class="flex-between">
              <h3>{{ e.title }}</h3>
              <span class="badge" :class="`badge-${e.status}`">{{ statusLabel[e.status] }}</span>
            </div>
            <div class="event-meta">{{ e.event_date }} · {{ e.signupCount }} 人报名<span v-if="e.creator_name || e.creator_email"> · {{ e.creator_name || e.creator_email }}</span></div>
          </router-link>
        </div>
        <div v-if="!filteredOthers.length" class="empty-state" style="padding:32px">此筛选下无活动</div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../../services/api.js'
import { formatDate } from '../../lib/format.js'

const events = ref([])
const loading = ref(true)
const error = ref('')
const statusFilter = ref('all')
const statusLabel = { draft: '草稿', pending: '待审核', open: '报名中', active: '进行中', closed: '已结束' }

const pending = computed(() => events.value.filter(e => e.status === 'pending'))
const others = computed(() => events.value.filter(e => e.status !== 'pending'))
const totalSignups = computed(() => events.value.reduce((sum, e) => sum + (e.signupCount || 0), 0))

const otherFilters = computed(() => [
  { key: 'all', label: '全部', count: others.value.length },
  { key: 'draft', label: '草稿', count: others.value.filter(e => e.status === 'draft').length },
  { key: 'open', label: '报名中', count: others.value.filter(e => e.status === 'open').length },
  { key: 'active', label: '进行中', count: others.value.filter(e => e.status === 'active').length },
  { key: 'closed', label: '已结束', count: others.value.filter(e => e.status === 'closed').length },
].filter(f => f.key === 'all' || f.count > 0))

const filteredOthers = computed(() =>
  statusFilter.value === 'all' ? others.value : others.value.filter(e => e.status === statusFilter.value)
)

const counts = computed(() => {
  const c = { pending: 0, open: 0, active: 0, closed: 0 }
  events.value.forEach(e => { if (c[e.status] !== undefined) c[e.status]++ })
  return c
})

onMounted(async () => {
  try {
    const data = await api.listEvents()
    events.value = data.events
  } catch (e) { error.value = e.message || '加载失败' }
  loading.value = false
})
</script>

<style scoped>
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.stat-card { text-align: center; padding: 16px 8px; }
.stat-num { font-size: 28px; font-weight: 700; }
.stat-label { font-size: 12px; color: var(--c-text-secondary); margin-top: 2px; }
.section-title { font-size: 15px; color: var(--c-text-secondary); margin-bottom: 12px; }
.event-list { display: flex; flex-direction: column; gap: 12px; }
.event-card { display: block; color: inherit; transition: box-shadow .15s; }
.event-card:hover { box-shadow: var(--shadow-md); }
.event-card h3 { font-size: 16px; }
.event-meta { font-size: 13px; color: var(--c-text-secondary); margin-top: 6px; }
.filter-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.filter-tab {
  padding: 6px 14px;
  border-radius: 99px;
  font-size: 13px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  color: var(--c-text-secondary);
  cursor: pointer;
  transition: all .15s;
}
.filter-tab.active { background: var(--c-primary); color: #fff; border-color: var(--c-primary); }
.filter-tab:hover:not(.active) { border-color: var(--c-primary); color: var(--c-primary); }
.filter-count { margin-left: 4px; opacity: .7; }
@media (max-width: 600px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .stat-num { font-size: 22px; }
}
</style>
