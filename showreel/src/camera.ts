import { carouselSwitches, EASE, MATCH_CUT, towerShift, track, type Layout } from './layout.ts'
import { DROPS } from './run.ts'

export type Camera = {
  zoom: number
  /** Screen point (view units) the focus lands on. */
  ax: number
  ay: number
  /** Focus point in the tower layer's screen space. */
  fx: number
  fy: number
  rotX: number
  rotY: number
  /** Screen-space slide (px) for whip pans. */
  whipX: number
  whipY: number
  /** Upward tilt after the match-cut (view units), applied with parallax. */
  tilt: number
  shakeX: number
  shakeY: number
  shift: number
}

// The fast night climb outruns the camera spring by a few floors; the anchor drops to keep the top stone in frame.
const SKY_LIFT = { landscape: 140, portrait: 90 }

const SHAKE: Record<number, number> = { 8: 16, 34: 9, 60: 11, 298: 14, [DROPS.at(-1)!.frame]: 18 }

/** Decaying, seeded shake from every impact. */
function shake(frame: number, axis: 0 | 1) {
  let total = 0
  DROPS.forEach((drop, index) => {
    const t = frame - drop.frame
    if (t < 0 || t > 30) return
    const amplitude = SHAKE[drop.frame] ?? (drop.quick ? 2.5 : 6)
    total += amplitude * Math.exp(-t / 5.5) * Math.sin(t * (axis ? 2.9 : 2.2) + index * 1.3 + axis)
  })
  return total
}

/** Zoom punch on the impacts that matter. */
function punch(frame: number) {
  let total = 0
  for (const [at, amount] of [[8, -0.32], [34, -0.1], [60, -0.12], [298, 0.07], [DROPS.at(-1)!.frame, 0.08]] as const) {
    const t = frame - at
    if (t >= 0 && t < 40) total += amount * Math.exp(-t / 6) * Math.cos(t * 0.25)
  }
  return total
}

/** A whip pan: the frame slides off one way and the next arrives from the other, swapping at `at`. */
function whip(frame: number, at: number, distance: number, half = 6) {
  const t = frame - at
  if (t <= -half || t >= half) return 0
  return t < 0 ? -distance * EASE.whipIn((t + half) / half) : distance * (1 - EASE.whipOut(t / half))
}

export function cameraAt(frame: number, layout: Layout): Camera {
  const portrait = layout.format === 'portrait'
  const shift = towerShift(frame, layout)
  const fy = layout.targetY + 60
  const zoom = track(frame, [
    [0, 3.1],
    [10, 2.5, EASE.whipOut],
    [68, 2.25, EASE.linear],
    [92, 1, EASE.inOut],
    [290, 1.12, EASE.linear],
    [372, 1.16, EASE.linear],
    [394, 0.86, EASE.inOut],
    [600, 0.8, EASE.linear],
    [608, 1.12, EASE.whipOut],
    [690, 1.2, EASE.linear],
    // Above the sky: wide, so the night, the lanterns and the constellation have room around the tower.
    [704, 0.74, EASE.whipOut],
    [960, 0.7, EASE.linear],
    [1006, 0.86, EASE.inOut],
    [1018, 0.88, EASE.linear],
    [MATCH_CUT, 2.5, EASE.whipIn],
    [1126, 1.7, EASE.out],
    [1200, 1.6, EASE.linear],
  ]) + punch(frame)
  // Portrait lowers the tower in close-ups so the stacked type has the sky above it.
  const anchorDrop = portrait
    ? track(frame, [[0, 210], [70, 210], [92, 0, EASE.inOut], [380, 0], [394, 60], [600, 60], [608, 170, EASE.whipOut], [690, 170], [704, SKY_LIFT.portrait, EASE.whipOut], [960, SKY_LIFT.portrait], [1006, 300], [MATCH_CUT, 120]])
    : track(frame, [[690, 0], [704, SKY_LIFT.landscape, EASE.whipOut], [960, SKY_LIFT.landscape], [1006, 120], [MATCH_CUT, 0]])
  const rotY = track(frame, [
    [0, 5], [90, -2, EASE.linear], [380, 3, EASE.linear],
    [410, -16, EASE.whipOut], [592, 13, EASE.inOut], [608, 2, EASE.whipOut], [690, -2, EASE.linear],
    [712, 6, EASE.whipOut], [980, -5, EASE.inOut], [1030, 0],
  ])
  const rotX = track(frame, [[0, 0], [392, 0], [412, 9, EASE.whipOut], [592, 3, EASE.inOut], [608, 0, EASE.whipOut]])
  const whipX = carouselSwitches.reduce((total, at) => total + whip(frame, at, layout.W * 0.14), 0)
  // Beat 2 into beat 3: the frame whips upward as the climb starts.
  const whipY = whip(frame, 394, -layout.H * 0.22, 8) + whip(frame, 694, -layout.H * 0.22, 8)
  const tilt = track(frame, [[MATCH_CUT, 0], [1106, layout.Vh * 1.5, EASE.inOut], [1200, layout.Vh * 1.62, EASE.linear]])
  return {
    zoom,
    ax: layout.towerX,
    ay: fy + anchorDrop,
    fx: 500,
    fy,
    rotX,
    rotY,
    whipX,
    whipY,
    tilt,
    shakeX: shake(frame, 0),
    shakeY: shake(frame, 1),
    shift,
  }
}

/** Where a tower-layer point lands on screen, in pixels (exact while the stage is unrotated). */
export function towerToScreen(x: number, y: number, camera: Camera, layout: Layout) {
  const vx = (x - camera.fx) * camera.zoom + camera.ax
  const vy = (y + camera.shift - camera.fy) * camera.zoom + camera.ay + camera.tilt
  return {
    x: (vx - layout.x0) * (layout.W / layout.Vw) + camera.shakeX + camera.whipX,
    y: vy * (layout.H / layout.Vh) + camera.shakeY + camera.whipY,
    scale: camera.zoom * (layout.W / layout.Vw),
  }
}
