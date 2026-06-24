<template>
  <div class="login-page">
    <div class="login-card card">
      <div class="login-logo">EM</div>
      <h2>活动管理平台</h2>
      <p class="login-subtitle">Event Management</p>
      <form @submit.prevent="doLogin">
        <div class="form-group">
          <label>邮箱</label>
          <input v-model="email" type="email" placeholder="admin@example.com" required />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input v-model="password" type="password" placeholder="输入密码" required />
        </div>
        <p v-if="error" class="login-error">{{ error }}</p>
        <button type="submit" class="btn-primary btn-block" :disabled="loading">
          {{ loading ? '登录中…' : '登录' }}
        </button>
      </form>
      <p class="login-footer">
        <router-link to="/square">浏览活动广场 →</router-link>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, setToken } from '../services/api.js'

const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function doLogin() {
  error.value = ''
  loading.value = true
  try {
    const data = await api.login(email.value, password.value)
    setToken(data.token)
    router.push('/')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.login-card {
  width: 100%;
  max-width: 380px;
  text-align: center;
}
.login-logo {
  width: 48px; height: 48px;
  background: var(--c-primary);
  color: #fff;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
  margin: 0 auto 16px;
}
.login-card h2 {
  font-size: 22px;
  margin-bottom: 2px;
}
.login-subtitle {
  color: var(--c-text-secondary);
  font-size: 13px;
  margin-bottom: 24px;
}
.login-card form { text-align: left; }
.login-error {
  color: var(--c-danger);
  font-size: 13px;
  margin-bottom: 12px;
}
.login-footer {
  font-size: 13px;
  color: var(--c-text-secondary);
  margin-top: 20px;
}
</style>
