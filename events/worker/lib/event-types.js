export const EVENT_TYPE_COMBINATIONS = new Set([
  'standard:self_hosted',
  'standard:assisted',
  'gathering:scheduled',
  'gathering:date_choice',
])

export function isValidEventType(eventMode, eventSubtype) {
  return EVENT_TYPE_COMBINATIONS.has(`${eventMode}:${eventSubtype}`)
}

export function normalizeStandardRegistration(input = {}) {
  const subtype = input.event_subtype || 'self_hosted'
  if (!isValidEventType('standard', subtype)) return { error: '正式活动类型无效' }
  if (subtype === 'self_hosted') {
    return { event_subtype: subtype, registration_mode: 'internal', registration_target: null, registration_email_subject: null, registration_email_body: null }
  }
  const mode = input.registration_mode
  const target = String(input.registration_target || '').trim()
  if (!['external_url', 'external_email'].includes(mode)) return { error: '协助活动必须选择外部报名方式' }
  if (!target) return { error: '请填写外部报名地址' }
  if (mode === 'external_url') {
    try {
      const url = new URL(target)
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('bad protocol')
    } catch { return { error: '外部报名链接必须是有效的 HTTP(S) 地址' } }
  }
  if (mode === 'external_email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) return { error: '报名邮箱格式无效' }
  return {
    event_subtype: subtype,
    registration_mode: mode,
    registration_target: target,
    registration_email_subject: input.registration_email_subject == null || input.registration_email_subject === '' ? null : String(input.registration_email_subject),
    registration_email_body: input.registration_email_body == null || input.registration_email_body === '' ? null : String(input.registration_email_body),
  }
}
