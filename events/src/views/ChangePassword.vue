<template>
  <div class="container" style="max-width:420px">
    <div class="mb-16"><router-link to="/" style="font-size:13px">← 返回</router-link></div>
    <h1 style="font-size:20px;margin-bottom:20px">修改密码</h1>
    <form class="card" @submit.prevent="submit">
      <div class="form-group">
        <label>原密码</label>
        <input v-model="form.old_password" type="password" required placeholder="输入当前密码" />
      </div>
      <div class="form-group">
        <label>新密码</label>
        <input v-model="form.new_password" type="password" required minlength="6" placeholder="至少6位" />
      </div>
      <div class="form-group">
        <label>确认新密码</label>
        <input v-model="confirm" type="password" required placeholder="再输入一次" />
      </div>
      <p v-if="error" style="color:var(--c-danger);font-size:13px;margin-bottom:12px">{{ error }}</p>
      <p v-if="ok" style="color:var(--c-success);font-size:13px;margin-bottom:12px">{{ ok }}</p>
      <button type="submit" class="btn-primary btn-block" :disabled="busy">{{ busy ? '提交中…' : '修改密码' }}</button>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../services/api.js'
import { toast } from '../lib/toast.js'

const router = useRouter()

const form = ref({ old_password: '', new_password: '' })
const confirm = ref('')
const error = ref('')
const ok = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  ok.value = ''
  if (form.value.new_password !== confirm.value) { error.value = '两次密码不一致'; return }
  busy.value = true
  try {
    await api.changePassword(form.value.old_password, form.value.new_password)
    toast('密码修改成功')
    router.push('/')
  } catch (e) { error.value = e.message }
  busy.value = false
}
</script>
