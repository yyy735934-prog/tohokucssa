import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  root: resolve(__dirname),
  build: { outDir: resolve(__dirname, '../dist'), emptyOutDir: true },
  server: { proxy: { '/api': 'http://localhost:8787' } }
})
