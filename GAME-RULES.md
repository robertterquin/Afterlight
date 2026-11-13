# Afterlight — Game rules and screen flow

Status: current. Matches the game as of 13 November 2026.
Live at: https://playafterlight.vercel.app
Platform: browser, desktop and mobile web.

The numbers below come from the shared engine in `supabase/functions/_shared/game-engine.ts`. The browser and the score server both run that same file. If the two ever disagree, the code wins: update this document.

## Game premise

Players stack moving stones to raise a beacon tower on an island in an open sea. The tower climbs from the water through the clouds, past dawn and into the night sky. Everyone plays the same course each day, and the competition is tower height.

## Core run rules

- A run starts with **Start climb**. A stone then slides back and forth across the playfield, entering from alternating sides each floor. Players drop it with a tap, a click, or Space.
- On landing, only the part that overlaps the stone below stays. The overhang breaks off and falls.
- A drop is **perfect** when its centre is within 8 units of the stone below. At higher speeds the window widens to the distance the stone moves in one simulation tick, so fast drops stay fair. A perfect drop snaps exactly into place, and nothing breaks off.
- **Growing the stone:** the 5th perfect drop in a row makes the next stone 32 units wider. Each further perfect in the same streak adds 18 more, up to 340 units. A non-perfect drop resets the streak.
- **Missing:** if the overlap is under 48 units, the stone falls and the run ends. That stone doesn't count, and neither does the foundation stone.
- **Score:** height, the number of stones placed. Retries are unlimited, and only each player's best run of the day counts.
- **Tuning values:**
  - the playfield is 1,000 units wide, and stones move between 90 and 910
  - stones start 220 units wide and 68 tall
  - the starting speed is 300 units a second
  - speed rises 5% every five floors, up to 2.2× the starting speed
  - the game simulates at 60 ticks a second

## Daily challenge and ranking

- **Daily course:** a seed derived from the UTC date sets the day's course. It changes at 00:00 UTC, which is 08:00 in the Philippines.
- **Wind:** the first five floors are calm. After that, every five floors the wind changes to a seeded value from −8% to +8% of the current speed, and every player gets the same sequence. The 2.2× speed cap applies after the wind.
- **Course look:** seven courses rotate in a fixed weekly loop by UTC day number, so none repeats within a week: Ember tide, Frost tide, First light, Violet hour, Salt moon, Basalt night, Storm glass. The look is cosmetic only and doesn't change the rules.
- **Ranking:** by height, then total perfect drops, then the earliest time the server accepted the score.
- **Score checking:** the game records the tick of each drop. The server replays those drops against the day's seed before accepting a score, and keeps only each player's best. This is basic score checking, not cheat-proof security.
- **Late scores:** the server accepts runs for today and yesterday. A run that finishes just before the reset, or was saved offline, still counts.
- **The board:** it shows the top ten, plus the player's own row when they rank lower. It refreshes every 30 seconds and when the player comes back to the tab, but not during a run.

## Player names

- Every player starts with a generated name such as `Beacon-52A6`. No email or password is needed; each browser is its own anonymous player.
- Names can be edited from the board: 3–18 letters, numbers, spaces, dashes or underscores.
- The database blocks offensive names in English and Filipino, including spellings with numbers and spaced-out letters. A blocked name shows "That name isn't allowed. Try another." Generated names are always allowed.

## Rewards and presentation

All of these are visual and sound only. None of them affect the score or the physics.

- **Landing:** each landing gives a settle bounce and a stone sound. A perfect drop adds a glass bell, rising in pitch through the streak.
- **5th perfect in a row:** the stone grows, with a beacon pulse, a lighthouse flash and a celebration chime.
- **Waystones:** every five perfect drops in a run lights a waystone on the islands. A broken streak doesn't put them out, and a new run starts dark again.
- **Offcuts:** they splash into the sea, or puff into the clouds once the cloud sea covers the water. Above 40 stones the puff takes the night colours, with a moonlit edge and rising sparks.
- **The climb, by height:**

  | Stones | What happens |
  |---|---|
  | 7–15 | clouds drift past |
  | from 8 | birds fly by |
  | 14–22 | the cloud sea rises below |
  | 26–36 | the high sky darkens, with aurora and a shooting star; dawn is complete by 36 |
  | 40–55 | the edge of the sky: night returns, the stars come out, and the cloud sea curves with a dawn rim |
  | 62–78 | every second stone, the beacon links one more star into a gold chain |
  | 94–100 | seven stars tracing the Afterlight mark appear two at a time; at 100 the top star lights with a chime |

- **Haptics (Android):** a short tick when a stone lands, a double tick on a perfect drop, a stronger rising pattern when the stone grows, a longer buzz on a miss, and a celebratory pattern at 100. iPhones don't let websites vibrate. The sound button turns vibration off too.
- There are no lives, paid boosts, random rewards, streak penalties or reminder notifications.

## Coming back each day

- **Daily streak**, kept on the device:
  - A day counts when a run ends with at least one stone.
  - The ready screen shows the last seven days as beacons, with one line: "4-day streak · climb today to make it 5", or after a break, "Best streak 9 days · start a new one today".
  - The first finished run of the day shows "Day N · streak kept" when it continues a streak of two days or more.
  - Nothing shows on a player's first day.
- **Yesterday's podium:** after a top-3 finish, the next day's ready screen shows "Yesterday you finished #2" with the board's gold, silver or bronze badge. Fourth place or lower shows nothing.
- **Share card:** each run is drawn as a 1080×1350 picture of the actual tower on that day's course, with perfect drops in gold.
  - Phones share the picture with just the game link through the phone's share sheet.
  - Computers copy a one-line text version, and also get a **Save image** link.

## Screens

### Desktop

- The game scene is the main area, with the daily board in a side panel.
- During play the screen shows the height, the wind, the perfect streak once it starts, the sound and pause controls, and a drop hint on the first stone. On wide screens, a height ladder shows the player against the podium and their own best.

### Mobile web

- The game fills the screen under the header, with equal gaps above and below. Tapping anywhere drops the stone.
- The board opens as a sheet from the menu button, so it never covers a run.
- Phones and tablets get lighter effects for smooth play on older devices. Glows use gradients instead of blur, panels are solid instead of frosted glass, and the subtle looping animations hold still.
- The Space hint is hidden on touch screens.

### Run flow

1. **Ready:** the day's course name, date and countdown to the next course; the streak and yesterday's podium when they apply; **Start climb**; and the player's best and rank today.
2. **Playing:** the moving stone and the play display described above.
3. **Paused:** resume or end the run.
4. **Run over:** "The tide keeps it" after a miss, or "The beacon rests" after ending from pause. Then the height, the perfect drops, "new best today" when it is one, and the streak line when it applies. Below that, **Climb again** and Share (plus Save image on computers). Problems saving the score show here with a retry.
   - The result fades in about a second after the run ends. It ignores taps until it is fully visible, so a player still tapping can't skip it by accident.
5. **Board updated:** the board refreshes after the server accepts a score.

There is no separate tutorial; the drop hint explains the only control.

## Technical decisions

- **App:** React 19, TypeScript and Vite, with Motion for animation. The scene is a single SVG, and no game engine is used.
- **Hosting and data:** Vercel hosts the site. Supabase provides anonymous sign-in, the Postgres database, and the `submit-score` Edge Function.
- **Scores:** the browser never writes a ranked score directly. The score endpoint replays and validates every run first.
- **Saved on the device:** the sound setting, the daily streak, and any runs not yet sent to the server. Ranked scores need a connection.
- **Tests:** `npm test` runs the streak rules tests.
- **Showreel:** a 15-second promo video lives in `showreel/` as a separate Remotion project.
