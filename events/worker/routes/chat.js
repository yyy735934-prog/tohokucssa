import { Hono } from 'hono'
import { extractToken, getSession } from '../lib/session.js'
import { canOperateEvent } from '../lib/permissions.js'
import { addChatMember, createCometChatAuthToken, ensureCometChatUser, ensureEventChatGroup, ensureOccurrenceChatGroup, safelySyncChat, syncEventChatMembers, syncOccurrenceChatMembers } from '../lib/cometchat.js'
import { audit } from '../lib/audit.js'

const chat = new Hono()

async function optionalSession(c) {
  const token = extractToken(c.req)
  return token ? getSession(c.env.SESSIONS, token, c.env.DB) : null
}

chat.post('/session', async (c) => {
  const body = await c.req.json().catch(() => ({})); const eventId = Number(body.event_id)
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(eventId).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  let uid; let name; let guid; let scope = 'participant'
  if (event.event_mode === 'standard') {
    const session = await optionalSession(c)
    if (session && await canOperateEvent(c.env.DB, event, session)) {
      uid = `account-${session.id}`; name = session.display_name || session.email; scope = 'moderator'
    } else {
      const signup = await c.env.DB.prepare(
        "SELECT id, name FROM signups WHERE event_id = ? AND chat_access_token = ? AND signup_status != 'cancelled'"
      ).bind(eventId, String(body.chat_access_token || '')).first()
      if (!signup) return c.json({ ok: false, message: '群聊访问凭据无效' }, 403)
      uid = `signup-${signup.id}`; name = signup.name
    }
    guid = await ensureEventChatGroup(c.env, event)
  } else {
    const session = await optionalSession(c)
    if (!session) return c.json({ ok: false, message: '请先登录' }, 401)
    uid = `account-${session.id}`; name = session.display_name || session.email
    if (event.event_subtype === 'date_choice') {
      const occurrence = await c.env.DB.prepare(
        `SELECT o.* FROM gathering_occurrences o WHERE o.id = ? AND o.event_id = ? AND o.state = 'confirmed'`
      ).bind(Number(body.occurrence_id), eventId).first()
      if (!occurrence) return c.json({ ok: false, message: '该日期尚未成局' }, 403)
      const allowed = await c.env.DB.prepare(
        `SELECT 1 AS allowed FROM gathering_occurrence_selections os JOIN signups s ON s.id = os.signup_id
         WHERE os.occurrence_id = ? AND os.status = 'selected' AND s.user_id = ?`
      ).bind(occurrence.id, session.id).first()
      const manager = await canOperateEvent(c.env.DB, event, session)
      if (!allowed && !manager) return c.json({ ok: false, message: '你不是该日期的成员' }, 403)
      if (manager) scope = 'moderator'
      guid = await ensureOccurrenceChatGroup(c.env, event, occurrence)
    } else {
      if (event.gathering_state !== 'confirmed' && event.gathering_state !== 'in_progress') return c.json({ ok: false, message: '活动尚未成局' }, 403)
      const signup = await c.env.DB.prepare(
        "SELECT 1 AS allowed FROM signups WHERE event_id = ? AND user_id = ? AND signup_status IN ('joined', 'ride_assigned')"
      ).bind(eventId, session.id).first()
      const manager = await canOperateEvent(c.env.DB, event, session)
      if (!signup && !manager) return c.json({ ok: false, message: '你不是活动成员' }, 403)
      if (manager) scope = 'moderator'
      guid = await ensureEventChatGroup(c.env, event)
    }
  }
  await ensureCometChatUser(c.env, uid, name); await addChatMember(c.env, guid, uid, scope)
  const authToken = await createCometChatAuthToken(c.env, uid)
  return c.json({ ok: true, app_id: c.env.COMETCHAT_APP_ID, region: c.env.COMETCHAT_REGION, uid, auth_token: authToken, guid })
})

chat.post('/events/:id/sync', async (c) => {
  const session = await optionalSession(c); if (!session || session.role !== 'reviewer') return c.json({ ok: false, message: '仅管理员可同步群聊' }, 403)
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(Number(c.req.param('id'))).first()
  if (!event) return c.json({ ok: false, message: '活动不存在' }, 404)
  if (event.event_mode === 'gathering' && event.event_subtype === 'date_choice') {
    return c.json({ ok: false, message: '选日期组局必须按具体场次同步，不能为 parent event 建永久群' }, 400)
  }
  if (event.event_mode === 'standard' && ['draft', 'pending'].includes(event.status)) {
    return c.json({ ok: false, message: '正式活动尚未开放，不应创建活动群' }, 409)
  }
  if (event.event_mode === 'gathering' && !['confirmed', 'in_progress', 'completed'].includes(event.gathering_state)) {
    return c.json({ ok: false, message: '定日期组局尚未成局，不应创建活动群' }, 409)
  }
  const result = await safelySyncChat(c.env, { type: 'event', id: event.id }, () => syncEventChatMembers(c.env, event))
  await audit(c.env.DB, 'chat_sync', 'event', event.id, JSON.stringify(result), session.email)
  return c.json({ ok: result.ok, ...result }, result.ok ? 200 : 502)
})

chat.post('/occurrences/:id/sync', async (c) => {
  const session = await optionalSession(c)
  if (!session || session.role !== 'reviewer') return c.json({ ok: false, message: '仅审核员可同步' }, 403)
  const occurrence = await c.env.DB.prepare(
    `SELECT o.*, e.title, e.created_by, e.event_mode, e.event_subtype
     FROM gathering_occurrences o JOIN events e ON e.id = o.event_id WHERE o.id = ?`
  ).bind(Number(c.req.param('id'))).first()
  if (!occurrence || occurrence.event_subtype !== 'date_choice') return c.json({ ok: false, message: '场次不存在' }, 404)
  if (!['confirmed', 'in_progress', 'completed'].includes(occurrence.state)) return c.json({ ok: false, message: '该场次尚未成局，不应创建群聊' }, 409)
  const parentEvent = { id: occurrence.event_id, title: occurrence.title, created_by: occurrence.created_by, event_mode: occurrence.event_mode, event_subtype: occurrence.event_subtype }
  const result = await safelySyncChat(c.env, { type: 'occurrence', id: occurrence.id }, () => syncOccurrenceChatMembers(c.env, parentEvent, occurrence))
  await audit(c.env.DB, 'chat_sync', 'occurrence', occurrence.id, JSON.stringify(result), session.email)
  return c.json({ ...result })
})

export { chat }
