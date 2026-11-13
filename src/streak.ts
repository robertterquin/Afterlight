// The daily streak lives on this device only: no account or server needed.
const STORAGE_KEY = 'afterlight.streak'
const DAY_MS = 86_400_000

export type StreakRecord = {
  /** UTC date (YYYY-MM-DD) of the latest day with a finished climb. */
  last: string | null
  /** Consecutive days ending on `last`. */
  run: number
  best: number
  /** The most recent climbed days, newest last, for the week view. */
  days: string[]
}

export type Streak = {
  /** Consecutive days still alive (ending today or yesterday); 0 once a day is missed. */
  current: number
  best: number
  climbedToday: boolean
  /** The last seven course days, oldest first, ending with today. */
  week: boolean[]
  /** Climbed on some day before today, so there is a streak to talk about. */
  returning: boolean
}

const EMPTY: StreakRecord = { last: null, run: 0, best: 0, days: [] }
const dayNumber = (utcDate: string) => Math.floor(Date.parse(utcDate) / DAY_MS)

export function summarize(record: StreakRecord, today: string): Streak {
  const todayNumber = dayNumber(today)
  const lastNumber = record.last ? dayNumber(record.last) : -Infinity
  const climbed = new Set(record.days.map(dayNumber))
  const alive = todayNumber - lastNumber <= 1
  return {
    current: alive ? record.run : 0,
    best: record.best,
    climbedToday: lastNumber === todayNumber,
    week: Array.from({ length: 7 }, (_, index) => climbed.has(todayNumber - 6 + index)),
    returning: record.last !== null && (lastNumber < todayNumber || record.days.length > 1),
  }
}

/** Adds a finished climb on `today`. `firstToday` is false for later runs the same day. */
export function addClimb(record: StreakRecord, today: string): { record: StreakRecord; firstToday: boolean } {
  if (record.last === today) return { record, firstToday: false }
  const continues = record.last !== null && dayNumber(today) - dayNumber(record.last) === 1
  const run = continues ? record.run + 1 : 1
  return {
    record: { last: today, run, best: Math.max(record.best, run), days: [...record.days, today].slice(-7) },
    firstToday: true,
  }
}

export function readStreak(): StreakRecord {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (stored && Array.isArray(stored.days)) {
      return {
        last: typeof stored.last === 'string' ? stored.last : null,
        run: Number(stored.run) || 0,
        best: Number(stored.best) || 0,
        days: stored.days.filter((day: unknown) => typeof day === 'string'),
      }
    }
  } catch {
    // Private mode or corrupt data: start fresh.
  }
  return EMPTY
}

export function saveClimb(today: string) {
  const result = addClimb(readStreak(), today)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(result.record))
  } catch {
    // Storage can be blocked; the streak just won't persist.
  }
  return result
}

/** The one line the ready screen shows, or null when there's nothing worth saying yet. */
export function streakLine(streak: Streak): string | null {
  if (!streak.returning) return null
  if (streak.current > 0 && !streak.climbedToday) {
    return `${streak.current}-day streak · climb today to make it ${streak.current + 1}`
  }
  if (streak.current >= 2) return `${streak.current}-day streak`
  if (streak.best >= 2) {
    return streak.climbedToday
      ? `Best streak ${streak.best} days · new streak started`
      : `Best streak ${streak.best} days · start a new one today`
  }
  return null
}
