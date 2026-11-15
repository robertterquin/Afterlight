// Run with: npm test
// The server's anti-cheat check (supabase/functions/_shared/verify-run.ts) must agree with the game on every
// honest run, and refuse runs that could not have been played.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { advanceGame, createGame, heightOf, placeBlock, seedForDate, startGame, type GameState } from '../supabase/functions/_shared/game-engine.ts'
import { MAX_PLACEMENTS, MAX_TICK, verifyRun, type VerifiedRun } from '../supabase/functions/_shared/verify-run.ts'

const DAY = '2026-11-15'
const NOW = new Date(`${DAY}T12:00:00.000Z`)

/**
 * Plays a run the way a player would, in the game's own engine: for each drop it waits until the moving stone's
 * centre is `offset` units from the stone below, then taps. Past about ±172 the stones overlap by less than the
 * minimum width, so the stone falls and the run ends. Returns the game as the player's screen ends it.
 */
function play(offsets: number[], date = DAY): GameState {
  let game = startGame(createGame({ date, seed: seedForDate(date) }))
  for (const offset of offsets) {
    const below = game.stack.at(-1)!
    const miss = (state: GameState) => state.moving!.x + state.moving!.width / 2 - (below.x + below.width / 2) - offset
    let reached = false
    for (let guard = 0; guard < 5000 && !reached; guard += 1) {
      const next = advanceGame(game)
      reached = Math.sign(miss(game)) !== Math.sign(miss(next)) || miss(next) === 0
      if (!reached || Math.abs(miss(next)) < Math.abs(miss(game))) game = next
    }
    // A mis-scripted offset must fail loudly, not quietly drop the stone somewhere else.
    if (!reached) throw new Error(`The moving stone never reaches offset ${offset}`)
    game = placeBlock(game)
    if (game.phase !== 'playing') break
  }
  return game
}

const verify = (body: unknown) => verifyRun(body, NOW)
const accepted = (result: ReturnType<typeof verifyRun>): VerifiedRun => {
  assert.ok(!('error' in result), `run was refused: ${'error' in result ? result.error : ''}`)
  return result
}
const refused = (result: ReturnType<typeof verifyRun>, error: string) => assert.deepEqual(result, { error })

test('an honest run is accepted with the same height, perfects and tower the player saw', () => {
  const game = play([0, 22, -18, 0, 30, 0, -12, 0])
  assert.equal(game.phase, 'playing')
  const run = accepted(verify({ challengeDate: DAY, placementTicks: game.placementTicks }))
  assert.equal(run.height, heightOf(game))
  assert.equal(run.height, 8)
  assert.equal(run.perfects, game.perfects)
  assert.deepEqual(run.towerProfile.blocks, game.stack.map(({ x, width }) => ({ x: Math.round(x * 10) / 10, width: Math.round(width * 10) / 10 })))
})

test('a run that ends in a miss still counts up to the stone that fell', () => {
  const game = play([0, 10, 0, 200])
  assert.equal(game.phase, 'over')
  const run = accepted(verify({ challengeDate: DAY, placementTicks: game.placementTicks }))
  assert.equal(run.height, heightOf(game))
  assert.equal(run.height, 3)
})

test('a perfect streak counts every perfect and grows the stone on the fifth', () => {
  const game = play([0, 0, 0, 0, 0, 0, 0])
  const run = accepted(verify({ challengeDate: DAY, placementTicks: game.placementTicks }))
  assert.equal(run.perfects, 7)
  assert.deepEqual(run.towerProfile.perfectLevels, [1, 2, 3, 4, 5, 6, 7])
  const widths = run.towerProfile.blocks.map((block) => block.width)
  assert.equal(widths[4], widths[0], 'no growth before the fifth perfect')
  assert.ok(widths[5]! > widths[4]!, 'the fifth perfect grows the stone')
  assert.ok(widths[6]! > widths[5]!, 'each perfect after that grows it again')
})

test('a long climb replays exactly, past the speed-ups and wind changes', () => {
  const offsets = Array.from({ length: 60 }, (_, index) => (index % 7 === 3 ? 14 : 0))
  const game = play(offsets)
  const run = accepted(verify({ challengeDate: DAY, placementTicks: game.placementTicks }))
  assert.equal(run.height, 60)
  assert.equal(run.perfects, game.perfects)
})

test('a claimed height is ignored: only the taps decide the score', () => {
  const game = play([0, 0, 15])
  const run = accepted(verify({ challengeDate: DAY, placementTicks: game.placementTicks, height: 999, perfects: 999 }))
  assert.equal(run.height, 3)
  assert.equal(run.perfects, 2)
})

test('made-up taps cannot fake a tall tower', () => {
  // 300 taps, one every half second: the stones never line up, so the run ends almost at once and the rest are refused.
  refused(verify({ challengeDate: DAY, placementTicks: Array.from({ length: 300 }, (_, index) => 30 + index * 30) }), 'The run could not be verified.')
  // Taps after the run has ended are refused rather than ignored.
  const ended = play([0, 200])
  assert.equal(ended.phase, 'over')
  refused(verify({ challengeDate: DAY, placementTicks: [...ended.placementTicks, ended.placementTicks.at(-1)! + 60] }), 'The run could not be verified.')
})

test("a run only replays on its own day's course", () => {
  const game = play([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  const yesterday = verify({ challengeDate: '2026-11-14', placementTicks: game.placementTicks })
  // Yesterday's course has a different seed, so the same taps cannot rebuild today's ten perfect stones.
  assert.ok('error' in yesterday || yesterday.height !== 10 || yesterday.perfects !== 10)
})

test('tampered tap lists are refused', () => {
  const ticks = play([0, 0, 0, 0]).placementTicks
  refused(verify({ challengeDate: DAY, placementTicks: [ticks[1], ticks[0], ticks[2]] }), 'The run could not be verified.')
  for (const placementTicks of [
    [],
    [12.5],
    [-1],
    [MAX_TICK + 1],
    ['60'],
    [Number.NaN],
    Array.from({ length: MAX_PLACEMENTS + 1 }, (_, index) => index),
    '60,120',
    null,
  ]) {
    refused(verify({ challengeDate: DAY, placementTicks }), 'Invalid placement history.')
  }
})

test('only today and yesterday can be submitted, as real dates', () => {
  const ticks = play([0, 0]).placementTicks
  accepted(verify({ challengeDate: '2026-11-14', placementTicks: play([0, 0], '2026-11-14').placementTicks }))
  refused(verify({ challengeDate: '2026-11-13', placementTicks: ticks }), 'This daily challenge has expired.')
  refused(verify({ challengeDate: '2026-11-16', placementTicks: ticks }), 'This daily challenge has expired.')
  for (const challengeDate of ['2026-02-30', '2026-11-15T00:00', '15-11-2026', 20261115, undefined]) {
    refused(verify({ challengeDate, placementTicks: ticks }), 'Invalid challenge date.')
  }
})

test('a body that is not a run object is refused', () => {
  for (const body of [null, 'run', [DAY], 42]) refused(verify(body), 'Invalid request body.')
})
