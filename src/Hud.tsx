import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { heightOf, STARTING_WIDTH, type GameState } from './game'
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

const WindIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8" /></svg>
)
const ClockIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></svg>
)

export function ReadyOverlay({
  editionName,
  dateLabel,
  windPercent,
  entries,
  onStart,
}: {
  editionName: string
  dateLabel: string
  windPercent: number
  entries: LeaderboardEntry[]
  onStart: () => void
}) {
  const countdown = useCountdown()
  const you = entries.find((entry) => entry.is_you)
  const third = entries.find((entry) => entry.rank === 3)
  const wind = windPercent === 0 ? 'Calm start' : `Wind ${windPercent > 0 ? '+' : '−'}${Math.abs(windPercent)}% at start`

  let goal = 'Your first climb today puts you on the board.'
  if (you && you.rank <= 3) goal = `You hold #${you.rank} on the podium. Climb higher to keep it.`
  else if (you && third) goal = `Climb past ${third.height} to reach the podium, ahead of ${third.display_name}.`

  return (
    <div className="ready-panel">
      <div className="ready-intro">
        <span className="eyebrow">Today’s course · {dateLabel}</span>
        <h1 className="ready-course-title">{editionName}</h1>
        <p className="ready-description">Everyone climbs the same tower today. The wind shifts every five floors.</p>
        <div className="ready-chips">
          <span className="chip only-wide"><WindIcon />{wind}</span>
          {you && <span className="chip only-compact">Best <b>{you.height}</b> · #{you.rank}</span>}
          {third && <span className="chip only-compact">Podium at <b>{third.height}</b></span>}
          <span className="chip"><ClockIcon /><span className="only-wide">New course in</span><span className="only-compact">New in</span> <b className="num">{countdown}</b></span>
        </div>
      </div>

      <div className="goal-card glass">
        <div className="goal-stats">
          <div><span>Your best</span><strong>{you?.height ?? '–'}</strong></div>
          <div><span>Your rank</span><strong>{you ? `#${you.rank}` : '–'}</strong></div>
          <div><span>Top 3 at</span><strong>{third?.height ?? '–'}</strong></div>
        </div>
        <p className="goal-line">{goal}</p>
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
        <p className="goal-howto">Drop each stone onto the one below. Land five perfect drops in a row and the next stone grows wider.</p>
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

export function Progress({ value, max, dim = false }: { value: number; max: number; dim?: boolean }) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="track">
      <motion.div
        className={`track-fill${dim ? ' is-dim' : ''}`}
        initial={false}
        animate={{ width: `${percent}%` }}
        transition={{ type: 'spring', stiffness: 140, damping: 24 }}
      />
    </div>
  )
}

export function RunPanel({ game, entries }: { game: GameState; entries: LeaderboardEntry[] }) {
  const height = heightOf(game)
  const you = entries.find((entry) => entry.is_you)
  const third = entries.find((entry) => entry.rank === 3 && !entry.is_you)
  const stone = game.moving ?? game.stack.at(-1)!
  const toGo = (target: number) => (target - height > 0 ? `${target - height} to go` : 'Passed')

  return (
    <aside className="run-panel panel" aria-label="This run">
      <div className="panel-heading">
        <span className="eyebrow is-live"><i />{game.phase === 'paused' ? 'Paused' : 'Climbing'}</span>
        <h2>This run</h2>
      </div>
      <div className="tiles">
        <div className="tile"><span>Height</span><strong>{height}</strong></div>
        <div className="tile"><span>Perfect</span><strong>{game.perfects}</strong></div>
        <div className="tile"><span>Stone width</span><strong>{Math.round((stone.width / STARTING_WIDTH) * 100)}%</strong></div>
      </div>
      {(you || third) && (
        <div className="next-marks">
          <span className="eyebrow is-muted">Next marks</span>
          {you && (
            <div className="mark">
              <div className="mark-line"><span>Your best today</span><b className="is-gold">{toGo(you.height)}</b></div>
              <Progress value={height} max={you.height} />
            </div>
          )}
          {third && (
            <div className="mark">
              <div className="mark-line"><span>Podium · {third.display_name}</span><b>{toGo(third.height + 1)}</b></div>
              <Progress value={height} max={third.height + 1} dim />
            </div>
          )}
        </div>
      )}
      <div className="note">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12M6 21h12M7 3c0 5 10 6 10 9s-10 4-10 9M17 3c0 5-10 6-10 9s10 4 10 9" /></svg>
        <div><strong>The board waits</strong><p>Ranks refresh when this run ends, so nothing moves while you aim.</p></div>
      </div>
    </aside>
  )
}

