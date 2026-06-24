<template>
  <div class="container">
    <div v-if="loadError" class="empty-state" style="color:var(--c-danger)">{{ loadError }}</div>
    <div v-else-if="!event" class="empty-state">加载中…</div>
    <template v-else>
      <div class="mb-16">
        <router-link to="/" style="font-size:13px">← 返回我的活动</router-link>
      </div>

      <!-- 头部 -->
      <div class="flex-between mb-16">
        <div>
          <h1 style="font-size:20px">{{ event.title }}</h1>
          <div class="event-meta">{{ event.event_date }}<span v-if="event.location"> · {{ event.location }}</span></div>
        </div>
        <span class="badge" :class="`badge-${event.status}`">{{ statusLabel[event.status] }}</span>
      </div>

      <!-- 状态流程 -->
      <div class="status-flow card mb-16">
        <div v-for="(s, i) in steps" :key="s.key" class="flow-step" :class="{ done: s.done, current: s.current }">
          <div class="flow-dot"></div>
          <span class="flow-label">{{ s.label }}</span>
          <div v-if="i < steps.length - 1" class="flow-line" :class="{ done: steps[i+1].done || steps[i+1].current }"></div>
        </div>
      </div>

      <!-- 驳回提示 -->
      <div v-if="event.status==='draft' && event.reject_reason" class="card reject-box mb-16">
        <strong>审核驳回:</strong> {{ event.reject_reason }}
      </div>

      <!-- 操作栏 -->
      <div class="card mb-16">
        <div class="flex gap-8" style="flex-wrap:wrap">
          <button v-if="event.status==='draft'" class="btn-primary" @click="submit" :disabled="busy">提交审核</button>
          <router-link v-if="event.status==='draft'" :to="`/events/${event.id}/edit`"><button class="btn-outline">编辑</button></router-link>
          <button v-if="event.status==='pending'" class="btn-outline" @click="withdraw" :disabled="busy">撤回</button>
          <button v-if="event.status==='open'" class="btn-outline" @click="copy('signup')">复制报名链接</button>
          <button v-if="event.status==='open'" class="btn-outline" @click="copy('checkin')">复制签到链接</button>
          <button v-if="event.status==='open'" class="btn-primary" @click="activate" :disabled="busy">开始活动</button>
          <button v-if="event.status==='active'" class="btn-outline" @click="copy('checkin')">复制签到链接</button>
          <button v-if="event.status==='active'" class="btn-primary" @click="doClose" :disabled="busy">结束活动</button>
          <button class="btn-outline btn-sm" @click="duplicate" :disabled="busy">复制活动</button>
          <button v-if="event.status==='draft'" class="btn-danger btn-sm" @click="remove" :disabled="busy">删除</button>
        </div>
      </div>

      <!-- 活动详情 -->
      <div v-if="event.content || event.notes" class="card mb-16">
        <div v-if="event.content" style="white-space:pre-wrap;margin-bottom:12px">{{ event.content }}</div>
        <div v-if="event.notes" style="white-space:pre-wrap;font-size:13px;color:var(--c-text-secondary)">{{ event.notes }}</div>
      </div>

      <!-- 报名统计 -->
      <div class="card mb-16">
        <div class="flex-between mb-16">
          <h2 style="font-size:16px">
            报名名单
            <span style="font-weight:400;color:var(--c-text-secondary)">
              ({{ signups.length }}{{ event.capacity ? `/${event.capacity}` : '' }} 人报名<span v-if="checkedCount">, {{ checkedCount }} 人已签到</span>)
            </span>
          </h2>
          <div class="flex gap-8">
            <button v-if="signups.length && uncheckedCount && ['active','open'].includes(event.status)" class="btn-outline btn-sm" @click="batchCheckin" :disabled="busy">全部签到</button>
            <button v-if="signups.length" class="btn-outline btn-sm" @click="exportCSV">导出</button>
          </div>
        </div>

        <!-- 签到进度 -->
        <div v-if="signups.length && ['active','closed'].includes(event.status)" class="checkin-bar mb-16">
          <div class="flex-between" style="font-size:12px;color:var(--c-text-secondary);margin-bottom:4px">
            <span>签到进度</span>
            <span>{{ checkedCount }}/{{ signups.length }}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: (checkedCount/signups.length*100)+'%' }"></div>
          </div>
        </div>

        <div v-if="!signups.length" class="empty-state" style="padding:24px">暂无报名</div>
        <div v-else class="table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>#</th><th>姓名</th><th>邮箱</th><th>手机</th><th>报名时间</th><th>签到</th><th>操作</th></tr>
            </thead>
            <tbody>
              <tr v-for="(s, i) in signups" :key="s.id">
                <td>{{ i+1 }}</td>
                <td>{{ s.name }}</td>
                <td>{{ s.email }}</td>
                <td>{{ s.phone || '-' }}</td>
                <td style="white-space:nowrap">{{ formatTime(s.created_at) }}</td>
                <td>
                  <span v-if="s.checked_in" class="badge badge-open">已签到</span>
                  <button v-else class="btn-outline btn-sm" @click="checkin(s.id)">签到</button>
                </td>
                <td><button class="btn-sm btn-text-danger" @click="removeSignup(s.id)">删除</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../../services/api.js'
import { toast } from '../../lib/toast.js'
import { formatTime } from '../../lib/format.js'

const route = useRoute()
const router = useRouter()
const event = ref(null)
const signups = ref([])
const busy = ref(false)
const loadError = ref('')
const statusLabel = { draft: '草稿', pending: '待审核', open: '报名中', active: '进行中', closed: '已结束' }

const checkedCount = computed(() => signups.value.filter(s => s.checked_in).length)
const uncheckedCount = computed(() => signups.value.filter(s => !s.checked_in).length)

const allSteps = ['draft', 'pending', 'open', 'active', 'closed']
const stepLabels = { draft: '草稿', pending: '审核中', open: '报名中', active: '进行中', closed: '已结束' }
const steps = computed(() => {
  if (!event.value) return []
  const idx = allSteps.indexOf(event.value.status)
  return allSteps.map((key, i) => ({
    key,
    label: stepLabels[key],
    done: i < idx,
    current: i === idx
  }))
})

async function load() {
  try {
    const data = await api.getEvent(route.params.id)
    event.value = data.event
    try {
      const s = await api.listSignups(route.params.id)
      signups.value = s.signups
    } catch { signups.value = [] }
  } catch (e) {
    loadError.value = e.message || '加载失败'
  }
}

onMounted(load)

async function submit() {
  busy.value = true
  try { await api.submitEvent(event.value.id); await load(); toast('已提交审核') } catch (e) { toast(e.message, 'error') }
  busy.value = false
}

async function withdraw() {
  busy.value = true
  try { await api.withdrawEvent(event.value.id); await load(); toast('已撤回') } catch (e) { toast(e.message, 'error') }
  busy.value = false
}

async function activate() {
  if (!confirm('确定开始活动? 将关闭报名入口')) return
  busy.value = true
  try { await api.activateEvent(event.value.id); await load(); toast('活动已开始') } catch (e) { toast(e.message, 'error') }
  busy.value = false
}

async function doClose() {
  if (!confirm('确定结束活动?')) return
  busy.value = true
  try { await api.closeEvent(event.value.id); await load(); toast('活动已结束') } catch (e) { toast(e.message, 'error') }
  busy.value = false
}

async function remove() {
  if (!confirm('确定删除此活动?')) return
  busy.value = true
  try { await api.deleteEvent(event.value.id); toast('已删除'); router.push('/') } catch (e) { toast(e.message, 'error') }
  busy.value = false
}

async function duplicate() {
  busy.value = true
  try {
    const data = await api.duplicateEvent(event.value.id)
    toast('已复制,跳转到新活动')
    router.push(`/events/${data.id}`)
  } catch (e) { toast(e.message, 'error') }
  busy.value = false
}

async function batchCheckin() {
  if (!confirm(`确定将 ${uncheckedCount.value} 人全部签到?`)) return
  busy.value = true
  try {
    const data = await api.batchCheckin(event.value.id)
    await load()
    toast(`已签到 ${data.count} 人`)
  } catch (e) { toast(e.message, 'error') }
  busy.value = false
}

function copy(type) {
  const url = `${location.origin}/${type}/${event.value.id}`
  navigator.clipboard.writeText(url)
  toast(`已复制${type === 'signup' ? '报名' : '签到'}链接`)
}

async function checkin(id) {
  try { await api.checkin(id); await load(); toast('已签到') } catch (e) { toast(e.message, 'error') }
}

async function removeSignup(id) {
  if (!confirm('确定删除此报名?')) return
  try { await api.deleteSignup(id); await load(); toast('已删除') } catch (e) { toast(e.message, 'error') }
}

async function exportCSV() {
  const res = await api.exportSignups(event.value.id)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${event.value.title}_报名.csv`
  a.click(); URL.revokeObjectURL(url)
}
</script>

<style scoped>
.event-meta { font-size: 13px; color: var(--c-text-secondary); margin-top: 4px; }
.reject-box { background: var(--c-danger-light); color: var(--c-danger); font-size: 14px; }

.status-flow { display: flex; align-items: center; padding: 16px 20px; gap: 0; overflow-x: auto; }
.flow-step { display: flex; align-items: center; white-space: nowrap; }
.flow-dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: var(--c-border); flex-shrink: 0;
  transition: all .2s;
}
.flow-step.done .flow-dot { background: var(--c-success); }
.flow-step.current .flow-dot { background: var(--c-primary); box-shadow: 0 0 0 3px var(--c-primary-light); }
.flow-label { font-size: 12px; color: var(--c-text-secondary); margin-left: 6px; }
.flow-step.current .flow-label { color: var(--c-primary); font-weight: 600; }
.flow-step.done .flow-label { color: var(--c-success); }
.flow-line {
  width: 32px; height: 2px; background: var(--c-border);
  margin: 0 4px; flex-shrink: 0;
}
.flow-line.done { background: var(--c-success); }

.progress-bar { height: 6px; background: var(--c-border); border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--c-primary); border-radius: 3px; transition: width .3s; }

.table-wrap { overflow-x: auto; margin: 0 -16px; padding: 0 16px; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 600px; }
.data-table th, .data-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--c-border); }
.data-table th { font-weight: 600; color: var(--c-text-secondary); font-size: 12px; }
.btn-text-danger { color: var(--c-danger); background: none; padding: 4px 8px; }
</style>
