<template>
  <div class="discussion-host">
    <div v-if="loading" class="discussion-state">正在连接活动讨论…</div>
    <div v-else-if="error" class="discussion-state">活动讨论暂时无法连接，请稍后再试。<button type="button" @click="connect">重试</button></div>
    <template v-else>
      <div v-if="active" class="discussion-head">
        <div v-if="notes" class="notice"><strong>📌 主办方通知</strong><p>{{ notes }}</p></div>
        <strong>活动讨论 <small>{{ count }} 人参加</small></strong>
        <span>仅参与者可发言</span>
        <p v-if="closed" class="archive">本活动已结束 · 讨论已归档<br>历史消息仍可查看</p>
        <button v-if="isWechat && hintSeen" class="hint-banner" type="button" @click="showHint = true">📌 建议把活动留在微信浮窗 · 查看方法 ›</button>
      </div>
      <div v-show="active" class="chat-shell" :class="{ closed }" @pointerdown="interact" @focusin="interact">
        <CometChatMessages v-if="opened" :group="group" :hide-message-composer="closed" :threaded-messages-configuration="threadConfig" />
      </div>
      <div v-if="showHint" class="sheet-backdrop" @click.self="dismissHint">
        <div class="hint-sheet" role="dialog" aria-modal="true" aria-label="微信浮窗提示">
          <h3>📌 以后不用翻群找链接</h3>
          <p>把这个活动留在微信浮窗里，活动期间可以随时回来查看通知和聊天。</p>
          <p>💬 活动讨论　📢 主办方通知　📍 集合信息</p>
          <strong>右上角 ··· →「浮窗」</strong>
          <button type="button" @click="dismissHint">我知道了</button>
          <button type="button" class="later" @click="dismissHint">稍后再说</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CometChat } from '@cometchat/chat-sdk-javascript'
import { CometChatMessages, CometChatUIKit, ThreadedMessagesConfiguration, UIKitSettingsBuilder } from '@cometchat/chat-uikit-vue'
import '@cometchat/chat-uikit-vue/dist/style.css'
import { api } from '../api.js'

const props = defineProps({ eventId: { type: Number, required: true }, token: { type: String, default: '' }, sessionData: { type: Object, default: null }, notes: { type: String, default: '' }, eventDate: { type: String, default: '' }, count: { type: Number, default: 0 }, closed: Boolean, active: Boolean })
const emit = defineEmits(['update'])
const loading = ref(true), error = ref(false), group = ref(null)
const opened = ref(props.active)
const threadConfig = computed(() => new ThreadedMessagesConfiguration({ hideMessageComposer: props.closed, onClose: () => scheduleRefresh() }))
const isWechat = /MicroMessenger/i.test(navigator.userAgent)
const hintSeen = ref(!!localStorage.getItem(`event_float_hint_seen_${props.eventId}`))
const showHint = ref(false)
const listenerId = `event-test-${Math.random().toString(36).slice(2)}`
let guid = '', alive = true, refreshTimer = null
const scopes = new Map()

const value = (item, method, field) => item?.[method]?.() ?? item?.[field]
const senderName = (message) => value(message, 'getSender', 'sender')?.getName?.() || value(message, 'getSender', 'sender')?.name || '参与者'
const senderUid = (message) => value(message, 'getSender', 'sender')?.getUid?.() || value(message, 'getSender', 'sender')?.uid
const preview = (message) => {
  const type = value(message, 'getType', 'type')
  if (type === 'text') return value(message, 'getText', 'text') || ''
  return { image: '[图片]', audio: '[语音]', file: '[文件]', video: '[视频]' }[type] || '[消息]'
}
const stamp = (message) => Number(value(message, 'getSentAt', 'sentAt') || 0)
const isVisible = (message) => !value(message, 'getDeletedAt', 'deletedAt') && value(message, 'getCategory', 'category') === 'message'

async function members() {
  const request = new CometChat.GroupMembersRequestBuilder(guid).setLimit(100).build()
  const list = []
  for (let page = 0; page < 10; page++) {
    const batch = await request.fetchNext()
    list.push(...batch)
    if (batch.length < 100) break
  }
  scopes.clear()
  for (const member of list) scopes.set(value(member, 'getUid', 'uid'), value(member, 'getScope', 'scope'))
  return list.map(member => ({ uid: value(member, 'getUid', 'uid'), name: value(member, 'getName', 'name') || '参与者', scope: value(member, 'getScope', 'scope') }))
}

async function refresh() {
  if (!guid || !alive) return
  try {
    const roots = await new CometChat.MessagesRequestBuilder().setGUID(guid).setLimit(30).hideReplies(true).build().fetchPrevious()
    const summaries = await Promise.all(roots.filter(isVisible).map(async root => {
      const replyCount = Number(value(root, 'getReplyCount', 'replyCount') || 0)
      let latest = null, organizerReplied = false
      if (replyCount) {
        const replies = await new CometChat.MessagesRequestBuilder().setGUID(guid).setParentMessageId(Number(value(root, 'getId', 'id'))).setLimit(100).build().fetchPrevious()
        const visibleReplies = replies.filter(isVisible)
        latest = visibleReplies.sort((a, b) => stamp(b) - stamp(a))[0] || null
        organizerReplied = visibleReplies.some(message => ['moderator', 'admin', 'owner'].includes(scopes.get(senderUid(message))))
      }
      return { id: value(root, 'getId', 'id'), sender: senderName(root), text: preview(root), replyCount, latestSender: latest ? senderName(latest) : '', latestText: latest ? preview(latest) : '', unreadReplies: Number(value(root, 'getUnreadRepliesCount', 'unreadRepliesCount') || 0), organizerReplied, activityAt: Math.max(stamp(root), latest ? stamp(latest) : 0) }
    }))
    const unreadResult = await CometChat.getUnreadMessageCountForGroup(guid).catch(() => ({}))
    const unread = Number(typeof unreadResult === 'number' ? unreadResult : (unreadResult?.[guid] ?? unreadResult?.groups?.[guid] ?? unreadResult?.unreadMessageCount ?? 0)) || 0
    if (alive) emit('update', { summaries: summaries.sort((a, b) => b.activityAt - a.activityAt).slice(0, 3), unread })
  } catch { /* Chat summary is optional; the UIKit conversation remains usable. */ }
}

function scheduleRefresh() { clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh, 350) }
function received(message) {
  if ((value(message, 'getReceiverId', 'receiverId') || '') === guid) scheduleRefresh()
}
async function connect() {
  if ((!props.token && !props.sessionData) || !alive) return
  loading.value = true; error.value = false
  try {
    const data = props.sessionData || await api.chatSession({ event_id: props.eventId, chat_access_token: props.token })
    const settings = new UIKitSettingsBuilder().setAppId(data.app_id).setRegion(data.region).setAutoEstablishSocketConnection(true).build()
    await CometChatUIKit.init(settings)
    const logged = await CometChatUIKit.getLoggedinUser()
    if (!logged || logged.getUid() !== data.uid) {
      if (logged) await CometChatUIKit.logout()
      await CometChatUIKit.loginWithAuthToken(data.auth_token)
    }
    if (!alive) return
    guid = data.guid; group.value = new CometChat.Group(guid)
    CometChat.addMessageListener(listenerId, new CometChat.MessageListener({ onTextMessageReceived: received, onMediaMessageReceived: received, onCustomMessageReceived: received }))
    const people = await members().catch(() => [])
    emit('update', { people })
    await refresh()
  } catch { error.value = true }
  finally { loading.value = false }
}
function interact() {
  if (!isWechat || !props.active) return
  const eventDay = props.eventDate.slice(0, 10)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date())
  const remindToday = eventDay === today && !localStorage.getItem(`event_float_hint_eventday_${props.eventId}`)
  if (hintSeen.value && !remindToday) return
  hintSeen.value = true
  localStorage.setItem(`event_float_hint_seen_${props.eventId}`, '1')
  if (remindToday) localStorage.setItem(`event_float_hint_eventday_${props.eventId}`, '1')
  showHint.value = true
}
function dismissHint() { showHint.value = false }
onMounted(connect)
onBeforeUnmount(() => { alive = false; clearTimeout(refreshTimer); CometChat.removeMessageListener(listenerId) })
watch(() => props.active, active => { if (active) { opened.value = true; setTimeout(refresh, 600) } else scheduleRefresh() })
defineExpose({ refresh })
</script>

<style scoped>
.discussion-host { min-width:0; }.discussion-state { padding:28px; text-align:center; background:#fff; border-radius:16px; }.discussion-state button { margin-left:12px; }.discussion-head { padding:16px; background:#fff; border-radius:16px 16px 0 0; }.discussion-head strong { display:block; }.discussion-head small,.discussion-head span { color:#6b7280; font-size:13px; font-weight:400; }.notice { padding:14px; margin-bottom:16px; border-radius:12px; background:#e9f7f3; white-space:pre-wrap; }.notice p { margin:8px 0 0; }.archive { padding:12px; background:#f5f6f8; border-radius:10px; }.chat-shell { height:min(72vh,720px); min-height:480px; background:#fff; overflow:hidden; border-radius:0 0 16px 16px; }.hint-banner { width:100%; margin-top:12px; padding:10px; border:0; border-radius:10px; background:#e9f7f3; color:#0f766e; }.sheet-backdrop { position:fixed; inset:0; z-index:200; background:#0008; display:flex; align-items:flex-end; justify-content:center; }.hint-sheet { width:min(100%,430px); max-height:90dvh; overflow:auto; padding:24px 20px max(24px,env(safe-area-inset-bottom)); border-radius:20px 20px 0 0; background:#fff; }.hint-sheet button { display:block; width:100%; padding:12px; margin-top:12px; border:0; border-radius:10px; background:#16a085; color:#fff; }.hint-sheet button.later { background:#f5f6f8; color:#17202a; }
.chat-shell.closed :deep(.cc-threadedmessages-wrapper__composer),.chat-shell.closed :deep(.cc-messages-wrapper__composer){display:none!important}
@media(max-width:640px){.chat-shell {height:calc(100dvh - 225px);min-height:420px}.chat-shell :deep(.cc-messages-wrapper__threadedmessages){position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;z-index:100;background:#fff}.chat-shell :deep(.cc-threadedmessages-wrapper){height:100%!important}.chat-shell :deep(.cc-threadedmessages-wrapper__composer){bottom:env(safe-area-inset-bottom)!important}.chat-shell :deep(.cc__messagelist__threadreplies){color:#0f766e!important;font-weight:700!important}}
</style>
