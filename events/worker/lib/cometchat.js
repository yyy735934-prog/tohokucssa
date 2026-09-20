import { audit } from './audit.js'

function configured(env) {
  return !!(env.COMETCHAT_APP_ID && env.COMETCHAT_REGION && env.COMETCHAT_REST_API_KEY)
}

function isAlreadyMemberError(error) {
  const code = String(error?.code || '')
  const message = String(error?.message || '')
  return error?.status === 409
    || /ALREADY.*(?:MEMBER|JOINED)/i.test(code)
    || /already\s+(?:a\s+)?member|already\s+joined|already\s+part\s+of|member\s+already\s+has\s+the\s+same\s+scope/i.test(message)
}

export async function cometChatRequest(env, path, { method = 'GET', body } = {}) {
  if (!configured(env)) throw new Error('CometChat 尚未配置')
  const response = await fetch(`https://${env.COMETCHAT_APP_ID}.api-${env.COMETCHAT_REGION}.cometchat.io/v3${path}`, {
    method,
    headers: { 'content-type': 'application/json', apikey: env.COMETCHAT_REST_API_KEY },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload?.error?.message || payload?.message || `CometChat HTTP ${response.status}`)
    error.status = response.status; error.code = payload?.error?.code
    throw error
  }
  return payload.data ?? payload
}

export async function ensureCometChatUser(env, uid, name) {
  try { return await cometChatRequest(env, `/users/${encodeURIComponent(uid)}`) } catch (error) {
    if (error.status !== 404) throw error
  }
  return cometChatRequest(env, '/users', { method: 'POST', body: { uid, name: String(name || uid).slice(0, 100) } })
}

async function ensureGroup(env, guid, name) {
  try { return await cometChatRequest(env, `/groups/${encodeURIComponent(guid)}`) } catch (error) {
    if (error.status !== 404) throw error
  }
  return cometChatRequest(env, '/groups', { method: 'POST', body: { guid, name: String(name || guid).slice(0, 100), type: 'private' } })
}

export async function ensureEventChatGroup(env, event) {
  const guid = `event-${event.id}`
  await ensureGroup(env, guid, event.title)
  if (!event.chat_group_created_at) {
    await env.DB.prepare('UPDATE events SET chat_group_guid = ?, chat_group_created_at = ? WHERE id = ?')
      .bind(guid, Date.now(), event.id).run()
    await audit(env.DB, 'chat_group_create', 'event', event.id, guid, 'system')
  }
  return guid
}

export async function ensureOccurrenceChatGroup(env, event, occurrence) {
  const guid = `event-${event.id}-occ-${occurrence.id}`
  await ensureGroup(env, guid, `${event.title} ${occurrence.event_date}`)
  if (!occurrence.chat_group_created_at) {
    await env.DB.prepare('UPDATE gathering_occurrences SET chat_group_guid = ?, chat_group_created_at = ?, updated_at = ? WHERE id = ?')
      .bind(guid, Date.now(), Date.now(), occurrence.id).run()
    await audit(env.DB, 'chat_group_create', 'occurrence', occurrence.id, guid, 'system')
  }
  return guid
}

export async function addChatMember(env, guid, uid, scope = 'participant') {
  const key = scope === 'moderator' ? 'moderators' : 'participants'
  let data
  try {
    data = await cometChatRequest(env, `/groups/${encodeURIComponent(guid)}/members`, {
      method: 'POST', body: { [key]: [uid] },
    })
    const memberResult = data?.[key]?.[uid]
    if (memberResult?.success === false) {
      const detail = memberResult?.error?.message || memberResult?.message || memberResult?.error || 'unknown error'
      const error = new Error(`CometChat add member failed for ${uid}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`)
      error.code = memberResult?.error?.code
      throw error
    }
  } catch (error) {
    if (!isAlreadyMemberError(error)) throw error
    data = { already_member: true }
  }
  await audit(env.DB, 'chat_member_add', 'chat_group', null, `${guid}:${uid}:${scope}`, 'system')
  return data
}

export async function removeChatMember(env, guid, uid) {
  try { await cometChatRequest(env, `/groups/${encodeURIComponent(guid)}/members/${encodeURIComponent(uid)}`, { method: 'DELETE' }) } catch (error) {
    if (error.status !== 404) throw error
  }
  await audit(env.DB, 'chat_member_remove', 'chat_group', null, `${guid}:${uid}`, 'system')
}

async function listAllGroupMembers(env, guid) {
  const members = []
  const perPage = 1000
  for (let page = 1; page <= 100; page++) {
    const data = await cometChatRequest(
      env,
      `/groups/${encodeURIComponent(guid)}/members?perPage=${perPage}&page=${page}`,
    )
    const batch = Array.isArray(data) ? data : (data?.members || [])
    members.push(...batch)
    if (batch.length < perPage) break
  }
  return members
}

async function reconcileGroupMembers(env, guid, desiredMembers) {
  const desired = new Map(desiredMembers.map((member) => [member.uid, member]))
  const current = await listAllGroupMembers(env, guid)
  const currentByUid = new Map()
  for (const member of current) {
    const uid = member.uid || member.user?.uid
    if (uid) currentByUid.set(uid, member)
    if (uid && !desired.has(uid)) await removeChatMember(env, guid, uid)
  }
  for (const member of desired.values()) {
    await ensureCometChatUser(env, member.uid, member.name)
    const existing = currentByUid.get(member.uid)
    if (!existing) {
      await addChatMember(env, guid, member.uid, member.scope)
      continue
    }
    const existingScope = existing.scope || existing.user?.scope || 'participant'
    if (existingScope !== member.scope) {
      await cometChatRequest(env, `/groups/${encodeURIComponent(guid)}/members/${encodeURIComponent(member.uid)}`, {
        method: 'PUT', body: { scope: member.scope },
      })
    }
  }
}

export async function createCometChatAuthToken(env, uid) {
  const data = await cometChatRequest(env, `/users/${encodeURIComponent(uid)}/auth_tokens`, { method: 'POST', body: {} })
  return data.authToken
}

export async function syncEventChatMembers(env, event) {
  if (event.event_mode === 'gathering' && event.event_subtype === 'date_choice') {
    throw new Error('date_choice parent event 不建立永久活动群，请同步具体 occurrence')
  }
  const guid = await ensureEventChatGroup(env, event)
  const members = []
  if (event.event_mode === 'standard') {
    const signups = await env.DB.prepare("SELECT id, name FROM signups WHERE event_id = ? AND signup_status != 'cancelled'").bind(event.id).all()
    for (const signup of signups.results) members.push({ uid: `signup-${signup.id}`, name: signup.name, scope: 'participant' })
    const hosts = await env.DB.prepare(
      `SELECT u.id, u.display_name FROM event_host_assignments a JOIN admin_users u ON u.id = a.user_id
       WHERE a.event_id = ? AND a.status = 'accepted'`
    ).bind(event.id).all()
    for (const host of hosts.results) members.push({ uid: `account-${host.id}`, name: host.display_name, scope: 'moderator' })
  } else {
    const signups = await env.DB.prepare(
      `SELECT s.user_id, s.name FROM signups s WHERE s.event_id = ?
       AND s.signup_status IN ('joined', 'ride_assigned') AND s.user_id IS NOT NULL
       AND s.schedule_reconfirm_status = 'confirmed' AND s.schedule_confirmed_revision = ?`
    ).bind(event.id, Number(event.schedule_revision || 0)).all()
    for (const signup of signups.results) members.push({ uid: `account-${signup.user_id}`, name: signup.name, scope: 'participant' })
    if (event.created_by) {
      const host = await env.DB.prepare('SELECT id, display_name FROM admin_users WHERE id = ?').bind(event.created_by).first()
      if (host) members.push({ uid: `account-${host.id}`, name: host.display_name, scope: 'moderator' })
    }
  }
  await reconcileGroupMembers(env, guid, members)
  await audit(env.DB, 'chat_sync', 'event', event.id, `${members.length} members`, 'system')
  return guid
}

export async function syncOccurrenceChatMembers(env, event, occurrence) {
  const guid = await ensureOccurrenceChatGroup(env, event, occurrence)
  const rows = await env.DB.prepare(
    `SELECT s.user_id, s.name FROM gathering_occurrence_selections os JOIN signups s ON s.id = os.signup_id
     WHERE os.occurrence_id = ? AND os.status = 'selected' AND s.user_id IS NOT NULL`
  ).bind(occurrence.id).all()
  const members = rows.results.map((member) => ({ uid: `account-${member.user_id}`, name: member.name, scope: Number(event.created_by) === Number(member.user_id) ? 'moderator' : 'participant' }))
  await reconcileGroupMembers(env, guid, members)
  await audit(env.DB, 'chat_sync', 'occurrence', occurrence.id, `${rows.results.length} members`, 'system')
  return guid
}

export async function safelySyncChat(env, target, operation) {
  if (!configured(env)) return { ok: false, skipped: true, message: 'CometChat 尚未配置' }
  try { return { ok: true, value: await operation() } } catch (error) {
    console.error(JSON.stringify({ message: 'CometChat sync failed', target, error: String(error) }))
    await audit(env.DB, 'chat_sync_failed', target.type, target.id, String(error), 'system')
    return { ok: false, message: String(error) }
  }
}
