<template>
  <div class="container">
    <div class="flex-between mb-16">
      <h1 style="font-size:20px">我的活动</h1>
      <router-link to="/events/new"><button class="btn-primary">+ 创建活动</button></router-link>
    </div>

    <div v-if="loading" class="empty-state">加载中…</div>
    <div v-else-if="error" class="empty-state" style="color:var(--c-danger)">{{ error }}</div>
    <div v-else-if="!events.length" class="empty-state">
      <p>还没有活动</p>
      <router-link to="/events/new" class="mt-16" style="display:inline-block"><button class="btn-primary">创建第一个活动</button></router-link>
    </div>

    <template v-else>
      <div class="stats-row mb-16">
        <div class="stat-card card">
          <div class="stat-num">{{ events.length }}</div>
          <div class="stat-label">活动总数</div>
        </div>
        <div class="stat-card card">
          <div class="stat-num" style="color:var(--c-primary)">{{ totalSignups }}</div>
          <div class="stat-label">总报名</div>
        </div>
        <div class="stat-card card">
          <div class="stat-num" style="color:#047857">{{ events.filter(e => e.status === 'open').length }}</div>
          <div class="stat-label">报名中</div>
        </div>
        <div class="stat-card card">
          <div class="stat-num" style="color:#b45309">{{ events.filter(e => e.status === 'active').length }}</div>
          <div class="stat-label">进行中</div>
        </div>
      </div>

      <div class="filter-tabs mb-16">
        <button v-for="f in filters" :key="f.key" class="filter-tab" :class="{ active: filter === f.key }" @click="filter = f.key">
          {{ f.label }}
          <span v-if="f.count" class="filter-count">{{ f.count }}</span>
        </button>
      </div>

      <div class="event-list">
        <router-link v-for="e in filtered" :key="e.id" :to="`/events/${e.id}`" class="event-card card">
          <div class="flex-between">
            <h3>{{ e.title }}</h3>
            <span class="badge" :class="`badge-${e.status}`">{{ statusLabel[e.status] }}</span>
          </div>
          <div class="event-meta">
            <span>{{ e.event_date }}</span>
            <span v-if="e.location"> · {{ e.location }}</span>
            <span> · {{ e.signupCount }}{{ e.capacity ? `/${e.capacity}` : '' }} 人报名</span>
          </div>
          <p v-if="e.status==='draft' && e.reject_reason" class="reject-hint">驳回: {{ e.reject_reason }}</p>
        </router-link>
      </div>
      <div v-if="!filtered.length" class="empty-state" style="padding:32px">此筛选下无活动</div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../../services/api.js'

const events = ref([])
const loading = ref(true)
const error = ref('')
const filter = ref('all')
const statusLabel = { draft: '草稿', pending: '待审核', open: '报名中', active: '进行中', closed: '已结束' }

const filters = computed(() => [
  { key: 'all', label: '全部', count: events.value.length },
  { key: 'draft', label: '草稿', count: events.value.filter(e => e.status === 'draft').length },
  { key: 'pending', label: '待审', count: events.value.filter(e => e.status === 'pending').length },
  { key: 'open', label: '报名中', count: events.value.filter(e => e.status === 'open').length },
  { key: 'active', label: '进行中', count: events.value.filter(e => e.status === 'active').length },
  { key: 'closed', label: '已结束', count: events.value.filter(e => e.status === 'closed').length },
].filter(f => f.key === 'all' || f.count > 0))

const totalSignups = computed(() => events.value.reduce((sum, e) => sum + (e.signupCount || 0), 0))

const filtered = computed(() =>
  filter.value === 'all' ? events.value : events.value.filter(e => e.status === filter.value)
)

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
.event-list { display: flex; flex-direction: column; gap: 12px; }
.event-card { display: block; color: inherit; transition: box-shadow .15s; }
.event-card:hover { box-shadow: var(--shadow-md); }
.event-card h3 { font-size: 16px; }
.event-meta { font-size: 13px; color: var(--c-text-secondary); margin-top: 6px; }
.reject-hint { font-size: 13px; color: var(--c-danger); margin-top: 6px; }
@media (max-width: 600px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .stat-num { font-size: 22px; }
}
</style>
