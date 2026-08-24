import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatJstDateTime,
  isoWeekKey,
  isValidClock,
  jstParts,
  templateSchedule,
} from '../worker/lib/gatherings.js'

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
