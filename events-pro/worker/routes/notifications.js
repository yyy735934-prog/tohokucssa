import { Hono } from 'hono'
import { getSession, extractToken } from '../lib/session.js'

const notifications = new Hono()

async function requireAuth(c) {
  const session = await getSession(c.env.SESSIONS, extractToken(c.req), c.env.DB)
  if (!session) throw new Error('未登录')
  return session
}

notifications.get('/', async (c) => {
  const session = await requireAuth(c)
  const rows = await c.env.DB.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).bind(session.id).all()
  return c.json({ ok: true, notifications: rows.results })
})

notifications.get('/unread-count', async (c) => {
  const session = await requireAuth(c)
  const row = await c.env.DB.prepare(
    'SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0'
  ).bind(session.id).first()
  return c.json({ ok: true, count: row.c })
})

notifications.post('/read-all', async (c) => {
  const session = await requireAuth(c)
  await c.env.DB.prepare(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0'
  ).bind(session.id).run()
  return c.json({ ok: true })
})

notifications.post('/:id/read', async (c) => {
  const session = await requireAuth(c)
  const id = Number(c.req.param('id'))
  await c.env.DB.prepare(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?'
  ).bind(id, session.id).run()
  return c.json({ ok: true })
})

export { notifications }

export async function createNotification(db, userId, type, title, body, eventId) {
  await db.prepare(
    'INSERT INTO notifications (user_id, type, title, body, event_id) VALUES (?, ?, ?, ?, ?)'
  ).bind(userId, type, title, body || '', eventId || null).run()
}

export async function notifyReviewers(db, type, title, body, eventId) {
  const reviewers = await db.prepare("SELECT id FROM admin_users WHERE role = 'reviewer'").all()
  for (const r of reviewers.results) {
    await createNotification(db, r.id, type, title, body, eventId)
  }
}
