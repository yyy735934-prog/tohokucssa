import { createRouter, createWebHistory } from 'vue-router'
import { getToken, getRole } from './services/api.js'

const routes = [
  { path: '/login', component: () => import('./views/LoginView.vue') },
  { path: '/', component: () => import('./views/host/MyEvents.vue'), meta: { auth: true } },
  { path: '/events/new', component: () => import('./views/host/EventForm.vue'), meta: { auth: true } },
  { path: '/events/:id/edit', component: () => import('./views/host/EventForm.vue'), meta: { auth: true } },
  { path: '/events/:id', component: () => import('./views/host/EventDetail.vue'), meta: { auth: true } },
  { path: '/review', component: () => import('./views/reviewer/ReviewQueue.vue'), meta: { auth: true, role: 'reviewer' } },
  { path: '/review/:id', component: () => import('./views/reviewer/ReviewDetail.vue'), meta: { auth: true, role: 'reviewer' } },
  { path: '/users', component: () => import('./views/reviewer/UserManagement.vue'), meta: { auth: true, role: 'reviewer' } },
  { path: '/password', component: () => import('./views/ChangePassword.vue'), meta: { auth: true } },
  { path: '/square', component: () => import('./views/public/EventSquare.vue') },
  { path: '/signup/:id', component: () => import('./views/public/SignupView.vue') },
  { path: '/checkin/:id', component: () => import('./views/public/CheckinView.vue') },
  { path: '/:pathMatch(.*)*', component: () => import('./views/NotFound.vue') },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to) => {
  if (to.meta.auth && !getToken()) return '/login'
  if (to.meta.role && getRole() !== to.meta.role) return '/'
})

export default router
