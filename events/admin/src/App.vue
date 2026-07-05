<template>
  <div v-if="!auth.isLoggedIn">
    <router-view />
  </div>
  <div v-else-if="!verified" class="loading-screen">
    <div class="loading-spinner"></div>
  </div>
  <div v-else class="layout">
    <!-- Mobile top bar -->
    <header class="mobile-header">
      <button class="hamburger" @click="menuOpen = !menuOpen">
        <span></span><span></span><span></span>
      </button>
      <span class="mobile-brand">学友会活动平台</span>
      <button class="bell-btn" @click="toggleNotifPanel">
        🔔<span v-if="unreadNotifs" class="bell-badge">{{ unreadNotifs }}</span>
      </button>
      <router-link to="/admin/scan" class="scan-btn">扫码</router-link>
    </header>

    <!-- Sidebar (desktop always visible, mobile overlay) -->
    <div v-if="menuOpen" class="sidebar-overlay" @click="menuOpen = false"></div>
    <aside class="sidebar" :class="{ open: menuOpen }">
      <div class="sidebar-brand">
        学友会活动平台
        <button class="bell-btn desktop-bell" @click="toggleNotifPanel">
          🔔<span v-if="unreadNotifs" class="bell-badge">{{ unreadNotifs }}</span>
        </button>
      </div>
      <nav class="sidebar-nav" @click="menuOpen = false">
        <div class="sidebar-section">
          <div class="sidebar-label">活动</div>
          <router-link to="/admin/events" class="sidebar-link">{{ auth.role === 'user' ? '活动列表' : '我的活动' }}</router-link>
          <router-link to="/admin/events/new" class="sidebar-link">创建活动</router-link>
          <router-link v-if="auth.role !== 'user'" to="/admin/scan" class="sidebar-link">扫码签到</router-link>
        </div>
        <div v-if="auth.isReviewer" class="sidebar-section">
          <div class="sidebar-label">管理</div>
          <router-link to="/admin/overview" class="sidebar-link">数据总览</router-link>
          <router-link to="/admin/review" class="sidebar-link">
            审核队列
            <span v-if="pendingCount" class="count-badge">{{ pendingCount }}</span>
          </router-link>
          <router-link to="/admin/users" class="sidebar-link">用户管理</router-link>
        </div>
        <div class="sidebar-section">
          <div class="sidebar-label">公开页面</div>
          <a href="/" target="_blank" class="sidebar-link ext-link">活动列表首页 ↗</a>
          <a href="/my" target="_blank" class="sidebar-link ext-link">参与者查询 ↗</a>
        </div>
        <div class="sidebar-section">
          <div class="sidebar-label">账户</div>
          <a v-if="auth.role === 'user'" href="#" class="sidebar-link" @click.prevent="requestRole('host')">申请成为活动主理人</a>
          <a v-if="auth.role !== 'reviewer'" href="#" class="sidebar-link" @click.prevent="requestRole('reviewer')">申请成为管理员</a>
          <router-link to="/admin/password" class="sidebar-link">修改密码</router-link>
          <a href="#" class="sidebar-link" @click.prevent="logout">退出登录</a>
        </div>
      </nav>
      <div class="sidebar-footer">
        <span class="user-email">{{ auth.display_name || auth.email }}</span>
        <span class="user-role">
          {{ auth.isSuper ? '超级管理员' : auth.isReviewer ? '审核员' : auth.role === 'user' ? '普通用户' : '活动主理人' }}
        </span>
      </div>
    </aside>
    <main class="main-content">
      <router-view />
    </main>
    <!-- Notification panel -->
    <div v-if="showNotifPanel" class="notif-overlay" @click.self="showNotifPanel = false">
      <div class="notif-panel">
        <div class="notif-header">
          <span style="font-weight:600;font-size:15px">通知</span>
          <button v-if="unreadNotifs" class="btn btn-outline btn-sm" @click="markAllRead">全部已读</button>
          <button class="btn btn-outline btn-sm" @click="showNotifPanel = false">关闭</button>
        </div>
        <div v-if="!notifList.length" class="notif-empty">暂无通知</div>
        <div v-else class="notif-list">
          <div v-for="n in notifList" :key="n.id" class="notif-item" :class="{ unread: !n.is_read }"
            @click="n.event_id && $router.push(`/admin/events/${n.event_id}`); showNotifPanel = false">
            <div class="notif-dot" v-if="!n.is_read"></div>
            <div style="flex:1;min-width:0">
              <div class="notif-title">{{ n.title }}</div>
              <div class="notif-body">{{ n.body }}</div>
              <div class="notif-time">{{ formatTime(n.created_at) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="toast-container">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast-${t.type}`">
        {{ t.message }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, provide, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { auth } from './lib/auth.js'
import { toasts, showToast } from './lib/toast.js'
import { api } from './api.js'

const router = useRouter()
const route = useRoute()
const menuOpen = ref(false)
const pendingCount = ref(0)
const unreadNotifs = ref(0)
const showNotifPanel = ref(false)
const notifList = ref([])
const verified = ref(!auth.isLoggedIn)

onMounted(async () => {
  if (!auth.isLoggedIn) return
  try {
    const data = await api.me()
    auth.save({ token: auth.token, ...data })
    verified.value = true
  } catch {
    auth.clear()
    router.push('/admin/login')
  }
})

async function refreshAuth() {
  if (!auth.isLoggedIn) return
  try {
    const data = await api.me()
    if (data.role !== auth.role || data.display_name !== auth.display_name || !!data.is_super !== auth.isSuper) {
      auth.save({ token: auth.token, ...data })
    }
  } catch {}
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible' && auth.isLoggedIn) {
    refreshAuth()
    refreshPendingCount()
  }
}

document.addEventListener('visibilitychange', onVisibilityChange)
onUnmounted(() => document.removeEventListener('visibilitychange', onVisibilityChange))

async function refreshPendingCount() {
  if (!auth.isLoggedIn || !verified.value) return
  if (auth.isReviewer) {
    try {
      const data = await api.dashboardStats()
      pendingCount.value = data.stats.pending
    } catch {}
  }
  try {
    const data = await api.getUnreadCount()
    unreadNotifs.value = data.count
  } catch {}
}

async function toggleNotifPanel() {
  showNotifPanel.value = !showNotifPanel.value
  if (showNotifPanel.value) {
    try {
      const data = await api.getNotifications()
      notifList.value = data.notifications
      if (unreadNotifs.value) {
        await api.markAllRead()
        unreadNotifs.value = 0
        notifList.value.forEach(n => n.is_read = 1)
      }
    } catch {}
  }
}

async function markAllRead() {
  try {
    await api.markAllRead()
    unreadNotifs.value = 0
    notifList.value.forEach(n => n.is_read = 1)
  } catch {}
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  return d.toLocaleDateString('zh-CN')
}

provide('refreshPendingCount', refreshPendingCount)
watch(() => route.path, () => {
  menuOpen.value = false
  refreshAuth()
  refreshPendingCount()
}, { immediate: true })

watch(() => auth.isLoggedIn, (loggedIn) => {
  if (!loggedIn && route.path !== '/admin/login') {
    router.push('/admin/login')
  }
})

async function requestRole(role) {
  try {
    const data = await api.requestRole(role)
    showToast(data.message)
  } catch (e) { showToast(e.message, 'error') }
}

async function logout() {
  try { await api.logout() } catch {}
  auth.clear()
  router.push('/admin/login')
}
</script>

<style scoped>
.mobile-header {
  display: none;
  position: sticky; top: 0; z-index: 60;
  background: var(--c-surface); border-bottom: 1px solid var(--c-border);
  padding: 12px 16px;
  align-items: center; gap: 12px;
}
.mobile-brand { font-weight: 700; font-size: 15px; flex: 1; }
.scan-btn {
  font-size: 13px; font-weight: 600; color: var(--c-primary);
  padding: 4px 12px; border: 1px solid var(--c-primary); border-radius: 99px;
}
.hamburger {
  background: none; border: none; cursor: pointer; padding: 4px;
  display: flex; flex-direction: column; gap: 4px; width: 24px;
}
.hamburger span {
  display: block; width: 100%; height: 2px; background: var(--c-text); border-radius: 2px;
}
.sidebar-overlay {
  display: none;
  position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 49;
}
.count-badge {
  background: var(--c-danger); color: #fff; font-size: 11px; font-weight: 700;
  padding: 1px 7px; border-radius: 99px; margin-left: auto;
}

.bell-btn {
  position: relative; background: none; border: none; cursor: pointer;
  font-size: 18px; padding: 4px; line-height: 1;
}
.bell-badge {
  position: absolute; top: -4px; right: -6px;
  background: var(--c-danger); color: #fff; font-size: 10px; font-weight: 700;
  padding: 1px 5px; border-radius: 99px; min-width: 16px; text-align: center;
}
.desktop-bell { display: inline-flex; margin-left: auto; }
.notif-overlay {
  position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,.3);
  display: flex; justify-content: flex-end;
}
.notif-panel {
  width: 360px; max-width: 90vw; background: var(--c-surface); height: 100%;
  box-shadow: -2px 0 12px rgba(0,0,0,.1); display: flex; flex-direction: column;
}
.notif-header {
  display: flex; align-items: center; gap: 8px; padding: 16px;
  border-bottom: 1px solid var(--c-border);
}
.notif-header span:first-child { flex: 1; }
.notif-empty { padding: 40px 16px; text-align: center; color: var(--c-text-2); }
.notif-list { flex: 1; overflow-y: auto; }
.notif-item {
  display: flex; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--c-border);
  cursor: pointer; transition: background .15s;
}
.notif-item:hover { background: var(--c-bg); }
.notif-item.unread { background: rgba(79,70,229,.04); }
.notif-dot {
  width: 8px; height: 8px; border-radius: 50%; background: var(--c-primary);
  flex-shrink: 0; margin-top: 6px;
}
.notif-title { font-size: 14px; font-weight: 600; }
.notif-body { font-size: 13px; color: var(--c-text-2); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.notif-time { font-size: 12px; color: var(--c-text-3); margin-top: 4px; }
.loading-screen {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  background: var(--c-bg);
}
.loading-spinner {
  width: 32px; height: 32px; border: 3px solid var(--c-border);
  border-top-color: var(--c-primary); border-radius: 50%;
  animation: spin .6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 768px) {
  .mobile-header { display: flex; }
  .sidebar-overlay { display: block; }
  .desktop-bell { display: none; }
}
</style>
