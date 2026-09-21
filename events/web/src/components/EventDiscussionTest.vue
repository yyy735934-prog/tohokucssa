<template>
  <div class="discussion-host">
    <div v-if="loading" class="discussion-state">正在连接活动讨论…</div>
    <div v-else-if="error" class="discussion-state">活动讨论暂时无法连接，请稍后再试。<button type="button" @click="connect">重试</button></div>
    <template v-else>
      <div v-if="active" class="discussion-head">
        <div v-if="notes" class="notice"><div><strong>📌 主办方通知</strong><span>最新通知</span></div><p>{{ notes }}</p></div>
        <button v-if="isWechat && hintSeen" class="hint-banner" type="button" @click="showHint = true"><span>📌 建议把活动留在微信浮窗<br>以后不用翻群找链接</span><strong>查看方法 ›</strong></button>
        <p v-if="closed" class="archive">本活动已结束 · 讨论已归档<br>历史消息仍可查看</p>
        <div class="chat-head"><div><strong>活动讨论</strong><span>仅参与者可发言</span></div><small>{{ count }} 人参加</small></div>
      </div>
      <div v-show="active" class="chat-shell" :class="{ closed }" @pointerdown="interact" @focusin="interact">
        <CometChatMessages v-if="opened" :group="group" :hide-message-header="true" :hide-message-composer="closed" :message-list-configuration="messageListConfig" :message-composer-configuration="composerConfig" :threaded-messages-configuration="threadConfig" />
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
import { CometChatMessages, CometChatUIKit, MessageComposerConfiguration, MessageComposerStyle, MessageListConfiguration, MessageListStyle, ThreadedMessagesConfiguration, ThreadedMessagesStyle, UIKitSettingsBuilder } from '@cometchat/chat-uikit-vue'
import '@cometchat/chat-uikit-vue/dist/style.css'
import { api } from '../api.js'

const props = defineProps({ eventId: { type: Number, required: true }, token: { type: String, default: '' }, sessionData: { type: Object, default: null }, notes: { type: String, default: '' }, eventDate: { type: String, default: '' }, count: { type: Number, default: 0 }, closed: Boolean, active: Boolean })
const emit = defineEmits(['update'])
const loading = ref(true), error = ref(''), group = ref(null)
const opened = ref(props.active)
const chineseResources = {
  zh: {
    ENTER_YOUR_MESSAGE_HERE: '发消息…', THREAD: '消息回复', REPLY: '条回复', REPLIES: '条回复',
    REPLY_TO_THREAD: '回复这条消息', REPLY_IN_THREAD: '回复这条消息', IN_A_THREAD: '在消息回复中',
    TODAY: '今天', YESTERDAY: '昨天', MEMBERS: '位参与者', MEMBER: '位参与者', PARTICIPANTS: '参与者',
    ATTACH: '添加', ATTACH_FILE: '文件', ATTACH_IMAGE: '图片', ATTACH_VIDEO: '视频', ATTACH_AUDIO: '语音',
    STICKER: '贴图', EMOJI: '表情', VOICE_RECORDING: '语音', SEND_MESSAGE: '发送',
    NO_MESSAGES_FOUND: '还没有消息，来打个招呼吧', NO_REPLIES_FOUND: '还没有回复', NEW_MESSAGE: '新消息', NEW_MESSAGES: '新消息',
    REACT: '回应', COPY: '复制', EDIT: '编辑', DELETE: '删除', DELETE_MESSAGE: '删除消息', EDIT_MESSAGE: '编辑消息',
    MESSAGE_INFORMATION: '消息详情', CLOSE: '关闭', CANCEL: '取消', YOU: '我', TYPING: '正在输入', IS_TYPING: '正在输入…'
  }
}
CometChatUIKit.Localize.init('zh', chineseResources)
const composerStyle = new MessageComposerStyle({ background:'#fff', inputBackground:'#f5f7f7', inputBorder:'1px solid #dfe5e4', inputBorderRadius:'20px', textColor:'#17202a', placeHolderTextColor:'#88928f', attachIcontint:'#58746e', emojiIconTint:'#58746e', voiceRecordingIconTint:'#58746e', sendIconTint:'#16a085', dividerTint:'transparent' })
const composerConfig = new MessageComposerConfiguration({ messageComposerStyle:composerStyle })
const messageListConfig = new MessageListConfiguration({ showAvatar:true, messageListStyle:new MessageListStyle({ background:'#f8faf9', nameTextColor:'#687570', threadReplyTextColor:'#0f766e', threadReplyIconTint:'#0f766e', TimestampTextColor:'#8a9591', emptyStateTextColor:'#7b8883' }) })
const threadConfig = computed(() => new ThreadedMessagesConfiguration({ hideMessageComposer: props.closed, messageComposerConfiguration:composerConfig, messageListConfiguration:messageListConfig, threadedMessagesStyle:new ThreadedMessagesStyle({ background:'#f5f6f8', titleColor:'#17202a', titleFont:'700 17px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', closeIconTint:'#51635e' }) }))
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
  loading.value = true; error.value = ''
  let stage = '获取活动群聊会话'
  try {
    const data = props.sessionData || await api.chatSession({ event_id: props.eventId, chat_access_token: props.token })
    stage = '初始化 CometChat'
    const settings = new UIKitSettingsBuilder().setAppId(data.app_id).setRegion(data.region).setAutoEstablishSocketConnection(true).build()
    await CometChatUIKit.init(settings)
    CometChatUIKit.Localize.init('zh', chineseResources)
    stage = '登录 CometChat'
    const logged = await CometChatUIKit.getLoggedinUser()
    if (!logged || logged.getUid() !== data.uid) {
      if (logged) await CometChatUIKit.logout()
      await CometChatUIKit.loginWithAuthToken(data.auth_token)
    }
    if (!alive) return
    guid = data.guid
    group.value = await CometChat.getGroup(guid).catch(() => new CometChat.Group(guid))
    CometChat.addMessageListener(listenerId, new CometChat.MessageListener({ onTextMessageReceived: received, onMediaMessageReceived: received, onCustomMessageReceived: received }))
    stage = '获取群组成员'
    const people = await members().catch(() => [])
    emit('update', { people })
    await refresh()
  } catch (e) {
    console.warn('活动讨论连接失败', stage, e?.message || e?.code || '未知错误')
    error.value = '连接失败'
  }
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
.discussion-host { min-width:0; }.discussion-state { padding:28px; text-align:center; background:#fff; border-radius:16px; }.discussion-state button { margin-left:12px; }.discussion-head { background:#f5f6f8; }.notice { padding:16px; margin-bottom:12px; border:1px solid #f4e5aa; border-radius:17px; background:#fff7df; white-space:pre-wrap; }.notice>div { display:flex; justify-content:space-between; gap:8px; }.notice span { color:#8a6b10; font-size:12px; }.notice p { margin:8px 0 0; font-size:14px; line-height:1.7; }.archive { padding:12px; margin-bottom:12px; background:#eceff1; border-radius:10px; text-align:center; }.chat-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:15px 16px; border-radius:17px 17px 0 0; background:#fff; border-bottom:1px solid #e8ebef; }.chat-head strong { display:block; font-size:16px; }.chat-head span { display:block; margin-top:2px; color:#6b7280; font-size:11px; }.chat-head small { color:#0f766e; font-size:12px; }.chat-shell { height:min(72vh,720px); min-height:480px; background:#f8faf9; overflow:hidden; border-radius:0 0 17px 17px; }.hint-banner { display:flex; justify-content:space-between; align-items:center; width:100%; margin-bottom:12px; padding:11px 13px; border:0; border-radius:13px; background:#e9f7f3; color:#0f766e; text-align:left; font-size:12px; }.hint-banner strong { white-space:nowrap; }.sheet-backdrop { position:fixed; inset:0; z-index:200; background:#0008; display:flex; align-items:flex-end; justify-content:center; }.hint-sheet { width:min(100%,430px); max-height:90dvh; overflow:auto; padding:24px 20px max(24px,env(safe-area-inset-bottom)); border-radius:20px 20px 0 0; background:#fff; }.hint-sheet button { display:block; width:100%; padding:12px; margin-top:12px; border:0; border-radius:10px; background:#16a085; color:#fff; }.hint-sheet button.later { background:#f5f6f8; color:#17202a; }
.chat-shell :deep(.cc-messages-wrapper),.chat-shell :deep(.cc-messages-wrapper__messages),.chat-shell :deep(.cc-messages-wrapper__messages-list),.chat-shell :deep(.cc-messagelist) { background:#f8faf9!important; }.chat-shell :deep(.cc-messages-wrapper__header) { display:none!important; }.chat-shell :deep(.cc-messagelist__wrapper) { padding:14px 8px 10px; }.chat-shell :deep(.cc-messagebubble-wrapper) { padding:5px 8px; }.chat-shell :deep(.cc-messagebubble-wrapper[style*="center"]) { display:none!important; }.chat-shell :deep(.cc-messagebubble-wrapper__avatar:not(.hidden)) { margin:0 3px; }.chat-shell :deep(.cc-messagebubble-wrapper[style*="flex-end"] .cc-messagebubble-wrapper__content>div) { background:#dff4ee!important; border-radius:15px 5px 15px 15px!important; box-shadow:0 2px 8px #17202a0f; }.chat-shell :deep(.cc-messagebubble-wrapper[style*="flex-start"] .cc-messagebubble-wrapper__content>div) { background:#fff!important; border-radius:5px 15px 15px 15px!important; box-shadow:0 2px 8px #17202a0f; }.chat-shell :deep(.cc-messagelist__bubbleheader) { color:#687570!important; font-size:11px!important; }.chat-shell :deep(.cc__messagelist__threadreplies) { margin-top:6px!important; padding:7px 10px!important; border:1px solid #cae4dd; border-radius:10px; background:#f2fbf8!important; color:#0f766e!important; font-weight:700!important; }.chat-shell :deep(.cc-messagelist__date__container) { color:#6b7773!important; background:#edf1f0!important; border-radius:999px!important; box-shadow:none!important; }.chat-shell :deep(.cc-messages-wrapper__composer) { background:#fff!important; border-top:1px solid #e8ebef; padding:10px 11px calc(10px + env(safe-area-inset-bottom)); }.chat-shell :deep(.cc-messagecomposer-wrapper) { background:#fff!important; border-radius:22px; }.chat-shell :deep(.messageinput) { background:#f5f7f7!important; border:1px solid #dfe5e4; border-radius:20px!important; }.chat-shell :deep(.cc-threadedmessages-wrapper) { background:#f5f6f8!important; }.chat-shell :deep(.cc-threadedmessages-wrapper__header) { min-height:58px; background:#fff!important; border-bottom:1px solid #e8ebef; }.chat-shell :deep(.cc-threadedmessages-wrapper__title) { font-weight:700!important; }.chat-shell :deep(.cc-threadedmessages-wrapper__close) { min-width:34px; min-height:34px; border-radius:50%; background:#f1f4f3; }
.chat-shell.closed :deep(.cc-threadedmessages-wrapper__composer),.chat-shell.closed :deep(.cc-messages-wrapper__composer){display:none!important}
@media(max-width:640px){.chat-shell {height:calc(100dvh - 225px);min-height:420px}.chat-shell :deep(.cc-messages-wrapper__threadedmessages){position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;z-index:100;background:#fff}.chat-shell :deep(.cc-threadedmessages-wrapper){height:100%!important}.chat-shell :deep(.cc-threadedmessages-wrapper__composer){bottom:env(safe-area-inset-bottom)!important}.chat-shell :deep(.cc__messagelist__threadreplies){color:#0f766e!important;font-weight:700!important}}
</style>
