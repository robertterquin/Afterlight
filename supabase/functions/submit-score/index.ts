import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"
import {
  advanceGame,
  createGame,
  getUtcDate,
  heightOf,
  placeBlock,
  seedForDate,
  startGame,
} from "../_shared/game-engine.ts"

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
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Invalid request body." }, 400)
  }

  const { challengeDate, placementTicks } = body as {
    challengeDate?: unknown
    placementTicks?: unknown
  }
  if (typeof challengeDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(challengeDate)) {
    return json({ error: "Invalid challenge date." }, 400)
  }

  const parsedDate = new Date(`${challengeDate}T00:00:00.000Z`)
  if (Number.isNaN(parsedDate.getTime()) || getUtcDate(parsedDate) !== challengeDate) {
    return json({ error: "Invalid challenge date." }, 400)
  }

  const today = getUtcDate()
  const yesterdayDate = new Date(`${today}T00:00:00.000Z`)
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1)
  const yesterday = getUtcDate(yesterdayDate)
  if (challengeDate !== today && challengeDate !== yesterday) {
    return json({ error: "This daily challenge has expired." }, 400)
  }

  if (
    !Array.isArray(placementTicks)
    || placementTicks.length < 1
    || placementTicks.length > 500
    || !placementTicks.every((tick) => Number.isSafeInteger(tick) && tick >= 0 && tick <= 180_000)
  ) {
    return json({ error: "Invalid placement history." }, 400)
  }

  let game = startGame(createGame({ date: challengeDate, seed: seedForDate(challengeDate) }))
  let previousTick = -1
  for (const tick of placementTicks as number[]) {
    if (tick < previousTick || game.phase !== "playing") {
      return json({ error: "The run could not be verified." }, 400)
    }
    while (game.tick < tick) game = advanceGame(game)
    if (game.tick !== tick || game.phase !== "playing") {
      return json({ error: "The run could not be verified." }, 400)
    }
    game = placeBlock(game)
    previousTick = tick
  }

  const height = heightOf(game)
  if (height < 1) return json({ error: "Place at least one stone to submit a score." }, 400)

  const { data: personalBest, error } = await ctx.supabaseAdmin.rpc("record_daily_score", {
    p_player_id: playerId,
    p_challenge_date: challengeDate,
    p_height: height,
    p_perfects: game.perfects,
  })

  if (error) {
    console.error("Could not record verified Afterlight score", error)
    return json({ error: "Your score could not be saved. Please try again." }, 500)
  }

  return json({ accepted: true, personalBest: personalBest === true, height, perfects: game.perfects })
})

export default {
  fetch: async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
    return await submit(req)
  },
}
