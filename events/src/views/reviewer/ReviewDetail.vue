<template>
  <div class="container">
    <div v-if="!event" class="empty-state">{{ loadError || '加载中…' }}</div>
    <template v-else>
      <div class="mb-16">
        <router-link to="/review" style="font-size:13px">← 返回审核队列</router-link>
      </div>

      <div class="card mb-16">
        <div class="flex-between mb-16">
          <h1 style="font-size:20px">{{ event.title }}</h1>
          <span class="badge" :class="`badge-${event.status}`">{{ statusLabel[event.status] }}</span>
        </div>
        <div class="detail-grid">
          <div><label>时间</label><p>{{ event.event_date }}</p></div>
          <div><label>地点</label><p>{{ event.location || '未填写' }}</p></div>
          <div v-if="event.capacity"><label>人数上限</label><p>{{ event.capacity }}</p></div>
          <div><label>报名人数</label><p>{{ signups.length }}{{ event.capacity ? `/${event.capacity}` : '' }}</p></div>
          <div v-if="event.creator_name || event.creator_email"><label>创建者</label><p>{{ event.creator_name || event.creator_email }}</p></div>
        </div>
        <div v-if="event.content" class="mt-16" style="white-space:pre-wrap">{{ event.content }}</div>
        <div v-if="event.notes" class="mt-16" style="white-space:pre-wrap;font-size:13px;color:var(--c-text-secondary)">{{ event.notes }}</div>
      </div>

      <!-- 报名名单 -->
      <div class="card mb-16">
        <div class="flex-between mb-16">
          <h2 style="font-size:16px">
            报名名单
            <span v-if="checkedCount" style="font-weight:400;color:var(--c-text-secondary)">({{ checkedCount }}/{{ signups.length }} 已签到)</span>
          </h2>
          <div class="flex gap-8">
            <button v-if="signups.length && uncheckedCount && ['active','open'].includes(event.status)" class="btn-outline btn-sm" @click="batchCheckin" :disabled="busy">全部签到</button>
            <button v-if="signups.length" class="btn-outline btn-sm" @click="exportCSV">导出</button>
          </div>
        </div>

        <div v-if="signups.length && ['active','closed'].includes(event.status)" class="checkin-bar mb-16">
          <div class="flex-between" style="font-size:12px;color:var(--c-text-secondary);margin-bottom:4px">
            <span>签到进度</span>
            <span>{{ checkedCount }}/{{ signups.length }}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: (checkedCount/signups.length*100)+'%' }"></div>
          </div>
        </div>

        <div v-if="!signups.length" class="empty-state" style="padding:16px">暂无报名</div>
        <div v-else class="table-wrap">
          <table class="data-table">
            <thead><tr><th>#</th><th>姓名</th><th>邮箱</th><th>手机</th><th>报名时间</th><th>签到</th><th>操作</th></tr></thead>
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

      <!-- 操作 -->
      <div class="card">
        <h2 style="font-size:16px;margin-bottom:16px">操作</h2>
        <div v-if="event.status==='pending'" class="flex gap-8" style="flex-wrap:wrap">
          <button class="btn-primary" @click="approve" :disabled="busy">通过</button>
          <button class="btn-danger" @click="showReject=true" :disabled="busy">驳回</button>
        </div>
        <div v-else-if="event.status==='open'" class="flex gap-8" style="flex-wrap:wrap">
          <button class="btn-primary" @click="doActivate" :disabled="busy">开始活动</button>
          <button class="btn-outline" @click="copyLink('signup')">复制报名链接</button>
          <button class="btn-outline" @click="copyLink('checkin')">复制签到链接</button>
        </div>
        <div v-else-if="event.status==='active'" class="flex gap-8" style="flex-wrap:wrap">
          <button class="btn-primary" @click="doClose" :disabled="busy">结束活动</button>
          <button class="btn-outline" @click="copyLink('checkin')">复制签到链接</button>
        </div>
        <div v-else-if="event.status==='closed'" class="flex gap-8" style="flex-wrap:wrap;align-items:center">
          <span style="color:var(--c-text-secondary);font-size:14px">活动已结束</span>
          <button class="btn-outline btn-sm" @click="duplicate" :disabled="busy">复制活动</button>
        </div>
        <div v-else-if="event.status==='draft'" class="flex gap-8" style="flex-wrap:wrap;align-items:center">
          <span style="color:var(--c-text-secondary);font-size:14px">草稿状态,等待主理人提交审核</span>
          <button class="btn-outline btn-sm" @click="duplicate" :disabled="busy">复制活动</button>
        </div>
        <div v-if="showReject" class="mt-16">
          <div class="form-group">
            <label>驳回原因</label>
            <textarea v-model="rejectReason" rows="2" placeholder="告诉主理人需要修改什么"></textarea>
          </div>
          <button class="btn-danger" @click="reject" :disabled="busy">确认驳回</button>
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
const showReject = ref(false)
const rejectReason = ref('')
const statusLabel = { draft: '草稿', pending: '待审核', open: '报名中', active: '进行中', closed: '已结束' }
const checkedCount = computed(() => signups.value.filter(s => s.checked_in).length)
const uncheckedCount = computed(() => signups.value.filter(s => !s.checked_in).length)

async function load() {
  try {
    const data = await api.getEvent(route.params.id)
    event.value = data.event
    const s = await api.listSignups(route.params.id)
    signups.value = s.signups
  } catch (e) {
    loadError.value = e.message
    signups.value = []
  }
}

onMounted(load)

async function exportCSV() {
  const res = await api.exportSignups(event.value.id)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${event.value.title}_报名.csv`
  a.click(); URL.revokeObjectURL(url)
}

async function approve() {
  busy.value = true
  try { await api.approveEvent(event.value.id); toast('已通过'); router.push('/review') } catch (e) { toast(e.message, 'error') }
  busy.value = false
}

async function reject() {
  busy.value = true
  try { await api.rejectEvent(event.value.id, rejectReason.value); toast('已驳回'); router.push('/review') } catch (e) { toast(e.message, 'error') }
  busy.value = false
}

async function doActivate() {
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

function copyLink(type) {
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
</script>

<style scoped>
.detail-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.detail-grid label { font-size: 12px; color: var(--c-text-secondary); }
.detail-grid p { font-size: 14px; margin-top: 2px; }
.progress-bar { height: 6px; background: var(--c-border); border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--c-primary); border-radius: 3px; transition: width .3s; }
.table-wrap { overflow-x: auto; margin: 0 -16px; padding: 0 16px; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 600px; }
.data-table th, .data-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--c-border); }
.data-table th { font-weight: 600; color: var(--c-text-secondary); font-size: 12px; }
.btn-text-danger { color: var(--c-danger); background: none; padding: 4px 8px; }
</style>
