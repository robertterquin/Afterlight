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

export const DATE = '2026-11-12'

type Step = {
  offset: number
  frame: number
  from: number
  quick?: boolean
}

const CLIMB_OFFSETS = [0, 0, 0, 16, 0, 0, 0, -16, 0, 0, 0, 0, 0, 18, 0, 0, 0, 0, -18, 0, 0, 0, 0, 0, 16, 0, 0, 0, 0]
export const CLIMB_START = 490
export const CLIMB_END = 690

const SKY_OFFSETS = Array.from({ length: 55 }, (_, index) => (index % 11 === 5 ? (index % 22 === 5 ? 14 : -14) : 0))
export const SKY_START = 697
export const SKY_END = 888

const STEPS: Step[] = [
  { offset: 0, frame: 8, from: -26 },
  { offset: 34, frame: 34, from: 8 },
  { offset: 0, frame: 60, from: 34 },
  { offset: -24, frame: 120, from: 60 },
  { offset: 0, frame: 166, from: 120 },
  { offset: 0, frame: 204, from: 166 },
  { offset: 0, frame: 238, from: 204 },
  { offset: 0, frame: 268, from: 238 },
  { offset: 0, frame: 298, from: 268 },
  ...CLIMB_OFFSETS.map((offset, index) => {
    const frame = Math.round(CLIMB_START + (index * (CLIMB_END - CLIMB_START)) / (CLIMB_OFFSETS.length - 1))
    return { offset, frame, from: frame - 1, quick: true }
  }),
  ...SKY_OFFSETS.map((offset, index) => {
    const frame = Math.round(SKY_START + (index * (SKY_END - SKY_START)) / (SKY_OFFSETS.length - 1))
    return { offset, frame, from: frame - 1, quick: true }
  }),
  ...[0, 0, 0, 0, 0, 0].map((offset, index) => {
    const frame = 902 + index * 14
    return { offset, frame, from: frame - 1, quick: true }
  }),
  { offset: 0, frame: 1006, from: 982 },
]

export type Drop = Step & {
  path: number[]
  width: number
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
    if (after.phase !== 'playing' || after.lastDropWasPerfect !== (step.offset === 0)) {
      throw new Error(`Drop at frame ${step.frame} did not land as planned`)
    }
    game = after
    return { ...step, path, width, after }
  })
}

export const DROPS = simulate()
export const FINAL = DROPS.at(-1)!.after

export function dropIndexAt(frame: number) {
  let index = -1
  while (index + 1 < DROPS.length && DROPS[index + 1]!.frame <= frame) index += 1
  return index
}

export const floorFrame = (floor: number) => DROPS.find((drop) => drop.after.stack.length - 1 >= floor)?.frame ?? Infinity

export function stackAt(frame: number): Block[] {
  const index = dropIndexAt(frame)
  return index < 0 ? FINAL.stack.slice(0, 1) : DROPS[index]!.after.stack
}

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
