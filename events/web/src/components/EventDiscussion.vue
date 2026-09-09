<template>
  <section class="event-discussion" @pointerdown="registerInteraction" @focusin="registerInteraction">
    <button v-if="showFloatBanner" type="button" class="float-hint-banner" @click="openFloatHint">
      <span>📌 <b>建议把活动留在微信浮窗</b><small>以后不用翻群找链接</small></span>
      <em>查看方法 ›</em>
    </button>
    <div v-if="notes" class="event-announcement"><b>📌 主办方通知</b><p>{{ notes }}</p></div>
    <div class="discussion-heading"><div><h2>活动讨论</h2><p>仅参与者可发言</p></div><b>{{ participantCount }} 人</b></div>
    <div v-if="archived" class="discussion-archive"><b>本活动已结束 · 讨论已归档</b><span>历史消息仍可查看</span></div>
    <div class="event-chat-shell">
      <CometChatMessages
        :group="group"
        :hide-message-composer="archived"
        :message-list-configuration="messageListConfiguration"
        :threaded-messages-configuration="threadedMessagesConfiguration"
        :on-error="handleError"
      />
    </div>

    <div v-if="showFloatSheet" class="float-hint-backdrop" @click.self="closeFloatHint('later')">
      <div class="float-hint-sheet" role="dialog" aria-modal="true" aria-labelledby="float-hint-title">
        <span class="float-hint-grip"></span>
        <h2 id="float-hint-title">📌 以后不用翻群找链接</h2>
        <p>把这个活动留在微信浮窗里，活动期间可以随时回来查看通知和聊天。</p>
        <ul><li>💬 活动讨论</li><li>📢 主办方通知</li><li>📍 集合信息</li></ul>
        <strong>右上角 ··· →「浮窗」</strong>
        <div><button type="button" class="float-primary" @click="closeFloatHint('known')">我知道了</button><button type="button" @click="closeFloatHint('later')">稍后再说</button></div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import {
  CometChatMessages,
  MessageComposerConfiguration,
  MessageListConfiguration,
  MessageListStyle,
  ThreadedMessagesConfiguration,
} from '@cometchat/chat-uikit-vue'
import { CometChat } from '@cometchat/chat-sdk-javascript'

const props = defineProps({
  eventId: { type: [Number, String], required: true },
  eventDate: { type: String, default: '' },
  group: { type: Object, required: true },
  guid: { type: String, required: true },
  notes: { type: String, default: '' },
  participantCount: { type: Number, default: 0 },
  archived: { type: Boolean, default: false },
})
const emit = defineEmits(['interaction', 'refresh', 'error'])
const showFloatSheet = ref(false)
const isWechat = /MicroMessenger/i.test(navigator.userAgent)
const seenKey = `event_float_hint_seen_${props.eventId}`
const eventDayKey = `event_float_hint_eventday_${props.eventId}`
const showFloatBanner = ref(isWechat && localStorage.getItem(seenKey) === '1')

const messageListConfiguration = computed(() => new MessageListConfiguration({
  messagesRequestBuilder: new CometChat.MessagesRequestBuilder().setGUID(props.guid).setLimit(30).hideReplies(true),
  messageListStyle: new MessageListStyle({
    threadReplyTextColor: '#0f766e',
    threadReplyIconTint: '#0f766e',
    threadReplyTextFont: '700 14px Inter, sans-serif',
    threadReplyUnreadTextColor: '#ffffff',
    threadReplyUnreadBackground: '#0f766e',
  }),
}))
const threadedMessagesConfiguration = computed(() => new ThreadedMessagesConfiguration({
  hideMessageComposer: props.archived,
  messageComposerConfiguration: new MessageComposerConfiguration({ hideLiveReaction: true }),
  onClose: () => emit('refresh'),
}))

function isEventDay() {
  if (!props.eventDate) return false
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' })
  const today = formatter.format(new Date())
  return props.eventDate.slice(0, 10) === today
}

function registerInteraction() {
  emit('interaction')
  window.setTimeout(() => emit('refresh'), 900)
  if (!isWechat || showFloatSheet.value) return
  const firstUse = localStorage.getItem(seenKey) !== '1'
  const eventDayReminder = isEventDay() && localStorage.getItem(eventDayKey) !== '1'
  if (firstUse || eventDayReminder) showFloatSheet.value = true
}

function closeFloatHint() {
  localStorage.setItem(seenKey, '1')
  if (isEventDay()) localStorage.setItem(eventDayKey, '1')
  showFloatSheet.value = false
  showFloatBanner.value = true
}
function openFloatHint() { showFloatSheet.value = true }
function handleError(error) { emit('error', error) }
</script>

<style scoped>
.event-discussion{min-width:0}.discussion-heading{display:flex;align-items:center;justify-content:space-between;padding:4px 2px 14px}.discussion-heading h2{font-size:20px}.discussion-heading p{margin-top:3px;color:var(--event-muted);font-size:13px}.discussion-heading>b{padding:6px 10px;border-radius:999px;background:var(--event-soft);color:var(--event-brand-dark);font-size:13px}.event-announcement{margin-bottom:12px;padding:16px;border:1px solid #d8eee8;border-radius:16px;background:var(--event-soft)}.event-announcement b{color:var(--event-brand-dark);font-size:14px}.event-announcement p{margin-top:8px;white-space:pre-wrap;font-size:14px;line-height:1.7}.discussion-archive{margin-bottom:12px;padding:13px 15px;display:flex;flex-direction:column;border-radius:14px;background:var(--event-warn);color:#825f13}.discussion-archive b{font-size:14px}.discussion-archive span{margin-top:3px;font-size:12px}.event-chat-shell{height:min(680px,calc(100dvh - 210px));min-height:520px;overflow:hidden;border:1px solid var(--event-line);border-radius:18px;background:#fff}.float-hint-banner{width:100%;margin-bottom:12px;padding:11px 13px;display:flex;align-items:center;justify-content:space-between;border:1px solid #cfe8e1;border-radius:13px;background:var(--event-soft);color:var(--event-brand-dark);text-align:left}.float-hint-banner span,.float-hint-banner small{display:block}.float-hint-banner small{margin:2px 0 0 25px;color:var(--event-muted);font-size:12px}.float-hint-banner em{font-style:normal;font-size:13px;font-weight:700}.float-hint-backdrop{position:fixed;inset:0;z-index:500;display:flex;align-items:flex-end;background:rgba(16,31,28,.46)}.float-hint-sheet{width:min(100%,640px);max-height:calc(100dvh - 24px);margin:0 auto;padding:12px 22px calc(22px + env(safe-area-inset-bottom));overflow:auto;border-radius:22px 22px 0 0;background:#fff}.float-hint-grip{width:40px;height:4px;margin:0 auto 18px;display:block;border-radius:4px;background:#d7dcda}.float-hint-sheet h2{font-size:21px}.float-hint-sheet>p{margin-top:10px;color:var(--event-muted);font-size:15px;line-height:1.65}.float-hint-sheet ul{margin:16px 0;padding:14px 18px;display:grid;gap:8px;border-radius:14px;background:#f5f7f6;list-style:none;font-size:14px}.float-hint-sheet>strong{display:block;color:var(--event-brand-dark);font-size:15px}.float-hint-sheet>div{margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:9px}.float-hint-sheet button{padding:12px;border:1px solid var(--event-line);border-radius:12px;background:#fff;font-weight:700}.float-hint-sheet .float-primary{border-color:var(--event-brand);background:var(--event-brand);color:#fff}
:deep(.cc-messages-wrapper__threadedmessages){z-index:30}:deep(.cc-threadedmessages-wrapper__title){font-size:0}:deep(.cc-threadedmessages-wrapper__title)::after{content:'话题讨论';font-size:17px;font-weight:700}:deep(.cc-threadedmessages-wrapper__composer){padding-bottom:env(safe-area-inset-bottom)}
@media(max-width:640px){.event-chat-shell{height:calc(100dvh - 190px);min-height:500px;border-radius:16px}:deep(.cc-messages-wrapper__threadedmessages){position:fixed!important;inset:0!important;width:100%!important;height:100dvh!important;background:#fff}:deep(.cc-threadedmessages-wrapper){width:100%!important;height:100dvh!important;border-radius:0!important}:deep(.cc-threadedmessages-wrapper__list){min-height:0}:deep(.cc-threadedmessages-wrapper__composer){padding-bottom:max(8px,env(safe-area-inset-bottom))}.float-hint-sheet>div{grid-template-columns:1fr}}
</style>
