<template>
  <nav class="nav">
    <div class="nav-inner">
      <router-link to="/" class="nav-brand">活动平台</router-link>
      <div class="nav-links">
        <router-link to="/">参加活动</router-link>
        <router-link to="/apply">活动申请</router-link>
        <a v-if="auth.isLoggedIn && auth.role === 'reviewer'" href="/admin/" class="nav-admin">管理后台</a>
        <a v-else-if="auth.isLoggedIn && auth.role === 'host'" href="/admin/events" class="nav-admin">活动管理</a>
        <router-link to="/my" class="nav-my">
          <template v-if="auth.isLoggedIn">{{ auth.display_name || auth.email.split('@')[0] }}</template>
          <template v-else>我的</template>
        </router-link>
      </div>
    </div>
  </nav>
  <div class="toast-container">
    <div v-for="t in toasts" :key="t.id" class="pub-toast" :class="'toast-' + t.type">{{ t.message }}</div>
  </div>
  <main>
    <router-view />
  </main>
</template>

<script setup>
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { auth } from './auth.js'
import { toasts, showToast } from './lib/toast.js'

const route = useRoute()
const router = useRouter()

watch(() => route.query.google_token, (token) => {
  if (!token) return
  const q = route.query
  auth.save({
    token: q.google_token,
    email: q.email || '',
    role: q.role || '',
    is_super: q.is_super === '1',
    display_name: q.display_name || '',
  })
  localStorage.setItem('user_email', q.email || '')
  showToast(q.new === '1' ? '注册成功，欢迎加入！' : '登录成功')
  router.replace(route.path)
}, { immediate: true })
</script>

<style scoped>
.nav-my { font-weight: 600; }
.nav-admin {
  font-size: 13px; font-weight: 600; color: var(--c-primary);
  text-decoration: none; white-space: nowrap;
}
.nav-admin:hover { opacity: .8; }
.toast-container {
  position: fixed; top: 70px; left: 50%; transform: translateX(-50%);
  z-index: 100; display: flex; flex-direction: column; gap: 8px; align-items: center;
}
.pub-toast {
  background: var(--c-success); color: #fff; padding: 10px 24px;
  border-radius: 8px; font-size: 14px; font-weight: 600;
  box-shadow: 0 2px 8px rgba(0,0,0,.15); white-space: nowrap;
}
.toast-error { background: var(--c-danger); }
</style>
