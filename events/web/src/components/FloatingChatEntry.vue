<template>
  <div v-if="availableEntries.length" class="floating-chat">
    <router-link
      v-for="entry in availableEntries"
      :key="entry.key"
      :to="entry.to"
      class="floating-chat-link"
      :aria-label="`${entry.label}${entry.unread ? `，${entry.unread} 条未读消息` : ''}`"
    >
      <span v-if="entry.unread" class="unread-badge">{{ entry.unread > 99 ? '99+' : entry.unread }}</span>
      <span class="chat-icon">💬</span>
      <span class="chat-label">{{ entry.label }}</span>
    </router-link>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { CometChat } from '@cometchat/chat-sdk-javascript'
import { CometChatUIKit, UIKitSettingsBuilder } from '@cometchat/chat-uikit-vue'
import { api } from '../api.js'

const props = defineProps({
  entries: { type: Array, required: true },
})

const availableEntries = ref([])
const listenerId = `floating-chat-${Math.random().toString(36).slice(2)}`

function unreadValue(result, guid) {
  return Number(result?.[guid] ?? result?.groups?.[guid] ?? result?.unreadMessageCount ?? 0) || 0
}

async function connect() {
  const resolved = []
  for (const entry of props.entries) {
    try {
      const data = await api.chatSession({
        event_id: Number(entry.eventId),
        occurrence_id: entry.occurrenceId ? Number(entry.occurrenceId) : undefined,
        chat_access_token: entry.token || undefined,
      })
      if (!resolved.length) {
        const settings = new UIKitSettingsBuilder()
          .setAppId(data.app_id)
          .setRegion(data.region)
          .setAutoEstablishSocketConnection(true)
          .build()
        await CometChatUIKit.init(settings)
        const logged = await CometChatUIKit.getLoggedinUser()
        if (!logged || logged.getUid() !== data.uid) {
          if (logged) await CometChatUIKit.logout()
          await CometChatUIKit.loginWithAuthToken(data.auth_token)
        }
      }
      const unread = await CometChat.getUnreadMessageCountForGroup(data.guid).catch(() => ({}))
      resolved.push({ ...entry, key: `${entry.eventId}-${entry.occurrenceId || 'event'}`, guid: data.guid, unread: unreadValue(unread, data.guid) })
    } catch {
      // 权限或群组时机不满足时不显示入口。
    }
  }
  availableEntries.value = resolved
  if (!resolved.length) return
  CometChat.addMessageListener(listenerId, new CometChat.MessageListener({
    onTextMessageReceived: increaseUnread,
    onMediaMessageReceived: increaseUnread,
    onCustomMessageReceived: increaseUnread,
  }))
}

function increaseUnread(message) {
  const guid = message?.getReceiverId?.() || message?.receiverId
  const entry = availableEntries.value.find((item) => item.guid === guid)
  if (entry) entry.unread += 1
}

onMounted(connect)
onBeforeUnmount(() => CometChat.removeMessageListener(listenerId))
</script>

<style scoped>
.floating-chat { position: fixed; right: max(18px, env(safe-area-inset-right)); bottom: max(22px, env(safe-area-inset-bottom)); z-index: 80; display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
.floating-chat-link { position: relative; display: flex; align-items: center; gap: 8px; min-height: 50px; padding: 10px 16px 10px 12px; color: #fff; background: var(--c-primary); border-radius: 999px; text-decoration: none; font-weight: 700; box-shadow: 0 8px 24px rgba(0,0,0,.22); }
.floating-chat-link:hover { transform: translateY(-1px); }
.chat-icon { font-size: 23px; line-height: 1; }
.chat-label { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.unread-badge { position: absolute; top: -7px; right: -4px; min-width: 21px; height: 21px; padding: 0 5px; display: grid; place-items: center; background: var(--c-danger); color: white; border: 2px solid white; border-radius: 11px; font-size: 11px; }
@media (max-width: 520px) { .chat-label { max-width: 105px; } }
</style>
