<template>
  <div class="page event-test">
    <div v-if="!event" class="empty">{{ error || '加载中…' }}</div>
    <template v-else>
      <header class="event-hero" :class="{ 'has-image': !!event.image_key }">
        <img v-if="event.image_key" :src="imageUrl" alt="" class="hero-image" />
        <div class="hero-overlay"></div>
        <div class="hero-content">
          <div class="hero-top"><router-link to="/" aria-label="返回活动列表">‹</router-link></div>
          <p class="eyebrow">{{ event.event_subtype === 'assisted' ? '协助活动' : '自主活动' }} · 活动详情</p>
          <h1>{{ event.title }}</h1>
          <div class="hero-meta">{{ event.event_date }}<br v-if="event.location" />{{ event.location }}</div>
          <div class="hero-status"><span class="status-pill">{{ chatToken ? '✓ 已报名' : managerSession ? '主办方' : statusLabel }}</span><span>{{ event.signupCount }} {{ effectiveCap ? '/ ' + effectiveCap : '' }} 人参加</span></div>
        </div>
      </header>
      <nav class="event-tabs" aria-label="活动内容">
        <button v-for="tab in tabs" :key="tab.id" type="button" :class="{ selected: activeTab === tab.id }" @click="selectTab(tab.id)">{{ tab.label }}<span v-if="tab.id === 'discussion' && unread"> {{ unread > 99 ? '99+' : unread }}</span></button>
      </nav>
      <div v-show="activeTab === 'detail'" class="detail-panels">
        <article v-if="event.notes" class="test-card test-notice"><div class="notice-head">📌 最新通知 <span>主办方</span></div><p>{{ event.notes }}</p></article>
        <article class="test-card">
          <h2>活动信息</h2>
          <div class="facts">
            <div class="fact"><div class="fact-icon">🗓</div><div><strong>{{ event.event_date || '时间待公布' }}</strong><span>活动时间</span></div></div>
            <div class="fact"><div class="fact-icon">📍</div><div><strong>{{ event.location || '地点待公布' }}</strong><span>活动地点</span></div></div>
            <div v-if="event.notes" class="fact"><div class="fact-icon">🎒</div><div><strong>活动注意事项</strong><span class="fact-notes">{{ event.notes }}</span></div></div>
          </div>
        </article>
        <article class="test-card"><h2>活动介绍</h2><p class="body-copy">{{ event.content || '主办方暂未填写活动介绍。' }}</p></article>
        <article v-if="chatToken" class="test-card signup-state"><strong>✓ 已报名</strong><p>你可以进入活动讨论，查看最新安排。</p><button type="button" class="test-button" @click="selectTab('discussion')">进入活动讨论</button></article>
        <article v-else-if="event.status === 'open' && !isFull && !isLocked && !managerSession" class="test-card signup-state"><strong>参与这个活动</strong><p>填写报名信息后即可加入活动讨论。</p><router-link :to="signupUrl" class="test-button">报名参加</router-link></article>
        <article v-else-if="isLocked || isFull" class="test-card signup-state"><strong>{{ isLocked ? '报名暂时锁定' : '报名已满' }}</strong></article>
        <article v-else-if="event.status === 'active' && !managerSession" class="test-card signup-state"><strong>报名已截止，活动进行中</strong><router-link :to="'/checkin/' + event.id" class="test-button">前往签到</router-link></article>
        <article v-if="chatAvailable" class="test-card summary-card">
          <div class="summary-heading"><h2>💬 活动讨论</h2><span v-if="unread">{{ unread }} 条未读</span></div>
          <div v-for="item in summaries" :key="item.id" class="summary-item"><small>{{ item.sender }}</small><p>{{ item.text }}</p><strong v-if="item.replyCount">↳ {{ item.organizerReplied ? '主办方已回复 ✓ · ' : '' }}{{ item.replyCount }} 条回复</strong><small v-if="item.latestSender">最新：{{ item.latestSender }}：{{ item.latestText }}</small></div>
          <p v-if="!summaries.length">暂无活动讨论</p><button type="button" class="test-button secondary" @click="selectTab('discussion')">进入活动讨论</button>
        </article>
        <article v-else class="test-card locked-tab"><h2>💬 活动讨论</h2><p>报名后自动加入本活动讨论。这里用于集合、装备、同行、临时安排和活动照片交流。</p></article>
        <article class="test-card roster-card"><div class="roster-head"><h2>已确认参加 {{ event.signupCount }} {{ effectiveCap ? '/ ' + effectiveCap : '' }} 位</h2><span>为保护隐私，不显示姓名</span></div><div v-if="effectiveCap" class="roster-progress"><div :style="{ width: pct + '%' }"></div></div><p v-if="!event.signupCount">还没有人报名。</p></article>
      </div>
      <section v-show="activeTab === 'discussion'" class="tab-panel">
        <EventDiscussionTest v-if="chatAvailable" ref="discussionRef" :event-id="Number(route.params.id)" :token="chatToken" :session-data="managerSession" :notes="event.notes || ''" :event-date="event.event_date || ''" :count="event.signupCount" :closed="event.status === 'closed'" :active="activeTab === 'discussion'" @update="onDiscussionUpdate" />
        <div v-else class="test-card locked-tab"><h2>🔒 报名后开放讨论</h2><p>报名成功后将自动加入活动群。聊天内容只对参与者可见。</p><router-link v-if="event.status === 'open' && !isFull && !isLocked" :to="signupUrl" class="test-button">报名参加</router-link></div>
      </section>
      <section v-show="activeTab === 'people'" class="tab-panel test-card people-panel"><h2>已确认参加 {{ event.signupCount }} {{ effectiveCap ? '/ ' + effectiveCap : '' }} 位</h2><template v-if="chatAvailable"><div v-for="person in people" :key="person.uid" class="person"><span class="person-avatar">{{ person.name.slice(0, 1) }}</span><div><strong>{{ person.name }}</strong><small>{{ ['moderator','admin','owner'].includes(person.scope) ? '主办方' : '活动参与者' }}</small></div></div></template><p v-else>为保护参与者隐私，报名后可在活动讨论中查看共同参与活动的同学。</p></section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api.js'
import { auth } from '../auth.js'
import EventDiscussionTest from '../components/EventDiscussionTest.vue'

const route = useRoute()
const router = useRouter()
const tabs = [{ id:'detail', label:'详情' }, { id:'discussion', label:'讨论' }, { id:'people', label:'参与者' }]
const activeTab = ref(['detail','discussion','people'].includes(route.query.tab) ? route.query.tab : 'detail')
const discussionRef = ref(null)
const managerSession = ref(null)
const summaries = ref([]), people = ref([]), unread = ref(0)
const event = ref(null), error = ref('')
const chatToken = ref(localStorage.getItem('event_chat_access_' + route.params.id) || '')
const chatAvailable = computed(() => !!chatToken.value || !!managerSession.value)
const signupUrl = computed(() => '/e/' + route.params.id + '/test/signup')
const imageUrl = computed(() => '/api/images/serve/' + event.value?.id + '?v=' + encodeURIComponent(event.value?.image_key || ''))
const statusLabel = computed(() => ({ open:'报名中', active:'进行中', closed:'已结束' })[event.value?.status] || event.value?.status)
const effectiveCap = computed(() => event.value?.capacity || event.value?.lock_at || null)
const pct = computed(() => effectiveCap.value ? Math.min(100, event.value.signupCount / effectiveCap.value * 100) : 0)
const isFull = computed(() => effectiveCap.value && event.value.signupCount >= effectiveCap.value)
const isLocked = computed(() => event.value?.lock_at !== null && event.value?.lock_at !== undefined)
function onDiscussionUpdate(data) { if (data.summaries) summaries.value = data.summaries; if (data.people) people.value = data.people; if (data.unread !== undefined) unread.value = data.unread }
function selectTab(tab) { activeTab.value = tab; router.replace({ path:route.path, query:tab === 'detail' ? {} : { tab } }); if (tab === 'detail') discussionRef.value?.refresh(); if (tab === 'discussion') setTimeout(() => discussionRef.value?.refresh(), 700) }
watch(() => route.query.tab, tab => { activeTab.value = ['detail','discussion','people'].includes(tab) ? tab : 'detail' })
onMounted(async () => {
  if (route.query.token) { chatToken.value = String(route.query.token); localStorage.setItem('event_chat_access_' + route.params.id, chatToken.value); const { token, ...query } = route.query; await router.replace({ path:route.path, query }) }
  try { const data = await api.getEvent(route.params.id); event.value = data.event } catch (e) { error.value = e.message }
  if (event.value && auth.isLoggedIn && !chatToken.value) { try { managerSession.value = await api.chatSession({ event_id:Number(route.params.id) }) } catch { /* Only managers receive a session. */ } }
})
</script>

<style scoped>
.event-test { --event-bg:#f5f6f8;--event-card:#fff;--event-text:#17202a;--event-muted:#6b7280;--event-line:#e8ebef;--event-brand:#16a085;--event-brand-dark:#0f766e;--event-soft:#e9f7f3;--event-warn:#fff7df; max-width:430px; min-height:100vh; padding:0 14px 32px; background:var(--event-bg); color:var(--event-text); box-shadow:0 18px 50px #17202a1c; }
.event-hero { position:relative; min-height:224px; margin:0 -14px; overflow:hidden; color:#fff; background:linear-gradient(145deg,#1d8b76,#1f6f65); }
.event-hero.has-image { min-height:270px; }.hero-image,.hero-overlay { position:absolute; inset:0; width:100%; height:100%; }.hero-image { object-fit:cover; }.hero-overlay { background:linear-gradient(180deg,#0b302551 0%,#123b318c 45%,#102a25e8 100%); }.event-hero:not(.has-image) .hero-overlay { background:radial-gradient(circle at 88% 12%,#ffffff30,transparent 29%); }
.hero-content { position:relative; z-index:1; display:flex; flex-direction:column; min-height:inherit; padding:18px 20px 24px; }.hero-top a { color:#fff; font-size:28px; text-decoration:none; line-height:1; }.eyebrow { margin:26px 0 8px; color:#cff3eb; font-size:13px; }.event-hero h1 { margin:0 0 10px; font-size:27px; line-height:1.26; overflow-wrap:anywhere; }.hero-meta { font-size:14px; line-height:1.65; }.hero-status { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:auto; padding-top:18px; font-size:13px; }.status-pill { padding:6px 10px; border-radius:999px; background:#ffffff30; font-weight:700; }
.event-tabs { position:sticky; top:0; z-index:20; display:grid; grid-template-columns:repeat(3,1fr); margin:0 -14px 14px; background:#fff; border-bottom:1px solid var(--event-line); }.event-tabs button { min-width:0; padding:15px 3px 13px; border:0; border-bottom:3px solid transparent; background:none; color:var(--event-muted); font-weight:700; }.event-tabs button.selected { color:var(--event-brand-dark); border-bottom-color:var(--event-brand); }.event-tabs button span { padding:2px 5px; border-radius:999px; background:#e2584e; color:#fff; font-size:10px; }
.test-card { margin-bottom:12px; padding:16px; border-radius:17px; background:#fff; box-shadow:0 4px 16px #17202a0b; }.test-card h2 { margin:0 0 12px; font-size:17px; }.test-card p { margin:0; font-size:14px; line-height:1.7; }.test-notice { background:var(--event-warn); border:1px solid #f4e5aa; white-space:pre-wrap; }.notice-head { display:flex; justify-content:space-between; gap:8px; margin-bottom:8px; font-weight:750; }.notice-head span { color:#8a6b10; font-size:12px; }.facts { display:grid; gap:13px; }.fact { display:grid; grid-template-columns:34px 1fr; align-items:start; gap:9px; }.fact-icon { display:grid; place-items:center; width:32px; height:32px; border-radius:10px; background:var(--event-soft); }.fact strong { display:block; font-size:14px; white-space:pre-wrap; }.fact span { display:block; color:var(--event-muted); font-size:12px; line-height:1.55; }.fact .fact-notes { white-space:pre-wrap; }.body-copy { white-space:pre-wrap; }
.signup-state strong { display:block; margin-bottom:8px; color:var(--event-brand-dark); }.signup-state p { margin-bottom:12px; }.test-button { display:grid; place-items:center; width:100%; min-height:44px; padding:10px; border:0; border-radius:12px; background:var(--event-brand-dark); color:#fff; font-weight:750; text-decoration:none; cursor:pointer; }.test-button.secondary { color:var(--event-brand-dark); background:var(--event-soft); }.summary-heading { display:flex; justify-content:space-between; gap:8px; align-items:baseline; }.summary-heading span { color:var(--event-muted); font-size:12px; }.summary-item { padding:12px 0; border-top:1px solid var(--event-line); }.summary-item p { margin:5px 0; }.summary-item small { display:block; color:var(--event-muted); }.summary-item strong { color:var(--event-brand-dark); font-size:12px; }.summary-card>.test-button { margin-top:12px; }.locked-tab { text-align:center; }.locked-tab p { margin-bottom:16px; }.roster-head { display:flex; justify-content:space-between; gap:8px; align-items:baseline; }.roster-head h2 { margin:0; }.roster-head span { color:var(--event-muted); font-size:11px; }.roster-progress { height:8px; margin-top:12px; border-radius:4px; background:#e7eceb; overflow:hidden; }.roster-progress>div { height:100%; background:linear-gradient(90deg,var(--event-brand),#55baa7); }.tab-panel { min-width:0; }.people-panel>.person { display:flex; align-items:center; gap:11px; padding:11px 0; border-top:1px solid var(--event-line); }.person-avatar { display:grid; place-items:center; width:32px; height:32px; flex:none; border-radius:50%; background:#789b95; color:#fff; }.person strong,.person small { display:block; }.person small { color:var(--event-muted); }
</style>
