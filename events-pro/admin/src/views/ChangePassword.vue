<template>
  <div>
    <div class="page-header"><h1 class="page-title">修改密码</h1></div>
    <div class="card" style="max-width:480px">
      <form @submit.prevent="submit">
        <div class="field">
          <label class="label">原密码</label>
          <input v-model="form.old_password" type="password" required />
        </div>
        <div class="field">
          <label class="label">新密码</label>
          <input v-model="form.new_password" type="password" required minlength="6" />
          <p class="field-hint">至少6位</p>
        </div>
        <div class="field">
          <label class="label">确认新密码</label>
          <input v-model="confirm" type="password" required minlength="6" />
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" class="btn btn-primary" :disabled="busy">
          {{ busy ? '保存中…' : '保存' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { api } from '../api.js'
import { showToast } from '../lib/toast.js'

const form = reactive({ old_password: '', new_password: '' })
const confirm = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  if (form.new_password !== confirm.value) { error.value = '两次密码不一致'; return }
  busy.value = true
  try {
    await api.changePassword(form.old_password, form.new_password)
    showToast('密码修改成功')
    form.old_password = ''; form.new_password = ''; confirm.value = ''
  } catch (e) { error.value = e.message }
  busy.value = false
}
</script>
