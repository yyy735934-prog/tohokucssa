import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import './style.css'
import { BRANDING } from '../../branding.js'

window.__vueRouter = router
document.title = BRANDING.platformName
createApp(App).use(router).mount('#app')
