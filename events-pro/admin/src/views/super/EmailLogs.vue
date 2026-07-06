<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">邮件发送记录</h1>
        <p class="page-sub">查看所有邮件的发送状态和内容</p>
      </div>
      <div class="flex gap-8">
        <select v-model="filterEvent" @change="load" style="padding:6px 10px;border:1px solid var(--c-border);border-radius:6px;font-size:13px">
          <option value="">全部活动</option>
          <option v-for="e in events" :key="e.id" :value="e.id">{{ e.title }}</option>
        </select>
        <select v-model="filterStatus" @change="applyFilter" style="padding:6px 10px;border:1px solid var(--c-border);border-radius:6px;font-size:13px">
          <option value="">全部状态</option>
          <option value="sent">发送成功</option>
          <option value="failed">发送失败</option>
        </select>
      </div>
    </div>

    <!-- 今日配额 -->
    <div v-if="quota" class="card mb-16 quota-card">
      <div class="quota-header">
        <span style="font-weight:600;font-size:14px">今日邮件额度</span>
        <span class="quota-badge" :class="quotaClass">{{ quota.used }} / {{ quota.limit }}</span>
      </div>
      <div class="quota-bar-bg">
        <div class="quota-bar-fill" :class="quotaClass" :style="{ width: quotaPct + '%' }"></div>
      </div>
      <div style="font-size:12px;color:var(--c-text-3);margin-top:6px">
        <span v-if="quota.remaining > 0">剩余 {{ quota.remaining }} 封</span>
        <span v-else style="color:var(--c-danger)">今日额度已用完，明天 UTC 0:00 重置</span>
      </div>
    </div>

    <div v-if="loading" class="card" style="text-align:center;padding:40px;color:var(--c-text-3)">加载中...</div>

    <div v-else-if="!filtered.length" class="card" style="text-align:center;padding:40px;color:var(--c-text-3)">暂无邮件记录</div>

    <div v-else class="card" style="padding:0;overflow:hidden">
      <div style="padding:12px 16px;border-bottom:1px solid var(--c-border);font-size:13px;color:var(--c-text-2)">
        共 {{ filtered.length }} 条记录
        <span v-if="sentCount || failedCount" style="margin-left:12px">
          <span style="color:var(--c-success)">{{ sentCount }} 成功</span>
          <span v-if="failedCount" style="color:var(--c-danger);margin-left:8px">{{ failedCount }} 失败</span>
        </span>
      </div>
      <div class="log-list">
        <div v-for="log in filtered" :key="log.id" class="log-item" @click="preview(log)">
          <div class="log-status">
            <span class="dot" :class="log.status === 'sent' ? 'dot-ok' : 'dot-fail'"></span>
          </div>
          <div class="log-main">
            <div class="log-subject">{{ log.subject }}</div>
            <div class="log-meta">
              <span>{{ log.to_email }}</span>
              <span v-if="log.event_title" class="log-event">{{ log.event_title }}</span>
            </div>
            <div v-if="log.error" class="log-error">{{ log.error.slice(0, 120) }}</div>
          </div>
          <div class="log-time">{{ formatDT(log.created_at) }}</div>
        </div>
      </div>
    </div>

    <!-- 邮件预览弹窗 -->
    <div v-if="previewLog" class="modal-mask" @click.self="previewLog = null">
      <div class="modal" style="max-width:680px;max-height:90vh;display:flex;flex-direction:column">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--c-border)">
          <h3 style="font-size:15px;font-weight:600;margin:0">邮件预览</h3>
          <button class="btn btn-outline btn-sm" @click="previewLog = null">关闭</button>
        </div>
        <div style="padding:16px 20px;border-bottom:1px solid var(--c-border);font-size:13px">
          <div class="preview-row"><span class="preview-label">收件人</span><span>{{ previewLog.to_email }}</span></div>
          <div class="preview-row"><span class="preview-label">主题</span><span>{{ previewLog.subject }}</span></div>
          <div class="preview-row"><span class="preview-label">状态</span>
            <span :style="{ color: previewLog.status === 'sent' ? 'var(--c-success)' : 'var(--c-danger)' }">
              {{ previewLog.status === 'sent' ? '发送成功' : '发送失败' }}
            </span>
          </div>
          <div v-if="previewLog.event_title" class="preview-row"><span class="preview-label">关联活动</span><span>{{ previewLog.event_title }}</span></div>
          <div class="preview-row"><span class="preview-label">时间</span><span>{{ formatDT(previewLog.created_at) }}</span></div>
          <div v-if="previewLog.error" class="preview-row"><span class="preview-label">错误</span><span style="color:var(--c-danger)">{{ previewLog.error }}</span></div>
        </div>
        <div v-if="previewHtml" style="flex:1;overflow:auto;background:#f5f5f7">
          <iframe :srcdoc="previewHtml" style="width:100%;height:100%;min-height:400px;border:none"></iframe>
        </div>
        <div v-else style="padding:40px;text-align:center;color:var(--c-text-3)">加载邮件内容中...</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../../api.js'

const logs = ref([])
const events = ref([])
const loading = ref(true)
const filterEvent = ref('')
const filterStatus = ref('')
const previewLog = ref(null)
const previewHtml = ref('')
const quota = ref(null)

const filtered = computed(() => {
  let list = logs.value
  if (filterStatus.value) list = list.filter(l => l.status === filterStatus.value)
  return list
})

const sentCount = computed(() => filtered.value.filter(l => l.status === 'sent').length)
const failedCount = computed(() => filtered.value.filter(l => l.status === 'failed').length)
const quotaPct = computed(() => quota.value ? Math.min(100, Math.round(quota.value.used / quota.value.limit * 100)) : 0)
const quotaClass = computed(() => {
  if (!quota.value) return ''
  if (quota.value.remaining === 0) return 'quota-full'
  if (quotaPct.value >= 80) return 'quota-warn'
  return 'quota-ok'
})

function formatDT(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function load() {
  loading.value = true
  try {
    const data = await api.getEmailLogs(filterEvent.value || null, 500)
    logs.value = data.logs
  } catch (_) {}
  loading.value = false
}

function applyFilter() {}

async function preview(log) {
  previewLog.value = log
  previewHtml.value = ''
  try {
    const data = await api.getEmailDetail(log.id)
    previewHtml.value = data.log.html
  } catch (_) {
    previewHtml.value = '<p style="padding:20px;color:#999">无法加载邮件内容</p>'
  }
}

onMounted(async () => {
  const [, eventsData, quotaData] = await Promise.all([
    load(),
    api.listEvents(),
    api.getEmailQuota().catch(() => null)
  ])
  events.value = eventsData.events || []
  if (quotaData) quota.value = quotaData
})
</script>

<style scoped>
.log-list { }
.log-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--c-border);
  cursor: pointer;
  transition: background .15s;
}
.log-item:hover { background: var(--c-bg-hover, #f9f9f9); }
.log-item:last-child { border-bottom: none; }
.log-status { padding-top: 4px; }
.dot {
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: 50%;
}
.dot-ok { background: var(--c-success, #34c759); }
.dot-fail { background: var(--c-danger, #ff3b30); }
.log-main { flex: 1; min-width: 0; }
.log-subject {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.log-meta {
  font-size: 12px;
  color: var(--c-text-2);
  margin-top: 2px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.log-event {
  background: var(--c-bg-2, #f0f0f0);
  padding: 0 6px;
  border-radius: 4px;
}
.log-error {
  font-size: 12px;
  color: var(--c-danger, #ff3b30);
  margin-top: 4px;
}
.log-time {
  font-size: 12px;
  color: var(--c-text-3);
  white-space: nowrap;
  padding-top: 2px;
}

.modal-mask {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.modal {
  background: #fff;
  border-radius: 12px;
  width: 90%;
  overflow: hidden;
}

.preview-row {
  display: flex;
  gap: 8px;
  padding: 4px 0;
}
.preview-label {
  color: var(--c-text-3);
  min-width: 60px;
  flex-shrink: 0;
}

.quota-card { padding: 16px; }
.quota-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.quota-badge {
  font-size: 13px; font-weight: 600; padding: 2px 10px; border-radius: 12px;
}
.quota-ok .quota-badge, .quota-badge.quota-ok { background: #e8f8ee; color: var(--c-success, #34c759); }
.quota-warn .quota-badge, .quota-badge.quota-warn { background: #fff6e5; color: #ff9500; }
.quota-full .quota-badge, .quota-badge.quota-full { background: #ffe5e5; color: var(--c-danger, #ff3b30); }
.quota-bar-bg {
  height: 6px; background: var(--c-bg-2, #f0f0f0); border-radius: 3px; overflow: hidden;
}
.quota-bar-fill {
  height: 100%; border-radius: 3px; transition: width .3s;
}
.quota-bar-fill.quota-ok { background: var(--c-success, #34c759); }
.quota-bar-fill.quota-warn { background: #ff9500; }
.quota-bar-fill.quota-full { background: var(--c-danger, #ff3b30); }
.mb-16 { margin-bottom: 16px; }
</style>
