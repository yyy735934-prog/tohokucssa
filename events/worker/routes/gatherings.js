import { Hono } from 'hono'
import { getSession, extractToken } from '../lib/session.js'
import {
  TRANSPORT_MODES,
  effectiveSignupCount,
  refreshGatheringState,
  cancelGathering,
  acceptGatheringHost,
  getGatheringHostOffers,
  refreshDateChoiceOccurrence,
} from '../lib/gatherings.js'
import { sendEmail, gatheringFinalizedEmail, gatheringCarpoolAssignedEmail, gatheringScheduleChangedEmail } from '../lib/email.js'
import { audit } from '../lib/audit.js'
import { removeChatMember, safelySyncChat, syncEventChatMembers, syncOccurrenceChatMembers } from '../lib/cometchat.js'

const gatherings = new Hono()

async function getOptionalSession(c) {
  const token = extractToken(c.req)
  return token ? getSession(c.env.SESSIONS, token, c.env.DB) : null
}

async function requireGoogle(c) {
  const session = await getOptionalSession(c)
  if (!session) throw new Error('未登录')
  if (session.login_method !== 'google') {
    const error = new Error('参加组局必须使用 Google 登录')
    error.status = 403
    throw error
  }
  return session
}

async function requireManager(c, eventId) {
  const session = await getOptionalSession(c)
  if (!session) throw new Error('未登录')
  const event = await c.env.DB.prepare("SELECT * FROM events WHERE id = ? AND event_mode = 'gathering'")
    .bind(eventId).first()
  if (!event) return { error: c.json({ ok: false, message: '组局不存在' }, 404) }
  if (session.role !== 'reviewer' && event.created_by !== session.id) {
    return { error: c.json({ ok: false, message: '无权操作' }, 403) }
  }
  return { session, event }
}

async function queueConfirmedScheduledChatSync(c, eventId) {
  const event = await c.env.DB.prepare(
    "SELECT * FROM events WHERE id = ? AND event_mode = 'gathering' AND event_subtype = 'scheduled'"
  ).bind(eventId).first()
  if (!event || !['confirmed', 'in_progress'].includes(event.gathering_state)) return
  c.executionCtx.waitUntil(
    safelySyncChat(c.env, { type: 'event', id: eventId }, () => syncEventChatMembers(c.env, event)),
  )
}

gatherings.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT e.id, e.title, e.event_date, e.location, e.content, e.notes, e.capacity, e.lock_at,
            e.status, e.image_key, e.pinned, e.created_at, e.event_mode, e.event_subtype, e.gathering_state, e.gathering_category,
            e.min_participants, e.formation_deadline, e.arrangement_due_at,
            e.requires_host, e.carpool_enabled, e.cancel_reason,
            u.display_name AS host_name,
            SUM(CASE WHEN s.signup_status IN ('joined', 'ride_assigned') THEN 1 ELSE 0 END) AS effective_count,
            SUM(CASE WHEN s.signup_status != 'cancelled' THEN 1 ELSE 0 END) AS interest_count
     FROM events e
     LEFT JOIN signups s ON s.event_id = e.id
     LEFT JOIN admin_users u ON u.id = e.created_by
     WHERE e.event_mode = 'gathering'
       AND e.gathering_state IN ('recruiting', 'arrangement_pending', 'confirmed', 'in_progress')
     GROUP BY e.id
     ORDER BY CASE e.gathering_state WHEN 'confirmed' THEN 0 WHEN 'arrangement_pending' THEN 1 ELSE 2 END,
              e.event_date ASC, e.created_at DESC`
  ).all()
  return c.json({ ok: true, gatherings: rows.results })
})

gatherings.get('/mine', async (c) => {
  const session = await requireGoogle(c)
  const rows = await c.env.DB.prepare(
    `SELECT e.id, e.title, e.event_date, e.location, e.gathering_state, e.gathering_category,
            e.min_participants, e.formation_deadline, e.arrangement_due_at, e.cancel_reason,
            s.id AS signup_id, s.signup_status, s.transport_mode, s.vehicle_note,
            s.seats_offered, s.assigned_driver_signup_id, s.cancel_type,
            s.attendance_status, s.checked_in, s.token,
            d.name AS driver_name, d.phone AS driver_phone, d.vehicle_note AS driver_vehicle_note
     FROM signups s
     JOIN events e ON e.id = s.event_id
     LEFT JOIN signups d ON d.id = s.assigned_driver_signup_id
     WHERE s.user_id = ? AND e.event_mode = 'gathering'
     ORDER BY e.event_date DESC`
  ).bind(session.id).all()
  return c.json({ ok: true, gatherings: rows.results })
})

// Date-choice gatherings expose independent, idempotent occurrence selections.
gatherings.get('/:id/occurrences', async (c) => {
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare(
    "SELECT id, event_subtype FROM events WHERE id = ? AND event_mode = 'gathering'"
  ).bind(id).first()
  if (!event || event.event_subtype !== 'date_choice') return c.json({ ok: false, message: '选日期组局不存在' }, 404)
  const rows = await c.env.DB.prepare(
    `SELECT o.*, (SELECT COUNT(*) FROM gathering_occurrence_selections s WHERE s.occurrence_id = o.id AND s.status = 'selected') AS selected_count
     FROM gathering_occurrences o WHERE o.event_id = ? ORDER BY o.event_date ASC`
  ).bind(id).all()
  const session = await getOptionalSession(c)
  let selected = []
  if (session) {
    const mine = await c.env.DB.prepare(
      `SELECT s.occurrence_id FROM gathering_occurrence_selections s JOIN signups g ON g.id = s.signup_id
       WHERE g.event_id = ? AND g.user_id = ? AND s.status = 'selected'`
    ).bind(id, session.id).all()
    selected = mine.results.map((row) => Number(row.occurrence_id))
  }
  return c.json({ ok: true, occurrences: rows.results.map((row) => ({ ...row, selected_by_me: selected.includes(Number(row.id)) })) })
})

gatherings.get('/:id/my-selections', async (c) => {
  const session = await requireGoogle(c)
  const id = Number(c.req.param('id'))
  const rows = await c.env.DB.prepare(
    `SELECT o.*, s.status AS selection_status, s.selected_at, s.cancelled_at
     FROM gathering_occurrence_selections s JOIN gathering_occurrences o ON o.id = s.occurrence_id
     JOIN signups g ON g.id = s.signup_id
     WHERE o.event_id = ? AND g.user_id = ? ORDER BY o.event_date`
  ).bind(id, session.id).all()
  return c.json({ ok: true, selections: rows.results })
})

gatherings.post('/:id/occurrences/:occurrenceId/select', async (c) => {
  const session = await requireGoogle(c)
  const eventId = Number(c.req.param('id'))
  const occurrenceId = Number(c.req.param('occurrenceId'))
  const occurrence = await c.env.DB.prepare(
    `SELECT o.*, e.title, e.created_by, e.event_subtype, e.status AS event_status FROM gathering_occurrences o
     JOIN events e ON e.id = o.event_id WHERE o.id = ? AND o.event_id = ?`
  ).bind(occurrenceId, eventId).first()
  if (!occurrence || occurrence.event_subtype !== 'date_choice') return c.json({ ok: false, message: '日期不存在' }, 404)
  if (occurrence.event_status !== 'open') return c.json({ ok: false, message: '该组局未开放报名' }, 400)
  if (!['recruiting', 'confirmed'].includes(occurrence.state) || occurrence.registration_locked_at || Date.now() >= Number(occurrence.formation_deadline)) {
    return c.json({ ok: false, message: '该日期已停止报名' }, 400)
  }
  const count = await c.env.DB.prepare(
    "SELECT COUNT(*) AS c FROM gathering_occurrence_selections WHERE occurrence_id = ? AND status = 'selected'"
  ).bind(occurrenceId).first()
  if (occurrence.max_participants && Number(count?.c || 0) >= Number(occurrence.max_participants)) return c.json({ ok: false, message: '该日期已满员' }, 400)

  const user = await c.env.DB.prepare('SELECT display_name, profile FROM admin_users WHERE id = ?').bind(session.id).first()
  let profile = {}; try { profile = JSON.parse(user?.profile || '{}') } catch {}
  const name = String(profile.name || user?.display_name || session.email.split('@')[0]).trim()
  let signup = await c.env.DB.prepare('SELECT * FROM signups WHERE event_id = ? AND user_id = ?').bind(eventId, session.id).first()
  if (!signup) {
    const result = await c.env.DB.prepare(
      `INSERT INTO signups (event_id, user_id, name, email, data, token, signup_status) VALUES (?, ?, ?, ?, ?, ?, 'joined')`
    ).bind(eventId, session.id, name, session.email, JSON.stringify(profile), crypto.randomUUID()).run()
    signup = await c.env.DB.prepare('SELECT * FROM signups WHERE id = ?').bind(result.meta.last_row_id).first()
  }
  await c.env.DB.prepare(
    `INSERT INTO gathering_occurrence_selections (occurrence_id, signup_id, status, selected_at, cancelled_at)
     VALUES (?, ?, 'selected', ?, NULL)
     ON CONFLICT(occurrence_id, signup_id) DO UPDATE SET status = 'selected', selected_at = excluded.selected_at, cancelled_at = NULL`
  ).bind(occurrenceId, signup.id, Date.now()).run()
  const refreshed = await refreshDateChoiceOccurrence(c.env, occurrenceId)
  const currentOccurrence = refreshed.occurrence || occurrence
  if (currentOccurrence.state === 'confirmed' && !refreshed.transitioned) {
    await safelySyncChat(c.env, { type: 'occurrence', id: occurrenceId }, () => syncOccurrenceChatMembers(c.env, eventForOccurrence(occurrence), currentOccurrence))
  }
  return c.json({ ok: true, occurrence: refreshed.occurrence, selected_count: refreshed.selectedCount, transitioned: refreshed.transitioned })
})

gatherings.delete('/:id/occurrences/:occurrenceId/select', async (c) => {
  const session = await requireGoogle(c)
  const eventId = Number(c.req.param('id')); const occurrenceId = Number(c.req.param('occurrenceId'))
  const occurrence = await c.env.DB.prepare(
    `SELECT o.*, e.status AS event_status FROM gathering_occurrences o
     JOIN events e ON e.id = o.event_id WHERE o.id = ? AND o.event_id = ?`
  ).bind(occurrenceId, eventId).first()
  if (!occurrence) return c.json({ ok: false, message: '日期不存在' }, 404)
  if (occurrence.event_status !== 'open' || occurrence.registration_locked_at || Date.now() >= Number(occurrence.formation_deadline)) {
    return c.json({ ok: false, message: '该日期已锁定，无法修改' }, 400)
  }
  const result = await c.env.DB.prepare(
    `UPDATE gathering_occurrence_selections SET status = 'cancelled', cancelled_at = ?
     WHERE occurrence_id = ? AND status = 'selected' AND signup_id IN (SELECT id FROM signups WHERE event_id = ? AND user_id = ?)`
  ).bind(Date.now(), occurrenceId, eventId, session.id).run()
  if (!result.meta.changes) return c.json({ ok: false, message: '未找到该日期报名' }, 404)
  const refreshed = await refreshDateChoiceOccurrence(c.env, occurrenceId)
  if (occurrence?.chat_group_guid) {
    c.executionCtx.waitUntil(safelySyncChat(c.env, { type: 'occurrence', id: occurrenceId }, () => removeChatMember(c.env, occurrence.chat_group_guid, `account-${session.id}`)))
  }
  return c.json({ ok: true, occurrence: refreshed.occurrence, selected_count: refreshed.selectedCount })
})

gatherings.get('/host-offers/:token', async (c) => {
  const offer = await c.env.DB.prepare(
    `SELECT o.event_id, o.status, o.user_id, u.display_name, u.email,
            e.title, e.event_date, e.location, e.gathering_state, e.created_by,
            selected.display_name AS selected_host_name
     FROM gathering_host_offers o
     JOIN admin_users u ON u.id = o.user_id
     JOIN events e ON e.id = o.event_id
     LEFT JOIN admin_users selected ON selected.id = e.created_by
     WHERE o.accept_token = ?`
  ).bind(c.req.param('token')).first()
  if (!offer) return c.json({ ok: false, message: '接单邀请无效或已过期' }, 404)
  return c.json({ ok: true, offer })
})

gatherings.post('/host-offers/:token/accept', async (c) => {
  const offer = await c.env.DB.prepare(
    `SELECT o.event_id, o.user_id, u.email
     FROM gathering_host_offers o JOIN admin_users u ON u.id = o.user_id
     WHERE o.accept_token = ?`
  ).bind(c.req.param('token')).first()
  if (!offer) return c.json({ ok: false, message: '接单邀请无效或已过期' }, 404)
  const accepted = await acceptGatheringHost(c.env, offer.event_id, offer.user_id, offer.email)
  if (!accepted.ok) {
    const message = accepted.reason === 'already_taken' ? '已有另一位候选主理人接单' : '本次组局已经结束，无法接单'
    return c.json({ ok: false, message }, 409)
  }
  await refreshGatheringState(c.env, offer.event_id)
  return c.json({ ok: true, event_id: offer.event_id, newly_accepted: accepted.newlyAccepted })
})

gatherings.get('/reconfirm/:token', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT s.id AS signup_id, s.name, s.schedule_reconfirm_status, s.schedule_confirmed_revision,
            e.id AS event_id, e.title, e.event_date, e.schedule_revision
     FROM signups s JOIN events e ON e.id = s.event_id WHERE s.schedule_reconfirm_token = ?`
  ).bind(c.req.param('token')).first()
  if (!row) return c.json({ ok: false, message: '确认链接无效，可能已被新安排取代' }, 404)
  return c.json({ ok: true, reconfirm: row })
})

gatherings.post('/reconfirm/:token', async (c) => {
  const token = c.req.param('token'); const body = await c.req.json().catch(() => ({}))
  if (!['keep', 'leave'].includes(body.action)) return c.json({ ok: false, message: '请选择继续参加或退出' }, 400)
  const row = await c.env.DB.prepare(
    `SELECT s.*, e.event_date, e.schedule_revision, e.event_mode, e.event_subtype, e.chat_group_guid
     FROM signups s JOIN events e ON e.id = s.event_id WHERE s.schedule_reconfirm_token = ?`
  ).bind(token).first()
  if (!row || row.event_mode !== 'gathering' || row.event_subtype !== 'scheduled') {
    return c.json({ ok: false, message: '确认链接无效，可能已被新安排取代' }, 404)
  }
  if (body.action === 'keep') {
    await c.env.DB.prepare(
      `UPDATE signups SET schedule_reconfirm_status = 'confirmed', schedule_confirmed_revision = ?, schedule_reconfirm_token = NULL
       WHERE id = ? AND schedule_reconfirm_token = ?`
    ).bind(row.schedule_revision, row.id, token).run()
    await audit(c.env.DB, 'gathering_schedule_reconfirm_keep', 'event', row.event_id, String(row.id), row.email)
  } else {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE signups SET signup_status = 'cancelled', schedule_reconfirm_status = 'declined', schedule_reconfirm_token = NULL,
         cancelled_at = ?, cancel_type = 'schedule_change', cancel_reason = '活动时间变更后无法参加', assigned_driver_signup_id = NULL WHERE id = ?`
      ).bind(Date.now(), row.id),
      c.env.DB.prepare(
        "UPDATE signups SET signup_status = 'ride_pending', assigned_driver_signup_id = NULL WHERE assigned_driver_signup_id = ? AND signup_status = 'ride_assigned'"
      ).bind(row.id),
    ])
    await audit(c.env.DB, 'gathering_schedule_reconfirm_leave', 'event', row.event_id, String(row.id), row.email)
    if (row.chat_group_guid && row.user_id) {
      c.executionCtx.waitUntil(safelySyncChat(c.env, { type: 'event', id: row.event_id }, () => removeChatMember(c.env, row.chat_group_guid, `account-${row.user_id}`)))
    }
  }
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(row.event_id).first()
  await promoteGeneralWaitlist(c.env.DB, event)
  await refreshGatheringState(c.env, row.event_id)
  return c.json({ ok: true, action: body.action, event_id: row.event_id })
})

gatherings.post('/:id/change-schedule', async (c) => {
  const id = Number(c.req.param('id')); const managed = await requireManager(c, id)
  if (managed.error) return managed.error
  if (managed.event.event_subtype !== 'scheduled') return c.json({ ok: false, message: '选日期组局不能修改单一活动时间' }, 400)
  if (!['recruiting', 'arrangement_pending'].includes(managed.event.gathering_state)) return c.json({ ok: false, message: '当前状态不能修改时间' }, 400)
  const body = await c.req.json().catch(() => ({})); const newDate = String(body.event_date || '').trim()
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(newDate)) return c.json({ ok: false, message: '时间格式必须为 YYYY-MM-DD HH:mm' }, 400)
  if (newDate === managed.event.event_date) return c.json({ ok: true, noop: true })
  const signups = await c.env.DB.prepare("SELECT id, name, email FROM signups WHERE event_id = ? AND signup_status != 'cancelled'").bind(id).all()
  const revision = Number(managed.event.schedule_revision || 0) + 1; const now = Date.now()
  const statements = [c.env.DB.prepare(
    `UPDATE events SET event_date = ?, schedule_revision = ?, schedule_changed_at = ?, schedule_changed_by = ?,
     gathering_state = 'recruiting', arrangement_due_at = NULL WHERE id = ?`
  ).bind(newDate, revision, now, managed.session.id, id)]
  const tokens = new Map()
  for (const signup of signups.results) {
    const token = crypto.randomUUID(); tokens.set(signup.id, token)
    statements.push(c.env.DB.prepare(
      "UPDATE signups SET schedule_reconfirm_status = 'pending', schedule_reconfirm_token = ? WHERE id = ?"
    ).bind(token, signup.id))
  }
  await c.env.DB.batch(statements)
  await audit(c.env.DB, 'gathering_schedule_change', 'event', id, JSON.stringify({ field: 'event_date', old_value: managed.event.event_date, new_value: newDate, schedule_revision: revision }), managed.session.email)
  const origin = new URL(c.req.url).origin; const updated = { ...managed.event, event_date: newDate, schedule_revision: revision }
  for (const signup of signups.results) {
    const base = `${origin}/g/${id}/reconfirm?token=${encodeURIComponent(tokens.get(signup.id))}`
    const content = gatheringScheduleChangedEmail(updated, signup, managed.event.event_date, `${base}&action=keep`, `${base}&action=leave`)
    c.executionCtx.waitUntil(sendEmail(c.env, { to: signup.email, ...content }))
  }
  return c.json({ ok: true, schedule_revision: revision, reconfirm_count: signups.results.length })
})

gatherings.get('/:id/history', async (c) => {
  const id = Number(c.req.param('id')); const managed = await requireManager(c, id)
  if (managed.error) return managed.error
  const rows = await c.env.DB.prepare(
    "SELECT id, action, detail, actor, created_at FROM audit_logs WHERE target_type = 'event' AND target_id = ? AND action = 'gathering_schedule_change' ORDER BY created_at DESC"
  ).bind(id).all()
  return c.json({ ok: true, history: rows.results })
})

gatherings.post('/:id/host/step-down', async (c) => {
  const session = await requireGoogle(c); const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare("SELECT * FROM events WHERE id = ? AND event_mode = 'gathering'").bind(id).first()
  if (!event) return c.json({ ok: false, message: '组局不存在' }, 404)
  if (Number(event.created_by) !== Number(session.id)) return c.json({ ok: false, message: '只有当前主理人可以退出担当' }, 403)
  if (!['recruiting', 'arrangement_pending'].includes(event.gathering_state)) return c.json({ ok: false, message: '正式确认后不能自行退出担当' }, 400)
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE events SET created_by = NULL, gathering_state = ?, arrangement_due_at = NULL WHERE id = ?').bind('recruiting', id),
    c.env.DB.prepare("UPDATE gathering_host_offers SET status = 'closed', responded_at = ? WHERE event_id = ? AND user_id = ?").bind(Date.now(), id, session.id),
    c.env.DB.prepare("UPDATE gathering_host_offers SET status = 'pending', responded_at = NULL WHERE event_id = ? AND user_id != ? AND status = 'closed'").bind(id, session.id),
  ])
  await audit(c.env.DB, 'gathering_host_step_down', 'event', id, session.email, session.email)
  if (event.chat_group_guid) {
    c.executionCtx.waitUntil(safelySyncChat(c.env, { type: 'event', id }, () => removeChatMember(c.env, event.chat_group_guid, `account-${session.id}`)))
  }
  return c.json({ ok: true, host_vacant: true })
})

gatherings.get('/:id/manage', async (c) => {
  const id = Number(c.req.param('id'))
  const managed = await requireManager(c, id)
  if (managed.error) return managed.error
  const signups = await c.env.DB.prepare(
    `SELECT s.*, d.name AS assigned_driver_name
     FROM signups s
     LEFT JOIN signups d ON d.id = s.assigned_driver_signup_id
     WHERE s.event_id = ?
     ORDER BY CASE s.signup_status
       WHEN 'ride_pending' THEN 0 WHEN 'general_waitlist' THEN 1 WHEN 'joined' THEN 2
       WHEN 'ride_assigned' THEN 3 ELSE 4 END, s.created_at ASC`
  ).bind(id).all()
  const count = await effectiveSignupCount(c.env.DB, id)
  const hostOffers = await getGatheringHostOffers(c.env.DB, id)
  return c.json({ ok: true, event: managed.event, signups: signups.results, effective_count: count, host_offers: hostOffers,
    is_current_host: Number(managed.event.created_by) === Number(managed.session.id) })
})

gatherings.post('/:id/join', async (c) => {
  const session = await requireGoogle(c)
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare("SELECT * FROM events WHERE id = ? AND event_mode = 'gathering'")
    .bind(id).first()
  if (!event) return c.json({ ok: false, message: '组局不存在' }, 404)
  if (event.status !== 'open' || !['recruiting', 'arrangement_pending', 'confirmed'].includes(event.gathering_state)) {
    return c.json({ ok: false, message: '当前组局已停止参加' }, 400)
  }
  if (event.lock_at !== null && event.lock_at !== undefined) return c.json({ ok: false, message: '主理人已暂停接受新成员' }, 400)
  if (event.formation_deadline && Date.now() >= Number(event.formation_deadline)) {
    return c.json({ ok: false, message: '报名时间已截止' }, 400)
  }
  if (event.gathering_state === 'confirmed' && event.capacity
      && await effectiveSignupCount(c.env.DB, id) >= Number(event.capacity)) {
    return c.json({ ok: false, message: '活动人数已满' }, 400)
  }

  const body = await c.req.json().catch(() => ({}))
  let transportMode = String(body.transport_mode || 'self')
  if (!event.carpool_enabled) transportMode = 'self'
  if (!TRANSPORT_MODES.includes(transportMode)) return c.json({ ok: false, message: '交通方式无效' }, 400)
  const seatsOffered = transportMode === 'driver' ? Number(body.seats_offered || 0) : 0
  if (transportMode === 'driver' && (!Number.isInteger(seatsOffered) || seatsOffered < 1 || seatsOffered > 8)) {
    return c.json({ ok: false, message: '请填写1至8个可搭载座位' }, 400)
  }

  const existing = await c.env.DB.prepare('SELECT * FROM signups WHERE event_id = ? AND (user_id = ? OR email = ?)')
    .bind(id, session.id, session.email).first()
  if (existing && existing.signup_status !== 'cancelled') {
    return c.json({ ok: false, message: '你已经参加了这个组局' }, 400)
  }

  const user = await c.env.DB.prepare('SELECT display_name, profile FROM admin_users WHERE id = ?').bind(session.id).first()
  let profile = {}
  try { profile = JSON.parse(user?.profile || '{}') } catch {}
  const name = String(profile.name || user?.display_name || session.email.split('@')[0]).trim()
  const phone = String(profile.phone_jp || profile.phone_cn || profile.phone || '').trim()
  const token = existing?.token || crypto.randomUUID()
  const vehicleNote = transportMode === 'driver' ? String(body.vehicle_note || '').trim() : ''
  const statusSql = transportMode === 'passenger'
    ? "'ride_pending'"
    : event.capacity
      ? `CASE WHEN (SELECT COUNT(*) FROM signups WHERE event_id = ? AND signup_status IN ('joined', 'ride_assigned')) < ? THEN 'joined' ELSE 'general_waitlist' END`
      : "'joined'"

  let result
  const commonValues = [session.id, name, session.email, phone, JSON.stringify(profile), token, transportMode, vehicleNote, seatsOffered]
  if (existing) {
    const sql = `UPDATE signups SET user_id = ?, name = ?, email = ?, phone = ?, data = ?, token = ?,
      transport_mode = ?, vehicle_note = ?, seats_offered = ?, signup_status = ${statusSql},
      assigned_driver_signup_id = NULL, cancelled_at = NULL, cancel_type = NULL, cancel_reason = NULL,
      attendance_status = 'pending', schedule_reconfirm_status = 'confirmed', schedule_confirmed_revision = ?, schedule_reconfirm_token = NULL
      WHERE id = ?`
    const values = event.capacity && transportMode !== 'passenger'
      ? [...commonValues, id, event.capacity, Number(event.schedule_revision || 0), existing.id]
      : [...commonValues, Number(event.schedule_revision || 0), existing.id]
    result = await c.env.DB.prepare(sql).bind(...values).run()
  } else {
    const sql = `INSERT INTO signups (
      event_id, user_id, name, email, phone, data, token, transport_mode, vehicle_note,
      seats_offered, signup_status, schedule_reconfirm_status, schedule_confirmed_revision
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${statusSql}, 'confirmed', ?)`
    const values = event.capacity && transportMode !== 'passenger'
      ? [id, ...commonValues, id, event.capacity, Number(event.schedule_revision || 0)]
      : [id, ...commonValues, Number(event.schedule_revision || 0)]
    try {
      result = await c.env.DB.prepare(sql).bind(...values).run()
    } catch (error) {
      if (String(error).includes('UNIQUE')) return c.json({ ok: false, message: '你已经参加了这个组局' }, 400)
      throw error
    }
  }

  const signupId = existing?.id || result.meta.last_row_id
  const signup = await c.env.DB.prepare('SELECT * FROM signups WHERE id = ?').bind(signupId).first()
  const hostAcceptance = await acceptGatheringHost(c.env, id, session.id, session.email)
  await refreshGatheringState(c.env, id)
  await audit(c.env.DB, 'gathering_join', 'event', id, `${session.email}：${signup.signup_status}`, session.email)
  await queueConfirmedScheduledChatSync(c, id)
  return c.json({ ok: true, signup, host_accepted: hostAcceptance.ok && hostAcceptance.newlyAccepted })
})

gatherings.post('/:id/cancel', async (c) => {
  const session = await requireGoogle(c)
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare("SELECT * FROM events WHERE id = ? AND event_mode = 'gathering'")
    .bind(id).first()
  if (!event) return c.json({ ok: false, message: '组局不存在' }, 404)
  if (['completed', 'cancelled'].includes(event.gathering_state)) return c.json({ ok: false, message: '活动已结束，无法取消' }, 400)

  const signup = await c.env.DB.prepare(
    "SELECT * FROM signups WHERE event_id = ? AND user_id = ? AND signup_status != 'cancelled'"
  ).bind(id, session.id).first()
  if (!signup) return c.json({ ok: false, message: '未找到参加记录' }, 404)
  if (signup.checked_in) return c.json({ ok: false, message: '已签到，无法取消' }, 400)

  const body = await c.req.json().catch(() => ({}))
  const eventAt = new Date(event.event_date.replace(/\s/, 'T') + '+09:00').getTime()
  const cancelType = eventAt - Date.now() >= 2 * 24 * 60 * 60 * 1000 ? 'in_time' : 'late'

  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE signups SET signup_status = 'cancelled', cancelled_at = ?, cancel_type = ?, cancel_reason = ?, assigned_driver_signup_id = NULL
       WHERE id = ?`
    ).bind(Date.now(), cancelType, String(body.reason || '').trim(), signup.id),
    c.env.DB.prepare(
      "UPDATE signups SET signup_status = 'ride_pending', assigned_driver_signup_id = NULL WHERE assigned_driver_signup_id = ? AND signup_status = 'ride_assigned'"
    ).bind(signup.id),
  ])

  await promoteGeneralWaitlist(c.env.DB, event)
  await refreshGatheringState(c.env, id)
  await audit(c.env.DB, 'gathering_leave', 'event', id, `${session.email}：${cancelType}`, session.email)
  await queueConfirmedScheduledChatSync(c, id)
  return c.json({ ok: true, cancel_type: cancelType })
})

gatherings.post('/:id/carpool/assign', async (c) => {
  const id = Number(c.req.param('id'))
  const managed = await requireManager(c, id)
  if (managed.error) return managed.error
  if (!managed.event.carpool_enabled) return c.json({ ok: false, message: '此活动未启用拼车' }, 400)

  const { passenger_signup_id, driver_signup_id } = await c.req.json()
  const passenger = await c.env.DB.prepare('SELECT * FROM signups WHERE id = ? AND event_id = ?')
    .bind(Number(passenger_signup_id), id).first()
  const driver = await c.env.DB.prepare('SELECT * FROM signups WHERE id = ? AND event_id = ?')
    .bind(Number(driver_signup_id), id).first()
  if (!passenger || passenger.signup_status !== 'ride_pending') return c.json({ ok: false, message: '乘客不在乘车候补中' }, 400)
  if (!driver || driver.transport_mode !== 'driver' || driver.signup_status !== 'joined') {
    return c.json({ ok: false, message: '所选司机状态无效' }, 400)
  }

  const assigned = await c.env.DB.prepare(
    "SELECT COUNT(*) AS c FROM signups WHERE assigned_driver_signup_id = ? AND signup_status = 'ride_assigned'"
  ).bind(driver.id).first()
  if (Number(assigned?.c || 0) >= Number(driver.seats_offered || 0)) return c.json({ ok: false, message: '该司机已没有空余座位' }, 400)
  if (managed.event.capacity) {
    const count = await effectiveSignupCount(c.env.DB, id)
    if (count >= managed.event.capacity) return c.json({ ok: false, message: '活动人数已满' }, 400)
  }

  const result = await c.env.DB.prepare(
    `UPDATE signups SET signup_status = 'ride_assigned', assigned_driver_signup_id = ?
     WHERE id = ? AND event_id = ? AND signup_status = 'ride_pending'
       AND EXISTS (
         SELECT 1 FROM signups d
         WHERE d.id = ? AND d.event_id = ? AND d.transport_mode = 'driver' AND d.signup_status = 'joined'
           AND (SELECT COUNT(*) FROM signups a WHERE a.assigned_driver_signup_id = d.id AND a.signup_status = 'ride_assigned') < d.seats_offered
       )
       AND (? IS NULL OR (SELECT COUNT(*) FROM signups WHERE event_id = ? AND signup_status IN ('joined', 'ride_assigned')) < ?)`
  ).bind(
    driver.id, passenger.id, id, driver.id, id,
    managed.event.capacity || null, id, managed.event.capacity || 0,
  ).run()
  if (!result.meta.changes) return c.json({ ok: false, message: '候补状态已经发生变化，请刷新' }, 409)

  await refreshGatheringState(c.env, id)
  const content = gatheringCarpoolAssignedEmail(managed.event, passenger, driver)
  c.executionCtx.waitUntil(sendEmail(c.env, { to: passenger.email, ...content }))
  await audit(c.env.DB, 'gathering_carpool_assign', 'event', id, `${passenger.name} → ${driver.name}`, managed.session.email)
  await queueConfirmedScheduledChatSync(c, id)
  return c.json({ ok: true })
})

gatherings.post('/:id/carpool/unassign', async (c) => {
  const id = Number(c.req.param('id'))
  const managed = await requireManager(c, id)
  if (managed.error) return managed.error
  const { passenger_signup_id } = await c.req.json()
  const result = await c.env.DB.prepare(
    "UPDATE signups SET signup_status = 'ride_pending', assigned_driver_signup_id = NULL WHERE id = ? AND event_id = ? AND signup_status = 'ride_assigned'"
  ).bind(Number(passenger_signup_id), id).run()
  if (!result.meta.changes) return c.json({ ok: false, message: '未找到已分配的乘客' }, 404)
  await refreshGatheringState(c.env, id)
  await audit(c.env.DB, 'gathering_carpool_unassign', 'event', id, String(passenger_signup_id), managed.session.email)
  await queueConfirmedScheduledChatSync(c, id)
  return c.json({ ok: true })
})

gatherings.post('/:id/finalize', async (c) => {
  const id = Number(c.req.param('id'))
  const managed = await requireManager(c, id)
  if (managed.error) return managed.error
  if (managed.event.gathering_state !== 'arrangement_pending') return c.json({ ok: false, message: '当前状态不能确认安排' }, 400)
  const count = await effectiveSignupCount(c.env.DB, id)
  if (count < Number(managed.event.min_participants || 1)) return c.json({ ok: false, message: '有效人数尚未达到成局要求' }, 400)
  if (managed.event.requires_host && !managed.event.created_by) return c.json({ ok: false, message: '尚无候选主理人接单' }, 400)

  const body = await c.req.json()
  const eventDate = String(body.event_date || managed.event.event_date).trim()
  const location = String(body.location || '').trim()
  const notes = String(body.notes || '').trim()
  if (!eventDate || !location) return c.json({ ok: false, message: '最终时间和地点必填' }, 400)

  const result = await c.env.DB.prepare(
    `UPDATE events SET event_date = ?, location = ?, notes = ?, gathering_state = 'confirmed',
      arrangement_due_at = NULL, arrangement_confirmed_at = ?, arrangement_confirmed_by = ?
     WHERE id = ? AND gathering_state = 'arrangement_pending'
       AND (SELECT COUNT(*) FROM signups WHERE event_id = ? AND signup_status IN ('joined', 'ride_assigned')) >= min_participants`
  ).bind(eventDate, location, notes, Date.now(), managed.session.id, id, id).run()
  if (!result.meta.changes) return c.json({ ok: false, message: '有效人数已经发生变化，请刷新后重试' }, 409)

  const event = { ...managed.event, event_date: eventDate, location, notes, gathering_state: 'confirmed' }
  await safelySyncChat(c.env, { type: 'event', id }, () => syncEventChatMembers(c.env, event))
  const signups = await c.env.DB.prepare(
    "SELECT name, email FROM signups WHERE event_id = ? AND signup_status != 'cancelled'"
  ).bind(id).all()
  for (const signup of signups.results) {
    const content = gatheringFinalizedEmail(event, signup)
    c.executionCtx.waitUntil(sendEmail(c.env, { to: signup.email, ...content }))
  }
  await audit(c.env.DB, 'gathering_finalize', 'event', id, `${eventDate} · ${location}`, managed.session.email)
  return c.json({ ok: true })
})

gatherings.post('/:id/cancel-event', async (c) => {
  const id = Number(c.req.param('id'))
  const managed = await requireManager(c, id)
  if (managed.error) return managed.error
  const body = await c.req.json().catch(() => ({}))
  const reason = String(body.reason || '由主理人或管理员取消').trim()
  await cancelGathering(c.env, managed.event, reason, managed.session.email)
  return c.json({ ok: true })
})

gatherings.post('/:id/start', async (c) => {
  const id = Number(c.req.param('id'))
  const managed = await requireManager(c, id)
  if (managed.error) return managed.error
  if (managed.event.gathering_state !== 'confirmed') return c.json({ ok: false, message: '只有已成局活动可以开始' }, 400)
  await c.env.DB.prepare("UPDATE events SET gathering_state = 'in_progress', status = 'active' WHERE id = ?").bind(id).run()
  return c.json({ ok: true })
})

gatherings.post('/:id/complete', async (c) => {
  const id = Number(c.req.param('id'))
  const managed = await requireManager(c, id)
  if (managed.error) return managed.error
  if (managed.event.gathering_state !== 'in_progress') return c.json({ ok: false, message: '活动尚未开始' }, 400)
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE events SET gathering_state = 'completed', status = 'closed' WHERE id = ?").bind(id),
    c.env.DB.prepare(
      "UPDATE signups SET attendance_status = 'no_show' WHERE event_id = ? AND signup_status IN ('joined', 'ride_assigned') AND checked_in = 0"
    ).bind(id),
  ])
  await audit(c.env.DB, 'gathering_complete', 'event', id, '活动结束并记录未到场成员', managed.session.email)
  return c.json({ ok: true })
})

gatherings.post('/:id/attendance', async (c) => {
  const id = Number(c.req.param('id'))
  const managed = await requireManager(c, id)
  if (managed.error) return managed.error
  const { signup_id, attendance_status } = await c.req.json()
  const allowed = ['pending', 'attended', 'excused', 'no_show']
  if (!allowed.includes(attendance_status)) return c.json({ ok: false, message: '出席状态无效' }, 400)

  const checkedIn = attendance_status === 'attended' ? 1 : 0
  const checkedInAt = attendance_status === 'attended' ? Date.now() : null
  const result = await c.env.DB.prepare(
    `UPDATE signups SET attendance_status = ?, checked_in = ?, checked_in_at = ?
     WHERE id = ? AND event_id = ? AND signup_status IN ('joined', 'ride_assigned')`
  ).bind(attendance_status, checkedIn, checkedInAt, Number(signup_id), id).run()
  if (!result.meta.changes) return c.json({ ok: false, message: '未找到可更新的参加记录' }, 404)
  await audit(c.env.DB, 'gathering_attendance_update', 'event', id, `${signup_id}：${attendance_status}`, managed.session.email)
  return c.json({ ok: true })
})

gatherings.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const event = await c.env.DB.prepare(
    `SELECT e.id, e.title, e.event_date, e.location, e.content, e.notes, e.capacity, e.lock_at,
            e.status, e.image_key, e.event_subtype, e.schedule_revision, e.gathering_state, e.gathering_category,
            e.min_participants, e.formation_deadline, e.arrangement_due_at,
            e.requires_host, e.carpool_enabled, e.cancel_reason,
            u.display_name AS host_name, CASE WHEN e.created_by IS NULL THEN 0 ELSE 1 END AS has_host
     FROM events e LEFT JOIN admin_users u ON u.id = e.created_by
     WHERE e.id = ? AND e.event_mode = 'gathering'`
  ).bind(id).first()
  if (!event) return c.json({ ok: false, message: '组局不存在' }, 404)
  const effectiveCount = await effectiveSignupCount(c.env.DB, id)
  const interest = await c.env.DB.prepare(
    "SELECT COUNT(*) AS c FROM signups WHERE event_id = ? AND signup_status != 'cancelled'"
  ).bind(id).first()
  const session = await getOptionalSession(c)
  let mySignup = null
  let myHostOfferStatus = null
  if (session) {
    mySignup = await c.env.DB.prepare(
      `SELECT s.id, s.signup_status, s.transport_mode, s.vehicle_note, s.seats_offered,
              s.assigned_driver_signup_id, s.cancel_type, s.attendance_status, s.checked_in,
              s.schedule_confirmed_revision, s.schedule_reconfirm_status, s.schedule_reconfirm_token,
              d.name AS driver_name, d.phone AS driver_phone, d.vehicle_note AS driver_vehicle_note
       FROM signups s LEFT JOIN signups d ON d.id = s.assigned_driver_signup_id
       WHERE s.event_id = ? AND s.user_id = ?`
    ).bind(id, session.id).first()
    const hostOffer = await c.env.DB.prepare(
      'SELECT status FROM gathering_host_offers WHERE event_id = ? AND user_id = ?'
    ).bind(id, session.id).first()
    myHostOfferStatus = hostOffer?.status || null
  }
  return c.json({
    ok: true,
    gathering: { ...event, effective_count: effectiveCount, interest_count: Number(interest?.c || 0) },
    my_signup: mySignup,
    my_host_offer_status: myHostOfferStatus,
  })
})

async function promoteGeneralWaitlist(db, event) {
  let count = await effectiveSignupCount(db, event.id)
  for (let i = 0; i < 100; i++) {
    if (event.capacity && count >= event.capacity) break
    const next = await db.prepare(
      `SELECT id, transport_mode FROM signups WHERE event_id = ? AND signup_status = 'general_waitlist'
       AND schedule_reconfirm_status = 'confirmed' AND schedule_confirmed_revision = ? ORDER BY created_at ASC LIMIT 1`
    ).bind(event.id, Number(event.schedule_revision || 0)).first()
    if (!next) break
    const status = next.transport_mode === 'passenger' ? 'ride_pending' : 'joined'
    await db.prepare('UPDATE signups SET signup_status = ? WHERE id = ? AND signup_status = ?')
      .bind(status, next.id, 'general_waitlist').run()
    if (status === 'joined') count++
  }
}

function eventForOccurrence(occurrence) {
  return { id: occurrence.event_id, title: occurrence.title || '', created_by: occurrence.created_by || null }
}

export { gatherings }
