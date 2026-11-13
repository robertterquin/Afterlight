import { FunctionsHttpError } from '@supabase/supabase-js'
import { ensureAnonymousUser, supabase } from './supabase'

export const isConfigured = () => Boolean(supabase)

export type TowerBlockProfile = {
  x: number
  width: number
}

export type TowerProfile = {
  blocks: TowerBlockProfile[]
  perfectLevels: number[]
}

export type LeaderboardEntry = {
  rank: number
  display_name: string
  height: number
  perfects: number
  tower_profile: TowerProfile | null
  is_you: boolean
}

export type ScoreSubmission = {
  accepted: true
  personalBest: boolean
  height: number
  perfects: number
}

function requireSupabase() {
  if (!supabase) throw new Error('Add the Supabase URL and publishable key to connect.')
  return supabase
}

export async function connectAnonymousPlayer() {
  const user = await ensureAnonymousUser()
  const name = await ensurePlayerProfile(user.id)
  return { id: user.id, name }
}

export async function ensurePlayerProfile(userId: string) {
  const client = requireSupabase()
  const generatedName = `Beacon-${userId.replaceAll('-', '').slice(0, 4).toUpperCase()}`
  const { error: createError } = await client
    .from('player_profiles')
    .upsert({ user_id: userId, display_name: generatedName }, {
      onConflict: 'user_id',
      ignoreDuplicates: true,
    })
  if (createError) throw createError

  const { data, error } = await client
    .from('player_profiles')
    .select('display_name')
    .eq('user_id', userId)
    .single()
  if (error) throw error
  return data.display_name
}

export async function getDailyLeaderboard(challengeDate: string) {
  const { data, error } = await requireSupabase().rpc('get_daily_leaderboard', {
    p_challenge_date: challengeDate,
  })
  if (error) throw error
  return (data ?? []) as LeaderboardEntry[]
}

export async function savePlayerName(userId: string, displayName: string) {
  const cleanName = displayName.trim()
  if (!/^[A-Za-z0-9 _-]{3,18}$/.test(cleanName)) {
    throw new Error('Use 3–18 letters, numbers, spaces, dashes, or underscores.')
  }

  const { data, error } = await requireSupabase()
    .from('player_profiles')
    .update({ display_name: cleanName })
    .eq('user_id', userId)
    .select('display_name')
    .single()
  // The database rejects offensive names with a message meant for the player.
  if (error?.code === '23514') throw new Error(error.message)
  if (error) throw error
  return data.display_name
}

// Runs that have not reached the server yet, one (the highest) per challenge date.
const PENDING_RUNS_KEY = 'afterlight.pendingRuns'
type PendingRuns = Record<string, { placementTicks: number[]; height: number }>

function readPendingRuns(): PendingRuns {
  try {
    const runs = JSON.parse(window.localStorage.getItem(PENDING_RUNS_KEY) ?? '{}')
    return runs && typeof runs === 'object' && !Array.isArray(runs) ? runs : {}
  } catch {
    return {}
  }
}

function writePendingRuns(runs: PendingRuns) {
  try {
    if (Object.keys(runs).length > 0) window.localStorage.setItem(PENDING_RUNS_KEY, JSON.stringify(runs))
    else window.localStorage.removeItem(PENDING_RUNS_KEY)
  } catch {
    // Without storage the run is only kept until the page closes.
  }
}

export function rememberPendingRun(challengeDate: string, placementTicks: number[], height: number) {
  const runs = readPendingRuns()
  if ((runs[challengeDate]?.height ?? -1) >= height) return
  writePendingRuns({ ...runs, [challengeDate]: { placementTicks, height } })
}

function forgetPendingRun(challengeDate: string, placementTicks: number[]) {
  const runs = readPendingRuns()
  if (JSON.stringify(runs[challengeDate]?.placementTicks) !== JSON.stringify(placementTicks)) return
  delete runs[challengeDate]
  writePendingRuns(runs)
}

export async function submitDailyScore(challengeDate: string, placementTicks: number[]) {
  const { data, error } = await requireSupabase().functions.invoke('submit-score', {
    body: { challengeDate, placementTicks },
  })
  if (!error) {
    forgetPendingRun(challengeDate, placementTicks)
    return data as ScoreSubmission
  }

  const status = error instanceof FunctionsHttpError ? (error.context as Response).status : 0
  // 400/413 mean the server will never accept this run (expired or invalid), so stop retrying it.
  if (status === 400 || status === 413) {
    forgetPendingRun(challengeDate, placementTicks)
    const body = await (error.context as Response).json().catch(() => null)
    throw new Error(typeof body?.error === 'string' ? body.error : 'This run could not be verified.')
  }
  throw new Error('Could not sync · saved on this device and will retry on your next visit.')
}

export async function retryPendingRuns() {
  for (const [challengeDate, run] of Object.entries(readPendingRuns())) {
    await submitDailyScore(challengeDate, run.placementTicks).catch(() => undefined)
  }
}
