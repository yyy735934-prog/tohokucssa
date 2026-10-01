<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">审核队列</h1>
        <p class="page-sub">审核待发布的活动</p>
      </div>
    </div>

    <div class="stats">
      <div class="card stat-card">
        <div class="stat-value" style="color:var(--c-pending)">{{ pending.length }}</div>
        <div class="stat-label">待审核</div>
      </div>
      <div class="card stat-card">
        <div class="stat-value" style="color:var(--c-success)">{{ approved }}</div>
        <div class="stat-label">已通过</div>
      </div>
    </div>

    <div v-if="loading" class="empty"><p>加载中…</p></div>

    <div v-else-if="!pending.length" class="card">
      <div class="empty"><p>没有待审核的活动</p></div>
    </div>

    <div v-else class="review-list">
      <div v-for="e in pending" :key="e.id" class="card review-item">
        <div class="review-header">
          <div style="min-width:0;flex:1">
            <h3 style="font-weight:600">{{ e.title }}</h3>
            <p style="font-size:13px;color:var(--c-text-2);margin-top:2px">
              {{ e.event_date }} · {{ e.location || '未设置地点' }}
              <template v-if="e.created_by"> · 创建者: {{ e.creator_name || e.creator_email }}</template>
              <template v-else-if="e.submitter_name"> · 公开申请: {{ e.submitter_name }} ({{ e.submitter_email }})</template>
            </p>
          </div>
          <span class="badge badge-pending">待审核</span>
        </div>
        <p v-if="e.content" style="font-size:14px;color:var(--c-text-2);margin-top:8px;white-space:pre-wrap;max-height:100px;overflow:hidden">
          {{ e.content }}
        </p>

        <!-- Plan preview for reviewer -->
        <div v-if="e.plan" class="plan-section">
          <div class="plan-section-header" @click="togglePlan(e.id)">
            <span class="plan-section-icon">&#128221;</span>
            <span class="plan-section-label">活动计划书</span>
            <span class="plan-toggle">{{ expandedPlans.has(e.id) ? '收起' : '展开查看' }}</span>
          </div>
          <div v-if="expandedPlans.has(e.id)" class="plan-section-body" v-html="renderPlan(e.plan)"></div>
        </div>
        <div v-else class="plan-section-empty">
          <span class="plan-section-icon">&#128221;</span>
          <span>未提供活动计划书</span>
        </div>

        <div class="flex gap-8 mt-12">
          <button class="btn btn-success btn-sm" @click="approve(e)" :disabled="busy">通过</button>
          <button class="btn btn-outline btn-sm" @click="startReject(e)">驳回</button>
          <router-link :to="`/admin/events/${e.id}`" class="btn btn-outline btn-sm">查看详情</router-link>
        </div>
      </div>
    </div>

    <!-- Reject modal -->
    <div v-if="rejectTarget" class="modal-overlay" @click.self="rejectTarget = null">
      <div class="modal">
        <h3 class="modal-title">驳回活动</h3>
        <p style="margin-bottom:12px">驳回「{{ rejectTarget.title }}」</p>
        <div class="field">
          <label class="label">驳回原因（可选）</label>
          <textarea v-model="rejectReason" rows="3" placeholder="告知活动创建者修改建议"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="rejectTarget = null">取消</button>
          <button class="btn btn-danger" @click="doReject" :disabled="busy">确认驳回</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { api } from '../../api.js'
import { showToast } from '../../lib/toast.js'

const refreshPendingCount = inject('refreshPendingCount', () => {})

const events = ref([])
const loading = ref(true)
const busy = ref(false)
const rejectTarget = ref(null)
const rejectReason = ref('')

const expandedPlans = ref(new Set())

function togglePlan(id) {
  if (expandedPlans.value.has(id)) expandedPlans.value.delete(id)
  else expandedPlans.value.add(id)
  expandedPlans.value = new Set(expandedPlans.value)
}

function renderPlan(text) {
  return (text || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/【待补充】/g, '<mark style="background:#fef3c7;padding:1px 4px;border-radius:3px">【待补充】</mark>')
    .replace(/\n/g, '<br>')
}

const pending = computed(() => events.value.filter(e => e.status === 'pending'))
const approved = computed(() => events.value.filter(e => ['open', 'active', 'closed'].includes(e.status)).length)

async function load() {
  try {
    const data = await api.listEvents()
    events.value = data.events
  } catch {}
  loading.value = false
}

onMounted(load)

async function approve(e) {
  busy.value = true
  try { await api.approveEvent(e.id); showToast('已通过'); await load(); refreshPendingCount() }
  catch (err) { showToast(err.message, 'error') }
  busy.value = false
}

function startReject(e) {
  rejectTarget.value = e
  rejectReason.value = ''
}

async function doReject() {
  busy.value = true
  try {
    await api.rejectEvent(rejectTarget.value.id, rejectReason.value)
    showToast('已驳回')
    rejectTarget.value = null
    await load(); refreshPendingCount()
  } catch (err) { showToast(err.message, 'error') }
  busy.value = false
}
</script>

<style scoped>
.review-list { display: flex; flex-direction: column; gap: 12px; }
.review-item { border-left: 3px solid var(--c-pending); }

.plan-section {
  margin-top: 12px; border: 1px solid var(--c-primary); border-radius: 8px; overflow: hidden;
}
.plan-section-header {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px;
  background: rgba(79,70,229,.04); cursor: pointer; user-select: none;
  font-size: 13px; font-weight: 600;
}
.plan-section-header:hover { background: rgba(79,70,229,.08); }
.plan-section-icon { font-size: 16px; }
.plan-section-label { flex: 1; }
.plan-toggle { font-size: 12px; font-weight: 500; color: var(--c-primary); }
.plan-section-body {
  padding: 14px; font-size: 13px; line-height: 1.7;
  max-height: 400px; overflow-y: auto; border-top: 1px solid var(--c-border);
}
.plan-section-body h2 { font-size: 16px; font-weight: 700; margin: 12px 0 6px; }
.plan-section-body h3 { font-size: 14px; font-weight: 600; margin: 10px 0 4px; }

.plan-section-empty {
  display: flex; align-items: center; gap: 6px; margin-top: 10px;
  font-size: 12px; color: var(--c-text-3); padding: 8px 0;
}
.review-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
@media (max-width: 640px) {
  .review-header { flex-direction: column; align-items: flex-start; }
}
</style>
