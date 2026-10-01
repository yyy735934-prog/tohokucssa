import { Hono } from 'hono'
import { getSession, extractToken } from '../lib/session.js'
import { GATHERING_CATEGORIES, createGatheringFromTemplate, isValidClock, templateSchedule } from '../lib/gatherings.js'
import { audit } from '../lib/audit.js'

const gatheringTemplates = new Hono()

async function requireReviewer(c) {
  const session = await getSession(c.env.SESSIONS, extractToken(c.req), c.env.DB)
  if (!session) throw new Error('未登录')
  if (session.role !== 'reviewer') throw new Error('仅管理员可操作')
  return session
}

gatheringTemplates.get('/', async (c) => {
  await requireReviewer(c)
  const rows = await c.env.DB.prepare(
    `SELECT t.*, approver.display_name AS approver_name,
            COALESCE((
              SELECT json_group_array(json_object('id', u.id, 'display_name', u.display_name, 'email', u.email))
              FROM gathering_template_hosts h JOIN admin_users u ON u.id = h.user_id
              WHERE h.template_id = t.id
            ), '[]') AS hosts_json
     FROM gathering_templates t
     LEFT JOIN admin_users approver ON approver.id = t.approved_by
     ORDER BY t.updated_at DESC, t.id DESC`
  ).all()
  const templates = rows.results.map((template) => {
    const hosts = JSON.parse(template.hosts_json || '[]')
    return { ...template, hosts, host_user_ids: hosts.map((host) => host.id) }
  })
  return c.json({ ok: true, templates })
})

gatheringTemplates.get('/jobs', async (c) => {
  await requireReviewer(c)
  const requestedLimit = Number(c.req.query('limit') || 30)
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 30
  const rows = await c.env.DB.prepare(
    `SELECT j.*, t.name AS template_name, e.title AS event_title
     FROM gathering_jobs j
     LEFT JOIN gathering_templates t ON t.id = j.template_id
     LEFT JOIN events e ON e.id = j.event_id
     ORDER BY j.started_at DESC, j.id DESC
     LIMIT ?`
  ).bind(limit).all()
  return c.json({ ok: true, jobs: rows.results })
})

gatheringTemplates.post('/', async (c) => {
  const session = await requireReviewer(c)
  const body = await c.req.json()
  const data = await validateTemplate(c.env.DB, body)
  if (data.error) return c.json({ ok: false, message: data.error }, 400)

  const result = await c.env.DB.prepare(
    `INSERT INTO gathering_templates (
      name, gathering_subtype, recurrence_json, allowed_weekdays_json, booking_horizon_days,
      publish_lead_minutes, formation_lead_minutes, category, sport_name, title_template, description, notes, region,
      default_location, event_weekday, event_time, publish_weekday, publish_time,
      decision_weekday, decision_time, min_participants, max_participants,
      requires_host, host_user_id, carpool_enabled, approval_status, created_by, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`
  ).bind(
    data.name, data.gathering_subtype, data.recurrence_json, data.allowed_weekdays_json, data.booking_horizon_days,
    data.publish_lead_minutes, data.formation_lead_minutes, data.category, data.sport_name, data.title_template, data.description,
    data.notes, data.region, data.default_location, data.event_weekday, data.event_time,
    data.publish_weekday, data.publish_time, data.decision_weekday, data.decision_time,
    data.min_participants, data.max_participants, data.requires_host, data.host_user_id,
    data.carpool_enabled, session.id, Date.now(),
  ).run()

  await syncTemplateHosts(c.env.DB, result.meta.last_row_id, data.host_user_ids)

  await audit(c.env.DB, 'gathering_template_create', 'gathering_template', result.meta.last_row_id, data.name, session.email)
  return c.json({ ok: true, id: result.meta.last_row_id })
})

gatheringTemplates.patch('/:id', async (c) => {
  const session = await requireReviewer(c)
  const id = Number(c.req.param('id'))
  const existing = await c.env.DB.prepare('SELECT * FROM gathering_templates WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ ok: false, message: '模板不存在' }, 404)

  const body = await c.req.json()
  const existingHostIds = await getTemplateHostIds(c.env.DB, id, existing.host_user_id)
  const data = await validateTemplate(c.env.DB, { ...existing, host_user_ids: existingHostIds, ...body })
  if (data.error) return c.json({ ok: false, message: data.error }, 400)

  await c.env.DB.prepare(
    `UPDATE gathering_templates SET
      name = ?, gathering_subtype = ?, recurrence_json = ?, allowed_weekdays_json = ?, booking_horizon_days = ?,
      publish_lead_minutes = ?, formation_lead_minutes = ?, category = ?, sport_name = ?, title_template = ?, description = ?, notes = ?,
      region = ?, default_location = ?, event_weekday = ?, event_time = ?, publish_weekday = ?,
      publish_time = ?, decision_weekday = ?, decision_time = ?, min_participants = ?,
      max_participants = ?, requires_host = ?, host_user_id = ?, carpool_enabled = ?, updated_at = ?
     WHERE id = ?`
  ).bind(
    data.name, data.gathering_subtype, data.recurrence_json, data.allowed_weekdays_json, data.booking_horizon_days,
    data.publish_lead_minutes, data.formation_lead_minutes, data.category, data.sport_name, data.title_template, data.description,
    data.notes, data.region, data.default_location, data.event_weekday, data.event_time,
    data.publish_weekday, data.publish_time, data.decision_weekday, data.decision_time,
    data.min_participants, data.max_participants, data.requires_host, data.host_user_id,
    data.carpool_enabled, Date.now(), id,
  ).run()

  await syncTemplateHosts(c.env.DB, id, data.host_user_ids)

  await audit(c.env.DB, 'gathering_template_update', 'gathering_template', id, data.name, session.email)
  return c.json({ ok: true })
})

gatheringTemplates.post('/:id/approve', async (c) => {
  const session = await requireReviewer(c)
  const id = Number(c.req.param('id'))
  const template = await c.env.DB.prepare('SELECT * FROM gathering_templates WHERE id = ?').bind(id).first()
  if (!template) return c.json({ ok: false, message: '模板不存在' }, 404)
  const hostUserIds = await getTemplateHostIds(c.env.DB, id, template.host_user_id)
  const validated = await validateTemplate(c.env.DB, { ...template, host_user_ids: hostUserIds })
  if (validated.error) return c.json({ ok: false, message: validated.error }, 400)

  await c.env.DB.prepare(
    "UPDATE gathering_templates SET approval_status = 'approved', approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?"
  ).bind(session.id, Date.now(), Date.now(), id).run()
  await audit(c.env.DB, 'gathering_template_approve', 'gathering_template', id, template.name, session.email)
  return c.json({ ok: true })
})

gatheringTemplates.post('/:id/publish-now', async (c) => {
  const session = await requireReviewer(c)
  const id = Number(c.req.param('id'))
  const template = await c.env.DB.prepare('SELECT * FROM gathering_templates WHERE id = ?').bind(id).first()
  if (!template) return c.json({ ok: false, message: '模板不存在' }, 404)
  if (template.approval_status !== 'approved') return c.json({ ok: false, message: '请先批准模板' }, 400)

  const now = Date.now()
  const schedule = templateSchedule(template, now)
  if (schedule.eventAt <= now) return c.json({ ok: false, message: '本周活动时间已经过去，请调整活动星期或等待下周' }, 400)

  const existing = await c.env.DB.prepare('SELECT id, title FROM events WHERE template_id = ? AND week_key = ?')
    .bind(id, schedule.weekKey).first()
  if (existing) return c.json({ ok: true, already_exists: true, event: existing })

  const event = await createGatheringFromTemplate(c.env, template, now, {
    force: true,
    jobType: 'manual_publish',
    actor: session.email,
  })
  if (!event) return c.json({ ok: false, message: '本周组局未能生成，请刷新后重试' }, 409)
  return c.json({ ok: true, event })
})

gatheringTemplates.post('/:id/pause', async (c) => {
  const session = await requireReviewer(c)
  const id = Number(c.req.param('id'))
  const result = await c.env.DB.prepare(
    "UPDATE gathering_templates SET approval_status = 'paused', updated_at = ? WHERE id = ?"
  ).bind(Date.now(), id).run()
  if (!result.meta.changes) return c.json({ ok: false, message: '模板不存在' }, 404)
  await audit(c.env.DB, 'gathering_template_pause', 'gathering_template', id, '暂停自动发布', session.email)
  return c.json({ ok: true })
})

async function validateTemplate(db, body) {
  const category = String(body.category || '').trim()
  const subtype = body.gathering_subtype === 'date_choice' ? 'date_choice' : 'scheduled'
  const requiresHost = subtype === 'date_choice' ? false : (['karaoke', 'sport'].includes(category) ? !!body.requires_host : true)
  const hostUserIds = [...new Set((Array.isArray(body.host_user_ids)
    ? body.host_user_ids
    : body.host_user_id ? [body.host_user_id] : [])
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0))]
  const hasPublishLeadParts = body.publish_lead_days != null || body.publish_lead_hours != null
  const publishLeadMinutes = hasPublishLeadParts
    ? Number(body.publish_lead_days || 0) * 1440 + Number(body.publish_lead_hours || 0) * 60
    : (body.publish_lead_minutes == null ? null : Number(body.publish_lead_minutes))
  const data = {
    name: String(body.name || '').trim(),
    gathering_subtype: subtype,
    recurrence_json: typeof body.recurrence_json === 'string' ? body.recurrence_json : JSON.stringify(body.recurrence_json || {}),
    allowed_weekdays_json: typeof body.allowed_weekdays_json === 'string' ? body.allowed_weekdays_json : JSON.stringify(body.allowed_weekdays || [1, 2, 3, 4, 5, 6, 7]),
    booking_horizon_days: Math.max(1, Number(body.booking_horizon_days || 14)),
    publish_lead_minutes: publishLeadMinutes,
    formation_lead_minutes: body.formation_lead_minutes == null ? null : Number(body.formation_lead_minutes),
    category,
    sport_name: String(body.sport_name || '').trim(),
    title_template: String(body.title_template || '').trim(),
    description: String(body.description || '').trim(),
    notes: String(body.notes || '').trim(),
    region: String(body.region || '').trim(),
    default_location: String(body.default_location || '').trim(),
    event_weekday: Number(body.event_weekday || 6),
    event_time: String(body.event_time || '14:00'),
    publish_weekday: Number(body.publish_weekday || 1),
    publish_time: String(body.publish_time || '08:00'),
    decision_weekday: Number(body.decision_weekday || 5),
    decision_time: String(body.decision_time || '18:00'),
    min_participants: Number(body.min_participants || 0),
    max_participants: body.max_participants ? Number(body.max_participants) : null,
    requires_host: requiresHost ? 1 : 0,
    host_user_ids: hostUserIds,
    host_user_id: hostUserIds[0] || null,
    carpool_enabled: body.carpool_enabled ? 1 : 0,
  }

  if (!data.name || !data.title_template) return { error: '模板名称和活动标题必填' }
  if (!GATHERING_CATEGORIES.includes(data.category)) return { error: '无效的活动类别' }
  if (![data.event_weekday, data.publish_weekday, data.decision_weekday].every((v) => Number.isInteger(v) && v >= 1 && v <= 7)) {
    return { error: '星期设置无效' }
  }
  if (![data.event_time, data.publish_time, data.decision_time].every(isValidClock)) return { error: '时间格式无效' }
  if (!Number.isInteger(data.min_participants) || data.min_participants < 1) return { error: '最低人数必须大于0' }
  if (data.max_participants !== null && (!Number.isInteger(data.max_participants) || data.max_participants < data.min_participants)) {
    return { error: '最多人数不能少于最低人数' }
  }
  if (!Number.isInteger(data.booking_horizon_days) || data.booking_horizon_days < 1 || data.booking_horizon_days > 90) return { error: '未来可报名天数必须在 1–90 之间' }
  if (subtype === 'date_choice') {
    let allowed
    try { allowed = JSON.parse(data.allowed_weekdays_json) } catch { return { error: '允许星期格式无效' } }
    if (!Array.isArray(allowed) || !allowed.length || allowed.some((day) => !Number.isInteger(Number(day)) || Number(day) < 1 || Number(day) > 7)) return { error: '请选择至少一个允许星期' }
    data.formation_lead_minutes = 30
  } else {
    let recurrence
    try { recurrence = JSON.parse(data.recurrence_json) } catch { return { error: 'recurrence 格式无效' } }
    if (!['weekly', 'monthly'].includes(recurrence.frequency || 'weekly') || !Number.isInteger(Number(recurrence.interval || 1)) || Number(recurrence.interval || 1) < 1) return { error: 'recurrence 设置无效' }
    if (data.publish_lead_minutes == null) {
      const legacy = templateSchedule({ ...data, publish_lead_minutes: null, formation_lead_minutes: null })
      data.publish_lead_minutes = Math.round((legacy.eventAt - legacy.publishAt) / 60000)
    }
    data.formation_lead_minutes = null
    if (!Number.isInteger(data.publish_lead_minutes) || data.publish_lead_minutes <= 0 || data.publish_lead_minutes % 60 !== 0) return { error: '提前发布时间必须是大于 0 的整小时数' }
  }
  const schedule = templateSchedule(data)
  if (subtype === 'scheduled' && schedule.decisionAt <= schedule.publishAt) return { error: '成局判定时间必须晚于发布时间，请减少提前发布时间' }
  if (data.requires_host && !data.host_user_ids.length) return { error: '此类活动必须选择至少一名候选主理人' }
  if (data.host_user_ids.length) {
    const placeholders = data.host_user_ids.map(() => '?').join(',')
    const hosts = await db.prepare(
      `SELECT COUNT(*) AS c FROM admin_users WHERE id IN (${placeholders}) AND role IN ('host', 'reviewer')`
    ).bind(...data.host_user_ids).first()
    if (Number(hosts?.c || 0) !== data.host_user_ids.length) return { error: '所选主理人不存在或没有主理人权限' }
  }
  return data
}

async function getTemplateHostIds(db, templateId, legacyHostUserId = null) {
  const rows = await db.prepare('SELECT user_id FROM gathering_template_hosts WHERE template_id = ? ORDER BY created_at, user_id')
    .bind(templateId).all()
  const ids = rows.results.map((row) => Number(row.user_id))
  if (!ids.length && legacyHostUserId) ids.push(Number(legacyHostUserId))
  return ids
}

async function syncTemplateHosts(db, templateId, hostUserIds) {
  const statements = [db.prepare('DELETE FROM gathering_template_hosts WHERE template_id = ?').bind(templateId)]
  for (const userId of hostUserIds) {
    statements.push(db.prepare(
      'INSERT INTO gathering_template_hosts (template_id, user_id) VALUES (?, ?)'
    ).bind(templateId, userId))
  }
  await db.batch(statements)
}

export { gatheringTemplates }
