<template>
  <div class="page">
    <div v-if="loading" class="card center-card">
      <p class="status-text">正在签到…</p>
    </div>
    <div v-else-if="error" class="card center-card">
      <div class="icon-circle icon-error">✕</div>
      <p class="result-title" style="color:var(--c-danger)">签到失败</p>
      <p class="result-sub">{{ error }}</p>
    </div>
    <div v-else class="card center-card">
      <div class="icon-circle icon-success">✓</div>
      <p class="result-title">{{ already ? '已签到' : '签到成功!' }}</p>
      <p v-if="name" class="result-name">{{ name }}</p>
      <p v-if="already" class="result-sub">你之前已经签到过了</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api.js'

const route = useRoute()
const loading = ref(true)
const error = ref('')
const name = ref('')
const already = ref(false)

onMounted(async () => {
  try {
    const data = await api.checkinByToken(route.params.token)
    name.value = data.name || ''
    already.value = !!data.alreadyCheckedIn
  } catch (e) { error.value = e.message }
  loading.value = false
})
</script>

<style scoped>
.center-card { text-align: center; padding: 48px 20px; margin-top: 40px; }
.status-text { font-size: 17px; color: var(--c-text-2); }
.icon-circle {
  width: 64px; height: 64px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 32px; font-weight: 700; margin: 0 auto 16px;
}
.icon-success { background: var(--c-success-bg); color: var(--c-success); }
.icon-error { background: var(--c-danger-bg); color: var(--c-danger); }
.result-title { font-size: 22px; font-weight: 700; }
.result-name { font-size: 17px; font-weight: 600; margin-top: 8px; color: var(--c-text-2); }
.result-sub { font-size: 14px; color: var(--c-text-2); margin-top: 6px; }
</style>
