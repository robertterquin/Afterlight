# Afterlight showreel

A 20-second (1200 frames at 60 fps) motion-graphics reel for Afterlight, built with Remotion. It lives apart from the game; the only shared code is the game's deterministic engine (`supabase/functions/_shared/game-engine.ts`), which plays the run the reel shows.

```sh
npm install
npm run dev      # Remotion Studio
npm run stills   # review stills in out/stills/
npm run render   # out/showreel-landscape.mp4 and out/showreel-portrait.mp4
```

Compositions (both in `src/Root.tsx`): `ShowreelLandscape` (1920×1080) and `ShowreelPortrait` (1080×1920). Sound stems are synthesized by `scripts/make-audio.mjs` into `public/audio/` (ignored by git); the stone landings are copied from the game's `public/sfx/`.

## Beats

| Frames | Beat | What happens |
| --- | --- | --- |
| 0–90 | Cold open | Mid-slide close-up; a perfect drop lands on frame 8 with a flash, zoom punch and sub hit. "Drop. Stack. Climb." snaps in on three impacts. Zoom-whip out. |
| 90–380 | Escalation | Wide shot. An offcut tumbles into the sea, then five perfects in a quickening rhythm light the streak meter; the fifth grows the stone, sends the beacon pulse up the tower and flashes the lighthouse. "Five perfect. It grows." |
| 380–474 | Seven tides | At sea level, whip pans swap all seven daily courses around the island: sky, moon, sea, islets and stones. "Seven tides. One a day." |
| 474–690 | The climb | One whip up starts a single unbroken climb: a time-lapse from floor 10 through the cloud belt to dawn under a 2.5D sweep of four parallax planes. "Past the clouds." with a floor count. |
| 690–1000 | Above the sky | The same climb speeds up from floor 39 to 99. Night returns over the curved, rim-lit cloud sea; sky lanterns rise from 42 to 60, shooting stars cross, a faint star chain links from 62, and the season's zodiac constellation (Scorpio for the reel's date) forms a third at a time at 94, 96 and 98. "Higher still. Into the stars.", then "Reach 100. Wake the stars." |
| 1000–1200 | Climax | The final perfect drop is floor 100: the constellation's brightest star (Antares) flares. The camera pushes into the top three stones and the beacon, which match-cut into the logo mark while the view tilts down to the sea at dawn under the constellation. Title, tagline and URL. |

## Files

- `src/run.ts` scripts a player through the engine (`createGame`, `startGame`, `advanceGame`, `placeBlock`) and maps engine ticks onto video frames, with a self-check that every drop lands as planned.
- `src/World.tsx` is the game's scene art from `src/App.tsx`, with every animation driven by the frame number.
- `src/camera.ts` holds the camera keyframes, impact shake, zoom punches and whip pans; `src/Stage.tsx` lays the parallax planes out in 3D.
- `src/Overlay.tsx` holds the kinetic type, streak meter, course carousel, match-cut mark and title lockup, plus grain and vignette.
- `src/UpperSky.tsx` is the game's sky above the clouds (night, lanterns, shooting stars, star chain, zodiac constellation) on a still plane that ignores the camera, as in the game. The constellation comes from the game's `src/zodiac.ts`.
- `src/editions.ts` is a copy of the game's seven course palettes, including their cloud and night tones.
