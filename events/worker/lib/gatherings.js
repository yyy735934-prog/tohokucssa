import {
  sendEmail,
  gatheringNeedsArrangementEmail,
  gatheringCancelledEmail,
  gatheringHostOfferEmail,
} from './email.js'
import { audit } from './audit.js'

export const GATHERING_CATEGORIES = ['karaoke', 'sport', 'outdoor', 'salon', 'boardgame', 'movie', 'other']
export const GATHERING_STATES = ['recruiting', 'arrangement_pending', 'confirmed', 'in_progress', 'completed', 'cancelled']
export const TRANSPORT_MODES = ['self', 'driver', 'passenger', 'public_transport']
export const ACTIVE_SIGNUP_STATUSES = ['joined', 'ride_pending', 'ride_assigned', 'general_waitlist']
export const EFFECTIVE_SIGNUP_STATUSES = ['joined', 'ride_assigned']

const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export function jstParts(timestamp = Date.now()) {
  const date = new Date(timestamp + JST_OFFSET_MS)
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    weekday: date.getUTCDay() || 7,
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
  }
}

export function jstWeekStart(timestamp = Date.now()) {
  const date = new Date(timestamp + JST_OFFSET_MS)
  const weekday = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() - weekday + 1)
  date.setUTCHours(0, 0, 0, 0)
  return date.getTime() - JST_OFFSET_MS
}

export function isoWeekKey(timestamp = Date.now()) {
  const date = new Date(timestamp + JST_OFFSET_MS)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((date - yearStart) / DAY_MS) + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function scheduledTimestamp(weekStart, weekday, time) {
  const [hour, minute] = parseTime(time)
  return weekStart + (Number(weekday) - 1) * DAY_MS + hour * 60 * 60 * 1000 + minute * 60 * 1000
}

export function templateSchedule(template, timestamp = Date.now()) {
  const weekStart = jstWeekStart(timestamp)
  return {
    weekKey: isoWeekKey(timestamp),
    publishAt: scheduledTimestamp(weekStart, template.publish_weekday, template.publish_time),
    decisionAt: scheduledTimestamp(weekStart, template.decision_weekday, template.decision_time),
    eventAt: scheduledTimestamp(weekStart, template.event_weekday, template.event_time),
  }
}

export function formatJstDateTime(timestamp) {
  if (!timestamp) return ''
  return new Date(timestamp + JST_OFFSET_MS).toISOString().slice(0, 16).replace('T', ' ')
}

export function isValidClock(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

export async function effectiveSignupCount(db, eventId) {
  const row = await db.prepare(
    "SELECT COUNT(*) AS c FROM signups WHERE event_id = ? AND signup_status IN ('joined', 'ride_assigned')"
  ).bind(eventId).first()
  return Number(row?.c || 0)
}

export function formationRequirementsMet(event, effectiveCount) {
  return Number(effectiveCount) >= Number(event.min_participants || 1)
    && (!event.requires_host || !!event.created_by)
}

export async function refreshGatheringState(env, eventId) {
  const event = await env.DB.prepare(
    "SELECT * FROM events WHERE id = ? AND event_mode = 'gathering'"
  ).bind(eventId).first()
  if (!event || ['confirmed', 'in_progress', 'completed', 'cancelled'].includes(event.gathering_state)) {
    return { event, transitioned: false, effectiveCount: event ? await effectiveSignupCount(env.DB, eventId) : 0 }
  }

  const count = await effectiveSignupCount(env.DB, eventId)
  const minimum = Number(event.min_participants || 1)
  const hasArrangementOwner = !event.requires_host || !!event.created_by

  if (event.gathering_state === 'recruiting' && formationRequirementsMet(event, count)) {
    const dueAt = Date.now() + 12 * 60 * 60 * 1000
    const result = await env.DB.prepare(
      "UPDATE events SET gathering_state = 'arrangement_pending', arrangement_due_at = ?, admin_takeover_at = NULL WHERE id = ? AND gathering_state = 'recruiting'"
    ).bind(dueAt, eventId).run()
    if (result.meta.changes) {
      const updated = { ...event, gathering_state: 'arrangement_pending', arrangement_due_at: dueAt }
      await notifyArrangementOwner(env, updated, false)
      await audit(env.DB, 'gathering_threshold_reached', 'event', eventId, `有效人数达到 ${count}/${minimum}`, 'system')
      return { event: updated, transitioned: true, effectiveCount: count }
    }
  }

  if (event.gathering_state === 'arrangement_pending' && (count < minimum || !hasArrangementOwner)) {
    const result = await env.DB.prepare(
      "UPDATE events SET gathering_state = 'recruiting', arrangement_due_at = NULL, admin_takeover_at = NULL WHERE id = ? AND gathering_state = 'arrangement_pending'"
    ).bind(eventId).run()
    if (result.meta.changes) {
      await audit(env.DB, 'gathering_below_threshold', 'event', eventId, `有效人数降至 ${count}/${minimum}`, 'system')
      return { event: { ...event, gathering_state: 'recruiting', arrangement_due_at: null }, transitioned: true, effectiveCount: count }
    }
  }

  return { event, transitioned: false, effectiveCount: count }
}

export async function createGatheringFromTemplate(env, template, timestamp = Date.now(), options = {}) {
  const { force = false, jobType = 'weekly_publish', actor = 'system' } = options
  const schedule = templateSchedule(template, timestamp)
  if (!force && (timestamp < schedule.publishAt || timestamp >= schedule.decisionAt)) return null

  const title = renderTitle(template, schedule.eventAt)
  const eventDate = formatJstDateTime(schedule.eventAt)
  const location = (template.default_location || template.region || '').trim()
  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO events (
      title, event_date, location, content, notes, capacity, status, activity_type,
      created_by, submitted_at, reviewed_at, event_mode, gathering_state,
      gathering_category, template_id, week_key, min_participants,
      formation_deadline, requires_host, carpool_enabled
    ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, 'gathering', 'recruiting', ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    title,
    eventDate,
    location,
    template.description || '',
    template.notes || '',
    template.max_participants || null,
    `gathering-${template.category}`,
    null,
    timestamp,
    timestamp,
    template.category,
    template.id,
    schedule.weekKey,
    template.min_participants,
    schedule.decisionAt,
    template.requires_host ? 1 : 0,
    template.carpool_enabled ? 1 : 0,
  ).run()

  if (!result.meta.changes) return null

  const eventId = result.meta.last_row_id
  const event = await env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(eventId).first()
  await createHostOffers(env.DB, eventId, template.id, template.host_user_id)
  await recordJob(env.DB, jobType, { templateId: template.id, eventId, weekKey: schedule.weekKey, detail: title })
  await audit(
    env.DB,
    force ? 'gathering_manual_publish' : 'gathering_auto_publish',
    'event',
    eventId,
    `由模板「${template.name}」${force ? '立即生成' : '自动发布'}`,
    actor,
  )
  await notifyPublished(env, event)
  return event
}

export async function cancelGathering(env, event, reason, actor = 'system') {
  const result = await env.DB.prepare(
    `UPDATE events
     SET gathering_state = 'cancelled', status = 'closed', cancel_reason = ?, cancelled_at = ?, arrangement_due_at = NULL
     WHERE id = ? AND event_mode = 'gathering' AND gathering_state != 'cancelled'`
  ).bind(reason, Date.now(), event.id).run()
  if (!result.meta.changes) return false

  const signups = await env.DB.prepare(
    "SELECT name, email FROM signups WHERE event_id = ? AND signup_status != 'cancelled'"
  ).bind(event.id).all()
  await Promise.all(signups.results.map((signup) =>
    sendEmail(env, { to: signup.email, ...gatheringCancelledEmail(event, signup, reason) })
  ))
  await audit(env.DB, 'gathering_cancel', 'event', event.id, reason, actor)
  return true
}

export async function runGatheringAutomation(env, timestamp = Date.now()) {
  const templates = await env.DB.prepare(
    "SELECT * FROM gathering_templates WHERE approval_status = 'approved'"
  ).all()

  for (const template of templates.results) {
    try {
      await createGatheringFromTemplate(env, template, timestamp)
    } catch (error) {
      await recordJob(env.DB, 'weekly_publish', {
        templateId: template.id,
        weekKey: isoWeekKey(timestamp),
        status: 'failed',
        detail: error instanceof Error ? error.message : String(error),
      })
      console.error(JSON.stringify({ message: 'gathering publish failed', templateId: template.id, error: String(error) }))
    }
  }

  const events = await env.DB.prepare(
    `SELECT * FROM events
     WHERE event_mode = 'gathering'
       AND gathering_state IN ('recruiting', 'arrangement_pending')`
  ).all()

  for (const event of events.results) {
    const refreshed = await refreshGatheringState(env, event.id)
    const current = refreshed.event || event
    if (current.gathering_state === 'recruiting' && current.formation_deadline && timestamp >= current.formation_deadline) {
      const count = await effectiveSignupCount(env.DB, current.id)
      const missingHost = !!current.requires_host && !current.created_by
      if (count < Number(current.min_participants || 1) || missingHost) {
        const reason = missingHost && count >= Number(current.min_participants || 1)
          ? '截至成局时间仍没有候选主理人接单'
          : `截至成局时间有效人数为 ${count} 人，未达到最低 ${current.min_participants} 人`
        if (await cancelGathering(env, current, reason)) {
          await recordJob(env.DB, 'formation_deadline', { eventId: current.id, weekKey: current.week_key, detail: reason })
        }
      }
      continue
    }

    if (current.gathering_state === 'arrangement_pending' && current.arrangement_due_at && timestamp >= current.arrangement_due_at) {
      if (current.requires_host) {
        const reason = '人数达标后主理人未在 12 小时内确认最终安排'
        if (await cancelGathering(env, current, reason)) {
          await recordJob(env.DB, 'arrangement_timeout', { eventId: current.id, weekKey: current.week_key, detail: reason })
        }
      } else {
        const result = await env.DB.prepare(
          'UPDATE events SET arrangement_due_at = NULL, admin_takeover_at = ? WHERE id = ? AND arrangement_due_at IS NOT NULL'
        ).bind(timestamp, current.id).run()
        if (result.meta.changes) {
          const updated = { ...current, arrangement_due_at: null, admin_takeover_at: timestamp }
          await notifyArrangementOwner(env, updated, true)
          await recordJob(env.DB, 'admin_takeover', { eventId: current.id, weekKey: current.week_key, detail: '已转交管理员确认' })
          await audit(env.DB, 'gathering_admin_takeover', 'event', current.id, '主理人确认超时，已转交管理员', 'system')
        }
      }
    }
  }
}

export async function recordJob(db, jobType, {
  templateId = null,
  eventId = null,
  weekKey = null,
  status = 'succeeded',
  detail = '',
} = {}) {
  const now = Date.now()
  await db.prepare(
    `INSERT INTO gathering_jobs (job_type, template_id, event_id, week_key, status, detail, started_at, finished_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(jobType, templateId, eventId, weekKey, status, detail, now, now).run()
}

async function notifyArrangementOwner(env, event, adminTakeover) {
  const dueText = event.arrangement_due_at ? formatJstDateTime(event.arrangement_due_at) : ''
  let recipients
  if (!adminTakeover && event.created_by) {
    recipients = await env.DB.prepare('SELECT id, email, display_name FROM admin_users WHERE id = ?')
      .bind(event.created_by).all()
  } else {
    recipients = await env.DB.prepare("SELECT id, email, display_name FROM admin_users WHERE role = 'reviewer'").all()
  }

  for (const user of recipients.results) {
    await env.DB.prepare(
      `INSERT INTO notifications (user_id, type, title, body, event_id)
       VALUES (?, 'gathering_arrangement', ?, ?, ?)`
    ).bind(
      user.id,
      adminTakeover ? '组局需要管理员接管' : '组局已达标',
      `「${event.title}」等待确认最终安排`,
      event.id,
    ).run()
    const content = gatheringNeedsArrangementEmail(event, user.display_name || user.email, dueText, adminTakeover)
    await sendEmail(env, { to: user.email, ...content })
  }
}

async function notifyPublished(env, event) {
  let recipients = await env.DB.prepare(
    `SELECT u.id, u.email, u.display_name, o.accept_token
     FROM gathering_host_offers o JOIN admin_users u ON u.id = o.user_id
     WHERE o.event_id = ? AND o.status = 'pending'`
  ).bind(event.id).all()
  if (!recipients.results.length && !event.requires_host) {
    recipients = await env.DB.prepare("SELECT id, email, display_name, NULL AS accept_token FROM admin_users WHERE role = 'reviewer'").all()
  }
  for (const user of recipients.results) {
    await env.DB.prepare(
      `INSERT INTO notifications (user_id, type, title, body, event_id)
       VALUES (?, 'gathering_published', '本周组局已发布', ?, ?)`
    ).bind(user.id, `「${event.title}」已开放参加`, event.id).run()
    if (user.accept_token) {
      const acceptUrl = `https://events.tohokucssa.org/g/${event.id}/host-offer?token=${encodeURIComponent(user.accept_token)}`
      await sendEmail(env, { to: user.email, ...gatheringHostOfferEmail(event, user.display_name || user.email, acceptUrl) })
    }
  }
}

export async function getGatheringHostOffers(db, eventId) {
  const rows = await db.prepare(
    `SELECT o.user_id, o.status, o.responded_at, u.display_name, u.email
     FROM gathering_host_offers o JOIN admin_users u ON u.id = o.user_id
     WHERE o.event_id = ? ORDER BY CASE o.status WHEN 'accepted' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, o.created_at`
  ).bind(eventId).all()
  return rows.results
}

export async function acceptGatheringHost(env, eventId, userId, actor = 'system') {
  const offer = await env.DB.prepare(
    'SELECT status FROM gathering_host_offers WHERE event_id = ? AND user_id = ?'
  ).bind(eventId, userId).first()
  if (!offer) return { ok: false, reason: 'not_candidate' }

  const event = await env.DB.prepare(
    "SELECT id, title, created_by, gathering_state FROM events WHERE id = ? AND event_mode = 'gathering'"
  ).bind(eventId).first()
  if (!event || ['completed', 'cancelled'].includes(event.gathering_state)) return { ok: false, reason: 'closed' }
  if (event.created_by && Number(event.created_by) !== Number(userId)) return { ok: false, reason: 'already_taken' }

  const now = Date.now()
  const claimed = event.created_by
    ? { meta: { changes: 0 } }
    : await env.DB.prepare(
      "UPDATE events SET created_by = ? WHERE id = ? AND created_by IS NULL AND gathering_state NOT IN ('completed', 'cancelled')"
    ).bind(userId, eventId).run()
  const current = await env.DB.prepare('SELECT created_by FROM events WHERE id = ?').bind(eventId).first()
  if (Number(current?.created_by) !== Number(userId)) return { ok: false, reason: 'already_taken' }

  await env.DB.batch([
    env.DB.prepare(
      "UPDATE gathering_host_offers SET status = 'accepted', responded_at = ? WHERE event_id = ? AND user_id = ?"
    ).bind(now, eventId, userId),
    env.DB.prepare(
      "UPDATE gathering_host_offers SET status = 'closed', responded_at = ? WHERE event_id = ? AND user_id != ? AND status = 'pending'"
    ).bind(now, eventId, userId),
  ])
  if (claimed.meta.changes) {
    await audit(env.DB, 'gathering_host_accepted', 'event', eventId, `候选主理人已接单：${actor}`, actor)
  }
  return { ok: true, newlyAccepted: !!claimed.meta.changes }
}

async function createHostOffers(db, eventId, templateId, legacyHostUserId) {
  const candidates = await db.prepare(
    `SELECT user_id FROM gathering_template_hosts WHERE template_id = ?
     UNION SELECT ? AS user_id WHERE ? IS NOT NULL`
  ).bind(templateId, legacyHostUserId || null, legacyHostUserId || null).all()
  if (!candidates.results.length) return
  await db.batch(candidates.results.map(({ user_id }) => db.prepare(
    `INSERT OR IGNORE INTO gathering_host_offers (event_id, user_id, accept_token)
     VALUES (?, ?, ?)`
  ).bind(eventId, user_id, crypto.randomUUID())))
}

function parseTime(value) {
  if (!isValidClock(value)) throw new Error(`无效时间：${value}`)
  return value.split(':').map(Number)
}

function renderTitle(template, eventAt) {
  const date = formatJstDateTime(eventAt).slice(5, 10).replace('-', '/')
  return String(template.title_template || template.name)
    .replaceAll('{date}', date)
    .replaceAll('{sport}', template.sport_name || '运动')
}
