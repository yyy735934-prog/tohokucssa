<template>
  <div v-if="loading" class="empty">加载中…</div>
  <div v-else-if="error" class="empty error">{{ error }}</div>
  <div v-else-if="event">
    <div class="page-header">
      <div><div class="eyebrow">组个局 · {{ categoryLabel }}</div><h1 class="page-title">{{ event.title }}</h1><p class="page-sub">{{ event.event_date }}<span v-if="event.location"> · {{ event.location }}</span></p></div>
      <div class="flex gap-8" style="flex-wrap:wrap">
        <a :href="`/g/${event.id}`" target="_blank" class="btn btn-outline btn-sm">公开页面 ↗</a>
        <button v-if="event.status === 'open' && !isLocked" class="btn btn-outline btn-sm lock" :disabled="busy" @click="setSignupLock(true)">锁定报名</button>
        <button v-if="event.status === 'open' && isLocked" class="btn btn-outline btn-sm unlock" :disabled="busy" @click="setSignupLock(false)">恢复报名</button>
        <button v-if="event.gathering_state === 'confirmed'" class="btn btn-primary btn-sm" @click="startEvent">开始活动</button>
        <button v-if="event.gathering_state === 'in_progress'" class="btn btn-danger btn-sm" @click="completeEvent">结束活动</button>
        <button v-if="!['completed','cancelled'].includes(event.gathering_state)" class="btn btn-outline btn-sm danger" @click="cancelEvent">取消组局</button>
      </div>
    </div>

    <div v-if="isLocked" class="card locked-banner mb-16">🔒 报名已锁定在 {{ event.lock_at }} 人；已有成员状态不受影响，其他人暂时不能加入。</div>

    <div class="state-grid mb-16">
      <div class="card stat"><strong>{{ stateLabel }}</strong><span>当前状态</span></div>
      <div class="card stat"><strong>{{ effectiveCount }} / {{ event.min_participants }}</strong><span>有效成局人数</span></div>
      <div class="card stat"><strong>{{ activeSignups.length }}</strong><span>全部参加意向</span></div>
      <div class="card stat"><strong>{{ ridePending.length }}</strong><span>乘车候补</span></div>
    </div>

    <div v-if="hostOffers.length" class="card host-card mb-16">
      <div class="section-head"><div><h2>候选主理人</h2><p>任意一人报名或通过邮件接单，即成为本周主理人</p></div></div>
      <div class="host-list"><span v-for="host in hostOffers" :key="host.user_id" :class="`host-${host.status}`"><strong>{{ host.display_name || host.email }}</strong> · {{ hostOfferLabel(host.status) }}</span></div>
    </div>

    <div v-if="event.gathering_state === 'arrangement_pending'" class="card attention mb-16">
      <div><h2>确认最终安排</h2><p>人数已经达标，请在截止时间前确认。<span v-if="event.arrangement_due_at">截止：{{ formatTime(event.arrangement_due_at) }}</span></p></div>
      <form @submit.prevent="finalize">
        <div class="form-row"><div class="field"><label class="label">最终时间 *</label><input v-model="finalForm.event_date" required /></div><div class="field"><label class="label">最终地点 *</label><input v-model="finalForm.location" required /></div></div>
        <div class="field"><label class="label">补充说明</label><textarea v-model="finalForm.notes" rows="3"></textarea></div>
        <button class="btn btn-primary" :disabled="busy">确认成局并通知成员</button>
      </form>
    </div>

    <div v-if="event.carpool_enabled" class="card mb-16">
      <div class="section-head"><div><h2>拼车分配</h2><p>乘客分配座位后才计入有效成局人数</p></div></div>
      <div v-if="!drivers.length" class="notice">目前还没有成员提供车辆。</div>
      <div v-if="ridePending.length" class="assignment-list">
        <div v-for="p in ridePending" :key="p.id" class="assignment-row">
          <div><strong>{{ p.name }}</strong><span>{{ p.email }}</span></div>
          <select v-model="assignments[p.id]"><option value="">选择司机</option><option v-for="d in drivers" :key="d.id" :value="d.id">{{ d.name }}（剩余 {{ driverRemaining(d) }} 位）</option></select>
          <button class="btn btn-primary btn-sm" :disabled="!assignments[p.id] || busy" @click="assign(p)">分配</button>
        </div>
      </div>
      <div v-else class="notice">当前没有乘车候补。</div>
      <div v-if="rideAssigned.length" class="assigned-list">
        <h3>已分配</h3>
        <div v-for="p in rideAssigned" :key="p.id" class="assigned-row"><span>{{ p.name }} → {{ p.assigned_driver_name }}</span><button class="btn btn-outline btn-sm" @click="unassign(p)">撤销</button></div>
      </div>
    </div>

    <div class="card">
      <div class="section-head"><div><h2>参加成员</h2><p>按候补和报名时间排序</p></div></div>
      <div v-if="!signups.length" class="empty">暂无成员</div>
      <div v-else class="table-wrap">
        <table><thead><tr><th>成员</th><th>参加状态</th><th>交通方式</th><th>座位/车辆</th><th>出席</th></tr></thead>
          <tbody><tr v-for="s in signups" :key="s.id" :class="{ muted: s.signup_status === 'cancelled' }">
            <td><strong>{{ s.name }}</strong><div class="sub">{{ s.email }}<span v-if="s.phone"> · {{ s.phone }}</span></div></td>
            <td><span class="badge">{{ signupLabel(s.signup_status) }}</span></td>
            <td>{{ transportLabel(s.transport_mode) }}</td>
            <td><template v-if="s.transport_mode === 'driver'">{{ s.seats_offered }} 位 · {{ s.vehicle_note || '无说明' }}</template><template v-else-if="s.signup_status === 'ride_assigned'">{{ s.assigned_driver_name }}</template><template v-else>—</template></td>
            <td><select class="attendance-select" :value="s.attendance_status" :disabled="!['joined','ride_assigned'].includes(s.signup_status)" @change="updateAttendance(s, $event.target.value)"><option value="pending">待签到</option><option value="attended">已签到</option><option value="excused">已请假</option><option value="no_show">未到场</option></select></td>
          </tr></tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../../api.js'
import { showToast } from '../../lib/toast.js'

const route = useRoute()
const event = ref(null)
const signups = ref([])
const hostOffers = ref([])
const effectiveCount = ref(0)
const loading = ref(true)
const error = ref('')
const busy = ref(false)
const assignments = reactive({})
const finalForm = reactive({ event_date: '', location: '', notes: '' })

const activeSignups = computed(() => signups.value.filter((s) => s.signup_status !== 'cancelled'))
const drivers = computed(() => signups.value.filter((s) => s.transport_mode === 'driver' && s.signup_status === 'joined'))
const ridePending = computed(() => signups.value.filter((s) => s.signup_status === 'ride_pending'))
const rideAssigned = computed(() => signups.value.filter((s) => s.signup_status === 'ride_assigned'))
const isLocked = computed(() => event.value?.lock_at !== null && event.value?.lock_at !== undefined)
const categoryLabel = computed(() => ({ karaoke: '唱歌', sport: '多人体育', outdoor: '徒步·户外', salon: '沙龙', boardgame: '桌游', movie: '观影', other: '其他' }[event.value?.gathering_category] || '组局'))
const stateLabel = computed(() => ({ recruiting: '组局中', arrangement_pending: '待确认安排', confirmed: '已成局', in_progress: '进行中', completed: '已结束', cancelled: '已取消' }[event.value?.gathering_state] || ''))

onMounted(load)

async function load() {
  loading.value = true
  try {
    const data = await api.getGatheringManage(route.params.id)
    event.value = data.event; signups.value = data.signups; hostOffers.value = data.host_offers || []; effectiveCount.value = data.effective_count
    finalForm.event_date = data.event.event_date || ''; finalForm.location = data.event.location || ''; finalForm.notes = data.event.notes || ''
  } catch (e) { error.value = e.message }
  loading.value = false
}

function driverRemaining(driver) { return Math.max(0, Number(driver.seats_offered || 0) - rideAssigned.value.filter((p) => p.assigned_driver_signup_id === driver.id).length) }
async function assign(passenger) { busy.value = true; try { await api.assignCarpool(event.value.id, passenger.id, Number(assignments[passenger.id])); showToast('乘车已分配'); await load() } catch (e) { showToast(e.message, 'error') } busy.value = false }
async function unassign(passenger) { busy.value = true; try { await api.unassignCarpool(event.value.id, passenger.id); showToast('已撤销乘车分配'); await load() } catch (e) { showToast(e.message, 'error') } busy.value = false }
async function finalize() { busy.value = true; try { await api.finalizeGathering(event.value.id, finalForm); showToast('最终安排已确认，正在通知成员'); await load() } catch (e) { showToast(e.message, 'error') } busy.value = false }
async function startEvent() { if (!confirm('确认开始活动？')) return; await api.startGathering(event.value.id); showToast('活动已开始'); await load() }
async function completeEvent() { if (!confirm('确认结束活动？未签到的确认成员将记录为未到场。')) return; await api.completeGathering(event.value.id); showToast('活动已结束'); await load() }
async function cancelEvent() { const reason = prompt('请输入取消原因'); if (reason === null) return; await api.cancelGatheringEvent(event.value.id, reason); showToast('组局已取消'); await load() }
async function setSignupLock(locked) {
  if (locked && !confirm(`锁定后将保留当前 ${activeSignups.value.length} 位参加者，并暂停其他人继续报名。确定锁定？`)) return
  busy.value = true
  try { await api.setSignupLock(event.value.id, locked); showToast(locked ? '报名已锁定' : '报名已恢复'); await load() }
  catch (e) { showToast(e.message, 'error') }
  busy.value = false
}
async function updateAttendance(signup, status) { try { await api.updateGatheringAttendance(event.value.id, signup.id, status); signup.attendance_status = status; signup.checked_in = status === 'attended' ? 1 : 0; showToast('出席状态已更新') } catch (e) { showToast(e.message, 'error'); await load() } }

const signupLabel = (v) => ({ joined: '已确认参加', ride_pending: '乘车候补中', ride_assigned: '已安排乘车', general_waitlist: '人数候补中', cancelled: '已退出' }[v] || v)
const transportLabel = (v) => ({ self: '自行前往', public_transport: '公共交通', driver: '提供车辆', passenger: '需要乘车' }[v] || v)
const attendanceLabel = (v) => ({ pending: '待签到', attended: '已签到', excused: '已请假', no_show: '未到场' }[v] || v)
const hostOfferLabel = (v) => ({ pending: '等待接单', accepted: '已接单', closed: '已有他人接单' }[v] || v)
function formatTime(ts) { return new Date(ts).toLocaleString('zh-CN', { timeZone: 'Asia/Tokyo' }) }
</script>

<style scoped>
.mb-16 { margin-bottom: 16px; }
.eyebrow { color: var(--c-primary); font-size: 12px; font-weight: 700; }
.danger { color: var(--c-danger); }
.lock { color: var(--c-warning); }.unlock { color: var(--c-success); }
.locked-banner { color: #92400e; background: #fffbeb; border-color: #f59e0b; font-size: 13px; }
.state-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; }
.stat { display: flex; flex-direction: column; gap: 5px; }
.stat strong { font-size: 19px; }.stat span { font-size: 12px; color: var(--c-text-2); }
.attention { border-color: #f59e0b; background: #fffbeb; }.attention h2, .section-head h2 { font-size: 17px; }.attention p, .section-head p { font-size: 13px; color: var(--c-text-2); margin-top: 4px; }
.attention form { margin-top: 16px; }.form-row { display: flex; gap: 12px; }.form-row .field { flex: 1; }
.section-head { display: flex; justify-content: space-between; margin-bottom: 14px; }
.notice { color: var(--c-text-2); font-size: 13px; padding: 12px; background: var(--c-bg); border-radius: 8px; }
.host-list { display: flex; flex-wrap: wrap; gap: 8px; }.host-list span { font-size: 12px; color: var(--c-text-2); background: var(--c-bg); border-radius: 99px; padding: 7px 10px; }.host-list .host-accepted { color: var(--c-success); background: var(--c-success-bg); }
.assignment-list, .assigned-list { display: flex; flex-direction: column; gap: 8px; }.assignment-row, .assigned-row { display: grid; grid-template-columns: 1fr 220px auto; gap: 10px; align-items: center; padding: 10px; border: 1px solid var(--c-border); border-radius: 8px; }.assignment-row div { display: flex; flex-direction: column; }.assignment-row span, .sub { font-size: 12px; color: var(--c-text-2); }.assigned-list { margin-top: 16px; }.assigned-list h3 { font-size: 14px; }.assigned-row { grid-template-columns: 1fr auto; }
.muted { opacity: .5; }.sub { margin-top: 3px; }.attendance-select { min-width: 92px; padding: 6px 8px; font-size: 12px; }
@media (max-width: 760px) { .state-grid { grid-template-columns: repeat(2,1fr); }.form-row { flex-direction: column; gap: 0; }.assignment-row { grid-template-columns: 1fr; } }
</style>
