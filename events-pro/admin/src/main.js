import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import { auth } from './lib/auth.js'
import { api } from './api.js'
import './style.css'
import { BRANDING } from '../../branding.js'

window.__vueRouter = router
document.title = BRANDING.platformName
createApp(App).use(router).mount('#app')

if (auth.isLoggedIn) {
  api.me().catch(() => {
    auth.clear()
    router.push('/admin/login')
  })
}
