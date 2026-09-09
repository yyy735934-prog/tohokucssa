<template>
  <div class="page">
    <div v-if="!event" class="empty">{{ error || '加载中…' }}</div>
    <template v-else>
      <header class="event-hero">
        <div class="hero-kicker"><span>{{ event.event_subtype === 'assisted' ? '协助活动' : '学友会活动' }}</span><span>{{ statusText }}</span></div>
        <h1>{{ event.title }}</h1>
        <p>{{ event.event_date }}<span v-if="event.location"> · {{ event.location }}</span></p>
        <div class="hero-facts"><b>{{ chatToken ? '✓ 已报名' : chatReady ? '活动管理' : statusText }}</b><span><strong>{{ event.signupCount }}</strong>{{ effectiveCap ? ` / ${effectiveCap}` : '' }} 人参加</span></div>
      </header>
      <nav class="event-tabs" aria-label="活动内容">
        <button :class="{ active: activeTab === 'detail' }" @click="selectTab('detail')">详情</button>
        <button :class="{ active: activeTab === 'discussion' }" @click="selectTab('discussion')">讨论 <span v-if="unreadCount">{{ unreadCount > 99 ? '99+' : unreadCount }}</span></button>
        <button :class="{ active: activeTab === 'people' }" @click="selectTab('people')">参与者</button>
      </nav>
      <section v-show="activeTab === 'detail'" class="event-tab-panel">
      <!-- Event Info -->
      <div v-if="event.content || event.notes" class="card mb">
        <div v-if="event.content" class="content">{{ event.content }}</div>
        <div v-if="event.notes" class="notes"><b>📌 最新通知</b><small>主办方</small><p>{{ event.notes }}</p></div>
      </div>

      <!-- Event Image -->
      <div v-if="event.image_key" class="card mb event-image-card">
        <img :src="`/api/images/serve/${event.id}?v=${encodeURIComponent(event.image_key)}`" alt="活动图片" class="event-image" />
      </div>

      <!-- Signup count roster -->
      <div class="card mb roster-card">
        <div class="roster-head">
          <h3>已确认参加 <strong>{{ event.signupCount }}</strong> {{ effectiveCap ? `/ ${effectiveCap}` : '' }} 位</h3>
          <span class="roster-hint">为保护隐私，不显示姓名</span>
        </div>
        <div v-if="effectiveCap" class="roster-progress">
          <div class="roster-progress-fill" :style="{ width: pct+'%' }" :class="{ full: isFull }"></div>
        </div>
        <p v-if="!event.signupCount" class="roster-empty">还没有人报名，快来成为第一个吧。</p>
        <div v-else class="roster-dots">
          <span v-for="i in Math.min(event.signupCount, 50)" :key="i" class="roster-dot"></span>
          <span v-if="event.signupCount > 50" class="roster-more">+{{ event.signupCount - 50 }}</span>
        </div>
      </div>

      <div v-if="chatReady" class="card mb discussion-summary-card">
        <div class="summary-head"><div><b>💬 活动讨论</b><small>集合、装备和临时安排都在这里</small></div><span v-if="unreadCount">{{ unreadCount }} 条未读</span></div>
        <div v-if="discussionSummaries.length" class="topic-list">
          <article v-for="topic in discussionSummaries" :key="topic.id"><b>{{ topic.sender.name }}</b><p>{{ topic.preview }}</p><span v-if="topic.replyCount">↳ {{ topic.moderatorReplied ? '主办方已回复 ✓ · ' : '' }}{{ topic.replyCount }} 条回复<em v-if="topic.unreadReplies"> · {{ topic.unreadReplies }} 条新回复</em></span><small v-if="topic.latestReply">最新：{{ topic.latestReply.sender.name }}：{{ topic.latestReply.preview }}</small></article>
        </div>
        <p v-else class="summary-empty">讨论区还没有消息，来发起第一个话题吧。</p>
        <button class="event-action" type="button" @click="selectTab('discussion')">进入活动讨论</button>
      </div>
      <div v-else class="card mb discussion-locked"><b>💬 活动讨论</b><p>报名后自动加入本活动讨论。这里用于集合、装备、同行、临时安排和活动照片交流。</p><button type="button" disabled>报名后开放</button></div>

      <!-- Signup Form -->
      <div v-if="done" class="card result-card">
        <div class="check-icon">✓</div>
        <p class="result-title">报名成功!</p>
        <p v-if="externalRedirect" class="result-sub">本站实名登记已完成。你仍需前往外部主办方完成正式报名。</p>
        <p v-if="showQrLink" class="result-sub">活动当天出示签到码即可签到</p>
        <p v-else class="result-sub">签到码将在活动前一天通过邮件发送，届时也可在「我的」页面查看</p>
        <p v-if="chatToken" class="result-sub">你已自动加入活动讨论</p>
        <button v-if="chatToken" type="button" class="btn btn-primary discussion-enter" @click="openDiscussion">进入活动讨论</button>
        <a v-if="externalRedirect" :href="externalRedirect.target" class="btn btn-primary" style="margin-top:20px">继续完成外部报名</a>
        <router-link v-else-if="showQrLink" :to="`/signup-ok/${event.id}?token=${signupToken}`" class="btn btn-primary" style="margin-top:20px">
          查看签到码
        </router-link>
        <router-link v-else to="/my" class="btn btn-outline" style="margin-top:20px">
          前往「我的」页面
        </router-link>
      </div>

      <form v-else-if="event.status === 'open' && !isFull && !isLocked" class="card" @submit.prevent="doSignup">
        <h2 class="form-title">填写报名信息</h2>
        <div class="field">
          <label class="label">姓名 * <span class="label-hint">（中文优先，英文亦可）</span></label>
          <input v-model="form.name" required placeholder="请填写中文姓名" />
        </div>
        <div class="field">
          <label class="label">姓名假名 *</label>
          <input v-model="builtIn.name_kana" required placeholder="シメイ" />
        </div>
        <div class="field">
          <label class="label">性别 *</label>
          <select v-model="builtIn.gender" required>
            <option value="" disabled hidden>请选择</option>
            <option value="男">男</option>
            <option value="女">女</option>
          </select>
        </div>
        <div class="field">
          <label class="label">所属学校 *</label>
          <select v-model="builtIn.school" required>
            <option value="" disabled hidden>请选择</option>
            <option v-for="s in schools" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div v-if="builtIn.school === '其他学校'" class="field">
          <label class="label">学校名称 *</label>
          <input v-model="builtIn.school_other" required placeholder="请输入学校名称" />
        </div>
        <div v-if="builtIn.school === '東北大学'" class="field">
          <label class="label">学号/工号 *</label>
          <input v-model="builtIn.student_id" required placeholder="東北大学学友填写" />
        </div>
        <div class="field">
          <label class="label">邮箱 *</label>
          <input v-model="form.email" type="email" required placeholder="用于接收活动通知和签到" />
        </div>
        <div class="field">
          <label class="label">中国手机号 (选填)</label>
          <input v-model="builtIn.phone_cn" type="tel" placeholder="选填" />
        </div>
        <div class="field">
          <label class="label">日本电话号 (选填)</label>
          <input v-model="builtIn.phone_jp" type="tel" placeholder="選択入力" />
        </div>
        <div class="field">
          <label class="label">微信号 (选填)</label>
          <input v-model="builtIn.wechat" placeholder="选填" />
        </div>

        <!-- Custom fields -->
        <div v-for="f in customFields" :key="f.key" class="field">
          <label class="label">{{ f.label }}{{ f.required ? ' *' : '' }}</label>
          <select v-if="f.type === 'select'" v-model="extra[f.key]" :required="f.required">
            <option value="" disabled hidden>请选择</option>
            <option v-for="opt in f.options" :key="opt" :value="opt">{{ opt }}</option>
          </select>
          <textarea v-else-if="f.type === 'textarea'" v-model="extra[f.key]" :required="f.required" rows="2" :placeholder="f.placeholder || ''" />
          <input v-else-if="f.type === 'number'" v-model.number="extra[f.key]" type="number" :required="f.required" :placeholder="f.placeholder || ''" />
          <input v-else v-model="extra[f.key]" :required="f.required" :placeholder="f.placeholder || ''" />
        </div>

        <label class="consent-row">
          <input type="checkbox" v-model="agreed" />
          <span>我已阅读并同意<router-link to="/privacy" target="_blank">《隐私政策》</router-link></span>
        </label>

        <p v-if="formError" class="error">{{ formError }}</p>
        <button type="submit" class="btn btn-primary" :disabled="submitting || !agreed">
          {{ submitting ? '提交中…' : '提交报名' }}
        </button>
      </form>

      <div v-else-if="isLocked" class="card result-card">
        <p class="result-title" style="color:var(--c-warning)">报名暂时锁定</p>
        <p class="result-sub">活动创建者已暂停接受新报名，现有报名不受影响。</p>
      </div>
      <div v-else-if="isFull" class="card result-card">
        <p class="result-title" style="color:var(--c-warning)">报名已满</p>
      </div>
      <div v-else class="card result-card">
        <p class="result-title" style="color:var(--c-text-2)">
          {{ event.status === 'active' ? '报名已截止,活动进行中' : event.status === 'closed' ? '活动已结束' : '暂未开放报名' }}
        </p>
        <router-link v-if="event.status === 'active'" :to="`/checkin/${event.id}`" class="btn btn-outline" style="margin-top:16px">
          前往签到 →
        </router-link>
      </div>

      </section>

      <section v-show="activeTab === 'discussion'" class="event-tab-panel">
        <div v-if="chatLoading" class="card empty">正在连接活动讨论…</div>
        <div v-else-if="chatError" class="card empty error">活动讨论暂时无法连接，请稍后再试。</div>
        <EventDiscussion v-else-if="chatReady" :event-id="event.id" :event-date="event.event_date" :group="chatSession.group" :guid="chatSession.guid" :notes="event.notes || ''" :participant-count="event.signupCount" :archived="event.status === 'closed'" @refresh="refreshDiscussion" @error="chatError = '活动讨论暂时无法连接，请稍后再试。'" />
        <div v-else class="card discussion-locked"><b>💬 活动讨论</b><p>报名后自动加入本活动讨论。这里用于集合、装备、同行、临时安排和活动照片交流。</p><button type="button" disabled>报名后开放</button></div>
      </section>

      <section v-show="activeTab === 'people'" class="event-tab-panel">
        <div class="card people-card"><h2>已确认参加 {{ event.signupCount }} {{ effectiveCap ? `/ ${effectiveCap}` : '' }} 位</h2>
          <div v-if="chatReady" class="people-list"><article v-for="member in chatMembers" :key="member.uid"><span>{{ member.name.slice(0, 1) }}</span><b>{{ member.name }}</b><em>{{ ['admin','moderator'].includes(member.scope) ? '主办方' : '活动参与者' }}</em></article></div>
          <p v-else>为保护参与者隐私，报名后可在活动讨论中查看共同参与活动的同学。</p>
        </div>
      </section>
      <router-link to="/" class="back-link">← 返回活动列表</router-link>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CometChat } from '@cometchat/chat-sdk-javascript'
import { api } from '../api.js'
import { auth } from '../auth.js'
import EventDiscussion from '../components/EventDiscussion.vue'
import { connectEventChat, fetchDiscussionSnapshot, fetchEventMembers, isMessageForGroup } from '../lib/event-chat.js'

const route = useRoute()
const router = useRouter()
const eventId = Number(route.params.id)
const activeTab = ref(['detail', 'discussion', 'people'].includes(String(route.query.tab)) ? String(route.query.tab) : 'detail')
const queryToken = route.query.token ? String(route.query.token) : ''
if (queryToken) {
  localStorage.setItem(`event_chat_access_${route.params.id}`, queryToken)
  activeTab.value = 'discussion'
  void router.replace({ path: `/e/${route.params.id}`, query: { tab: 'discussion' } })
}
const event = ref(null)
const error = ref('')
const form = ref({
  name: localStorage.getItem('user_name') || '',
  email: localStorage.getItem('user_email') || '',
})
const builtIn = reactive({ student_id: '', name_kana: '', gender: '', wechat: '', school: '', school_other: '', phone_cn: '', phone_jp: '' })
const schools = ['東北大学', '山形大学', '福島大学', '会津大学', '宮城大学', '仙台大学', '東北医科薬科大学', '東北学院大学', '東北工業大学', '福島県立医科大学', '東北芸術工科大学', '其他学校']
const extra = reactive({})
const formError = ref('')
const submitting = ref(false)
const done = ref(false)
const signupToken = ref('')
const externalRedirect = ref(null)
const agreed = ref(false)
const chatToken = ref(queryToken || localStorage.getItem(`event_chat_access_${route.params.id}`) || '')
const chatLoading = ref(false)
const chatError = ref('')
const chatSession = ref(null)
const chatMembers = ref([])
const discussionSummaries = ref([])
const unreadCount = ref(0)
const listenerId = `event-detail-${eventId}-${Math.random().toString(36).slice(2)}`
let chatInitPromise = null
let refreshTimer = null

const customFields = computed(() => {
  if (!event.value?.custom_fields) return []
  try {
    return JSON.parse(event.value.custom_fields).map((f, i) => ({
      ...f,
      key: f.key || f.label || `field_${i}`
    }))
  } catch { return [] }
})

const showQrLink = computed(() => {
  if (!event.value?.event_date) return false
  const now = new Date()
  const jstNow = new Date(now.getTime() + 9 * 3600000)
  const eventDay = new Date(event.value.event_date.replace(/\s/, 'T') + '+09:00')
  return (eventDay - jstNow) < 1 * 24 * 3600000
})
const effectiveCap = computed(() => event.value?.capacity || event.value?.lock_at || null)
const pct = computed(() => effectiveCap.value ? Math.min(100, event.value.signupCount / effectiveCap.value * 100) : 0)
const isFull = computed(() => effectiveCap.value && event.value.signupCount >= effectiveCap.value)
const isLocked = computed(() => event.value?.lock_at !== null && event.value?.lock_at !== undefined)
const chatReady = computed(() => Boolean(chatSession.value?.group))
const statusText = computed(() => ({ open: '报名中', active: '进行中', closed: '已结束' }[event.value?.status] || event.value?.status || ''))

function selectTab(tab) {
  activeTab.value = tab
  if (tab === 'discussion') unreadCount.value = 0
  void router.replace({ path: `/e/${route.params.id}`, query: tab === 'detail' ? {} : { tab } })
  if (tab === 'discussion' || tab === 'detail') window.setTimeout(refreshDiscussion, 250)
}

async function openDiscussion() {
  await ensureChat(true)
  selectTab('discussion')
}

async function ensureChat(force = false) {
  if (chatInitPromise) return chatInitPromise
  if (!force && !chatToken.value && !['host', 'reviewer'].includes(auth.role)) return null
  chatLoading.value = true
  chatError.value = ''
  chatInitPromise = (async () => {
    try {
      chatSession.value = await connectEventChat(eventId, chatToken.value)
      chatMembers.value = await fetchEventMembers(chatSession.value.guid)
      await refreshDiscussion()
      CometChat.addMessageListener(listenerId, new CometChat.MessageListener({
        onTextMessageReceived: receiveMessage,
        onMediaMessageReceived: receiveMessage,
        onCustomMessageReceived: receiveMessage,
      }))
      return chatSession.value
    } catch (e) {
      chatError.value = e?.message || '活动讨论暂时无法连接，请稍后再试。'
      return null
    } finally { chatLoading.value = false }
  })()
  return chatInitPromise
}

function receiveMessage(message) {
  if (!chatSession.value || !isMessageForGroup(message, chatSession.value.guid)) return
  if (activeTab.value !== 'discussion') unreadCount.value += 1
  clearTimeout(refreshTimer)
  refreshTimer = window.setTimeout(refreshDiscussion, 250)
}

async function refreshDiscussion() {
  if (!chatSession.value) return
  try {
    const snapshot = await fetchDiscussionSnapshot(chatSession.value.guid, chatMembers.value)
    discussionSummaries.value = snapshot.summaries
    unreadCount.value = activeTab.value === 'discussion' ? 0 : snapshot.unread
  } catch { /* the embedded chat remains usable if summary refresh fails */ }
}

onMounted(async () => {
  try {
    const data = await api.getEvent(route.params.id)
    event.value = data.event
  } catch (e) { error.value = e.message }

  if (auth.isLoggedIn) {
    if (!form.value.email) form.value.email = auth.email
    try {
      const data = await api.getProfile()
      const p = data.profile || {}
      if (p.name && !form.value.name) form.value.name = p.name
      if (p.name_kana && !builtIn.name_kana) builtIn.name_kana = p.name_kana
      if (p.gender && !builtIn.gender) builtIn.gender = p.gender
      if (p.phone_cn && !builtIn.phone_cn) builtIn.phone_cn = p.phone_cn
      if (p.phone_jp && !builtIn.phone_jp) builtIn.phone_jp = p.phone_jp
      if (p.wechat && !builtIn.wechat) builtIn.wechat = p.wechat
      if (p.student_id && !builtIn.student_id) builtIn.student_id = p.student_id
      if (p.school && !builtIn.school) {
        const isKnown = schools.includes(p.school)
        builtIn.school = isKnown ? p.school : '其他学校'
        if (!isKnown) builtIn.school_other = p.school
      }
    } catch {}
  }
  await ensureChat()
})

onBeforeUnmount(() => {
  clearTimeout(refreshTimer)
  CometChat.removeMessageListener(listenerId)
})

async function doSignup() {
  formError.value = ''
  submitting.value = true
  try {
    const data = await api.signup({
      event_id: Number(route.params.id),
      name: form.value.name,
      email: form.value.email,
      phone: '',
      extra: {
        姓名假名: builtIn.name_kana,
        性别: builtIn.gender,
        所属学校: builtIn.school === '其他学校' ? builtIn.school_other : builtIn.school,
        ...(builtIn.student_id ? { '学号/工号': builtIn.student_id } : {}),
        ...(builtIn.phone_cn ? { 中国手机号: builtIn.phone_cn } : {}),
        ...(builtIn.phone_jp ? { 日本电话号: builtIn.phone_jp } : {}),
        ...(builtIn.wechat ? { 微信号: builtIn.wechat } : {}),
        ...extra
      }
    })
    signupToken.value = data.token
    chatToken.value = data.chat_access_token || ''
    if (chatToken.value) localStorage.setItem(`event_chat_access_${route.params.id}`, chatToken.value)
    externalRedirect.value = data.redirect || null
    done.value = true
    event.value.signupCount++
    localStorage.setItem('user_email', form.value.email)
    localStorage.setItem('user_name', form.value.name)
    chatInitPromise = null
    await ensureChat(true)
  } catch (e) { formError.value = e.message }
  submitting.value = false
}
</script>

<style scoped>
.event-page { --event-bg:#f5f6f8; --event-card:#fff; --event-text:#17202a; --event-muted:#6b7280; --event-line:#e8ebef; --event-brand:#16a085; --event-brand-dark:#0f766e; --event-soft:#e9f7f3; --event-warn:#fff7df; color:var(--event-text); }
.event-hero { margin:-16px -16px 0; padding:27px 22px 24px; background:linear-gradient(135deg,#1d8b76,#1f6f65); color:#fff; }
.hero-kicker,.hero-facts { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.hero-kicker { font-size:12px; opacity:.85; }.event-hero h1 { margin-top:15px; font-size:29px; line-height:1.2; overflow-wrap:anywhere; }.event-hero>p { margin-top:9px; font-size:14px; line-height:1.55; opacity:.92; }
.hero-facts { margin-top:22px; padding-top:17px; border-top:1px solid rgba(255,255,255,.22); font-size:14px; }.hero-facts strong { font-size:22px; }
.event-tabs { position:sticky; top:49px; z-index:50; margin:0 -16px 16px; padding:0 16px; display:grid; grid-template-columns:repeat(3,1fr); background:#fff; border-bottom:1px solid var(--event-line); }
.event-tabs button { min-width:0; padding:15px 4px 12px; border:0; border-bottom:3px solid transparent; background:transparent; color:var(--event-muted); font-size:14px; font-weight:700; white-space:nowrap; }.event-tabs button.active { border-bottom-color:var(--event-brand); color:var(--event-brand-dark); }.event-tabs button span { min-width:18px; height:18px; padding:0 5px; display:inline-grid; place-items:center; border-radius:9px; background:#e34a42; color:#fff; font-size:10px; }
.event-tab-panel { min-width:0; }.discussion-summary-card { border:1px solid #dbece7; }.summary-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }.summary-head b,.summary-head small { display:block; }.summary-head b { font-size:17px; }.summary-head small { margin-top:4px; color:var(--event-muted); font-size:12px; }.summary-head>span { flex:0 0 auto; padding:5px 8px; border-radius:999px; background:#fff0ef; color:#c33d35; font-size:12px; font-weight:700; }
.topic-list { margin-top:14px; }.topic-list article { padding:13px 0; border-top:1px solid var(--event-line); }.topic-list article>b { font-size:13px; }.topic-list p { margin-top:3px; display:-webkit-box; overflow:hidden; font-size:14px; line-height:1.5; -webkit-box-orient:vertical; -webkit-line-clamp:2; }.topic-list span,.topic-list small { display:block; margin-top:5px; overflow:hidden; color:var(--event-brand-dark); font-size:12px; font-weight:700; text-overflow:ellipsis; white-space:nowrap; }.topic-list small { color:var(--event-muted); font-weight:400; }.topic-list em { font-style:normal; }.summary-empty,.discussion-locked p,.people-card>p { margin:14px 0; color:var(--event-muted); font-size:14px; line-height:1.65; }.event-action,.discussion-locked button { width:100%; margin-top:13px; padding:11px; border:0; border-radius:10px; background:var(--event-brand); color:#fff; font-weight:700; }.discussion-locked button { background:var(--event-line); color:var(--event-muted); }
.people-card h2 { font-size:18px; }.people-list { margin-top:14px; }.people-list article { min-width:0; padding:11px 0; display:grid; grid-template-columns:38px minmax(0,1fr) auto; align-items:center; gap:10px; border-top:1px solid var(--event-line); }.people-list article>span { width:38px; height:38px; display:grid; place-items:center; border-radius:50%; background:var(--event-soft); color:var(--event-brand-dark); font-weight:700; }.people-list b { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.people-list em { padding:4px 7px; border-radius:999px; background:#f3f5f4; color:var(--event-muted); font-size:11px; font-style:normal; }.discussion-enter { margin-top:20px; background:var(--event-brand); }
.mb { margin-bottom: 16px; }
.title { font-size: 22px; font-weight: 700; flex: 1; min-width: 0; overflow-wrap: break-word; }
.meta { font-size: 14px; color: var(--c-text-2); margin-top: 6px; }
.content { white-space: pre-wrap; font-size: 15px; margin-top: 12px; line-height: 1.6; }
.notes {
  margin-top: 12px; padding: 14px; background: var(--event-soft); border-radius: 14px;
}
.notes>b,.notes>small { display:block; }.notes>b { color:var(--event-brand-dark); font-size:14px; }.notes>small { margin-top:3px; color:var(--event-muted); font-size:12px; }.notes>p { margin-top:8px; white-space:pre-wrap; font-size:14px; line-height:1.7; }
.cap-row { display: flex; align-items: center; font-size: 13px; color: var(--c-text-2); margin-top: 16px; }
.progress { height: 4px; background: var(--c-border); border-radius: 2px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--c-primary); border-radius: 2px; }
.progress-fill.full { background: var(--c-danger); }
.form-title { font-size: 17px; font-weight: 600; margin-bottom: 16px; }
.consent-row {
  display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--c-text-2);
  margin-top: 16px; cursor: pointer; user-select: none;
}
.consent-row input[type="checkbox"] { width: 16px; height: 16px; margin: 0; flex-shrink: 0; cursor: pointer; }
.consent-row a { color: var(--c-primary); text-decoration: underline; }
.result-card { text-align: center; padding: 32px 20px; }
.check-icon {
  width: 56px; height: 56px; background: var(--c-success-bg); color: var(--c-success);
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 28px; font-weight: 700; margin: 0 auto 12px;
}
.result-title { font-size: 20px; font-weight: 700; }
.result-sub { font-size: 14px; color: var(--c-text-2); margin-top: 6px; }
.back-link { display: block; text-align: center; font-size: 13px; margin-top: 24px; color: var(--c-text-2); }

.event-image-card { padding: 0; overflow: hidden; }
.event-image { width: 100%; display: block; height: auto; }

.roster-card { padding: 20px; }
.roster-head { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 4px; }
.roster-head h3 { font-size: 15px; font-weight: 600; margin: 0; }
.roster-head strong { color: var(--c-primary); }
.roster-hint { font-size: 12px; color: var(--c-text-3); }
.roster-progress {
  height: 6px; background: var(--c-border); border-radius: 3px;
  overflow: hidden; margin-top: 10px;
}
.roster-progress-fill {
  height: 100%; background: var(--c-primary); border-radius: 3px;
  transition: width .3s;
}
.roster-progress-fill.full { background: var(--c-danger); }
.roster-empty { font-size: 13px; color: var(--c-text-3); margin-top: 12px; text-align: center; }
.roster-dots {
  display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; align-items: center;
}
.roster-dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: var(--c-primary); opacity: .35;
}
.roster-more { font-size: 12px; color: var(--c-text-3); margin-left: 2px; }
.label-hint { font-weight: 400; font-size: 12px; color: var(--c-text-3); }
@media (min-width:641px) { .event-page { max-width:760px; }.event-hero { margin-top:0; border-radius:18px; }.event-tabs { top:0; margin:0 0 16px; border-radius:0 0 14px 14px; } }
@media (max-width:360px) { .event-hero h1 { font-size:25px; }.event-tabs { padding:0 8px; }.event-tabs button { font-size:13px; }.people-list article { grid-template-columns:34px minmax(0,1fr) auto; }.people-list article>span { width:34px; height:34px; } }
</style>
