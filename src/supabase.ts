import { createClient, type User } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

let anonymousUserRequest: Promise<User> | null = null

export async function ensureAnonymousUser() {
  if (!supabase) throw new Error('Supabase is not configured.')

  if (!anonymousUserRequest) {
    anonymousUserRequest = (async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      if (sessionData.session?.user) return sessionData.session.user

      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) throw error
      if (!data.user) throw new Error('Could not create an anonymous player.')
      return data.user
    })()
  }

  try {
    return await anonymousUserRequest
  } finally {
    anonymousUserRequest = null
  }
}
