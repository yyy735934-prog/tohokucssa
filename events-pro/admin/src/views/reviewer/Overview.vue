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

      <!-- Per-event stats -->
      <div class="card mb-16">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:12px">各活动数据</h3>
        <div v-if="!perEvent.length" style="font-size:13px;color:var(--c-text-3)">暂无活动数据</div>
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>活动</th>
                <th>日期</th>
                <th>状态</th>
                <th>报名</th>
                <th>签到</th>
                <th>签到率</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="e in perEvent" :key="e.id">
                <td><router-link :to="`/admin/events/${e.id}`" style="font-weight:500">{{ e.title }}</router-link></td>
                <td>{{ e.event_date || '—' }}</td>
                <td><span class="badge" :class="`badge-${e.status}`">{{ statusMap[e.status] || e.status }}</span></td>
                <td>{{ e.signups }}{{ e.capacity ? `/${e.capacity}` : '' }}</td>
                <td>{{ e.checkins }}</td>
                <td>
                  <div class="mini-bar-wrap">
                    <div class="mini-bar-fill" :style="{ width: eventRate(e) + '%' }"></div>
                    <span class="mini-bar-text">{{ eventRate(e) }}%</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Audit logs -->
      <div class="card mb-16">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:12px">操作日志</h3>
        <div v-if="!auditLogs.length" style="font-size:13px;color:var(--c-text-3)">暂无记录</div>
        <div v-else class="audit-list">
          <div v-for="log in auditLogs" :key="log.id" class="audit-item">
            <div class="audit-detail">{{ log.detail }}</div>
            <div class="audit-meta">
              <span>{{ log.actor }}</span>
              <span>{{ formatDT(log.created_at) }}</span>
            </div>
          </div>
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
import { formatDateTime } from '../../lib/format.js'

const stats = ref({ pending: 0, open: 0, active: 0, closed: 0, totalSignups: 0, totalCheckins: 0 })
const perEvent = ref([])
const auditLogs = ref([])
const loading = ref(true)
const statusMap = { open: '报名中', active: '进行中', closed: '已结束' }

function formatDT(ts) { return formatDateTime(ts) }

const totalEvents = computed(() => stats.value.pending + stats.value.open + stats.value.active + stats.value.closed)
const checkinRate = computed(() => {
  if (!stats.value.totalSignups) return 0
  return Math.round(stats.value.totalCheckins / stats.value.totalSignups * 100)
})

function eventRate(e) {
  if (!e.signups) return 0
  return Math.round(e.checkins / e.signups * 100)
}

onMounted(async () => {
  try {
    const data = await api.dashboardStats()
    stats.value = data.stats
    perEvent.value = data.perEvent || []
  } catch {}
  try {
    const data = await api.getAuditLogs(30)
    auditLogs.value = data.logs || []
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
.mini-bar-wrap {
  position: relative; height: 20px; min-width: 60px;
  background: var(--c-bg); border-radius: 4px; overflow: hidden;
}
.mini-bar-fill {
  position: absolute; inset: 0; width: 0;
  background: var(--c-success); opacity: .25; border-radius: 4px;
}
.mini-bar-text {
  position: relative; display: flex; align-items: center; justify-content: center;
  height: 100%; font-size: 12px; font-weight: 600; color: var(--c-text);
}
.audit-list { display: flex; flex-direction: column; gap: 8px; max-height: 360px; overflow-y: auto; }
.audit-item {
  padding: 10px 12px; border: 1px solid var(--c-border); border-radius: 8px;
  font-size: 13px;
}
.audit-detail { font-weight: 500; }
.audit-meta { display: flex; gap: 12px; font-size: 12px; color: var(--c-text-3); margin-top: 4px; }
</style>
