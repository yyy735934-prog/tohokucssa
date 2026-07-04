<template>
  <div class="page">
    <div v-if="!event" class="empty">{{ error || '加载中…' }}</div>
    <template v-else>
      <div class="card center-card">
        <h1 class="title">{{ event.title }}</h1>
        <p class="sub">活动签到</p>

        <div v-if="!canCheckin" class="msg">
          {{ event.status === 'closed' ? '活动已结束' : '活动尚未开始' }}
        </div>

        <div v-else-if="checkedIn" class="result">
          <div class="icon-circle icon-success">✓</div>
          <p class="result-title">{{ already ? '已签到' : '签到成功!' }}</p>
          <p v-if="checkedName" class="result-name">{{ checkedName }}</p>
        </div>

        <form v-else @submit.prevent="doCheckin" style="margin-top:24px;text-align:left">
          <div class="field">
            <label class="label">报名邮箱</label>
            <input v-model="email" type="email" required placeholder="输入你报名时用的邮箱" />
          </div>
          <p v-if="formError" class="error">{{ formError }}</p>
          <button type="submit" class="btn btn-primary" :disabled="busy">
            {{ busy ? '签到中…' : '签到' }}
          </button>
        </form>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api.js'

const route = useRoute()
const event = ref(null)
const error = ref('')
const email = ref('')
const formError = ref('')
const busy = ref(false)
const checkedIn = ref(false)
const already = ref(false)
const checkedName = ref('')
const canCheckin = ref(false)

onMounted(async () => {
  try {
    const data = await api.getEvent(route.params.id)
    event.value = data.event
    canCheckin.value = ['open', 'active'].includes(data.event.status)
  } catch (e) { error.value = e.message }
})

async function doCheckin() {
  formError.value = ''
  busy.value = true
  try {
    const data = await api.checkinByEmail(Number(route.params.id), email.value)
    checkedIn.value = true
    already.value = !!data.alreadyCheckedIn
    checkedName.value = data.name || ''
  } catch (e) { formError.value = e.message }
  busy.value = false
}
</script>

<style scoped>
.center-card { text-align: center; padding: 32px 20px; margin-top: 20px; }
.title { font-size: 22px; font-weight: 700; }
.sub { font-size: 14px; color: var(--c-text-2); margin-top: 4px; }
.msg { margin-top: 24px; color: var(--c-text-2); }
.result { margin-top: 24px; }
.icon-circle {
  width: 56px; height: 56px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; font-weight: 700; margin: 0 auto 12px;
}
.icon-success { background: var(--c-success-bg); color: var(--c-success); }
.result-title { font-size: 20px; font-weight: 700; }
.result-name { font-size: 15px; color: var(--c-text-2); margin-top: 4px; }
</style>
