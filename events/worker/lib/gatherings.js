import {
  sendEmail,
  gatheringNeedsArrangementEmail,
  gatheringCancelledEmail,
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

export async function refreshGatheringState(env, eventId) {
  const event = await env.DB.prepare(
    "SELECT * FROM events WHERE id = ? AND event_mode = 'gathering'"
  ).bind(eventId).first()
  if (!event || ['confirmed', 'in_progress', 'completed', 'cancelled'].includes(event.gathering_state)) {
    return { event, transitioned: false, effectiveCount: event ? await effectiveSignupCount(env.DB, eventId) : 0 }
  }

  const count = await effectiveSignupCount(env.DB, eventId)
  const minimum = Number(event.min_participants || 1)

  if (event.gathering_state === 'recruiting' && count >= minimum) {
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

  if (event.gathering_state === 'arrangement_pending' && count < minimum) {
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

export async function createGatheringFromTemplate(env, template, timestamp = Date.now()) {
  const schedule = templateSchedule(template, timestamp)
  if (timestamp < schedule.publishAt || timestamp >= schedule.decisionAt) return null

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
    template.host_user_id || null,
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
  await recordJob(env.DB, 'weekly_publish', { templateId: template.id, eventId, weekKey: schedule.weekKey, detail: title })
  await audit(env.DB, 'gathering_auto_publish', 'event', eventId, `由模板「${template.name}」自动发布`, 'system')
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
      if (count < Number(current.min_participants || 1)) {
        const reason = `截至成局时间有效人数为 ${count} 人，未达到最低 ${current.min_participants} 人`
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
  let recipients
  if (event.created_by) {
    recipients = await env.DB.prepare('SELECT id, email FROM admin_users WHERE id = ?').bind(event.created_by).all()
  } else {
    recipients = await env.DB.prepare("SELECT id, email FROM admin_users WHERE role = 'reviewer'").all()
  }
  for (const user of recipients.results) {
    await env.DB.prepare(
      `INSERT INTO notifications (user_id, type, title, body, event_id)
       VALUES (?, 'gathering_published', '本周组局已发布', ?, ?)`
    ).bind(user.id, `「${event.title}」已开放参加`, event.id).run()
  }
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
