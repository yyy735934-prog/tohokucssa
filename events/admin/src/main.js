import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import './style.css'

window.__vueRouter = router
createApp(App).use(router).mount('#app')
