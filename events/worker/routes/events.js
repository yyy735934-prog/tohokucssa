import { Hono } from 'hono'
import { getSession, extractToken } from '../lib/session.js'
import { sendEmail, eventApprovedEmail, eventRejectedEmail, eventApprovedInviteEmail, eventChangedEmail, eventReminderEmail, eventSubmittedEmail, eventAnnounceEmail, inviteSignupEmail, standardEventHostInviteEmail } from '../lib/email.js'
import { createNotification, notifyReviewers } from './notifications.js'
import { audit } from '../lib/audit.js'
import { safelySyncChat, syncEventChatMembers } from '../lib/cometchat.js'
import { canEditEventContent, canOperateEvent, isAssignedStandardHost } from '../lib/permissions.js'
import { normalizeStandardRegistration } from '../lib/event-types.js'

const events = new Hono()

async function requireAuth(c) {
  const session = await getSession(c.env.SESSIONS, extractToken(c.req), c.env.DB)
  if (!session) throw new Error('未登录')
  return session
}

// POST /api/events/apply — public event submission (no auth)
events.post('/propose', async (c) => {
  return c.json({ ok: false, message: '正式活动仅由管理员创建。' }, 403)
  /* const body = await c.req.json()
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

  return c.json({ ok: true, id: newId }) */
})

// GET /api/events/dashboard-stats — reviewer overview
events.get('/dashboard-stats', async (c) => {
  const session = await requireAuth(c)
  if (session.role !== 'reviewer') return c.json({ ok: false, message: '仅审核员可查看' }, 403)

  const [pending, open, active, closed, totalSignups, totalCheckins, perEvent] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) as c FROM events WHERE status = 'pending'").first(),
    c.env.DB.prepare("SELECT COUNT(*) as c FROM events WHERE status = 'open'").first(),
    c.env.DB.prepare("SELECT COUNT(*) as c FROM events WHERE status = 'active'").first(),
    c.env.DB.prepare("SELECT COUNT(*) as c FROM events WHERE status = 'closed'").first(),
    c.env.DB.prepare("SELECT COUNT(*) as c FROM signups s JOIN events e ON e.id = s.event_id WHERE e.event_mode != 'gathering' OR s.signup_status != 'cancelled'").first(),
    c.env.DB.prepare("SELECT COUNT(*) as c FROM signups s JOIN events e ON e.id = s.event_id WHERE s.checked_in = 1 AND (e.event_mode != 'gathering' OR s.signup_status != 'cancelled')").first(),
    c.env.DB.prepare(
      `SELECT e.id, e.title, e.event_date, e.status, e.capacity,
              SUM(CASE WHEN s.id IS NOT NULL AND NOT (e.event_mode = 'gathering' AND s.signup_status = 'cancelled') THEN 1 ELSE 0 END) as signups,
              SUM(CASE WHEN s.checked_in = 1 AND NOT (e.event_mode = 'gathering' AND s.signup_status = 'cancelled') THEN 1 ELSE 0 END) as checkins
       FROM events e LEFT JOIN signups s ON s.event_id = e.id
       WHERE e.status IN ('open', 'active', 'closed')
       GROUP BY e.id ORDER BY e.event_date DESC`
    ).all(),
  ])

  return c.json({
    ok: true,
    stats: {
      pending: pending.c, open: open.c, active: active.c, closed: closed.c,
      totalSignups: totalSignups.c, totalCheckins: totalCheckins.c
    },
    perEvent: perEvent.results,
  })
})

// GET /api/events/audit-logs — reviewer only
events.get('/audit-logs', async (c) => {
  const session = await requireAuth(c)
  if (session.role !== 'reviewer') return c.json({ ok: false, message: '仅管理员可查看' }, 403)

  const limit = Math.min(Number(c.req.query('limit')) || 50, 200)
  const rows = await c.env.DB.prepare(
    'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?'
  ).bind(limit).all()
  return c.json({ ok: true, logs: rows.results })
})

// GET /api/events — public or admin listing
events.get('/', async (c) => {
  const scope = c.req.query('scope')

  if (scope === 'public') {
    const rows = await c.env.DB.prepare(
      `SELECT e.id, e.title, e.event_date, e.location, e.content, e.capacity, e.lock_at, e.status, e.created_at, e.image_key, e.pinned,
              e.event_mode, e.event_subtype, e.registration_mode,
              COUNT(s.id) as signupCount
       FROM events e LEFT JOIN signups s ON s.event_id = e.id
       WHERE e.status IN ('open', 'active') AND COALESCE(e.event_mode, 'standard') = 'standard'
       GROUP BY e.id ORDER BY e.pinned DESC, e.created_at DESC`
    ).all()
    return c.json({ ok: true, events: rows.results })
  }

  const session = await requireAuth(c)
  let rows
  if (session.role === 'reviewer') {
    rows = await c.env.DB.prepare(
      `SELECT e.*, SUM(CASE WHEN s.id IS NOT NULL AND NOT (e.event_mode = 'gathering' AND s.signup_status = 'cancelled') THEN 1 ELSE 0 END) as signupCount, u.email as creator_email, u.display_name as creator_name
       FROM events e LEFT JOIN signups s ON s.event_id = e.id
       LEFT JOIN admin_users u ON u.id = e.created_by
       GROUP BY e.id ORDER BY e.created_at DESC`
    ).all()
  } else {
    rows = await c.env.DB.prepare(
      `SELECT e.*, SUM(CASE WHEN s.id IS NOT NULL AND NOT (e.event_mode = 'gathering' AND s.signup_status = 'cancelled') THEN 1 ELSE 0 END) as signupCount
       FROM events e LEFT JOIN signups s ON s.event_id = e.id
       WHERE e.created_by = ? OR EXISTS (
         SELECT 1 FROM event_host_assignments a WHERE a.event_id = e.id AND a.user_id = ? AND a.status = 'accepted'
       )
       GROUP BY e.id ORDER BY e.created_at DESC`
    ).bind(session.id, session.id).all()
  }
  return c.json({ ok: true, events: rows.results })
})

async function requireReviewer(c) {
  const session = await requireAuth(c)
  if (session.role !== 'reviewer') return { error: c.json({ ok: false, message: '仅管理员可操作' }, 403) }
  return { session }
}

events.post('/:id/host-invites', async (c) => {
  const access = await requireReviewer(c); if (access.error) return access.error
  const eventId = Number(c.req.param('id')); const body = await c.req.json().catch(() => ({}))
  const userIds = [...new Set((Array.isArray(body.user_ids) ? body.user_ids : [body.user_id]).map(Number).filter(Number.isInteger))]
  const event = await c.env.DB.prepare("SELECT * FROM events WHERE id = ? AND event_mode = 'standard'").bind(eventId).first()
  if (!event) return c.json({ ok: false, message: '正式活动不存在' }, 404)
  if (!userIds.length) return c.json({ ok: false, message: '请选择主理人' }, 400)
  const placeholders = userIds.map(() => '?').join(',')
  const users = await c.env.DB.prepare(`SELECT id, email, display_name FROM admin_users WHERE id IN (${placeholders}) AND role = 'host'`).bind(...userIds).all()
  if (users.results.length !== userIds.length) return c.json({ ok: false, message: '只能邀请主理人角色' }, 400)
  for (const user of users.results) {
    const token = crypto.randomUUID()
    await c.env.DB.prepare(
      `INSERT INTO event_host_assignments (event_id, user_id, status, invite_token, invited_by, invited_at)
       VALUES (?, ?, 'invited', ?, ?, ?)
       ON CONFLICT(event_id, user_id) DO UPDATE SET status = 'invited', invite_token = excluded.invite_token, invited_by = excluded.invited_by, invited_at = excluded.invited_at, responded_at = NULL`
    ).bind(eventId, user.id, token, access.session.id, Date.now()).run()
    const acceptUrl = `${new URL(c.req.url).origin}/host-invites/${encodeURIComponent(token)}`
    c.executionCtx.waitUntil(sendEmail(c.env, { to: user.email, ...standardEventHostInviteEmail(event, user, acceptUrl) }))
    await audit(c.env.DB, 'standard_event_host_invite', 'event', eventId, `邀请 ${user.email}`, access.session.email)
  }
  return c.json({ ok: true, invited: users.results.map((user) => user.id) })
})

events.get('/:id/host-invites', async (c) => {
  const access = await requireReviewer(c); if (access.error) return access.error
  const rows = await c.env.DB.prepare(
    `SELECT a.event_id, a.user_id, a.status, a.invited_at, a.responded_at, u.email, u.display_name
     FROM event_host_assignments a JOIN admin_users u ON u.id = a.user_id WHERE a.event_id = ? ORDER BY a.invited_at DESC`
  ).bind(Number(c.req.param('id'))).all()
  return c.json({ ok: true, assignments: rows.results })
})

events.get('/host-invites/:token', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT a.event_id, a.user_id, a.status, e.title, e.event_date, e.location, u.email, u.display_name
     FROM event_host_assignments a JOIN events e ON e.id = a.event_id JOIN admin_users u ON u.id = a.user_id
     WHERE a.invite_token = ?`
  ).bind(c.req.param('token')).first()
  if (!row) return c.json({ ok: false, message: '担当邀请无效或已失效' }, 404)
  return c.json({ ok: true, invite: row })
})

for (const [path, status] of [['accept', 'accepted'], ['decline', 'declined']]) {
  events.post(`/host-invites/:token/${path}`, async (c) => {
    const session = await requireAuth(c)
    const token = c.req.param('token')
    const row = await c.env.DB.prepare('SELECT event_id, user_id, status FROM event_host_assignments WHERE invite_token = ?').bind(token).first()
    if (!row || Number(row.user_id) !== Number(session.id)) return c.json({ ok: false, message: '无效的担当邀请' }, 404)
    const result = await c.env.DB.prepare(
      `UPDATE event_host_assignments SET status = ?, responded_at = ? WHERE invite_token = ? AND user_id = ? AND status = 'invited'`
    ).bind(status, Date.now(), token, session.id).run()
    if (!result.meta.changes) return c.json({ ok: false, message: '邀请已处理' }, 409)
    await audit(c.env.DB, `standard_event_host_${path}`, 'event', row.event_id, session.email, session.email)
    if (status === 'accepted') {
      const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(row.event_id).first()
      c.executionCtx.waitUntil(safelySyncChat(c.env, { type: 'event', id: row.event_id }, () => syncEventChatMembers(c.env, event)))
    }
    return c.json({ ok: true, status })
  })
}

events.delete('/:id/host-invites/:userId', async (c) => {
  const access = await requireReviewer(c); if (access.error) return access.error
  const result = await c.env.DB.prepare(
    "UPDATE event_host_assignments SET status = 'removed', responded_at = ? WHERE event_id = ? AND user_id = ?"
  ).bind(Date.now(), Number(c.req.param('id')), Number(c.req.param('userId'))).run()
  if (!result.meta.changes) return c.json({ ok: false, message: '担当不存在' }, 404)
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(Number(c.req.param('id'))).first()
  c.executionCtx.waitUntil(safelySyncChat(c.env, { type: 'event', id: event.id }, () => syncEventChatMembers(c.env, event)))
  await audit(c.env.DB, 'standard_event_host_remove', 'event', Number(c.req.param('id')), c.req.param('userId'), access.session.email)
  return c.json({ ok: true })
})

// GET /api/events/:id
events.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)

  const count = await c.env.DB.prepare('SELECT COUNT(*) as c FROM signups WHERE event_id = ?').bind(id).first()

  const token = extractToken(c.req)
  const session = token ? await getSession(c.env.SESSIONS, token, c.env.DB) : null
  const isAdmin = session && (session.role === 'reviewer' || session.id === event.created_by || await isAssignedStandardHost(c.env.DB, id, session.id))

  if (!isAdmin) {
    const { id, title, event_date, location, content, notes, capacity, lock_at, status, custom_fields, activity_type, image_key, event_mode, event_subtype, registration_mode } = event
    return c.json({ ok: true, event: { id, title, event_date, location, content, notes, capacity, lock_at, status, custom_fields, activity_type, image_key, event_mode, event_subtype, registration_mode, signupCount: count.c } })
  }

  const creator = await c.env.DB.prepare('SELECT email, display_name FROM admin_users WHERE id = ?').bind(event.created_by).first()
  return c.json({ ok: true, event: { ...event, signupCount: count.c, creator_email: creator?.email, creator_name: creator?.display_name } })
})

// POST /api/events — create event
events.post('/', async (c) => {
  const session = await requireAuth(c)
  const body = await c.req.json()
  const { title, event_date, location, content, notes, capacity, lock_at, custom_fields, activity_type,
    event_subtype = 'self_hosted', registration_mode = 'internal', registration_target,
    registration_email_subject, registration_email_body } = body
  if (!title || !event_date) return c.json({ ok: false, message: '标题和时间必填' }, 400)
  if (session.role !== 'reviewer') return c.json({ ok: false, message: '只有管理员可以创建正式活动' }, 403)
  const registration = normalizeStandardRegistration({ event_subtype, registration_mode, registration_target, registration_email_subject, registration_email_body })
  if (registration.error) return c.json({ ok: false, message: registration.error }, 400)

  const cf = custom_fields ? JSON.stringify(custom_fields) : '[]'

  const result = await c.env.DB.prepare(
    `INSERT INTO events (title, event_date, location, content, notes, capacity, lock_at, custom_fields, activity_type,
      created_by, event_mode, event_subtype, registration_mode, registration_target, registration_email_subject, registration_email_body)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'standard', ?, ?, ?, ?, ?)`
  ).bind(title.trim(), event_date.trim(), (location || '').trim(), (content || '').trim(), (notes || '').trim(), capacity || null, lock_at || null, cf, (activity_type || '').trim() || null, session.id,
    registration.event_subtype, registration.registration_mode, registration.registration_target, registration.registration_email_subject, registration.registration_email_body).run()

  return c.json({ ok: true, id: result.meta.last_row_id })
})

// PATCH /api/events/:id — edit event
events.patch('/:id', async (c) => {
  const session = await requireAuth(c)
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (!canEditEventContent(event, session)) {
    return c.json({ ok: false, message: '无权编辑' }, 403)
  }

  const body = await c.req.json()
  const fields = ['title', 'event_date', 'location', 'content', 'notes', 'capacity', 'lock_at', 'custom_fields', 'activity_type']
  const sets = []
  const vals = []
  if (event.event_mode === 'standard' && ['event_subtype', 'registration_mode', 'registration_target', 'registration_email_subject', 'registration_email_body'].some((field) => body[field] !== undefined)) {
    const registration = normalizeStandardRegistration({ ...event, ...body })
    if (registration.error) return c.json({ ok: false, message: registration.error }, 400)
    for (const field of ['event_subtype', 'registration_mode', 'registration_target', 'registration_email_subject', 'registration_email_body']) {
      sets.push(`${field} = ?`); vals.push(registration[field])
    }
  }
  for (const f of fields) {
    if (body[f] !== undefined) {
      sets.push(`${f} = ?`)
      if (f === 'capacity' || f === 'lock_at') vals.push(body[f] || null)
      else if (f === 'custom_fields') vals.push(JSON.stringify(body[f]))
      else vals.push(String(body[f] || '').trim())
    }
  }
  if (!sets.length) return c.json({ ok: false, message: '没有要修改的字段' }, 400)

  vals.push(id)
  await c.env.DB.prepare(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run()
  return c.json({ ok: true })
})

events.post('/:id/signup-lock', async (c) => {
  const session = await requireAuth(c)
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT id, title, status, created_by, event_mode, gathering_state FROM events WHERE id = ?')
    .bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (!await canOperateEvent(c.env.DB, event, session)) {
    return c.json({ ok: false, message: '仅活动创建者或管理员可以操作' }, 403)
  }
  if (event.status !== 'open' || ['completed', 'cancelled'].includes(event.gathering_state)) {
    return c.json({ ok: false, message: '当前活动状态不能调整报名锁定' }, 400)
  }

  const body = await c.req.json().catch(() => ({}))
  if (typeof body.locked !== 'boolean') return c.json({ ok: false, message: '锁定状态无效' }, 400)
  let lockAt = null
  if (body.locked) {
    const count = await c.env.DB.prepare(
      `SELECT COUNT(*) AS c FROM signups
       WHERE event_id = ? AND (? != 'gathering' OR signup_status != 'cancelled')`
    ).bind(id, event.event_mode).first()
    lockAt = Number(count?.c || 0)
  }
  await c.env.DB.prepare('UPDATE events SET lock_at = ? WHERE id = ?').bind(lockAt, id).run()
  await audit(c.env.DB, body.locked ? 'signup_lock' : 'signup_unlock', 'event', id, body.locked ? `锁定在 ${lockAt} 人` : '恢复报名', session.email)
  return c.json({ ok: true, locked: body.locked, lock_at: lockAt })
})

// POST /api/events/:id/submit — draft → pending (reviewer auto-approves own events → open)
events.post('/:id/submit', async (c) => {
  const session = await requireAuth(c)
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (event.event_mode === 'standard' && session.role !== 'reviewer') return c.json({ ok: false, message: '只有管理员可以提交正式活动' }, 403)
  if (event.created_by !== session.id) return c.json({ ok: false, message: '只能提交自己的活动' }, 403)
  if (event.status !== 'draft') return c.json({ ok: false, message: '只有草稿可以提交审核' }, 400)

  if (session.role === 'reviewer') {
    await c.env.DB.prepare('UPDATE events SET status = ?, submitted_at = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?')
      .bind('open', Date.now(), session.id, Date.now(), id).run()
    c.executionCtx.waitUntil(safelySyncChat(c.env, { type: 'event', id }, () => syncEventChatMembers(c.env, { ...event, status: 'open' })))
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
  c.executionCtx.waitUntil(safelySyncChat(c.env, { type: 'event', id }, () => syncEventChatMembers(c.env, { ...event, status: 'open' })))

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

  await audit(c.env.DB, 'approve', 'event', id, `审核通过「${event.title}」`, session.email)
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

  await audit(c.env.DB, 'reject', 'event', id, `驳回「${event.title}」${reason ? '：' + reason : ''}`, session.email)
  return c.json({ ok: true })
})

// POST /api/events/:id/withdraw — pending → draft
events.post('/:id/withdraw', async (c) => {
  const session = await requireAuth(c)
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (event.event_mode === 'standard' && session.role !== 'reviewer') return c.json({ ok: false, message: '只有管理员可撤回正式活动' }, 403)
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
  if (!await canOperateEvent(c.env.DB, event, session)) {
    return c.json({ ok: false, message: '无权操作' }, 403)
  }
  if (event.status !== 'open') return c.json({ ok: false, message: '只有报名中的活动可以开始' }, 400)

  await c.env.DB.prepare('UPDATE events SET status = ? WHERE id = ?').bind('active', id).run()
  await audit(c.env.DB, 'activate', 'event', id, `开始活动「${event.title}」`, session.email)
  return c.json({ ok: true })
})

// POST /api/events/:id/deactivate — active → open (only if no one checked in)
events.post('/:id/deactivate', async (c) => {
  const session = await requireAuth(c)
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (!await canOperateEvent(c.env.DB, event, session)) {
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
  if (!await canOperateEvent(c.env.DB, event, session)) {
    return c.json({ ok: false, message: '无权操作' }, 403)
  }
  if (event.status !== 'active') return c.json({ ok: false, message: '只有进行中的活动可以结束' }, 400)

  await c.env.DB.prepare('UPDATE events SET status = ? WHERE id = ?').bind('closed', id).run()
  await audit(c.env.DB, 'close', 'event', id, `结束活动「${event.title}」`, session.email)
  return c.json({ ok: true })
})

// POST /api/events/:id/duplicate
events.post('/:id/duplicate', async (c) => {
  const session = await requireAuth(c)
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (!canEditEventContent(event, session)) {
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
  if (!canEditEventContent(event, session)) {
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
  if (!await canOperateEvent(c.env.DB, event, session)) {
    return c.json({ ok: false, message: '无权操作' }, 403)
  }

  const { message } = await c.req.json().catch(() => ({}))
  const signups = await participantRecipients(c.env.DB, event)
  if (!signups.results.length) return c.json({ ok: false, message: '暂无报名者' }, 400)

  for (const s of signups.results) {
    const content = eventChangedEmail(event, s, message || '')
    c.executionCtx.waitUntil(sendEmail(c.env, { to: s.email, ...content }))
  }
  return c.json({ ok: true, count: signups.results.length })
})

// POST /api/events/:id/announce — 普通通知（自定义标题+正文+可选附图）
events.post('/:id/announce', async (c) => {
  const session = await requireAuth(c)
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (!await canOperateEvent(c.env.DB, event, session)) {
    return c.json({ ok: false, message: '无权操作' }, 403)
  }

  const { subject, message, image_key } = await c.req.json().catch(() => ({}))
  if (!subject?.trim() || !message?.trim()) return c.json({ ok: false, message: '标题和内容必填' }, 400)

  const signups = await participantRecipients(c.env.DB, event)
  if (!signups.results.length) return c.json({ ok: false, message: '暂无报名者' }, 400)

  const origin = new URL(c.req.url).origin
  const imageUrl = image_key ? `${origin}/api/images/${image_key}` : ''

  for (const s of signups.results) {
    const content = eventAnnounceEmail(event, s, subject.trim(), message.trim(), imageUrl)
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
  if (!await canOperateEvent(c.env.DB, event, session)) {
    return c.json({ ok: false, message: '无权操作' }, 403)
  }
  if (!['open', 'active'].includes(event.status)) {
    return c.json({ ok: false, message: '只有报名中或进行中的活动可以发提醒' }, 400)
  }
  if (event.event_mode === 'gathering' && !['confirmed', 'in_progress'].includes(event.gathering_state)) {
    return c.json({ ok: false, message: '组局确认成行后才能发送签到码' }, 400)
  }

  const signups = await participantRecipients(c.env.DB, event)
  if (!signups.results.length) return c.json({ ok: false, message: '暂无报名者' }, 400)

  for (const s of signups.results) {
    const content = eventReminderEmail(event, s, new URL(c.req.url).origin)
    c.executionCtx.waitUntil(sendEmail(c.env, { to: s.email, ...content }))
  }
  return c.json({ ok: true, count: signups.results.length })
})

function participantRecipients(db, event) {
  const gatheringClause = event.event_mode === 'gathering'
    ? " AND signup_status IN ('joined', 'ride_assigned')"
    : ''
  return db.prepare(`SELECT name, email, phone, data, token FROM signups WHERE event_id = ?${gatheringClause}`).bind(event.id).all()
}

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

function parseEmails(raw) {
  if (!raw) return []
  return [...new Set(
    raw.replace(/[,;，；\n\r\t]+/g, ' ')
      .split(/\s+/)
      .map(s => s.replace(/^[<(【「"']+|[>)】」"']+$/g, '').trim().toLowerCase())
      .filter(s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
  )]
}

// POST /api/events/:id/invite-signup — batch invite people to sign up
events.post('/:id/invite-signup', async (c) => {
  const session = await requireAuth(c)

  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (event.status !== 'open') return c.json({ ok: false, message: '活动未在报名中' }, 400)
  if (!await canOperateEvent(c.env.DB, event, session)) {
    return c.json({ ok: false, message: '无权限' }, 403)
  }

  const { emails: rawEmails } = await c.req.json()
  if (!rawEmails || !rawEmails.trim()) return c.json({ ok: false, message: '请输入邮箱' }, 400)

  const emailList = parseEmails(rawEmails)
  if (!emailList.length) return c.json({ ok: false, message: '未识别到有效邮箱' }, 400)

  const origin = new URL(c.req.url).origin
  const signupUrl = `${origin}/e/${id}`
  const sent = [], skipped = []
  for (const email of emailList) {
    const existing = await c.env.DB.prepare('SELECT id FROM signups WHERE event_id = ? AND email = ?').bind(id, email).first()
    if (existing) { skipped.push(email); continue }

    const content = inviteSignupEmail(event, signupUrl)
    c.executionCtx.waitUntil(sendEmail(c.env, { to: email, ...content }))
    sent.push(email)
  }

  return c.json({ ok: true, sent, skipped })
})

export { events }
