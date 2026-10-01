<template>
  <div class="page">
    <div v-if="submitted" class="card center-card">
      <div class="icon-circle icon-success">✓</div>
      <h1 class="title">申请已提交</h1>
      <p class="sub">我们会尽快审核你的活动申请</p>
      <p class="sub">审核通过后活动将自动开放报名，届时会通过邮件通知你</p>
      <div style="margin-top:24px;display:flex;gap:8px;justify-content:center">
        <router-link to="/" class="btn btn-outline btn-sm">返回首页</router-link>
        <button class="btn btn-primary btn-sm" @click="reset">继续申请</button>
      </div>
    </div>

    <template v-else>
      <h1 class="page-title">活动申请</h1>
      <p class="page-sub">填写活动信息，提交后等待审核通过即可开放报名</p>

      <form class="card" @submit.prevent="submit" style="margin-top:16px">
        <div class="section-label">申请人信息</div>
        <div class="field">
          <label class="label">你的姓名 *</label>
          <input v-model="form.submitter_name" required placeholder="填写你的姓名" />
        </div>
        <div class="field-row">
          <div class="field">
            <label class="label">邮箱 *</label>
            <input v-model="form.submitter_email" type="email" required placeholder="审核结果将发送到此邮箱" />
          </div>
          <div class="field">
            <label class="label">手机号</label>
            <input v-model="form.submitter_phone" type="tel" placeholder="方便联系你" />
          </div>
        </div>

        <div class="divider"></div>
        <div class="section-label">活动信息</div>

        <div class="field">
          <label class="label">活动名称 *</label>
          <input v-model="form.title" required placeholder="起一个吸引人的活动名称" />
        </div>
        <div class="field-row">
          <div class="field">
            <label class="label">活动时间 *</label>
            <input v-model="form.event_date" required placeholder="如: 2026-08-15 14:00" />
          </div>
          <div class="field">
            <label class="label">活动地点</label>
            <input v-model="form.location" placeholder="线下地址或线上链接" />
          </div>
        </div>
        <div class="field">
          <label class="label">活动介绍 *</label>
          <textarea v-model="form.content" rows="5" required placeholder="详细描述活动内容、流程、面向人群等"></textarea>
        </div>
        <div class="field">
          <label class="label">参与者须知</label>
          <textarea v-model="form.notes" rows="2" placeholder="需要参与者提前准备什么"></textarea>
        </div>
        <div class="field" style="max-width:160px">
          <label class="label">报名上限</label>
          <input v-model.number="form.capacity" type="number" min="0" placeholder="不限" />
        </div>
        <div class="field">
          <label class="label">补充说明</label>
          <textarea v-model="form.submitter_note" rows="2" placeholder="想对审核人员说的话（可选）"></textarea>
        </div>

        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" class="btn btn-primary" :disabled="busy" style="margin-top:8px">
          {{ busy ? '提交中…' : '提交申请' }}
        </button>
      </form>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { api } from '../api.js'

const submitted = ref(false)
const error = ref('')
const busy = ref(false)

const defaultForm = () => ({
  submitter_name: '', submitter_email: '', submitter_phone: '',
  title: '', event_date: '', location: '', content: '', notes: '',
  capacity: null, submitter_note: ''
})

const form = reactive(defaultForm())

async function submit() {
  error.value = ''
  busy.value = true
  try {
    await api.applyEvent(form)
    submitted.value = true
  } catch (e) { error.value = e.message }
  busy.value = false
}

function reset() {
  Object.assign(form, defaultForm())
  submitted.value = false
  error.value = ''
}
</script>

<style scoped>
.page-title { font-size: 22px; font-weight: 700; }
.page-sub { font-size: 14px; color: var(--c-text-2); margin-top: 4px; }
.section-label { font-size: 15px; font-weight: 600; margin-bottom: 12px; color: var(--c-text); }
.field-row { display: flex; gap: 12px; }
.field-row .field { flex: 1; }
.divider { height: 1px; background: var(--c-border); margin: 20px 0; }
.center-card { text-align: center; padding: 40px 20px; margin-top: 20px; }
.title { font-size: 22px; font-weight: 700; }
.sub { font-size: 14px; color: var(--c-text-2); margin-top: 8px; }
.icon-circle {
  width: 56px; height: 56px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; font-weight: 700; margin: 0 auto 16px;
}
.icon-success { background: var(--c-success-bg); color: var(--c-success); }
@media (max-width: 480px) {
  .field-row { flex-direction: column; gap: 0; }
}
</style>
