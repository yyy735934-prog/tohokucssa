<template>
  <div class="container" style="max-width:500px">
    <div class="mb-16"><router-link to="/square" style="font-size:13px">← 活动广场</router-link></div>
    <div v-if="!event" class="empty-state">{{ error || '加载中…' }}</div>
    <template v-else>
      <div class="card" style="text-align:center">
        <h1 style="font-size:20px;margin-bottom:8px">{{ event.title }}</h1>
        <p style="font-size:14px;color:var(--c-text-secondary)">活动签到</p>

        <div v-if="!canCheckin" class="mt-24">
          <p style="color:var(--c-text-secondary)">{{ event.status==='closed'?'活动已结束':'活动尚未开始,暂不能签到' }}</p>
        </div>

        <div v-else-if="checkedIn" class="mt-24">
          <div class="success-icon">✓</div>
          <p style="font-size:20px;font-weight:600;color:var(--c-success)">签到成功</p>
          <p v-if="alreadyChecked" style="font-size:13px;color:var(--c-text-secondary);margin-top:6px">你已签到过了</p>
        </div>

        <form v-else class="mt-24" @submit.prevent="doCheckin">
          <div class="form-group" style="text-align:left">
            <label>请输入报名邮箱</label>
            <input v-model="email" type="email" required placeholder="你报名时填的邮箱" />
          </div>
          <p v-if="formError" style="color:var(--c-danger);font-size:13px;margin-bottom:12px">{{ formError }}</p>
          <button type="submit" class="btn-primary btn-block" :disabled="busy">{{ busy ? '签到中…' : '签到' }}</button>
        </form>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../../services/api.js'

const route = useRoute()
const event = ref(null)
const error = ref('')
const email = ref('')
const formError = ref('')
const busy = ref(false)
const checkedIn = ref(false)
const alreadyChecked = ref(false)
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
    const data = await api.publicCheckin(Number(route.params.id), email.value)
    checkedIn.value = true
    alreadyChecked.value = !!data.alreadyCheckedIn
  } catch (e) { formError.value = e.message }
  busy.value = false
}
</script>

<style scoped>
.success-icon {
  width: 56px; height: 56px;
  background: var(--c-success-light);
  color: var(--c-success);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 700;
  margin: 0 auto 12px;
}
</style>
