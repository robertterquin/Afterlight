import { Easing, interpolate, spring } from 'remotion'
import { BLOCK_HEIGHT, DROPS, dropIndexAt } from './run.ts'

export const FPS = 60
export const DURATION = 1200

export const BEATS = { open: 0, escalate: 90, tides: 380, climb: 474, sky: 690, climax: 1000, end: 1200 } as const

export type Format = 'landscape' | 'portrait'

export type Layout = {
  format: Format
  W: number
  H: number
  Vw: number
  Vh: number
  x0: number
  horizon: number
  groundY: number
  targetY: number
  spread: number
  towerX: number
}

export const LAYOUTS: Record<Format, Layout> = {
  landscape: { format: 'landscape', W: 1920, H: 1080, Vw: 1778, Vh: 1000, x0: -389, horizon: 420, groundY: 895, targetY: 455, spread: 300, towerX: 690 },
  portrait: { format: 'portrait', W: 1080, H: 1920, Vw: 1000, Vh: 1778, x0: 0, horizon: 747, groundY: 1673, targetY: 1010, spread: 0, towerX: 500 },
}

export const OVERSCAN = 0.3

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

export const smoothstep = (from: number, to: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

export const SPRINGS = {
  landing: { stiffness: 460, damping: 25, mass: 0.65 },
  camera: { stiffness: 78, damping: 27, mass: 0.85 },
  snap: { stiffness: 320, damping: 11, mass: 0.7 },
  reveal: { stiffness: 180, damping: 26, mass: 0.9 },
  title: { stiffness: 40, damping: 22, mass: 1.4 },
  grow: { stiffness: 260, damping: 9, mass: 0.6 },
} as const

export const springAt = (frame: number, config: (typeof SPRINGS)[keyof typeof SPRINGS], delay = 0) =>
  spring({ frame: frame - delay, fps: FPS, config })

type Key = readonly [frame: number, value: number, easing?: (t: number) => number]

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

export function smoothFloors(frame: number) {
  let floors = 1
  for (const drop of DROPS) {
    if (drop.frame > frame) break
    floors += springAt(frame, SPRINGS.camera, drop.frame)
  }
  return floors
}

export function towerShift(frame: number, layout: Layout) {
  return layout.targetY - (layout.groundY - (smoothFloors(frame) + 1) * BLOCK_HEIGHT)
}

export function perfectsAt(frame: number) {
  const index = dropIndexAt(frame)
  return index < 0 ? 0 : DROPS[index]!.after.perfects
}

export const CELEBRATIONS = DROPS.filter((drop) => drop.after.lastDropWasPerfect && drop.after.perfectStreak % 5 === 0)

export const CAROUSEL = { start: 384, step: 11, courses: [1, 2, 3, 4, 5, 6, 0] } as const
export const carouselSwitches = CAROUSEL.courses.map((_, index) => CAROUSEL.start + index * CAROUSEL.step)

export function editionIndexAt(frame: number) {
  let edition = 0
  carouselSwitches.forEach((at, index) => {
    if (frame >= at) edition = CAROUSEL.courses[index]!
  })
  return edition
}

export const MATCH_CUT = 1050
