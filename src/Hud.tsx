import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import type { LeaderboardEntry } from './leaderboard'

// Mirrors PERFECTS_TO_AWAKEN in the game engine: the fifth perfect in a row grows the stone.
const PERFECTS_TO_GROW = 5

function countdownToUtcMidnight() {
  const now = new Date()
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  const seconds = Math.max(0, Math.floor((next - now.getTime()) / 1000))
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')
}

function useCountdown() {
  const [label, setLabel] = useState(countdownToUtcMidnight)
  useEffect(() => {
    const timer = window.setInterval(() => setLabel(countdownToUtcMidnight()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return label
}

export function ReadyOverlay({
  editionName,
  dateLabel,
  entries,
  onStart,
}: {
  editionName: string
  dateLabel: string
  entries: LeaderboardEntry[]
  onStart: () => void
}) {
  const countdown = useCountdown()
  const you = entries.find((entry) => entry.is_you)
  const third = entries.find((entry) => entry.rank === 3)

  return (
    <div className="ready-panel">
      <div className="ready-intro">
        <span className="eyebrow">Today · {dateLabel}</span>
        <h1 className="ready-course-title">{editionName}</h1>
        <span className="ready-countdown">New course in <b className="num">{countdown}</b></span>
      </div>

      <div className="ready-start">
        <motion.button
          className="primary-button start-button"
          type="button"
          onClick={onStart}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 460, damping: 24 }}
        >
          Start climb<kbd>SPACE</kbd>
        </motion.button>
        {you ? (
          <p className="ready-line">
            Best today <b className="num">{you.height}</b> · {you.rank <= 3 || !third
              ? <b>#{you.rank}</b>
              : <>podium at <b className="num">{third.height}</b></>}
          </p>
        ) : (
          <>
            <p className="ready-line">Your first climb today puts you on the board.</p>
            <p className="ready-hint">Five perfect drops in a row grow the next stone.</p>
          </>
        )}
      </div>
    </div>
  )
}

export function StreakPill({ streak }: { streak: number }) {
  const filled = Math.min(streak, PERFECTS_TO_GROW)
  const remaining = PERFECTS_TO_GROW - filled
  return (
    <div className="chip streak-pill" aria-label={`Perfect streak ${streak}`}>
      <span className="streak-dots" aria-hidden="true">
        {Array.from({ length: PERFECTS_TO_GROW }, (_, index) => (
          <span key={index} className={index < filled ? 'is-on' : undefined} />
        ))}
      </span>
      <span>
        Perfect streak <b className="num">{streak}</b>
        <span className="streak-hint"> · {remaining > 0 ? `${remaining} more grows the stone` : 'each perfect grows the stone'}</span>
      </span>
    </div>
  )
}

const LADDER_HEIGHT = 380
const LABEL_GAP = 22

export function HeightLadder({ entries, height }: { entries: LeaderboardEntry[]; height: number }) {
  const you = entries.find((entry) => entry.is_you)
  const marks = [
    ...entries.filter((entry) => entry.rank <= 3 && !entry.is_you).map((entry) => ({
      key: `rank-${entry.rank}`, label: entry.display_name, value: entry.height, tone: `rank-${entry.rank}`,
    })),
    ...(you ? [{ key: 'best', label: 'Your best', value: you.height, tone: 'best' }] : []),
  ]
  const top = Math.max(height, ...marks.map((mark) => mark.value)) + 2
  const position = (value: number) => LADDER_HEIGHT - (value / top) * LADDER_HEIGHT

  // Push labels apart from the top down so close scores stay readable.
  const placed = [...marks]
    .sort((a, b) => b.value - a.value)
    .reduce<Array<(typeof marks)[number] & { y: number }>>((list, mark) => {
      const y = Math.max(position(mark.value), (list.at(-1)?.y ?? -Infinity) + LABEL_GAP)
      return [...list, { ...mark, y: Math.min(y, LADDER_HEIGHT - LABEL_GAP) }]
    }, [])
  const youY = position(height)
  const ariaLabel = `Height ladder: you at ${height}${marks.map((mark) => `, ${mark.label} ${mark.value}`).join('')}`

  return (
    <div className="height-ladder" role="img" aria-label={ariaLabel} style={{ height: LADDER_HEIGHT }}>
      <span className="ladder-track" />
      <motion.span
        className="ladder-fill"
        initial={false}
        animate={{ height: LADDER_HEIGHT - youY }}
        transition={{ type: 'spring', stiffness: 120, damping: 22 }}
      />
      {placed.map((mark) => (
        <span key={mark.key} className={`ladder-mark is-${mark.tone}`} style={{ top: mark.y }}>
          <span className="ladder-label">{mark.label} · <b className="num">{mark.value}</b></span>
          <i />
        </span>
      ))}
      <motion.span
        className="ladder-mark is-you"
        initial={false}
        animate={{ top: youY }}
        transition={{ type: 'spring', stiffness: 120, damping: 22 }}
      >
        <span className="ladder-label">You · <b className="num">{height}</b></span>
        <i />
      </motion.span>
    </div>
  )
}
