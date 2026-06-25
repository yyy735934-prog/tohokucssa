import { sendEmail, eventReminderEmail } from './lib/email.js'
import { audit } from './lib/audit.js'

const ORIGIN = 'https://events.tohokucssa.org'

export async function handleScheduled(env) {
  await closeExpiredEvents(env)
  await sendEventReminders(env)
}

async function closeExpiredEvents(env) {
  const now = new Date()
  const jstNow = new Date(now.getTime() + 9 * 3600 * 1000)
  const todayStr = jstNow.toISOString().slice(0, 10)

  const expired = await env.DB.prepare(
    "SELECT id, title, event_date FROM events WHERE status IN ('open', 'active') AND event_date < ?"
  ).bind(todayStr).all()

  for (const e of expired.results) {
    await env.DB.prepare('UPDATE events SET status = ? WHERE id = ?').bind('closed', e.id).run()
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
    "SELECT * FROM events WHERE status IN ('open', 'active') AND event_date LIKE ?"
  ).bind(`${tomorrowStr}%`).all()

  if (!events.results.length) {
    console.log(`[cron] No events for ${tomorrowStr}`)
    return
  }

  for (const event of events.results) {
    const signups = await env.DB.prepare(
      'SELECT name, email, phone, data, token FROM signups WHERE event_id = ?'
    ).bind(event.id).all()

    console.log(`[cron] Event "${event.title}" (${tomorrowStr}): ${signups.results.length} participants`)

    for (const signup of signups.results) {
      const content = eventReminderEmail(event, signup, ORIGIN)
      await sendEmail(env, { to: signup.email, ...content })
    }
  }
}
