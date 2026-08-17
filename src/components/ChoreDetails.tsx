/** Expanded detail panel for one assignment — port of components/chores/chore_details.jsx. */

import { useState } from 'react'
import type { Assignment, Priority, User } from '../api'

const PRIORITIES: Priority[] = ['High', 'Medium', 'Low']

/**
 * Older rows carry priorities the picker does not offer ('Normal'). Keeping the
 * stored value in the list stops the select falling back to its first option and
 * silently rewriting the priority on save.
 */
function priorityOptions(current: Priority): Priority[] {
  return PRIORITIES.includes(current) ? PRIORITIES : [...PRIORITIES, current]
}

type Props = {
  assignment: Assignment
  users: User[]
  onSave: (fields: { dueDate: string; priority: Priority; userId: number }) => void
  onDelete: () => void
  onMarkInProgress: () => void
}

export default function ChoreDetails({
  assignment,
  users,
  onSave,
  onDelete,
  onMarkInProgress,
}: Props) {
  const [dueDate, setDueDate] = useState(assignment.dueDate)
  const [priority, setPriority] = useState<Priority>(assignment.priority)
  const [userId, setUserId] = useState(assignment.userId)

  const done = assignment.status === 'Done'
  const offSchedule = !done && assignment.dueDate !== assignment.scheduledDue

  return (
    <div className="chore-details">
      <div className="detail-grid">
        <dl>
          <dt>Description</dt>
          <dd>{assignment.description || '—'}</dd>
          <dt>Frequency</dt>
          <dd>{assignment.frequency}</dd>
          <dt>Assigned to</dt>
          <dd>
            {assignment.userName} ({assignment.email ?? 'no email'})
          </dd>
          <dt>Status</dt>
          <dd>{assignment.status}</dd>
        </dl>
        <dl>
          {/* The previous time this chore was done, not counting this assignment. */}
          <dt>Previously done</dt>
          <dd>{assignment.choreLastCompleted?.slice(0, 16) ?? 'Never'}</dd>
          <dt>Scheduled due</dt>
          <dd>
            {assignment.scheduledDue}
            {offSchedule ? ' (this one is set differently)' : ''}
          </dd>
          {done ? (
            <>
              <dt>Points earned</dt>
              <dd>{assignment.pointsAwarded}</dd>
              <dt>Completed at</dt>
              <dd>{assignment.completedAt?.slice(0, 16) ?? '—'}</dd>
            </>
          ) : (
            <>
              <dt>Worth</dt>
              <dd>{assignment.pointsIfCompletedToday} points if completed today</dd>
              <dt>Latest update</dt>
              <dd>{assignment.lastUpdate ?? '—'}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="detail-editor">
        <label>
          Due date
          <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </label>
        <label>
          Priority
          <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
            {priorityOptions(assignment.priority).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          Assigned to
          <select value={userId} onChange={(event) => setUserId(Number(event.target.value))}>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="button-row">
        <button type="button" className="primary" onClick={() => onSave({ dueDate, priority, userId })}>
          Save
        </button>
        {offSchedule ? (
          <button
            type="button"
            onClick={() => onSave({ dueDate: assignment.scheduledDue, priority, userId })}
          >
            Use schedule ({assignment.scheduledDue})
          </button>
        ) : null}
        {!done ? (
          <button type="button" onClick={onMarkInProgress}>
            Mark in progress
          </button>
        ) : null}
        <button type="button" className="danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  )
}
