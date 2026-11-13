import { memo, useEffect, useState, type FormEvent } from 'react'
import { formatDailyDate } from './game'
import type { LeaderboardEntry, TowerProfile } from './leaderboard'

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

// The daily course turns over at UTC midnight; show that moment in the player's own clock.
const resetTime = new Date(Date.UTC(2000, 0, 1)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

type TowerGlyphFloor = {
  level: number
  width: number
  left: number
  bottom: number
  lit: boolean
}

function fallbackTowerFloors(entry: LeaderboardEntry, detail: boolean): TowerGlyphFloor[] {
  const floors = Math.min(6, Math.max(2, Math.ceil(entry.height / 8)))
  const litFloors = Math.min(floors, Math.round((entry.perfects / Math.max(entry.height, 1)) * floors))
  const baseWidth = detail ? 46 : 30
  const taper = detail ? 3.7 : 2.4
  const containerWidth = detail ? 60 : 40
  const floorHeight = detail ? 7 : 5
  const gap = detail ? 2 : 1

  return Array.from({ length: floors }, (_, floor) => {
    const width = baseWidth - floor * taper
    return {
      level: floor + 1,
      width,
      left: (containerWidth - width) / 2,
      bottom: floor * (floorHeight + gap),
      lit: floor < litFloors,
    }
  })
}

function profileTowerFloors(profile: TowerProfile, detail: boolean): TowerGlyphFloor[] | null {
  const blocks = profile.blocks.filter(
    (block) => Number.isFinite(block.x) && Number.isFinite(block.width) && block.width > 0,
  )
  if (blocks.length < 2) return null

  const placedBlocks = blocks.slice(1)
  const floors = Math.min(detail ? 7 : 6, placedBlocks.length)
  const sampledIndexes = Array.from(
    { length: floors },
    (_, floor) => Math.round((floor * (placedBlocks.length - 1)) / Math.max(1, floors - 1)),
  )
  const baseBlock = blocks[0]
  const maximumWidth = Math.max(...blocks.map((block) => block.width))
  const baseWidth = detail ? 46 : 30
  const containerWidth = detail ? 60 : 40
  const minimumWidth = detail ? 16 : 11
  const floorHeight = detail ? 7 : 5
  const gap = detail ? 2 : 1
  const baseCenter = baseBlock.x + baseBlock.width / 2
  const perfectLevels = new Set(profile.perfectLevels.filter((level) => Number.isInteger(level) && level > 0))

  return sampledIndexes.map((blockIndex, floor) => {
    const block = placedBlocks[blockIndex]
    const width = Math.max(minimumWidth, Math.min(baseWidth, (block.width / maximumWidth) * baseWidth))
    const centerOffset = ((block.x + block.width / 2 - baseCenter) / maximumWidth) * baseWidth * 0.9
    const left = Math.max(0, Math.min(containerWidth - width, (containerWidth - width) / 2 + centerOffset))
    const sampleStart = floor === 0 ? 0 : sampledIndexes[floor - 1] + 1
    const lit = Array.from(perfectLevels).some((level) => level - 1 >= sampleStart && level - 1 <= blockIndex)

    return {
      level: blockIndex + 1,
      width,
      left,
      bottom: floor * (floorHeight + gap),
      lit,
    }
  })
}

function TowerGlyph({ entry, detail = false }: { entry: LeaderboardEntry; detail?: boolean }) {
  const floors = entry.tower_profile ? profileTowerFloors(entry.tower_profile, detail) : null
  const visibleFloors = floors ?? fallbackTowerFloors(entry, detail)
  const rankTone = Math.min(entry.rank, 4)

  return (
    <span className={`tower-glyph rank-${rankTone}${entry.is_you ? ' is-you' : ''}${detail ? ' is-detail' : ''}`} aria-hidden="true">
      {visibleFloors.map((floor) => (
        <span
          key={floor.level}
          className={`tower-floor${floor.lit ? ' is-lit' : ''}`}
          style={{ width: floor.width, left: floor.left, bottom: floor.bottom }}
        >
          <span className="tower-lens" />
        </span>
      ))}
    </span>
  )
}

function ScoreRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: LeaderboardEntry
  expanded: boolean
  onToggle: () => void
}) {
  const detailId = `leaderboard-score-${entry.rank}`

  return (
    <li className={`leaderboard-row rank-${Math.min(entry.rank, 4)}${entry.is_you ? ' is-you' : ''}${expanded ? ' is-expanded' : ''}`}>
      <button
        className="leaderboard-row-button"
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={detailId}
      >
        <span className="leaderboard-rank">{entry.rank}</span>
        <TowerGlyph entry={entry} />
        <span className="leaderboard-player">
          <strong>{entry.display_name}</strong>
          <small>{entry.is_you ? 'You · ' : ''}{entry.perfects} perfect</small>
        </span>
        <span className="leaderboard-score">
          <strong>{entry.height}</strong>
        </span>
      </button>
      {expanded && (
        <div id={detailId} className="leaderboard-row-detail">
          <div className="leaderboard-row-stats">
            <span><small>Height</small><strong>{entry.height}</strong></span>
            <span><small>Perfect landings</small><strong>{entry.perfects}</strong></span>
          </div>
          <TowerGlyph entry={entry} detail />
        </div>
      )}
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
  const [expandedRank, setExpandedRank] = useState<number | null>(null)
  // The server sends the top ten, plus the player's own row when they rank lower.
  const topTen = entries.filter((entry) => entry.rank <= 10)
  const personalEntry = entries.find((entry) => entry.is_you && entry.rank > 10)

  useEffect(() => {
    if (expandedRank === null) return
    const timer = window.setTimeout(() => setExpandedRank(null), 2800)
    return () => window.clearTimeout(timer)
  }, [expandedRank])

  const toggleRow = (rank: number) => {
    setExpandedRank((current) => current === rank ? null : rank)
  }

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
          {topTen.length > 0 && (
            <ol className="leaderboard-list" aria-label="Top ten scores">
              {topTen.map((entry) => (
                <ScoreRow
                  key={entry.rank}
                  entry={entry}
                  expanded={expandedRank === entry.rank}
                  onToggle={() => toggleRow(entry.rank)}
                />
              ))}
            </ol>
          )}
          {personalEntry && (
            <div className="personal-rank">
              {personalEntry.rank > 11 && (
                <p className="leaderboard-between">{personalEntry.rank - 11} {personalEntry.rank === 12 ? 'climber' : 'climbers'} between</p>
              )}
              <ol className="leaderboard-list" aria-label="Your best rank">
                <ScoreRow
                  entry={personalEntry}
                  expanded={expandedRank === personalEntry.rank}
                  onToggle={() => toggleRow(personalEntry.rank)}
                />
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
                >Edit name</button>
              </div>
            )
          ) : (
            <p className="leaderboard-message">Anonymous player sign-in is needed for ranked scores.</p>
          )}
          <p className="leaderboard-footnote">Same course for everyone. Resets daily at {resetTime} (00:00 UTC).</p>
        </div>
      </aside>
    </>
  )
})
