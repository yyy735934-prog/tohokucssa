<template>
  <div class="app">
    <!-- 已登录导航 -->
    <nav v-if="user" class="app-nav">
      <div class="container flex-between">
        <div class="flex gap-12" style="align-items:center">
          <router-link to="/" class="nav-brand">活动管理</router-link>
          <router-link to="/" class="nav-link">我的活动</router-link>
          <router-link v-if="user.role==='reviewer'" to="/review" class="nav-link">审核</router-link>
          <router-link v-if="user.role==='reviewer'" to="/users" class="nav-link">用户</router-link>
          <router-link to="/square" class="nav-link">广场</router-link>
        </div>
        <div class="flex gap-8 nav-right" style="align-items:center">
          <span class="nav-user">{{ user.display_name || user.email }}</span>
          <router-link to="/password" class="nav-link nav-link-pwd">改密</router-link>
          <button class="btn-outline btn-sm" @click="logout">退出</button>
        </div>
      </div>
    </nav>
    <!-- 未登录导航 -->
    <nav v-else class="app-nav">
      <div class="container flex-between">
        <div class="flex gap-12" style="align-items:center">
          <router-link to="/square" class="nav-brand">活动管理</router-link>
          <router-link to="/square" class="nav-link">活动广场</router-link>
        </div>
        <router-link to="/login" class="nav-link">登录</router-link>
      </div>
    </nav>
    <main>
      <router-view :key="$route.fullPath" />
    </main>
    <Toast />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api, clearToken, getToken, setRole } from './services/api.js'
import Toast from './components/Toast.vue'

const router = useRouter()
const user = ref(null)

async function checkAuth() {
  if (!getToken()) { user.value = null; return }
  try {
    const data = await api.me()
    user.value = data
    setRole(data.role)
  } catch {
    clearToken()
    user.value = null
  }
}

function logout() {
  api.logout().catch(() => {})
  clearToken()
  user.value = null
  router.push('/login')
}

onMounted(checkAuth)
router.afterEach(checkAuth)
</script>

<style>
.app-nav {
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-border);
  padding: 10px 0;
  position: sticky;
  top: 0;
  z-index: 100;
}
.app-nav .container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.nav-brand { font-weight: 700; font-size: 16px; color: var(--c-primary); white-space: nowrap; }
.nav-link { font-size: 14px; color: var(--c-text-secondary); white-space: nowrap; }
.nav-link.router-link-active { color: var(--c-primary); font-weight: 500; }
.nav-user { font-size: 13px; color: var(--c-text-secondary); }
@media (max-width: 600px) {
  .app-nav .container { padding: 0 12px; }
  .nav-brand { font-size: 15px; }
  .nav-link { font-size: 13px; }
  .nav-user { display: none; }
  .nav-right .badge { display: none; }
}
</style>
