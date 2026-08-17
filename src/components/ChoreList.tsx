/** Chore list — port of components/chores/chore_list.jsx. */

import { useState } from 'react'
import type { Assignment, Chore, Priority, User } from '../api'
import ChoreDetails from './ChoreDetails'

const DUE_STATE_ICON: Record<string, string> = {
  'Past due': '🚨',
  'Due soon': '⏰',
  Upcoming: '🗓️',
  Completed: '✅',
}

const PRIORITY_ICON: Record<string, string> = {
  high: '🔴',
  medium: '🟠',
  normal: '🟠',
  low: '🟢',
}

type Props = {
  assignments: Assignment[]
  chores: Chore[]
  users: User[]
  onAssign: (choreId: number, userId: number, dueDate: string, priority: Priority) => void
  onComplete: (id: number) => void
  onReopen: (id: number) => void
  onSave: (id: number, fields: { dueDate: string; priority: Priority; userId: number }) => void
  onDelete: (id: number) => void
  onMarkInProgress: (id: number) => void
}

/** The '+' popover: assign a chore, with the due date and priority prefilled. */
function AssignForm({
  chore,
  users,
  onAssign,
}: {
  chore: Chore
  users: User[]
  onAssign: Props['onAssign']
}) {
  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState(users[0]?.id ?? 0)
  const [dueDate, setDueDate] = useState(chore.scheduledDue)
  const [priority, setPriority] = useState<Priority>(chore.suggestedPriority)

  if (!open) {
    return (
      <button type="button" className="assign-toggle" onClick={() => setOpen(true)} title="Assign">
        ➕
      </button>
    )
  }

  return (
    <div className="assign-form">
      <select value={userId} onChange={(event) => setUserId(Number(event.target.value))}>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </select>
      <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
      <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
        <option value="High">High</option>
        <option value="Medium">Medium</option>
        <option value="Low">Low</option>
      </select>
      <div className="button-row">
        <button
          type="button"
          className="primary"
          onClick={() => {
            onAssign(chore.id, userId, dueDate, priority)
            setOpen(false)
          }}
        >
          Assign
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function ChoreList({
  assignments,
  chores,
  users,
  onAssign,
  onComplete,
  onReopen,
  onSave,
  onDelete,
  onMarkInProgress,
}: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const unassigned = chores.filter((chore) => chore.openAssignments === 0)

  return (
    <>
      {unassigned.length > 0 && users.length > 0 ? (
        <section className="panel-card">
          <h2>Available chores</h2>
          <p className="muted">Nobody is on these yet. Use ➕ to assign one.</p>

          {unassigned.map((chore) => (
            <div key={chore.id} className="list-row">
              <div className="list-details">
                <strong>{chore.title}</strong>
                <span>
                  {chore.frequency} ·{' '}
                  {chore.lastCompleted ? `last done ${chore.lastCompleted.slice(0, 10)}` : 'never done'}
                </span>
                <span>
                  {DUE_STATE_ICON[chore.dueState]} due {chore.scheduledDue} ·{' '}
                  {PRIORITY_ICON[chore.suggestedPriority.toLowerCase()]} {chore.suggestedPriority}
                </span>
              </div>
              <AssignForm chore={chore} users={users} onAssign={onAssign} />
            </div>
          ))}
        </section>
      ) : null}

      <section className="panel-card">
        <h2>Chore list</h2>
        {assignments.length === 0 ? (
          <p className="muted">No chores match these filters.</p>
        ) : (
          assignments.map((item) => {
            const done = item.status === 'Done'
            const expanded = expandedId === item.id

            return (
              <div key={item.id} className={`list-row assignment ${done ? 'done' : ''}`}>
                <div className="assignment-head">
                  <div className="list-details">
                    <strong>
                      {DUE_STATE_ICON[item.dueState]} {done ? <s>{item.choreTitle}</s> : item.choreTitle}
                    </strong>
                    <span>
                      👤 {item.userName} · {item.frequency}
                    </span>
                    <span>
                      📅 {item.dueDate} · {item.dueState} ·{' '}
                      {PRIORITY_ICON[item.priority.toLowerCase()] ?? '⚪'} {item.priority}
                      {done ? ` · +${item.pointsAwarded} pts` : ` · worth ${item.pointsIfCompletedToday} pts`}
                    </span>
                  </div>

                  <div className="button-row">
                    {done ? (
                      <button type="button" onClick={() => onReopen(item.id)}>
                        Reopen
                      </button>
                    ) : (
                      <button type="button" className="primary" onClick={() => onComplete(item.id)}>
                        Done
                      </button>
                    )}
                    <button type="button" onClick={() => setExpandedId(expanded ? null : item.id)}>
                      {expanded ? 'Hide' : 'Details'}
                    </button>
                  </div>
                </div>

                {expanded ? (
                  <ChoreDetails
                    assignment={item}
                    users={users}
                    onSave={(fields) => onSave(item.id, fields)}
                    onDelete={() => {
                      onDelete(item.id)
                      setExpandedId(null)
                    }}
                    onMarkInProgress={() => onMarkInProgress(item.id)}
                  />
                ) : null}
              </div>
            )
          })
        )}
      </section>
    </>
  )
}
