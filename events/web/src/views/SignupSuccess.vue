<template>
  <div class="page">
    <div v-if="!signup" class="empty">{{ error || '加载中…' }}</div>
    <template v-else>
      <div class="card qr-card">
        <div class="check-icon">✓</div>
        <h1 class="title">报名成功</h1>
        <h2 class="event-name">{{ signup.event_title }}</h2>
        <div class="info">{{ signup.event_date }}<span v-if="signup.location"> · {{ signup.location }}</span></div>

        <div v-if="showQr" class="qr-section">
          <p class="qr-hint">活动当天出示此二维码签到</p>
          <div class="qr-wrap">
            <canvas ref="qrCanvas"></canvas>
          </div>
          <p class="qr-name">{{ signup.name }}</p>
        </div>
        <div v-else class="qr-section">
          <p class="qr-hint">签到码将在活动前一天开放查看，届时也会通过邮件发送</p>
        </div>

        <div v-if="signup.checked_in" class="checked-badge">已签到 ✓</div>

        <p v-if="showQr" class="save-hint">请截图保存此页面</p>
      </div>

      <div style="display:flex;gap:8px;margin-top:16px">
        <router-link :to="`/e/${signup.event_id}`" class="btn btn-outline btn-sm" style="flex:1">活动详情</router-link>
        <router-link to="/my" class="btn btn-outline btn-sm" style="flex:1">我的</router-link>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api.js'
import QRCode from 'qrcode'

const route = useRoute()
const signup = ref(null)
const error = ref('')
const qrCanvas = ref(null)
const showQr = ref(false)

function isWithinDays(eventDate, days) {
  if (!eventDate) return false
  const now = new Date()
  const jstNow = new Date(now.getTime() + 9 * 3600000)
  const eventDay = new Date(eventDate.replace(/\s/, 'T') + '+09:00')
  return (eventDay - jstNow) < days * 24 * 3600000
}

onMounted(async () => {
  const token = route.query.token
  if (!token) { error.value = '缺少签到码'; return }
  try {
    const data = await api.getSignupByToken(token)
    signup.value = data.signup
    showQr.value = isWithinDays(data.signup.event_date, 1)
    await nextTick()
    if (showQr.value && qrCanvas.value) {
      const url = `${location.origin}/qr/${token}`
      QRCode.toCanvas(qrCanvas.value, url, { width: 200, margin: 2 })
    }
  } catch (e) { error.value = e.message }
})
</script>

<style scoped>
.qr-card { text-align: center; padding: 32px 20px; }
.check-icon {
  width: 48px; height: 48px; background: var(--c-success-bg); color: var(--c-success);
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 24px; font-weight: 700; margin: 0 auto 12px;
}
.title { font-size: 22px; font-weight: 700; }
.event-name { font-size: 17px; font-weight: 600; margin-top: 16px; }
.info { font-size: 14px; color: var(--c-text-2); margin-top: 4px; }
.qr-section { margin-top: 24px; padding: 20px; background: var(--c-bg); border-radius: var(--radius); }
.qr-hint { font-size: 13px; color: var(--c-text-2); margin-bottom: 16px; }
.qr-wrap { display: flex; justify-content: center; }
.qr-wrap canvas { border-radius: 8px; }
.qr-name { font-size: 15px; font-weight: 600; margin-top: 12px; }
.checked-badge {
  display: inline-block; margin-top: 16px; padding: 6px 20px;
  background: var(--c-success-bg); color: var(--c-success);
  border-radius: 99px; font-weight: 600; font-size: 14px;
}
.save-hint { font-size: 12px; color: var(--c-text-3); margin-top: 20px; }
</style>
