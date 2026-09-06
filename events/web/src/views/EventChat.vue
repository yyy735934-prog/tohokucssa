<template>
  <div class="page chat-page">
    <div v-if="loading" class="card empty">正在连接活动群聊…</div>
    <div v-else-if="error" class="card empty error"><h2>无法进入群聊</h2><p>{{ error }}</p></div>
    <div v-else class="chat-shell"><CometChatMessages :group="group" /></div>
    <router-link :to="backPath" class="back-link">← 返回活动详情</router-link>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { CometChatMessages, CometChatUIKit, UIKitSettingsBuilder } from '@cometchat/chat-uikit-vue'
import { CometChat } from '@cometchat/chat-sdk-javascript'
import '@cometchat/chat-uikit-vue/dist/style.css'
import { api } from '../api.js'

const route = useRoute(); const loading = ref(true); const error = ref(''); const group = ref(null)
const isGathering = computed(() => route.path.startsWith('/g/'))
const backPath = computed(() => `${isGathering.value ? '/g/' : '/e/'}${route.params.id}`)

onMounted(async () => {
  try {
    const data = await api.chatSession({
      event_id: Number(route.params.id),
      occurrence_id: route.query.occurrence_id ? Number(route.query.occurrence_id) : undefined,
      chat_access_token: route.query.token || undefined,
    })
    const settings = new UIKitSettingsBuilder().setAppId(data.app_id).setRegion(data.region).setAutoEstablishSocketConnection(true).build()
    await CometChatUIKit.init(settings)
    const logged = await CometChatUIKit.getLoggedinUser()
    if (!logged || logged.getUid() !== data.uid) {
      if (logged) await CometChatUIKit.logout()
      await CometChatUIKit.loginWithAuthToken(data.auth_token)
    }
    group.value = new CometChat.Group(data.guid)
  } catch (e) { error.value = e.message || '群聊连接失败' }
  loading.value = false
})
</script>

<style scoped>
.chat-page { max-width: 980px; }.chat-shell { height: calc(100vh - 150px); min-height: 560px; border: 1px solid var(--c-border); border-radius: 12px; overflow: hidden; background: white; }.back-link { display:block; margin-top:14px; color:var(--c-text-2); }.empty{text-align:center;padding:40px}.error{color:var(--c-danger)}
</style>
