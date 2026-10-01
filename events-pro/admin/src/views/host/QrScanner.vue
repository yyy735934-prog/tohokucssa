<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">扫码签到</h1>
        <p class="page-sub">用摄像头扫描参与者的签到二维码</p>
      </div>
    </div>

    <div class="card scanner-card">
      <div v-if="!supported" class="empty">
        <p>你的浏览器不支持摄像头扫码</p>
        <p style="margin-top:8px;font-size:13px">请使用 Chrome / Edge / Safari 17.2+ 浏览器</p>
      </div>

      <template v-else>
        <div v-if="!scanning" style="text-align:center">
          <button class="btn btn-primary btn-lg" @click="startScan">开启摄像头</button>
        </div>

        <div v-else>
          <div class="video-wrap">
            <video ref="videoEl" autoplay playsinline></video>
            <div class="scan-overlay"></div>
          </div>
          <button class="btn btn-outline mt-12" @click="stopScan">关闭摄像头</button>
        </div>
      </template>

      <!-- Result -->
      <div v-if="result" class="result-card mt-16" :class="result.type">
        <div class="result-icon">{{ result.type === 'success' ? '✓' : '✕' }}</div>
        <div>
          <p class="result-title">{{ result.title }}</p>
          <p v-if="result.name" class="result-name">{{ result.name }}</p>
          <p v-if="result.message" class="result-msg">{{ result.message }}</p>
        </div>
      </div>

      <!-- Manual input fallback -->
      <div class="mt-24">
        <p style="font-size:13px;color:var(--c-text-2);margin-bottom:8px">或手动输入签到码</p>
        <form class="flex gap-8" @submit.prevent="manualCheckin">
          <input v-model="manualToken" placeholder="粘贴签到链接或token" style="flex:1" />
          <button type="submit" class="btn btn-primary" :disabled="busy">签到</button>
        </form>
      </div>

      <!-- History -->
      <div v-if="history.length" class="mt-24">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:8px">签到记录 ({{ history.length }})</h3>
        <div v-for="h in history" :key="h.time" class="history-item">
          <span class="badge" :class="h.ok ? 'badge-open' : 'badge-closed'">{{ h.ok ? '成功' : '失败' }}</span>
          <span style="font-weight:500">{{ h.name || '—' }}</span>
          <span style="color:var(--c-text-3);font-size:12px">{{ h.timeStr }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import { api } from '../../api.js'

const supported = ref('mediaDevices' in navigator)
const scanning = ref(false)
const videoEl = ref(null)
const result = ref(null)
const manualToken = ref('')
const busy = ref(false)
const history = ref([])

let stream = null
let detector = null
let animFrame = null
let lastScanned = ''
let cooldown = false

function extractToken(text) {
  const match = text.match(/\/qr\/([0-9a-f-]{36})/i)
  if (match) return match[1]
  if (/^[0-9a-f-]{36}$/i.test(text.trim())) return text.trim()
  return null
}

async function doCheckin(token) {
  if (busy.value) return
  busy.value = true
  result.value = null
  try {
    const data = await api.checkinByToken(token)
    if (data.alreadyCheckedIn) {
      result.value = { type: 'warning', title: '已签到', name: data.name, message: '此参与者之前已签到' }
    } else {
      result.value = { type: 'success', title: '签到成功', name: data.name }
    }
    history.value.unshift({ ok: true, name: data.name, time: Date.now(), timeStr: new Date().toLocaleTimeString('zh-CN') })
  } catch (e) {
    result.value = { type: 'error', title: '签到失败', message: e.message }
    history.value.unshift({ ok: false, name: '', time: Date.now(), timeStr: new Date().toLocaleTimeString('zh-CN') })
  }
  busy.value = false
  cooldown = true
  setTimeout(() => { cooldown = false }, 2000)
}

async function startScan() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    scanning.value = true
    await new Promise(r => setTimeout(r, 50))
    if (videoEl.value) {
      videoEl.value.srcObject = stream
    }

    if ('BarcodeDetector' in window) {
      detector = new BarcodeDetector({ formats: ['qr_code'] })
      detectLoop()
    }
  } catch (e) {
    result.value = { type: 'error', title: '无法开启摄像头', message: e.message }
  }
}

async function detectLoop() {
  if (!scanning.value || !videoEl.value || !detector) return
  try {
    const barcodes = await detector.detect(videoEl.value)
    for (const b of barcodes) {
      const token = extractToken(b.rawValue)
      if (token && token !== lastScanned && !cooldown) {
        lastScanned = token
        await doCheckin(token)
      }
    }
  } catch {}
  animFrame = requestAnimationFrame(detectLoop)
}

function stopScan() {
  scanning.value = false
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null }
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null }
  detector = null
}

async function manualCheckin() {
  const token = extractToken(manualToken.value)
  if (!token) { result.value = { type: 'error', title: '无效的签到码', message: '请输入有效的签到链接或token' }; return }
  await doCheckin(token)
  manualToken.value = ''
}

onUnmounted(stopScan)
</script>

<style scoped>
.scanner-card { max-width: 560px; }
.video-wrap { position: relative; border-radius: var(--radius); overflow: hidden; background: #000; }
.video-wrap video { width: 100%; display: block; }
.scan-overlay {
  position: absolute; inset: 0;
  border: 2px solid rgba(79,70,229,.5);
  box-shadow: inset 0 0 0 9999px rgba(0,0,0,.15);
}
.result-card {
  display: flex; align-items: center; gap: 12px;
  padding: 16px; border-radius: var(--radius); border: 1px solid;
}
.result-card.success { background: var(--c-success-bg); border-color: var(--c-success); }
.result-card.warning { background: var(--c-warning-bg); border-color: var(--c-warning); }
.result-card.error { background: var(--c-danger-bg); border-color: var(--c-danger); }
.result-icon { font-size: 24px; font-weight: 700; }
.result-card.success .result-icon { color: var(--c-success); }
.result-card.warning .result-icon { color: var(--c-warning); }
.result-card.error .result-icon { color: var(--c-danger); }
.result-title { font-weight: 600; }
.result-name { font-size: 15px; color: var(--c-text-2); }
.result-msg { font-size: 13px; color: var(--c-text-2); }
.history-item { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--c-border); }
</style>
