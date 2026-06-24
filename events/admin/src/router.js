import { createRouter, createWebHistory } from 'vue-router'
import { auth } from './lib/auth.js'

const routes = [
  { path: '/admin/login', component: () => import('./views/Login.vue'), meta: { public: true } },
  { path: '/admin', redirect: '/admin/events' },
  { path: '/admin/events', component: () => import('./views/host/Dashboard.vue') },
  { path: '/admin/events/new', component: () => import('./views/host/EventForm.vue') },
  { path: '/admin/events/:id', component: () => import('./views/host/EventDetail.vue') },
  { path: '/admin/events/:id/edit', component: () => import('./views/host/EventForm.vue') },
  { path: '/admin/scan', component: () => import('./views/host/QrScanner.vue'), meta: { host: true } },
  { path: '/admin/overview', component: () => import('./views/reviewer/Overview.vue'), meta: { reviewer: true } },
  { path: '/admin/review', component: () => import('./views/reviewer/ReviewQueue.vue'), meta: { reviewer: true } },
  { path: '/admin/users', component: () => import('./views/super/UserManagement.vue'), meta: { reviewer: true } },
  { path: '/admin/password', component: () => import('./views/ChangePassword.vue') },
  { path: '/admin/:pathMatch(.*)*', redirect: '/admin/events' },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to) => {
  if (to.path === '/admin/login' && auth.isLoggedIn) return '/admin/events'
  if (to.meta.public) return true
  if (!auth.isLoggedIn) return '/admin/login'
  if (to.meta.host && auth.role === 'user') return '/admin/events'
  if (to.meta.reviewer && !auth.isReviewer) return '/admin/events'
  return true
})

export default router
