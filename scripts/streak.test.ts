// Run with: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addClimb, streakLine, summarize, type StreakRecord } from '../src/streak.ts'

const empty: StreakRecord = { last: null, run: 0, best: 0, days: [] }
const climb = (record: StreakRecord, ...days: string[]) => days.reduce((r, day) => addClimb(r, day).record, record)

test('a first-ever climb shows no streak line', () => {
  assert.equal(streakLine(summarize(empty, '2026-11-13')), null)
  assert.equal(streakLine(summarize(climb(empty, '2026-11-13'), '2026-11-13')), null)
})

test('consecutive days build the streak; the same day twice counts once', () => {
  const record = climb(empty, '2026-11-10', '2026-11-11', '2026-11-11', '2026-11-12')
  assert.equal(record.run, 3)
  assert.equal(addClimb(record, '2026-11-12').firstToday, false)
  assert.equal(streakLine(summarize(record, '2026-11-13')), '3-day streak · climb today to make it 4')
  assert.equal(streakLine(summarize(climb(record, '2026-11-13'), '2026-11-13')), '4-day streak')
})

test('the week view lights the right days, oldest first', () => {
  const streak = summarize(climb(empty, '2026-11-08', '2026-11-10', '2026-11-11', '2026-11-12'), '2026-11-13')
  assert.deepEqual(streak.week, [false, true, false, true, true, true, false])
})

test('a missed day breaks the streak but keeps the best', () => {
  const record = climb(empty, '2026-11-08', '2026-11-09', '2026-11-10')
  assert.equal(summarize(record, '2026-11-13').current, 0)
  assert.equal(streakLine(summarize(record, '2026-11-13')), 'Best streak 3 days · start a new one today')
  const restarted = climb(record, '2026-11-13')
  assert.equal(restarted.run, 1)
  assert.equal(streakLine(summarize(restarted, '2026-11-13')), 'Best streak 3 days · new streak started')
})

test('the streak crosses month boundaries', () => {
  assert.equal(climb(empty, '2026-11-30', '2026-12-01').run, 2)
})
