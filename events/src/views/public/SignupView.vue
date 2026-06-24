<template>
  <div class="container">
    <div class="mb-16"><router-link to="/square" style="font-size:13px">← 活动广场</router-link></div>
    <div v-if="!event" class="empty-state">{{ error || '加载中…' }}</div>
    <template v-else>
      <div class="card mb-16">
        <h1 class="signup-title">{{ event.title }}</h1>
        <div class="signup-meta">{{ event.event_date }}<span v-if="event.location"> · {{ event.location }}</span></div>
        <div v-if="event.content" class="signup-content mt-16">{{ event.content }}</div>
        <div v-if="event.notes" class="signup-notes mt-16">{{ event.notes }}</div>
        <div v-if="event.capacity" class="mt-16">
          <div class="flex-between" style="font-size:13px;color:var(--c-text-secondary)">
            <span>报名进度</span>
            <span>{{ event.signupCount }}/{{ event.capacity }}</span>
          </div>
          <div class="progress-bar" style="margin-top:6px">
            <div class="progress-fill" :style="{ width: percent+'%' }" :class="{ full: isFull }"></div>
          </div>
        </div>
      </div>

      <div v-if="done" class="card" style="text-align:center">
        <div class="success-icon">✓</div>
        <p style="font-size:18px;font-weight:600;color:var(--c-success)">报名成功!</p>
        <p style="font-size:13px;color:var(--c-text-secondary);margin-top:8px">活动当天记得准时参加</p>
        <div class="mt-24" style="padding-top:16px;border-top:1px solid var(--c-border)">
          <p style="font-size:12px;color:var(--c-text-secondary)">活动当天请使用以下链接签到</p>
          <router-link :to="`/checkin/${route.params.id}`" class="mt-16" style="display:inline-block">
            <button class="btn-outline btn-sm">前往签到页面 →</button>
          </router-link>
        </div>
      </div>

      <form v-else-if="event.status==='open' && !isFull" class="card" @submit.prevent="doSignup">
        <h2 style="font-size:16px;margin-bottom:16px">填写报名信息</h2>
        <div class="form-group">
          <label>姓名 *</label>
          <input v-model="form.name" required placeholder="你的姓名" />
        </div>
        <div class="form-group">
          <label>邮箱 *</label>
          <input v-model="form.email" type="email" required placeholder="用于接收活动通知" />
        </div>
        <div class="form-group">
          <label>手机号</label>
          <input v-model="form.phone" type="tel" placeholder="选填" />
        </div>
        <p v-if="formError" style="color:var(--c-danger);font-size:13px;margin-bottom:12px">{{ formError }}</p>
        <button type="submit" class="btn-primary btn-block" :disabled="submitting">{{ submitting ? '提交中…' : '提交报名' }}</button>
        <p style="font-size:11px;color:var(--c-text-secondary);margin-top:12px">你的信息仅供活动主办方联系使用,不会公开展示。</p>
      </form>

      <div v-else-if="isFull" class="card empty-state">报名已满</div>
      <div v-else class="card empty-state">
        <p v-if="event.status==='active'">活动已开始,报名已截止</p>
        <p v-else-if="event.status==='closed'">活动已结束</p>
        <p v-else>此活动暂未开放报名</p>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../../services/api.js'

const route = useRoute()
const event = ref(null)
const error = ref('')
const form = ref({ name: '', email: '', phone: '' })
const formError = ref('')
const submitting = ref(false)
const done = ref(false)

const percent = computed(() => event.value?.capacity ? Math.min(100, event.value.signupCount / event.value.capacity * 100) : 0)
const isFull = computed(() => event.value?.capacity && event.value.signupCount >= event.value.capacity)

onMounted(async () => {
  try {
    const data = await api.getEvent(route.params.id)
    event.value = data.event
  } catch (e) { error.value = e.message }
})

async function doSignup() {
  formError.value = ''
  submitting.value = true
  try {
    await api.signup({ event_id: Number(route.params.id), ...form.value })
    done.value = true
    event.value.signupCount++
  } catch (e) { formError.value = e.message }
  submitting.value = false
}
</script>

<style scoped>
.signup-title { font-size: 22px; }
.signup-meta { font-size: 14px; color: var(--c-text-secondary); margin-top: 4px; }
.signup-content { white-space: pre-wrap; font-size: 14px; }
.signup-notes { white-space: pre-wrap; font-size: 13px; color: var(--c-text-secondary); padding: 12px; background: var(--c-bg); border-radius: var(--radius); }
.progress-bar { height: 6px; background: var(--c-border); border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--c-primary); border-radius: 3px; transition: width .3s; }
.progress-fill.full { background: var(--c-danger); }
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
