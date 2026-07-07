import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { BRANDING } from '../branding.js'

// 构建时把当前组织的 branding 注入静态 HTML —— 微信/爬虫抓的是静态 HTML（不执行 JS），
// 有了 og 标签，链接转发到微信才会显示带标题/描述的正规卡片，而不是裸 URL。
function brandingMeta() {
  const title = BRANDING.platformName || '活动平台'
  const desc = BRANDING.description || `${BRANDING.orgName || ''}活动报名与签到平台`
  const origin = BRANDING.origin || ''
  const image = BRANDING.ogImage
    ? (/^https?:\/\//.test(BRANDING.ogImage) ? BRANDING.ogImage : origin + BRANDING.ogImage)
    : ''
  return {
    name: 'inject-branding-meta',
    transformIndexHtml(html) {
      const tags = [
        { tag: 'meta', attrs: { name: 'description', content: desc }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:type', content: 'website' }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:site_name', content: BRANDING.orgName || title }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:title', content: title }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:description', content: desc }, injectTo: 'head' },
      ]
      if (origin) tags.push({ tag: 'meta', attrs: { property: 'og:url', content: origin }, injectTo: 'head' })
      if (image) {
        tags.push({ tag: 'meta', attrs: { property: 'og:image', content: image }, injectTo: 'head' })
        tags.push({ tag: 'meta', attrs: { property: 'og:image:width', content: '600' }, injectTo: 'head' })
        tags.push({ tag: 'meta', attrs: { property: 'og:image:height', content: '600' }, injectTo: 'head' })
        tags.push({ tag: 'link', attrs: { rel: 'icon', type: 'image/png', href: image }, injectTo: 'head' })
      }
      return { html: html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`), tags }
    },
  }
}

export default defineConfig({
  plugins: [vue(), brandingMeta()],
  root: resolve(__dirname),
  build: { outDir: resolve(__dirname, '../dist'), emptyDir: true },
  server: { proxy: { '/api': 'http://localhost:8787' } }
})
