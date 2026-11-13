import { Easing, interpolate, spring } from 'remotion'
import { BLOCK_HEIGHT, DROPS, dropIndexAt } from './run.ts'

export const FPS = 60
export const DURATION = 900

/** Beat boundaries shared by both formats. */
export const BEATS = { open: 0, escalate: 90, depth: 390, climax: 690, end: 900 } as const

export type Format = 'landscape' | 'portrait'

/**
 * World units match the game: a 1000-wide lane, 68-unit stones. Each format sees the world through its
 * own window (Vw x Vh), the way the game's desktop and tall-phone layouts do.
 */
export type Layout = {
  format: Format
  W: number
  H: number
  Vw: number
  Vh: number
  x0: number
  horizon: number
  groundY: number
  /** Screen y the sliding stone is held at. */
  targetY: number
  /** How far the side islets sit outward, so a wide frame keeps them near its edges. */
  spread: number
  /** Screen x the tower is framed at. */
  towerX: number
}

export const LAYOUTS: Record<Format, Layout> = {
  landscape: { format: 'landscape', W: 1920, H: 1080, Vw: 1778, Vh: 1000, x0: -389, horizon: 420, groundY: 895, targetY: 455, spread: 300, towerX: 690 },
  portrait: { format: 'portrait', W: 1080, H: 1920, Vw: 1000, Vh: 1778, x0: 0, horizon: 747, groundY: 1673, targetY: 1010, spread: 0, towerX: 500 },
}

/** Overscan around the frame, so 3D sweeps and zoom-outs never reveal an edge. */
export const OVERSCAN = 0.3

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

export const smoothstep = (from: number, to: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

// Spring personalities, chosen per job.
export const SPRINGS = {
  /** The game's own stone landing: quick, firm, barely overshoots. */
  landing: { stiffness: 460, damping: 25, mass: 0.65 },
  /** The game's camera: heavy and patient. */
  camera: { stiffness: 78, damping: 27, mass: 0.85 },
  /** Type that snaps on an impact: overshoots and rings. */
  snap: { stiffness: 320, damping: 11, mass: 0.7 },
  /** Masked reveals: fast in, no bounce. */
  reveal: { stiffness: 180, damping: 26, mass: 0.9 },
  /** Title lockup: slow and soft. */
  title: { stiffness: 40, damping: 22, mass: 1.4 },
  /** Stone growth: elastic. */
  grow: { stiffness: 260, damping: 9, mass: 0.6 },
} as const

export const springAt = (frame: number, config: (typeof SPRINGS)[keyof typeof SPRINGS], delay = 0) =>
  spring({ frame: frame - delay, fps: FPS, config })

type Key = readonly [frame: number, value: number, easing?: (t: number) => number]

/** Piecewise keyframe track; each segment eases with the easing on its end key. */
export function track(frame: number, keys: readonly Key[]) {
  if (frame <= keys[0]![0]) return keys[0]![1]
  for (let index = 1; index < keys.length; index += 1) {
    const [end, to, easing] = keys[index]!
    const [start, from] = keys[index - 1]!
    if (frame <= end) {
      return interpolate(frame, [start, end], [from, to], { ...clamp, easing: easing ?? Easing.inOut(Easing.cubic) })
    }
  }
  return keys.at(-1)![1]
}

export const EASE = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  whipIn: Easing.bezier(0.7, 0, 0.84, 0),
  whipOut: Easing.bezier(0.12, 0.9, 0.2, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  linear: Easing.linear,
}

/** Floors climbed, eased by the game's camera spring after each drop (1 = the base stone). */
export function smoothFloors(frame: number) {
  let floors = 1
  for (const drop of DROPS) {
    if (drop.frame > frame) break
    floors += springAt(frame, SPRINGS.camera, drop.frame)
  }
  return floors
}

/** Vertical offset that keeps the sliding stone at the layout's target height, as in the game. */
export function towerShift(frame: number, layout: Layout) {
  return layout.targetY - (layout.groundY - (smoothFloors(frame) + 1) * BLOCK_HEIGHT)
}

/** Perfect drops landed so far (lights the waystones, one per five). */
export function perfectsAt(frame: number) {
  const index = dropIndexAt(frame)
  return index < 0 ? 0 : DROPS[index]!.after.perfects
}

/** Drops that completed a five-perfect streak: the beacon awakens. */
export const CELEBRATIONS = DROPS.filter((drop) => drop.after.lastDropWasPerfect && drop.after.perfectStreak % 5 === 0)

// The seven-course carousel in beat 3: each course holds for 11 frames, then a whip swaps the palette.
export const CAROUSEL = { start: 606, step: 11, courses: [1, 2, 3, 4, 5, 6, 0] } as const
export const carouselSwitches = CAROUSEL.courses.map((_, index) => CAROUSEL.start + index * CAROUSEL.step)

export function editionIndexAt(frame: number) {
  let edition = 0
  carouselSwitches.forEach((at, index) => {
    if (frame >= at) edition = CAROUSEL.courses[index]!
  })
  return edition
}

/** The match-cut from the tower's top stones into the logo mark. */
export const MATCH_CUT = 744
