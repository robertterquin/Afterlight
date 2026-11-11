# Afterlight — Phase 1: Rules and Screen Flow

Status: proposed implementation baseline
Platform: browser-first, desktop and mobile web
Release scope: one endless daily climb with a shared leaderboard

## Game premise

Players stack moving stone platforms to raise a beacon between floating islands. Accurate placements send a pulse of light across the scene. The competition is about tower height on the same daily course.

## Core run rules

- A run starts when the player selects **Start climb**. One platform then moves horizontally above the tower.
- The platform reverses at the playfield edges. Players place it with tap, click, or Space.
- On placement, only the horizontal overlap with the previous platform remains. The overhang falls away.
- A placement is **perfect** when its center is within 5 logical units of the previous platform's center. A perfect placement snaps into alignment and preserves the full width.
- A non-perfect placement keeps the overlap width and resets the current perfect streak.
- If the proposed overlap is under 48 logical units, the drop misses and the run ends without counting that platform. The foundation is not included in the height score.
- Height is the primary score. The best single run for each player is submitted for that day; retries are unlimited.
- Initial tuning values: 1,000 logical units across the playfield, a 220-unit starting platform, and 300 units/second starting speed. Speed rises 5% every five placed platforms and caps at 2.2× the starting speed. These values are tuning targets for Phase 2, not playtest-validated balance.

## Daily challenge and ranking

- One challenge seed is derived from the UTC date. The course changes at 00:00 UTC daily (08:00 in the Philippines).
- The seed determines a shared wind sequence. Every five floors, the wind modifier changes to a seeded value from −8% to +8% of current speed; all players receive the same sequence. The 2.2× speed cap applies after the wind modifier.
- The challenge can be replayed as often as the player wants. Only their best run that day appears on the board.
- Rank by height, then total perfect placements, then earliest server-accepted score time.
- The client records each placement at a fixed simulation tick. The server replays the inputs against the daily seed before accepting a score. This is basic score validation, not cheat-proof competitive security.

## Reward and presentation rules

- Every successful placement gives a small stone-settle animation and sound; perfect placement adds a brighter pulse.
- Every five perfect placements in a run lights another set of windows or an island detail. This is visual progress only and does not affect the score or physics.
- A broken streak does not remove lights already earned during that run. A new run starts the scene's run-based light progress over.
- No lives, paid boosts, random rewards, streak penalties, or forced return reminders are in the first release.

## Screen layout and states

### Desktop

- Keep the game scene as the main area, with the daily leaderboard in a compact side panel.
- Show only the Afterlight mark, height, sound and pause controls, and one placement cue during play.
- The board shows the top three, the player's own best rank, and the shared-course note.

### Mobile web

- Let the game scene fill the screen width and keep tap as the primary input.
- Open the leaderboard from a single board control as a drawer or sheet, so it does not cover the moving platform during a run.
- Hide the Space hint on touch-first layouts; keep keyboard controls when a keyboard is available.

### Run flow

1. **Ready:** show the tower, daily board, and one **Start climb** action.
2. **Playing:** moving platform, height, placement cue, pause and sound controls.
3. **Paused:** resume or end the current run.
4. **Run over:** show height, personal best, and score submission status; offer **Try again**.
5. **Board updated:** refresh the player's rank after a verified score is accepted. If submission fails, keep the local result and offer retry.

There is no separate tutorial screen in v1; the placement cue explains the only control. A player's display name is generated for them and can be edited from the board. No email or password is required.

## Technical decisions carried into later phases

- React + TypeScript + Vite; SVG scene with browser animation APIs; no game engine.
- Vercel hosts the web client. Supabase provides anonymous identity, Postgres, and Edge Functions.
- The client never writes a ranked score directly to the leaderboard table. The score endpoint validates the run first.
- Personal best and sound preference are saved locally. Ranked submissions require a connection.

## Phase 1 completion criteria

- The scoring, placement, failure, daily reset, wind, and tie-break rules are defined above.
- Desktop and mobile layouts, plus ready, playing, paused, and run-over states, are defined above.
- Phase 2 can begin without a remaining product decision about the core loop. Movement and difficulty numbers may be adjusted through playtesting.
