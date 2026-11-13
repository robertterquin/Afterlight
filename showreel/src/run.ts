// The reel's gameplay is a real run of the game's deterministic engine: a scripted player
// drops each stone at a planned offset, and the video replays the resulting states.
import {
  advanceGame,
  createGame,
  placeBlock,
  seedForDate,
  startGame,
  type Block,
  type FallingPiece,
  type GameState,
} from '../../supabase/functions/_shared/game-engine.ts'

export { BLOCK_HEIGHT, WORLD_WIDTH } from '../../supabase/functions/_shared/game-engine.ts'
export type { Block, FallingPiece }

// 2026-11-12 is an Ember tide day (UTC day number % 7 === 0), the course the reel opens and closes on.
const DATE = '2026-11-12'

type Step = {
  /** Moving stone's centre minus the supporting stone's centre at the drop; 0 means a perfect drop. */
  offset: number
  /** Video frame of the impact. */
  frame: number
  /** Video frame the moving stone appears; it covers its whole engine path between `from` and `frame`. */
  from: number
  /** Time-lapse drops: no visible slide, the stone drops in from above. */
  quick?: boolean
}

const CLIMB_OFFSETS = [0, 0, 0, 16, 0, 0, 0, -16, 0, 0, 0, 0, 0, 18, 0, 0, 0, 0, -18, 0, 0, 0, 0, 0, 16, 0, 0, 0, 0]
export const CLIMB_START = 404
export const CLIMB_END = 598

const STEPS: Step[] = [
  // Beat 1: cold open, already mid-slide at frame 0.
  { offset: 0, frame: 8, from: -26 },
  { offset: 34, frame: 34, from: 8 },
  { offset: 0, frame: 60, from: 34 },
  // Beat 2: an offcut, then five perfects in a quickening rhythm; the fifth grows the stone.
  { offset: -24, frame: 120, from: 60 },
  { offset: 0, frame: 166, from: 120 },
  { offset: 0, frame: 204, from: 166 },
  { offset: 0, frame: 238, from: 204 },
  { offset: 0, frame: 268, from: 238 },
  { offset: 0, frame: 298, from: 268 },
  // Beat 3: the climb as a time-lapse.
  ...CLIMB_OFFSETS.map((offset, index) => {
    const frame = Math.round(CLIMB_START + (index * (CLIMB_END - CLIMB_START)) / (CLIMB_OFFSETS.length - 1))
    return { offset, frame, from: frame - 1, quick: true }
  }),
  // Beat 4: the final perfect drop at dawn.
  { offset: 0, frame: 708, from: 682 },
]

export type Drop = Step & {
  /** Moving stone x for each engine tick from its spawn to the drop. */
  path: number[]
  width: number
  /** State right after the drop. */
  after: GameState
}

function simulate(): Drop[] {
  let game = startGame(createGame({ date: DATE, seed: seedForDate(DATE) }))
  return STEPS.map((step) => {
    const below = game.stack.at(-1)!
    const miss = (state: GameState) =>
      state.moving!.x + state.moving!.width / 2 - (below.x + below.width / 2) - step.offset
    const path = [game.moving!.x]
    let current = game
    for (let guard = 0; guard < 5000; guard += 1) {
      const next = advanceGame(current)
      if (Math.sign(miss(current)) !== Math.sign(miss(next)) || miss(next) === 0) {
        if (Math.abs(miss(next)) < Math.abs(miss(current))) {
          current = next
          path.push(next.moving!.x)
        }
        break
      }
      current = next
      path.push(next.moving!.x)
    }
    const width = current.moving!.width
    const after = placeBlock(current)
    // Self-check: the scripted player must land exactly the drops the beat sheet expects.
    if (after.phase !== 'playing' || after.lastDropWasPerfect !== (step.offset === 0)) {
      throw new Error(`Drop at frame ${step.frame} did not land as planned`)
    }
    game = after
    return { ...step, path, width, after }
  })
}

export const DROPS = simulate()
export const FINAL = DROPS.at(-1)!.after

/** Index of the last drop at or before `frame`, or -1 before the first impact. */
export function dropIndexAt(frame: number) {
  let index = -1
  while (index + 1 < DROPS.length && DROPS[index + 1]!.frame <= frame) index += 1
  return index
}

/** The stack as it stands at `frame` (the base stone plus every landed drop). */
export function stackAt(frame: number): Block[] {
  const index = dropIndexAt(frame)
  return index < 0 ? FINAL.stack.slice(0, 1) : DROPS[index]!.after.stack
}

/** The sliding stone at `frame`, if one is on screen. */
export function movingAt(frame: number): Block | null {
  const next = DROPS[dropIndexAt(frame) + 1]
  if (!next || next.quick || frame < next.from) return null
  const progress = (frame - next.from) / (next.frame - next.from)
  const position = Math.min(1, Math.max(0, progress)) * (next.path.length - 1)
  const low = Math.floor(position)
  const high = Math.min(next.path.length - 1, low + 1)
  const x = next.path[low]! + (next.path[high]! - next.path[low]!) * (position - low)
  return { x, width: next.width }
}
