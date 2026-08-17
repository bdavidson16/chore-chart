/** Point bars — port of components/points/PointHelpers.jsx. */

import { useEffect, useRef, useState } from 'react'
import type { UserProgress } from '../api'

// PointHelpers sets the bar width straight from the point total (`${points}%`),
// so 100 points is a full bar.
const BAR_FULL_POINTS = 100

function barWidth(points: number) {
  return Math.max(0, Math.min(points, BAR_FULL_POINTS))
}

/**
 * addPointsAnimation / removePointsAnimation: the bar flashes green when points
 * arrive and red when they are taken back, then settles to its normal colour.
 */
function useDelta(points: number) {
  const previous = useRef(points)
  const [delta, setDelta] = useState(0)

  useEffect(() => {
    if (previous.current === points) return

    setDelta(points - previous.current)
    previous.current = points
    const timer = window.setTimeout(() => setDelta(0), 900)
    return () => window.clearTimeout(timer)
  }, [points])

  return delta
}

function UserBar({ user }: { user: UserProgress }) {
  const delta = useDelta(user.points)
  const flash = delta > 0 ? 'up' : delta < 0 ? 'down' : ''

  const goal = user.nextTier
    ? `${user.completed}/${user.nextTier.threshold} chores → ${user.nextTier.title}`
    : `${user.completed} chores — all rewards earned 🏆`

  return (
    <div className="point-row">
      <div className="point-name">
        {user.name}
        {delta !== 0 ? (
          <span className={`point-delta ${flash}`}>
            {delta > 0 ? '+' : ''}
            {delta}
          </span>
        ) : null}
        <span className="point-tier">{user.tier ?? 'No reward yet'}</span>
      </div>
      <div>
        <div className="point-track">
          <div className={`point-fill ${flash}`} style={{ width: `${barWidth(user.points)}%` }}>
            {user.points} points
          </div>
        </div>
        <span className="point-goal">{goal}</span>
      </div>
    </div>
  )
}

export default function PointBar({ progress }: { progress: UserProgress[] }) {
  if (progress.length === 0) return null

  return (
    <section className="point-card">
      <h2>🏅 Points</h2>
      <div className="point-grid">
        {progress.map((user) => (
          <UserBar key={user.id} user={user} />
        ))}
      </div>
    </section>
  )
}
