import { sendEmail, eventReminderEmail } from './lib/email.js'
import { audit } from './lib/audit.js'
import { runGatheringAutomation, jstParts } from './lib/gatherings.js'

const ORIGIN = 'https://events.tohokucssa.org'

export async function handleScheduled(env, scheduledTime = Date.now()) {
  await runGatheringAutomation(env, scheduledTime)

  // The worker now runs frequently so templates can use custom times.
  // Preserve the original daily jobs at 09:00 JST only.
  const currentJst = jstParts(scheduledTime)
  if (currentJst.hour === 9 && currentJst.minute === 0) {
    await closeExpiredEvents(env)
    await sendEventReminders(env)
  }
}

async function closeExpiredEvents(env) {
  const now = new Date()
  const jstNow = new Date(now.getTime() + 9 * 3600 * 1000)
  const todayStr = jstNow.toISOString().slice(0, 10)

  const expired = await env.DB.prepare(
    "SELECT id, title, event_date, event_mode, event_subtype FROM events WHERE status IN ('open', 'active') AND event_date < ? AND NOT (event_mode = 'gathering' AND event_subtype = 'date_choice')"
  ).bind(todayStr).all()

  for (const e of expired.results) {
    const statements = [env.DB.prepare(
      "UPDATE events SET status = 'closed', gathering_state = CASE WHEN event_mode = 'gathering' THEN 'completed' ELSE gathering_state END WHERE id = ?"
    ).bind(e.id)]
    if (e.event_mode === 'gathering') {
      statements.push(env.DB.prepare(
        "UPDATE signups SET attendance_status = 'no_show' WHERE event_id = ? AND signup_status IN ('joined', 'ride_assigned') AND checked_in = 0"
      ).bind(e.id))
    }
    await env.DB.batch(statements)
    await audit(env.DB, 'auto_close', 'event', e.id, `活动「${e.title}」已过期，自动关闭`, 'system')
    console.log(`[cron] Auto-closed expired event: "${e.title}" (${e.event_date})`)
  }
}

// Find events happening tomorrow (JST) and send reminders with check-in codes
async function sendEventReminders(env) {
  const now = new Date()
  // JST = UTC+9
  const jstNow = new Date(now.getTime() + 9 * 3600 * 1000)
  const tomorrow = new Date(jstNow)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10) // "YYYY-MM-DD"

  // event_date is stored as text like "2026-07-15 14:00" — match by date prefix
  const events = await env.DB.prepare(
    `SELECT * FROM events
     WHERE status IN ('open', 'active')
       AND event_date LIKE ?
       AND (COALESCE(event_mode, 'standard') != 'gathering' OR gathering_state IN ('confirmed', 'in_progress'))`
  ).bind(`${tomorrowStr}%`).all()

  if (!events.results.length) {
    console.log(`[cron] No events for ${tomorrowStr}`)
    return
  }

  for (const event of events.results) {
    const signups = await env.DB.prepare(
      `SELECT name, email, phone, data, token FROM signups
       WHERE event_id = ?
         AND (COALESCE(?, 'standard') != 'gathering' OR signup_status IN ('joined', 'ride_assigned'))`
    ).bind(event.id, event.event_mode).all()

    console.log(`[cron] Event "${event.title}" (${tomorrowStr}): ${signups.results.length} participants`)

    for (const signup of signups.results) {
      const content = eventReminderEmail(event, signup, ORIGIN)
      await sendEmail(env, { to: signup.email, ...content })
    }
  }
}
