import { memo, useState, type FormEvent } from 'react'
import { formatDailyDate } from './game'
import type { LeaderboardEntry } from './leaderboard'

type Props = {
  challengeDate: string
  entries: LeaderboardEntry[]
  loading: boolean
  error: string | null
  playerName: string
  nameSaving: boolean
  onSaveName: (name: string) => Promise<void>
  mobileOpen: boolean
  onClose: () => void
}

function TowerGlyph({ entry }: { entry: LeaderboardEntry }) {
  const floors = Math.min(6, Math.max(2, Math.ceil(entry.height / 8)))
  const litFloors = Math.min(floors, Math.round((entry.perfects / Math.max(entry.height, 1)) * floors))
  const rankTone = Math.min(entry.rank, 4)

  return (
    <span className={`tower-glyph rank-${rankTone}${entry.is_you ? ' is-you' : ''}`} aria-hidden="true">
      {Array.from({ length: floors }, (_, floor) => {
        const lit = floor < litFloors
        const width = 30 - floor * 2.4

        return (
          <span
            key={floor}
            className={`tower-floor${lit ? ' is-lit' : ''}`}
            style={{ width }}
          >
            <span className="tower-lens" />
          </span>
        )
      })}
    </span>
  )
}

function ScoreRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <li className={`leaderboard-row rank-${Math.min(entry.rank, 4)}${entry.is_you ? ' is-you' : ''}`}>
      <span className="leaderboard-rank">{String(entry.rank).padStart(2, '0')}</span>
      <TowerGlyph entry={entry} />
      <span className="leaderboard-player">
        <strong>{entry.display_name}</strong>
        {entry.is_you && <small>You</small>}
      </span>
      <span className="leaderboard-score">
        <strong>{entry.height}</strong>
        <small>{entry.perfects} perfect</small>
      </span>
    </li>
  )
}

export const Leaderboard = memo(function Leaderboard({
  challengeDate,
  entries,
  loading,
  error,
  playerName,
  nameSaving,
  onSaveName,
  mobileOpen,
  onClose,
}: Props) {
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState(playerName)
  const [nameError, setNameError] = useState<string | null>(null)
  const podium = entries.filter((entry) => entry.rank <= 3)
  const personalEntry = entries.find((entry) => entry.is_you && entry.rank > 3)

  async function submitName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNameError(null)
    try {
      await onSaveName(draftName)
      setEditingName(false)
    } catch (cause) {
      setNameError(cause instanceof Error ? cause.message : 'Could not update your name.')
    }
  }

  return (
    <>
      {mobileOpen && <button className="leaderboard-backdrop" type="button" aria-label="Close leaderboard" onClick={onClose} />}
      <aside
        className={`leaderboard${mobileOpen ? ' is-open' : ''}`}
        aria-label="Daily leaderboard"
        aria-modal={mobileOpen ? true : undefined}
        role={mobileOpen ? 'dialog' : 'complementary'}
      >
        <header className="leaderboard-heading">
          <div>
            <span className="leaderboard-kicker">{formatDailyDate(challengeDate)}</span>
            <h2>Daily board</h2>
          </div>
          {mobileOpen && <button className="leaderboard-close" type="button" onClick={onClose} aria-label="Close leaderboard">×</button>}
        </header>

        <div className="leaderboard-list-wrap">
          {loading && entries.length === 0 && <p className="leaderboard-message">Finding today’s climbers…</p>}
          {error && <p className="leaderboard-message leaderboard-error" role="status">{error}</p>}
          {!loading && !error && entries.length === 0 && (
            <p className="leaderboard-message">No scores yet. Set the first mark.</p>
          )}
          {podium.length > 0 && (
            <ol className="leaderboard-list" aria-label="Top three scores">
              {podium.map((entry) => <ScoreRow key={entry.rank} entry={entry} />)}
            </ol>
          )}
          {personalEntry && (
            <div className="personal-rank">
              <span className="personal-rank-label">Your best</span>
              <ol className="leaderboard-list" aria-label="Your best rank">
                <ScoreRow entry={personalEntry} />
              </ol>
            </div>
          )}
        </div>

        <div className="leaderboard-profile">
          {playerName ? (
            editingName ? (
              <form className="name-form" onSubmit={submitName}>
                <label htmlFor="player-name">Your name</label>
                <div className="name-form-row">
                  <input
                    id="player-name"
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    minLength={3}
                    maxLength={18}
                    pattern="[A-Za-z0-9 _-]{3,18}"
                    autoComplete="nickname"
                    required
                  />
                  <button type="submit" disabled={nameSaving}>{nameSaving ? '…' : 'Save'}</button>
                </div>
                {nameError && <p className="name-error" role="alert">{nameError}</p>}
              </form>
            ) : (
              <div className="player-name-line">
                <span><small>Climbing as</small><strong>{playerName}</strong></span>
                <button
                  type="button"
                  onClick={() => {
                    setDraftName(playerName)
                    setNameError(null)
                    setEditingName(true)
                  }}
                >Edit</button>
              </div>
            )
          ) : (
            <p className="leaderboard-message">Anonymous player sign-in is needed for ranked scores.</p>
          )}
          <p className="leaderboard-footnote">Same course for everyone · UTC daily reset</p>
        </div>
      </aside>
    </>
  )
})
