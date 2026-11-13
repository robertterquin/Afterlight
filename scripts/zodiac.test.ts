// Run with: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ZODIAC, brightestStar, zodiacForDate } from '../src/zodiac.ts'

test('each date maps to its zodiac season, including the turn of the year', () => {
  const cases: Array<[string, string]> = [
    ['2026-11-14', 'Scorpio'], ['2026-11-21', 'Scorpio'], ['2026-11-22', 'Sagittarius'],
    ['2026-12-21', 'Sagittarius'], ['2026-12-22', 'Capricorn'], ['2026-12-31', 'Capricorn'],
    ['2027-01-01', 'Capricorn'], ['2027-01-19', 'Capricorn'], ['2027-01-20', 'Aquarius'],
    ['2027-03-20', 'Pisces'], ['2027-03-21', 'Aries'], ['2027-07-23', 'Leo'],
  ]
  for (const [date, sign] of cases) assert.equal(zodiacForDate(date).name, sign, date)
})

test('every sign has valid lines and names its brightest star', () => {
  assert.equal(ZODIAC.length, 12)
  for (const sign of ZODIAC) {
    for (const [a, b] of sign.lines) assert.ok(sign.stars[a] && sign.stars[b], `${sign.name} line ${a}-${b}`)
    assert.ok(brightestStar(sign) >= 0)
  }
  assert.equal(ZODIAC.find((sign) => sign.name === 'Scorpio')!.stars[brightestStar(ZODIAC.find((sign) => sign.name === 'Scorpio')!)][3], '#ffab86')
})
