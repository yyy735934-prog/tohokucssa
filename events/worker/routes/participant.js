import { Hono } from 'hono'

const participant = new Hono()

function isWithinDays(eventDate, days) {
  if (!eventDate) return false
  const now = new Date(Date.now() + 9 * 3600 * 1000) // JST
  const eventDay = new Date(eventDate.replace(/\s/, 'T') + '+09:00')
  return (eventDay - now) < days * 24 * 3600 * 1000
}

// GET /api/participant/my-events?email=xxx — participant looks up their signups
participant.get('/my-events', async (c) => {
  const email = (c.req.query('email') || '').trim().toLowerCase()
  if (!email) return c.json({ ok: false, message: '请输入邮箱' }, 400)

  const rows = await c.env.DB.prepare(
    `SELECT s.id as signup_id, s.name, s.email, s.phone, s.data, s.checked_in, s.checked_in_at, s.token, s.created_at as signup_at,
            e.id as event_id, e.title, e.event_date, e.location, e.status, e.custom_fields
     FROM signups s JOIN events e ON e.id = s.event_id
     WHERE s.email = ?
     ORDER BY e.event_date DESC`
  ).bind(email).all()

  return c.json({ ok: true, events: rows.results })
})

// POST /api/participant/cancel — cancel signup by token
participant.post('/cancel', async (c) => {
  const { token } = await c.req.json()
  if (!token) return c.json({ ok: false, message: '缺少token' }, 400)

  const signup = await c.env.DB.prepare(
    'SELECT s.id, s.checked_in, e.status, e.event_date FROM signups s JOIN events e ON e.id = s.event_id WHERE s.token = ?'
  ).bind(token).first()
  if (!signup) return c.json({ ok: false, message: '报名记录不存在' }, 404)
  if (signup.checked_in) return c.json({ ok: false, message: '已签到，无法取消' }, 400)
  if (signup.status === 'closed') return c.json({ ok: false, message: '活动已结束，无法取消' }, 400)
  if (isWithinDays(signup.event_date, 3)) return c.json({ ok: false, message: '活动开始前3天内无法取消报名' }, 400)

  await c.env.DB.prepare('DELETE FROM signups WHERE id = ?').bind(signup.id).run()
  return c.json({ ok: true })
})

// POST /api/participant/update — update signup info by token
participant.post('/update', async (c) => {
  const { token, name, phone, extra } = await c.req.json()
  if (!token) return c.json({ ok: false, message: '缺少token' }, 400)
  if (!name || !name.trim()) return c.json({ ok: false, message: '姓名不能为空' }, 400)

  const signup = await c.env.DB.prepare(
    'SELECT s.id, s.checked_in, e.status, e.event_date FROM signups s JOIN events e ON e.id = s.event_id WHERE s.token = ?'
  ).bind(token).first()
  if (!signup) return c.json({ ok: false, message: '报名记录不存在' }, 404)
  if (signup.checked_in) return c.json({ ok: false, message: '已签到，无法修改' }, 400)
  if (signup.status === 'closed') return c.json({ ok: false, message: '活动已结束，无法修改' }, 400)
  if (isWithinDays(signup.event_date, 3)) return c.json({ ok: false, message: '活动开始前3天内无法修改报名信息' }, 400)

  await c.env.DB.prepare(
    'UPDATE signups SET name = ?, phone = ?, data = ? WHERE id = ?'
  ).bind(name.trim(), (phone || '').trim(), JSON.stringify(extra || {}), signup.id).run()
  return c.json({ ok: true })
})

export { participant }
