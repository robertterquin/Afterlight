import { ensureAnonymousUser, supabase } from './supabase'

export const isConfigured = () => Boolean(supabase)

export type LeaderboardEntry = {
  rank: number
  display_name: string
  height: number
  perfects: number
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
  if (error) throw error
  return data.display_name
}

export async function submitDailyScore(challengeDate: string, placementTicks: number[]) {
  const { data, error } = await requireSupabase().functions.invoke('submit-score', {
    body: { challengeDate, placementTicks },
  })
  if (error) throw error
  return data as ScoreSubmission
}
