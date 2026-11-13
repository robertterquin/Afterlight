export const WORLD_WIDTH = 1000
export const BLOCK_HEIGHT = 68
export const STARTING_WIDTH = 220
export const MINIMUM_WIDTH = 48
export const STARTING_SPEED = 300
export const SIMULATION_HZ = 60

const LANE_LEFT = 90
const LANE_RIGHT = 910
const PERFECT_TOLERANCE = 8
const MAX_SPEED = STARTING_SPEED * 2.2
const PERFECTS_TO_AWAKEN = 5
const AWAKENING_GROWTH = 32
const CONTINUING_PERFECT_GROWTH = 18
const MAX_BLOCK_WIDTH = STARTING_WIDTH + 120
const FLOORS_PER_WIND_CHANGE = 5

export type Phase = 'ready' | 'playing' | 'paused' | 'over'

export type DailyChallenge = {
  date: string
  seed: number
}

export type Block = {
  x: number
  width: number
}

export type MovingBlock = Block & {
  direction: -1 | 1
}

export type FallingPiece = Block & {
  id: number
  level: number
  direction: -1 | 1
}

export type GameState = {
  phase: Phase
  challenge: DailyChallenge
  stack: Block[]
  moving: MovingBlock | null
  fallingPieces: FallingPiece[]
  speed: number
  windPercent: number
  tick: number
  placementTicks: number[]
  perfects: number
  perfectStreak: number
  lastDropWasPerfect: boolean
  lastDropGrew: boolean
}

export const getUtcDate = (date = new Date()) => date.toISOString().slice(0, 10)

export const seedForDate = (utcDate: string) => {
  let hash = 0x811c9dc5
  for (let index = 0; index < utcDate.length; index += 1) {
    hash ^= utcDate.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export const createDailyChallenge = (date = new Date()): DailyChallenge => {
  const utcDate = getUtcDate(date)
  return { date: utcDate, seed: seedForDate(utcDate) }
}

// Built once: creating a DateTimeFormat is slow, and the date label renders on every game frame.
const dailyDateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

export const formatDailyDate = (utcDate: string) =>
  dailyDateFormat.format(new Date(`${utcDate}T00:00:00.000Z`)).toUpperCase()

const randomForSeed = (seed: number) => {
  let state = seed >>> 0
  return () => {
    let value = (state += 0x6d2b79f5)
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export const windPercentAtHeight = (seed: number, height: number) => {
  const windStep = Math.floor(height / FLOORS_PER_WIND_CHANGE)
  if (windStep === 0) return 0

  const stepSeed = (seed ^ Math.imul(windStep, 0x9e3779b9)) >>> 0
  return Math.floor(randomForSeed(stepSeed)() * 17) - 8
}

const speedAtHeight = (height: number, windPercent: number) => {
  const climbSpeed = STARTING_SPEED * 1.05 ** Math.floor(height / FLOORS_PER_WIND_CHANGE)
  return Math.min(MAX_SPEED, climbSpeed * (1 + windPercent / 100))
}

const perfectToleranceAtSpeed = (speed: number) =>
  Math.max(PERFECT_TOLERANCE, speed / SIMULATION_HZ)

export const createGame = (challenge = createDailyChallenge()): GameState => ({
  phase: 'ready',
  challenge,
  stack: [{ x: (WORLD_WIDTH - STARTING_WIDTH) / 2, width: STARTING_WIDTH }],
  moving: null,
  fallingPieces: [],
  speed: STARTING_SPEED,
  windPercent: 0,
  tick: 0,
  placementTicks: [],
  perfects: 0,
  perfectStreak: 0,
  lastDropWasPerfect: false,
  lastDropGrew: false,
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

export const advanceGame = (game: GameState): GameState => {
  if (game.phase !== 'playing' || !game.moving) return game

  const step = 1 / SIMULATION_HZ
  const maxX = LANE_RIGHT - game.moving.width
  let x = game.moving.x + game.moving.direction * game.speed * step
  let direction = game.moving.direction

  if (x <= LANE_LEFT) {
    x = LANE_LEFT
    direction = 1
  } else if (x >= maxX) {
    x = maxX
    direction = -1
  }

  return {
    ...game,
    moving: { ...game.moving, x, direction },
    tick: game.tick + 1,
  }
}

export const placeBlock = (game: GameState): GameState => {
  if (game.phase !== 'playing' || !game.moving) return game

  const placementTicks = [...game.placementTicks, game.tick]
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
      fallingPieces: [{
        id: placementTicks.length - 1,
        x: game.moving.x,
        width: game.moving.width,
        level: game.stack.length + 1,
        direction: game.moving.direction,
      }],
      placementTicks,
      perfectStreak: 0,
      lastDropWasPerfect: false,
      lastDropGrew: false,
    }
  }

  const previousCenter = previous.x + previous.width / 2
  const movingCenter = game.moving.x + game.moving.width / 2
  const perfect = Math.abs(previousCenter - movingCenter) <= perfectToleranceAtSpeed(game.speed)
  const perfectStreak = perfect ? game.perfectStreak + 1 : 0
  const growth = perfectStreak < PERFECTS_TO_AWAKEN
    ? 0
    : perfectStreak === PERFECTS_TO_AWAKEN
      ? AWAKENING_GROWTH
      : CONTINUING_PERFECT_GROWTH
  const id = placementTicks.length - 1
  const fallingPieces: FallingPiece[] = []
  if (!perfect) {
    const movingRight = game.moving.x + game.moving.width
    if (game.moving.x < overlapLeft) {
      fallingPieces.push({
        id,
        x: game.moving.x,
        width: overlapLeft - game.moving.x,
        level: game.stack.length + 1,
        direction: -1,
      })
    }
    if (movingRight > overlapRight) {
      fallingPieces.push({
        id,
        x: overlapRight,
        width: movingRight - overlapRight,
        level: game.stack.length + 1,
        direction: 1,
      })
    }
  }
  let landed: Block
  let lastDropGrew = false
  if (perfect) {
    const width = Math.min(MAX_BLOCK_WIDTH, previous.width + growth)
    const center = previous.x + previous.width / 2
    const x = Math.max(LANE_LEFT, Math.min(center - width / 2, LANE_RIGHT - width))
    landed = { x, width }
    lastDropGrew = width > previous.width
  } else {
    landed = { x: overlapLeft, width: overlap }
  }
  const stack = [...game.stack, landed]
  const height = stack.length - 1
  const windPercent = windPercentAtHeight(game.challenge.seed, height)
  const speed = speedAtHeight(height, windPercent)
  const direction = game.moving.direction === 1 ? -1 : 1
  const nextX = direction === 1 ? LANE_LEFT : LANE_RIGHT - landed.width

  return {
    ...game,
    stack,
    fallingPieces,
    speed,
    windPercent,
    placementTicks,
    perfects: game.perfects + Number(perfect),
    perfectStreak,
    lastDropWasPerfect: perfect,
    lastDropGrew,
    moving: { x: nextX, width: landed.width, direction },
  }
}

export const pauseGame = (game: GameState): GameState =>
  game.phase === 'playing' ? { ...game, phase: 'paused' } : game

export const resumeGame = (game: GameState): GameState =>
  game.phase === 'paused' ? { ...game, phase: 'playing' } : game

export const endGame = (game: GameState): GameState =>
  game.phase === 'paused' ? { ...game, phase: 'over', moving: null } : game
