import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', component: () => import('./views/Home.vue') },
  { path: '/item/:id', component: () => import('./views/ItemDetail.vue') },
  { path: '/book/:id', component: () => import('./views/BookingForm.vue') },
  { path: '/my', component: () => import('./views/MyBookings.vue') },
  { path: '/admin', component: () => import('./views/Admin.vue') },
]

export default createRouter({ history: createWebHistory(), routes })
