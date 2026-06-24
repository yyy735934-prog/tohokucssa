<template>
  <div class="login-page">
    <div class="login-card">
      <h1>学友会活动平台</h1>
      <p class="sub">登录你的管理账户</p>

      <p v-if="error" class="error">{{ error }}</p>

      <a href="/api/auth/google" class="google-btn">
        <svg viewBox="0 0 24 24" width="20" height="20" style="flex-shrink:0">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09a7.12 7.12 0 0 1 0-4.17V7.07H2.18a11.96 11.96 0 0 0 0 9.86l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0 7.7 0 3.99 2.47 2.18 6.07l3.66 2.85c.87-2.6 3.3-4.17 6.16-4.17z" fill="#EA4335"/>
        </svg>
        使用 Google 账号登录
      </a>

      <a v-if="!showPassword" class="toggle-link" @click.prevent="showPassword = true">使用密码登录</a>

      <template v-if="showPassword">
        <div class="divider"><span>密码登录</span></div>
        <form @submit.prevent="doLogin">
          <div class="field">
            <label class="label">邮箱</label>
            <input v-model="email" type="email" required placeholder="admin@example.com" />
          </div>
          <div class="field">
            <label class="label">密码</label>
            <input v-model="password" type="password" required minlength="6" placeholder="输入密码" />
          </div>
          <button type="submit" class="btn btn-primary btn-lg" :disabled="busy" style="width:100%">
            {{ busy ? '登录中…' : '登录' }}
          </button>
        </form>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api } from '../api.js'
import { auth } from '../lib/auth.js'

const router = useRouter()
const route = useRoute()
const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)
const showPassword = ref(false)

const ERROR_MAP = {
  google_denied: 'Google 授权已取消',
  invalid_state: '请求已过期，请重试',
  token_failed: 'Google 验证失败，请重试',
  userinfo_failed: '获取 Google 用户信息失败',
  no_account: '该 Google 账号未注册为管理员',
}

onMounted(() => {
  const q = route.query
  if (q.google_token) {
    auth.save({
      token: q.google_token,
      email: q.email || '',
      role: q.role || '',
      is_super: q.is_super === '1',
      display_name: q.display_name || '',
    })
    router.replace('/admin/events')
    return
  }
  if (q.error) {
    error.value = ERROR_MAP[q.error] || '登录失败'
    if (q.error === 'no_account' && q.email) {
      error.value += `（${q.email}）`
    }
  }
})

async function doLogin() {
  error.value = ''
  busy.value = true
  try {
    const data = await api.login(email.value, password.value)
    auth.save(data)
    router.push('/admin/events')
  } catch (e) { error.value = e.message }
  busy.value = false
}
</script>

<style scoped>
.login-page {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  background: var(--c-bg); padding: 20px;
}
.login-card {
  background: var(--c-surface); border-radius: var(--radius);
  box-shadow: var(--shadow-md); border: 1px solid var(--c-border);
  padding: 40px; width: 100%; max-width: 400px;
}
.login-card h1 { font-size: 22px; font-weight: 700; }
.sub { font-size: 14px; color: var(--c-text-2); margin: 4px 0 24px; }
.google-btn {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  width: 100%; padding: 12px; border: 1px solid var(--c-border); border-radius: 8px;
  background: var(--c-surface); font-size: 15px; font-weight: 600;
  color: var(--c-text-1); text-decoration: none; cursor: pointer;
  transition: background .15s, box-shadow .15s;
}
.google-btn:hover { background: var(--c-bg); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.divider {
  display: flex; align-items: center; gap: 12px; margin: 20px 0;
  color: var(--c-text-3); font-size: 13px;
}
.divider::before, .divider::after {
  content: ''; flex: 1; height: 1px; background: var(--c-border);
}
.toggle-link {
  display: block; text-align: center; margin-top: 16px;
  font-size: 13px; color: var(--c-text-3); cursor: pointer;
}
.toggle-link:hover { color: var(--c-text-2); }
</style>
