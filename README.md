# Afterlight

Browser-first stacking game prototype built with React, TypeScript, and Vite.

## Run locally

```sh
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and add the Supabase project URL and public API key. The app accepts a publishable key or a legacy anon key; never put a secret or `service_role` key in a `VITE_` variable.

## Controls

- Select **Start climb** to begin.
- Tap or click the playfield to place a moving stone; press **Space** to place by keyboard.
- Use the pause button or **Escape** to pause and resume.
- Use the sound button to mute or enable placement feedback; the preference is saved in this browser.

The prototype includes block overlap, perfect placements, height scoring, a speed increase every five stones, miss detection, replay, placement sounds, and settling animations. Every fifth consecutive perfect landing grows the new block by 60 logical units, up to 340; a non-perfect placement resets the streak. Every five perfect placements also lights another beacon detail; this is visual progress only.

## Animation

Motion for React powers the camera easing, block landings, falling overhangs, water impacts, and state-panel transitions. Trimmed stone pieces now fall into the ocean with a small ripple; a final miss makes a stronger splash. Every fifth consecutive perfect landing sends a beacon flare across the tower, lights island windows in sequence, and sends a wave across the sea without changing scoring. The daily wind steers slow cloud ribbons while distant beacon islands drift at different rates as the tower climbs. Over the first 36 floors, the sky warms toward dawn as the stars and moonlight fade. CSS also adds subtle star and water movement. Animations respect the device's reduced-motion setting.

## Daily challenge

The challenge date uses UTC (`YYYY-MM-DD`) and changes at 00:00 UTC. FNV-1a hashes that date into the daily seed. Wind changes every five floors: each segment uses Mulberry32 seeded with the daily seed XOR the segment number multiplied by `0x9e3779b9`, then maps its first value to an integer from −8% to +8%. The wind modifier is applied before the 2.2× speed cap.

The game simulation advances at a fixed 60 ticks per second. Each placement, including the final miss, records its simulation tick so the score function can replay the run against the same daily seed.

## Daily leaderboard

The leaderboard uses Supabase anonymous sign-in, a public daily board, and a verified score function. The client submits placement ticks only; the Edge Function replays them using the shared game engine before saving the player's best score for that UTC date. Display names can be edited from the board.

Before enabling ranked play:

1. Enable **Anonymous sign-ins** in Supabase Authentication settings.
2. Apply `supabase/migrations/20261112034907_leaderboard_schema.sql` to the project.
3. Deploy `supabase/functions/submit-score` with JWT verification enabled.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel. The legacy anon key is also supported as a fallback.

Never put a Supabase secret or `service_role` key in the browser or a `VITE_` variable. Without a working Supabase setup, the game remains playable, but scores stay local and do not appear on the shared board.
