# Afterlight showreel

A 15-second (900 frames at 60 fps) motion-graphics reel for Afterlight, built with Remotion. It lives apart from the game; the only shared code is the game's deterministic engine (`supabase/functions/_shared/game-engine.ts`), which plays the run the reel shows.

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
| 90–390 | Escalation | Wide shot. An offcut tumbles into the sea, then five perfects in a quickening rhythm light the streak meter; the fifth grows the stone, sends the beacon pulse up the tower and flashes the lighthouse. "Five perfect. It grows." |
| 390–690 | Depth | Vertical whip into a 29-drop time-lapse climb through the cloud belt to dawn, under a 2.5D sweep of four parallax planes. "Past the clouds." with a floor count, then "Seven tides. One a day." as whip pans cycle all seven daily courses. |
| 690–900 | Climax | The final drop is the fifth perfect at dawn. The camera pushes into the top three stones and the beacon, which match-cut into the logo mark while the view tilts up into the night sky. Title, tagline and URL; light, aurora, stars and motes keep moving to the last frame. |

## Files

- `src/run.ts` scripts a player through the engine (`createGame`, `startGame`, `advanceGame`, `placeBlock`) and maps engine ticks onto video frames, with a self-check that every drop lands as planned.
- `src/World.tsx` is the game's scene art from `src/App.tsx`, with every animation driven by the frame number.
- `src/camera.ts` holds the camera keyframes, impact shake, zoom punches and whip pans; `src/Stage.tsx` lays the parallax planes out in 3D.
- `src/Overlay.tsx` holds the kinetic type, streak meter, course carousel, match-cut mark and title lockup, plus grain and vignette.
- `src/editions.ts` is a copy of the game's seven course palettes.
