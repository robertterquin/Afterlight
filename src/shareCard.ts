import type { Block } from './game'

export type ShareCardInput = {
  courseName: string
  dateLabel: string
  height: number
  perfects: number
  rank: number | null
  url: string
  /** The finished tower, foundation first, in world units (0–1000 across). */
  stack: Block[]
  sky: readonly [string, string, string, string]
  sea: readonly [string, string]
  moon: { radius: number; light: string; body: string }
  mountains: readonly [string, string]
  island: { deep: string; top: string }
  stone: { top: string; front: string; side: string }
  /** The course's night above the clouds, used for runs of 40+ stones. */
  night: { sky: readonly [string, string, string]; cloudLit: string; cloudShade: string; rim: string; line: string }
}

const WIDTH = 1080
const HEIGHT = 1350
const HORIZON = 1000
const GOLD = { top: '#ffe3bc', front: '#f2c58f', side: '#c9935f' }
// Runs this high are shown above the clouds, as the game shows them.
const HIGH_FROM = 40
const LANTERNS_FROM = 42
const SHOOTING_STAR_FROM = 62
const ARCH_AT = 100
// The cloud sea's curved top: highest in the middle, falling away at the edges like the world below.
const cloudTopY = (x: number) => 1000 + ((x - WIDTH / 2) / (WIDTH / 2)) ** 2 * 45

/** A stone counts as perfect when its centre sits exactly on the one below, as the game snaps it. */
export const perfectStones = (stack: Block[]) =>
  stack.slice(1).map((block, index) => {
    const below = stack[index]
    return Math.abs(block.x + block.width / 2 - (below.x + below.width / 2)) < 0.01
  })

/** The text for when the picture can't be shared (desktop copy, older browsers): one line and the link. */
export function shareText(input: Pick<ShareCardInput, 'courseName' | 'dateLabel' | 'height' | 'perfects' | 'rank' | 'url'>) {
  const rank = input.rank ? ` · #${input.rank} today` : ''
  const stones = `${input.height} ${input.height === 1 ? 'stone' : 'stones'}`
  return `Afterlight · ${input.courseName} · ${input.dateLabel}: ${stones} · ${input.perfects} perfect${rank}\n${input.url}`
}

/** Draws the run as a 1080×1350 picture: the actual tower on today's course, with the score on top. */
export async function drawShareCard(input: ShareCardInput): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  await Promise.all([
    document.fonts.load('400 200px "Newsreader Variable"'),
    document.fonts.load('600 40px "Manrope Variable"'),
  ]).catch(() => undefined)

  const high = input.height >= HIGH_FROM
  if (high) drawNightBackdrop(ctx, input)
  else {
    // Sky, sea and moon from today's course.
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON)
    input.sky.forEach((color, index) => sky.addColorStop([0, 0.45, 0.85, 1][index], color))
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, WIDTH, HORIZON)
    const sea = ctx.createLinearGradient(0, HORIZON, 0, HEIGHT)
    sea.addColorStop(0, input.sea[0])
    sea.addColorStop(1, input.sea[1])
    ctx.fillStyle = sea
    ctx.fillRect(0, HORIZON, WIDTH, HEIGHT - HORIZON)

    ctx.fillStyle = 'rgba(255, 255, 255, .55)'
    for (const [x, y] of [[90, 330], [210, 460], [400, 70], [620, 150], [760, 420], [980, 520], [150, 640], [880, 90], [540, 560]]) {
      ctx.beginPath()
      ctx.arc(x, y, 2, 0, Math.PI * 2)
      ctx.fill()
    }
    // Always top right, clear of the score.
    const moonX = 880
    const moonR = input.moon.radius * 1.5
    const glow = ctx.createRadialGradient(moonX, 300, 0, moonX, 300, moonR * 4)
    glow.addColorStop(0, `${input.moon.light}55`)
    glow.addColorStop(1, `${input.moon.light}00`)
    ctx.fillStyle = glow
    ctx.fillRect(moonX - moonR * 4, 300 - moonR * 4, moonR * 8, moonR * 8)
    ctx.fillStyle = input.moon.body
    ctx.beginPath()
    ctx.arc(moonX, 300, moonR, 0, Math.PI * 2)
    ctx.fill()

    // Far hills on the horizon, then the home island.
    ctx.fillStyle = input.mountains[1]
    ctx.beginPath()
    ctx.moveTo(0, HORIZON)
    ;[[0, 978], [160, 960], [330, 984], [520, 956], [720, 980], [900, 962], [1080, 982], [1080, HORIZON]].forEach(([x, y]) => ctx.lineTo(x, y))
    ctx.fill()
    // The home island: a rock base under a rounded, lit top, as in the game.
    ctx.fillStyle = input.island.deep
    ctx.beginPath()
    ctx.moveTo(262, 1052)
    ctx.lineTo(292, 1086)
    ctx.lineTo(788, 1086)
    ctx.lineTo(818, 1052)
    ctx.fill()
    ctx.fillStyle = input.island.top
    ctx.beginPath()
    ctx.moveTo(250, 1054)
    ctx.quadraticCurveTo(262, 1010, 330, 1012)
    ctx.quadraticCurveTo(400, 990, 470, 1010)
    ctx.lineTo(610, 1010)
    ctx.quadraticCurveTo(690, 990, 750, 1012)
    ctx.quadraticCurveTo(820, 1010, 830, 1054)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(0, 0, 0, .12)'
    ctx.fillRect(250, 1046, 580, 8)
  }

  // The tower: squeezed to fit, gold where the drop was perfect.
  const perfect = perfectStones(input.stack)
  const stoneHeight = Math.min(46, 540 / input.stack.length)
  const offsetX = (WIDTH - 1000) / 2
  input.stack.forEach((block, index) => {
    const colors = index > 0 && perfect[index - 1] ? GOLD : input.stone
    const x = offsetX + block.x
    const y = 1014 - (index + 1) * stoneHeight
    const h = stoneHeight - Math.max(1, stoneHeight * 0.08)
    ctx.fillStyle = colors.front
    ctx.fillRect(x, y, block.width, h)
    ctx.fillStyle = colors.top
    ctx.fillRect(x, y, block.width, Math.max(2, h * 0.22))
    ctx.fillStyle = colors.side
    ctx.fillRect(x + block.width - Math.max(3, block.width * 0.04), y, Math.max(3, block.width * 0.04), h)
  })
  const top = input.stack.at(-1)!
  const lightX = offsetX + top.x + top.width / 2
  const lightY = 1014 - input.stack.length * stoneHeight - 26
  const beacon = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, 60)
  beacon.addColorStop(0, 'rgba(255, 240, 201, .55)')
  beacon.addColorStop(1, 'rgba(255, 240, 201, 0)')
  ctx.fillStyle = beacon
  ctx.fillRect(lightX - 60, lightY - 60, 120, 120)
  ctx.fillStyle = '#fff0c9'
  ctx.beginPath()
  ctx.arc(lightX, lightY, 12, 0, Math.PI * 2)
  ctx.fill()
  if (high) drawHighDetails(ctx, input, { x: lightX, y: lightY })

  // Score, top left, over a soft shade so it reads on any sky.
  const shade = ctx.createRadialGradient(240, 200, 0, 240, 200, 420)
  shade.addColorStop(0, 'rgba(8, 18, 28, .45)')
  shade.addColorStop(1, 'rgba(8, 18, 28, 0)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, WIDTH, HORIZON)
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#f2c58f'
  ctx.font = '600 30px "Manrope Variable", sans-serif'
  ctx.letterSpacing = '5px'
  ctx.fillText(`${input.courseName.toUpperCase()} · ${input.dateLabel}`, 72, 118)
  ctx.letterSpacing = '0px'
  ctx.fillStyle = '#fbf3e6'
  ctx.font = '400 220px "Newsreader Variable", Georgia, serif'
  ctx.fillText(String(input.height), 60, 320)
  ctx.fillStyle = '#e8eef0'
  ctx.font = '500 36px "Manrope Variable", sans-serif'
  const rank = input.rank ? ` · #${input.rank} today` : ''
  ctx.fillText(`${input.height === 1 ? 'stone' : 'stones'} · ${input.perfects} perfect${rank}`, 72, 384)

  // Footer: the mark, the name and where to play.
  ctx.fillStyle = 'rgba(11, 22, 34, .78)'
  ctx.fillRect(0, HEIGHT - 120, WIDTH, 120)
  const markX = 64
  const markY = HEIGHT - 96
  const s = 0.75
  ctx.fillStyle = '#FFF0C9'
  ctx.beginPath()
  ctx.arc(markX + 51 * s, markY + 18 * s, 6.5 * s, 0, Math.PI * 2)
  ctx.fill()
  for (const [x, y, w, color] of [[35, 32, 32, '#EABD8A'], [24, 50, 44, '#C9D6C6'], [18, 68, 58, '#8FAAA0']] as const) {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(markX + x * s, markY + y * s, w * s, 15 * s, 3 * s)
    ctx.fill()
  }
  ctx.fillStyle = '#e8eef0'
  ctx.font = '600 28px "Manrope Variable", sans-serif'
  ctx.letterSpacing = '8px'
  ctx.fillText('AFTERLIGHT', 148, HEIGHT - 50)
  ctx.letterSpacing = '0px'
  ctx.fillStyle = '#b7c6d1'
  ctx.font = '500 26px "Manrope Variable", sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(input.url.replace(/^https?:\/\//, ''), WIDTH - 64, HEIGHT - 50)

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

/** 40+ stones: the course's night sky, its stars, and the curved cloud sea with a dawn rim. */
function drawNightBackdrop(ctx: CanvasRenderingContext2D, input: ShareCardInput) {
  const { night } = input
  const sky = ctx.createLinearGradient(0, 0, 0, 1060)
  sky.addColorStop(0, night.sky[0])
  sky.addColorStop(0.55, night.sky[1])
  sky.addColorStop(0.9, night.sky[2])
  sky.addColorStop(1, night.rim)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  let seed = 97
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let index = 0; index < 90; index += 1) {
    const x = random() * WIDTH
    const y = Math.pow(random(), 1.2) * 940
    const bright = random() > 0.88
    ctx.fillStyle = bright ? 'rgba(255, 246, 230, .95)' : 'rgba(255, 246, 230, .55)'
    ctx.beginPath()
    ctx.arc(x, y, bright ? 2.6 : 1.5, 0, Math.PI * 2)
    ctx.fill()
  }

  // The cloud sea, darkened to the course's night, its edge lit by the dawn below.
  const clouds = ctx.createLinearGradient(0, 960, 0, HEIGHT)
  clouds.addColorStop(0, night.cloudLit)
  clouds.addColorStop(0.35, night.cloudShade)
  clouds.addColorStop(1, night.cloudShade)
  ctx.fillStyle = clouds
  ctx.beginPath()
  ctx.moveTo(-10, cloudTopY(-10))
  for (let x = 0; x <= WIDTH + 10; x += 20) ctx.lineTo(x, cloudTopY(x))
  ctx.lineTo(WIDTH + 10, HEIGHT)
  ctx.lineTo(-10, HEIGHT)
  ctx.fill()
  ctx.strokeStyle = night.rim
  ctx.lineWidth = 3
  ctx.globalAlpha = 0.85
  ctx.beginPath()
  for (let x = -10; x <= WIDTH + 10; x += 20) (x === -10 ? ctx.moveTo : ctx.lineTo).call(ctx, x, cloudTopY(x))
  ctx.stroke()
  ctx.globalAlpha = 1
}

/** 40+ stones, drawn over the tower: cloud tufts around its base, then lanterns, a shooting star or the arch. */
function drawHighDetails(ctx: CanvasRenderingContext2D, input: ShareCardInput, light: { x: number; y: number }) {
  const { night } = input
  ctx.fillStyle = night.cloudLit
  for (const [dx, dy, rx, ry] of [[-150, 26, 120, 34], [-30, 34, 130, 30], [120, 24, 140, 36], [250, 40, 110, 28]]) {
    ctx.globalAlpha = 0.92
    ctx.beginPath()
    ctx.ellipse(light.x + dx, cloudTopY(light.x + dx) + dy, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  if (input.height >= LANTERNS_FROM && input.height < SHOOTING_STAR_FROM) {
    // Sky lanterns drifting up out of the clouds, clear of the score and the tower.
    for (const [x, y, size] of [[180, 700, 1.25], [880, 600, 1.05], [790, 820, 0.85]]) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 46 * size)
      glow.addColorStop(0, 'rgba(255, 213, 154, .75)')
      glow.addColorStop(1, 'rgba(255, 180, 106, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(x - 46 * size, y - 46 * size, 92 * size, 92 * size)
      ctx.fillStyle = '#ffcf8a'
      ctx.beginPath()
      ctx.moveTo(x - 12 * size, y - 16 * size)
      ctx.lineTo(x + 12 * size, y - 16 * size)
      ctx.lineTo(x + 15 * size, y + 14 * size)
      ctx.lineTo(x - 15 * size, y + 14 * size)
      ctx.fill()
      ctx.fillStyle = '#e89a55'
      ctx.fillRect(x - 14 * size, y + 10 * size, 28 * size, 5 * size)
    }
  }

  if (input.height >= SHOOTING_STAR_FROM && input.height < ARCH_AT) {
    const streak = ctx.createLinearGradient(700, 150, 960, 240)
    streak.addColorStop(0, 'rgba(255, 246, 224, 0)')
    streak.addColorStop(1, 'rgba(255, 246, 224, .95)')
    ctx.strokeStyle = streak
    ctx.lineWidth = 3.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(700, 150)
    ctx.lineTo(960, 240)
    ctx.stroke()
  }

  if (input.height >= ARCH_AT) {
    // The closing arch: two lines of stars rising from the cloud sea and meeting at the tower's beacon.
    const side = (baseX: number) => [0, 0.32, 0.58, 0.8].map((t) => ({
      x: baseX + (light.x - baseX) * t,
      y: 900 + (light.y - 900) * (1 - (1 - t) ** 2),
    }))
    for (const stars of [side(150), side(2 * light.x - 150)]) {
      ctx.strokeStyle = night.line
      ctx.globalAlpha = 0.6
      ctx.lineWidth = 2
      ctx.beginPath()
      ;[...stars, light].forEach((star, index) => (index ? ctx.lineTo(star.x, star.y) : ctx.moveTo(star.x, star.y)))
      ctx.stroke()
      ctx.globalAlpha = 1
      stars.forEach((star, index) => {
        ctx.fillStyle = '#fff4e2'
        ctx.beginPath()
        ctx.arc(star.x, star.y, 4 + index * 0.8, 0, Math.PI * 2)
        ctx.fill()
      })
    }
    const flare = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, 150)
    flare.addColorStop(0, 'rgba(255, 243, 212, .6)')
    flare.addColorStop(1, 'rgba(242, 197, 143, 0)')
    ctx.fillStyle = flare
    ctx.fillRect(light.x - 150, light.y - 150, 300, 300)
    ctx.strokeStyle = 'rgba(255, 243, 212, .85)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(light.x - 34, light.y)
    ctx.lineTo(light.x + 34, light.y)
    ctx.moveTo(light.x, light.y - 34)
    ctx.lineTo(light.x, light.y + 34)
    ctx.stroke()
  }
}
