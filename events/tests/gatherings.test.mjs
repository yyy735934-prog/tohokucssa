import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatJstDateTime,
  formationRequirementsMet,
  isoWeekKey,
  isValidClock,
  jstParts,
  nextScheduledOccurrence,
  precedingWeekdayTimestamp,
  dateChoiceOccurrenceDates,
  templateSchedule,
} from '../worker/lib/gatherings.js'
import { isValidEventType, normalizeStandardRegistration } from '../worker/lib/event-types.js'
import { canEditEventContent, canOperateEvent } from '../worker/lib/permissions.js'

const template = {
  publish_weekday: 1,
  publish_time: '08:00',
  decision_weekday: 5,
  decision_time: '18:00',
  event_weekday: 6,
  event_time: '14:00',
}

test('weekly schedule uses Japan time', () => {
  const mondayMorningJst = Date.parse('2026-08-23T23:30:00Z')
  const schedule = templateSchedule(template, mondayMorningJst)

  assert.equal(schedule.weekKey, '2026-W35')
  assert.equal(new Date(schedule.publishAt).toISOString(), '2026-08-23T23:00:00.000Z')
  assert.equal(new Date(schedule.decisionAt).toISOString(), '2026-08-28T09:00:00.000Z')
  assert.equal(new Date(schedule.eventAt).toISOString(), '2026-08-29T05:00:00.000Z')
  assert.equal(formatJstDateTime(schedule.eventAt), '2026-08-29 14:00')
})

test('ISO week and weekday stay correct across UTC date boundary', () => {
  const sundayUtcButMondayJst = Date.parse('2026-08-23T16:00:00Z')
  assert.equal(isoWeekKey(sundayUtcButMondayJst), '2026-W35')
  assert.equal(jstParts(sundayUtcButMondayJst).weekday, 1)
})

test('clock validation accepts only 24-hour HH:mm values', () => {
  assert.equal(isValidClock('08:00'), true)
  assert.equal(isValidClock('23:59'), true)
  assert.equal(isValidClock('8:00'), false)
  assert.equal(isValidClock('24:00'), false)
  assert.equal(isValidClock('18:60'), false)
})

test('required-host gatherings advance only after both conditions are met', () => {
  const event = { min_participants: 4, requires_host: 1, created_by: null }
  assert.equal(formationRequirementsMet(event, 4), false)
  assert.equal(formationRequirementsMet({ ...event, created_by: 12 }, 3), false)
  assert.equal(formationRequirementsMet({ ...event, created_by: 12 }, 4), true)
  assert.equal(formationRequirementsMet({ ...event, requires_host: 0 }, 4), true)
})

test('only the four supported mode and subtype combinations are valid', () => {
  assert.equal(isValidEventType('standard', 'self_hosted'), true)
  assert.equal(isValidEventType('standard', 'assisted'), true)
  assert.equal(isValidEventType('gathering', 'scheduled'), true)
  assert.equal(isValidEventType('gathering', 'date_choice'), true)
  assert.equal(isValidEventType('standard', 'scheduled'), false)
  assert.equal(isValidEventType('gathering', 'assisted'), false)
})

test('assisted registration validates URL and email without inventing mail content', () => {
  assert.equal(normalizeStandardRegistration({ event_subtype: 'assisted', registration_mode: 'external_url', registration_target: 'javascript:alert(1)' }).error.length > 0, true)
  const email = normalizeStandardRegistration({ event_subtype: 'assisted', registration_mode: 'external_email', registration_target: 'join@example.com' })
  assert.equal(email.error, undefined)
  assert.equal(email.registration_email_subject, null)
  assert.equal(email.registration_email_body, null)
})

test('weekly intervals and monthly recurrence use lead time for publishing and weekday time for decisions', () => {
  const now = Date.parse('2026-09-01T00:00:00Z')
  const base = { event_time: '19:00', publish_lead_minutes: 10080, decision_weekday: 5, decision_time: '18:00' }
  const biweekly = nextScheduledOccurrence({ ...base, recurrence_json: JSON.stringify({ frequency: 'weekly', interval: 2, anchor_date: '2026-09-05', weekday: 6 }) }, now)
  assert.equal(biweekly.occurrenceKey, '2026-09-05 19:00')
  assert.equal(new Date(biweekly.publishAt).toISOString(), '2026-08-29T10:00:00.000Z')
  assert.equal(new Date(biweekly.decisionAt).toISOString(), '2026-09-04T09:00:00.000Z')
  const monthlyDate = nextScheduledOccurrence({ ...base, recurrence_json: JSON.stringify({ frequency: 'monthly', interval: 1, anchor_date: '2026-09-01', day_of_month: 15 }) }, now)
  assert.equal(monthlyDate.occurrenceKey, '2026-09-15 19:00')
  const firstSaturday = nextScheduledOccurrence({ ...base, recurrence_json: JSON.stringify({ frequency: 'monthly', interval: 1, anchor_date: '2026-09-01', weekday: 6, ordinal: 1 }) }, now)
  assert.equal(firstSaturday.occurrenceKey, '2026-09-05 19:00')
})

test('gathering content is editable by administrators and the current host only', () => {
  const gathering = { event_mode: 'gathering', created_by: 12 }
  assert.equal(canEditEventContent(gathering, { id: 99, role: 'reviewer' }), true)
  assert.equal(canEditEventContent(gathering, { id: 12, role: 'host' }), true)
  assert.equal(canEditEventContent(gathering, { id: 13, role: 'host' }), false)
  assert.equal(canEditEventContent({ event_mode: 'standard', created_by: 12 }, { id: 12, role: 'host' }), false)
})

test('event operations include assigned formal-event hosts', async () => {
  const assignedDb = { prepare: () => ({ bind: () => ({ first: async () => ({ allowed: 1 }) }) }) }
  assert.equal(await canOperateEvent(assignedDb, { id: 8, event_mode: 'standard' }, { id: 12, role: 'host' }), true)
  assert.equal(await canOperateEvent(assignedDb, { id: 9, event_mode: 'gathering', created_by: 12 }, { id: 12, role: 'host' }), true)
  assert.equal(await canOperateEvent(assignedDb, { id: 9, event_mode: 'gathering', created_by: 12 }, { id: 13, role: 'host' }), false)
})

test('decision weekday at or after the event rolls back to the previous week', () => {
  const eventAt = Date.parse('2026-09-05T10:00:00Z') // Saturday 19:00 JST
  assert.equal(new Date(precedingWeekdayTimestamp(eventAt, 6, '20:00')).toISOString(), '2026-08-29T11:00:00.000Z')
})

test('date-choice occurrence generation honors JST weekdays and T-30 deadline', () => {
  const now = Date.parse('2026-09-06T15:00:00Z') // Monday 00:00 JST
  const rows = dateChoiceOccurrenceDates({ event_time: '19:00', allowed_weekdays_json: '[1,3,5]', booking_horizon_days: 7, formation_lead_minutes: 30 }, now)
  assert.deepEqual(rows.map((row) => row.eventDate), ['2026-09-07 19:00', '2026-09-09 19:00', '2026-09-11 19:00', '2026-09-14 19:00'])
  assert.equal(rows[0].eventAt - rows[0].formationDeadline, 30 * 60 * 1000)
})
