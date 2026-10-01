import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from './routes/auth.js'
import { events } from './routes/events.js'
import { signups } from './routes/signups.js'
import { users } from './routes/users.js'
import { participant } from './routes/participant.js'
import { notifications } from './routes/notifications.js'
import { images } from './routes/images.js'

const app = new Hono()

app.use('/api/*', cors())

app.onError((err, c) => {
  const msg = err.message || '服务器错误'
  const status = msg === '未登录' ? 401 : msg.includes('仅') ? 403 : 500
  return c.json({ ok: false, message: msg }, status)
})

app.route('/api/auth', auth)
app.route('/api/events', events)
app.route('/api/signups', signups)
app.route('/api/users', users)
app.route('/api/participant', participant)
app.route('/api/notifications', notifications)
app.route('/api/images', images)

app.all('/api/*', (c) => c.json({ ok: false, message: 'Not Found' }, 404))

// WeChat / bot OG meta for shared event links
app.get('/e/:id', async (c) => {
  const ua = c.req.header('user-agent') || ''
  const isBot = /bot|crawl|spider|MicroMessenger|WhatsApp|Telegram|facebook|twitter|slack/i.test(ua)
  if (isBot) {
    const event = await c.env.DB.prepare('SELECT title, event_date, location FROM events WHERE id = ?')
      .bind(Number(c.req.param('id'))).first()
    if (event) {
      const desc = [event.event_date, event.location].filter(Boolean).join(' · ')
      return c.html(`<!DOCTYPE html><html><head>
<meta charset="utf-8"><title>${esc(event.title)}</title>
<meta property="og:title" content="${esc(event.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
</head><body></body></html>`)
    }
  }
  return servePublicSPA(c)
})

app.get('/qr/:token', (c) => servePublicSPA(c))

// Admin SPA
app.get('/admin', (c) => serveAdminSPA(c))
app.get('/admin/*', async (c) => {
  const res = await c.env.ASSETS.fetch(c.req.raw)
  if (res.ok) return res
  return serveAdminSPA(c)
})

// Public SPA catch-all
app.get('*', async (c) => {
  const res = await c.env.ASSETS.fetch(c.req.raw)
  if (res.ok) return res
  return servePublicSPA(c)
})

async function servePublicSPA(c) {
  const url = new URL(c.req.url)
  url.pathname = '/index.html'
  return c.env.ASSETS.fetch(new Request(url))
}

async function serveAdminSPA(c) {
  const url = new URL(c.req.url)
  url.pathname = '/admin/index.html'
  return c.env.ASSETS.fetch(new Request(url))
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

import { handleScheduled } from './cron.js'

export default {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(env))
  },
}
