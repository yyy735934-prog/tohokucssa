import { Hono } from 'hono'
import { getSession, extractToken } from '../lib/session.js'
import { sendEmail, lookupCodeEmail } from '../lib/email.js'
import { getCount, increment, clientIp } from '../lib/ratelimit.js'

const participant = new Hono()

function isWithinDays(eventDate, days) {
  if (!eventDate) return false
  const now = new Date(Date.now() + 9 * 3600 * 1000) // JST
  const eventDay = new Date(eventDate.replace(/\s/, 'T') + '+09:00')
  return (eventDay - now) < days * 24 * 3600 * 1000
}

const LOOKUP_TOKEN_TTL = 30 * 24 * 3600 // 30 days
const CODE_TTL = 10 * 60
const CODE_MAX_ATTEMPTS = 5
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normEmail(v) {
  return typeof v === 'string' ? v.trim().toLowerCase() : ''
}

function sixDigitCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000
  return String(n).padStart(6, '0')
}

// Resolve whose signups the caller may see: a logged-in account's own email,
// or an email proven by a previously verified lookup token. Never trust an
// email passed by the client.
async function resolveLookupEmail(c) {
  const session = await getSession(c.env.SESSIONS, extractToken(c.req), c.env.DB)
  if (session?.email) return normEmail(session.email)
  const lookupToken = c.req.header('x-lookup-token') || ''
  if (!lookupToken) return ''
  const email = await c.env.SESSIONS.get(`lookup:${lookupToken}`)
  return email || ''
}

// POST /api/participant/lookup-code — email a one-time code to the address
participant.post('/lookup-code', async (c) => {
  const { email: raw } = await c.req.json().catch(() => ({}))
  const email = normEmail(raw)
  if (!EMAIL_RE.test(email)) return c.json({ ok: false, message: '请输入正确的邮箱' }, 400)

  const kv = c.env.SESSIONS
  const ip = clientIp(c)
  if (await getCount(kv, 'lookup-send-email', email, 60) >= 1) {
    return c.json({ ok: false, message: '发送太频繁，请 1 分钟后再试' }, 429)
  }
  if (await getCount(kv, 'lookup-send-email-h', email, 3600) >= 5 || await getCount(kv, 'lookup-send-ip', ip, 3600) >= 20) {
    return c.json({ ok: false, message: '请求次数过多，请稍后再试' }, 429)
  }
  await increment(kv, 'lookup-send-email', email, 60)
  await increment(kv, 'lookup-send-email-h', email, 3600)
  await increment(kv, 'lookup-send-ip', ip, 3600)

  // Only send mail to addresses that actually have signups, but answer the
  // same way either way so the response does not reveal who signed up.
  const has = await c.env.DB.prepare('SELECT 1 AS x FROM signups WHERE email = ? LIMIT 1').bind(email).first()
  if (has) {
    const code = sixDigitCode()
    await kv.put(`lookup-code:${email}`, JSON.stringify({ code, attempts: 0 }), { expirationTtl: CODE_TTL })
    await sendEmail(c.env, { to: email, ...lookupCodeEmail(code) })
  }
  return c.json({ ok: true, message: '如果该邮箱有报名记录，验证码已发送，请查收邮件' })
})

// POST /api/participant/lookup-verify — exchange email + code for a lookup token
participant.post('/lookup-verify', async (c) => {
  const { email: raw, code } = await c.req.json().catch(() => ({}))
  const email = normEmail(raw)
  const kv = c.env.SESSIONS
  const ip = clientIp(c)
  if (await getCount(kv, 'lookup-verify-ip', ip, 900) >= 30) {
    return c.json({ ok: false, message: '尝试次数过多，请 15 分钟后再试' }, 429)
  }
  await increment(kv, 'lookup-verify-ip', ip, 900)

  const raw2 = email ? await kv.get(`lookup-code:${email}`) : null
  if (!raw2) return c.json({ ok: false, message: '验证码无效或已过期，请重新获取' }, 400)
  const rec = JSON.parse(raw2)
  if (String(code || '').trim() !== rec.code) {
    rec.attempts += 1
    if (rec.attempts >= CODE_MAX_ATTEMPTS) {
      await kv.delete(`lookup-code:${email}`)
      return c.json({ ok: false, message: '错误次数过多，请重新获取验证码' }, 400)
    }
    await kv.put(`lookup-code:${email}`, JSON.stringify(rec), { expirationTtl: CODE_TTL })
    return c.json({ ok: false, message: '验证码错误' }, 400)
  }

  await kv.delete(`lookup-code:${email}`)
  const lookupToken = crypto.randomUUID()
  await kv.put(`lookup:${lookupToken}`, email, { expirationTtl: LOOKUP_TOKEN_TTL })
  return c.json({ ok: true, lookupToken, email })
})

// POST /api/participant/lookup-logout — revoke a lookup token
participant.post('/lookup-logout', async (c) => {
  const lookupToken = c.req.header('x-lookup-token') || ''
  if (lookupToken) await c.env.SESSIONS.delete(`lookup:${lookupToken}`)
  return c.json({ ok: true })
})

// GET /api/participant/my-events — signups of the verified caller only
participant.get('/my-events', async (c) => {
  const email = await resolveLookupEmail(c)
  if (!email) return c.json({ ok: false, needVerify: true, message: '请先验证邮箱' }, 401)

  const rows = await c.env.DB.prepare(
    `SELECT s.id as signup_id, s.name, s.email, s.phone, s.data, s.checked_in, s.checked_in_at, s.token, s.created_at as signup_at,
            e.id as event_id, e.title, e.event_date, e.location, e.status, e.custom_fields
     FROM signups s JOIN events e ON e.id = s.event_id
     WHERE s.email = ? AND COALESCE(e.event_mode, 'standard') = 'standard'
     ORDER BY e.event_date DESC`
  ).bind(email).all()

  return c.json({ ok: true, email, events: rows.results })
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
