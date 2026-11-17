import {
  advanceGame,
  createGame,
  getUtcDate,
  heightOf,
  placeBlock,
  seedForDate,
  startGame,
} from "./game-engine.ts"

export const MAX_PLACEMENTS = 500
export const MAX_TICK = 180_000

export type VerifiedRun = {
  height: number
  perfects: number
  towerProfile: {
    blocks: Array<{ x: number; width: number }>
    perfectLevels: number[]
  }
}

export function verifyRun(body: unknown, now = new Date()): VerifiedRun | { error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Invalid request body." }

  const { challengeDate, placementTicks } = body as { challengeDate?: unknown; placementTicks?: unknown }
  if (typeof challengeDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(challengeDate)) {
    return { error: "Invalid challenge date." }
  }
  const parsedDate = new Date(`${challengeDate}T00:00:00.000Z`)
  if (Number.isNaN(parsedDate.getTime()) || getUtcDate(parsedDate) !== challengeDate) {
    return { error: "Invalid challenge date." }
  }

  const today = getUtcDate(now)
  const yesterdayDate = new Date(`${today}T00:00:00.000Z`)
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1)
  if (challengeDate !== today && challengeDate !== getUtcDate(yesterdayDate)) {
    return { error: "This daily challenge has expired." }
  }

  if (
    !Array.isArray(placementTicks)
    || placementTicks.length < 1
    || placementTicks.length > MAX_PLACEMENTS
    || !placementTicks.every((tick) => Number.isSafeInteger(tick) && tick >= 0 && tick <= MAX_TICK)
  ) {
    return { error: "Invalid placement history." }
  }

  let game = startGame(createGame({ date: challengeDate, seed: seedForDate(challengeDate) }))
  let previousTick = -1
  const perfectLevels: number[] = []
  for (const tick of placementTicks as number[]) {
    if (tick < previousTick || game.phase !== "playing") return { error: "The run could not be verified." }
    while (game.tick < tick && game.phase === "playing") game = advanceGame(game)
    if (game.tick !== tick || game.phase !== "playing") return { error: "The run could not be verified." }
    game = placeBlock(game)
    if (game.lastDropWasPerfect) perfectLevels.push(heightOf(game))
    previousTick = tick
  }

  const height = heightOf(game)
  if (height < 1) return { error: "Place at least one stone to submit a score." }
  return {
    height,
    perfects: game.perfects,
    towerProfile: {
      blocks: game.stack.map(({ x, width }) => ({
        x: Math.round(x * 10) / 10,
        width: Math.round(width * 10) / 10,
      })),
      perfectLevels,
    },
  }
}
