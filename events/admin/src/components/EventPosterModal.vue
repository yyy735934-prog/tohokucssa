<template>
  <div class="modal-overlay poster-overlay" @click.self="$emit('close')">
    <div class="modal poster-modal">
      <div class="poster-head"><div><h3 class="modal-title">活动报名海报</h3><p>二维码将打开该活动的公开报名页</p></div><button class="btn btn-outline btn-sm" @click="$emit('close')">关闭</button></div>
      <div class="canvas-wrap"><canvas ref="canvas"></canvas></div>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="modal-actions"><button class="btn btn-outline" :disabled="busy" @click="download">下载海报</button><button class="btn btn-primary" :disabled="busy" @click="share">{{ busy ? '生成中…' : '转发海报' }}</button></div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onMounted, ref } from 'vue'
import QRCode from 'qrcode'
import { showToast } from '../lib/toast.js'

const props = defineProps({ event: { type: Object, required: true } })
defineEmits(['close'])
const canvas = ref(null)
const busy = ref(true)
const error = ref('')
const publicPath = props.event.event_mode === 'gathering' ? `/g/${props.event.id}` : `/e/${props.event.id}`
const publicUrl = `${window.location.origin}${publicPath}`

onMounted(async () => { await nextTick(); await render(); busy.value = false })

function roundedRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill() }
function wrap(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const chars = [...String(text || '')]; let line = ''; let lines = 0
  for (let i = 0; i < chars.length && lines < maxLines; i++) {
    const trial = line + chars[i]
    if (ctx.measureText(trial).width > maxWidth && line) { ctx.fillText(line, x, y + lines++ * lineHeight); line = chars[i] } else line = trial
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lineHeight)
}
function loadImage(src) { return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src }) }

async function render() {
  try {
    const el = canvas.value; el.width = 1080; el.height = 1350
    const ctx = el.getContext('2d'); ctx.fillStyle = '#f5f1e8'; ctx.fillRect(0, 0, el.width, el.height)
    ctx.fillStyle = '#16382c'; ctx.fillRect(0, 0, el.width, 625)
    if (props.event.image_key) {
      try { const img = await loadImage(`/api/images/serve/${props.event.id}`); const scale = Math.max(1080 / img.width, 625 / img.height); ctx.drawImage(img, (1080 - img.width * scale) / 2, (625 - img.height * scale) / 2, img.width * scale, img.height * scale); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, 0, 1080, 625) } catch {}
    }
    ctx.fillStyle = props.event.event_mode === 'gathering' ? '#ff7a45' : '#2e7d62'; roundedRect(ctx, 72, 64, props.event.event_mode === 'gathering' ? 170 : 210, 64, 32)
    ctx.fillStyle = '#fff'; ctx.font = 'bold 31px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(props.event.event_mode === 'gathering' ? '组个局' : '正式活动', props.event.event_mode === 'gathering' ? 157 : 177, 107); ctx.textAlign = 'left'
    ctx.fillStyle = '#fff'; ctx.font = 'bold 64px system-ui, sans-serif'; wrap(ctx, props.event.title, 72, 420, 936, 78, 2)
    ctx.fillStyle = '#17362d'; ctx.font = 'bold 34px system-ui, sans-serif'; ctx.fillText(props.event.event_date || '时间待定', 72, 710)
    if (props.event.location) { ctx.font = '28px system-ui, sans-serif'; ctx.fillStyle = '#53675f'; ctx.fillText(`地点：${props.event.location}`, 72, 762) }
    ctx.font = '27px system-ui, sans-serif'; ctx.fillStyle = '#53675f'; wrap(ctx, props.event.content || props.event.notes || '欢迎报名参加，活动详情请扫码查看。', 72, 835, 630, 42, 4)
    const qrData = await QRCode.toDataURL(publicUrl, { width: 300, margin: 2, color: { dark: '#17362d', light: '#ffffff' } })
    const qr = await loadImage(qrData); ctx.fillStyle = '#fff'; roundedRect(ctx, 746, 730, 282, 350, 24); ctx.drawImage(qr, 769, 753, 236, 236)
    ctx.textAlign = 'center'; ctx.fillStyle = '#17362d'; ctx.font = 'bold 25px system-ui, sans-serif'; ctx.fillText('扫码查看详情并报名', 887, 1031); ctx.textAlign = 'left'
    ctx.strokeStyle = '#d8d1c3'; ctx.beginPath(); ctx.moveTo(72, 1138); ctx.lineTo(1008, 1138); ctx.stroke()
    ctx.fillStyle = '#17362d'; ctx.font = 'bold 31px system-ui, sans-serif'; ctx.fillText('学友会活动平台', 72, 1215)
    ctx.fillStyle = '#7b877f'; ctx.font = '24px system-ui, sans-serif'; ctx.fillText('发现同好，一起出发', 72, 1262)
  } catch (e) { error.value = `海报生成失败：${e.message}` }
}
function blob() { return new Promise((resolve) => canvas.value.toBlob(resolve, 'image/png', 0.95)) }
async function download() { const data = await blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(data); a.download = `${props.event.title}-报名海报.png`; a.click(); URL.revokeObjectURL(a.href) }
async function share() {
  busy.value = true
  try { const data = await blob(); const file = new File([data], `${props.event.title}-报名海报.png`, { type: 'image/png' }); if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ title: props.event.title, text: '扫码查看活动详情并报名', files: [file] }); else { await download(); showToast('当前浏览器不支持直接转发，海报已下载') } } catch (e) { if (e.name !== 'AbortError') error.value = e.message }
  busy.value = false
}
</script>

<style scoped>
.poster-overlay { z-index:120; }.poster-modal { width:min(720px, 94vw); max-height:94vh; overflow:auto; }.poster-head { display:flex; justify-content:space-between; gap:12px; }.poster-head p { color:var(--c-text-2); font-size:13px; margin-top:4px; }.canvas-wrap { max-width:430px; margin:18px auto; border-radius:12px; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,.16); }.canvas-wrap canvas { display:block; width:100%; height:auto; }
</style>
