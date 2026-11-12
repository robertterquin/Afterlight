import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import afterlightMark from './assets/afterlight-mark.svg'
import { Leaderboard } from './DailyLeaderboard'
import { HeightLadder, ReadyOverlay, StreakPill } from './Hud'
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

const BLOCK_BEVEL = 10
const BLOCK_FACE_HEIGHT = BLOCK_HEIGHT - BLOCK_BEVEL
const NEAR_PERFECT_TRIM = 16
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
    // Kept left of centre so it never sits behind the course title or countdown.
    moon: { x: 300, y: 0.36, radius: 34, light: '#f7d5ad', body: '#f1d3ad', shade: '#bc927e' },
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

// Memoised: the game loop re-renders the scene 60 times a second, but a placed stone never changes.
const BlockShape = memo(function BlockShape({
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
  haze = 0,
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
  haze?: number
  stonePalette: StonePalette
}) {
  const bevel = BLOCK_BEVEL
  const faceHeight = BLOCK_FACE_HEIGHT
  const cleanStone = historicalPerfect || perfect
  const weatheredTop = blendColor(stonePalette.top, '#e7d6b4', stoneWarmth)
  const weatheredFront = blendColor(stonePalette.front, '#b59c78', stoneWarmth)
  const weatheredSide = blendColor(stonePalette.side, '#77635a', stoneWarmth)
  const weatheredJoint = blendColor(stonePalette.joint, '#876f5d', stoneWarmth)
  // Stones far below the top fade toward the sky, so the climb reads as distance.
  const hazed = (color: string) => haze > 0 ? blendColor(color, '#8f95ad', haze) : color
  const top = hazed(active ? stonePalette.activeTop : cleanStone ? blendColor(weatheredTop, '#f6e8c8', .18) : weatheredTop)
  const front = hazed(active ? stonePalette.activeFront : cleanStone ? blendColor(weatheredFront, '#c9ad85', .2) : weatheredFront)
  const side = hazed(active ? stonePalette.activeSide : cleanStone ? blendColor(weatheredSide, '#9b7b65', .18) : weatheredSide)
  const jointColor = hazed(active ? stonePalette.activeJoint : cleanStone ? blendColor(weatheredJoint, '#a88669', .25) : weatheredJoint)
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
})

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

  const seamY = y + BLOCK_HEIGHT - 2
  const lens = lensGeometry(block, y)

  return (
    <motion.g key={`landing-feedback-${placement}`} pointerEvents="none">

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

/**
 * A standing waystone with the same glowing slit as the tower's stones; (x, y) is its foot.
 * It stays plain stone until lit, as if the island is answering the beacon.
 */
function Waystone({
  x,
  y,
  lit,
  stone,
  size = 1,
  celebration = 0,
  sequence = 0,
}: {
  x: number
  y: number
  lit: boolean
  stone: StonePalette
  /** 1 is about a third of a tower stone; nearer islands use larger sizes. */
  size?: number
  celebration?: number
  sequence?: number
}) {
  return (
    <g className={lit ? 'lantern is-lit' : 'lantern'} transform={`translate(${x} ${y}) scale(${size})`}>
      {/* A tapered standing stone in the tower's own colours. */}
      <path d="M-5 0L-3.6 -18Q0 -23 3.6 -18L5 0Z" fill={stone.front} />
      <path d="M0 -21.6Q2.4 -20.6 3.6 -18L5 0H0Z" fill={stone.side} />
      <path d="M-3.6 -18Q0 -23 3.6 -18" stroke={stone.top} strokeWidth="1.4" fill="none" />
      {lit && <rect x="-5" y="-17" width="10" height="14" rx="5" fill="#ffe0a2" opacity=".6" filter="url(#soft-bloom)" />}
      <rect x="-1.3" y="-14" width="2.6" height="7" rx="1.3" fill={lit ? '#fff0c4' : '#3f555c'} />
      {celebration > 0 && (
        <motion.circle
          key={celebration}
          cx="0"
          cy="-11"
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

/** A tiered pine with a trunk and a shaded right side; (x, base) is the foot of the trunk. Proportions scale with height. */
function Pine({ x, base, height, color }: { x: number; base: number; height: number; color: string }) {
  const width = height * 0.5
  const shade = blendColor(color, '#0b1622', 0.3)
  const trunk = { width: Math.max(3.2, height * 0.06), height: height * 0.16 }
  const tiers = (height > 70
    ? [[0.12, 0.62, 0.5], [0.4, 0.84, 0.38], [0.64, 1, 0.26]]
    : [[0.12, 0.72, 0.5], [0.42, 1, 0.36]]
  ).map(([foot, apex, half]) => ({ foot: base - height * foot, apex: base - height * apex, half: width * half }))
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

/**
 * The rock face between an island's grass and the sea: it tapers slightly to the waterline, has a
 * lit upper band and a few cracks, and darkens where the water wets it. The grass is drawn over its top.
 */
function IslandCliff({
  left,
  right,
  top,
  waterline,
  inset,
  cracks,
  deep,
  light,
}: {
  left: number
  right: number
  top: number
  waterline: number
  inset: number
  cracks: readonly number[]
  deep: string
  light: string
}) {
  const height = waterline - top
  // Nudged toward a stone grey so the rock never blends into the sea behind it.
  const rock = blendColor(deep, '#8a8783', 0.32)
  const lit = blendColor(rock, light, 0.5)
  return (
    <g>
      <path d={`M${left} ${top}H${right}L${right - inset * 0.4} ${top + height * 0.55}L${right - inset} ${waterline}H${left + inset}L${left + inset * 0.4} ${top + height * 0.55}Z`} fill={rock} />
      <path d={`M${left} ${top}H${right}L${right - inset * 0.3} ${top + height * 0.5}H${left + inset * 0.3}Z`} fill={lit} />
      <path
        d={cracks.map((x, index) => `M${x} ${round1(top + height * 0.2)}l${index % 2 ? 3 : -3} ${round1(height * 0.35)}l${index % 2 ? -2 : 2} ${round1(height * 0.35)}`).join('')}
        stroke={blendColor(rock, '#0b1622', 0.5)}
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity=".7"
      />
      <path d={`M${left + inset} ${waterline - 3}H${right - inset}V${waterline}H${left + inset}Z`} fill="#0b1622" opacity=".25" />
    </g>
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

type ImpactSurface = 'water' | 'cloud' | 'none'

/** Where a trimmed stone meets the world: a splash at the island's waterline, a puff in the cloud sea, or nothing when it falls out of frame. */
function WaterImpact({
  piece,
  surfaceY,
  surface,
  forceful = false,
}: {
  piece: FallingPiece
  surfaceY: number
  surface: ImpactSurface
  forceful?: boolean
}) {
  // Slivers sink quietly; a splash for every tiny trim reads as noise.
  if (surface === 'none' || (surface === 'water' && piece.width < 20 && !forceful)) return null
  const center = piece.x + piece.width / 2
  const impactDelay = forceful ? 0.78 : 0.64
  const size = Math.min(forceful ? 1.6 : 1, Math.max(0.55, piece.width / 110))

  if (surface === 'cloud') {
    return (
      <motion.g pointerEvents="none" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.2, delay: impactDelay - 0.08, ease: 'easeOut' }}>
        <ellipse cx={center} cy={surfaceY + 12 * size} rx={60 * size} ry={10 * size} fill="#9d88a3" opacity=".35" />
        {[[-0.5, 0], [0, -0.2], [0.5, 0.05]].map(([dx, dy], index) => (
          <motion.ellipse
            key={index}
            cx={center + dx * 34 * size}
            cy={surfaceY + dy * 20}
            rx={30 * size}
            ry={13 * size}
            fill="#ffffff"
            initial={{ scale: 0.3 }}
            animate={{ scale: [0.3, 1.25, 1.6] }}
            transition={{ duration: 1.1, delay: impactDelay - 0.08 + index * 0.05, ease: 'easeOut' }}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          />
        ))}
      </motion.g>
    )
  }

  const crown = [[-16, -26], [-6, -36], [6, -34], [16, -24]]
  return (
    <motion.g pointerEvents="none">
      {crown.map(([dx, dy], index) => (
        <motion.path
          key={index}
          d={`M${center + dx * 0.5 * size} ${surfaceY}Q${center + dx * size} ${surfaceY + dy * 0.6 * size} ${center + dx * 1.2 * size} ${surfaceY + dy * size}`}
          fill="none"
          stroke="#eef6f1"
          strokeWidth={forceful ? 2.6 : 2}
          strokeLinecap="round"
          initial={{ opacity: 0, pathLength: 0 }}
          animate={{ opacity: [0, 0.9, 0], pathLength: [0, 1, 1] }}
          transition={{ duration: 0.5, delay: impactDelay + index * 0.02, ease: 'easeOut' }}
        />
      ))}
    </motion.g>
  )
}

/** Five perfect drops: light climbs through the streak's stones, then a halo opens around the top stone. */
function BeaconPulse({ block, topY, fromY }: { block: Block; topY: number; fromY: number }) {
  const centerX = block.x + block.width / 2
  return (
    <g pointerEvents="none">
      <motion.rect
        x={centerX - 8}
        y={topY}
        width="16"
        height="54"
        rx="8"
        fill="#fff2c9"
        filter="url(#soft-bloom)"
        initial={{ opacity: 0, y: fromY - topY }}
        animate={{ opacity: [0, 1, 1, 0], y: [fromY - topY, 0] }}
        transition={{ duration: 0.6, ease: 'easeIn' }}
      />
      <motion.rect
        x={centerX - 2}
        y={topY + 8}
        width="4"
        height="38"
        rx="2"
        fill="#fffaf0"
        initial={{ opacity: 0, y: fromY - topY }}
        animate={{ opacity: [0, 1, 1, 0], y: [fromY - topY, 0] }}
        transition={{ duration: 0.6, ease: 'easeIn' }}
      />
      {[0, 0.12].map((lag, ring) => (
        <motion.ellipse
          key={ring}
          cx={centerX}
          cy={topY + 6}
          rx={block.width * (ring ? 1.05 : 0.72)}
          ry={ring ? 22 : 15}
          fill="none"
          stroke={ring ? '#c7eee0' : '#ffe5b4'}
          strokeWidth={ring ? 1.5 : 2.4}
          initial={{ opacity: 0, scale: 0.2 }}
          animate={{ opacity: [0, ring ? 0.55 : 0.9, 0], scale: [0.2, 1, 1.3] }}
          transition={{ duration: 0.9, delay: 0.5 + lag, ease: 'easeOut' }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        />
      ))}
      <motion.circle
        cx={centerX}
        cy={topY + BLOCK_HEIGHT / 2}
        r="30"
        fill="#ffe4ae"
        filter="url(#soft-bloom)"
        initial={{ opacity: 0, scale: 0.35 }}
        animate={{ opacity: [0, 0.72, 0], scale: [0.35, 1.2, 2.4] }}
        transition={{ duration: 1, delay: 0.45, ease: 'easeOut' }}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      />
    </g>
  )
}

// Deterministic so the sea looks the same on every render and every device.
function seededRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

const round1 = (value: number) => Math.round(value * 10) / 10

function islandTopPath(groundY: number) {
  return `M240 ${groundY - 14}q46-45 108-32 55-49 118-24 61-46 122-10 71-25 124 21 60 5 88 45-44 19-104 10-66 23-122 4-67 22-127 3-74 22-123-1-42 10-84-16z`
}

/**
 * Sky, horizon and open sea. Memoised and free of per-frame props, so the
 * 60 Hz game loop never re-renders it; it only changes when dawn advances.
 * Waves and light paths are merged into a handful of paths to stay cheap.
 */
const SeaBackdrop = memo(function SeaBackdrop({
  edition,
  height,
  horizon,
  dawnProgress,
  reducedMotion,
}: {
  edition: DailyEdition
  height: number
  horizon: number
  dawnProgress: number
  reducedMotion: boolean
}) {
  const moonX = edition.moon.x
  const moonY = Math.min(height * edition.moon.y, horizon - edition.moon.radius * 2.4)
  const sunX = moonX < 500 ? 730 : 270
  const dawnTransition = reducedMotion ? { duration: 0 } : { duration: 1.8, ease: 'easeInOut' as const }

  const art = useMemo(() => {
    const random = seededRandom(11)
    const sea = height - horizon
    const stars = ['', '']
    const starCount = Math.min(160, Math.round(70 * horizon / 400))
    for (let index = 0; index < starCount; index += 1) {
      const x = round1(random() * WORLD_WIDTH)
      const y = round1(Math.pow(random(), 1.6) * (horizon - 50))
      const radius = random() > 0.82 ? 1.6 : 1
      stars[y < horizon * 0.45 && random() > 0.35 ? 0 : 1] += `M${x - radius} ${y}a${radius} ${radius} 0 1 0 ${radius * 2} 0a${radius} ${radius} 0 1 0 ${-radius * 2} 0`
    }

    // Wave strokes get longer and further apart toward the viewer.
    const waves = ['', '', '']
    const rows = Math.round(sea / 8)
    for (let row = 0; row < rows; row += 1) {
      const t = Math.pow(row / rows, 1.7)
      const y = round1(horizon + 6 + t * (sea - 8))
      for (let stroke = 0; stroke < 3 + Math.floor(t * 4); stroke += 1) {
        const length = round1(10 + t * 70 * (0.5 + random() * 0.8))
        const x = round1(random() * 1020 - 20)
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

    return { stars, waves, moonPath: lightPath(moonX), sunPath: lightPath(sunX) }
  }, [height, horizon, moonX, sunX])

  return (
    <g pointerEvents="none">
      <defs>
        <linearGradient id="sea-sky" x2="0" y2="1">
          <stop stopColor={edition.sky[0]} />
          <stop offset=".55" stopColor={edition.sky[1]} />
          <stop offset="1" stopColor={edition.sky[2]} />
        </linearGradient>
        <linearGradient id="sea-dawn-sky" x2="0" y2="1">
          <stop stopColor={edition.dawnSky[0]} stopOpacity=".25" />
          <stop offset=".5" stopColor={edition.dawnSky[1]} stopOpacity=".6" />
          <stop offset=".8" stopColor={edition.dawnSky[2]} stopOpacity=".9" />
          <stop offset="1" stopColor={edition.dawnSky[3]} />
        </linearGradient>
        <linearGradient id="sea-water" x2="0" y2="1">
          <stop stopColor={edition.sky[2]} />
          <stop offset=".1" stopColor={edition.sea[0]} />
          <stop offset="1" stopColor={edition.sea[1]} />
        </linearGradient>
        <linearGradient id="sea-dawn-water" x2="0" y2="1">
          <stop stopColor={edition.dawnSky[3]} stopOpacity=".9" />
          <stop offset=".18" stopColor={edition.dawnSea[0]} stopOpacity=".7" />
          <stop offset="1" stopColor={edition.dawnSea[1]} stopOpacity=".35" />
        </linearGradient>
        <radialGradient id="sea-horizon-glow">
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
        <radialGradient id="sea-sun">
          <stop stopColor="#fff4d8" />
          <stop offset=".55" stopColor="#ffd9a0" stopOpacity=".7" />
          <stop offset="1" stopColor="#ffb47a" stopOpacity="0" />
        </radialGradient>
        <filter id="sea-mist" x="-20%" y="-200%" width="140%" height="500%">
          <feGaussianBlur stdDeviation="5 3" />
        </filter>
      </defs>

      <rect width={WORLD_WIDTH} height={horizon + 1} fill="url(#sea-sky)" />
      <motion.rect width={WORLD_WIDTH} height={horizon + 1} fill="url(#sea-dawn-sky)" initial={false} animate={{ opacity: dawnProgress }} transition={dawnTransition} />

      <motion.g initial={false} animate={{ opacity: 1 - dawnProgress }} transition={dawnTransition} fill="#f8eed9">
        <path className={reducedMotion ? undefined : 'star-field'} d={art.stars[0]} opacity=".85" />
        <path d={art.stars[1]} opacity=".45" />
        {[[640, 0.12], [880, 0.3], [120, 0.22]].map(([x, y]) => (
          <path
            key={x}
            className={reducedMotion ? undefined : 'star-sparkle'}
            d={`M${x} ${round1(horizon * y - 8)}l1.2 6.8 6.8 1.2-6.8 1.2-1.2 6.8-1.2-6.8-6.8-1.2 6.8-1.2z`}
            fill="#fff6e0"
          />
        ))}
      </motion.g>

      <motion.ellipse cx={moonX} cy={horizon} rx="640" ry={round1(Math.max(110, (height - horizon) * 0.3))} fill="url(#sea-horizon-glow)" initial={false} animate={{ opacity: 1 - dawnProgress }} transition={dawnTransition} />
      <motion.ellipse cx={sunX} cy={horizon} rx="640" ry={round1(Math.max(110, (height - horizon) * 0.3))} fill="url(#sea-horizon-glow)" initial={false} animate={{ opacity: dawnProgress }} transition={dawnTransition} />

      <motion.g initial={false} animate={{ opacity: 1 - dawnProgress }} transition={dawnTransition}>
        <circle cx={moonX} cy={moonY} r={edition.moon.radius * 5} fill="url(#moonlight)" />
        <circle cx={moonX} cy={moonY} r={edition.moon.radius} fill="url(#moon-body)" />
        <g fill={edition.moon.shade} opacity=".32">
          <circle cx={moonX + edition.moon.radius * 0.25} cy={moonY - edition.moon.radius * 0.2} r={edition.moon.radius * 0.18} />
          <circle cx={moonX - edition.moon.radius * 0.3} cy={moonY + edition.moon.radius * 0.25} r={edition.moon.radius * 0.12} />
          <circle cx={moonX + edition.moon.radius * 0.35} cy={moonY + edition.moon.radius * 0.4} r={edition.moon.radius * 0.09} />
        </g>
        <circle cx={moonX} cy={moonY} r={edition.moon.radius} fill="none" stroke="#fff6e6" strokeOpacity=".45" />
      </motion.g>
      <motion.g initial={false} animate={{ opacity: dawnProgress }} transition={dawnTransition}>
        <circle cx={sunX} cy={horizon} r="150" fill="url(#sea-sun)" opacity=".6" />
        <circle cx={sunX} cy={horizon + 6} r="34" fill="#fff1d2" />
      </motion.g>

      <g filter="url(#sea-mist)">
        <ellipse cx="520" cy={round1(horizon * 0.5)} rx="300" ry="9" fill="#c9a3ae" opacity=".3" />
        <ellipse cx="170" cy={round1(horizon * 0.66)} rx="220" ry="7" fill="#c9a3ae" opacity=".24" />
        <ellipse cx="780" cy={round1(horizon * 0.8)} rx="260" ry="10" fill="#f2b79e" opacity=".32" />
        <ellipse cx="380" cy={round1(horizon * 0.9)} rx="340" ry="8" fill="#f2b79e" opacity=".26" />
      </g>

      {/* Distant islands, a village and a boat sit on the horizon. */}
      <path
        d={`M-10 ${horizon}q30-14 60-10 24-18 52-8 30-8 50 18zM140 ${horizon}q18-6 40-4 10-6 30 4zM420 ${horizon}q24-22 56-18 30-14 54 0 24-8 46 18zM700 ${horizon}q16-8 34-6 14-6 26 6z`}
        fill={edition.mountains[0]}
      />
      <g fill="#ffd98f">
        {[[40, 9], [66, 7], [464, 14], [488, 11], [506, 8]].map(([x, lift]) => (
          <circle key={x} cx={x} cy={horizon - lift} r="1.4" opacity={1 - dawnProgress * 0.6} />
        ))}
      </g>
      <g>
        <path d={`M610 ${horizon - 1}h26l-4 4h-18z`} fill="#2c2f45" />
        <path d={`M622 ${horizon - 2}v-26l12 22z`} fill="#3a3a54" />
        <circle cx="622" cy={horizon - 29} r="1.6" fill="#ffe0a2" />
      </g>

      <rect y={horizon} width={WORLD_WIDTH} height={height - horizon} fill="url(#sea-water)" />
      <motion.rect y={horizon} width={WORLD_WIDTH} height={height - horizon} fill="url(#sea-dawn-water)" initial={false} animate={{ opacity: dawnProgress }} transition={dawnTransition} />
      <rect y={horizon} width={WORLD_WIDTH} height="1.5" fill="#ffe8cf" opacity=".5" />

      <g fill="none" stroke="#f1dccb" strokeLinecap="round">
        <path d={art.waves[0]} strokeOpacity=".26" strokeWidth=".9" />
        <path d={art.waves[1]} strokeOpacity=".17" strokeWidth="1.4" />
        <path d={art.waves[2]} strokeOpacity=".1" strokeWidth="2" />
      </g>

      <motion.g initial={false} animate={{ opacity: 1 - dawnProgress }} transition={dawnTransition} fill="#ffe2b4">
        <g className={reducedMotion ? undefined : 'light-path'}>
          <path d={art.moonPath[0]} opacity=".7" />
          <path d={art.moonPath[1]} opacity=".48" />
          <path d={art.moonPath[2]} opacity=".28" />
        </g>
      </motion.g>
      <motion.g initial={false} animate={{ opacity: dawnProgress }} transition={dawnTransition} fill="#fff1cc">
        <g className={reducedMotion ? undefined : 'light-path'}>
          <path d={art.sunPath[0]} opacity=".75" />
          <path d={art.sunPath[1]} opacity=".52" />
          <path d={art.sunPath[2]} opacity=".3" />
        </g>
      </motion.g>
    </g>
  )
})

/** The cottage islet and the lighthouse rock, drawn as in the open-sea design. Re-renders only when a placement changes them. */
const SideIslets = memo(function SideIslets({
  edition,
  height,
  horizon,
  lit,
  celebration,
  dawnProgress,
  reducedMotion,
  compact,
  climb,
}: {
  edition: DailyEdition
  height: number
  horizon: number
  lit: number
  celebration: number
  dawnProgress: number
  reducedMotion: boolean
  compact: boolean
  climb: number
}) {
  const sea = height - horizon
  // Nearer things sink faster below the horizon as the climber rises.
  const drift = (factor: number) => ({
    initial: false as const,
    animate: { y: reducedMotion ? 0 : climb * factor },
    transition: reducedMotion
      ? { duration: 0 }
      : compact
        ? { duration: 0.6, ease: 'easeOut' as const }
        : { type: 'spring' as const, stiffness: 22, damping: 18 },
  })
  const lx = 885
  const ly = round1(horizon + Math.min(34, sea * 0.06))
  const windows = 1 - dawnProgress * 0.65
  const cottage = (
    <>
      <defs>
        <linearGradient id="cottage-grass" x2="0" y2="1">
          <stop stopColor={blendColor(edition.islands.leftTop, '#eef3e2', 0.35)} />
          <stop offset="1" stopColor={blendColor(edition.islands.leftTop, '#4f6d66', 0.25)} />
        </linearGradient>
      </defs>
      <IslandCliff left={54} right={238} top={18} waterline={36} inset={7} cracks={[84, 152, 206]} deep={edition.islands.deep} light={edition.islands.leftTop} />
      <path d="M48 26q24-24 62-20 40-26 76 0 38-4 56 22-30 10-64 6-38 12-72 0-32 8-58-8z" fill="#0b1622" opacity=".28" />
      <path d="M48 22q24-24 62-20 40-26 76 0 38-4 56 22-30 10-64 6-38 12-72 0-32 8-58-8z" fill="url(#cottage-grass)" />
      <path d="M118 8h30v19h-30z" fill="#e6caa4" />
      <path d="M118 8h30v3h-30z" fill="#000" opacity=".12" />
      <path d="M114 9l19-17 19 17z" fill="#9b6f60" />
      <path d="M133 -8l19 17h-6z" fill="#000" opacity=".15" />
      <rect x="129" y="18" width="7" height="9" rx="1" fill="#6f4c40" />
      <Pine x={210} base={12} height={46} color={edition.tower.trees} />
    </>
  )

  return (
    <>
      <defs>
        <linearGradient id="lighthouse-beam" x1="1" x2="0">
          <stop stopColor="#ffe9b8" stopOpacity=".5" />
          <stop offset="1" stopColor="#ffe9b8" stopOpacity="0" />
        </linearGradient>
      </defs>

      <motion.g {...drift(0.03)}>
        <path d={`M${lx - 75} ${ly}q20-26 54-24 30-16 60 4 24 4 40 20z`} fill={edition.islands.deep} />
        <path d={`M${lx - 12} ${ly - 14}l5-82h14l5 82z`} fill="#ece1d0" />
        <path d={`M${lx - 9.6} ${ly - 42}h18l-.8 12h-16.4zM${lx - 7.8} ${ly - 72}h15.6l-.7 11h-14.2z`} fill="#b8665a" />
        <path d={`M${lx - 75} ${ly}q20-26 54-24l-4 12q-26 0-42 12z`} fill={blendColor(edition.islands.deep, '#ffffff', 0.16)} />
        <path d={`M${lx + 15} ${ly - 20}q22 4 36 14l-8 6q-14-8-30-10z`} fill={blendColor(edition.islands.deep, '#ffffff', 0.1)} />
        <path d={`M${lx - 30} ${ly - 14}l-4 8 3 6M${lx + 44} ${ly - 8}l3 5`} stroke={blendColor(edition.islands.deep, '#0b1622', 0.45)} strokeWidth="1.4" strokeLinecap="round" fill="none" />
        <path d={`M${lx - 80} ${ly + 1}q90 8 180 0`} stroke="#eef4ee" strokeOpacity=".35" strokeWidth="1.5" fill="none" />
        <rect x={lx - 3} y={ly - 27} width="6" height="13" rx="3" fill="#6f4c40" />
        <rect x={lx - 9} y={ly - 110} width="18" height="13" rx="2" fill="#ffe7b0" />
        <path d={`M${lx - 11} ${ly - 110}l11-10 11 10z`} fill="#33445a" />
        <circle cx={lx} cy={ly - 103} r="22" fill="#ffe4a8" opacity=".7" filter="url(#soft-bloom)" />
        {/* Dawn dims the beam on the wrapper, so the pulse inside never restarts. */}
        <motion.g initial={false} animate={{ opacity: 1 - dawnProgress * 0.55 }} transition={reducedMotion ? { duration: 0 } : { duration: 1.6, ease: 'easeInOut' as const }}>
          <motion.path
            d={`M${lx - 6} ${ly - 104}L${lx - 420} ${ly - 150}L${lx - 420} ${ly - 70}Z`}
            fill="url(#lighthouse-beam)"
            initial={false}
            animate={reducedMotion ? { opacity: 0.8 } : { opacity: [0.6, 0.9, 0.6] }}
            transition={reducedMotion ? { duration: 0 } : { duration: 6.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.g>
        {celebration > 0 && (
          <motion.g
            key={`lighthouse-flash-${celebration}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1.3, delay: 0.55, ease: 'easeOut' }}
          >
            <circle cx={lx} cy={ly - 103} r="46" fill="#fff0c9" opacity=".8" filter="url(#soft-bloom)" />
            <path d={`M${lx - 6} ${ly - 104}L${lx - 420} ${ly - 150}L${lx - 420} ${ly - 70}Z`} fill="#fff0c9" opacity=".45" />
          </motion.g>
        )}
        <Waystone stone={edition.stone} size={0.8} x={lx - 46} y={ly - 6} lit={lit >= 3} celebration={celebration} sequence={3} />
        <Waystone stone={edition.stone} size={0.8} x={lx + 50} y={ly - 8} lit={lit >= 4} celebration={celebration} sequence={4} />
      </motion.g>

      <g transform={`translate(0 ${round1(horizon + sea * 0.17 - 36)})`}>
        <motion.g {...drift(0.07)}>
          <g transform="translate(0 72) scale(1 -1)" opacity=".22">{cottage}</g>
          {cottage}
          <motion.g initial={false} animate={{ opacity: windows }} transition={reducedMotion ? { duration: 0 } : { duration: 1.6, ease: 'easeInOut' as const }}>
            <rect x="121" y="14" width="6" height="7" rx="1" fill="#ffd98f" />
            <rect x="139" y="14" width="6" height="7" rx="1" fill="#ffd98f" />
            <circle cx="133" cy="18" r="16" fill="#ffd27f" opacity=".55" filter="url(#soft-bloom)" />
          </motion.g>
          <path d="M60 37q92 7 176 0" stroke="#eef4ee" strokeOpacity=".4" strokeWidth="1.5" fill="none" />
          <Waystone stone={edition.stone} size={0.6} x={88} y={16} lit={lit >= 1} celebration={celebration} sequence={5} />
          <Waystone stone={edition.stone} size={0.6} x={170} y={10} lit={lit >= 2} celebration={celebration} sequence={2} />
        </motion.g>
      </g>
    </>
  )
})

/** A soft mirror of the home island and its lowest stones; skips the per-frame work of a real reflection filter. */
const IslandReflection = memo(function IslandReflection({
  edition,
  groundY,
  waterline,
  baseBlocks,
}: {
  edition: DailyEdition
  groundY: number
  waterline: number
  baseBlocks: string
}) {
  const blocks = baseBlocks.split('|').filter(Boolean).map((block) => block.split(',').map(Number))
  return (
    <g pointerEvents="none">
      <g transform={`translate(0 ${waterline * 2}) scale(1 -1)`} opacity=".22">
        <path d={`M250 ${groundY - 12}H792L776 ${waterline}H266Z`} fill={edition.tower.deep} />
        <path d={islandTopPath(groundY)} fill={edition.tower.top} />
        {blocks.map(([x, width], index) => (
          <g key={index}>
            <rect x={x} y={groundY - (index + 1) * BLOCK_HEIGHT + BLOCK_BEVEL} width={width} height={BLOCK_FACE_HEIGHT} fill={edition.stone.front} />
            <rect x={x} y={groundY - (index + 1) * BLOCK_HEIGHT} width={width} height={BLOCK_BEVEL} fill={edition.stone.top} />
          </g>
        ))}
      </g>
      {/* Broken water lines across the mirror read as ripples without a filter. */}
      <path
        d={`M250 ${waterline + 12}h120m40 0h200m50 0h90M290 ${waterline + 28}h160m60 0h170M330 ${waterline + 48}h110m70 0h150M380 ${waterline + 74}h90m60 0h110`}
        stroke={edition.sea[0]}
        strokeWidth="3"
        opacity=".55"
      />
    </g>
  )
})

const smoothstep = (from: number, to: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

function cloudPuff(x: number, y: number, width: number) {
  const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
    `M${round1(cx - rx)} ${round1(cy)}a${round1(rx)} ${round1(ry)} 0 1 0 ${round1(rx * 2)} 0a${round1(rx)} ${round1(ry)} 0 1 0 ${round1(-rx * 2)} 0`
  return ellipse(x, y, width, width * 0.17)
    + ellipse(x - width * 0.32, y - width * 0.08, width * 0.42, width * 0.19)
    + ellipse(x + width * 0.22, y - width * 0.12, width * 0.38, width * 0.21)
}

/**
 * Clouds pinned to floors 8 to 15 of the tower, so they slide past as the camera climbs.
 * The front layer is thin and kept to the sides so it never hides the moving stone.
 */
const CloudBelt = memo(function CloudBelt({ groundY, layer, reducedMotion }: { groundY: number; layer: 'back' | 'front'; reducedMotion: boolean }) {
  const floor = (level: number) => groundY - level * BLOCK_HEIGHT
  if (layer === 'back') {
    return (
      <g pointerEvents="none" fill="#efdfe1">
        <path d={cloudPuff(170, floor(8.2), 150) + cloudPuff(840, floor(9.4), 170)} opacity=".42" />
        <path d={cloudPuff(560, floor(11), 210) + cloudPuff(130, floor(12.6), 160)} opacity=".36" />
        <path d={cloudPuff(860, floor(14), 180) + cloudPuff(420, floor(15.2), 150)} opacity=".3" />
      </g>
    )
  }
  return (
    <g pointerEvents="none" fill="#f6eaea" className={reducedMotion ? undefined : 'cloud-pass'}>
      <path d={cloudPuff(60, floor(9.8), 120) + cloudPuff(950, floor(12.2), 130)} opacity=".5" />
      <path d={cloudPuff(940, floor(7.4), 110) + cloudPuff(70, floor(14.4), 120)} opacity=".38" />
    </g>
  )
})

/**
 * Once the climber leaves the passing clouds, a sea of cloud forms below them. Like any layer seen
 * from above, it appears at the horizon first and spreads toward the viewer, row by row, so it moves
 * the same way as the rest of the world instead of rising against it.
 */
const CloudBank = memo(function CloudBank({ height, horizon, rise, reducedMotion }: { height: number; horizon: number; rise: number; reducedMotion: boolean }) {
  const rows = useMemo(() => {
    const random = seededRandom(31)
    const tones = [['#f3e2df', '#d9c3c9'], ['#e9d3d3', '#c9b0bd'], ['#dcc3c8', '#b49cb0'], ['#cbb0bb', '#9a86a0'], ['#b9a0b1', '#83748f']]
    const depth = height - horizon + 40
    return tones.map(([lit, shade], row) => {
      // Rows bunch up near the horizon and spread out toward the viewer.
      const y = round1(horizon - 12 + Math.pow(row / tones.length, 1.5) * depth)
      const nextY = row === tones.length - 1 ? height + 40 : round1(horizon - 12 + Math.pow((row + 1) / tones.length, 1.5) * depth)
      const size = 46 + row * 26
      let tops = ''
      let undersides = ''
      for (let x = -size; x <= WORLD_WIDTH + size; x += size * 0.9) {
        const lift = (random() - 0.5) * size * 0.3
        tops += cloudPuff(round1(x + random() * 20), round1(y + lift), size)
        undersides += cloudPuff(round1(x + 10), round1(y + lift + size * 0.16), size * 0.95)
      }
      return { lit, shade, tops, undersides, y, bandHeight: round1(nextY - y + size * 0.3) }
    })
  }, [height, horizon])

  return (
    <g pointerEvents="none">
      {rows.map((band, index) => (
        <motion.g
          key={index}
          initial={false}
          animate={{ opacity: smoothstep(index / rows.length, (index + 1.4) / rows.length, rise) }}
          transition={reducedMotion ? { duration: 0 } : { duration: 1.2, ease: 'easeInOut' }}
        >
          <rect y={band.y} width={WORLD_WIDTH} height={band.bandHeight} fill={band.shade} />
          <path d={band.undersides} fill={band.shade} />
          <path d={band.tops} fill={band.lit} />
        </motion.g>
      ))}
    </g>
  )
})

/** Deep sky, extra stars, an aurora and the odd shooting star once the tower reaches floor 26 and beyond. */
const HighSky = memo(function HighSky({ horizon, presence, reducedMotion }: { horizon: number; presence: number; reducedMotion: boolean }) {
  const stars = useMemo(() => {
    const random = seededRandom(23)
    let path = ''
    for (let index = 0; index < 90; index += 1) {
      const x = round1(random() * WORLD_WIDTH)
      const y = round1(Math.pow(random(), 1.3) * horizon * 0.75)
      const radius = random() > 0.85 ? 1.5 : 0.9
      path += `M${x - radius} ${y}a${radius} ${radius} 0 1 0 ${radius * 2} 0a${radius} ${radius} 0 1 0 ${-radius * 2} 0`
    }
    return path
  }, [horizon])
  const auroraY = round1(horizon * 0.24)
  return (
    <motion.g pointerEvents="none" initial={false} animate={{ opacity: presence }} transition={reducedMotion ? { duration: 0 } : { duration: 1.6, ease: 'easeInOut' as const }}>
      <defs>
        <linearGradient id="high-sky" x2="0" y2="1">
          <stop stopColor="#050a16" stopOpacity=".9" />
          <stop offset=".55" stopColor="#0b1428" stopOpacity=".45" />
          <stop offset="1" stopColor="#0b1428" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="aurora" x2="1">
          <stop stopColor="#7fe0c2" stopOpacity="0" />
          <stop offset=".45" stopColor="#9ff0d0" stopOpacity=".45" />
          <stop offset="1" stopColor="#b9a6f0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width={WORLD_WIDTH} height={round1(horizon * 0.8)} fill="url(#high-sky)" />
      <path d={stars} fill="#f8eed9" opacity=".8" />
      <path
        className={reducedMotion || presence === 0 ? undefined : 'aurora'}
        d={`M0 ${auroraY + 30}q160-90 330-34 170 56 330-20 180-70 340 10v60q-160-80-340-10-160 76-330 20-170-56-330 34z`}
        fill="url(#aurora)"
      />
      {!reducedMotion && presence > 0 && (
        <path className="shooting-star" d={`M760 ${round1(horizon * 0.12)}l-120 40`} stroke="#fff6e0" strokeWidth="2" strokeLinecap="round" />
      )}
    </motion.g>
  )
})

/** Faint streaks that blow past when the wind is strong. */
const WindStreaks = memo(function WindStreaks({ height, direction, visible, reducedMotion }: { height: number; direction: number; visible: boolean; reducedMotion: boolean }) {
  const lines = [0.22, 0.34, 0.47, 0.6].map((row, index) => {
    const y = round1(height * row)
    const x = 120 + index * 210
    return `M${x} ${y}h${110 + index * 20}`
  }).join('')
  return (
    <motion.g initial={false} animate={{ opacity: visible ? 1 : 0 }} transition={reducedMotion ? { duration: 0 } : { duration: 0.9 }} pointerEvents="none">
      <path
        className={reducedMotion ? undefined : 'wind-streak'}
        style={{ '--wind-sign': direction } as CSSProperties}
        d={lines}
        stroke="#f1e6dc"
        strokeOpacity=".22"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </motion.g>
  )
})

/** A small pennant on every tenth stone, so the tower records its own height. */
function Pennant({ block, y, floor, fresh }: { block: Block; y: number; floor: number; fresh: boolean }) {
  const x = block.x + block.width - 16
  return (
    <motion.g
      pointerEvents="none"
      aria-label={`Floor ${floor}`}
      initial={fresh ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.25, ease: 'easeOut' }}
    >
      <path d={`M${x} ${y + 2}V${y - 30}`} stroke="#2a3b4a" strokeWidth="2.4" strokeLinecap="round" />
      <path className="pennant" d={`M${x + 1} ${y - 30}l22 6-22 7z`} fill="#f2c58f" />
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
  // The engine only keeps the latest drop's trimmed pieces; keep the previous drop's too so a quick
  // next placement does not cut a piece off mid-fall.
  const [debris, setDebris] = useState({ placement, pieces: [] as Array<FallingPiece & { born: number }> })
  if (debris.placement !== placement) {
    const carried = placement > debris.placement ? debris.pieces.filter((piece) => piece.born >= placement - 1) : []
    setDebris({ placement, pieces: [...carried, ...game.fallingPieces.map((piece) => ({ ...piece, born: placement }))] })
  }
  const fallingPieces = debris.placement === placement ? debris.pieces : game.fallingPieces
  const edition = dailyEditionForSeed(game.challenge.seed)
  const groundY = height - 105
  const activeY = groundY - (game.stack.length + 1) * BLOCK_HEIGHT
  const tallMobileViewport = compact && height > WORLD_WIDTH * 1.15
  const targetY = height * (tallMobileViewport ? 0.64 : compact ? 0.48 : 0.43)
  const cameraShift = targetY - activeY
  const climbProgress = game.stack.length * BLOCK_HEIGHT
  const horizon = Math.round(height * 0.42)
  // The island now stands on a rock face, so the sea meets it lower down.
  const waterline = groundY + 26
  const waterY = height - 47
  const dawnStage = Math.min(heightOf(game) / 36, 1)
  const dawnProgress = dawnStage * dawnStage * (3 - 2 * dawnStage)
  const signalStartIndex = game.perfectStreak > 0
    ? Math.max(0, game.stack.length - game.perfectStreak - 1)
    : game.stack.length
  const landingFeedback = getLandingFeedback(game)
  const perfectCameraSettle = landingFeedback === 'perfect' && !reducedMotion
  const windStrength = Math.abs(game.windPercent)
  const windDirection = game.windPercent < 0 ? -1 : 1
  const sceneryIntensity = compact ? 0.7 : 1
  const blockSway = Math.min(2.3, windStrength * 0.28)
  const blockSwayDuration = Math.max(1.65, 3.2 - windStrength * 0.12)
  const towerHeight = heightOf(game)
  // Starts once the top stone has climbed out of the passing clouds (floors 7 to 15).
  const cloudRise = smoothstep(14, 22, towerHeight)
  const highSky = smoothstep(26, 36, towerHeight)
  // How far below the horizon the cloud sea currently reaches.
  const cloudCover = horizon - 12 + cloudRise * (height - horizon + 52)
  // Trimmed stones fall in front of the island: they splash in open water, sink into cloud where it already
  // covers the sea, or fall out of frame when the island is off-screen and nothing below is covered.
  const splashY = waterline + 26 + cameraShift
  const splashVisible = splashY <= height - 16
  const impactSurface: ImpactSurface = splashVisible
    ? (splashY <= cloudCover ? 'cloud' : 'water')
    : (cloudRise >= 0.95 ? 'cloud' : 'none')
  const impactY = splashVisible ? splashY : impactSurface === 'cloud' ? height - 70 : height + 160
  const baseBlocks = game.stack.slice(0, 3).map((block) => `${block.x},${block.width}`).join('|')

  return (
    <svg
      className="game-scene"
      viewBox={`0 0 ${WORLD_WIDTH} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Afterlight tower, height ${heightOf(game)}`}
    >
      <defs>
        <filter id="soft-bloom" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      <SeaBackdrop edition={edition} height={height} horizon={horizon} dawnProgress={dawnProgress} reducedMotion={reducedMotion} />
      <HighSky horizon={horizon} presence={highSky} reducedMotion={reducedMotion} />
      <SideIslets
        edition={edition}
        height={height}
        horizon={horizon}
        lit={Math.floor(game.perfects / 5)}
        celebration={beaconCelebration}
        dawnProgress={dawnProgress}
        reducedMotion={reducedMotion}
        compact={compact}
        climb={climbProgress * sceneryIntensity}
      />
      <CloudBank height={height} horizon={horizon} rise={cloudRise} reducedMotion={reducedMotion} />
      <BirdFlock active={towerHeight >= 8} reducedMotion={reducedMotion} />
      <WindStreaks height={height} direction={windDirection} visible={windStrength >= 6} reducedMotion={reducedMotion} />

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
        <IslandReflection edition={edition} groundY={groundY} waterline={waterline} baseBlocks={baseBlocks} />
        <defs>
          <linearGradient id="home-grass" x2="0" y2="1">
            <stop stopColor={blendColor(edition.tower.top, '#eef3e2', 0.35)} />
            <stop offset=".55" stopColor={edition.tower.top} />
            <stop offset="1" stopColor={blendColor(edition.tower.top, '#4f6d66', 0.3)} />
          </linearGradient>
        </defs>
        <IslandCliff left={250} right={792} top={groundY - 12} waterline={waterline} inset={16} cracks={[312, 398, 612, 700, 758]} deep={edition.tower.deep} light={edition.tower.shore} />
        <path d={islandTopPath(groundY + 5)} fill="#0b1622" opacity=".28" />
        <path d={islandTopPath(groundY)} fill="url(#home-grass)" />
        <path d={`M262 ${waterline + 1}q256 12 518 0`} stroke="#eef4ee" strokeOpacity=".45" strokeWidth="2" fill="none" />
        <path d={`M286 ${waterline + 9}q232 10 470 0`} stroke="#eef4ee" strokeOpacity=".2" strokeWidth="1.5" fill="none" />
        {/* Sized against the tower: a stone is about 1.5 m, so the pines stand roughly two stones tall. */}
        <Pine x={330} base={groundY - 34} height={124} color={edition.tower.trees} />
        <Pine x={762} base={groundY - 28} height={102} color={edition.tower.trees} />
        <Waystone stone={edition.stone} size={1.6} x={282} y={groundY - 26} lit={Math.floor(game.perfects / 5) >= 5} celebration={celebrating ? beaconCelebration : 0} sequence={1} />
        <Waystone stone={edition.stone} size={1.6} x={690} y={groundY - 50} lit={Math.floor(game.perfects / 5) >= 6} celebration={celebrating ? beaconCelebration : 0} sequence={0} />

        {celebrating && (
          <BeaconPulse
            key={`beacon-pulse-${beaconCelebration}`}
            block={game.stack.at(-1)!}
            topY={groundY - game.stack.length * BLOCK_HEIGHT}
            fromY={groundY - Math.max(1, game.stack.length - 5) * BLOCK_HEIGHT}
          />
        )}

        <CloudBelt groundY={groundY} layer="back" reducedMotion={reducedMotion} />
        {/* Only the stones are rebuilt for the settle bounce; anything else in here would replay its entrance on every drop. */}
        <motion.g
          key={`tower-settle-${game.placementTicks.length}`}
          initial={perfectCameraSettle ? { y: -4 } : false}
          animate={{ y: 0 }}
          transition={{ type: 'spring', stiffness: 390, damping: 24, mass: 0.48 }}
        >
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
            <Fragment key={index}>
            <BlockShape
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
              haze={Math.min(0.45, Math.max(0, (game.stack.length - 1 - index - 10) / 24))}
              stonePalette={edition.stone}
            />
            {index > 0 && index % 10 === 0 && (
              <Pennant block={block} y={groundY - (index + 1) * BLOCK_HEIGHT} floor={index} fresh={index === game.stack.length - 1} />
            )}
            </Fragment>
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
        </motion.g>
        {fallingPieces.map((piece) => (
          <motion.g
            key={`${piece.id}-${piece.x}`}
            initial={{ opacity: 1, y: 0, rotate: 0 }}
            animate={{
              opacity: [1, 1, 0],
              y: impactY - (groundY - piece.level * BLOCK_HEIGHT + cameraShift) - BLOCK_HEIGHT * 0.55,
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
        <CloudBelt groundY={groundY} layer="front" reducedMotion={reducedMotion} />
      </motion.g>

      <HarborBuoy active={cloudRise < 0.5} waterY={waterY} reducedMotion={reducedMotion} />
      {fallingPieces.map((piece) => (
        <WaterImpact
          key={`water-impact-${piece.id}-${piece.x}`}
          piece={piece}
          surfaceY={impactY}
          surface={impactSurface}
          forceful={game.phase === 'over'}
        />
      ))}
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
              <AnimatePresence>
                {game.perfectStreak > 0 && (
                  <motion.div key="streak" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }}>
                    <StreakPill streak={game.perfectStreak} />
                  </motion.div>
                )}
              </AnimatePresence>
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

          {/* Only a first-drop hint; once a stone is placed the player knows the move. */}
          <AnimatePresence>
          {game.phase === 'playing' && !isWaking && game.placementTicks.length === 0 && (
            <motion.div
              key="drop-hint"
              className="play-prompt chip"
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <span>Tap anywhere to drop</span>
              <kbd>SPACE</kbd>
            </motion.div>
          )}
          </AnimatePresence>

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
                className="state-card over-card"
                role="dialog"
                aria-labelledby="over-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{ duration: reducedMotion ? 0.2 : 0.36, delay: reducedMotion ? 0 : 1.18, ease: 'easeOut' }}
              >
                {/* A miss records a placement that never joined the stack; ending from pause does not. */}
                <h1 id="over-title" className="eyebrow over-eyebrow">{game.placementTicks.length > height ? 'The tide keeps it' : 'The beacon rests'}</h1>
                <p className="over-score">
                  <strong>{height}</strong>
                  <span>
                    {height === 1 ? 'stone' : 'stones'} · {game.perfects} perfect
                    {submissionStatus === 'saved' && <> · <b>new best today</b></>}
                  </span>
                </p>
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
                <button className="text-button share-link" type="button" onClick={() => void shareRun()}>
                  <span aria-live="polite">{shareNote || 'Share'}</span>
                </button>
                {/* Only problems are worth a line here; a clean save needs no message. */}
                {(submissionStatus === 'failed' || submissionStatus === 'offline') && (
                  <p className="result-submission is-failed" role="status">
                    {submissionStatus === 'offline' ? 'Offline · score not saved.' : (submissionError || 'Could not sync this run.')}
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
        <Leaderboard
          challengeDate={game.challenge.date}
          entries={leaderboardEntries}
          loading={leaderboardLoading}
          error={leaderboardError}
          playerName={playerName}
          nameSaving={nameSaving}
          onSaveName={updatePlayerName}
          mobileOpen={leaderboardOpen}
          onClose={closeLeaderboard}
        />
      </section>
    </main>
    </MotionConfig>
  )
}

export default App
