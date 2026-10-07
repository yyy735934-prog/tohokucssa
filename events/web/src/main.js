import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import './style.css'

createApp(App).use(router).mount('#app')
// 应用已渲染，移除 index.html 里的加载超时提示
document.getElementById('boot-hint')?.remove()
