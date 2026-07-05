import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', component: () => import('./views/Home.vue') },
  { path: '/e/:id', component: () => import('./views/EventDetail.vue') },
  { path: '/signup-ok/:id', component: () => import('./views/SignupSuccess.vue') },
  { path: '/qr/:token', component: () => import('./views/QrCheckin.vue') },
  { path: '/checkin/:id', component: () => import('./views/Checkin.vue') },
  { path: '/my', component: () => import('./views/MyEvents.vue') },
  { path: '/apply', component: () => import('./views/ApplyEvent.vue') },
  { path: '/privacy', component: () => import('./views/Privacy.vue') },
  { path: '/register', component: () => import('./views/RegisterInvite.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export default createRouter({ history: createWebHistory(), routes })
