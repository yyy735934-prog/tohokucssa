import { Hono } from 'hono'
import { getSession, extractToken } from '../lib/session.js'

const images = new Hono()

async function requireAuth(c) {
  const session = await getSession(c.env.SESSIONS, extractToken(c.req), c.env.DB)
  if (!session) throw new Error('未登录')
  return session
}

images.post('/upload/:eventId', async (c) => {
  const session = await requireAuth(c)
  const eventId = Number(c.req.param('eventId'))
  if (!eventId) return c.json({ ok: false, message: '无效的活动ID' }, 400)

  const event = await c.env.DB.prepare('SELECT id, created_by FROM events WHERE id = ?').bind(eventId).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (event.created_by !== session.id && session.role !== 'reviewer') {
    return c.json({ ok: false, message: '无权操作' }, 403)
  }

  const formData = await c.req.formData()
  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return c.json({ ok: false, message: '请选择图片' }, 400)
  }

  if (file.size > 5 * 1024 * 1024) {
    return c.json({ ok: false, message: '图片不能超过 5MB' }, 400)
  }

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type)) {
    return c.json({ ok: false, message: '仅支持 JPG/PNG/WebP/GIF 格式' }, 400)
  }

  const ext = file.name.split('.').pop() || 'jpg'
  const key = `events/${eventId}/${Date.now()}.${ext}`

  try {
    await c.env.IMAGES.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
    })
  } catch (e) {
    return c.json({ ok: false, message: '图片上传失败，请重试' }, 500)
  }

  await c.env.DB.prepare('UPDATE events SET image_key = ? WHERE id = ?').bind(key, eventId).run()

  return c.json({ ok: true, key })
})

images.delete('/:eventId', async (c) => {
  const session = await requireAuth(c)
  const eventId = Number(c.req.param('eventId'))
  if (!eventId) return c.json({ ok: false, message: '无效的活动ID' }, 400)

  const event = await c.env.DB.prepare('SELECT id, created_by, image_key FROM events WHERE id = ?').bind(eventId).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (event.created_by !== session.id && session.role !== 'reviewer') {
    return c.json({ ok: false, message: '无权操作' }, 403)
  }

  if (event.image_key) {
    await c.env.IMAGES.delete(event.image_key)
    await c.env.DB.prepare('UPDATE events SET image_key = NULL WHERE id = ?').bind(eventId).run()
  }

  return c.json({ ok: true })
})

images.get('/serve/:eventId', async (c) => {
  const eventId = Number(c.req.param('eventId'))
  if (!eventId) return c.json({ ok: false, message: '无效的活动ID' }, 400)
  const event = await c.env.DB.prepare('SELECT image_key FROM events WHERE id = ?').bind(eventId).first()
  if (!event?.image_key) return c.json({ ok: false, message: '无图片' }, 404)

  const obj = await c.env.IMAGES.get(event.image_key)
  if (!obj) return c.json({ ok: false, message: '图片不存在' }, 404)

  const headers = new Headers()
  headers.set('content-type', obj.httpMetadata?.contentType || 'image/jpeg')
  headers.set('cache-control', 'public, max-age=86400')

  return new Response(obj.body, { headers })
})

export { images }
