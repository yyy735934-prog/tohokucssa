import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', component: () => import('./views/ServicesHub.vue') },
  { path: '/bus', component: () => import('./views/CampusBus.vue') },
  { path: '/local', component: () => import('./views/LocalGuide.vue') },
  { path: '/emergency', component: () => import('./views/Emergency.vue') },
  { path: '/market', component: () => import('./views/Market.vue') },
  { path: '/rental', component: () => import('./views/Rental.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export default createRouter({ history: createWebHistory(), routes })
