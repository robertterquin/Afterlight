import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import afterlightMark from './assets/afterlight-mark.svg'
import { Leaderboard } from './DailyLeaderboard'
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

type FeedbackSound = 'place' | 'perfect' | 'miss'

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
}: {
  block: Block
  y: number
  active?: boolean
  landed?: boolean
  perfect?: boolean
  grew?: boolean
}) {
  const bevel = 10
  const faceHeight = BLOCK_HEIGHT - bevel
  const top = active ? '#fff0c9' : '#d8e1d5'
  const front = active ? '#d79d6f' : '#71988c'
  const side = active ? '#a86858' : '#416a70'
  const jointColor = active ? '#bb7d5e' : '#5d817b'
  const lensColor = active ? '#fff0b7' : '#e8bf80'
  const lensWidth = Math.min(14, Math.max(7, block.width * 0.075))
  const lensHeight = Math.min(30, Math.max(18, faceHeight * 0.52))
  const lensX = block.x + block.width / 2 - lensWidth / 2
  const lensY = y + bevel + (faceHeight - lensHeight) / 2
  const masonryJoints = block.width > 155 ? [0.18, 0.43, 0.72, 0.88] : [0.28, 0.7]
  const classes = [active && 'moving-block', perfect && 'perfect-stone']
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
        <path
          d={`M${block.x} ${y + bevel + 10}H${block.x + block.width}`}
          stroke={active ? '#e9b681' : '#a1baa0'}
          strokeWidth="2"
          opacity=".58"
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
          x={lensX - 4}
          y={lensY - 4}
          width={lensWidth + 8}
          height={lensHeight + 8}
          rx={(lensWidth + 8) / 2}
          fill={lensColor}
          filter="url(#soft-bloom)"
          opacity=".24"
        />
        <rect x={lensX} y={lensY} width={lensWidth} height={lensHeight} rx={lensWidth / 2} fill={lensColor} />
        <rect
          x={lensX + lensWidth * 0.32}
          y={lensY + lensHeight * 0.17}
          width={lensWidth * 0.36}
          height={lensHeight * 0.66}
          rx={lensWidth * 0.18}
          fill="#fff7da"
          opacity=".88"
        />
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

function GameScene({ game, height }: { game: GameState; height: number }) {
  const [beaconCelebration, setBeaconCelebration] = useState(0)
  const { compact, reducedMotion } = useScenePreferences()
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
  const windStrength = Math.abs(game.windPercent)
  const windDirection = game.windPercent < 0 ? -1 : 1
  const sceneryIntensity = compact ? 0.7 : 1
  const cloudDrift = (12 + windStrength * 1.5) * sceneryIntensity
  const cloudDuration = (42 - windStrength * 1.1) * (compact ? 1.28 : 1)
  const nearCloudStyle = {
    '--wind-drift': `${windDirection * cloudDrift}px`,
    '--wind-duration': `${cloudDuration}s`,
  } as CSSProperties
  const farCloudStyle = {
    '--wind-drift': `${windDirection * cloudDrift * 0.68}px`,
    '--wind-duration': `${cloudDuration * 1.18}s`,
    '--wind-delay': `${-cloudDuration * 1.18 * 0.37}s`,
  } as CSSProperties

  useEffect(() => {
    if (game.lastDropWasPerfect && game.perfectStreak > 0 && game.perfectStreak % 5 === 0) {
      setBeaconCelebration((count) => count + 1)
    }
  }, [game.lastDropWasPerfect, game.perfectStreak, game.placementTicks.length])

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
          <stop stopColor="#17263a" />
          <stop offset=".42" stopColor="#4b526d" />
          <stop offset=".76" stopColor="#bb8c8c" />
          <stop offset="1" stopColor="#365f6c" />
        </linearGradient>
        <linearGradient id="dawn-sky" x2="0" y2="1">
          <stop stopColor="#a9909a" stopOpacity=".025" />
          <stop offset=".42" stopColor="#d18e83" stopOpacity=".12" />
          <stop offset=".76" stopColor="#e9a678" stopOpacity=".48" />
          <stop offset="1" stopColor="#f0c18f" stopOpacity=".76" />
        </linearGradient>
        <linearGradient id="sea" x2="0" y2="1">
          <stop stopColor="#4b7780" />
          <stop offset="1" stopColor="#142e42" />
        </linearGradient>
        <radialGradient id="moonlight">
          <stop stopColor="#f6d9b6" stopOpacity=".48" />
          <stop offset="1" stopColor="#f6d9b6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ray" x2="0" y2="1">
          <stop stopColor="#ffe5b5" stopOpacity="0" />
          <stop offset="1" stopColor="#ffe5b5" stopOpacity=".22" />
        </linearGradient>
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
        transition={{ duration: 1.8, ease: 'easeInOut' }}
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
        transition={{ duration: 1.8, ease: 'easeInOut' }}
      >
        <circle cx="820" cy={height * 0.27} r="150" fill="url(#moonlight)" />
        <circle cx="820" cy={height * 0.27} r="42" fill="#f1d9ba" opacity=".92" />
        <path d={`M830 ${height * 0.27 - 39}a42 42 0 1 0 28 68 38 38 0 0 1-28-68z`} fill="#d1aa99" opacity=".25" />
      </motion.g>

      <motion.g
        className="sky-stars"
        initial={false}
        animate={{ opacity: 1 - dawnProgress }}
        transition={{ duration: 1.8, ease: 'easeInOut' }}
      >
        {starPositions.map(([x, y], index) => (
          <circle key={index} cx={x} cy={height * y} r={index % 3 === 0 ? 1.7 : 1.2} fill="#f5e8ce" opacity={index % 2 ? '.56' : '.8'} />
        ))}
      </motion.g>
      <path d={`M0 ${horizon}q130 -80 250 -26 130 -94 250 -10 140 -91 270 -8 110 -59 230 18v150H0z`} fill="#53536c" opacity=".72" />
      <path d={`M0 ${horizon + 72}q120 -55 235 -8 111 -72 227 -5 131 -74 253 -9 124 -62 285 -3v140H0z`} fill="#344b61" opacity=".92" />

      {/* Far islands */}
      <g transform={`translate(0 ${height * 0.45})`}>
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
        <path d="M58 70q20-40 65-31 38-34 78 0 47-8 68 32l-18 18q-42 4-63 27l-31-4-34 24-23-15-36 5-13-25-26-7z" fill="#294354" />
        <path d="M72 67q24-28 62-22 40-33 74 0 41-7 59 26-29 12-61 6-39 14-72 0-33 10-62-10z" fill="#91a89b" />
        <path d="M131 52h22v26h-22zM126 53l16-15 16 15z" fill="#e2bd98" />
        <path d="M92 59v-20m-7 12 7-13 7 13m123 4V37m-7 12 7-13 7 13" stroke="#294354" strokeWidth="3" fill="none" strokeLinecap="round" />
        <Lantern x={95} y={49} lit={Math.floor(game.perfects / 5) >= 1} celebration={beaconCelebration} sequence={8} />
        <Lantern x={142} y={66} lit={Math.floor(game.perfects / 5) >= 2} celebration={beaconCelebration} sequence={6} />
        <Lantern x={215} y={47} lit={Math.floor(game.perfects / 5) >= 3} celebration={beaconCelebration} sequence={4} />
        </motion.g>
        </motion.g>
      </g>
      <g transform={`translate(0 ${height * 0.41})`}>
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
        <path d="M760 82q24-42 67-34 42-36 82-1 44-8 71 33l-18 20q-43 7-64 26l-33-6-35 25-23-14-36 4-13-24-27-7z" fill="#294354" />
        <path d="M774 78q24-30 62-25 42-34 78 0 41-6 58 28-28 11-60 4-39 15-72 1-34 9-66-8z" fill="#9db19f" />
        <path d="M835 64h26v30h-26zM829 65l19-18 19 18z" fill="#e4c19a" />
        <path d="M885 66V43m-8 13 8-14 8 14m37 12V47m-7 12 7-13 7 13" stroke="#294354" strokeWidth="3.4" fill="none" strokeLinecap="round" />
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
        <ellipse cx="500" cy={groundY + 12} rx="276" ry="36" fill="#132a3e" opacity=".38" />
        <path d={`M224 ${groundY - 8}q38-58 116-48 50-49 117-28 60-47 125-12 77-32 134 20 73 2 103 56l-34 30q-57-4-92 26l-57-13-66 42-53-20-70 34-44-25-75 17-32-31-64-11z`} fill="#294354" />
        <path d={`M240 ${groundY - 14}q46-45 108-32 55-49 118-24 61-46 122-10 71-25 124 21 60 5 88 45-44 19-104 10-66 23-122 4-67 22-127 3-74 22-123-1-42 10-84-16z`} fill="#9fb29d" />
        <path d={`M267 ${groundY + 14}q69-19 127 0 69-19 132 0 66-20 133 4 41 5 78-3l-35 29q-49 1-77 21l-58-14-63 41-52-21-66 33-43-26-74 16-31-28z`} fill="#718f88" />
        <g fill="#294657">
          <path d={`M340 ${groundY - 42}l15-34 15 34zM383 ${groundY - 41}l12-26 12 26zM710 ${groundY - 42}l16-36 16 36zM753 ${groundY - 41}l11-25 12 25z`} />
          <path d={`M347 ${groundY - 42}v17m42-17v17m344-17v17m41-17v17`} stroke="#294657" strokeWidth="4" />
        </g>
        <Lantern x={355} y={groundY - 65} lit={Math.floor(game.perfects / 5) >= 7} celebration={beaconCelebration} sequence={2} />
        <Lantern x={397} y={groundY - 62} lit={Math.floor(game.perfects / 5) >= 8} celebration={beaconCelebration} sequence={0} />
        <Lantern x={726} y={groundY - 67} lit={Math.floor(game.perfects / 5) >= 9} celebration={beaconCelebration} sequence={1} />

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

        {game.stack.map((block, index) => (
          <BlockShape
            key={index}
            block={block}
            y={groundY - (index + 1) * BLOCK_HEIGHT}
            landed={index === game.stack.length - 1 && game.stack.length > 1}
            perfect={index === game.stack.length - 1 && game.lastDropWasPerfect}
            grew={index === game.stack.length - 1 && game.lastDropGrew}
          />
        ))}
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
            />
          </motion.g>
        ))}
        {game.moving && (
          <g className="active-block-layer">
            {game.lastDropWasPerfect && (
              <path
                key={game.stack.length}
                className="perfect-ray"
                d={`M500 ${groundY - (game.stack.length + 1) * BLOCK_HEIGHT}L455 ${groundY - (game.stack.length + 1) * BLOCK_HEIGHT - 130}Q500 ${groundY - (game.stack.length + 1) * BLOCK_HEIGHT - 100} 545 ${groundY - (game.stack.length + 1) * BLOCK_HEIGHT - 130}Z`}
                fill="url(#ray)"
              />
            )}
            <BlockShape
              block={game.moving}
              y={groundY - (game.stack.length + 1) * BLOCK_HEIGHT}
              active
            />
          </g>
        )}
        {game.lastDropWasPerfect && game.stack.length > 1 && (
          <circle
            key={game.stack.length}
            className="perfect-pulse"
            cx={game.stack.at(-1)!.x + game.stack.at(-1)!.width / 2}
            cy={groundY - game.stack.length * BLOCK_HEIGHT + BLOCK_HEIGHT / 2}
            r="18"
          />
        )}
      </motion.g>

      <path d={`M0 ${height - 58}q112-32 224 0 130-31 264 1 133-35 268 0 111-30 244 4v${58}`} fill="url(#sea)" opacity=".88" />
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
      <path className="water-glint" d={`M418 ${height - 45}h166m-140 13h116m-96 12h76`} stroke="#efd2ad" strokeWidth="1.6" opacity=".2" strokeLinecap="round" />
    </svg>
  )
}

function App() {
  const [game, setGame] = useState(createGame)
  const [sceneHeight, setSceneHeight] = useState(760)
  const [perfectToast, setPerfectToast] = useState(false)
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
  const stageRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef(game)
  const soundEnabledRef = useRef(soundEnabled)
  const audioContextRef = useRef<AudioContext | null>(null)
  const runIdRef = useRef(0)
  const autoSubmittedRunRef = useRef(-1)
  const resumeAfterLeaderboardRef = useRef(false)

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
        const { connectAnonymousPlayer, isConfigured } = await import('./leaderboard')
        if (!isConfigured()) {
          setLeaderboardError('Add your Supabase URL and publishable key to enable the daily board.')
          setLeaderboardLoading(false)
          return
        }
        const { id, name } = await connectAnonymousPlayer()
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

  const start = useCallback(() => {
    const current = gameRef.current
    if (current.phase === 'ready') {
      runIdRef.current += 1
      setSubmissionStatus('idle')
      setSubmissionError('')
      commitGame(startGame(createGame(createDailyChallenge())))
    }
  }, [commitGame])
  const retry = useCallback(() => {
    runIdRef.current += 1
    setSubmissionStatus('idle')
    setSubmissionError('')
    commitGame(startGame(createGame(createDailyChallenge())))
  }, [commitGame])
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
    if (game.phase !== 'playing') return

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
  }, [game.phase])

  useEffect(() => {
    if (!game.lastDropWasPerfect) return
    setPerfectToast(true)
    const timer = window.setTimeout(() => setPerfectToast(false), 700)
    return () => window.clearTimeout(timer)
  }, [game.lastDropWasPerfect, game.stack.length])

  const handlePlace = useCallback(() => {
    const current = gameRef.current
    const next = placeBlock(current)
    if (next === current) return

    commitGame(next)
    if (next.phase === 'over') playFeedback('miss')
    else if (next.stack.length > current.stack.length) {
      playFeedback(next.lastDropWasPerfect ? 'perfect' : 'place')
    }
  }, [commitGame, playFeedback])

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
          {game.phase === 'playing' && (
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
          className={`stage ${game.phase === 'playing' ? 'is-playing' : ''}`}
          ref={stageRef}
          onPointerDown={handlePlace}
        >
          <GameScene game={game} height={sceneHeight} />

          <div className="height-readout" aria-live="polite">
            <span>Height</span>
            <strong>{String(height).padStart(2, '0')}</strong>
          </div>

          <div
            className="daily-readout"
            aria-label={`Daily challenge ${game.challenge.date}. ${game.windPercent === 0 ? 'Wind calm' : `Wind ${game.windPercent > 0 ? 'plus ' : 'minus '}${Math.abs(game.windPercent)} percent`}.`}
          >
            <span className="daily-date">Daily · {formatDailyDate(game.challenge.date)}</span>
            <strong className="wind-value">
              {game.windPercent === 0
                ? 'Wind calm'
                : `Wind ${game.windPercent > 0 ? '+' : '−'}${Math.abs(game.windPercent)}%`}
            </strong>
          </div>

          {game.phase === 'playing' && (
            <div className="play-prompt" aria-hidden="true">
              <span className="tap-dot"><i /></span>
              <span>Tap to place</span>
              <kbd>SPACE</kbd>
            </div>
          )}

          {perfectToast && game.phase === 'playing' && (
            <div className="perfect-toast" role="status">Perfect</div>
          )}

          <AnimatePresence mode="wait">
            {game.phase === 'ready' && (
              <motion.div
                key="ready"
                className="state-card ready-card"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
              >
                <motion.button
                  className="primary-button"
                  type="button"
                  onClick={start}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 460, damping: 24 }}
                >
                  Start climb
                </motion.button>
                <span className="keyboard-hint">or press Space</span>
              </motion.div>
            )}

            {game.phase === 'paused' && (
              <motion.div
                key="paused"
                className="state-card"
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
                className="state-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="over-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.24 }}
              >
                <h1 id="over-title">Run over</h1>
                <p className="result-line"><strong>{height}</strong> {height === 1 ? 'stone' : 'stones'} placed</p>
                {game.perfects > 0 && <p className="result-detail">{game.perfects} perfect {game.perfects === 1 ? 'landing' : 'landings'}</p>}
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
                <motion.button
                  className="primary-button"
                  type="button"
                  onClick={retry}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 460, damping: 24 }}
                >
                  Try again
                </motion.button>
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
