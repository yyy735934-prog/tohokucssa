<template>
  <div class="page offer-page">
    <div v-if="loading" class="empty">加载邀请中…</div>
    <div v-else-if="error" class="card result-card"><h1>无法接单</h1><p>{{ error }}</p><router-link to="/" class="btn btn-outline">返回活动列表</router-link></div>
    <div v-else-if="offer" class="card offer-card">
      <div class="eyebrow">组个局 · 主理人邀请</div>
      <h1>{{ offer.title }}</h1>
      <p class="hello">{{ offer.display_name || offer.email }}，你愿意主理本周活动吗？</p>
      <dl><dt>暂定时间</dt><dd>{{ offer.event_date }}</dd><template v-if="offer.location"><dt>区域/地点</dt><dd>{{ offer.location }}</dd></template></dl>

      <div v-if="offer.status === 'accepted'" class="result success"><strong>你已接单</strong><span>人数达到最低要求后，即可确认最终安排。</span></div>
      <div v-else-if="offer.status === 'closed' || offer.created_by" class="result"><strong>已有候选主理人接单</strong><span>{{ offer.selected_host_name ? `${offer.selected_host_name} 已成为本周主理人。` : '这份邀请已关闭。' }}</span></div>
      <div v-else-if="['completed','cancelled'].includes(offer.gathering_state)" class="result"><strong>本次邀请已结束</strong></div>
      <template v-else>
        <p class="tip">点击接单后，你将成为本周唯一主理人；其他候选人的邀请会自动关闭。接单不等于报名参加，若你也参加活动，请再到活动页报名。</p>
        <button class="btn btn-primary" :disabled="busy" @click="accept">{{ busy ? '接单中…' : '同意接单' }}</button>
      </template>
      <router-link :to="`/g/${offer.event_id}`" class="event-link">查看组局详情 →</router-link>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api.js'

const route = useRoute()
const offer = ref(null)
const loading = ref(true)
const busy = ref(false)
const error = ref('')

onMounted(load)

async function load() {
  loading.value = true
  try { offer.value = (await api.getGatheringHostOffer(route.query.token)).offer }
  catch (e) { error.value = e.message }
  loading.value = false
}

async function accept() {
  busy.value = true
  try { await api.acceptGatheringHostOffer(route.query.token); await load() }
  catch (e) { error.value = e.message }
  busy.value = false
}
</script>

<style scoped>
.offer-page { max-width: 620px; }.offer-card h1, .result-card h1 { font-size: 24px; margin: 8px 0; }.eyebrow { color: var(--c-primary); font-size: 12px; font-weight: 700; }.hello, .tip { color: var(--c-text-2); line-height: 1.6; }.offer-card dl { display: grid; grid-template-columns: 90px 1fr; gap: 8px; margin: 20px 0; font-size: 14px; }.offer-card dt { color: var(--c-text-3); }.offer-card dd { margin: 0; }.tip, .result { background: var(--c-bg); border-radius: 8px; padding: 14px; margin: 18px 0; font-size: 13px; }.result { display: flex; flex-direction: column; gap: 5px; }.result span { color: var(--c-text-2); }.success { color: var(--c-success); background: var(--c-success-bg); }.event-link { display: block; margin-top: 20px; color: var(--c-primary); font-size: 13px; }.result-card { text-align: center; }.result-card p { margin: 10px 0 18px; color: var(--c-text-2); }
</style>
