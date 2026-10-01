import { Hono } from 'hono'
import { getSession, extractToken } from '../lib/session.js'
import { canOperateEvent } from '../lib/permissions.js'

const images = new Hono()

async function requireAuth(c) {
  const session = await getSession(c.env.SESSIONS, extractToken(c.req), c.env.DB)
  if (!session) throw new Error('未登录')
  return session
}

async function imageFile(c) {
  const formData = await c.req.formData()
  const file = formData.get('file')
  if (!file || !(file instanceof File)) return { error: '请选择图片' }
  if (file.size > 5 * 1024 * 1024) return { error: '图片不能超过 5MB' }
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type)) return { error: '仅支持 JPG/PNG/WebP/GIF 格式' }
  return { file }
}

images.post('/template-upload/:templateId', async (c) => {
  const session = await requireAuth(c)
  if (session.role !== 'reviewer') return c.json({ ok: false, message: '仅管理员可操作' }, 403)
  const templateId = Number(c.req.param('templateId'))
  const template = await c.env.DB.prepare('SELECT id, image_key FROM gathering_templates WHERE id = ?').bind(templateId).first()
  if (!template) return c.json({ ok: false, message: '模板不存在' }, 404)
  const parsed = await imageFile(c)
  if (parsed.error) return c.json({ ok: false, message: parsed.error }, 400)
  const ext = parsed.file.name.split('.').pop() || 'jpg'
  const key = `gathering-templates/${templateId}/${Date.now()}.${ext}`
  await c.env.IMAGES.put(key, parsed.file.stream(), { httpMetadata: { contentType: parsed.file.type } })
  await c.env.DB.prepare('UPDATE gathering_templates SET image_key = ?, updated_at = ? WHERE id = ?').bind(key, Date.now(), templateId).run()
  if (template.image_key?.startsWith(`gathering-templates/${templateId}/`)) await c.env.IMAGES.delete(template.image_key)
  return c.json({ ok: true, key })
})

images.delete('/template/:templateId', async (c) => {
  const session = await requireAuth(c)
  if (session.role !== 'reviewer') return c.json({ ok: false, message: '仅管理员可操作' }, 403)
  const templateId = Number(c.req.param('templateId'))
  const template = await c.env.DB.prepare('SELECT image_key FROM gathering_templates WHERE id = ?').bind(templateId).first()
  if (!template) return c.json({ ok: false, message: '模板不存在' }, 404)
  await c.env.DB.prepare('UPDATE gathering_templates SET image_key = NULL, updated_at = ? WHERE id = ?').bind(Date.now(), templateId).run()
  if (template.image_key?.startsWith(`gathering-templates/${templateId}/`)) await c.env.IMAGES.delete(template.image_key)
  return c.json({ ok: true })
})

images.get('/template-serve/:templateId', async (c) => {
  const templateId = Number(c.req.param('templateId'))
  const template = await c.env.DB.prepare('SELECT image_key FROM gathering_templates WHERE id = ?').bind(templateId).first()
  if (!template?.image_key) return c.json({ ok: false, message: '无图片' }, 404)
  const obj = await c.env.IMAGES.get(template.image_key)
  if (!obj) return c.json({ ok: false, message: '图片不存在' }, 404)
  return new Response(obj.body, { headers: { 'content-type': obj.httpMetadata?.contentType || 'image/jpeg', 'cache-control': 'public, max-age=86400' } })
})

images.post('/upload/:eventId', async (c) => {
  const session = await requireAuth(c)
  const eventId = Number(c.req.param('eventId'))
  if (!eventId) return c.json({ ok: false, message: '无效的活动ID' }, 400)

  const event = await c.env.DB.prepare('SELECT id, created_by, event_mode, image_key FROM events WHERE id = ?').bind(eventId).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (!await canOperateEvent(c.env.DB, event, session)) {
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
  if (event.image_key?.startsWith(`events/${eventId}/`) && event.image_key !== key) {
    try { await c.env.IMAGES.delete(event.image_key) } catch {}
  }

  return c.json({ ok: true, key })
})

images.delete('/:eventId', async (c) => {
  const session = await requireAuth(c)
  const eventId = Number(c.req.param('eventId'))
  if (!eventId) return c.json({ ok: false, message: '无效的活动ID' }, 400)

  const event = await c.env.DB.prepare('SELECT id, created_by, event_mode, image_key FROM events WHERE id = ?').bind(eventId).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (!await canOperateEvent(c.env.DB, event, session)) {
    return c.json({ ok: false, message: '无权操作' }, 403)
  }

  if (event.image_key) {
    // A generated gathering may still reference its template cover. Never delete
    // that shared object when a host removes or replaces this week's cover.
    if (event.image_key.startsWith(`events/${eventId}/`)) await c.env.IMAGES.delete(event.image_key)
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

// POST /api/images/announce-upload/:eventId — 通知附图上传（不占用活动主图）
images.post('/announce-upload/:eventId', async (c) => {
  const session = await requireAuth(c)
  const eventId = Number(c.req.param('eventId'))
  if (!eventId) return c.json({ ok: false, message: '无效的活动ID' }, 400)

  const event = await c.env.DB.prepare('SELECT id, created_by, event_mode FROM events WHERE id = ?').bind(eventId).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (!await canOperateEvent(c.env.DB, event, session)) {
    return c.json({ ok: false, message: '无权操作' }, 403)
  }

  const formData = await c.req.formData()
  const file = formData.get('file')
  if (!file || !(file instanceof File)) return c.json({ ok: false, message: '请选择图片' }, 400)
  if (file.size > 5 * 1024 * 1024) return c.json({ ok: false, message: '图片不能超过 5MB' }, 400)
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type)) return c.json({ ok: false, message: '仅支持 JPG/PNG/WebP/GIF 格式' }, 400)

  const ext = file.name.split('.').pop() || 'jpg'
  const key = `announce/${eventId}/${Date.now()}.${ext}`
  await c.env.IMAGES.put(key, file.stream(), { httpMetadata: { contentType: file.type } })
  return c.json({ ok: true, key })
})

// GET /api/images/announce/:eventId/:file — 公开读取通知附图（邮件内嵌）
images.get('/announce/:eventId/:file', async (c) => {
  const key = `announce/${c.req.param('eventId')}/${c.req.param('file')}`
  const obj = await c.env.IMAGES.get(key)
  if (!obj) return c.json({ ok: false, message: '图片不存在' }, 404)
  const headers = new Headers()
  headers.set('content-type', obj.httpMetadata?.contentType || 'image/jpeg')
  headers.set('cache-control', 'public, max-age=604800')
  return new Response(obj.body, { headers })
})

export { images }
