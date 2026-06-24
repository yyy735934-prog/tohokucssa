import { Hono } from 'hono'
import { getSession, extractToken } from '../lib/session.js'
import { sendEmail, eventApprovedEmail, eventRejectedEmail, eventApprovedInviteEmail, eventChangedEmail, eventReminderEmail, eventSubmittedEmail } from '../lib/email.js'
import { createNotification, notifyReviewers } from './notifications.js'

const events = new Hono()

async function requireAuth(c) {
  const session = await getSession(c.env.SESSIONS, extractToken(c.req), c.env.DB)
  if (!session) throw new Error('未登录')
  return session
}

// POST /api/events/apply — public event submission (no auth)
events.post('/propose', async (c) => {
  const body = await c.req.json()
  const { title, event_date, location, content, notes, capacity, custom_fields,
          submitter_name, submitter_email, submitter_phone, submitter_note } = body

  if (!title || !event_date) return c.json({ ok: false, message: '活动名称和日期必填' }, 400)
  if (!submitter_name || !submitter_email) return c.json({ ok: false, message: '申请人姓名和邮箱必填' }, 400)

  const cf = custom_fields ? JSON.stringify(custom_fields) : '[]'
  const emailNorm = submitter_email.trim().toLowerCase()

  const result = await c.env.DB.prepare(
    `INSERT INTO events (title, event_date, location, content, notes, capacity, custom_fields,
     status, submitter_name, submitter_email, submitter_phone, submitter_note, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`
  ).bind(
    title.trim(), event_date.trim(), (location || '').trim(), (content || '').trim(),
    (notes || '').trim(), capacity || null, cf,
    submitter_name.trim(), emailNorm, (submitter_phone || '').trim(),
    (submitter_note || '').trim(), Date.now()
  ).run()

  const newId = result.meta.last_row_id
  await notifyReviewers(c.env.DB, 'submit', '新活动申请', `「${title.trim()}」由 ${submitter_name.trim()} 公开提交`, newId)

  const eventForEmail = { title: title.trim(), event_date: event_date.trim(), location: (location || '').trim() }
  const reviewers = await c.env.DB.prepare("SELECT email FROM admin_users WHERE role = 'reviewer'").all()
  for (const r of reviewers.results) {
    const content = eventSubmittedEmail(eventForEmail, submitter_name.trim())
    c.executionCtx.waitUntil(sendEmail(c.env, { to: r.email, ...content }))
  }

  return c.json({ ok: true, id: newId })
})

// GET /api/events/dashboard-stats — reviewer overview
events.get('/dashboard-stats', async (c) => {
  const session = await requireAuth(c)
  if (session.role !== 'reviewer') return c.json({ ok: false, message: '仅审核员可查看' }, 403)

  const [pending, open, active, closed, totalSignups, totalCheckins] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) as c FROM events WHERE status = 'pending'").first(),
    c.env.DB.prepare("SELECT COUNT(*) as c FROM events WHERE status = 'open'").first(),
    c.env.DB.prepare("SELECT COUNT(*) as c FROM events WHERE status = 'active'").first(),
    c.env.DB.prepare("SELECT COUNT(*) as c FROM events WHERE status = 'closed'").first(),
    c.env.DB.prepare("SELECT COUNT(*) as c FROM signups").first(),
    c.env.DB.prepare("SELECT COUNT(*) as c FROM signups WHERE checked_in = 1").first(),
  ])

  return c.json({
    ok: true,
    stats: {
      pending: pending.c, open: open.c, active: active.c, closed: closed.c,
      totalSignups: totalSignups.c, totalCheckins: totalCheckins.c
    }
  })
})

// GET /api/events — public or admin listing
events.get('/', async (c) => {
  const scope = c.req.query('scope')

  if (scope === 'public') {
    const rows = await c.env.DB.prepare(
      `SELECT e.id, e.title, e.event_date, e.location, e.content, e.capacity, e.status, e.created_at, e.image_key, e.pinned,
              COUNT(s.id) as signupCount
       FROM events e LEFT JOIN signups s ON s.event_id = e.id
       WHERE e.status IN ('open', 'active')
       GROUP BY e.id ORDER BY e.pinned DESC, e.created_at DESC`
    ).all()
    return c.json({ ok: true, events: rows.results })
  }

  const session = await requireAuth(c)
  let rows
  if (session.role === 'reviewer') {
    rows = await c.env.DB.prepare(
      `SELECT e.*, COUNT(s.id) as signupCount, u.email as creator_email, u.display_name as creator_name
       FROM events e LEFT JOIN signups s ON s.event_id = e.id
       LEFT JOIN admin_users u ON u.id = e.created_by
       GROUP BY e.id ORDER BY e.created_at DESC`
    ).all()
  } else {
    rows = await c.env.DB.prepare(
      `SELECT e.*, COUNT(s.id) as signupCount
       FROM events e LEFT JOIN signups s ON s.event_id = e.id
       WHERE e.created_by = ?
       GROUP BY e.id ORDER BY e.created_at DESC`
    ).bind(session.id).all()
  }
  return c.json({ ok: true, events: rows.results })
})

// GET /api/events/:id
events.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)

  const count = await c.env.DB.prepare('SELECT COUNT(*) as c FROM signups WHERE event_id = ?').bind(id).first()

  const token = extractToken(c.req)
  const session = token ? await getSession(c.env.SESSIONS, token, c.env.DB) : null
  const isAdmin = session && (session.role === 'reviewer' || session.id === event.created_by)

  if (!isAdmin) {
    const { id, title, event_date, location, content, notes, capacity, status, custom_fields, activity_type, image_key } = event
    return c.json({ ok: true, event: { id, title, event_date, location, content, notes, capacity, status, custom_fields, activity_type, image_key, signupCount: count.c } })
  }

  const creator = await c.env.DB.prepare('SELECT email, display_name FROM admin_users WHERE id = ?').bind(event.created_by).first()
  return c.json({ ok: true, event: { ...event, signupCount: count.c, creator_email: creator?.email, creator_name: creator?.display_name } })
})

// POST /api/events — create event
events.post('/', async (c) => {
  const session = await requireAuth(c)
  const body = await c.req.json()
  const { title, event_date, location, content, notes, capacity, custom_fields, activity_type } = body
  if (!title || !event_date) return c.json({ ok: false, message: '标题和时间必填' }, 400)

  const cf = custom_fields ? JSON.stringify(custom_fields) : '[]'

  if (session.role === 'user') {
    await c.env.DB.prepare("UPDATE admin_users SET role = 'host' WHERE id = ? AND role = 'user'").bind(session.id).run()
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO events (title, event_date, location, content, notes, capacity, custom_fields, activity_type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(title.trim(), event_date.trim(), (location || '').trim(), (content || '').trim(), (notes || '').trim(), capacity || null, cf, (activity_type || '').trim() || null, session.id).run()

  return c.json({ ok: true, id: result.meta.last_row_id, role_upgraded: session.role === 'user' })
})

// PATCH /api/events/:id — edit event
events.patch('/:id', async (c) => {
  const session = await requireAuth(c)
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (event.created_by !== session.id && session.role !== 'reviewer') {
    return c.json({ ok: false, message: '无权编辑' }, 403)
  }

  const body = await c.req.json()
  const fields = ['title', 'event_date', 'location', 'content', 'notes', 'capacity', 'custom_fields', 'activity_type']
  const sets = []
  const vals = []
  for (const f of fields) {
    if (body[f] !== undefined) {
      sets.push(`${f} = ?`)
      if (f === 'capacity') vals.push(body[f] || null)
      else if (f === 'custom_fields') vals.push(JSON.stringify(body[f]))
      else vals.push(String(body[f] || '').trim())
    }
  }
  if (!sets.length) return c.json({ ok: false, message: '没有要修改的字段' }, 400)

  vals.push(id)
  await c.env.DB.prepare(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run()
  return c.json({ ok: true })
})

// POST /api/events/:id/submit — draft → pending (reviewer auto-approves own events → open)
events.post('/:id/submit', async (c) => {
  const session = await requireAuth(c)
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (event.created_by !== session.id) return c.json({ ok: false, message: '只能提交自己的活动' }, 403)
  if (event.status !== 'draft') return c.json({ ok: false, message: '只有草稿可以提交审核' }, 400)

  if (session.role === 'reviewer') {
    await c.env.DB.prepare('UPDATE events SET status = ?, submitted_at = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?')
      .bind('open', Date.now(), session.id, Date.now(), id).run()
    return c.json({ ok: true, autoApproved: true })
  }

  await c.env.DB.prepare('UPDATE events SET status = ?, submitted_at = ? WHERE id = ?')
    .bind('pending', Date.now(), id).run()

  await notifyReviewers(c.env.DB, 'submit', `新活动待审核`, `「${event.title}」已提交审核`, id)

  const reviewers = await c.env.DB.prepare("SELECT email FROM admin_users WHERE role = 'reviewer'").all()
  const submitterName = session.display_name || session.email
  for (const r of reviewers.results) {
    const content = eventSubmittedEmail(event, submitterName)
    c.executionCtx.waitUntil(sendEmail(c.env, { to: r.email, ...content }))
  }

  return c.json({ ok: true })
})

// POST /api/events/:id/approve — pending → open
events.post('/:id/approve', async (c) => {
  const session = await requireAuth(c)
  if (session.role !== 'reviewer') return c.json({ ok: false, message: '仅负责人可审核' }, 403)

  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (event.status !== 'pending') return c.json({ ok: false, message: '只能审核待审状态的活动' }, 400)

  await c.env.DB.prepare('UPDATE events SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?')
    .bind('open', session.id, Date.now(), id).run()

  if (event.created_by) {
    const host = await c.env.DB.prepare('SELECT email, display_name FROM admin_users WHERE id = ?').bind(event.created_by).first()
    if (host) {
      const emailContent = eventApprovedEmail(event, host)
      c.executionCtx.waitUntil(sendEmail(c.env, { to: host.email, ...emailContent }))
    }
  } else if (event.submitter_email) {
    const inviteToken = crypto.randomUUID()
    await c.env.SESSIONS.put(`invite:${inviteToken}`, JSON.stringify({
      email: event.submitter_email, event_id: id, name: event.submitter_name
    }), { expirationTtl: 7 * 24 * 3600 })

    const origin = new URL(c.req.url).origin
    const emailContent = eventApprovedInviteEmail(event, inviteToken, origin)
    c.executionCtx.waitUntil(sendEmail(c.env, { to: event.submitter_email, ...emailContent }))
  }

  if (event.created_by) {
    await createNotification(c.env.DB, event.created_by, 'approved', '活动审核通过', `「${event.title}」已通过审核，开放报名`, id)
  }

  return c.json({ ok: true })
})

// POST /api/events/:id/reject — pending → draft
events.post('/:id/reject', async (c) => {
  const session = await requireAuth(c)
  if (session.role !== 'reviewer') return c.json({ ok: false, message: '仅负责人可审核' }, 403)

  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (event.status !== 'pending') return c.json({ ok: false, message: '只能审核待审状态的活动' }, 400)

  const { reason } = await c.req.json().catch(() => ({}))
  await c.env.DB.prepare('UPDATE events SET status = ?, reviewed_by = ?, reviewed_at = ?, reject_reason = ? WHERE id = ?')
    .bind('draft', session.id, Date.now(), reason || '', id).run()

  if (event.created_by) {
    const host = await c.env.DB.prepare('SELECT email, display_name FROM admin_users WHERE id = ?').bind(event.created_by).first()
    if (host) {
      const emailContent = eventRejectedEmail(event, host, reason)
      c.executionCtx.waitUntil(sendEmail(c.env, { to: host.email, ...emailContent }))
    }
  } else if (event.submitter_email) {
    const pseudo = { email: event.submitter_email, display_name: event.submitter_name }
    const emailContent = eventRejectedEmail(event, pseudo, reason)
    c.executionCtx.waitUntil(sendEmail(c.env, { to: event.submitter_email, ...emailContent }))
  }

  if (event.created_by) {
    await createNotification(c.env.DB, event.created_by, 'rejected', '活动审核被驳回', `「${event.title}」未通过审核${reason ? '：' + reason : ''}`, id)
  }

  return c.json({ ok: true })
})

// POST /api/events/:id/withdraw — pending → draft
events.post('/:id/withdraw', async (c) => {
  const session = await requireAuth(c)
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (event.created_by !== session.id) return c.json({ ok: false, message: '只能撤回自己的活动' }, 403)
  if (event.status !== 'pending') return c.json({ ok: false, message: '只有待审核状态可以撤回' }, 400)

  await c.env.DB.prepare('UPDATE events SET status = ? WHERE id = ?').bind('draft', id).run()
  return c.json({ ok: true })
})

// POST /api/events/:id/activate — open → active
events.post('/:id/activate', async (c) => {
  const session = await requireAuth(c)
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (event.created_by !== session.id && session.role !== 'reviewer') {
    return c.json({ ok: false, message: '无权操作' }, 403)
  }
  if (event.status !== 'open') return c.json({ ok: false, message: '只有报名中的活动可以开始' }, 400)

  await c.env.DB.prepare('UPDATE events SET status = ? WHERE id = ?').bind('active', id).run()
  return c.json({ ok: true })
})

// POST /api/events/:id/deactivate — active → open (only if no one checked in)
events.post('/:id/deactivate', async (c) => {
  const session = await requireAuth(c)
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (event.created_by !== session.id && session.role !== 'reviewer') {
    return c.json({ ok: false, message: '无权操作' }, 403)
  }
  if (event.status !== 'active') return c.json({ ok: false, message: '只有进行中的活动可以撤回' }, 400)

  const checkedIn = await c.env.DB.prepare('SELECT COUNT(*) as c FROM signups WHERE event_id = ? AND checked_in = 1').bind(id).first()
  if (checkedIn.c > 0) return c.json({ ok: false, message: '已有参与者签到，无法撤回开始状态' }, 400)

  await c.env.DB.prepare('UPDATE events SET status = ? WHERE id = ?').bind('open', id).run()
  return c.json({ ok: true })
})

// POST /api/events/:id/close — active → closed
events.post('/:id/close', async (c) => {
  const session = await requireAuth(c)
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (event.created_by !== session.id && session.role !== 'reviewer') {
    return c.json({ ok: false, message: '无权操作' }, 403)
  }
  if (event.status !== 'active') return c.json({ ok: false, message: '只有进行中的活动可以结束' }, 400)

  await c.env.DB.prepare('UPDATE events SET status = ? WHERE id = ?').bind('closed', id).run()
  return c.json({ ok: true })
})

// POST /api/events/:id/duplicate
events.post('/:id/duplicate', async (c) => {
  const session = await requireAuth(c)
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (event.created_by !== session.id && session.role !== 'reviewer') {
    return c.json({ ok: false, message: '无权操作' }, 403)
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO events (title, event_date, location, content, notes, capacity, custom_fields, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(event.title + ' (副本)', event.event_date, event.location || '', event.content || '', event.notes || '', event.capacity || null, event.custom_fields || '[]', session.id).run()

  return c.json({ ok: true, id: result.meta.last_row_id })
})

// POST /api/events/:id/toggle-pin — reviewer only
events.post('/:id/toggle-pin', async (c) => {
  const session = await requireAuth(c)
  if (session.role !== 'reviewer') return c.json({ ok: false, message: '仅管理员可操作' }, 403)

  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT id, pinned FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)

  const newPinned = event.pinned ? 0 : 1
  await c.env.DB.prepare('UPDATE events SET pinned = ? WHERE id = ?').bind(newPinned, id).run()
  return c.json({ ok: true, pinned: newPinned })
})

// DELETE /api/events/:id — draft only, no signups
events.delete('/:id', async (c) => {
  const session = await requireAuth(c)
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (event.created_by !== session.id && session.role !== 'reviewer') {
    return c.json({ ok: false, message: '无权删除' }, 403)
  }
  if (event.status !== 'draft') return c.json({ ok: false, message: '只能删除草稿' }, 400)

  const count = await c.env.DB.prepare('SELECT COUNT(*) as c FROM signups WHERE event_id = ?').bind(id).first()
  if (count.c > 0) return c.json({ ok: false, message: '已有报名,不能删除' }, 400)

  await c.env.DB.prepare('DELETE FROM events WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

// POST /api/events/:id/notify — notify all participants of changes
events.post('/:id/notify', async (c) => {
  const session = await requireAuth(c)
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (event.created_by !== session.id && session.role !== 'reviewer') {
    return c.json({ ok: false, message: '无权操作' }, 403)
  }

  const { message } = await c.req.json().catch(() => ({}))
  const signups = await c.env.DB.prepare('SELECT name, email, phone, data FROM signups WHERE event_id = ?').bind(id).all()
  if (!signups.results.length) return c.json({ ok: false, message: '暂无报名者' }, 400)

  for (const s of signups.results) {
    const content = eventChangedEmail(event, s, message || '')
    c.executionCtx.waitUntil(sendEmail(c.env, { to: s.email, ...content }))
  }
  return c.json({ ok: true, count: signups.results.length })
})

// POST /api/events/:id/remind — send reminder to all participants
events.post('/:id/remind', async (c) => {
  const session = await requireAuth(c)
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (event.created_by !== session.id && session.role !== 'reviewer') {
    return c.json({ ok: false, message: '无权操作' }, 403)
  }
  if (!['open', 'active'].includes(event.status)) {
    return c.json({ ok: false, message: '只有报名中或进行中的活动可以发提醒' }, 400)
  }

  const signups = await c.env.DB.prepare('SELECT name, email, phone, data, token FROM signups WHERE event_id = ?').bind(id).all()
  if (!signups.results.length) return c.json({ ok: false, message: '暂无报名者' }, 400)

  for (const s of signups.results) {
    const content = eventReminderEmail(event, s)
    c.executionCtx.waitUntil(sendEmail(c.env, { to: s.email, ...content }))
  }
  return c.json({ ok: true, count: signups.results.length })
})

// AI plan draft generation
events.post('/:id/ai-draft', async (c) => {
  const session = await requireAuth(c)
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (event.created_by && event.created_by !== session.id && session.role !== 'reviewer') {
    return c.json({ ok: false, message: '无权限' }, 403)
  }

  const { userInput } = await c.req.json().catch(() => ({}))

  const { generatePlan } = await import('../lib/ai.js')
  try {
    const plan = await generatePlan(c.env, event, userInput || '')
    await c.env.DB.prepare('UPDATE events SET plan = ? WHERE id = ?').bind(plan, id).run()
    return c.json({ ok: true, plan })
  } catch (e) {
    return c.json({ ok: false, message: e.message || 'AI 生成失败' }, 500)
  }
})

// Save/update plan manually
events.patch('/:id/plan', async (c) => {
  const session = await requireAuth(c)
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT id, created_by FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (event.created_by && event.created_by !== session.id && session.role !== 'reviewer') {
    return c.json({ ok: false, message: '无权限' }, 403)
  }
  const { plan } = await c.req.json()
  await c.env.DB.prepare('UPDATE events SET plan = ? WHERE id = ?').bind(plan || '', id).run()
  return c.json({ ok: true })
})

export { events }
