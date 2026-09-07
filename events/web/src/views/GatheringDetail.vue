<template>
  <div class="page">
    <div v-if="loading" class="empty">加载中…</div>
    <div v-else-if="error" class="empty error">{{ error }}</div>
    <template v-else-if="gathering">
      <div class="card mb hero-card">
        <div class="topline">
          <span class="category">{{ gathering.event_subtype === 'date_choice' ? '选日期组局' : '定日期组局' }} · {{ categoryLabel }}</span>
          <span class="state" :class="`state-${gathering.gathering_state}`">{{ stateLabel }}</span>
        </div>
        <h1>{{ gathering.title }}</h1>
        <div class="meta">{{ gathering.event_subtype === 'date_choice' ? '请选择下方一个或多个日期' : gathering.event_date }}<span v-if="gathering.location"> · {{ gathering.location }}</span></div>
        <p v-if="gathering.content" class="content">{{ gathering.content }}</p>
        <div v-if="gathering.notes" class="notes"><strong>参加须知</strong><p>{{ gathering.notes }}</p></div>
      </div>

      <div v-if="gathering.image_key" class="card mb event-image-card">
        <img :src="`/api/images/serve/${gathering.id}?v=${encodeURIComponent(gathering.image_key)}`" :alt="`${gathering.title}活动图片`" class="event-image" />
      </div>

      <div v-if="gathering.event_subtype === 'date_choice'" class="card mb occurrence-card">
        <h2>未来可选日期</h2>
        <p v-if="!auth.isLoggedIn || auth.login_method !== 'google'" class="form-hint">使用 Google 登录后可选择日期，人数在选择前始终可见。</p>
        <p v-if="formError" class="error">{{ formError }}</p>
        <div v-for="o in occurrences" :key="o.id" class="occurrence-row">
          <div><strong>{{ o.event_date }}</strong><p>{{ o.selected_count }} / {{ o.max_participants || '不限' }} 人 · {{ occurrenceText(o) }}</p></div>
          <router-link v-if="o.selected_by_me && o.state === 'confirmed'" :to="`/g/${gathering.id}/chat?occurrence_id=${o.id}`" class="btn btn-primary btn-sm">进入本次群聊</router-link>
          <button v-else-if="o.selected_by_me" class="btn btn-outline btn-sm" :disabled="busy || o.registration_locked_at" @click="toggleOccurrence(o, false)">取消该日期</button>
          <button v-else class="btn btn-primary btn-sm" :disabled="busy || !canSelectOccurrence(o)" @click="toggleOccurrence(o, true)">我可以参加</button>
        </div>
        <a v-if="!auth.isLoggedIn || auth.login_method !== 'google'" :href="googleLoginUrl" class="btn btn-primary">使用 Google 登录</a>
      </div>

      <div v-if="gathering.event_subtype !== 'date_choice'" class="card mb formation-card">
        <div class="formation-head">
          <div><strong>{{ gathering.effective_count }}</strong> / {{ gathering.min_participants }} 人</div>
          <span v-if="gathering.gathering_state === 'recruiting' && remaining > 0">还差 {{ remaining }} 人成局</span>
          <span v-else-if="gathering.gathering_state === 'recruiting' && gathering.requires_host && !gathering.has_host">人数已达标，等待主理人接单</span>
          <span v-else-if="gathering.gathering_state === 'arrangement_pending'">人数已达标</span>
          <span v-else-if="gathering.gathering_state === 'confirmed'">已经成局</span>
        </div>
        <div class="progress"><div class="progress-fill" :style="{ width: progress + '%' }"></div></div>
        <div class="formation-meta">
          <span>{{ gathering.interest_count }} 人已表达参加意向</span>
          <span v-if="gathering.formation_deadline">{{ formatDate(gathering.formation_deadline) }} 判定是否成局</span>
        </div>
        <div v-if="gathering.gathering_state === 'arrangement_pending'" class="pending-note">
          正在等待{{ gathering.host_name ? `主理人 ${gathering.host_name}` : '管理员' }}确认最终安排
          <span v-if="gathering.arrangement_due_at">，截止 {{ formatDate(gathering.arrangement_due_at) }}</span>
        </div>
      </div>

      <div v-if="mySignup?.schedule_reconfirm_status === 'pending'" class="card mb reconfirm-card">
        <div><div class="eyebrow">活动时间已发生变化</div><h2>新时间：{{ gathering.event_date }}</h2><p>未重新确认前，你不计入成局人数。</p></div>
        <div class="flex gap-8"><button class="btn btn-primary btn-sm" :disabled="busy" @click="reconfirm('keep')">继续参加</button><button class="btn btn-outline btn-sm danger" :disabled="busy" @click="reconfirm('leave')">无法参加</button></div>
      </div>

      <div v-if="gathering.event_subtype !== 'date_choice' && mySignup && mySignup.signup_status !== 'cancelled'" class="card mb my-status">
        <div>
          <div class="eyebrow">我的状态</div>
          <h2>{{ signupStatusLabel }}</h2>
          <p v-if="mySignup.signup_status === 'ride_pending'">等待主理人为你分配车辆；分配前不计入成局人数。</p>
          <p v-if="mySignup.signup_status === 'ride_assigned'">司机：{{ mySignup.driver_name }}<span v-if="mySignup.driver_vehicle_note"> · {{ mySignup.driver_vehicle_note }}</span></p>
          <p v-if="mySignup.signup_status === 'general_waitlist'">当前普通名额已满，将按报名顺序候补。</p>
        </div>
        <button v-if="canCancel" class="btn btn-outline btn-sm danger" :disabled="busy" @click="cancelSignup">退出组局</button>
        <router-link v-if="gathering.gathering_state === 'confirmed' && ['joined','ride_assigned'].includes(mySignup.signup_status)" :to="`/g/${gathering.id}/chat`" class="btn btn-primary btn-sm">进入活动群聊</router-link>
      </div>

      <div v-else-if="canJoin" class="card join-card">
        <template v-if="!auth.isLoggedIn || auth.login_method !== 'google'">
          <h2>使用 Google 登录后参加</h2>
          <p>组局报名、候补、乘车安排和出席记录都与本人账号绑定。</p>
          <a :href="googleLoginUrl" class="btn btn-primary">使用 Google 登录</a>
        </template>
        <form v-else @submit.prevent="join">
          <h2>参加这个组局</h2>
          <p class="form-hint">将使用账号 {{ auth.email }} 报名</p>
          <div v-if="myHostOfferStatus === 'pending'" class="host-offer-note">你是本周候选主理人，确认参加将同时视为同意接单。</div>

          <div v-if="gathering.carpool_enabled" class="field">
            <label class="label">交通方式</label>
            <div class="transport-grid">
              <label v-for="option in transportOptions" :key="option.value" :class="{ selected: form.transport_mode === option.value }">
                <input v-model="form.transport_mode" type="radio" :value="option.value" />
                <strong>{{ option.label }}</strong><span>{{ option.desc }}</span>
              </label>
            </div>
          </div>

          <template v-if="form.transport_mode === 'driver'">
            <div class="field">
              <label class="label">可搭载人数 *</label>
              <input v-model.number="form.seats_offered" type="number" min="1" max="8" required />
            </div>
            <div class="field">
              <label class="label">车辆说明</label>
              <input v-model="form.vehicle_note" placeholder="如：白色五座轿车、集合点等" />
            </div>
          </template>

          <div v-if="form.transport_mode === 'passenger'" class="ride-notice">提交后将显示“乘车候补中”，获分配座位后才计入有效成局人数。</div>
          <p v-if="formError" class="error">{{ formError }}</p>
          <button class="btn btn-primary" type="submit" :disabled="busy">{{ busy ? '提交中…' : myHostOfferStatus === 'pending' ? '确认参加并接单' : '确认参加' }}</button>
        </form>
      </div>

      <div v-else-if="gathering.lock_at !== null && gathering.lock_at !== undefined" class="card result-card">
        <h2>报名暂时锁定</h2><p>主理人或管理员已暂停接受新成员，现有参加状态不受影响。</p>
      </div>

      <div v-else-if="gathering.gathering_state === 'cancelled'" class="card result-card">
        <h2>本次未能成局</h2><p>{{ gathering.cancel_reason }}</p>
      </div>

      <router-link to="/" class="back-link">← 返回活动列表</router-link>
      <FloatingChatEntry v-if="chatEntries.length" :entries="chatEntries" />
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api.js'
import { auth } from '../auth.js'
import FloatingChatEntry from '../components/FloatingChatEntry.vue'

const route = useRoute()
const gathering = ref(null)
const mySignup = ref(null)
const myHostOfferStatus = ref(null)
const occurrences = ref([])
const loading = ref(true)
const error = ref('')
const formError = ref('')
const busy = ref(false)
const form = reactive({ transport_mode: 'self', seats_offered: 1, vehicle_note: '' })

const categories = { karaoke: '唱歌', sport: '多人体育', outdoor: '徒步·户外', salon: '沙龙', boardgame: '桌游', movie: '观影', other: '其他' }
const states = { recruiting: '组局中', arrangement_pending: '待确认安排', confirmed: '已成局', in_progress: '进行中', completed: '已结束', cancelled: '已取消' }
const signupStates = { joined: '已确认参加', ride_pending: '乘车候补中', ride_assigned: '已安排乘车', general_waitlist: '人数候补中', cancelled: '已退出' }
const transportOptions = [
  { value: 'self', label: '自行前往', desc: '自己到达集合地点' },
  { value: 'public_transport', label: '公共交通', desc: '乘坐公共交通前往' },
  { value: 'driver', label: '我可以开车', desc: '愿意搭载其他成员' },
  { value: 'passenger', label: '需要乘车', desc: '等待主理人分配座位' },
]

const categoryLabel = computed(() => categories[gathering.value?.gathering_category] || '组局')
const stateLabel = computed(() => states[gathering.value?.gathering_state] || '')
const signupStatusLabel = computed(() => signupStates[mySignup.value?.signup_status] || '')
const remaining = computed(() => Math.max(0, (gathering.value?.min_participants || 0) - (gathering.value?.effective_count || 0)))
const progress = computed(() => Math.min(100, (gathering.value?.effective_count || 0) / (gathering.value?.min_participants || 1) * 100))
const canJoin = computed(() => gathering.value?.event_subtype !== 'date_choice' && gathering.value?.lock_at === null && ['recruiting', 'arrangement_pending', 'confirmed'].includes(gathering.value?.gathering_state))
const canCancel = computed(() => !['completed', 'cancelled'].includes(gathering.value?.gathering_state) && !mySignup.value?.checked_in)
const googleLoginUrl = computed(() => `/api/auth/google?from=public&return_to=${encodeURIComponent(`/g/${route.params.id}`)}`)
const chatEntries = computed(() => {
  if (!gathering.value) return []
  if (gathering.value.event_subtype === 'date_choice') {
    return occurrences.value
      .filter((o) => o.selected_by_me && ['confirmed', 'in_progress'].includes(o.state))
      .map((o) => ({ eventId: gathering.value.id, occurrenceId: o.id, label: `${o.event_date} 群聊`, to: `/g/${gathering.value.id}/chat?occurrence_id=${o.id}` }))
  }
  if (!['confirmed', 'in_progress'].includes(gathering.value.gathering_state) || !['joined', 'ride_assigned'].includes(mySignup.value?.signup_status)) return []
  return [{ eventId: gathering.value.id, label: `${gathering.value.title}群聊`, to: `/g/${gathering.value.id}/chat` }]
})

onMounted(load)

async function load() {
  loading.value = true
  try {
    const data = await api.getGathering(route.params.id)
    gathering.value = data.gathering
    mySignup.value = data.my_signup
    myHostOfferStatus.value = data.my_host_offer_status
    if (gathering.value.event_subtype === 'date_choice') occurrences.value = (await api.getOccurrences(route.params.id)).occurrences
  } catch (e) { error.value = e.message }
  loading.value = false
}

function canSelectOccurrence(o) {
  return auth.isLoggedIn && auth.login_method === 'google' && ['recruiting', 'confirmed'].includes(o.state) && !o.registration_locked_at && (!o.max_participants || o.selected_count < o.max_participants)
}
function occurrenceText(o) {
  if (o.state === 'confirmed') return '已成局'
  if (o.state === 'cancelled') return '未成局'
  if (o.registration_locked_at) return '报名已截止'
  return `还差 ${Math.max(0, o.min_participants - o.selected_count)} 人成局`
}
async function toggleOccurrence(o, selected) {
  busy.value = true; formError.value = ''
  try { if (selected) await api.selectOccurrence(gathering.value.id, o.id); else await api.cancelOccurrence(gathering.value.id, o.id); await load() }
  catch (e) { formError.value = e.message }
  busy.value = false
}

async function join() {
  formError.value = ''
  busy.value = true
  try {
    const data = await api.joinGathering(route.params.id, form)
    mySignup.value = data.signup
    await load()
  } catch (e) { formError.value = e.message }
  busy.value = false
}

async function cancelSignup() {
  if (!confirm('确定退出这个组局？活动前两天内退出会记录为临时取消。')) return
  busy.value = true
  try {
    await api.cancelGatheringSignup(route.params.id)
    await load()
  } catch (e) { formError.value = e.message }
  busy.value = false
}

async function reconfirm(action) { busy.value = true; formError.value = ''; try { await api.submitReconfirm(mySignup.value.schedule_reconfirm_token, action); await load() } catch (e) { formError.value = e.message } busy.value = false }

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.mb { margin-bottom: 16px; }
.hero-card h1 { font-size: 24px; margin-top: 8px; }
.event-image-card { padding: 0; overflow: hidden; }.event-image { display: block; width: 100%; height: auto; max-height: 520px; object-fit: cover; }
.topline, .formation-head, .formation-meta, .my-status { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.category { color: var(--c-primary); font-size: 13px; font-weight: 700; }
.state { font-size: 12px; font-weight: 700; border-radius: 99px; padding: 5px 10px; background: var(--c-bg); }
.state-confirmed { color: var(--c-success); background: var(--c-success-bg); }
.state-arrangement_pending { color: #b45309; background: #fef3c7; }
.meta, .content, .notes { margin-top: 8px; color: var(--c-text-2); line-height: 1.6; }
.content { white-space: pre-wrap; color: var(--c-text); }
.notes, .pending-note, .ride-notice, .host-offer-note { background: var(--c-bg); border-radius: 8px; padding: 12px; font-size: 13px; }
.host-offer-note { margin: 12px 0; color: #166534; background: var(--c-success-bg); }
.reconfirm-card { border-color:#f59e0b; background:#fffbeb; display:flex; align-items:center; justify-content:space-between; gap:16px; }.reconfirm-card h2 { font-size:17px; margin-top:4px; }.reconfirm-card p { color:var(--c-text-2); font-size:13px; margin-top:4px; }
.formation-head strong { color: var(--c-primary); font-size: 28px; }
.formation-head span, .formation-meta { color: var(--c-text-2); font-size: 13px; }
.progress { height: 8px; background: var(--c-border); border-radius: 99px; overflow: hidden; margin: 12px 0; }
.progress-fill { height: 100%; background: var(--c-primary); border-radius: inherit; }
.pending-note { margin-top: 14px; color: #92400e; background: #fffbeb; }
.eyebrow { color: var(--c-text-3); font-size: 12px; }
.my-status h2, .join-card h2 { font-size: 18px; margin-top: 3px; }
.my-status p, .join-card > p, .form-hint { font-size: 13px; color: var(--c-text-2); margin-top: 6px; }
.danger { color: var(--c-danger); }
.join-card .btn { margin-top: 16px; }
.transport-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.transport-grid label { display: flex; flex-direction: column; gap: 3px; border: 1px solid var(--c-border); border-radius: 8px; padding: 12px; cursor: pointer; }
.transport-grid label.selected { border-color: var(--c-primary); background: rgba(79,70,229,.04); }
.transport-grid input { width: auto; align-self: flex-start; }
.transport-grid strong { font-size: 14px; }
.transport-grid span { font-size: 12px; color: var(--c-text-3); }
.ride-notice { margin-bottom: 12px; color: #92400e; background: #fffbeb; }
.result-card { text-align: center; }
.occurrence-card h2{font-size:18px;margin-bottom:12px}.occurrence-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 0;border-top:1px solid var(--c-border)}.occurrence-row p{font-size:13px;color:var(--c-text-2);margin-top:4px}
.back-link { display: block; text-align: center; color: var(--c-text-2); font-size: 13px; margin-top: 24px; }
@media (max-width: 520px) { .transport-grid { grid-template-columns: 1fr; } .my-status { align-items: flex-start; flex-direction: column; } }
</style>
