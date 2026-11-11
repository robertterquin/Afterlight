export const WORLD_WIDTH = 1000
export const BLOCK_HEIGHT = 68
export const STARTING_WIDTH = 220
export const MINIMUM_WIDTH = 48
export const STARTING_SPEED = 300

const LANE_LEFT = 90
const LANE_RIGHT = 910
const PERFECT_TOLERANCE = 5
const MAX_SPEED = STARTING_SPEED * 2.2

export type Phase = 'ready' | 'playing' | 'paused' | 'over'

export type Block = {
  x: number
  width: number
}

export type MovingBlock = Block & {
  direction: -1 | 1
}

export type GameState = {
  phase: Phase
  stack: Block[]
  moving: MovingBlock | null
  speed: number
  perfects: number
  lastDropWasPerfect: boolean
}

export const createGame = (): GameState => ({
  phase: 'ready',
  stack: [{ x: (WORLD_WIDTH - STARTING_WIDTH) / 2, width: STARTING_WIDTH }],
  moving: null,
  speed: STARTING_SPEED,
  perfects: 0,
  lastDropWasPerfect: false,
})

export const heightOf = (game: GameState) => game.stack.length - 1

export const startGame = (game: GameState): GameState => {
  if (game.phase !== 'ready') return game

  const width = game.stack.at(-1)!.width
  return {
    ...game,
    phase: 'playing',
    moving: { x: LANE_LEFT, width, direction: 1 },
  }
}

export const advanceGame = (game: GameState, deltaSeconds: number): GameState => {
  if (game.phase !== 'playing' || !game.moving) return game

  const delta = Math.min(Math.max(deltaSeconds, 0), 0.05)
  const maxX = LANE_RIGHT - game.moving.width
  let x = game.moving.x + game.moving.direction * game.speed * delta
  let direction = game.moving.direction

  if (x <= LANE_LEFT) {
    x = LANE_LEFT
    direction = 1
  } else if (x >= maxX) {
    x = maxX
    direction = -1
  }

  return { ...game, moving: { ...game.moving, x, direction } }
}

export const placeBlock = (game: GameState): GameState => {
  if (game.phase !== 'playing' || !game.moving) return game

  const previous = game.stack.at(-1)!
  const overlapLeft = Math.max(previous.x, game.moving.x)
  const overlapRight = Math.min(
    previous.x + previous.width,
    game.moving.x + game.moving.width,
  )
  const overlap = overlapRight - overlapLeft

  if (overlap < MINIMUM_WIDTH) {
    return {
      ...game,
      phase: 'over',
      moving: null,
      lastDropWasPerfect: false,
    }
  }

  const previousCenter = previous.x + previous.width / 2
  const movingCenter = game.moving.x + game.moving.width / 2
  const perfect = Math.abs(previousCenter - movingCenter) <= PERFECT_TOLERANCE
  const landed: Block = perfect
    ? { x: previous.x, width: previous.width }
    : { x: overlapLeft, width: overlap }
  const stack = [...game.stack, landed]
  const height = stack.length - 1
  const speed = Math.min(
    MAX_SPEED,
    STARTING_SPEED * 1.05 ** Math.floor(height / 5),
  )
  const direction = game.moving.direction === 1 ? -1 : 1
  const nextX = direction === 1 ? LANE_LEFT : LANE_RIGHT - landed.width

  return {
    ...game,
    stack,
    speed,
    perfects: game.perfects + Number(perfect),
    lastDropWasPerfect: perfect,
    moving: { x: nextX, width: landed.width, direction },
  }
}

export const pauseGame = (game: GameState): GameState =>
  game.phase === 'playing' ? { ...game, phase: 'paused' } : game

export const resumeGame = (game: GameState): GameState =>
  game.phase === 'paused' ? { ...game, phase: 'playing' } : game

export const endGame = (game: GameState): GameState =>
  game.phase === 'paused' ? { ...game, phase: 'over', moving: null } : game
