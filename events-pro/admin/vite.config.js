import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  root: resolve(__dirname),
  base: '/admin/',
  build: { outDir: resolve(__dirname, '../dist/admin'), emptyDir: true },
  server: { proxy: { '/api': 'http://localhost:8787' } }
})
