import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"
import { verifyRun } from "../_shared/verify-run.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const json = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: corsHeaders })

const submit = withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405)

  const playerId = ctx.userClaims?.id
  if (!playerId) return json({ error: "Sign in before submitting a score." }, 401)

  const contentLength = Number(req.headers.get("content-length") ?? 0)
  if (contentLength > 32_768) return json({ error: "Run data is too large." }, 413)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: "Invalid request body." }, 400)
  }
  const run = verifyRun(body)
  if ("error" in run) return json({ error: run.error }, 400)
  const { challengeDate } = body as { challengeDate: string }

  const { data: personalBest, error } = await ctx.supabaseAdmin.rpc("record_daily_score", {
    p_player_id: playerId,
    p_challenge_date: challengeDate,
    p_height: run.height,
    p_perfects: run.perfects,
    p_tower_profile: run.towerProfile,
  })

  if (error) {
    console.error("Could not record verified Afterlight score", error)
    return json({ error: "Your score could not be saved. Please try again." }, 500)
  }

  return json({ accepted: true, personalBest: personalBest === true, height: run.height, perfects: run.perfects })
})

export default {
  fetch: async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
    return await submit(req)
  },
}
