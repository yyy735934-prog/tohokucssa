import { Hono } from 'hono'
import { getSession, extractToken } from '../lib/session.js'
import { sendEmail, sendEmailBatch, getEmailQuota, eventApprovedEmail, eventRejectedEmail, eventApprovedInviteEmail, eventChangedEmail, eventReminderEmail, eventSubmittedEmail, eventAnnounceEmail, inviteSignupEmail } from '../lib/email.js'
import { createNotification, notifyReviewers } from './notifications.js'
import { audit } from '../lib/audit.js'

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
    c.executionCtx.waitUntil(sendEmail(c.env, { to: r.email, eventId: newId, ...content }))
  }

  return c.json({ ok: true, id: newId })
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
    c.env.DB.prepare("SELECT COUNT(*) as c FROM signups").first(),
    c.env.DB.prepare("SELECT COUNT(*) as c FROM signups WHERE checked_in = 1").first(),
    c.env.DB.prepare(
      `SELECT e.id, e.title, e.event_date, e.status, e.capacity,
              COUNT(s.id) as signups, SUM(CASE WHEN s.checked_in = 1 THEN 1 ELSE 0 END) as checkins
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

// GET /api/events/email-quota — 今日邮件配额
events.get('/email-quota', async (c) => {
  const session = await requireAuth(c)
  if (session.role !== 'reviewer' && session.role !== 'host') return c.json({ ok: false, message: '无权查看' }, 403)
  const quota = await getEmailQuota(c.env.DB, Number(c.env.EMAIL_DAILY_LIMIT) || undefined)
  return c.json({ ok: true, ...quota })
})

// GET /api/events/email-logs — 邮件发送日志
events.get('/email-logs', async (c) => {
  const session = await requireAuth(c)
  if (session.role !== 'reviewer') return c.json({ ok: false, message: '仅管理员可查看' }, 403)

  const eventId = c.req.query('event_id')
  const limit = Math.min(Number(c.req.query('limit')) || 100, 500)

  let rows
  if (eventId) {
    rows = await c.env.DB.prepare(
      'SELECT l.id, l.event_id, l.to_email, l.subject, l.status, l.error, l.created_at, e.title as event_title FROM email_logs l LEFT JOIN events e ON e.id = l.event_id WHERE l.event_id = ? ORDER BY l.created_at DESC LIMIT ?'
    ).bind(Number(eventId), limit).all()
  } else {
    rows = await c.env.DB.prepare(
      'SELECT l.id, l.event_id, l.to_email, l.subject, l.status, l.error, l.created_at, e.title as event_title FROM email_logs l LEFT JOIN events e ON e.id = l.event_id ORDER BY l.created_at DESC LIMIT ?'
    ).bind(limit).all()
  }
  return c.json({ ok: true, logs: rows.results })
})

// GET /api/events/email-logs/:logId — 邮件详情（含 HTML 预览）
events.get('/email-logs/:logId', async (c) => {
  const session = await requireAuth(c)
  if (session.role !== 'reviewer') return c.json({ ok: false, message: '仅管理员可查看' }, 403)

  const logId = Number(c.req.param('logId'))
  const row = await c.env.DB.prepare(
    'SELECT l.*, e.title as event_title FROM email_logs l LEFT JOIN events e ON e.id = l.event_id WHERE l.id = ?'
  ).bind(logId).first()
  if (!row) return c.json({ ok: false, message: '记录不存在' }, 404)
  return c.json({ ok: true, log: row })
})

// GET /api/events — public or admin listing
events.get('/', async (c) => {
  const scope = c.req.query('scope')

  if (scope === 'public') {
    const rows = await c.env.DB.prepare(
      `SELECT e.id, e.title, e.event_date, e.location, e.content, e.capacity, e.lock_at, e.status, e.created_at, e.image_key, e.pinned,
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
    const { id, title, event_date, location, content, notes, capacity, lock_at, status, custom_fields, activity_type, image_key } = event
    return c.json({ ok: true, event: { id, title, event_date, location, content, notes, capacity, lock_at, status, custom_fields, activity_type, image_key, signupCount: count.c } })
  }

  const creator = await c.env.DB.prepare('SELECT email, display_name FROM admin_users WHERE id = ?').bind(event.created_by).first()
  return c.json({ ok: true, event: { ...event, signupCount: count.c, creator_email: creator?.email, creator_name: creator?.display_name } })
})

// POST /api/events — create event
events.post('/', async (c) => {
  const session = await requireAuth(c)
  const body = await c.req.json()
  const { title, event_date, location, content, notes, capacity, lock_at, custom_fields, activity_type } = body
  if (!title || !event_date) return c.json({ ok: false, message: '标题和时间必填' }, 400)

  const cf = custom_fields ? JSON.stringify(custom_fields) : '[]'

  if (session.role === 'user') {
    await c.env.DB.prepare("UPDATE admin_users SET role = 'host' WHERE id = ? AND role = 'user'").bind(session.id).run()
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO events (title, event_date, location, content, notes, capacity, lock_at, custom_fields, activity_type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(title.trim(), event_date.trim(), (location || '').trim(), (content || '').trim(), (notes || '').trim(), capacity || null, lock_at || null, cf, (activity_type || '').trim() || null, session.id).run()

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
  const fields = ['title', 'event_date', 'location', 'content', 'notes', 'capacity', 'lock_at', 'custom_fields', 'activity_type']
  const sets = []
  const vals = []
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

// POST /api/events/:id/submit — draft → pending (super admin auto-approves own events → open;
// 普通审核员提交后仍需人工审核，避免绕过审核流程)
events.post('/:id/submit', async (c) => {
  const session = await requireAuth(c)
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (event.created_by !== session.id) return c.json({ ok: false, message: '只能提交自己的活动' }, 403)
  if (event.status !== 'draft') return c.json({ ok: false, message: '只有草稿可以提交审核' }, 400)

  if (session.is_super) {
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
    c.executionCtx.waitUntil(sendEmail(c.env, { to: r.email, eventId: id, ...content }))
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
      c.executionCtx.waitUntil(sendEmail(c.env, { to: host.email, eventId: id, ...emailContent }))
    }
  } else if (event.submitter_email) {
    const inviteToken = crypto.randomUUID()
    await c.env.SESSIONS.put(`invite:${inviteToken}`, JSON.stringify({
      email: event.submitter_email, event_id: id, name: event.submitter_name
    }), { expirationTtl: 7 * 24 * 3600 })

    const origin = new URL(c.req.url).origin
    const emailContent = eventApprovedInviteEmail(event, inviteToken, origin)
    c.executionCtx.waitUntil(sendEmail(c.env, { to: event.submitter_email, eventId: id, ...emailContent }))
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
      c.executionCtx.waitUntil(sendEmail(c.env, { to: host.email, eventId: id, ...emailContent }))
    }
  } else if (event.submitter_email) {
    const pseudo = { email: event.submitter_email, display_name: event.submitter_name }
    const emailContent = eventRejectedEmail(event, pseudo, reason)
    c.executionCtx.waitUntil(sendEmail(c.env, { to: event.submitter_email, eventId: id, ...emailContent }))
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
  if (event.created_by !== session.id) return c.json({ ok: false, message: '只能撤回自己的活动' }, 403)
  if (event.status !== 'pending') return c.json({ ok: false, message: '只有待审核状态可以撤回' }, 400)

  await c.env.DB.prepare('UPDATE events SET status = ? WHERE id = ?').bind('draft', id).run()
  return c.json({ ok: true })
})

// POST /api/events/:id/revert — 任意状态 → draft（审核员/超管手动回退，仅限没有报名/签到的活动）
events.post('/:id/revert', async (c) => {
  const session = await requireAuth(c)
  if (session.role !== 'reviewer') return c.json({ ok: false, message: '仅审核员可回退活动' }, 403)

  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (event.status === 'draft') return c.json({ ok: false, message: '活动已是编辑状态' }, 400)

  const stat = await c.env.DB.prepare(
    'SELECT COUNT(*) as total, SUM(CASE WHEN checked_in = 1 THEN 1 ELSE 0 END) as checkedIn FROM signups WHERE event_id = ?'
  ).bind(id).first()
  if (stat.total > 0) {
    return c.json({ ok: false, message: stat.checkedIn > 0
      ? '已有参与者签到，无法回退到编辑状态'
      : `已有 ${stat.total} 人报名，无法回退到编辑状态` }, 400)
  }

  await c.env.DB.prepare(
    'UPDATE events SET status = ?, submitted_at = NULL, reviewed_by = NULL, reviewed_at = NULL, reject_reason = NULL WHERE id = ?'
  ).bind('draft', id).run()
  await audit(c.env.DB, 'revert', 'event', id, `回退「${event.title}」到编辑状态`, session.email)
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
  await audit(c.env.DB, 'activate', 'event', id, `开始活动「${event.title}」`, session.email)
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
  await audit(c.env.DB, 'close', 'event', id, `结束活动「${event.title}」`, session.email)
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

  const emails = signups.results.map(s => ({
    to: s.email, eventId: id, ...eventChangedEmail(event, s, message || '')
  }))
  const result = await sendEmailBatch(c.env, emails)
  if (result.blocked) return c.json({ ok: false, message: `今日邮件额度不足（已用 ${result.quota.used}/${result.quota.limit}），需发 ${emails.length} 封，剩余 ${result.quota.remaining} 封。请明天再试`, quota: result.quota }, 429)
  return c.json({ ok: true, count: signups.results.length, sent: result.sent, failed: result.failed, quota: result.quota })
})

// POST /api/events/:id/announce — 普通通知（自定义标题+正文+可选附图）
events.post('/:id/announce', async (c) => {
  const session = await requireAuth(c)
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (event.created_by !== session.id && session.role !== 'reviewer') {
    return c.json({ ok: false, message: '无权操作' }, 403)
  }

  const { subject, message, image_key } = await c.req.json().catch(() => ({}))
  if (!subject?.trim() || !message?.trim()) return c.json({ ok: false, message: '标题和内容必填' }, 400)

  const signups = await c.env.DB.prepare('SELECT name, email FROM signups WHERE event_id = ?').bind(id).all()
  if (!signups.results.length) return c.json({ ok: false, message: '暂无报名者' }, 400)

  const origin = new URL(c.req.url).origin
  const imageUrl = image_key ? `${origin}/api/images/${image_key}` : ''

  const emails = signups.results.map(s => ({
    to: s.email, eventId: id, ...eventAnnounceEmail(event, s, subject.trim(), message.trim(), imageUrl)
  }))
  const result = await sendEmailBatch(c.env, emails)
  if (result.blocked) return c.json({ ok: false, message: `今日邮件额度不足（已用 ${result.quota.used}/${result.quota.limit}），需发 ${emails.length} 封，剩余 ${result.quota.remaining} 封。请明天再试`, quota: result.quota }, 429)
  return c.json({ ok: true, count: signups.results.length, sent: result.sent, failed: result.failed, quota: result.quota })
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

  const emails = signups.results.map(s => ({
    to: s.email, eventId: id, ...eventReminderEmail(event, s)
  }))
  const result = await sendEmailBatch(c.env, emails)
  if (result.blocked) return c.json({ ok: false, message: `今日邮件额度不足（已用 ${result.quota.used}/${result.quota.limit}），需发 ${emails.length} 封，剩余 ${result.quota.remaining} 封。请明天再试`, quota: result.quota }, 429)
  return c.json({ ok: true, count: signups.results.length, sent: result.sent, failed: result.failed, quota: result.quota })
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
  if (!['host', 'reviewer'].includes(session.role)) return c.json({ ok: false, message: '无权限' }, 403)

  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (event.status !== 'open') return c.json({ ok: false, message: '活动未在报名中' }, 400)
  if (event.created_by && event.created_by !== session.id && session.role !== 'reviewer') {
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
    const ok = await sendEmail(c.env, { to: email, eventId: id, ...content })
    if (ok) sent.push(email); else skipped.push(email)
  }

  return c.json({ ok: true, sent, skipped })
})

export { events }
