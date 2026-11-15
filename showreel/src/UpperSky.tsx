// The sky above the clouds (40+ stones), ported from the game's UpperSky, SkyLanterns and ShootingStars in
// src/App.tsx with every animation driven by the frame. It sits on a still plane: like the game's sky, it does
// not follow the camera, so the constellation stays put through the match-cut and the title.
import { useMemo } from 'react'
import { interpolate } from 'remotion'
import { brightestStar, zodiacForDate } from '../../src/zodiac.ts'
import { blendColor, type DailyEdition } from './editions.ts'
import { clamp, EASE, MATCH_CUT, smoothstep, type Layout } from './layout.ts'
import { DATE, floorFrame } from './run.ts'
import { bounds } from './World.tsx'

const round1 = (value: number) => Math.round(value * 10) / 10

function seededRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

const dot = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`

// As in the game: night from 40 to 55, lanterns every third stone from 42 to 60, the star chain every second
// stone from 62, the constellation a third at a time from 94, its brightest star at 100.
const STAR_CHAIN = [[200, 0.7], [255, 0.48], [310, 0.62], [370, 0.3], [440, 0.12], [560, 0.08], [700, 0.22], [720, 0.6], [770, 0.42], [800, 0.7]] as const
const LANTERN_FLOORS = [42, 45, 48, 51, 54, 57, 60]
const LANTERN_FLIGHT = 170
const SHOOTING_FLOORS = [64, 76, 88]
const SIGN = zodiacForDate(DATE)
const HERO = brightestStar(SIGN)

/** Where the constellation sits, in view units: right of the tower in landscape, below the title in portrait. */
function signPlacement(layout: Layout) {
  return layout.format === 'portrait' ? { scale: 2.8, x: 655, y: 480 } : { scale: 3.4, x: 864, y: 40 }
}

export function UpperSkyLayer({ layout, frame, edition, height }: { layout: Layout; frame: number; edition: DailyEdition; height: number }) {
  const portrait = layout.format === 'portrait'
  const { horizon } = layout
  const palette = edition.night
  const box = bounds(layout, 1.2)
  const edge = smoothstep(40, 55, height)
  const stars = useMemo(() => {
    const random = seededRandom(97)
    let faint = ''
    let bright = ''
    for (let index = 0; index < 420; index += 1) {
      const x = round1(box.left + random() * (box.right - box.left))
      const y = round1(box.top + Math.pow(random(), 1.15) * (horizon * 0.95 - box.top))
      const radius = random() > 0.9 ? 1.8 : 1
      if (radius > 1) bright += dot(x, y, radius)
      else faint += dot(x, y, radius)
    }
    return { faint, bright }
  }, [box.left, box.right, box.top, horizon])
  if (edge <= 0) return null
  const horizonShare = (horizon - box.top) / (horizon + 160 - box.top)
  const gapColor = blendColor(palette.sky[2], palette.cloudShade, 0.35)
  // The tilt into the title moves the clouds away and reveals the sea at dawn again.
  const gapCover = interpolate(frame, [MATCH_CUT, MATCH_CUT + 50], [1, 0], clamp)

  const chain = STAR_CHAIN.map(([x, share]) => ({ x, y: round1(horizon * (portrait ? 0.27 + share * 0.6 : share)) }))
  const place = signPlacement(layout)
  const signStars = SIGN.stars.map(([x, y, magnitude, color]) => ({
    x: round1(place.x + x * place.scale),
    y: round1(place.y + y * place.scale),
    // Sized by real brightness, a little larger than in the game for a 1080p frame.
    r: round1(Math.max(1.6, 2.1 + (5 - magnitude) * 1.5)),
    color,
  }))
  const thirds = [94, 96, 98].map(floorFrame)
  const heroAt = floorFrame(100)
  // Each star belongs to the third of the constellation it appears with.
  const starAt = (index: number) => thirds[Math.min(2, Math.floor((index * 3) / signStars.length))]!
  const sparkle = (index: number) => 0.7 + 0.3 * Math.sin(frame / 13 + index * 1.9)

  return (
    <g>
      <defs>
        <linearGradient id="upper-night" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={box.top} y2={horizon + 160}>
          <stop stopColor={palette.sky[0]} stopOpacity=".96" />
          <stop offset={round1(horizonShare * 0.6 * 1000) / 1000} stopColor={palette.sky[1]} stopOpacity=".8" />
          <stop offset={round1(horizonShare * 1000) / 1000} stopColor={palette.sky[2]} stopOpacity=".5" />
          <stop offset="1" stopColor={palette.sky[2]} stopOpacity="0" />
        </linearGradient>
        {/* Covers the gap the parallax opens between this still sky and the cloud sea, so no daytime sea shows. */}
        <linearGradient id="upper-gap" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={horizon - 60} y2={horizon + 40}>
          <stop stopColor={gapColor} stopOpacity="0" />
          <stop offset="1" stopColor={gapColor} stopOpacity=".94" />
        </linearGradient>
        <radialGradient id="upper-flare">
          <stop stopColor="#fffaf2" stopOpacity=".9" />
          <stop offset=".35" stopColor={SIGN.stars[HERO]![3]} stopOpacity=".35" />
          <stop offset="1" stopColor={SIGN.stars[HERO]![3]} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="lantern-glow">
          <stop stopColor="#ffd59a" stopOpacity=".75" />
          <stop offset="1" stopColor="#ffb46a" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Night returns overhead and the stars come out. */}
      <g opacity={edge}>
        <rect x={box.left} y={box.top} width={box.right - box.left} height={horizon + 160 - box.top} fill="url(#upper-night)" />
        <rect x={box.left} y={horizon - 60} width={box.right - box.left} height={box.bottom - horizon + 60} fill="url(#upper-gap)" opacity={gapCover} />
        <path d={stars.faint} fill="#f4ecdc" opacity=".7" />
        <path d={stars.bright} fill="#fff6e6" opacity={0.75 + 0.25 * Math.sin(frame / 17)} />
      </g>

      {/* Sky lanterns rise from behind the cloud sea, sway and fade among the stars. */}
      {LANTERN_FLOORS.map((floor) => {
        const t = frame - floorFrame(floor)
        if (t < 0 || t > LANTERN_FLIGHT) return null
        const random = seededRandom(floor * 7919 + 13)
        const x = round1(random() < 0.5 ? 130 + random() * 270 : 600 + random() * 270) + (portrait ? 0 : (random() - 0.5) * 300)
        const scale = (2.3 + random() * 0.8) * (portrait ? 1.3 : 1)
        const sway = 8 + random() * 10
        const progress = t / LANTERN_FLIGHT
        const rise = EASE.out(progress)
        const startY = horizon + 8
        const endY = horizon * (portrait ? 0.3 : 0.12)
        const y = startY + (endY - startY) * rise
        const dx = Math.sin(progress * Math.PI * 1.6) * sway
        const opacity = interpolate(progress, [0, 0.12, 0.72, 1], [0, 0.95, 0.9, 0], clamp)
        return (
          <g key={floor} transform={`translate(${round1(x + dx)} ${round1(y)}) scale(${round1(scale * 100) / 100})`} opacity={opacity}>
            <circle r="20" fill="url(#lantern-glow)" />
            <path d="M-5 -7H5L6.5 6H-6.5Z" fill="#ffcf8a" />
            <path d="M-5 -7H5L5.6 -2H-5.6Z" fill="#ffe2b4" opacity=".7" />
            <rect x="-6" y="4.6" width="12" height="2.2" rx="1" fill="#e89a55" />
            <circle cy="8.6" r="1.2" fill="#fff3d0" />
          </g>
        )
      })}

      {/* Shooting stars: one short streak each, drawn on and faded over about a second. */}
      {[...SHOOTING_FLOORS.map(floorFrame), 1100].map((at, index) => {
        const t = frame - at - 8
        if (t < 0 || t > 66) return null
        const random = seededRandom(at * 104729 + 7)
        const x = portrait ? 140 + random() * 480 : -200 + random() * 700
        const y = portrait ? horizon * (0.15 + random() * 0.3) : horizon * (0.04 + random() * 0.2)
        const length = 220 + random() * 120
        const drawn = interpolate(t, [0, 36], [0, 1], { ...clamp, easing: EASE.out })
        const opacity = interpolate(t, [0, 10, 36, 66], [0, 1, 0.9, 0], clamp)
        const tailFrom = interpolate(t, [20, 66], [0, 0.85], clamp)
        const dx = length
        const dy = length * 0.36
        return (
          <g key={index} opacity={opacity}>
            <path
              d={`M${round1(x + dx * tailFrom)} ${round1(y + dy * tailFrom)}L${round1(x + dx * drawn)} ${round1(y + dy * drawn)}`}
              stroke="#fff6e0"
              strokeWidth="2.4"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx={round1(x + dx * drawn)} cy={round1(y + dy * drawn)} r="2.6" fill="#fffaf0" />
          </g>
        )
      })}

      {/* The star chain: a faint gold link per two stones from 62; its lines fade once the constellation forms. */}
      {chain.map((star, index) => {
        const at = floorFrame(62 + index * 2)
        if (frame < at) return null
        const appear = interpolate(frame, [at, at + 12], [0, 1], clamp)
        const previous = chain[index - 1]
        const drawn = interpolate(frame, [at, at + 24], [0, 1], { ...clamp, easing: EASE.out })
        const lineOpacity = 0.32 * interpolate(frame, [thirds[0]!, thirds[0]! + 40], [1, 0], clamp)
        return (
          <g key={index}>
            {previous && lineOpacity > 0 && (
              <path
                d={`M${previous.x} ${previous.y}L${round1(previous.x + (star.x - previous.x) * drawn)} ${round1(previous.y + (star.y - previous.y) * drawn)}`}
                stroke={palette.line}
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity={lineOpacity}
              />
            )}
            <circle cx={star.x} cy={star.y} r="2.4" fill="#fff0c9" opacity={0.75 * appear} />
          </g>
        )
      })}

      {/* The season's constellation: a third of its stars at 94, 96 and 98; its brightest star lights at 100. */}
      {SIGN.lines.map(([from, to]) => {
        const at = Math.max(starAt(from), starAt(to))
        if (frame < at) return null
        const a = signStars[from]!
        const b = signStars[to]!
        const length = Math.hypot(b.x - a.x, b.y - a.y)
        // Like a star chart, each line stops just short of its stars.
        const gapA = (a.r + 6) / length
        const gapB = (b.r + 6) / length
        if (gapA + gapB >= 1) return null
        const drawn = interpolate(frame, [at + 4, at + 40], [0, 1], { ...clamp, easing: EASE.out })
        const x1 = a.x + (b.x - a.x) * gapA
        const y1 = a.y + (b.y - a.y) * gapA
        const x2 = x1 + (b.x - (b.x - a.x) * gapB - x1) * drawn
        const y2 = y1 + (b.y - (b.y - a.y) * gapB - y1) * drawn
        return <path key={`${from}-${to}`} d={`M${round1(x1)} ${round1(y1)}L${round1(x2)} ${round1(y2)}`} stroke={palette.line} strokeWidth="1.3" strokeLinecap="round" opacity=".55" />
      })}
      {signStars.map((star, index) => {
        const at = starAt(index)
        if (frame < at) return null
        const pop = interpolate(frame, [at, at + 24], [0.2, 1], { ...clamp, easing: EASE.out })
        const appear = interpolate(frame, [at, at + 14], [0, 1], clamp)
        return (
          <g key={index} opacity={appear} transform={`translate(${star.x} ${star.y}) scale(${round1(pop * 100) / 100})`}>
            <circle r={round1(star.r * 2.6)} fill={star.color} opacity=".14" />
            <circle r={star.r} fill={star.color} opacity={index === HERO ? 1 : sparkle(index)} />
          </g>
        )
      })}
      {frame >= heroAt && (() => {
        const hero = signStars[HERO]!
        const t = frame - heroAt
        const flare = interpolate(t, [0, 40, 108], [0, 1, 0.6], clamp) * (1 + 0.06 * Math.sin(t / 15))
        const flareScale = interpolate(t, [0, 40, 108], [0.3, 1.25, 1], { ...clamp, easing: EASE.out })
        const spark = interpolate(t, [9, 63], [0.2, 1], { ...clamp, easing: EASE.out })
        return (
          <g>
            <circle cx={hero.x} cy={hero.y} r={round1(90 * flareScale)} fill="url(#upper-flare)" opacity={flare} />
            <path
              d={`M${hero.x - 26 * spark} ${hero.y}H${hero.x + 26 * spark}M${hero.x} ${hero.y - 26 * spark}V${hero.y + 26 * spark}`}
              stroke={hero.color}
              strokeWidth="1.4"
              strokeLinecap="round"
              opacity={0.8 * Math.min(1, t / 20)}
            />
            {/* In its own colour (Antares stays red), with a small white-hot core. */}
            <circle cx={hero.x} cy={hero.y} r={round1(hero.r * 1.35)} fill={blendColor(hero.color, '#ffffff', 0.05)} />
            <circle cx={hero.x} cy={hero.y} r={round1(hero.r * 0.55)} fill="#fffaf2" />
          </g>
        )
      })()}
    </g>
  )
}
