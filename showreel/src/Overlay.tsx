import type { CSSProperties, ReactNode } from 'react'
import { AbsoluteFill, interpolate, random } from 'remotion'
import { cameraAt, towerToScreen } from './camera.ts'
import { blendColor, DAILY_EDITIONS } from './editions.ts'
import { DISPLAY, UI } from './fonts.ts'
import { CAROUSEL, carouselSwitches, clamp, EASE, editionIndexAt, MATCH_CUT, SPRINGS, springAt, type Layout } from './layout.ts'
import { BLOCK_HEIGHT, DROPS, dropIndexAt, FINAL, stackAt } from './run.ts'

const GOLD = '#f2c58f'
const INK = '#eef0e6'

// ---------------------------------------------------------------- kinetic type

/**
 * A word behind a baseline mask: rises into place on `at`, optionally scale-snapping like an impact,
 * and leaves upward through the same mask on `exit`.
 */
function Word({ frame, at, exit, snap = false, children, style }: { frame: number; at: number; exit: number; snap?: boolean; children: ReactNode; style?: CSSProperties }) {
  if (frame < at - 1) return null
  const reveal = springAt(frame, snap ? SPRINGS.landing : SPRINGS.reveal, at)
  const leave = interpolate(frame, [exit, exit + 11], [0, 1], { ...clamp, easing: EASE.whipIn })
  const pop = snap ? 1 + 0.38 * (1 - springAt(frame, SPRINGS.snap, at)) : 1
  return (
    <span style={{ display: 'inline-block', overflow: 'hidden', padding: '0.06em 0.12em 0.16em', margin: '-0.06em -0.12em -0.16em', verticalAlign: 'bottom' }}>
      <span style={{ display: 'inline-block', translate: `0 ${((1 - reveal) * 112 - leave * 120).toFixed(2)}%`, scale: pop.toFixed(4), transformOrigin: '50% 90%', ...style }}>
        {children}
      </span>
    </span>
  )
}

const headline = (size: number): CSSProperties => ({
  fontFamily: DISPLAY,
  fontWeight: 400,
  fontSize: size,
  lineHeight: 0.98,
  letterSpacing: '-0.035em',
  color: INK,
})

// A drop-shadow on the block, outside the reveal masks, so the masks never clip it into a box.
const SHADOW: CSSProperties = { filter: 'drop-shadow(0 3px 18px rgba(5, 12, 24, .55))' }

const label = (size: number): CSSProperties => ({
  fontFamily: UI,
  fontWeight: 700,
  fontSize: size,
  letterSpacing: '0.24em',
  textTransform: 'uppercase',
  color: GOLD,
})

/** Copy block positioned per format: left column in landscape, stacked high and centred in portrait. */
function Block({ layout, children, top, align }: { layout: Layout; children: ReactNode; top?: number; align?: 'center' }) {
  const portrait = layout.format === 'portrait'
  return (
    <div
      style={portrait
        // Safe area: clear of the top 220 px, the bottom 420 px and the right 140 px.
        ? { ...SHADOW, position: 'absolute', left: 80, width: 840, top: top ?? 300, textAlign: 'center' }
        : { ...SHADOW, position: 'absolute', left: 150, width: 760, top: top ?? 300, textAlign: align ?? 'left' }}
    >
      {children}
    </div>
  )
}

/** Five stones that light up with the perfect streak, the game's own streak language. */
function StreakMeter({ frame, layout }: { frame: number; layout: Layout }) {
  const appear = interpolate(frame, [150, 162], [0, 1], { ...clamp, easing: EASE.out })
  const leave = interpolate(frame, [372, 384], [0, 1], { ...clamp, easing: EASE.whipIn })
  if (appear <= 0 || leave >= 1) return null
  const latest = DROPS[dropIndexAt(frame)]!
  const streak = latest.after.perfectStreak
  const portrait = layout.format === 'portrait'
  const size = portrait ? 1.25 : 1
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22 * size, justifyContent: portrait ? 'center' : 'flex-start', opacity: appear * (1 - leave), translate: `0 ${(1 - appear) * 20 - leave * 30}px` }}>
      <div style={{ display: 'flex', gap: 10 * size }}>
        {[0, 1, 2, 3, 4].map((index) => {
          const lightAt = DROPS.find((drop) => drop.frame <= frame && drop.after.perfectStreak === index + 1 && drop.frame >= 160)?.frame
          const on = streak > index && lightAt !== undefined
          const pop = on ? 1 + 0.6 * (1 - springAt(frame, SPRINGS.snap, lightAt)) : 1
          return (
            <div
              key={index}
              style={{
                width: (30 + index * 4) * size,
                height: 14 * size,
                borderRadius: 4,
                background: on ? 'linear-gradient(#ffe3bc, #eabd8a)' : 'rgba(238, 240, 230, .16)',
                boxShadow: on ? `0 0 ${18 * size}px rgba(242, 197, 143, .75)` : 'inset 0 0 0 1px rgba(238,240,230,.22)',
                scale: pop.toFixed(3),
              }}
            />
          )
        })}
      </div>
      <div style={{ ...label(26 * size), fontVariantNumeric: 'tabular-nums' }}>Perfect ×{Math.max(streak, 0)}</div>
    </div>
  )
}

function CourseChip({ frame, layout }: { frame: number; layout: Layout }) {
  if (frame < CAROUSEL.start || frame > 690) return null
  const step = carouselSwitches.filter((at) => at <= frame).length - 1
  const edition = DAILY_EDITIONS[editionIndexAt(frame)]!
  const at = carouselSwitches[step]!
  const portrait = layout.format === 'portrait'
  const leave = interpolate(frame, [678, 690], [0, 1], { ...clamp, easing: EASE.whipIn })
  return (
    <div style={{ marginTop: portrait ? 40 : 34, opacity: 1 - leave }}>
      <div style={{ ...headline(portrait ? 76 : 64), fontStyle: 'italic', color: blendColor(edition.stone.activeTop, '#ffffff', 0.1), height: '1.1em' }}>
        <Word frame={frame} at={at} exit={999} snap>{edition.name}</Word>
      </div>
      <div style={{ display: 'flex', gap: portrait ? 16 : 13, marginTop: 18, justifyContent: portrait ? 'center' : 'flex-start' }}>
        {CAROUSEL.courses.map((_, index) => (
          <div
            key={index}
            style={{
              width: portrait ? 16 : 13,
              height: portrait ? 16 : 13,
              borderRadius: '50%',
              background: index <= step ? GOLD : 'rgba(238, 240, 230, .2)',
              boxShadow: index === step ? '0 0 14px rgba(242, 197, 143, .9)' : undefined,
              scale: index === step ? (1 + 0.7 * (1 - springAt(frame, SPRINGS.snap, at))).toFixed(3) : '1',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- match-cut mark and title

// The logo mark (src/assets/afterlight-mark.svg): three offset stones under a light, in its 96-unit box.
const MARK_STONES = [
  { x: 35, y: 32, w: 32, face: '#EABD8A', band: '#FFE3BC' },
  { x: 24, y: 50, w: 44, face: '#C9D6C6', band: '#E8F0E4' },
  { x: 18, y: 68, w: 58, face: '#8FAAA0', band: '#B9CCC2' },
] as const

function markPlacement(layout: Layout) {
  return layout.format === 'portrait'
    ? { scale: 4, x: 500 - 47 * 4, y: 360 }
    : { scale: 3, x: layout.W / 2 - 47 * 3, y: 170 }
}

/** The top three tower stones and the beacon become the logo mark, starting from exactly where they stood. */
function MatchCutMark({ frame, layout }: { frame: number; layout: Layout }) {
  if (frame < MATCH_CUT) return null
  const camera = cameraAt(MATCH_CUT, layout)
  const target = markPlacement(layout)
  const stone = DAILY_EDITIONS[0]!.stone
  const morph = springAt(frame, SPRINGS.title, MATCH_CUT)
  const lerp = (from: number, to: number) => from + (to - from) * morph
  const levels = FINAL.stack.length
  const stones = MARK_STONES.map((mark, index) => {
    const level = levels - 1 - index
    const block = FINAL.stack[level]!
    const y = layout.groundY - (level + 1) * BLOCK_HEIGHT
    const from = towerToScreen(block.x, y, camera, layout)
    const fromWidth = block.width * from.scale
    return {
      x: lerp(from.x, target.x + mark.x * target.scale),
      y: lerp(from.y, target.y + mark.y * target.scale),
      w: lerp(fromWidth, mark.w * target.scale),
      h: lerp(BLOCK_HEIGHT * from.scale, 15 * target.scale),
      band: lerp(10 * from.scale, 4 * target.scale),
      rx: lerp(2 * from.scale, 3 * target.scale),
      face: blendColor(stone.front, mark.face, morph),
      top: blendColor(stone.top, mark.band, morph),
    }
  })
  const top = FINAL.stack[levels - 1]!
  const lightFrom = towerToScreen(top.x + top.width / 2, layout.groundY - levels * BLOCK_HEIGHT - 40, camera, layout)
  const lightX = lerp(lightFrom.x, target.x + 51 * target.scale)
  const lightY = lerp(lightFrom.y, target.y + 18 * target.scale)
  const breathe = 1 + 0.08 * Math.sin((frame - MATCH_CUT) / 14)
  const halo = 15 * target.scale * breathe
  return (
    <svg width={layout.W} height={layout.H} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      <defs>
        <radialGradient id="mark-glow">
          <stop stopColor="#fff0c9" stopOpacity=".55" />
          <stop offset=".4" stopColor="#f2c58f" stopOpacity=".18" />
          <stop offset="1" stopColor="#f2c58f" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={lightX} cy={lightY} r={halo * 4.5} fill="url(#mark-glow)" />
      <circle cx={lightX} cy={lightY} r={halo} fill="#FFF0C9" opacity=".16" />
      {stones.map((s, index) => (
        <g key={index}>
          <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill={s.face} />
          <rect x={s.x} y={s.y} width={s.w} height={s.band} rx={s.rx * 0.66} fill={s.top} />
        </g>
      ))}
      <circle cx={lightX} cy={lightY} r={lerp(14, 6.5 * target.scale)} fill="#FFF0C9" />
    </svg>
  )
}

function TitleLockup({ frame, layout }: { frame: number; layout: Layout }) {
  if (frame < 760) return null
  const portrait = layout.format === 'portrait'
  const mark = markPlacement(layout)
  const top = mark.y + 92 * mark.scale + (portrait ? 30 : 16)
  const title = 'Afterlight'
  const settle = springAt(frame, SPRINGS.title, 772)
  const rule = interpolate(frame, [834, 870], [0, 1], { ...clamp, easing: EASE.out })
  return (
    <div style={{ position: 'absolute', left: portrait ? 80 : 0, width: portrait ? 840 : layout.W, top, textAlign: 'center' }}>
      <div style={{ ...headline(portrait ? 196 : 188), letterSpacing: `${(0.04 - 0.075 * settle).toFixed(4)}em`, color: '#f6efe0' }}>
        {title.split('').map((letter, index) => (
          <Word key={index} frame={frame} at={772 + index * 2} exit={9999}>{letter}</Word>
        ))}
      </div>
      <div style={{ ...headline(portrait ? 60 : 50), fontStyle: 'italic', fontWeight: 300, color: '#e9dcc6', marginTop: portrait ? 26 : 18, letterSpacing: '-0.01em' }}>
        {'Build a beacon before dawn.'.split(' ').map((word, index) => (
          <Word key={index} frame={frame} at={806 + index * 4} exit={9999}>{word}&nbsp;</Word>
        ))}
      </div>
      <div style={{ display: 'inline-block', marginTop: portrait ? 56 : 42 }}>
        <div style={{ ...label(portrait ? 30 : 26), letterSpacing: '0.16em', textTransform: 'none' }}>
          <Word frame={frame} at={830} exit={9999}>playafterlight.vercel.app</Word>
        </div>
        <div style={{ height: 2, marginTop: 12, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, scale: `${rule} 1` }} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- texture

/** Ember motes drifting up through the frame; brighter once the beacon is awake. */
function Motes({ frame, layout }: { frame: number; layout: Layout }) {
  const glow = interpolate(frame, [700, 760], [0.5, 1], clamp)
  return (
    <svg width={layout.W} height={layout.H} style={{ position: 'absolute', inset: 0 }}>
      {Array.from({ length: 46 }, (_, index) => {
        const speed = 0.6 + random(`speed-${index}`) * 1.6
        const x = random(`x-${index}`) * layout.W + Math.sin(frame / (40 + index) + index) * 24
        const y = (((random(`y-${index}`) * (layout.H + 100) - frame * speed) % (layout.H + 100)) + layout.H + 100) % (layout.H + 100) - 50
        const size = 1.2 + random(`size-${index}`) * 2.6
        const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(frame / (18 + index % 9) + index))
        return <circle key={index} cx={x} cy={y} r={size} fill="#ffe3b0" opacity={0.42 * twinkle * glow} />
      })}
    </svg>
  )
}

function Grain({ frame, layout }: { frame: number; layout: Layout }) {
  return (
    <svg width={layout.W} height={layout.H} style={{ position: 'absolute', inset: 0, mixBlendMode: 'overlay', opacity: 0.09 }}>
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={frame % 61} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  )
}

/** Motion streaks during whip pans; `velocity` is the camera's screen speed in px per frame. */
function SpeedLines({ layout, vx, vy }: { layout: Layout; vx: number; vy: number }) {
  const strength = Math.min(1, (Math.abs(vx) + Math.abs(vy)) / 90)
  if (strength < 0.05) return null
  const horizontal = Math.abs(vx) >= Math.abs(vy)
  return (
    <svg width={layout.W} height={layout.H} style={{ position: 'absolute', inset: 0, opacity: strength * 0.5 }}>
      {Array.from({ length: 18 }, (_, index) => {
        const a = random(`line-a-${index}`)
        const b = random(`line-b-${index}`)
        const length = 200 + b * 500
        return horizontal
          ? <rect key={index} x={b * layout.W - length / 2} y={a * layout.H} width={length} height={1.5 + b * 2} fill="#fff1d6" opacity={0.3 + a * 0.5} />
          : <rect key={index} x={a * layout.W} y={b * layout.H - length / 2} width={1.5 + b * 2} height={length} fill="#fff1d6" opacity={0.3 + a * 0.5} />
      })}
    </svg>
  )
}

/** Light flashes that hide cuts and land with the impacts. */
function flashAt(frame: number) {
  const pulse = (at: number, peak: number, length: number) => interpolate(frame, [at - 1, at, at + length], [0, peak, 0], clamp)
  return Math.max(pulse(8, 0.7, 12), pulse(298, 0.38, 16), pulse(DROPS.at(-1)!.frame, 0.32, 16), pulse(MATCH_CUT, 0.95, 18))
}

// ---------------------------------------------------------------- composition overlay

export function Overlay({ frame, layout, vx, vy }: { frame: number; layout: Layout; vx: number; vy: number }) {
  const portrait = layout.format === 'portrait'
  const big = portrait ? 150 : 150
  const floors = stackAt(frame).length - 1
  const flash = flashAt(frame)
  const veil = interpolate(frame, [MATCH_CUT, 800], [0, 1], clamp)
  return (
    <AbsoluteFill>
      {/* A navy veil gathers behind the title so the gold reads at any course's dawn. */}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 45%, rgba(10, 25, 38, .55), rgba(5, 10, 22, .2) 70%)', opacity: veil }} />
      {/* A soft scrim on the copy side (left in landscape, top in portrait) keeps type legible over bright cloud. */}
      <AbsoluteFill
        style={{
          background: portrait
            ? 'linear-gradient(180deg, rgba(10, 25, 38, .5), rgba(10, 25, 38, .22) 38%, transparent 55%)'
            : 'linear-gradient(90deg, rgba(10, 25, 38, .5), rgba(10, 25, 38, .2) 40%, transparent 58%)',
          opacity: interpolate(frame, [0, 690, 740], [1, 1, 0], clamp),
        }}
      />
      <Motes frame={frame} layout={layout} />

      {/* Beat 1: three words, one per impact. */}
      <Block layout={layout} top={portrait ? 300 : 250}>
        <div style={headline(big)}>
          {([['Drop.', 8], ['Stack.', 34], ['Climb.', 60]] as const).map(([word, at], index) => (
            <div key={word} style={{ color: index === 2 ? GOLD : INK }}>
              <Word frame={frame} at={at} exit={78 + index * 2} snap>{word}</Word>
            </div>
          ))}
        </div>
      </Block>

      {/* Beat 2: streak feedback, then the growth callout on the fifth perfect. */}
      <Block layout={layout} top={portrait ? 300 : 330}>
        <StreakMeter frame={frame} layout={layout} />
        <div style={{ ...headline(portrait ? 128 : 116), marginTop: portrait ? 44 : 36 }}>
          <div><Word frame={frame} at={298} exit={372} snap>Five perfect.</Word></div>
          <div style={{ color: GOLD, fontStyle: 'italic' }}><Word frame={frame} at={318} exit={375}>It grows.</Word></div>
        </div>
      </Block>

      {/* Beat 3, callout 1: the climb past the clouds, with the floor count. */}
      <Block layout={layout} top={portrait ? 300 : 300}>
        {frame >= 426 && frame < 560 && (
          <div style={{ ...label(portrait ? 30 : 26), opacity: interpolate(frame, [426, 436, 540, 552], [0, 1, 1, 0], clamp), fontVariantNumeric: 'tabular-nums' }}>
            Floor {String(floors).padStart(2, '0')}
          </div>
        )}
        <div style={{ ...headline(portrait ? 132 : 120), marginTop: 18 }}>
          <div><Word frame={frame} at={432} exit={540}>Past the</Word></div>
          <div style={{ color: GOLD, fontStyle: 'italic' }}><Word frame={frame} at={441} exit={543}>clouds.</Word></div>
        </div>
      </Block>

      {/* Beat 3, callout 2: seven courses, one a day. */}
      <Block layout={layout} top={portrait ? 300 : 280}>
        <div style={headline(portrait ? 124 : 112)}>
          <div><Word frame={frame} at={CAROUSEL.start} exit={678} snap>Seven tides.</Word></div>
          <div style={{ color: GOLD, fontStyle: 'italic' }}><Word frame={frame} at={CAROUSEL.start + 10} exit={681}>One a day.</Word></div>
        </div>
        <CourseChip frame={frame} layout={layout} />
      </Block>

      <MatchCutMark frame={frame} layout={layout} />
      <TitleLockup frame={frame} layout={layout} />

      <SpeedLines layout={layout} vx={vx} vy={vy} />
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 50%, #fff6e2, #f2c58f 60%, #e9a66d)', opacity: flash, mixBlendMode: 'screen' }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 75% 70% at 50% 48%, transparent 55%, rgba(4, 9, 18, .62))' }} />
      <Grain frame={frame} layout={layout} />
    </AbsoluteFill>
  )
}
