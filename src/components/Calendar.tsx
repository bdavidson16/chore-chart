/** Month grid of chores by due date — port of components/calendar/calendar.jsx. */

import { useMemo, useState } from 'react'
import type { Assignment, Chore, Priority, User } from '../api'

const DUE_STATE_CLASS: Record<string, string> = {
  'Past due': 'past-due',
  'Due soon': 'due-soon',
  Upcoming: 'upcoming',
  Completed: 'completed',
}

function toDateKey(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** The month grid, padded out to whole Monday-start weeks. */
function monthCells(viewMonth: Date) {
  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: Array<{ date: Date; inMonth: boolean }> = []
  for (let index = 0; index < leadingBlanks; index += 1) {
    cells.push({ date: new Date(year, month, index - leadingBlanks + 1), inMonth: false })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(year, month, day), inMonth: true })
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date
    cells.push({
      date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
      inMonth: false,
    })
  }
  return cells
}

type Props = {
  assignments: Assignment[]
  chores: Chore[]
  users: User[]
  onCreate: (body: { choreId: number; userId: number; dueDate: string; priority: Priority }) => void
  onComplete: (id: number) => void
  onReopen: (id: number) => void
  onDelete: (id: number) => void
}

export default function Calendar({
  assignments,
  chores,
  users,
  onCreate,
  onComplete,
  onReopen,
  onDelete,
}: Props) {
  const today = toDateKey(new Date())
  const [viewMonth, setViewMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(today)
  const [choreId, setChoreId] = useState<number>(chores[0]?.id ?? 0)
  const [userId, setUserId] = useState<number>(users[0]?.id ?? 0)
  const [priority, setPriority] = useState<Priority>('Medium')

  const cells = useMemo(() => monthCells(viewMonth), [viewMonth])

  const byDay = useMemo(() => {
    const map = new Map<string, Assignment[]>()
    for (const item of assignments) {
      const bucket = map.get(item.dueDate)
      if (bucket) bucket.push(item)
      else map.set(item.dueDate, [item])
    }
    return map
  }, [assignments])

  const selectedAssignments = byDay.get(selectedDate) ?? []
  const shiftMonth = (delta: number) =>
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1))

  return (
    <div className="calendar-layout">
      <section className="panel-card calendar-card">
        <div className="calendar-header">
          <button type="button" onClick={() => shiftMonth(-1)}>
            ← Prev
          </button>
          <h2>{viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
          <div className="button-row">
            <button type="button" onClick={() => setViewMonth(new Date())}>
              Today
            </button>
            <button type="button" onClick={() => shiftMonth(1)}>
              Next →
            </button>
          </div>
        </div>

        <div className="calendar-grid">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="calendar-day-label">
              {day}
            </div>
          ))}

          {cells.map((cell) => {
            const key = toDateKey(cell.date)
            const entries = byDay.get(key) ?? []
            const classes = [
              'calendar-cell',
              cell.inMonth ? '' : 'outside',
              key === selectedDate ? 'selected' : '',
              key === today ? 'today' : '',
            ]

            return (
              <button
                key={key}
                type="button"
                className={classes.join(' ')}
                onClick={() => setSelectedDate(key)}
              >
                <span className="calendar-date">{cell.date.getDate()}</span>
                {entries.slice(0, 2).map((item) => (
                  <span key={item.id} className={`calendar-chip ${DUE_STATE_CLASS[item.dueState]}`}>
                    {item.choreTitle}
                  </span>
                ))}
                {entries.length > 2 ? <small>+{entries.length - 2} more</small> : null}
              </button>
            )
          })}
        </div>

        <p className="calendar-legend">
          <span className="past-due">● past due</span> <span className="due-soon">● due soon</span>{' '}
          <span className="upcoming">● upcoming</span> <span className="completed">● completed</span>
        </p>
      </section>

      <section className="panel-card">
        <h2>Due on {selectedDate}</h2>

        {selectedAssignments.length === 0 ? (
          <p className="muted">No chores scheduled for this day.</p>
        ) : (
          selectedAssignments.map((item) => (
            <div key={item.id} className="list-row">
              <div className="list-details">
                <strong>{item.choreTitle}</strong>
                <span>
                  👤 {item.userName} · {item.priority} priority · {item.frequency}
                </span>
                <span className={DUE_STATE_CLASS[item.dueState]}>{item.dueState}</span>
              </div>
              <div className="button-row">
                {item.status === 'Done' ? (
                  <button type="button" onClick={() => onReopen(item.id)}>
                    Reopen
                  </button>
                ) : (
                  <button type="button" className="primary" onClick={() => onComplete(item.id)}>
                    Done
                  </button>
                )}
                <button type="button" className="danger" onClick={() => onDelete(item.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}

        <div className="calendar-form">
          <h3>Add a chore to this day</h3>
          <label>
            Chore
            <select value={choreId} onChange={(event) => setChoreId(Number(event.target.value))}>
              {chores.map((chore) => (
                <option key={chore.id} value={chore.id}>
                  {chore.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Assign to
            <select value={userId} onChange={(event) => setUserId(Number(event.target.value))}>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </label>
          <button
            type="button"
            className="primary"
            disabled={choreId === 0 || userId === 0}
            onClick={() => onCreate({ choreId, userId, dueDate: selectedDate, priority })}
          >
            Add for {selectedDate}
          </button>
        </div>
      </section>
    </div>
  )
}
