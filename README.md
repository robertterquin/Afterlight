# Afterlight

Browser-first stacking game prototype built with React, TypeScript, and Vite.

## Run locally

```sh
npm install
npm run dev
```

## Controls

- Select **Start climb** to begin.
- Tap or click the playfield to place a moving stone; press **Space** to place by keyboard.
- Use the pause button or **Escape** to pause and resume.
- Use the sound button to mute or enable placement feedback; the preference is saved in this browser.

The prototype includes block overlap, perfect placements, height scoring, a speed increase every five stones, miss detection, replay, placement sounds, and settling animations. Every fifth consecutive perfect landing grows the new block by 60 logical units, up to 340; a non-perfect placement resets the streak. Every five perfect placements also lights another beacon detail; this is visual progress only.

## Animation

Motion for React powers the camera easing, block landings, falling overhangs, and state-panel transitions. The daily wind steers slow cloud ribbons while distant beacon islands drift at different rates as the tower climbs. Over the first 36 floors, the sky warms toward dawn as the stars and moonlight fade. CSS also adds subtle star and water movement. Animations respect the device's reduced-motion setting.

## Daily challenge

The challenge date uses UTC (`YYYY-MM-DD`) and changes at 00:00 UTC. FNV-1a hashes that date into the daily seed. Wind changes every five floors: each segment uses Mulberry32 seeded with the daily seed XOR the segment number multiplied by `0x9e3779b9`, then maps its first value to an integer from −8% to +8%. The wind modifier is applied before the 2.2× speed cap.

The game simulation advances at a fixed 60 ticks per second. Each placement, including the final miss, records its simulation tick in the run state so a later server can replay the inputs against the same daily seed.
