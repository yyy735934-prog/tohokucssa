import { Hono } from 'hono'
import { getSession, extractToken } from '../lib/session.js'
import { sendEmail, signupConfirmEmail, checkinConfirmEmail } from '../lib/email.js'

const signups = new Hono()

async function requireAuth(c) {
  const session = await getSession(c.env.SESSIONS, extractToken(c.req), c.env.DB)
  if (!session) throw new Error('未登录')
  return session
}

// POST /api/signups — public signup (generates unique token for QR check-in)
signups.post('/', async (c) => {
  const body = await c.req.json()
  const { event_id, name, email, phone, extra } = body
  if (!event_id || !name || !email) return c.json({ ok: false, message: '姓名和邮箱必填' }, 400)

  const event = await c.env.DB.prepare('SELECT id, title, event_date, location, status, capacity, lock_at FROM events WHERE id = ?').bind(event_id).first()
  if (!event || event.status !== 'open') return c.json({ ok: false, message: '活动未开放报名' }, 400)

  const emailNorm = email.trim().toLowerCase()
  const token = crypto.randomUUID()
  const nameTrim = name.trim()
  const phoneTrim = (phone || '').trim()
  const dataJson = JSON.stringify(extra || {})

  const cap = event.capacity || event.lock_at
  let result
  try {
    if (cap) {
      result = await c.env.DB.prepare(
        `INSERT INTO signups (event_id, name, email, phone, data, token)
         SELECT ?, ?, ?, ?, ?, ?
         WHERE (SELECT COUNT(*) FROM signups WHERE event_id = ?) < ?`
      ).bind(event_id, nameTrim, emailNorm, phoneTrim, dataJson, token, event_id, cap).run()
      if (!result.meta.changes) return c.json({ ok: false, message: '报名已满' }, 400)
    } else {
      result = await c.env.DB.prepare(
        'INSERT INTO signups (event_id, name, email, phone, data, token) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(event_id, nameTrim, emailNorm, phoneTrim, dataJson, token).run()
    }
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return c.json({ ok: false, message: '该邮箱已报名此活动' }, 400)
    throw e
  }

  const emailContent = signupConfirmEmail(event, { name: nameTrim, email: emailNorm, phone: phoneTrim, data: extra || {} })
  c.executionCtx.waitUntil(sendEmail(c.env, { to: emailNorm, ...emailContent }))

  return c.json({ ok: true, id: result.meta.last_row_id, token })
})

// GET /api/signups — admin: list signups for an event
signups.get('/', async (c) => {
  const session = await requireAuth(c)
  const eventId = Number(c.req.query('event_id'))
  if (!eventId) return c.json({ ok: false, message: '缺少 event_id' }, 400)

  if (session.role !== 'reviewer') {
    const event = await c.env.DB.prepare('SELECT created_by FROM events WHERE id = ?').bind(eventId).first()
    if (!event || event.created_by !== session.id) return c.json({ ok: false, message: '无权查看' }, 403)
  }

  const rows = await c.env.DB.prepare('SELECT * FROM signups WHERE event_id = ? ORDER BY created_at ASC').bind(eventId).all()
  return c.json({ ok: true, signups: rows.results })
})

// GET /api/signups/export?event_id=X&format=csv|json — enhanced export
signups.get('/export', async (c) => {
  const session = await requireAuth(c)
  const eventId = Number(c.req.query('event_id'))
  const format = c.req.query('format') || 'csv'
  if (!eventId) return c.json({ ok: false, message: '缺少 event_id' }, 400)

  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(eventId).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (session.role !== 'reviewer' && event.created_by !== session.id) {
    return c.json({ ok: false, message: '无权导出' }, 403)
  }

  const rows = await c.env.DB.prepare('SELECT * FROM signups WHERE event_id = ? ORDER BY created_at ASC').bind(eventId).all()

  let customFieldDefs = []
  try { customFieldDefs = JSON.parse(event.custom_fields || '[]') } catch {}

  if (format === 'json') {
    const data = {
      event: { id: event.id, title: event.title, event_date: event.event_date, location: event.location, status: event.status, capacity: event.capacity },
      exported_at: new Date().toISOString(),
      total: rows.results.length,
      checked_in: rows.results.filter(s => s.checked_in).length,
      signups: rows.results.map(s => {
        let extra = {}
        try { extra = JSON.parse(s.data || '{}') } catch {}
        return {
          name: s.name, email: s.email, phone: s.phone || [extra['中国手机号'], extra['日本电话号']].filter(Boolean).join(' / ') || '',
          checked_in: !!s.checked_in,
          checked_in_at: s.checked_in_at ? new Date(s.checked_in_at).toISOString() : null,
          signup_at: s.created_at ? new Date(s.created_at).toISOString() : null,
          extra,
        }
      }),
    }
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        'content-type': 'application/json;charset=utf-8',
        'content-disposition': `attachment;filename=signups-${eventId}.json`
      }
    })
  }

  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const cfLabels = customFieldDefs.map(f => f.label)
  const header = ['序号', '报名时间', '姓名', '邮箱', '手机号', '签到状态', '签到时间', ...cfLabels]
  const lines = [header.map(esc).join(',')]

  for (let i = 0; i < rows.results.length; i++) {
    const s = rows.results[i]
    const signupTime = s.created_at ? new Date(s.created_at).toLocaleString('zh-CN') : ''
    const checkinTime = s.checked_in_at ? new Date(s.checked_in_at).toLocaleString('zh-CN') : ''
    let extra = {}
    try { extra = JSON.parse(s.data || '{}') } catch {}

    const cfValues = cfLabels.map(label => extra[label] ?? '')
    const phone = s.phone || [extra['中国手机号'], extra['日本电话号']].filter(Boolean).join(' / ') || ''
    const row = [i + 1, signupTime, s.name, s.email, phone, s.checked_in ? '已签到' : '未签到', checkinTime, ...cfValues]
    lines.push(row.map(esc).join(','))
  }

  const total = rows.results.length
  const checkedIn = rows.results.filter(s => s.checked_in).length
  lines.push('')
  lines.push(`活动,${esc(event.title)}`)
  lines.push(`日期,${esc(event.event_date)}`)
  lines.push(`地点,${esc(event.location || '')}`)
  lines.push(`总报名,${total}`)
  lines.push(`已签到,${checkedIn}`)
  lines.push(`签到率,${total ? Math.round(checkedIn / total * 100) : 0}%`)

  const csv = '﻿' + lines.join('\n')
  const fname = `${event.title}-报名数据.csv`
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv;charset=utf-8',
      'content-disposition': `attachment;filename*=UTF-8''${encodeURIComponent(fname)}`
    }
  })
})

// GET /api/signups/export-all — reviewer: export all events summary
signups.get('/export-all', async (c) => {
  const session = await requireAuth(c)
  if (session.role !== 'reviewer') return c.json({ ok: false, message: '仅审核员可导出' }, 403)

  const events = await c.env.DB.prepare(
    `SELECT e.id, e.title, e.event_date, e.location, e.status, e.capacity,
            COUNT(s.id) as signup_count,
            SUM(CASE WHEN s.checked_in = 1 THEN 1 ELSE 0 END) as checkin_count,
            u.email as creator_email, u.display_name as creator_name
     FROM events e
     LEFT JOIN signups s ON s.event_id = e.id
     LEFT JOIN admin_users u ON u.id = e.created_by
     GROUP BY e.id ORDER BY e.created_at DESC`
  ).all()

  const format = c.req.query('format') || 'csv'
  if (format === 'json') {
    return new Response(JSON.stringify({
      exported_at: new Date().toISOString(),
      total_events: events.results.length,
      events: events.results,
    }, null, 2), {
      headers: {
        'content-type': 'application/json;charset=utf-8',
        'content-disposition': 'attachment;filename=all-events.json'
      }
    })
  }

  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const lines = ['活动ID,活动名称,日期,地点,状态,报名上限,报名人数,签到人数,签到率,创建者']
  for (const e of events.results) {
    const rate = e.signup_count ? Math.round(e.checkin_count / e.signup_count * 100) + '%' : '—'
    const statusMap = { draft: '草稿', pending: '待审核', open: '报名中', active: '进行中', closed: '已结束' }
    lines.push([
      e.id, e.title, e.event_date, e.location || '', statusMap[e.status] || e.status,
      e.capacity || '不限', e.signup_count, e.checkin_count, rate,
      e.creator_name || e.creator_email || ''
    ].map(esc).join(','))
  }
  const csv = '﻿' + lines.join('\n')
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv;charset=utf-8',
      'content-disposition': `attachment;filename*=UTF-8''${encodeURIComponent('全部活动汇总.csv')}`
    }
  })
})

// GET /api/signups/by-token/:token — public: get signup info by QR token
signups.get('/by-token/:token', async (c) => {
  const token = c.req.param('token')
  const signup = await c.env.DB.prepare(
    `SELECT s.id, s.name, s.email, s.checked_in, s.checked_in_at, s.event_id,
            e.title as event_title, e.event_date, e.location, e.status as event_status
     FROM signups s JOIN events e ON e.id = s.event_id
     WHERE s.token = ?`
  ).bind(token).first()
  if (!signup) return c.json({ ok: false, message: '无效的签到码' }, 404)
  return c.json({ ok: true, signup })
})

// POST /api/signups/checkin-by-token — QR code check-in (no login needed)
signups.post('/checkin-by-token', async (c) => {
  const { token } = await c.req.json()
  if (!token) return c.json({ ok: false, message: '缺少签到码' }, 400)

  const signup = await c.env.DB.prepare(
    'SELECT s.id, s.name, s.email, s.checked_in, s.event_id, e.status, e.title, e.event_date, e.location FROM signups s JOIN events e ON e.id = s.event_id WHERE s.token = ?'
  ).bind(token).first()
  if (!signup) return c.json({ ok: false, message: '无效的签到码' }, 404)
  if (!['open', 'active'].includes(signup.status)) return c.json({ ok: false, message: '活动未在进行中' }, 400)
  if (signup.checked_in) return c.json({ ok: true, alreadyCheckedIn: true, name: signup.name })

  await c.env.DB.prepare('UPDATE signups SET checked_in = 1, checked_in_at = ? WHERE id = ?')
    .bind(Date.now(), signup.id).run()

  const event = { title: signup.title, event_date: signup.event_date, location: signup.location }
  const content = checkinConfirmEmail(event, { name: signup.name })
  c.executionCtx.waitUntil(sendEmail(c.env, { to: signup.email, ...content }))

  return c.json({ ok: true, name: signup.name })
})

// POST /api/signups/checkin — public check-in by email (fallback)
signups.post('/checkin', async (c) => {
  const { event_id, email } = await c.req.json()
  if (!event_id || !email) return c.json({ ok: false, message: '缺少活动ID或邮箱' }, 400)

  const event = await c.env.DB.prepare('SELECT id, status FROM events WHERE id = ?').bind(event_id).first()
  if (!event || !['open', 'active'].includes(event.status)) {
    return c.json({ ok: false, message: '活动未开始' }, 400)
  }

  const signup = await c.env.DB.prepare('SELECT id, name, checked_in FROM signups WHERE event_id = ? AND email = ?')
    .bind(event_id, email.trim().toLowerCase()).first()
  if (!signup) return c.json({ ok: false, message: '未找到该邮箱的报名记录' }, 404)
  if (signup.checked_in) return c.json({ ok: true, alreadyCheckedIn: true, name: signup.name })

  await c.env.DB.prepare('UPDATE signups SET checked_in = 1, checked_in_at = ? WHERE id = ?')
    .bind(Date.now(), signup.id).run()
  return c.json({ ok: true, name: signup.name })
})

// POST /api/signups/:id/checkin — admin check-in by signup ID
signups.post('/:id/checkin', async (c) => {
  const session = await requireAuth(c)
  const id = Number(c.req.param('id'))
  const signup = await c.env.DB.prepare('SELECT * FROM signups WHERE id = ?').bind(id).first()
  if (!signup) return c.json({ ok: false, message: '报名记录不存在' }, 404)

  if (session.role !== 'reviewer') {
    const event = await c.env.DB.prepare('SELECT created_by FROM events WHERE id = ?').bind(signup.event_id).first()
    if (!event || event.created_by !== session.id) return c.json({ ok: false, message: '无权操作' }, 403)
  }

  await c.env.DB.prepare('UPDATE signups SET checked_in = 1, checked_in_at = ? WHERE id = ?')
    .bind(Date.now(), id).run()
  return c.json({ ok: true })
})

// POST /api/signups/batch-checkin — admin batch check-in
signups.post('/batch-checkin', async (c) => {
  const session = await requireAuth(c)
  const { event_id } = await c.req.json()
  if (!event_id) return c.json({ ok: false, message: '缺少 event_id' }, 400)

  if (session.role !== 'reviewer') {
    const event = await c.env.DB.prepare('SELECT created_by FROM events WHERE id = ?').bind(event_id).first()
    if (!event || event.created_by !== session.id) return c.json({ ok: false, message: '无权操作' }, 403)
  }

  const result = await c.env.DB.prepare(
    'UPDATE signups SET checked_in = 1, checked_in_at = ? WHERE event_id = ? AND checked_in = 0'
  ).bind(Date.now(), event_id).run()
  return c.json({ ok: true, count: result.meta.changes })
})

// POST /api/signups/manual — admin manually adds a participant
signups.post('/manual', async (c) => {
  const session = await requireAuth(c)
  const body = await c.req.json()
  const { event_id, name, email, phone, extra } = body
  if (!event_id || !name || !email) return c.json({ ok: false, message: '姓名和邮箱必填' }, 400)

  const event = await c.env.DB.prepare('SELECT id, created_by, capacity, lock_at FROM events WHERE id = ?').bind(event_id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (session.role !== 'reviewer' && event.created_by !== session.id) {
    return c.json({ ok: false, message: '无权操作' }, 403)
  }

  const emailNorm = email.trim().toLowerCase()
  const token = crypto.randomUUID()
  const nameTrim = name.trim()
  const phoneTrim = (phone || '').trim()
  const dataJson = JSON.stringify(extra || {})

  const cap = event.capacity || event.lock_at
  let result
  try {
    if (cap) {
      result = await c.env.DB.prepare(
        `INSERT INTO signups (event_id, name, email, phone, data, token)
         SELECT ?, ?, ?, ?, ?, ?
         WHERE (SELECT COUNT(*) FROM signups WHERE event_id = ?) < ?`
      ).bind(event_id, nameTrim, emailNorm, phoneTrim, dataJson, token, event_id, cap).run()
      if (!result.meta.changes) return c.json({ ok: false, message: '报名已满，无法添加' }, 400)
    } else {
      result = await c.env.DB.prepare(
        'INSERT INTO signups (event_id, name, email, phone, data, token) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(event_id, nameTrim, emailNorm, phoneTrim, dataJson, token).run()
    }
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return c.json({ ok: false, message: '该邮箱已报名此活动' }, 400)
    throw e
  }

  const fullEvent = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(event_id).first()
  if (fullEvent) {
    const emailContent = signupConfirmEmail(fullEvent, { name: nameTrim, email: emailNorm, phone: phoneTrim, data: extra || {} })
    c.executionCtx.waitUntil(sendEmail(c.env, { to: emailNorm, ...emailContent }))
  }

  return c.json({ ok: true, id: result.meta.last_row_id, token })
})

// DELETE /api/signups/:id
signups.delete('/:id', async (c) => {
  const session = await requireAuth(c)
  const id = Number(c.req.param('id'))
  const signup = await c.env.DB.prepare('SELECT event_id FROM signups WHERE id = ?').bind(id).first()
  if (!signup) return c.json({ ok: false, message: '报名记录不存在' }, 404)

  if (session.role !== 'reviewer') {
    const event = await c.env.DB.prepare('SELECT created_by FROM events WHERE id = ?').bind(signup.event_id).first()
    if (!event || event.created_by !== session.id) return c.json({ ok: false, message: '无权删除' }, 403)
  }

  await c.env.DB.prepare('DELETE FROM signups WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

export { signups }
