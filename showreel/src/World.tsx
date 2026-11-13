// The game's scene, ported from src/App.tsx with every Motion animation replaced by frame math.
// Glows use radial gradients instead of blur filters so 900 frames render quickly.
import { useMemo } from 'react'
import { interpolate } from 'remotion'
import { blendColor, type DailyEdition, type StonePalette } from './editions.ts'
import { BLOCK_HEIGHT, DROPS, dropIndexAt, movingAt, stackAt, type Block } from './run.ts'
import { CELEBRATIONS, clamp, EASE, OVERSCAN, perfectsAt, smoothstep, SPRINGS, springAt, type Layout } from './layout.ts'

const BLOCK_BEVEL = 10
const BLOCK_FACE_HEIGHT = BLOCK_HEIGHT - BLOCK_BEVEL
const round1 = (value: number) => Math.round(value * 10) / 10

function seededRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

function cloudPuff(x: number, y: number, width: number) {
  const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
    `M${round1(cx - rx)} ${round1(cy)}a${round1(rx)} ${round1(ry)} 0 1 0 ${round1(rx * 2)} 0a${round1(rx)} ${round1(ry)} 0 1 0 ${round1(-rx * 2)} 0`
  return ellipse(x, y, width, width * 0.17)
    + ellipse(x - width * 0.32, y - width * 0.08, width * 0.42, width * 0.19)
    + ellipse(x + width * 0.22, y - width * 0.12, width * 0.38, width * 0.21)
}

const islandTopPath = (groundY: number) =>
  `M240 ${groundY - 14}q46-45 108-32 55-49 118-24 61-46 122-10 71-25 124 21 60 5 88 45-44 19-104 10-66 23-122 4-67 22-127 3-74 22-123-1-42 10-84-16z`

export function lensGeometry(block: Block, y: number) {
  const width = Math.min(14, Math.max(7, block.width * 0.075))
  const height = Math.min(30, Math.max(18, BLOCK_FACE_HEIGHT * 0.52))
  const x = block.x + block.width / 2 - width / 2
  const lensY = y + BLOCK_BEVEL + (BLOCK_FACE_HEIGHT - height) / 2
  return { x, y: lensY, width, height, centerX: x + width / 2, centerY: lensY + height / 2 }
}

/** The world rect each layer must cover: the frame plus overscan, wider still for the sky. */
export function bounds(layout: Layout, extra = 1) {
  const padX = layout.Vw * OVERSCAN * extra
  const padY = layout.Vh * OVERSCAN * extra
  return { left: layout.x0 - padX, right: layout.x0 + layout.Vw + padX, top: -padY, bottom: layout.Vh + padY }
}

// ---------------------------------------------------------------- sky and sea

// How far the sky reaches above the frame, for the upward tilt into the title.
const top = -2600

export function SkyLayer({ edition, layout, frame, dawn, highSky }: { edition: DailyEdition; layout: Layout; frame: number; dawn: number; highSky: number }) {
  const { horizon, Vh } = layout
  const box = bounds(layout, 2.2)
  const moonX = edition.moon.x + (edition.moon.x < 500 ? -layout.spread : layout.spread) * 0.6
  const moonY = Math.min(Vh * edition.moon.y, horizon - edition.moon.radius * 2.4)
  const sunX = moonX < 500 ? 730 + layout.spread * 0.5 : 270 - layout.spread * 0.5

  const art = useMemo(() => {
    const random = seededRandom(11)
    const stars = ['', '', '']
    for (let index = 0; index < 520; index += 1) {
      const x = round1(box.left + random() * (box.right - box.left))
      const y = round1(top + Math.pow(random(), 0.9) * (horizon - 50 - top))
      const radius = random() > 0.84 ? 1.7 : 1
      stars[index % 3] += `M${x - radius} ${y}a${radius} ${radius} 0 1 0 ${radius * 2} 0a${radius} ${radius} 0 1 0 ${-radius * 2} 0`
    }
    const sea = box.bottom - horizon
    const waves = ['', '', '']
    const rows = Math.round(sea / 8)
    for (let row = 0; row < rows; row += 1) {
      const t = Math.pow(row / rows, 1.7)
      const y = round1(horizon + 6 + t * (sea - 8))
      const count = Math.round((3 + t * 4) * (box.right - box.left) / 1000)
      for (let stroke = 0; stroke < count; stroke += 1) {
        const length = round1(10 + t * 70 * (0.5 + random() * 0.8))
        const x = round1(box.left + random() * (box.right - box.left))
        waves[t < 0.25 ? 0 : t < 0.6 ? 1 : 2] += `M${x} ${y}q${round1(length / 2)} ${round1(-1.5 - t * 3)} ${length} 0`
      }
    }
    const lightPath = (centerX: number) => {
      const bands = ['', '', '']
      const pathRows = Math.round(sea / 9)
      for (let row = 0; row < pathRows; row += 1) {
        const t = row / pathRows
        const y = round1(horizon + 5 + Math.pow(t, 1.35) * (sea - 30))
        const width = 14 + t * 150
        for (let dash = 0; dash < 2 + Math.floor(t * 3); dash += 1) {
          const length = round1((0.25 + random() * 0.35) * width)
          const x = round1(centerX + (random() - 0.5) * width - length / 2)
          bands[t < 0.3 ? 0 : t < 0.65 ? 1 : 2] += `M${x} ${y}h${length}v${round1(1.4 + t * 1.6)}h${-length}z`
        }
      }
      return bands
    }
    const highStars = (() => {
      let path = ''
      for (let index = 0; index < 260; index += 1) {
        const x = round1(box.left + random() * (box.right - box.left))
        const y = round1(top + Math.pow(random(), 1.3) * (horizon * 0.75 - top))
        const radius = random() > 0.85 ? 1.5 : 0.9
        path += `M${x - radius} ${y}a${radius} ${radius} 0 1 0 ${radius * 2} 0a${radius} ${radius} 0 1 0 ${-radius * 2} 0`
      }
      return path
    })()
    // A soft, wavy aurora ribbon that thickens and thins along its length.
    const auroraTop: string[] = []
    const auroraBottom: string[] = []
    for (let x = box.left; x <= box.right; x += 40) {
      const y = horizon * 0.24 + 46 * Math.sin(x / 380) + 22 * Math.sin(x / 170 + 1)
      const thickness = 70 + 45 * Math.sin(x / 300 + 2)
      auroraTop.push(`${round1(x)} ${round1(y)}`)
      auroraBottom.unshift(`${round1(x)} ${round1(y + thickness)}`)
    }
    const aurora = `M${auroraTop.join('L')}L${auroraBottom.join('L')}Z`
    return { stars, waves, moonPath: lightPath(moonX), sunPath: lightPath(sunX), highStars, aurora }
  }, [box.left, box.right, box.bottom, horizon, moonX, sunX])

  const night = 1 - dawn
  const wide = { x: box.left, width: box.right - box.left }
  // Twinkle: each star group breathes on its own slow cycle.
  const twinkle = (phase: number) => 0.55 + 0.45 * Math.sin(frame / 23 + phase)
  // The sea's surface drifts sideways, each depth at its own pace.
  const drift = (speed: number) => `translate(${round1(Math.sin(frame / 90) * speed)} 0)`

  return (
    <g>
      <defs>
        <linearGradient id="sky" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="0" y2={horizon}>
          <stop stopColor={edition.sky[0]} />
          <stop offset=".55" stopColor={edition.sky[1]} />
          <stop offset="1" stopColor={edition.sky[2]} />
        </linearGradient>
        <linearGradient id="dawn-sky" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="0" y2={horizon}>
          <stop stopColor={edition.dawnSky[0]} stopOpacity=".25" />
          <stop offset=".5" stopColor={edition.dawnSky[1]} stopOpacity=".6" />
          <stop offset=".8" stopColor={edition.dawnSky[2]} stopOpacity=".9" />
          <stop offset="1" stopColor={edition.dawnSky[3]} />
        </linearGradient>
        <linearGradient id="upper-sky" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={top} y2="0">
          <stop stopColor="#050a16" />
          <stop offset="1" stopColor={edition.sky[0]} />
        </linearGradient>
        <linearGradient id="water" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={horizon} y2={layout.Vh}>
          <stop stopColor={edition.sky[2]} />
          <stop offset=".1" stopColor={edition.sea[0]} />
          <stop offset="1" stopColor={edition.sea[1]} />
        </linearGradient>
        <linearGradient id="dawn-water" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={horizon} y2={layout.Vh}>
          <stop stopColor={edition.dawnSky[3]} stopOpacity=".9" />
          <stop offset=".18" stopColor={edition.dawnSea[0]} stopOpacity=".7" />
          <stop offset="1" stopColor={edition.dawnSea[1]} stopOpacity=".35" />
        </linearGradient>
        <radialGradient id="horizon-glow">
          <stop stopColor={edition.moon.light} stopOpacity=".5" />
          <stop offset="1" stopColor={edition.moon.light} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="moonlight">
          <stop stopColor="#ffe9c9" stopOpacity=".5" />
          <stop offset=".3" stopColor={edition.moon.light} stopOpacity=".16" />
          <stop offset="1" stopColor={edition.moon.light} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="moon-body" cx=".38" cy=".35" r=".75">
          <stop stopColor="#fff4df" />
          <stop offset=".7" stopColor={edition.moon.body} />
          <stop offset="1" stopColor={edition.moon.shade} />
        </radialGradient>
        <radialGradient id="sun">
          <stop stopColor="#fff4d8" />
          <stop offset=".55" stopColor="#ffd9a0" stopOpacity=".7" />
          <stop offset="1" stopColor="#ffb47a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mist">
          <stop stopColor="#e8b4a6" />
          <stop offset="1" stopColor="#e8b4a6" stopOpacity="0" />
        </radialGradient>
        {edition.moon.phase !== undefined && (
          <mask id="moon-phase">
            <circle cx={moonX} cy={moonY} r={edition.moon.radius + 2} fill="#fff" />
            <circle cx={moonX + edition.moon.radius * edition.moon.phase * 2} cy={moonY - edition.moon.radius * 0.15} r={edition.moon.radius} fill="#000" />
          </mask>
        )}
        <linearGradient id="high-sky" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={top} y2={horizon * 0.8}>
          <stop stopColor="#050a16" stopOpacity=".95" />
          <stop offset=".7" stopColor="#0b1428" stopOpacity=".5" />
          <stop offset="1" stopColor="#0b1428" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="aurora" x2="0" y2="1">
          <stop stopColor="#9ff0d0" stopOpacity="0" />
          <stop offset=".45" stopColor="#9ff0d0" stopOpacity=".32" />
          <stop offset=".7" stopColor="#b9a6f0" stopOpacity=".18" />
          <stop offset="1" stopColor="#b9a6f0" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect {...wide} y={top} height={-top + 1} fill="url(#upper-sky)" />
      <rect {...wide} y={0} height={horizon + 1} fill="url(#sky)" />
      <rect {...wide} y={0} height={horizon + 1} fill="url(#dawn-sky)" opacity={dawn} />

      <g fill="#f8eed9" opacity={Math.max(night, highSky * 0.9)} transform={`translate(${round1(frame * 0.04)} 0)`}>
        <path d={art.stars[0]} opacity={0.85 * twinkle(0)} />
        <path d={art.stars[1]} opacity={0.6 * twinkle(2.1)} />
        <path d={art.stars[2]} opacity={0.45 * twinkle(4.2)} />
      </g>

      <ellipse cx={moonX} cy={horizon} rx="700" ry={round1(Math.max(110, (layout.Vh - horizon) * 0.3))} fill="url(#horizon-glow)" opacity={night} />
      <ellipse cx={sunX} cy={horizon} rx="700" ry={round1(Math.max(110, (layout.Vh - horizon) * 0.3))} fill="url(#horizon-glow)" opacity={dawn} />

      <g opacity={night}>
        <circle cx={moonX} cy={moonY} r={edition.moon.radius * 5} fill="url(#moonlight)" />
        <g mask={edition.moon.phase !== undefined ? 'url(#moon-phase)' : undefined}>
          <circle cx={moonX} cy={moonY} r={edition.moon.radius} fill="url(#moon-body)" />
          <g fill={edition.moon.shade} opacity=".32">
            <circle cx={moonX + edition.moon.radius * 0.25} cy={moonY - edition.moon.radius * 0.2} r={edition.moon.radius * 0.18} />
            <circle cx={moonX - edition.moon.radius * 0.3} cy={moonY + edition.moon.radius * 0.25} r={edition.moon.radius * 0.12} />
            <circle cx={moonX + edition.moon.radius * 0.35} cy={moonY + edition.moon.radius * 0.4} r={edition.moon.radius * 0.09} />
          </g>
          <circle cx={moonX} cy={moonY} r={edition.moon.radius} fill="none" stroke="#fff6e6" strokeOpacity=".45" />
        </g>
      </g>
      <g opacity={dawn}>
        <circle cx={sunX} cy={horizon} r="170" fill="url(#sun)" opacity=".7" />
        <circle cx={sunX} cy={horizon + 6} r="34" fill="#fff1d2" />
      </g>

      <g transform={`translate(${round1(frame * 0.12)} 0)`}>
        <ellipse cx="520" cy={round1(horizon * 0.5)} rx="320" ry="16" fill="url(#mist)" opacity=".3" />
        <ellipse cx={170 - layout.spread} cy={round1(horizon * 0.66)} rx="240" ry="12" fill="url(#mist)" opacity=".26" />
        <ellipse cx={780 + layout.spread} cy={round1(horizon * 0.8)} rx="280" ry="16" fill="url(#mist)" opacity=".34" />
        <ellipse cx="380" cy={round1(horizon * 0.9)} rx="360" ry="13" fill="url(#mist)" opacity=".28" />
      </g>

      <g opacity={highSky}>
        <rect {...wide} y={top} height={horizon * 0.8 - top} fill="url(#high-sky)" />
        <path d={art.highStars} fill="#f8eed9" opacity={0.8 * twinkle(1)} />
        <path d={art.aurora} fill="url(#aurora)" opacity=".75" transform={`translate(${round1(Math.sin(frame / 70) * 60)} ${round1(Math.sin(frame / 53) * 10)})`} />
      </g>

      {/* Distant islands, a village and a boat on the horizon. */}
      <path
        d={`M${-10 - layout.spread} ${horizon}q30-14 60-10 24-18 52-8 30-8 50 18zM140 ${horizon}q18-6 40-4 10-6 30 4zM420 ${horizon}q24-22 56-18 30-14 54 0 24-8 46 18zM${700 + layout.spread} ${horizon}q16-8 34-6 14-6 26 6z`}
        fill={edition.mountains[0]}
      />
      <g fill="#ffd98f">
        {[[40 - layout.spread, 9], [66 - layout.spread, 7], [464, 14], [488, 11], [506, 8]].map(([x, lift], index) => (
          <circle key={x} cx={x} cy={horizon - lift!} r="1.4" opacity={(1 - dawn * 0.6) * (0.7 + 0.3 * Math.sin(frame / 11 + index * 1.7))} />
        ))}
      </g>
      <g transform={`translate(${round1(610 + layout.spread * 0.4 + frame * 0.05)} ${round1(Math.sin(frame / 26) * 1.2)})`}>
        <path d={`M0 ${horizon - 1}h26l-4 4h-18z`} fill="#2c2f45" />
        <path d={`M12 ${horizon - 2}v-26l12 22z`} fill="#3a3a54" />
        <circle cx="12" cy={horizon - 29} r="1.6" fill="#ffe0a2" />
      </g>

      <rect {...wide} y={horizon} height={box.bottom - horizon} fill="url(#water)" />
      <rect {...wide} y={horizon} height={box.bottom - horizon} fill="url(#dawn-water)" opacity={dawn} />
      <rect {...wide} y={horizon} height="1.5" fill="#ffe8cf" opacity=".5" />

      <g fill="none" stroke="#f1dccb" strokeLinecap="round">
        <path d={art.waves[0]} strokeOpacity=".26" strokeWidth=".9" transform={drift(6)} />
        <path d={art.waves[1]} strokeOpacity=".17" strokeWidth="1.4" transform={drift(-12)} />
        <path d={art.waves[2]} strokeOpacity=".1" strokeWidth="2" transform={drift(20)} />
      </g>
      <g fill="#ffe2b4" opacity={night * (0.8 + 0.2 * Math.sin(frame / 9))}>
        <path d={art.moonPath[0]} opacity=".7" />
        <path d={art.moonPath[1]} opacity=".48" />
        <path d={art.moonPath[2]} opacity=".28" />
      </g>
      <g fill="#fff1cc" opacity={dawn * (0.8 + 0.2 * Math.sin(frame / 9))}>
        <path d={art.sunPath[0]} opacity=".75" />
        <path d={art.sunPath[1]} opacity=".52" />
        <path d={art.sunPath[2]} opacity=".3" />
      </g>
    </g>
  )
}

// ---------------------------------------------------------------- side islets

function Waystone({ x, y, lit, stone, size, flash }: { x: number; y: number; lit: boolean; stone: StonePalette; size: number; flash: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <path d="M-5 0L-3.6 -18Q0 -23 3.6 -18L5 0Z" fill={stone.front} />
      <path d="M0 -21.6Q2.4 -20.6 3.6 -18L5 0H0Z" fill={stone.side} />
      <path d="M-3.6 -18Q0 -23 3.6 -18" stroke={stone.top} strokeWidth="1.4" fill="none" />
      {lit && <ellipse cx="0" cy="-10" rx="9" ry="12" fill="url(#glow)" opacity=".8" />}
      <rect x="-1.3" y="-14" width="2.6" height="7" rx="1.3" fill={lit ? '#fff0c4' : '#3f555c'} />
      {flash > 0 && <circle cx="0" cy="-11" r={3.5 + flash * 8} fill="url(#glow)" opacity={1 - flash} />}
    </g>
  )
}

function Pine({ x, base, height, color }: { x: number; base: number; height: number; color: string }) {
  const width = height * 0.5
  const shade = blendColor(color, '#0b1622', 0.3)
  const trunk = { width: Math.max(3.2, height * 0.06), height: height * 0.16 }
  const tiers = (height > 70
    ? [[0.12, 0.62, 0.5], [0.4, 0.84, 0.38], [0.64, 1, 0.26]]
    : [[0.12, 0.72, 0.5], [0.42, 1, 0.36]]
  ).map(([foot, apex, half]) => ({ foot: base - height * foot!, apex: base - height * apex!, half: width * half! }))
  return (
    <g>
      <rect x={x - trunk.width / 2} y={base - trunk.height} width={trunk.width} height={trunk.height + 1} rx="1" fill="#4b3d38" />
      {tiers.map((tier, index) => (
        <g key={index}>
          <path d={`M${x - tier.half} ${tier.foot}L${x} ${tier.apex}L${x + tier.half} ${tier.foot}Z`} fill={color} />
          <path d={`M${x} ${tier.apex}L${x + tier.half} ${tier.foot}H${x}Z`} fill={shade} />
        </g>
      ))}
    </g>
  )
}

function IslandCliff({ left, right, top, waterline, inset, cracks, deep, light }: {
  left: number; right: number; top: number; waterline: number; inset: number; cracks: readonly number[]; deep: string; light: string
}) {
  const height = waterline - top
  const rock = blendColor(deep, '#8a8783', 0.32)
  const lit = blendColor(rock, light, 0.5)
  return (
    <g>
      <path d={`M${left} ${top}H${right}L${right - inset * 0.4} ${top + height * 0.55}L${right - inset} ${waterline}H${left + inset}L${left + inset * 0.4} ${top + height * 0.55}Z`} fill={rock} />
      <path d={`M${left} ${top}H${right}L${right - inset * 0.3} ${top + height * 0.5}H${left + inset * 0.3}Z`} fill={lit} />
      <path
        d={cracks.map((x, index) => `M${x} ${round1(top + height * 0.2)}l${index % 2 ? 3 : -3} ${round1(height * 0.35)}l${index % 2 ? -2 : 2} ${round1(height * 0.35)}`).join('')}
        stroke={blendColor(rock, '#0b1622', 0.5)} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity=".7"
      />
      <path d={`M${left + inset} ${waterline - 3}H${right - inset}V${waterline}H${left + inset}Z`} fill="#0b1622" opacity=".25" />
    </g>
  )
}

/** Shared glow gradient; every layer defines its own copy under the same id. */
export const GlowDefs = () => (
  <defs>
    <radialGradient id="glow">
      <stop stopColor="#fff0c9" />
      <stop offset=".45" stopColor="#ffe2a8" stopOpacity=".75" />
      <stop offset="1" stopColor="#ffd98f" stopOpacity="0" />
    </radialGradient>
  </defs>
)

export function IsletsLayer({ edition, layout, frame, dawn, climb }: { edition: DailyEdition; layout: Layout; frame: number; dawn: number; climb: number }) {
  const sea = layout.Vh - layout.horizon
  const lx = 885 + layout.spread
  const ly = round1(layout.horizon + Math.min(34, sea * 0.06))
  const lit = Math.floor(perfectsAt(frame) / 5)
  // The fifth perfect makes the lighthouse flare and the waystones answer in sequence.
  const celebration = CELEBRATIONS.filter((drop) => drop.frame <= frame).at(-1)
  const since = celebration ? frame - celebration.frame : 999
  const lighthouseFlash = interpolate(since, [33, 45, 110], [0, 1, 0], clamp)
  const stoneFlash = (sequence: number) => interpolate(since, [sequence * 5, sequence * 5 + 43], [0, 1], clamp) % 1
  const beamSwing = Math.sin(frame / 60) * 6
  const windows = 1 - dawn * 0.65
  const cottage = (
    <>
      <IslandCliff left={54} right={238} top={18} waterline={36} inset={7} cracks={[84, 152, 206]} deep={edition.islands.deep} light={edition.islands.leftTop} />
      <path d="M48 26q24-24 62-20 40-26 76 0 38-4 56 22-30 10-64 6-38 12-72 0-32 8-58-8z" fill="#0b1622" opacity=".28" />
      <path d="M48 22q24-24 62-20 40-26 76 0 38-4 56 22-30 10-64 6-38 12-72 0-32 8-58-8z" fill={blendColor(edition.islands.leftTop, '#eef3e2', 0.2)} />
      <path d="M118 8h30v19h-30z" fill="#e6caa4" />
      <path d="M118 8h30v3h-30z" fill="#000" opacity=".12" />
      <path d="M114 9l19-17 19 17z" fill="#9b6f60" />
      <path d="M133 -8l19 17h-6z" fill="#000" opacity=".15" />
      <rect x="129" y="18" width="7" height="9" rx="1" fill="#6f4c40" />
      <Pine x={210} base={12} height={46} color={edition.tower.trees} />
    </>
  )
  return (
    <g>
      <GlowDefs />
      <defs>
        <linearGradient id="beam" x1="1" x2="0">
          <stop stopColor="#ffe9b8" stopOpacity=".5" />
          <stop offset="1" stopColor="#ffe9b8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g transform={`translate(0 ${round1(climb * 0.03)})`}>
        <path d={`M${lx - 75} ${ly}q20-26 54-24 30-16 60 4 24 4 40 20z`} fill={edition.islands.deep} />
        <path d={`M${lx - 12} ${ly - 14}l5-82h14l5 82z`} fill="#ece1d0" />
        <path d={`M${lx - 9.6} ${ly - 42}h18l-.8 12h-16.4zM${lx - 7.8} ${ly - 72}h15.6l-.7 11h-14.2z`} fill="#b8665a" />
        <path d={`M${lx - 75} ${ly}q20-26 54-24l-4 12q-26 0-42 12z`} fill={blendColor(edition.islands.deep, '#ffffff', 0.16)} />
        <path d={`M${lx + 15} ${ly - 20}q22 4 36 14l-8 6q-14-8-30-10z`} fill={blendColor(edition.islands.deep, '#ffffff', 0.1)} />
        <path d={`M${lx - 80} ${ly + 1}q90 8 180 0`} stroke="#eef4ee" strokeOpacity=".35" strokeWidth="1.5" fill="none" />
        <rect x={lx - 3} y={ly - 27} width="6" height="13" rx="3" fill="#6f4c40" />
        <rect x={lx - 9} y={ly - 110} width="18" height="13" rx="2" fill="#ffe7b0" />
        <path d={`M${lx - 11} ${ly - 110}l11-10 11 10z`} fill="#33445a" />
        <circle cx={lx} cy={ly - 103} r="34" fill="url(#glow)" opacity=".75" />
        <g transform={`rotate(${round1(beamSwing)} ${lx} ${ly - 104})`} opacity={(1 - dawn * 0.55) * (0.75 + 0.15 * Math.sin(frame / 61))}>
          <path d={`M${lx - 6} ${ly - 104}L${lx - 460} ${ly - 160}L${lx - 460} ${ly - 60}Z`} fill="url(#beam)" />
        </g>
        {lighthouseFlash > 0 && (
          <g opacity={lighthouseFlash}>
            <circle cx={lx} cy={ly - 103} r="80" fill="url(#glow)" />
            <path d={`M${lx - 6} ${ly - 104}L${lx - 460} ${ly - 160}L${lx - 460} ${ly - 60}Z`} fill="#fff0c9" opacity=".45" />
          </g>
        )}
        <Waystone stone={edition.stone} size={0.8} x={lx - 46} y={ly - 6} lit={lit >= 3} flash={stoneFlash(3)} />
        <Waystone stone={edition.stone} size={0.8} x={lx + 50} y={ly - 8} lit={lit >= 4} flash={stoneFlash(4)} />
      </g>
      <g transform={`translate(${-layout.spread} ${round1(layout.horizon + sea * 0.17 - 36 + climb * 0.07)})`}>
        <g transform="translate(0 72) scale(1 -1)" opacity=".22">{cottage}</g>
        {cottage}
        <g opacity={windows * (0.85 + 0.15 * Math.sin(frame / 17))}>
          <rect x="121" y="14" width="6" height="7" rx="1" fill="#ffd98f" />
          <rect x="139" y="14" width="6" height="7" rx="1" fill="#ffd98f" />
          <circle cx="133" cy="18" r="22" fill="url(#glow)" opacity=".55" />
        </g>
        <path d="M60 37q92 7 176 0" stroke="#eef4ee" strokeOpacity=".4" strokeWidth="1.5" fill="none" />
        <Waystone stone={edition.stone} size={0.6} x={88} y={16} lit={lit >= 1} flash={stoneFlash(5)} />
        <Waystone stone={edition.stone} size={0.6} x={170} y={10} lit={lit >= 2} flash={stoneFlash(2)} />
      </g>
    </g>
  )
}

// ---------------------------------------------------------------- cloud sea

export function CloudBankLayer({ layout, frame, rise }: { layout: Layout; frame: number; rise: number }) {
  const box = bounds(layout, 1.4)
  const rows = useMemo(() => {
    const random = seededRandom(31)
    const tones = [['#f3e2df', '#d9c3c9'], ['#e9d3d3', '#c9b0bd'], ['#dcc3c8', '#b49cb0'], ['#cbb0bb', '#9a86a0'], ['#b9a0b1', '#83748f']] as const
    const depth = layout.Vh - layout.horizon + 40
    return tones.map(([lit, shade], row) => {
      const y = round1(layout.horizon - 12 + Math.pow(row / tones.length, 1.5) * depth)
      const nextY = row === tones.length - 1 ? box.bottom : round1(layout.horizon - 12 + Math.pow((row + 1) / tones.length, 1.5) * depth)
      const size = 46 + row * 26
      let tops = ''
      let undersides = ''
      for (let x = box.left - size * 2; x <= box.right + size * 2; x += size * 0.9) {
        const lift = (random() - 0.5) * size * 0.3
        tops += cloudPuff(round1(x + random() * 20), round1(y + lift), size)
        undersides += cloudPuff(round1(x + 10), round1(y + lift + size * 0.16), size * 0.95)
      }
      return { lit, shade, tops, undersides, y, bandHeight: round1(nextY - y + size * 0.3) }
    })
  }, [layout, box.left, box.right, box.bottom])
  if (rise <= 0) return null
  return (
    <g>
      {rows.map((band, index) => (
        <g key={index} opacity={smoothstep(index / rows.length, (index + 1.4) / rows.length, rise)} transform={`translate(${round1(frame * (0.08 + index * 0.06))} 0)`}>
          <rect x={box.left - 400} y={band.y} width={box.right - box.left + 800} height={band.bandHeight} fill={band.shade} />
          <path d={band.undersides} fill={band.shade} />
          <path d={band.tops} fill={band.lit} />
        </g>
      ))}
    </g>
  )
}

// ---------------------------------------------------------------- tower

type StoneLook = { active?: boolean; clean?: boolean; signal?: boolean; trimmedLeft?: number; trimmedRight?: number; warmth?: number; haze?: number }

export function Stone({ block, y, palette, look = {} }: { block: Block; y: number; palette: StonePalette; look?: StoneLook }) {
  const { active = false, clean = false, signal = false, trimmedLeft = 0, trimmedRight = 0, warmth = 0, haze = 0 } = look
  const bevel = BLOCK_BEVEL
  const hazed = (color: string) => (haze > 0 ? blendColor(color, '#8f95ad', haze) : color)
  const wTop = blendColor(palette.top, '#e7d6b4', warmth)
  const wFront = blendColor(palette.front, '#b59c78', warmth)
  const wSide = blendColor(palette.side, '#77635a', warmth)
  const wJoint = blendColor(palette.joint, '#876f5d', warmth)
  const top = hazed(active ? palette.activeTop : clean ? blendColor(wTop, '#f6e8c8', 0.18) : wTop)
  const front = hazed(active ? palette.activeFront : clean ? blendColor(wFront, '#c9ad85', 0.2) : wFront)
  const side = hazed(active ? palette.activeSide : clean ? blendColor(wSide, '#9b7b65', 0.18) : wSide)
  const joint = hazed(active ? palette.activeJoint : clean ? blendColor(wJoint, '#a88669', 0.25) : wJoint)
  const lensColor = active ? '#fff0b7' : signal ? '#ffe4a7' : clean ? '#ffe0a2' : '#d6a86d'
  const lens = lensGeometry(block, y)
  const joints = block.width > 155 ? [0.18, 0.43, 0.72, 0.88] : [0.28, 0.7]
  const roughTop = y + bevel + 5
  const roughBottom = y + BLOCK_HEIGHT - 5
  const leftRough = Math.min(11, Math.max(4, trimmedLeft * 0.35))
  const rightRough = Math.min(11, Math.max(4, trimmedRight * 0.35))
  const right = block.x + block.width
  return (
    <g>
      {active && (
        <g fill="#071824">
          <rect x={block.x - 6} y={y + bevel + 2} width={block.width + 12} height={BLOCK_FACE_HEIGHT + 14} rx="12" opacity=".07" />
          <rect x={block.x} y={y + bevel + 6} width={block.width} height={BLOCK_FACE_HEIGHT + 2} rx="4" opacity=".14" />
        </g>
      )}
      <polygon points={`${block.x},${y + bevel} ${block.x + bevel},${y} ${right + bevel},${y} ${right},${y + bevel}`} fill={top} />
      <rect x={block.x} y={y + bevel} width={block.width} height={BLOCK_FACE_HEIGHT} rx="2" fill={front} />
      {trimmedLeft > 0 && (
        <path d={`M${block.x} ${roughTop}H${block.x + leftRough}L${block.x + leftRough * 0.58} ${roughTop + 13}L${block.x + leftRough} ${roughTop + 26}V${roughBottom}H${block.x}Z`} fill={palette.roughCut} opacity=".84" />
      )}
      {trimmedRight > 0 && (
        <path d={`M${right} ${roughTop}H${right - rightRough}L${right - rightRough * 0.58} ${roughTop + 13}L${right - rightRough} ${roughTop + 26}V${roughBottom}H${right}Z`} fill={palette.roughCut} opacity=".84" />
      )}
      <path d={`M${block.x} ${y + bevel + 10}H${right}`} stroke={active ? '#e9b681' : blendColor(palette.top, '#c09e78', warmth)} strokeWidth="2" opacity={clean ? 0.68 : 0.58} />
      {joints.map((position) => (
        <path key={position} d={`M${block.x + block.width * position} ${y + bevel + 5}V${y + BLOCK_HEIGHT - 5}`} stroke={joint} strokeWidth="2" opacity=".58" />
      ))}
      <polygon points={`${right},${y + bevel} ${right + bevel},${y} ${right + bevel},${y + BLOCK_FACE_HEIGHT - 2} ${right},${y + BLOCK_HEIGHT}`} fill={side} />
      <ellipse cx={lens.centerX} cy={lens.centerY} rx={lens.width * 1.6} ry={lens.height * 0.95} fill="url(#glow)" opacity={signal ? 0.7 : clean ? 0.55 : 0.3} />
      <rect x={lens.x} y={lens.y} width={lens.width} height={lens.height} rx={lens.width / 2} fill={lensColor} />
      <rect x={lens.x + lens.width * 0.32} y={lens.y + lens.height * 0.17} width={lens.width * 0.36} height={lens.height * 0.66} rx={lens.width * 0.18} fill="#fff7da" opacity=".88" />
    </g>
  )
}

/** Seeded spark burst from a point, `t` frames after it fired. */
function Sparks({ x, y, t, seed, count, spread, color }: { x: number; y: number; t: number; seed: number; count: number; spread: number; color: string }) {
  if (t < 0 || t > 40) return null
  const random = seededRandom(seed)
  return (
    <g fill={color}>
      {Array.from({ length: count }, (_, index) => {
        const angle = -Math.PI * (0.1 + random() * 0.8)
        const speed = (2 + random() * 4) * spread
        const px = x + Math.cos(angle) * speed * t * (1 - t / 90)
        const py = y + Math.sin(angle) * speed * t * 0.7 + 0.06 * t * t
        const life = 1 - t / (24 + random() * 16)
        return life > 0 ? <circle key={index} cx={round1(px)} cy={round1(py)} r={round1(1.2 + random() * 2.2)} opacity={life} /> : null
      })}
    </g>
  )
}

export function TowerLayer({ edition, layout, frame, shift, dawn, hideTop = 0 }: {
  edition: DailyEdition; layout: Layout; frame: number; shift: number; dawn: number
  /** Top stones handed over to the logo mark after the match-cut. */
  hideTop?: number
}) {
  const { groundY } = layout
  const waterline = groundY + 26
  const stack = stackAt(frame)
  const index = dropIndexAt(frame)
  const latest = index >= 0 ? DROPS[index]! : null
  const streak = latest?.after.perfectStreak ?? 0
  const palette = edition.stone
  const floorY = (level: number) => groundY - level * BLOCK_HEIGHT
  const moving = movingAt(frame)
  const incoming = DROPS[index + 1]
  // Time-lapse drops fall in from above over the 5 frames before their impact.
  const dropIn = incoming?.quick && frame >= incoming.frame - 5 ? incoming : null
  const minScreen = -BLOCK_HEIGHT * 4 - shift
  const maxScreen = layout.Vh * (1 + OVERSCAN) + BLOCK_HEIGHT * 3 - shift
  const signalStart = streak > 0 ? stack.length - streak - 1 : stack.length
  const visibleStones = stack.length - hideTop

  return (
    <g transform={`translate(0 ${round1(shift)})`}>
      <GlowDefs />
      <defs>
        <linearGradient id="home-grass" x2="0" y2="1">
          <stop stopColor={blendColor(edition.tower.top, '#eef3e2', 0.35)} />
          <stop offset=".55" stopColor={edition.tower.top} />
          <stop offset="1" stopColor={blendColor(edition.tower.top, '#4f6d66', 0.3)} />
        </linearGradient>
      </defs>
      {/* Reflection of the island and its lowest stones. */}
      <g transform={`translate(0 ${waterline * 2}) scale(1 -1)`} opacity=".22">
        <path d={`M250 ${groundY - 12}H792L776 ${waterline}H266Z`} fill={edition.tower.deep} />
        <path d={islandTopPath(groundY)} fill={edition.tower.top} />
        {stack.slice(0, 3).map((block, level) => (
          <rect key={level} x={block.x} y={floorY(level + 1)} width={block.width} height={BLOCK_HEIGHT} fill={palette.front} />
        ))}
      </g>
      <path d={`M250 ${waterline + 12}h120m40 0h200m50 0h90M290 ${waterline + 28}h160m60 0h170M330 ${waterline + 48}h110m70 0h150`} stroke={edition.sea[0]} strokeWidth="3" opacity=".55" transform={`translate(${round1(Math.sin(frame / 40) * 10)} 0)`} />
      <IslandCliff left={250} right={792} top={groundY - 12} waterline={waterline} inset={16} cracks={[312, 398, 612, 700, 758]} deep={edition.tower.deep} light={edition.tower.shore} />
      <path d={islandTopPath(groundY + 5)} fill="#0b1622" opacity=".28" />
      <path d={islandTopPath(groundY)} fill="url(#home-grass)" />
      <path d={`M262 ${waterline + 1}q256 12 518 0`} stroke="#eef4ee" strokeOpacity={0.35 + 0.15 * Math.sin(frame / 14)} strokeWidth="2" fill="none" />
      <Pine x={330} base={groundY - 34} height={124} color={edition.tower.trees} />
      <Pine x={762} base={groundY - 28} height={102} color={edition.tower.trees} />
      <Waystone stone={palette} size={1.6} x={282} y={groundY - 26} lit={perfectsAt(frame) >= 25} flash={0} />
      <Waystone stone={palette} size={1.6} x={690} y={groundY - 50} lit={perfectsAt(frame) >= 30} flash={0} />

      {/* Clouds pinned to floors 8 to 15, behind the tower. */}
      <g fill="#efdfe1" transform={`translate(${round1(frame * 0.1)} 0)`}>
        <path d={cloudPuff(170 - layout.spread, floorY(8.2), 150) + cloudPuff(840 + layout.spread, floorY(9.4), 170)} opacity=".42" />
        <path d={cloudPuff(560 + layout.spread, floorY(11), 210) + cloudPuff(130 - layout.spread, floorY(12.6), 160)} opacity=".36" />
        <path d={cloudPuff(860 + layout.spread * 0.5, floorY(14), 180) + cloudPuff(420 - layout.spread, floorY(15.2), 150)} opacity=".3" />
      </g>

      {stack.slice(0, visibleStones).map((block, level) => {
        if (level === 0) return null
        const y = floorY(level + 1)
        if (y < minScreen || y > maxScreen) return null
        const support = stack[level - 1]!
        const drop = DROPS[level - 1]!
        const t = frame - drop.frame
        const clean = Math.abs(block.x + block.width / 2 - (support.x + support.width / 2)) < 0.01
        // The game's landing: drops in 13 units, squashed, and springs back; a grown stone also stretches out.
        const settle = t < 60 ? springAt(frame, SPRINGS.landing, drop.frame) : 1
        const grow = drop.after.lastDropGrew && t < 90 ? springAt(frame, SPRINGS.grow, drop.frame) : 1
        const scaleX = drop.after.lastDropGrew ? interpolate(grow, [0, 1], [0.8, 1]) : 1
        const scaleY = interpolate(settle, [0, 1], [0.92, 1])
        const lift = interpolate(settle, [0, 1], [-13, 0])
        const cx = block.x + block.width / 2
        const bottom = y + BLOCK_HEIGHT
        return (
          <g key={level} transform={`translate(${cx} ${bottom + lift}) scale(${round1(scaleX * 1000) / 1000} ${round1(scaleY * 1000) / 1000}) translate(${-cx} ${-bottom})`}>
            <Stone
              block={block}
              y={y}
              palette={palette}
              look={{
                clean,
                signal: level >= signalStart,
                trimmedLeft: Math.max(0, block.x - support.x),
                trimmedRight: Math.max(0, support.x + support.width - (block.x + block.width)),
                warmth: Math.min(1, level / 32 + dawn * 0.18),
                haze: Math.min(0.45, Math.max(0, (stack.length - 1 - level - 10) / 24)),
              }}
            />
          </g>
        )
      })}

      {/* Beacon signal: light threads between the lenses of the current perfect streak. */}
      {streak > 0 && latest && stack.slice(Math.max(1, stack.length - streak), visibleStones).map((block, offset) => {
        const level = Math.max(1, stack.length - streak) + offset
        const upper = lensGeometry(block, floorY(level + 1))
        const lower = lensGeometry(stack[level - 1]!, floorY(level))
        const startY = upper.centerY + upper.height / 2 - 1
        const endY = lower.centerY - lower.height / 2 + 1
        const controlY = (startY + endY) / 2
        const d = `M${upper.centerX} ${startY}C${upper.centerX} ${controlY} ${lower.centerX} ${controlY} ${lower.centerX} ${endY}`
        const newest = level === stack.length - 1
        const drawn = newest ? interpolate(frame - latest.frame, [2, 20], [0, 1], { ...clamp, easing: EASE.out }) : 1
        const intensity = Math.min(0.92, 0.34 + streak * 0.1)
        return (
          <g key={level} fill="none" strokeLinecap="round">
            <path d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - drawn} stroke="#f6c87e" strokeWidth={8} opacity={intensity * 0.3} />
            <path d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - drawn} stroke="#fff2c9" strokeWidth={2.2} opacity={intensity} />
          </g>
        )
      })}

      {/* Beacon pulse: the fifth perfect sends light up the streak, then rings out from the new stone. */}
      {CELEBRATIONS.map((drop) => {
        const t = frame - drop.frame
        if (t < 0 || t > 100) return null
        const level = drop.after.stack.length - 1
        const block = drop.after.stack[level]!
        const topY = floorY(level + 1)
        const fromY = floorY(Math.max(1, level - 4))
        const centerX = block.x + block.width / 2
        const rise = interpolate(t, [0, 36], [fromY - topY, 0], { ...clamp, easing: EASE.whipIn })
        const beam = interpolate(t, [0, 6, 30, 40], [0, 1, 1, 0], clamp)
        return (
          <g key={drop.frame}>
            <g transform={`translate(0 ${round1(rise)})`} opacity={beam}>
              <ellipse cx={centerX} cy={topY + 27} rx="22" ry="48" fill="url(#glow)" />
              <rect x={centerX - 2.5} y={topY + 6} width="5" height="42" rx="2.5" fill="#fffaf0" />
            </g>
            {[0, 7].map((lag, ring) => {
              const progress = interpolate(t, [30 + lag, 84 + lag], [0, 1], clamp)
              if (progress <= 0 || progress >= 1) return null
              const scale = interpolate(progress, [0, 0.6, 1], [0.2, 1, 1.35])
              return (
                <ellipse
                  key={ring}
                  cx={centerX}
                  cy={topY + 6}
                  rx={block.width * (ring ? 1.05 : 0.72) * scale}
                  ry={(ring ? 22 : 15) * scale}
                  fill="none"
                  stroke={ring ? '#c7eee0' : '#ffe5b4'}
                  strokeWidth={ring ? 2 : 3}
                  opacity={interpolate(progress, [0, 0.3, 1], [0, ring ? 0.55 : 0.9, 0])}
                />
              )
            })}
            <circle cx={centerX} cy={topY + BLOCK_HEIGHT / 2} r={interpolate(t, [27, 87], [20, 110], clamp)} fill="url(#glow)" opacity={interpolate(t, [27, 40, 87], [0, 0.85, 0], clamp)} />
          </g>
        )
      })}

      {/* Landing feedback: a ring and sparks for a perfect, dust off the cut edge otherwise. */}
      {latest && frame - latest.frame < 40 && (() => {
        const t = frame - latest.frame
        const block = latest.after.stack.at(-1)!
        const y = floorY(latest.after.stack.length)
        const perfect = latest.after.lastDropWasPerfect
        const ring = interpolate(t, [0, 24], [0, 1], { ...clamp, easing: EASE.out })
        return (
          <g>
            {perfect && (
              <ellipse cx={block.x + block.width / 2 + 5} cy={y + 5} rx={block.width * (0.55 + ring * 0.45)} ry={10 + ring * 12} fill="none" stroke="#ffe5b4" strokeWidth={3 * (1 - ring) + 0.5} opacity={1 - ring} />
            )}
            <Sparks x={block.x + 6} y={y + 4} t={t} seed={latest.frame * 7 + 1} count={perfect ? 9 : 5} spread={perfect ? 1 : 0.6} color={perfect ? '#ffe7b8' : edition.stone.top} />
            <Sparks x={block.x + block.width} y={y + 4} t={t} seed={latest.frame * 7 + 2} count={perfect ? 9 : 5} spread={perfect ? -1 : -0.6} color={perfect ? '#ffe7b8' : edition.stone.top} />
          </g>
        )
      })()}

      {/* Offcuts tumble into the sea. */}
      {DROPS.map((drop) => drop.after.fallingPieces.map((piece) => {
        const t = frame - drop.frame
        if (t < 0 || t > 80) return null
        const startY = floorY(piece.level)
        const fall = 0.42 * t * t
        const impact = waterline + 26 - startY - BLOCK_HEIGHT * 0.55
        const splash = Math.sqrt(impact / 0.42)
        const cx = piece.x + piece.width / 2 + piece.direction * t * 1.4
        if (t < splash) {
          return (
            <g key={`${drop.frame}-${piece.x}`} transform={`rotate(${round1(piece.direction * Math.min(1, t / 43) * 32)} ${round1(cx)} ${round1(startY + fall + BLOCK_HEIGHT / 2)})`}>
              <Stone block={{ x: cx - piece.width / 2, width: piece.width }} y={startY + fall} palette={palette} look={{ active: true }} />
            </g>
          )
        }
        const ripple = interpolate(t - splash, [0, 36], [0, 1], { ...clamp, easing: EASE.out })
        return (
          <g key={`${drop.frame}-${piece.x}`} fill="none" stroke="#f3e6d6">
            <ellipse cx={cx} cy={waterline + 26} rx={20 + ripple * 70} ry={5 + ripple * 12} strokeWidth="2.5" opacity={0.8 * (1 - ripple)} />
            <ellipse cx={cx} cy={waterline + 26} rx={8 + ripple * 40} ry={2 + ripple * 7} strokeWidth="1.5" opacity={0.6 * (1 - ripple)} />
            <Sparks x={cx} y={waterline + 22} t={t - splash} seed={drop.frame + 3} count={10} spread={0.5} color="#f3e6d6" />
          </g>
        )
      }))}

      {/* The sliding stone, or a time-lapse stone falling into place. */}
      {moving && <Stone block={moving} y={floorY(stack.length + 1)} palette={palette} look={{ active: true }} />}
      {dropIn && (
        <Stone
          block={dropIn.after.stack.at(-1)!}
          y={floorY(stack.length + 1) - interpolate(frame, [dropIn.frame - 5, dropIn.frame], [110, 0], { ...clamp, easing: EASE.whipIn })}
          palette={palette}
          look={{ active: true }}
        />
      )}

      {/* Thin front clouds at the sides, drifting with the wind. */}
      <g fill="#f6eaea" transform={`translate(${round1(-frame * 0.25)} 0)`}>
        <path d={cloudPuff(60 - layout.spread, floorY(9.8), 120) + cloudPuff(950 + layout.spread, floorY(12.2), 130)} opacity=".5" />
        <path d={cloudPuff(940 + layout.spread, floorY(7.4), 110) + cloudPuff(70 - layout.spread, floorY(14.4), 120)} opacity=".38" />
      </g>
    </g>
  )
}
