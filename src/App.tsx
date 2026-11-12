import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import afterlightMark from './assets/afterlight-mark.svg'
import { Leaderboard } from './DailyLeaderboard'
import { HeightLadder, Progress, ReadyOverlay, RunPanel, StreakPill } from './Hud'
import { bestStreakOf, nextMark } from './runStats'
import type { LeaderboardEntry } from './leaderboard'
import './App.css'
import {
  advanceGame,
  BLOCK_HEIGHT,
  createDailyChallenge,
  createGame,
  endGame,
  formatDailyDate,
  heightOf,
  pauseGame,
  placeBlock,
  resumeGame,
  SIMULATION_HZ,
  startGame,
  WORLD_WIDTH,
  type Block,
  type FallingPiece,
  type GameState,
} from './game'

const starPositions = [
  [88, 0.18], [194, 0.28], [286, 0.14], [372, 0.34], [456, 0.22],
  [598, 0.16], [704, 0.3], [792, 0.2], [912, 0.15], [956, 0.36],
  [128, 0.42], [516, 0.43], [844, 0.4], [650, 0.39],
] as const

const BLOCK_BEVEL = 10
const BLOCK_FACE_HEIGHT = BLOCK_HEIGHT - BLOCK_BEVEL
const NEAR_PERFECT_TRIM = 16
const FLOORS_PER_WORLD_MILESTONE = 5
const MAX_WORLD_MILESTONE = 6
const START_WAKE_DURATION = 460

type FeedbackSound = 'place' | 'perfect' | 'miss'
type LandingFeedbackKind = 'landed' | 'near-perfect' | 'perfect' | null

type StonePalette = {
  top: string
  front: string
  side: string
  joint: string
  roughCut: string
  roughCutHighlight: string
  activeTop: string
  activeFront: string
  activeSide: string
  activeJoint: string
}

type DailyEdition = {
  name: string
  sky: readonly [string, string, string, string]
  dawnSky: readonly [string, string, string, string]
  sea: readonly [string, string]
  dawnSea: readonly [string, string]
  moon: {
    x: number
    y: number
    radius: number
    light: string
    body: string
    shade: string
  }
  mountains: readonly [string, string]
  islands: {
    deep: string
    leftTop: string
    rightTop: string
    leftOffsetX: number
    leftOffsetY: number
    rightOffsetX: number
    rightOffsetY: number
  }
  tower: {
    shadow: string
    deep: string
    top: string
    shore: string
    trees: string
  }
  reflection: readonly [string, string]
  stone: StonePalette
}

const DAILY_EDITIONS: readonly DailyEdition[] = [
  {
    name: 'Ember tide',
    sky: ['#252b43', '#60516b', '#b77876', '#4f7477'],
    dawnSky: ['#9b7d8c', '#c77b74', '#eea16e', '#f4c794'],
    sea: ['#5b7379', '#243a4a'],
    dawnSea: ['#d19485', '#607b7d'],
    moon: { x: 204, y: 0.23, radius: 38, light: '#ffd6aa', body: '#f4c999', shade: '#b87b70' },
    mountains: ['#694e62', '#485062'],
    islands: {
      deep: '#493d4c', leftTop: '#b8a483', rightTop: '#c0a98a',
      leftOffsetX: 56, leftOffsetY: 18, rightOffsetX: -72, rightOffsetY: -10,
    },
    tower: { shadow: '#352f41', deep: '#4b3f4b', top: '#bda88a', shore: '#8d8076', trees: '#483f4e' },
    reflection: ['#d6b5a2', '#f1c28e'],
    stone: {
      top: '#ead5b7', front: '#a68970', side: '#765e5b', joint: '#806b61',
      roughCut: '#5d4c49', roughCutHighlight: '#b8987b',
      activeTop: '#ffe3bc', activeFront: '#cd9870', activeSide: '#99665d', activeJoint: '#b77b60',
    },
  },
  {
    name: 'First light',
    sky: ['#26394c', '#5b7180', '#a6a9a5', '#5d8581'],
    dawnSky: ['#91a3aa', '#c4a797', '#e8ae86', '#f3ca9d'],
    sea: ['#527d80', '#1f4651'],
    dawnSea: ['#c9aa97', '#568184'],
    moon: { x: 492, y: 0.43, radius: 34, light: '#f7d5ad', body: '#f1d3ad', shade: '#bc927e' },
    mountains: ['#627783', '#41616e'],
    islands: {
      deep: '#315363', leftTop: '#a9bcad', rightTop: '#b3c2b1',
      leftOffsetX: -30, leftOffsetY: -4, rightOffsetX: 28, rightOffsetY: 12,
    },
    tower: { shadow: '#234656', deep: '#315765', top: '#b4c5b3', shore: '#789d96', trees: '#315664' },
    reflection: ['#bdd2cf', '#f2caa4'],
    stone: {
      top: '#dce8d9', front: '#7c9f90', side: '#50767a', joint: '#64857e',
      roughCut: '#345c63', roughCutHighlight: '#86a795',
      activeTop: '#fff2ce', activeFront: '#c99e76', activeSide: '#8a6c60', activeJoint: '#ad7e61',
    },
  },
  {
    name: 'Salt moon',
    sky: ['#17263a', '#4b526d', '#bb8c8c', '#365f6c'],
    dawnSky: ['#a9909a', '#d18e83', '#e9a678', '#f0c18f'],
    sea: ['#4b7780', '#142e42'],
    dawnSea: ['#cf9c91', '#4a7780'],
    moon: { x: 820, y: 0.27, radius: 42, light: '#f6d9b6', body: '#f1d9ba', shade: '#d1aa99' },
    mountains: ['#53536c', '#344b61'],
    islands: {
      deep: '#294354', leftTop: '#91a89b', rightTop: '#9db19f',
      leftOffsetX: 0, leftOffsetY: 0, rightOffsetX: 0, rightOffsetY: 0,
    },
    tower: { shadow: '#132a3e', deep: '#294354', top: '#9fb29d', shore: '#718f88', trees: '#294657' },
    reflection: ['#a5c5c6', '#efd0a4'],
    stone: {
      top: '#d8e1d5', front: '#71988c', side: '#416a70', joint: '#5d817b',
      roughCut: '#2f5661', roughCutHighlight: '#77978e',
      activeTop: '#fff0c9', activeFront: '#d79d6f', activeSide: '#a86858', activeJoint: '#bb7d5e',
    },
  },
]

function dailyEditionForSeed(seed: number) {
  return DAILY_EDITIONS[seed % DAILY_EDITIONS.length]!
}

type LensGeometry = {
  x: number
  y: number
  width: number
  height: number
  centerX: number
  centerY: number
}

function lensGeometry(block: Block, y: number): LensGeometry {
  const width = Math.min(14, Math.max(7, block.width * 0.075))
  const height = Math.min(30, Math.max(18, BLOCK_FACE_HEIGHT * 0.52))
  const x = block.x + block.width / 2 - width / 2
  const lensY = y + BLOCK_BEVEL + (BLOCK_FACE_HEIGHT - height) / 2

  return {
    x,
    y: lensY,
    width,
    height,
    centerX: x + width / 2,
    centerY: lensY + height / 2,
  }
}

function blendColor(from: string, to: string, amount: number) {
  const mix = Math.min(1, Math.max(0, amount))
  const channel = (offset: number) => Math.round(
    Number.parseInt(from.slice(offset, offset + 2), 16) * (1 - mix)
    + Number.parseInt(to.slice(offset, offset + 2), 16) * mix,
  )

  return `#${[channel(1), channel(3), channel(5)].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

function getLandingFeedback(game: GameState): LandingFeedbackKind {
  if (game.phase !== 'playing' || game.stack.length < 2) return null
  if (game.lastDropWasPerfect) return 'perfect'

  const supportingBlock = game.stack.at(-2)!
  const landedBlock = game.stack.at(-1)!
  const trimmedWidth = Math.max(0, supportingBlock.width - landedBlock.width)

  return trimmedWidth <= NEAR_PERFECT_TRIM ? 'near-perfect' : 'landed'
}

function readSoundPreference() {
  try {
    return window.localStorage.getItem('afterlight.sound') !== 'off'
  } catch {
    return true
  }
}

function useScenePreferences() {
  const [preferences, setPreferences] = useState(() => ({
    compact: window.matchMedia('(max-width: 700px)').matches,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  }))

  useEffect(() => {
    const compactQuery = window.matchMedia('(max-width: 700px)')
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreferences = () => {
      setPreferences({
        compact: compactQuery.matches,
        reducedMotion: reducedMotionQuery.matches,
      })
    }

    compactQuery.addEventListener('change', updatePreferences)
    reducedMotionQuery.addEventListener('change', updatePreferences)

    return () => {
      compactQuery.removeEventListener('change', updatePreferences)
      reducedMotionQuery.removeEventListener('change', updatePreferences)
    }
  }, [])

  return preferences
}

function BlockShape({
  block,
  y,
  active = false,
  landed = false,
  perfect = false,
  grew = false,
  signalActive = false,
  historicalPerfect = false,
  trimmedLeft = 0,
  trimmedRight = 0,
  stoneWarmth = 0,
  stonePalette,
}: {
  block: Block
  y: number
  active?: boolean
  landed?: boolean
  perfect?: boolean
  grew?: boolean
  signalActive?: boolean
  historicalPerfect?: boolean
  trimmedLeft?: number
  trimmedRight?: number
  stoneWarmth?: number
  stonePalette: StonePalette
}) {
  const bevel = BLOCK_BEVEL
  const faceHeight = BLOCK_FACE_HEIGHT
  const cleanStone = historicalPerfect || perfect
  const weatheredTop = blendColor(stonePalette.top, '#e7d6b4', stoneWarmth)
  const weatheredFront = blendColor(stonePalette.front, '#b59c78', stoneWarmth)
  const weatheredSide = blendColor(stonePalette.side, '#77635a', stoneWarmth)
  const weatheredJoint = blendColor(stonePalette.joint, '#876f5d', stoneWarmth)
  const top = active ? stonePalette.activeTop : cleanStone ? blendColor(weatheredTop, '#f6e8c8', .18) : weatheredTop
  const front = active ? stonePalette.activeFront : cleanStone ? blendColor(weatheredFront, '#c9ad85', .2) : weatheredFront
  const side = active ? stonePalette.activeSide : cleanStone ? blendColor(weatheredSide, '#9b7b65', .18) : weatheredSide
  const jointColor = active ? stonePalette.activeJoint : cleanStone ? blendColor(weatheredJoint, '#a88669', .25) : weatheredJoint
  const lensColor = active ? '#fff0b7' : signalActive ? '#ffe4a7' : cleanStone ? '#ffe0a2' : '#d6a86d'
  const roughCut = blendColor(stonePalette.roughCut, '#63534c', stoneWarmth)
  const roughCutHighlight = blendColor(stonePalette.roughCutHighlight, '#b89b78', stoneWarmth)
  const lens = lensGeometry(block, y)
  const masonryJoints = block.width > 155 ? [0.18, 0.43, 0.72, 0.88] : [0.28, 0.7]
  const roughTop = y + bevel + 5
  const roughBottom = y + BLOCK_HEIGHT - 5
  const leftRoughWidth = Math.min(11, Math.max(4, trimmedLeft * 0.35))
  const rightRoughWidth = Math.min(11, Math.max(4, trimmedRight * 0.35))
  const classes = [active && 'moving-block', signalActive && 'signal-stone']
    .filter(Boolean)
    .join(' ')

  return (
    <motion.g
      className={classes || undefined}
      initial={landed ? { opacity: 0.74, y: -13, scaleY: 0.94, scaleX: grew ? 0.86 : 1 } : false}
      animate={{ opacity: 1, y: 0, scaleY: 1, scaleX: 1 }}
      transition={landed
        ? { type: 'spring', stiffness: 460, damping: 25, mass: 0.65 }
        : { duration: 0 }}
      style={{ transformBox: 'fill-box', transformOrigin: 'center bottom' }}
    >
        <polygon
          points={`${block.x},${y + bevel} ${block.x + bevel},${y} ${block.x + block.width + bevel},${y} ${block.x + block.width},${y + bevel}`}
          fill={top}
        />
        <rect x={block.x} y={y + bevel} width={block.width} height={faceHeight} rx="2" fill={front} />
        {trimmedLeft > 0 && (
          <>
            <path
              d={`M${block.x} ${roughTop}H${block.x + leftRoughWidth}L${block.x + leftRoughWidth * 0.58} ${roughTop + 13}L${block.x + leftRoughWidth} ${roughTop + 26}V${roughBottom}H${block.x}Z`}
              fill={roughCut}
              opacity=".84"
            />
            <path
              d={`M${block.x + leftRoughWidth} ${roughTop + 5}L${block.x + leftRoughWidth * 0.6} ${roughTop + 15}L${block.x + leftRoughWidth} ${roughTop + 24}`}
              fill="none"
              stroke={roughCutHighlight}
              strokeWidth="1.2"
              opacity=".65"
            />
          </>
        )}
        {trimmedRight > 0 && (
          <>
            <path
              d={`M${block.x + block.width} ${roughTop}H${block.x + block.width - rightRoughWidth}L${block.x + block.width - rightRoughWidth * 0.58} ${roughTop + 13}L${block.x + block.width - rightRoughWidth} ${roughTop + 26}V${roughBottom}H${block.x + block.width}Z`}
              fill={roughCut}
              opacity=".84"
            />
            <path
              d={`M${block.x + block.width - rightRoughWidth} ${roughTop + 5}L${block.x + block.width - rightRoughWidth * 0.6} ${roughTop + 15}L${block.x + block.width - rightRoughWidth} ${roughTop + 24}`}
              fill="none"
              stroke={roughCutHighlight}
              strokeWidth="1.2"
              opacity=".65"
            />
          </>
        )}
        <path
          d={`M${block.x} ${y + bevel + 10}H${block.x + block.width}`}
          stroke={active ? '#e9b681' : cleanStone ? blendColor(stonePalette.top, '#d4bd93', stoneWarmth) : blendColor(stonePalette.top, '#c09e78', stoneWarmth)}
          strokeWidth="2"
          opacity={cleanStone ? '.68' : '.58'}
        />
        {masonryJoints.map((position) => (
          <path
            key={position}
            d={`M${block.x + block.width * position} ${y + bevel + 5}V${y + BLOCK_HEIGHT - 5}`}
            stroke={jointColor}
            strokeWidth="2"
            opacity=".58"
          />
        ))}
        <polygon
          points={`${block.x + block.width},${y + bevel} ${block.x + block.width + bevel},${y} ${block.x + block.width + bevel},${y + faceHeight - 2} ${block.x + block.width},${y + BLOCK_HEIGHT}`}
          fill={side}
        />
        <rect
          x={lens.x - 4}
          y={lens.y - 4}
          width={lens.width + 8}
          height={lens.height + 8}
          rx={(lens.width + 8) / 2}
          fill={lensColor}
          filter="url(#soft-bloom)"
          opacity={signalActive ? '.4' : cleanStone ? '.38' : '.2'}
        />
        <rect x={lens.x} y={lens.y} width={lens.width} height={lens.height} rx={lens.width / 2} fill={lensColor} />
        <rect
          x={lens.x + lens.width * 0.32}
          y={lens.y + lens.height * 0.17}
          width={lens.width * 0.36}
          height={lens.height * 0.66}
          rx={lens.width * 0.18}
          fill="#fff7da"
          opacity=".88"
        />
    </motion.g>
  )
}

function StartWake({
  block,
  y,
  reducedMotion,
}: {
  block: Block
  y: number
  reducedMotion: boolean
}) {
  if (reducedMotion) return null

  const lens = lensGeometry(block, y)
  return (
    <motion.g pointerEvents="none">
      <motion.rect
        x={lens.x - 9}
        y={lens.y - 9}
        width={lens.width + 18}
        height={lens.height + 18}
        rx={(lens.width + 18) / 2}
        fill="#fff0c4"
        filter="url(#soft-bloom)"
        initial={{ opacity: 0, scale: 0.24 }}
        animate={{ opacity: [0, .92, .28], scale: [.24, 1.2, 1.55] }}
        transition={{ duration: START_WAKE_DURATION / 1000, ease: 'easeOut' }}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      />
      <motion.path
        d={`M${lens.centerX} ${lens.y - 18}V${lens.y - 4}`}
        fill="none"
        stroke="#fff1cd"
        strokeWidth="2"
        strokeLinecap="round"
        filter="url(#soft-bloom)"
        initial={{ opacity: 0, pathLength: 0, y: 5 }}
        animate={{ opacity: [0, .78, 0], pathLength: [0, 1, 1], y: [5, 0, -3] }}
        transition={{ duration: START_WAKE_DURATION / 1000, ease: 'easeOut' }}
      />
    </motion.g>
  )
}

function BeaconSignal({
  stack,
  groundY,
  perfectStreak,
  placement,
  reducedMotion,
}: {
  stack: Block[]
  groundY: number
  perfectStreak: number
  placement: number
  reducedMotion: boolean
}) {
  if (perfectStreak === 0 || stack.length < 2) return null

  const firstPerfectIndex = Math.max(1, stack.length - perfectStreak)
  const intensity = Math.min(0.92, 0.34 + perfectStreak * 0.1)
  const signalWidth = Math.min(2.4, 1.15 + perfectStreak * 0.14)

  return (
    <motion.g
      key={`signal-${placement}-${perfectStreak}`}
      className="beacon-signal"
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reducedMotion ? 0 : 0.28, ease: 'easeOut' }}
      pointerEvents="none"
    >
      {stack.slice(firstPerfectIndex).map((block, offset) => {
        const index = firstPerfectIndex + offset
        const upper = lensGeometry(block, groundY - (index + 1) * BLOCK_HEIGHT)
        const lower = lensGeometry(stack[index - 1], groundY - index * BLOCK_HEIGHT)
        const startY = upper.centerY + upper.height / 2 - 1
        const endY = lower.centerY - lower.height / 2 + 1
        const controlY = (startY + endY) / 2
        const path = `M${upper.centerX} ${startY}C${upper.centerX} ${controlY} ${lower.centerX} ${controlY} ${lower.centerX} ${endY}`

        return (
          <g key={index}>
            <motion.path
              d={path}
              fill="none"
              stroke="#f6c87e"
              strokeWidth={signalWidth + 3.8}
              strokeLinecap="round"
              filter="url(#soft-bloom)"
              initial={reducedMotion ? false : { opacity: 0, pathLength: 0 }}
              animate={{ opacity: intensity * 0.44, pathLength: 1 }}
              transition={{ duration: reducedMotion ? 0 : 0.36, delay: offset * 0.055, ease: 'easeOut' }}
            />
            <motion.path
              d={path}
              fill="none"
              stroke="#fff2c9"
              strokeWidth={signalWidth}
              strokeLinecap="round"
              initial={reducedMotion ? false : { opacity: 0, pathLength: 0 }}
              animate={{ opacity: intensity, pathLength: 1 }}
              transition={{ duration: reducedMotion ? 0 : 0.32, delay: offset * 0.055, ease: 'easeOut' }}
            />
          </g>
        )
      })}
    </motion.g>
  )
}

function LandingFeedback({
  kind,
  block,
  support,
  y,
  placement,
  reducedMotion,
}: {
  kind: Exclude<LandingFeedbackKind, null>
  block: Block
  support: Block
  y: number
  placement: number
  reducedMotion: boolean
}) {
  if (reducedMotion) return null

  const contactLeft = Math.max(block.x, support.x) + 4
  const contactRight = Math.min(block.x + block.width, support.x + support.width) - 4
  const contactWidth = contactRight - contactLeft
  if (contactWidth <= 0) return null

  const contactCenter = contactLeft + contactWidth / 2
  const seamY = y + BLOCK_HEIGHT - 2
  const lens = lensGeometry(block, y)

  return (
    <motion.g key={`landing-feedback-${placement}`} pointerEvents="none">
      <motion.ellipse
        cx={contactCenter}
        cy={seamY + 4}
        rx={Math.max(18, contactWidth * 0.45)}
        ry="4"
        fill="#10293a"
        initial={{ opacity: 0, scaleX: 0.72 }}
        animate={{ opacity: [0, 0.46, 0.18, 0], scaleX: [0.72, 1.08, 1, 0.94] }}
        transition={{ duration: 0.48, ease: 'easeOut' }}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      />

      {kind === 'near-perfect' && (
        <>
          <motion.path
            d={`M${contactLeft} ${seamY}H${contactRight}`}
            fill="none"
            stroke="#ebb86f"
            strokeWidth="6"
            strokeLinecap="round"
            filter="url(#soft-bloom)"
            initial={{ opacity: 0, pathLength: 0 }}
            animate={{ opacity: [0, 0.38, 0], pathLength: [0, 1, 1] }}
            transition={{ duration: 0.58, ease: 'easeOut' }}
          />
          <motion.path
            d={`M${contactLeft} ${seamY}H${contactRight}`}
            fill="none"
            stroke="#fff0c7"
            strokeWidth="2.2"
            strokeLinecap="round"
            initial={{ opacity: 0, pathLength: 0 }}
            animate={{ opacity: [0, 0.82, 0], pathLength: [0, 1, 1] }}
            transition={{ duration: 0.58, ease: 'easeOut' }}
          />
        </>
      )}

      {kind === 'perfect' && (
        <>
          <motion.path
            d={`M${contactLeft} ${seamY}H${contactRight}`}
            fill="none"
            stroke="#ffe0a2"
            strokeWidth="2.4"
            strokeLinecap="round"
            initial={{ opacity: 0, pathLength: 0 }}
            animate={{ opacity: [0, .9, 0], pathLength: [0, 1, 1] }}
            transition={{ duration: 0.34, ease: 'easeOut' }}
          />
          <motion.rect
            x={lens.x - 2}
            y={lens.y - 2}
            width={lens.width + 4}
            height={lens.height + 4}
            rx={(lens.width + 4) / 2}
            fill="#fff0c5"
            initial={{ opacity: 0, scale: .88 }}
            animate={{ opacity: [0, .72, 0], scale: [.88, 1.06, 1.12] }}
            transition={{ duration: .34, ease: 'easeOut' }}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          />
        </>
      )}
    </motion.g>
  )
}

function Lantern({
  x,
  y,
  lit,
  celebration = 0,
  sequence = 0,
}: {
  x: number
  y: number
  lit: boolean
  celebration?: number
  sequence?: number
}) {
  return (
    <g className={lit ? 'lantern is-lit' : 'lantern'}>
      {lit && <circle cx={x} cy={y} r="10" fill="#ffd995" opacity=".55" filter="url(#soft-bloom)" />}
      <circle cx={x} cy={y} r="3" fill={lit ? '#ffe8b9' : '#5c777b'} />
      <circle cx={x} cy={y} r="1.25" fill={lit ? '#fff5d7' : '#819391'} />
      {celebration > 0 && (
        <motion.circle
          key={celebration}
          cx={x}
          cy={y}
          r="3.5"
          fill="#fff1c7"
          filter="url(#soft-bloom)"
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: [0, 1, 0], scale: [0.3, 1.5, 2.4] }}
          transition={{ duration: 0.72, delay: sequence * 0.08, ease: 'easeOut' }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          pointerEvents="none"
        />
      )}
    </g>
  )
}

function CottageWindows({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  return (
    <motion.g
      initial={false}
      animate={{ opacity: active ? 1 : 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.8, ease: 'easeOut' }}
      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      pointerEvents="none"
    >
      {[[136, 62], [148, 62], [143, 70]].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="5" fill="#ffd98f" opacity=".25" filter="url(#soft-bloom)" />
          <rect x={x - 1.5} y={y - 2} width="3" height="4" rx=".6" fill="#ffe9b7" />
        </g>
      ))}
    </motion.g>
  )
}

function Lighthouse({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  return (
    <motion.g
      initial={false}
      animate={{ opacity: active ? 1 : 0, y: active ? 0 : 2 }}
      transition={{ duration: reducedMotion ? 0 : 0.82, ease: 'easeOut' }}
      pointerEvents="none"
    >
      {active && (
        <motion.path
          d="M958 41L832 11 832 72Z"
          fill="#ffe2ac"
          filter="url(#soft-bloom)"
          initial={false}
          animate={reducedMotion ? { opacity: .1 } : { opacity: [.06, .15, .06], rotate: [-3, 4, -3] }}
          transition={reducedMotion
            ? { duration: 0 }
            : { duration: 6.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformBox: 'fill-box', transformOrigin: 'right center' }}
        />
      )}
      <path d="M949 79V49h16v30z" fill="#e0c19a" />
      <path d="M946 50l11-15 12 15z" fill="#294354" />
      <path d="M951 56h12v5h-12z" fill="#ffd895" opacity=".7" />
      <circle cx="957" cy="46" r="4.5" fill="#ffdf9d" filter="url(#soft-bloom)" />
      <circle cx="957" cy="46" r="1.7" fill="#fff6db" />
    </motion.g>
  )
}

function BirdFlock({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  return (
    <motion.g
      initial={false}
      animate={{ opacity: active ? .56 : 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.8, ease: 'easeOut' }}
      fill="none"
      stroke="#f6e0bd"
      strokeWidth="1.6"
      strokeLinecap="round"
      pointerEvents="none"
    >
      <motion.g
        initial={false}
        animate={active && !reducedMotion ? { x: [0, 24, -8, 0], y: [0, -3, 1, 0] } : { x: 0, y: 0 }}
        transition={active && !reducedMotion
          ? { duration: 12, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0 }}
      >
        <path d="M304 176q6-6 12 0 6-6 12 0M338 192q5-5 10 0 5-5 10 0M276 204q4-4 8 0 4-4 8 0" />
      </motion.g>
    </motion.g>
  )
}

function HarborBuoy({
  active,
  waterY,
  reducedMotion,
}: {
  active: boolean
  waterY: number
  reducedMotion: boolean
}) {
  return (
    <motion.g
      initial={false}
      animate={{ opacity: active ? 1 : 0, y: active ? 0 : 2 }}
      transition={{ duration: reducedMotion ? 0 : 0.82, ease: 'easeOut' }}
      pointerEvents="none"
    >
      <path d={`M172 ${waterY + 7}V${waterY - 24}`} stroke="#264758" strokeWidth="3" strokeLinecap="round" />
      <path d={`M164 ${waterY - 5}h16l-3 9h-10z`} fill="#496e73" />
      <circle cx="172" cy={waterY - 27} r="8" fill="#ffd996" opacity=".28" filter="url(#soft-bloom)" />
      <circle cx="172" cy={waterY - 27} r="3.1" fill="#ffeac0" />
      <motion.path
        d={`M158 ${waterY + 17}h28m-20 10h15`}
        fill="none"
        stroke="#f0cb91"
        strokeWidth="1.3"
        strokeLinecap="round"
        initial={false}
        animate={active && !reducedMotion ? { opacity: [.18, .62, .18] } : { opacity: active ? .36 : 0 }}
        transition={active && !reducedMotion
          ? { duration: 3.8, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0 }}
      />
    </motion.g>
  )
}

function DawnWaterPath({
  active,
  waterY,
  reducedMotion,
}: {
  active: boolean
  waterY: number
  reducedMotion: boolean
}) {
  return (
    <motion.g
      initial={false}
      animate={{ opacity: active ? 1 : 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.9, ease: 'easeOut' }}
      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      pointerEvents="none"
    >
      <motion.path
        d={`M385 ${waterY + 8}h232m-194 12h156m-118 12h82`}
        fill="none"
        stroke="#f5d39f"
        strokeWidth="2"
        strokeLinecap="round"
        animate={active && !reducedMotion ? { opacity: [.18, .52, .22] } : { opacity: active ? .32 : 0 }}
        transition={active && !reducedMotion
          ? { duration: 4.6, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0 }}
      />
    </motion.g>
  )
}

function WindSignature({ windPercent }: { windPercent: number }) {
  const strength = Math.abs(windPercent)
  const isCalm = strength === 0
  const duration = Math.max(1.6, 3.8 - strength * 0.22)
  const classes = [
    'wind-signature',
    isCalm ? 'is-calm' : 'is-breezy',
    windPercent < 0 && 'is-leftward',
  ].filter(Boolean).join(' ')
  const style = { '--wind-mark-duration': `${duration}s` } as CSSProperties

  return (
    <div className={classes} style={style} aria-hidden="true">
      <svg className="wind-glyph" viewBox="0 0 30 18" focusable="false">
        <path d="M1.5 4.5h15c4.5 0 4.5-3.2 1.7-3.2M6 9h20.5c3.1 0 3.8 3.6.5 3.6M1.5 14h12.5" />
      </svg>
      <strong className="wind-value">
        {isCalm ? 'Calm' : `${windPercent > 0 ? '+' : '−'}${strength}%`}
      </strong>
    </div>
  )
}

function WaterImpact({
  piece,
  waterY,
  forceful = false,
}: {
  piece: FallingPiece
  waterY: number
  forceful?: boolean
}) {
  const center = piece.x + piece.width / 2
  const impactDelay = forceful ? 0.78 : 0.64
  const rippleRadius = Math.min(forceful ? 88 : 54, Math.max(24, piece.width * 0.42))
  const rippleHeight = forceful ? 12 : 7

  return (
    <motion.g key={`impact-${piece.id}-${piece.x}`} pointerEvents="none">
      <motion.ellipse
        cx={center}
        cy={waterY + 2}
        rx={rippleRadius}
        ry={rippleHeight}
        fill="none"
        stroke={forceful ? '#e3e6d2' : '#b9ddd4'}
        strokeWidth={forceful ? 2.6 : 1.5}
        initial={{ opacity: 0, scale: 0.16 }}
        animate={{ opacity: [0, forceful ? 0.84 : 0.58, 0], scale: [0.16, 1, forceful ? 1.78 : 1.45] }}
        transition={{ duration: forceful ? 0.92 : 0.64, delay: impactDelay, ease: 'easeOut' }}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      />
      {forceful && (
        <>
          <motion.path
            d={`M${center - 18} ${waterY + 4}Q${center - 20} ${waterY - 23} ${center - 7} ${waterY - 35}`}
            fill="none"
            stroke="#d4e6db"
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ opacity: 0, pathLength: 0, y: 6 }}
            animate={{ opacity: [0, 0.9, 0], pathLength: [0, 1, 1], y: [6, 0, -4] }}
            transition={{ duration: 0.56, delay: impactDelay, ease: 'easeOut' }}
          />
          <motion.path
            d={`M${center + 17} ${waterY + 4}Q${center + 20} ${waterY - 18} ${center + 8} ${waterY - 29}`}
            fill="none"
            stroke="#c4e1d7"
            strokeWidth="2.4"
            strokeLinecap="round"
            initial={{ opacity: 0, pathLength: 0, y: 6 }}
            animate={{ opacity: [0, 0.82, 0], pathLength: [0, 1, 1], y: [6, 0, -3] }}
            transition={{ duration: 0.5, delay: impactDelay + 0.04, ease: 'easeOut' }}
          />
        </>
      )}
    </motion.g>
  )
}

function GameScene({
  game,
  height,
  isWaking = false,
}: {
  game: GameState
  height: number
  isWaking?: boolean
}) {
  const { compact, reducedMotion } = useScenePreferences()
  // Count celebrations while rendering (React's "adjust state on prop change" pattern), not in an effect.
  const placement = game.placementTicks.length
  const celebrating = game.lastDropWasPerfect && game.perfectStreak > 0 && game.perfectStreak % 5 === 0
  const [celebration, setCelebration] = useState({ count: 0, placement })
  if (celebration.placement !== placement) {
    setCelebration({ count: celebration.count + Number(celebrating), placement })
  }
  const beaconCelebration = celebration.count
  const edition = dailyEditionForSeed(game.challenge.seed)
  const groundY = height - 105
  const activeY = groundY - (game.stack.length + 1) * BLOCK_HEIGHT
  const tallMobileViewport = compact && height > WORLD_WIDTH * 1.15
  const targetY = height * (tallMobileViewport ? 0.64 : compact ? 0.48 : 0.43)
  const cameraShift = targetY - activeY
  const climbProgress = game.stack.length * BLOCK_HEIGHT
  const horizon = height * 0.59
  const waterY = height - 47
  const dawnStage = Math.min(heightOf(game) / 36, 1)
  const dawnProgress = dawnStage * dawnStage * (3 - 2 * dawnStage)
  const dawnTransition = reducedMotion
    ? { duration: 0 }
    : { duration: 1.8, ease: 'easeInOut' as const }
  const worldMilestone = Math.min(MAX_WORLD_MILESTONE, Math.floor(heightOf(game) / FLOORS_PER_WORLD_MILESTONE))
  const signalStartIndex = game.perfectStreak > 0
    ? Math.max(0, game.stack.length - game.perfectStreak - 1)
    : game.stack.length
  const landingFeedback = getLandingFeedback(game)
  const perfectCameraSettle = landingFeedback === 'perfect' && !reducedMotion
  const windStrength = Math.abs(game.windPercent)
  const windDirection = game.windPercent < 0 ? -1 : 1
  const sceneryIntensity = compact ? 0.7 : 1
  const cloudDrift = (12 + windStrength * 1.5) * sceneryIntensity
  const cloudDuration = (42 - windStrength * 1.1) * (compact ? 1.28 : 1)
  const waterGlintDrift = windDirection * (2 + windStrength * 1.45) * sceneryIntensity
  const waterGlintDuration = Math.max(3.6, 6.2 - windStrength * 0.24) * (compact ? 1.18 : 1)
  const waterReflectionColor = blendColor(edition.reflection[0], edition.reflection[1], dawnProgress)
  const waterReflectionOpacity = 0.16 + dawnProgress * 0.12
  const blockSway = Math.min(2.3, windStrength * 0.28)
  const blockSwayDuration = Math.max(1.65, 3.2 - windStrength * 0.12)
  const nearCloudStyle = {
    '--wind-drift': `${windDirection * cloudDrift}px`,
    '--wind-duration': `${cloudDuration}s`,
  } as CSSProperties
  const farCloudStyle = {
    '--wind-drift': `${windDirection * cloudDrift * 0.68}px`,
    '--wind-duration': `${cloudDuration * 1.18}s`,
    '--wind-delay': `${-cloudDuration * 1.18 * 0.37}s`,
  } as CSSProperties
  const waterGlintStyle = {
    '--water-drift': `${waterGlintDrift}px`,
    '--water-duration': `${waterGlintDuration}s`,
    '--water-glint-low': `${waterReflectionOpacity * 0.45}`,
    '--water-glint-high': `${waterReflectionOpacity}`,
  } as CSSProperties

  return (
    <svg
      className="game-scene"
      viewBox={`0 0 ${WORLD_WIDTH} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Afterlight tower, height ${heightOf(game)}`}
    >
      <defs>
        <linearGradient id="sky" x2="0" y2="1">
          <stop stopColor={edition.sky[0]} />
          <stop offset=".42" stopColor={edition.sky[1]} />
          <stop offset=".76" stopColor={edition.sky[2]} />
          <stop offset="1" stopColor={edition.sky[3]} />
        </linearGradient>
        <linearGradient id="dawn-sky" x2="0" y2="1">
          <stop stopColor={edition.dawnSky[0]} stopOpacity=".025" />
          <stop offset=".42" stopColor={edition.dawnSky[1]} stopOpacity=".12" />
          <stop offset=".76" stopColor={edition.dawnSky[2]} stopOpacity=".48" />
          <stop offset="1" stopColor={edition.dawnSky[3]} stopOpacity=".76" />
        </linearGradient>
        <linearGradient id="sea" x2="0" y2="1">
          <stop stopColor={edition.sea[0]} />
          <stop offset="1" stopColor={edition.sea[1]} />
        </linearGradient>
        <linearGradient id="dawn-sea" x2="0" y2="1">
          <stop stopColor={edition.dawnSea[0]} stopOpacity=".58" />
          <stop offset="1" stopColor={edition.dawnSea[1]} stopOpacity=".2" />
        </linearGradient>
        <radialGradient id="moon-body" cx=".38" cy=".35" r=".75">
          <stop stopColor="#fff4df" />
          <stop offset=".7" stopColor={edition.moon.body} />
          <stop offset="1" stopColor={edition.moon.shade} />
        </radialGradient>
        <radialGradient id="horizon-glow" cy="1" r=".7">
          <stop stopColor={edition.moon.light} stopOpacity=".42" />
          <stop offset="1" stopColor={edition.moon.light} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="moonlight">
          <stop stopColor={edition.moon.light} stopOpacity=".48" />
          <stop offset="1" stopColor={edition.moon.light} stopOpacity="0" />
        </radialGradient>
        <filter id="soft-bloom" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      <rect width={WORLD_WIDTH} height={height} fill="url(#sky)" />
      <motion.rect
        width={WORLD_WIDTH}
        height={height}
        fill="url(#dawn-sky)"
        initial={false}
        animate={{ opacity: dawnProgress }}
        transition={dawnTransition}
        pointerEvents="none"
      />
      <g transform={`translate(0 ${height * 0.16})`}>
        <motion.g
          initial={false}
          animate={{ y: reducedMotion ? 0 : climbProgress * 0.012 * sceneryIntensity }}
          transition={reducedMotion
            ? { duration: 0 }
            : compact
              ? { duration: 0.52, ease: 'easeOut' }
              : { type: 'spring', stiffness: 24, damping: 18 }}
        >
          <g className="cloud-drift" style={nearCloudStyle} fill="none" stroke="#e8ded0" strokeLinecap="round">
            <path d="M-100 0c86-25 142-25 224-2s136 20 211-5 140-20 222 5" strokeWidth="22" opacity=".07" />
            <path d="M-60 10c72-14 124-13 190 1s121 13 186-3 132-13 196 4" strokeWidth="3" opacity=".18" />
          </g>
        </motion.g>
      </g>
      <g transform={`translate(0 ${height * 0.32})`}>
        <motion.g
          initial={false}
          animate={{ y: reducedMotion ? 0 : climbProgress * 0.018 * sceneryIntensity }}
          transition={reducedMotion
            ? { duration: 0 }
            : compact
              ? { duration: 0.62, ease: 'easeOut' }
              : { type: 'spring', stiffness: 20, damping: 17 }}
        >
          <g className="cloud-drift cloud-drift--far" style={farCloudStyle} fill="none" stroke="#c7c7ce" strokeLinecap="round">
            <path d="M550 0c68-19 112-17 177 0s113 17 176-2 117-14 175 4" strokeWidth="25" opacity=".055" />
            <path d="M603 10c61-11 103-10 160 1s101 10 153-2 100-11 153 1" strokeWidth="3" opacity=".14" />
          </g>
        </motion.g>
      </g>
      <motion.g
        initial={false}
        animate={{ opacity: 1 - dawnProgress }}
        transition={dawnTransition}
      >
        <circle cx={edition.moon.x} cy={height * edition.moon.y} r={edition.moon.radius * 3.57} fill="url(#moonlight)" />
        <circle cx={edition.moon.x} cy={height * edition.moon.y} r={edition.moon.radius} fill="url(#moon-body)" />
        <g fill={edition.moon.shade} opacity=".32">
          <circle cx={edition.moon.x + edition.moon.radius * 0.25} cy={height * edition.moon.y - edition.moon.radius * 0.2} r={edition.moon.radius * 0.18} />
          <circle cx={edition.moon.x - edition.moon.radius * 0.3} cy={height * edition.moon.y + edition.moon.radius * 0.25} r={edition.moon.radius * 0.12} />
          <circle cx={edition.moon.x + edition.moon.radius * 0.35} cy={height * edition.moon.y + edition.moon.radius * 0.4} r={edition.moon.radius * 0.09} />
        </g>
        <circle cx={edition.moon.x} cy={height * edition.moon.y} r={edition.moon.radius} fill="none" stroke="#fff6e6" strokeOpacity=".45" />
      </motion.g>

      <motion.g
        className="sky-stars"
        initial={false}
        animate={{ opacity: 1 - dawnProgress }}
        transition={dawnTransition}
      >
        {starPositions.map(([x, y], index) => (
          <circle key={index} cx={x} cy={height * y} r={index % 3 === 0 ? 1.7 : 1.2} fill="#f5e8ce" opacity={index % 2 ? '.56' : '.8'} />
        ))}
      </motion.g>
      <rect y={horizon - 90} width={WORLD_WIDTH} height="170" fill="url(#horizon-glow)" pointerEvents="none" />
      <BirdFlock active={worldMilestone >= 5} reducedMotion={reducedMotion} />
      <motion.g
        initial={false}
        animate={{ y: reducedMotion ? 0 : climbProgress * 0.007 * sceneryIntensity }}
        transition={reducedMotion
          ? { duration: 0 }
          : compact
            ? { duration: 0.54, ease: 'easeOut' }
            : { type: 'spring', stiffness: 18, damping: 18 }}
      >
        <path d={`M0 ${horizon}q130 -80 250 -26 130 -94 250 -10 140 -91 270 -8 110 -59 230 18v150H0z`} fill={edition.mountains[0]} opacity=".72" />
      </motion.g>
      <motion.g
        initial={false}
        animate={{ y: reducedMotion ? 0 : climbProgress * 0.016 * sceneryIntensity }}
        transition={reducedMotion
          ? { duration: 0 }
          : compact
            ? { duration: 0.62, ease: 'easeOut' }
            : { type: 'spring', stiffness: 21, damping: 18 }}
      >
        <path d={`M0 ${horizon + 72}q120 -55 235 -8 111 -72 227 -5 131 -74 253 -9 124 -62 285 -3v140H0z`} fill={edition.mountains[1]} opacity=".92" />
      </motion.g>

      {/* Far islands */}
      <g transform={`translate(${edition.islands.leftOffsetX} ${height * 0.45 + edition.islands.leftOffsetY})`}>
        <motion.g
          initial={false}
          animate={{ y: reducedMotion ? 0 : climbProgress * 0.035 * sceneryIntensity }}
          transition={reducedMotion
            ? { duration: 0 }
            : compact
              ? { duration: 0.56, ease: 'easeOut' }
              : { type: 'spring', stiffness: 24, damping: 18 }}
        >
        <motion.g
          animate={{ y: reducedMotion ? 0 : [0, compact ? -1.25 : -2.5, 0] }}
          transition={reducedMotion
            ? { duration: 0 }
            : { duration: compact ? 10 : 7.5, repeat: Infinity, ease: 'easeInOut' }}
        >
        <path d="M58 70q20-40 65-31 38-34 78 0 47-8 68 32l-18 18q-42 4-63 27l-31-4-34 24-23-15-36 5-13-25-26-7z" fill={edition.islands.deep} />
        <path d="M72 67q24-28 62-22 40-33 74 0 41-7 59 26-29 12-61 6-39 14-72 0-33 10-62-10z" fill={edition.islands.leftTop} />
        <path d="M131 52h22v26h-22zM126 53l16-15 16 15z" fill="#e2bd98" />
        <path d="M92 59v-20m-7 12 7-13 7 13m123 4V37m-7 12 7-13 7 13" stroke={edition.islands.deep} strokeWidth="3" fill="none" strokeLinecap="round" />
        <CottageWindows active={worldMilestone >= 1} reducedMotion={reducedMotion} />
        <Lantern x={95} y={49} lit={Math.floor(game.perfects / 5) >= 1} celebration={beaconCelebration} sequence={8} />
        <Lantern x={142} y={66} lit={Math.floor(game.perfects / 5) >= 2} celebration={beaconCelebration} sequence={6} />
        <Lantern x={215} y={47} lit={Math.floor(game.perfects / 5) >= 3} celebration={beaconCelebration} sequence={4} />
        </motion.g>
        </motion.g>
      </g>
      <g transform={`translate(${edition.islands.rightOffsetX} ${height * 0.41 + edition.islands.rightOffsetY})`}>
        <motion.g
          initial={false}
          animate={{ y: reducedMotion ? 0 : climbProgress * 0.065 * sceneryIntensity }}
          transition={reducedMotion
            ? { duration: 0 }
            : compact
              ? { duration: 0.66, ease: 'easeOut' }
              : { type: 'spring', stiffness: 20, damping: 17 }}
        >
        <motion.g
          animate={{ y: reducedMotion ? 0 : [0, compact ? 1 : 2, 0] }}
          transition={reducedMotion
            ? { duration: 0 }
            : { duration: compact ? 12 : 9, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
        >
        <path d="M760 82q24-42 67-34 42-36 82-1 44-8 71 33l-18 20q-43 7-64 26l-33-6-35 25-23-14-36 4-13-24-27-7z" fill={edition.islands.deep} />
        <path d="M774 78q24-30 62-25 42-34 78 0 41-6 58 28-28 11-60 4-39 15-72 1-34 9-66-8z" fill={edition.islands.rightTop} />
        <path d="M835 64h26v30h-26zM829 65l19-18 19 18z" fill="#e4c19a" />
        <path d="M885 66V43m-8 13 8-14 8 14m37 12V47m-7 12 7-13 7 13" stroke={edition.islands.deep} strokeWidth="3.4" fill="none" strokeLinecap="round" />
        <Lighthouse active={worldMilestone >= 3} reducedMotion={reducedMotion} />
        <Lantern x={848} y={80} lit={Math.floor(game.perfects / 5) >= 4} celebration={beaconCelebration} sequence={3} />
        <Lantern x={887} y={57} lit={Math.floor(game.perfects / 5) >= 5} celebration={beaconCelebration} sequence={5} />
        <Lantern x={923} y={60} lit={Math.floor(game.perfects / 5) >= 6} celebration={beaconCelebration} sequence={7} />
        </motion.g>
        </motion.g>
      </g>

      {/* The beacon island and tower follow the camera as the stack climbs. */}
      <motion.g
        initial={false}
        animate={{ y: cameraShift }}
        transition={reducedMotion
          ? { duration: 0 }
          : compact
            ? { duration: 0.42, ease: 'easeOut' }
            : { type: 'spring', stiffness: 78, damping: 27, mass: 0.85 }}
      >
      <motion.g
        key={`tower-settle-${game.placementTicks.length}`}
        initial={perfectCameraSettle ? { y: -4 } : false}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 390, damping: 24, mass: 0.48 }}
      >
        <ellipse cx="500" cy={groundY + 12} rx="276" ry="36" fill={edition.tower.shadow} opacity=".38" />
        <path d={`M224 ${groundY - 8}q38-58 116-48 50-49 117-28 60-47 125-12 77-32 134 20 73 2 103 56l-34 30q-57-4-92 26l-57-13-66 42-53-20-70 34-44-25-75 17-32-31-64-11z`} fill={edition.tower.deep} />
        <path d={`M240 ${groundY - 14}q46-45 108-32 55-49 118-24 61-46 122-10 71-25 124 21 60 5 88 45-44 19-104 10-66 23-122 4-67 22-127 3-74 22-123-1-42 10-84-16z`} fill={edition.tower.top} />
        <path d={`M267 ${groundY + 14}q69-19 127 0 69-19 132 0 66-20 133 4 41 5 78-3l-35 29q-49 1-77 21l-58-14-63 41-52-21-66 33-43-26-74 16-31-28z`} fill={edition.tower.shore} />
        <g fill={edition.tower.trees}>
          <path d={`M340 ${groundY - 42}l15-34 15 34zM383 ${groundY - 41}l12-26 12 26zM710 ${groundY - 42}l16-36 16 36zM753 ${groundY - 41}l11-25 12 25z`} />
          <path d={`M347 ${groundY - 42}v17m42-17v17m344-17v17m41-17v17`} stroke={edition.tower.trees} strokeWidth="4" />
        </g>
        <Lantern x={355} y={groundY - 65} lit={Math.floor(game.perfects / 5) >= 7} celebration={beaconCelebration} sequence={2} />
        <Lantern x={397} y={groundY - 62} lit={Math.floor(game.perfects / 5) >= 8} celebration={beaconCelebration} sequence={0} />
        <Lantern x={726} y={groundY - 67} lit={Math.floor(game.perfects / 5) >= 9} celebration={beaconCelebration} sequence={1} />
        <Lantern x={278} y={groundY - 31} lit={worldMilestone >= 4} />
        <Lantern x={316} y={groundY - 42} lit={worldMilestone >= 4} />
        <Lantern x={678} y={groundY - 40} lit={worldMilestone >= 4} />
        <Lantern x={720} y={groundY - 30} lit={worldMilestone >= 4} />

        {beaconCelebration > 0 && (
          <motion.circle
            key={beaconCelebration}
            className="beacon-flare"
            cx="500"
            cy={groundY - game.stack.length * BLOCK_HEIGHT + BLOCK_HEIGHT / 2}
            r="30"
            fill="#ffe4ae"
            filter="url(#soft-bloom)"
            initial={{ opacity: 0, scale: 0.35 }}
            animate={{ opacity: [0, 0.72, 0], scale: [0.35, 1.2, 2.6] }}
            transition={{ duration: 1.05, ease: 'easeOut' }}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            pointerEvents="none"
          />
        )}

        {game.stack.map((block, index) => {
          const support = game.stack[index - 1]
          const historicalPerfect = support
            ? Math.abs((block.x + block.width / 2) - (support.x + support.width / 2)) < 0.01
            : false
          const trimmedLeft = support ? Math.max(0, block.x - support.x) : 0
          const trimmedRight = support
            ? Math.max(0, support.x + support.width - (block.x + block.width))
            : 0

          return (
            <BlockShape
              key={index}
              block={block}
              y={groundY - (index + 1) * BLOCK_HEIGHT}
              landed={index === game.stack.length - 1 && game.stack.length > 1}
              perfect={index === game.stack.length - 1 && game.lastDropWasPerfect}
              grew={index === game.stack.length - 1 && game.lastDropGrew}
              signalActive={index >= signalStartIndex}
              historicalPerfect={historicalPerfect}
              trimmedLeft={trimmedLeft}
              trimmedRight={trimmedRight}
              stoneWarmth={Math.min(1, index / 32 + dawnProgress * 0.18)}
              stonePalette={edition.stone}
            />
          )
        })}
        <BeaconSignal
          stack={game.stack}
          groundY={groundY}
          perfectStreak={game.perfectStreak}
          placement={game.placementTicks.length}
          reducedMotion={reducedMotion}
        />
        {landingFeedback && game.stack.length > 1 && (
          <LandingFeedback
            kind={landingFeedback}
            block={game.stack.at(-1)!}
            support={game.stack.at(-2)!}
            y={groundY - game.stack.length * BLOCK_HEIGHT}
            placement={game.placementTicks.length}
            reducedMotion={reducedMotion}
          />
        )}
        {game.fallingPieces.map((piece) => (
          <motion.g
            key={`${piece.id}-${piece.x}`}
            initial={{ opacity: 1, y: 0, rotate: 0 }}
            animate={{
              opacity: [1, 1, 0],
              y: waterY - (groundY - piece.level * BLOCK_HEIGHT + cameraShift) + 8,
              rotate: piece.direction * (game.phase === 'over' ? 52 : 32),
            }}
            transition={{ duration: game.phase === 'over' ? 0.9 : 0.72, ease: 'easeIn' }}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          >
            <BlockShape
              block={piece}
              y={groundY - piece.level * BLOCK_HEIGHT}
              active
              stonePalette={edition.stone}
            />
          </motion.g>
        ))}
        {game.moving && (
          <g className="active-block-layer">
            <motion.g
              initial={false}
              animate={reducedMotion || windStrength === 0 || isWaking
                ? { y: 0, rotate: 0 }
                : {
                    y: [0, -blockSway, 0, blockSway * 0.52, 0],
                    rotate: [0, windDirection * 0.42, 0, windDirection * -0.26, 0],
                  }}
              transition={reducedMotion || windStrength === 0 || isWaking
                ? { duration: 0 }
                : { duration: blockSwayDuration, repeat: Infinity, ease: 'easeInOut' }}
              style={{ transformBox: 'fill-box', transformOrigin: 'center bottom' }}
            >
              <BlockShape
                block={game.moving}
                y={groundY - (game.stack.length + 1) * BLOCK_HEIGHT}
                active
                stonePalette={edition.stone}
              />
            </motion.g>
            {isWaking && (
              <StartWake
                block={game.moving}
                y={groundY - (game.stack.length + 1) * BLOCK_HEIGHT}
                reducedMotion={reducedMotion}
              />
            )}
          </g>
        )}
      </motion.g>
      </motion.g>

      <path d={`M0 ${height - 58}q112-32 224 0 130-31 264 1 133-35 268 0 111-30 244 4v${58}`} fill="url(#sea)" opacity=".88" />
      <motion.path
        d={`M0 ${height - 58}q112-32 224 0 130-31 264 1 133-35 268 0 111-30 244 4v${58}`}
        fill="url(#dawn-sea)"
        initial={false}
        animate={{ opacity: dawnProgress }}
        transition={dawnTransition}
        pointerEvents="none"
      />
      <motion.g
        initial={false}
        animate={{ opacity: 1 - dawnProgress }}
        transition={dawnTransition}
        fill="#ffe7c2"
        pointerEvents="none"
      >
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <rect
            key={row}
            x={edition.moon.x - (34 - row * 5)}
            y={waterY - 6 + row * 6}
            width={(34 - row * 5) * 2}
            height="1.8"
            rx=".9"
            opacity={0.42 - row * 0.06}
          />
        ))}
      </motion.g>
      <HarborBuoy active={worldMilestone >= 2} waterY={waterY} reducedMotion={reducedMotion} />
      <DawnWaterPath active={worldMilestone >= 6} waterY={waterY} reducedMotion={reducedMotion} />
      {game.fallingPieces.map((piece) => (
        <WaterImpact
          key={`water-impact-${piece.id}-${piece.x}`}
          piece={piece}
          waterY={waterY}
          forceful={game.phase === 'over'}
        />
      ))}
      {beaconCelebration > 0 && (
        <motion.g key={beaconCelebration} pointerEvents="none">
          <motion.ellipse
            cx="500"
            cy={height - 47}
            rx="560"
            ry="18"
            fill="none"
            stroke="#ffe5b4"
            strokeWidth="2.4"
            initial={{ opacity: 0, scale: 0.015 }}
            animate={{ opacity: [0, 0.78, 0], scale: [0.015, 1] }}
            transition={{ duration: 1.15, ease: 'easeOut' }}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          />
          <motion.ellipse
            cx="500"
            cy={height - 47}
            rx="470"
            ry="13"
            fill="none"
            stroke="#c7eee0"
            strokeWidth="1.5"
            initial={{ opacity: 0, scale: 0.015 }}
            animate={{ opacity: [0, 0.52, 0], scale: [0.015, 1] }}
            transition={{ duration: 1.35, delay: 0.14, ease: 'easeOut' }}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          />
        </motion.g>
      )}
      <motion.path
        className={reducedMotion ? undefined : 'water-glint'}
        style={waterGlintStyle}
        d={`M418 ${height - 45}h166m-140 13h116m-96 12h76`}
        fill="none"
        strokeWidth="1.6"
        strokeLinecap="round"
        initial={false}
        animate={{ stroke: waterReflectionColor }}
        transition={dawnTransition}
        opacity={reducedMotion ? waterReflectionOpacity : undefined}
        pointerEvents="none"
      />
    </svg>
  )
}

function App() {
  const [game, setGame] = useState(createGame)
  const [sceneHeight, setSceneHeight] = useState(760)
  const [isWaking, setIsWaking] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(readSoundPreference)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [authInitialized, setAuthInitialized] = useState(false)
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(true)
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null)
  const [nameSaving, setNameSaving] = useState(false)
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'submitting' | 'saved' | 'not-best' | 'failed' | 'offline'>('idle')
  const [submissionError, setSubmissionError] = useState('')
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)
  const [shareNote, setShareNote] = useState('')
  const { reducedMotion } = useScenePreferences()
  const stageRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef(game)
  const soundEnabledRef = useRef(soundEnabled)
  const audioContextRef = useRef<AudioContext | null>(null)
  const runIdRef = useRef(0)
  const autoSubmittedRunRef = useRef(-1)
  const resumeAfterLeaderboardRef = useRef(false)
  const startWakeTimerRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    gameRef.current = game
    soundEnabledRef.current = soundEnabled
  }, [game, soundEnabled])

  const commitGame = useCallback((next: GameState) => {
    if (gameRef.current.challenge.date !== next.challenge.date) setLeaderboardEntries([])
    gameRef.current = next
    setGame(next)
  }, [])

  const refreshLeaderboard = useCallback(async (challengeDate: string) => {
    setLeaderboardLoading(true)
    setLeaderboardError(null)
    try {
      const { getDailyLeaderboard, isConfigured } = await import('./leaderboard')
      if (!isConfigured()) throw new Error('Add the Supabase URL and publishable key to enable the daily board.')
      const entries = await getDailyLeaderboard(challengeDate)
      if (gameRef.current.challenge.date === challengeDate) setLeaderboardEntries(entries)
    } catch (cause) {
      if (gameRef.current.challenge.date === challengeDate) {
        setLeaderboardError(cause instanceof Error ? cause.message : 'Could not load today’s board.')
      }
    } finally {
      if (gameRef.current.challenge.date === challengeDate) setLeaderboardLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { connectAnonymousPlayer, isConfigured, retryPendingRuns } = await import('./leaderboard')
        if (!isConfigured()) {
          setLeaderboardError('Add your Supabase URL and publishable key to enable the daily board.')
          setLeaderboardLoading(false)
          return
        }
        const { id, name } = await connectAnonymousPlayer()
        // Send runs that failed to sync last visit before the board first loads.
        await retryPendingRuns()
        if (cancelled) return
        setPlayerId(id)
        setPlayerName(name)
        setLeaderboardError(null)
      } catch {
        if (cancelled) return
        setLeaderboardError('Could not connect. Check anonymous sign-in and the database migration.')
        setLeaderboardLoading(false)
      } finally {
        if (!cancelled) setAuthInitialized(true)
      }
    })()

    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!authInitialized || !playerId) return
    const challengeDate = game.challenge.date
    const timer = window.setTimeout(() => void refreshLeaderboard(challengeDate), 0)
    return () => window.clearTimeout(timer)
  }, [authInitialized, game.challenge.date, playerId, refreshLeaderboard])

  const playFeedback = useCallback((kind: FeedbackSound) => {
    if (!soundEnabledRef.current || typeof window === 'undefined') return

    const AudioContextConstructor = window.AudioContext
    if (!AudioContextConstructor) return

    try {
      const context = audioContextRef.current ?? new AudioContextConstructor()
      audioContextRef.current = context
      if (context.state === 'suspended') void context.resume().catch(() => undefined)

      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const now = context.currentTime
      const settings = {
        place: { start: 235, end: 285, duration: 0.075, volume: 0.035, type: 'sine' as OscillatorType },
        perfect: { start: 620, end: 930, duration: 0.2, volume: 0.06, type: 'sine' as OscillatorType },
        miss: { start: 150, end: 88, duration: 0.16, volume: 0.045, type: 'triangle' as OscillatorType },
      }[kind]

      oscillator.type = settings.type
      oscillator.frequency.setValueAtTime(settings.start, now)
      oscillator.frequency.exponentialRampToValueAtTime(settings.end, now + settings.duration)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(settings.volume, now + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + settings.duration)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(now)
      oscillator.stop(now + settings.duration + 0.015)
    } catch {
      // Audio is optional; gameplay remains available if the browser blocks it.
    }
  }, [])

  const beginRun = useCallback(() => {
    runIdRef.current += 1
    setSubmissionStatus('idle')
    setSubmissionError('')
    if (startWakeTimerRef.current !== null) window.clearTimeout(startWakeTimerRef.current)
    setIsWaking(!reducedMotion)
    commitGame(startGame(createGame(createDailyChallenge())))

    if (!reducedMotion) {
      startWakeTimerRef.current = window.setTimeout(() => {
        startWakeTimerRef.current = null
        setIsWaking(false)
      }, START_WAKE_DURATION)
    }
  }, [commitGame, reducedMotion])
  const start = useCallback(() => {
    if (gameRef.current.phase === 'ready' && !isWaking) beginRun()
  }, [beginRun, isWaking])
  const retry = useCallback(() => {
    beginRun()
  }, [beginRun])
  const toggleSound = useCallback(() => {
    const next = !soundEnabledRef.current
    soundEnabledRef.current = next
    setSoundEnabled(next)
  }, [])

  const submitRun = useCallback(async (finishedGame: GameState) => {
    const submissionRunId = runIdRef.current
    setSubmissionStatus('submitting')
    setSubmissionError('')
    try {
      const api = await import('./leaderboard')
      if (!api.isConfigured()) {
        if (runIdRef.current === submissionRunId) setSubmissionStatus('offline')
        return
      }
      // Saved before sign-in too, so a run that ends offline is still sent on the next visit.
      api.rememberPendingRun(finishedGame.challenge.date, finishedGame.placementTicks, heightOf(finishedGame))
      let userId = playerId
      if (!userId) {
        const player = await api.connectAnonymousPlayer()
        userId = player.id
        setPlayerId(userId)
        setPlayerName(player.name)
      }

      const result = await api.submitDailyScore(finishedGame.challenge.date, finishedGame.placementTicks)
      if (runIdRef.current === submissionRunId) {
        setSubmissionStatus(result.personalBest ? 'saved' : 'not-best')
      }
      await refreshLeaderboard(finishedGame.challenge.date)
    } catch (cause) {
      if (runIdRef.current === submissionRunId) {
        setSubmissionStatus('failed')
        setSubmissionError(cause instanceof Error ? cause.message : 'Could not sync this run.')
      }
    }
  }, [playerId, refreshLeaderboard])

  useEffect(() => {
    if (game.phase !== 'over' || !authInitialized || heightOf(game) < 1 || game.placementTicks.length === 0) return
    const runId = runIdRef.current
    if (autoSubmittedRunRef.current === runId) return
    autoSubmittedRunRef.current = runId
    void submitRun(game)
  }, [authInitialized, game, submitRun])

  const shareRun = useCallback(async () => {
    const finished = gameRef.current
    const text = `Afterlight · ${dailyEditionForSeed(finished.challenge.seed).name} · ${formatDailyDate(finished.challenge.date)}: ${heightOf(finished)} stones, ${finished.perfects} perfect.`
    const url = window.location.origin
    try {
      if (navigator.share) {
        await navigator.share({ text, url })
        return
      }
      await navigator.clipboard.writeText(`${text} ${url}`)
      setShareNote('Copied')
      window.setTimeout(() => setShareNote(''), 2000)
    } catch {
      // Closing the share sheet rejects; nothing to report.
    }
  }, [])

  const openLeaderboard = useCallback(() => {
    resumeAfterLeaderboardRef.current = gameRef.current.phase === 'playing'
    if (resumeAfterLeaderboardRef.current) commitGame(pauseGame(gameRef.current))
    setLeaderboardOpen(true)
  }, [commitGame])

  const closeLeaderboard = useCallback(() => {
    setLeaderboardOpen(false)
    if (resumeAfterLeaderboardRef.current && gameRef.current.phase === 'paused') {
      commitGame(resumeGame(gameRef.current))
    }
    resumeAfterLeaderboardRef.current = false
  }, [commitGame])

  const updatePlayerName = useCallback(async (name: string) => {
    if (!playerId) throw new Error('Player profile is still connecting.')
    setNameSaving(true)
    try {
      const { savePlayerName } = await import('./leaderboard')
      const savedName = await savePlayerName(playerId, name)
      setPlayerName(savedName)
      await refreshLeaderboard(gameRef.current.challenge.date)
    } finally {
      setNameSaving(false)
    }
  }, [playerId, refreshLeaderboard])

  useEffect(() => {
    if (game.phase !== 'ready') return

    const now = new Date()
    const nextUtcMidnight = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
    )
    const timer = window.setTimeout(() => {
      commitGame(createGame(createDailyChallenge()))
    }, nextUtcMidnight - now.getTime() + 50)

    return () => window.clearTimeout(timer)
  }, [commitGame, game.challenge.date, game.phase])

  useEffect(() => {
    try {
      window.localStorage.setItem('afterlight.sound', soundEnabled ? 'on' : 'off')
    } catch {
      // The preference still applies for this session when storage is unavailable.
    }
  }, [soundEnabled])

  useEffect(() => () => {
    if (startWakeTimerRef.current !== null) window.clearTimeout(startWakeTimerRef.current)
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const resizeObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) {
        setSceneHeight(Math.round((WORLD_WIDTH * height) / width))
      }
    })
    resizeObserver.observe(stage)
    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    if (game.phase !== 'playing' || isWaking) return

    let animationFrame = 0
    let previousTime: number | null = null
    let accumulator = 0
    const stepMilliseconds = 1000 / SIMULATION_HZ
    const tick = (time: number) => {
      if (previousTime === null) previousTime = time
      else {
        accumulator += Math.min(time - previousTime, 250)
        previousTime = time

        let steps = 0
        while (accumulator >= stepMilliseconds && steps < 15) {
          setGame((current) => advanceGame(current))
          accumulator -= stepMilliseconds
          steps += 1
        }
      }
      animationFrame = requestAnimationFrame(tick)
    }
    animationFrame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animationFrame)
  }, [game.phase, isWaking])

  const handlePlace = useCallback(() => {
    if (isWaking) return
    const current = gameRef.current
    const next = placeBlock(current)
    if (next === current) return

    commitGame(next)
    if (next.phase === 'over') playFeedback('miss')
    else if (next.stack.length > current.stack.length) {
      playFeedback(next.lastDropWasPerfect ? 'perfect' : 'place')
    }
  }, [commitGame, isWaking, playFeedback])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        if (leaderboardOpen) {
          closeLeaderboard()
          return
        }
        const current = gameRef.current
        if (current.phase === 'playing') commitGame(pauseGame(current))
        if (current.phase === 'paused') commitGame(resumeGame(current))
        return
      }

      const target = event.target
      if (target instanceof HTMLElement && target.closest('button')) return

      if (event.code === 'Space') {
        event.preventDefault()
        if (gameRef.current.phase === 'ready') start()
        else handlePlace()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeLeaderboard, commitGame, handlePlace, leaderboardOpen, start])

  const height = heightOf(game)
  const dailyEdition = dailyEditionForSeed(game.challenge.seed)
  const isFocusedRun = height > 0 && game.phase !== 'over'
  const inRun = game.phase === 'playing' || game.phase === 'paused'
  const yourEntry = leaderboardEntries.find((entry) => entry.is_you)
  const passMark = nextMark(leaderboardEntries, height)
  const runVerified = submissionStatus === 'saved' || submissionStatus === 'not-best'

  return (
    <MotionConfig reducedMotion="user">
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Afterlight home">
          <img className="brand-mark" src={afterlightMark} alt="" aria-hidden="true" />
          <span>AFTERLIGHT</span>
        </a>
        <div className="topbar-actions">
          <motion.button
            className="icon-button leaderboard-toggle"
            type="button"
            onClick={openLeaderboard}
            aria-label="Open daily leaderboard"
            aria-expanded={leaderboardOpen}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h9" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></svg>
          </motion.button>
          <motion.button
            className="icon-button"
            type="button"
            onClick={toggleSound}
            aria-label={soundEnabled ? 'Mute sound' : 'Turn sound on'}
            aria-pressed={soundEnabled}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {soundEnabled
                ? <path d="M4 10v4h4l5 4V6l-5 4H4zm12-2a6 6 0 0 1 0 8m2-11a10 10 0 0 1 0 14" />
                : <path d="M4 10v4h4l5 4V6l-5 4H4zm12 1 5 5m0-5-5 5" />}
            </svg>
          </motion.button>
          {game.phase === 'playing' && !isWaking && (
            <motion.button
              className="icon-button"
              type="button"
              onClick={() => commitGame(pauseGame(gameRef.current))}
              aria-label="Pause game"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 420, damping: 22 }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14m8-14v14" /></svg>
            </motion.button>
          )}
        </div>
      </header>

      <section className="play-layout" aria-label="Afterlight game">
        <div
          className={`stage ${game.phase === 'playing' ? 'is-playing' : ''} ${game.phase === 'over' ? 'is-over' : ''} ${isFocusedRun ? 'is-focused' : ''} ${isWaking ? 'is-waking' : ''}`}
          ref={stageRef}
          onPointerDown={handlePlace}
        >
          <GameScene game={game} height={sceneHeight} isWaking={isWaking} />

          {inRun && (
            <div className="run-hud">
              <div className="height-readout" aria-live="polite">
                <span>Height</span>
                <strong>{String(height).padStart(2, '0')}</strong>
              </div>
              <StreakPill streak={game.perfectStreak} />
            </div>
          )}

          {game.phase !== 'ready' && (
            <div
              className="daily-readout chip"
              aria-label={`Daily challenge ${game.challenge.date}. ${game.windPercent === 0 ? 'Wind calm' : `Wind ${game.windPercent > 0 ? 'plus ' : 'minus '}${Math.abs(game.windPercent)} percent`}.`}
            >
              <WindSignature windPercent={game.windPercent} />
              <span className="daily-date">{formatDailyDate(game.challenge.date)}</span>
            </div>
          )}

          {inRun && leaderboardEntries.length > 0 && <HeightLadder entries={leaderboardEntries} height={height} />}

          {game.phase === 'playing' && !isWaking && (
            <div className="play-prompt chip" aria-hidden="true">
              <span>Tap anywhere to drop</span>
              <kbd>SPACE</kbd>
            </div>
          )}

          <AnimatePresence mode="wait">
            {game.phase === 'ready' && (
              <motion.div
                key="ready"
                className="ready-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
              >
                <ReadyOverlay
                  editionName={dailyEdition.name}
                  dateLabel={formatDailyDate(game.challenge.date)}
                  windPercent={game.windPercent}
                  entries={leaderboardEntries}
                  onStart={start}
                />
              </motion.div>
            )}

            {game.phase === 'paused' && (
              <motion.div
                key="paused"
                className="state-card glass"
                role="dialog"
                aria-modal="true"
                aria-labelledby="pause-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
              >
                <h1 id="pause-title">Paused</h1>
                <motion.button
                  className="primary-button"
                  type="button"
                  onClick={() => setGame((current) => resumeGame(current))}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 460, damping: 24 }}
                >
                  Resume
                </motion.button>
                <motion.button
                  className="text-button"
                  type="button"
                  onClick={() => setGame((current) => endGame(current))}
                  whileTap={{ scale: 0.97 }}
                >
                  End run
                </motion.button>
              </motion.div>
            )}

            {game.phase === 'over' && (
              <motion.div
                key="over"
                className="state-card over-card glass"
                role="dialog"
                aria-labelledby="over-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{ duration: reducedMotion ? 0.2 : 0.36, delay: reducedMotion ? 0 : 1.18, ease: 'easeOut' }}
              >
                {/* A miss records a placement that never joined the stack; ending from pause does not. */}
                <h1 id="over-title" className="eyebrow over-eyebrow">{game.placementTicks.length > height ? 'The tide keeps it' : 'The beacon rests'}</h1>
                <p className="over-score"><strong>{height}</strong><span>{height === 1 ? 'stone' : 'stones'}</span></p>
                {runVerified && (
                  <div className="over-pills">
                    {submissionStatus === 'saved' && <span className="pill is-accent">New best today</span>}
                    {yourEntry && <span className="pill">Rank #{yourEntry.rank}</span>}
                  </div>
                )}
                <div className="tiles is-compact">
                  <div className="tile"><strong>{game.perfects}</strong><span>Perfect</span></div>
                  <div className="tile"><strong>{bestStreakOf(game)}</strong><span>Best streak</span></div>
                  <div className="tile"><strong>{Math.min(9, Math.floor(game.perfects / 5))}</strong><span>Lanterns lit</span></div>
                </div>
                {passMark && (
                  <div className="mark">
                    <div className="mark-line">
                      <span>{passMark.gap} {passMark.gap === 1 ? 'stone' : 'stones'} to pass <b className="is-gold">{passMark.name}</b></span>
                      <b className="is-muted">{passMark.height}</b>
                    </div>
                    <Progress value={height} max={passMark.height + 1} />
                  </div>
                )}
                <div className="over-actions">
                  <motion.button
                    className="primary-button"
                    type="button"
                    onClick={retry}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 460, damping: 24 }}
                  >
                    Climb again
                  </motion.button>
                  <button className="ghost-button" type="button" onClick={() => void shareRun()}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
                    <span aria-live="polite">{shareNote || 'Share'}</span>
                  </button>
                </div>
                {submissionStatus !== 'idle' && (
                  <p className={`result-submission is-${submissionStatus}`} role="status">
                    {submissionStatus === 'submitting' && 'Verifying today’s run…'}
                    {submissionStatus === 'saved' && 'Personal best saved to today’s board.'}
                    {submissionStatus === 'not-best' && 'Run verified · your best stays on the board.'}
                    {submissionStatus === 'offline' && 'Offline · score not submitted.'}
                    {submissionStatus === 'failed' && (submissionError || 'Could not sync this run.')}
                  </p>
                )}
                {submissionStatus === 'failed' && (
                  <button className="text-button retry-submit" type="button" onClick={() => void submitRun(gameRef.current)}>
                    Retry score sync
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {inRun && !leaderboardOpen ? <RunPanel game={game} entries={leaderboardEntries} /> : <Leaderboard
          challengeDate={game.challenge.date}
          entries={leaderboardEntries}
          loading={leaderboardLoading}
          error={leaderboardError}
          playerName={playerName}
          nameSaving={nameSaving}
          onSaveName={updatePlayerName}
          mobileOpen={leaderboardOpen}
          onClose={closeLeaderboard}
        />}
      </section>
    </main>
    </MotionConfig>
  )
}

export default App
