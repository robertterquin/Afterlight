import type { GameState } from './game'
import type { LeaderboardEntry } from './leaderboard'

export function bestStreakOf(game: GameState) {
  let best = 0
  let run = 0
  for (let index = 1; index < game.stack.length; index += 1) {
    const block = game.stack[index]
    const support = game.stack[index - 1]
    // Perfect drops land centred on the stone below (the engine snaps them).
    run = Math.abs(block.x + block.width / 2 - (support.x + support.width / 2)) < 0.01 ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

/** The closest climber above this height, or null when no one is ahead. */
export function nextMark(entries: LeaderboardEntry[], height: number) {
  const ahead = entries.filter((entry) => !entry.is_you && entry.height >= height)
  if (ahead.length === 0) return null
  const target = ahead.reduce((closest, entry) => entry.height < closest.height ? entry : closest)
  return { name: target.display_name, height: target.height, gap: target.height - height + 1 }
}
