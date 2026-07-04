<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ auth.isReviewer ? '所有活动' : auth.role === 'user' ? '活动中心' : '我的活动' }}</h1>
        <p class="page-sub">{{ auth.isReviewer ? '管理全部活动' : auth.role === 'user' ? '创建活动即可成为活动主理人' : '创建并管理你的活动' }}</p>
      </div>
      <div class="flex gap-8" style="flex-wrap:wrap">
        <button v-if="auth.isReviewer" class="btn btn-outline btn-sm" @click="exportAll('csv')">导出 CSV</button>
        <button v-if="auth.isReviewer" class="btn btn-outline btn-sm" @click="exportAll('json')">导出 JSON</button>
        <router-link to="/admin/events/new" class="btn btn-primary btn-sm">创建活动</router-link>
      </div>
    </div>

    <!-- Host workflow guide (only for hosts, shown when few events) -->
    <div v-if="!auth.isReviewer && !loading && events.length < 3" class="card workflow-guide mb-16">
      <h3 style="font-size:15px;font-weight:600;margin-bottom:12px">活动发布流程</h3>
      <div class="workflow-steps">
        <div class="step">
          <div class="step-num">1</div>
          <div>
            <div class="step-title">创建活动</div>
            <div class="step-desc">填写活动信息，保存为草稿</div>
          </div>
        </div>
        <div class="step-arrow">→</div>
        <div class="step">
          <div class="step-num">2</div>
          <div>
            <div class="step-title">提交审核</div>
            <div class="step-desc">在活动详情页点击「提交审核」</div>
          </div>
        </div>
        <div class="step-arrow">→</div>
        <div class="step">
          <div class="step-num">3</div>
          <div>
            <div class="step-title">等待审批</div>
            <div class="step-desc">审核员审批后自动开放报名</div>
          </div>
        </div>
        <div class="step-arrow">→</div>
        <div class="step">
          <div class="step-num">4</div>
          <div>
            <div class="step-title">管理活动</div>
            <div class="step-desc">查看报名、扫码签到、导出数据</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state for hosts -->
    <div v-if="!loading && !events.length && !auth.isReviewer" class="card empty-hero">
      <div class="empty-icon">+</div>
      <h2>还没有活动</h2>
      <p>创建你的第一个活动，填写信息后提交审核</p>
      <router-link to="/admin/events/new" class="btn btn-primary btn-lg" style="margin-top:16px">创建活动</router-link>
    </div>

    <!-- Stats (only show if has events) -->
    <div v-if="events.length" class="stats">
      <div class="card stat-card">
        <div class="stat-value">{{ events.length }}</div>
        <div class="stat-label">总活动</div>
      </div>
      <div class="card stat-card">
        <div class="stat-value" style="color:var(--c-pending)">{{ events.filter(e => e.status === 'pending').length }}</div>
        <div class="stat-label">待审核</div>
      </div>
      <div class="card stat-card">
        <div class="stat-value" style="color:var(--c-success)">{{ events.filter(e => e.status === 'open').length }}</div>
        <div class="stat-label">报名中</div>
      </div>
      <div class="card stat-card">
        <div class="stat-value">{{ events.reduce((s, e) => s + (e.signupCount || 0), 0) }}</div>
        <div class="stat-label">总报名</div>
      </div>
    </div>

    <div v-if="events.length" class="card">
      <div class="flex items-center justify-between mb-16" style="flex-wrap:wrap;gap:8px">
        <div class="flex gap-8" style="flex-wrap:wrap">
          <button v-for="f in filters" :key="f.key" class="btn btn-sm"
            :class="filter === f.key ? 'btn-primary' : 'btn-outline'"
            @click="filter = f.key">
            {{ f.label }}
            <span v-if="f.key !== 'all' && countByStatus(f.key)" class="filter-count">{{ countByStatus(f.key) }}</span>
          </button>
        </div>
        <input v-model="search" placeholder="搜索活动名称…" class="search-input" />
      </div>

      <div v-if="!filtered.length" class="empty"><p>暂无活动</p></div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>活动名称</th>
              <th>日期</th>
              <th>状态</th>
              <th>报名</th>
              <th v-if="auth.isReviewer">创建者</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in filtered" :key="e.id">
              <td><router-link :to="`/admin/events/${e.id}`" style="font-weight:500">{{ e.title }}</router-link></td>
              <td>{{ e.event_date || '—' }}</td>
              <td><span class="badge" :class="`badge-${e.status}`">{{ STATUS_MAP[e.status] || e.status }}</span></td>
              <td>{{ e.signupCount || 0 }}{{ e.capacity ? `/${e.capacity}` : '' }}</td>
              <td v-if="auth.isReviewer">{{ e.creator_name || e.creator_email || '—' }}</td>
              <td>
                <div class="flex gap-8">
                  <router-link :to="`/admin/events/${e.id}`" class="btn btn-outline btn-sm">管理</router-link>
                  <a v-if="['open','active','closed'].includes(e.status)" :href="`/e/${e.id}`" target="_blank" class="btn btn-outline btn-sm">预览 ↗</a>
                  <router-link v-if="e.status === 'draft'" :to="`/admin/events/${e.id}/edit`" class="btn btn-outline btn-sm">编辑</router-link>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../../api.js'
import { auth } from '../../lib/auth.js'
import { STATUS_MAP } from '../../lib/format.js'

const events = ref([])
const loading = ref(true)
const filter = ref('all')
const search = ref('')
const filters = [
  { key: 'all', label: '全部' },
  { key: 'draft', label: '草稿' },
  { key: 'pending', label: '待审核' },
  { key: 'open', label: '报名中' },
  { key: 'active', label: '进行中' },
  { key: 'closed', label: '已结束' },
]

function countByStatus(status) {
  return events.value.filter(e => e.status === status).length
}

const filtered = computed(() => {
  let list = events.value
  if (filter.value !== 'all') list = list.filter(e => e.status === filter.value)
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase()
    list = list.filter(e => e.title.toLowerCase().includes(q))
  }
  return list
})

onMounted(async () => {
  try {
    const data = await api.listEvents()
    events.value = data.events
  } catch {}
  loading.value = false
})

async function exportAll(format) {
  try {
    const res = await api.exportAllEvents(format)
    const blob = await res.blob()
    const ext = format === 'json' ? 'json' : 'csv'
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `全部活动汇总.${ext}`; a.click()
    URL.revokeObjectURL(url)
  } catch {}
}
</script>

<style scoped>
.workflow-guide { border-left: 3px solid var(--c-primary); }
.workflow-steps { display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap; }
.step { display: flex; gap: 10px; align-items: flex-start; flex: 1; min-width: 140px; }
.step-num {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  background: var(--c-primary); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700;
}
.step-title { font-size: 14px; font-weight: 600; }
.step-desc { font-size: 12px; color: var(--c-text-3); margin-top: 2px; }
.step-arrow { color: var(--c-text-3); font-size: 18px; padding-top: 4px; }

.empty-hero { text-align: center; padding: 48px 20px; }
.empty-icon {
  width: 56px; height: 56px; border-radius: 50%;
  background: var(--c-primary-light); color: var(--c-primary);
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; font-weight: 700; margin: 0 auto 16px;
}
.empty-hero h2 { font-size: 18px; font-weight: 700; }
.empty-hero p { font-size: 14px; color: var(--c-text-2); margin-top: 4px; }

.filter-count {
  background: var(--c-bg); padding: 0 6px; border-radius: 99px;
  font-size: 11px; margin-left: 2px;
}

.search-input { width: 200px; padding: 6px 12px; font-size: 13px; }
@media (max-width: 640px) {
  .workflow-steps { flex-direction: column; }
  .step-arrow { transform: rotate(90deg); align-self: center; }
  .search-input { width: 100%; }
}
</style>
