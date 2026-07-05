import { useEffect, useMemo, useState } from 'react'
import './App.css'

type TabKey = 'settings' | 'lists' | 'calendar'
type AssignmentStatus = 'Pending' | 'In Progress' | 'Done'
type AssignmentPriority = 'Low' | 'Normal' | 'High'

type User = {
  id: number
  name: string
  email?: string
}

type Chore = {
  id: number
  title: string
  description?: string
  frequency: string
}

type Assignment = {
  id: number
  choreId: number
  userId: number
  choreTitle: string
  userName: string
  dueDate: string
  status: AssignmentStatus
  priority: AssignmentPriority
}

function toInputDate(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0]
}

function formatDateLabel(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getCalendarCells(viewMonth: Date) {
  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const firstDay = (firstOfMonth.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<{ date: Date; inMonth: boolean }> = []

  for (let index = 0; index < firstDay; index += 1) {
    const date = new Date(year, month, index - firstDay + 1)
    cells.push({ date, inMonth: false })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(year, month, day), inMonth: true })
  }

  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]?.date ?? new Date(year, month, 1)
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false })
  }

  return cells
}

function App() {
  const today = toInputDate(new Date())
  const [activeTab, setActiveTab] = useState<TabKey>('settings')
  const [users] = useState<User[]>(() => {
    const saved = window.localStorage.getItem('chore-chart-users')
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Ava', email: 'ava@example.com' },
    ]
  })
  const [chores, setChores] = useState<Chore[]>(() => {
    const saved = window.localStorage.getItem('chore-chart-chores')
    return saved ? JSON.parse(saved) : [
      { id: 1, title: 'Take out trash', description: 'Empty bins and replace liners.', frequency: 'Weekly' },
      { id: 2, title: 'Mop kitchen floor', description: 'Focus on the tile near the sink.', frequency: 'Weekly' },
    ]
  })
  const [assignments, setAssignments] = useState<Assignment[]>(() => {
    const saved = window.localStorage.getItem('chore-chart-assignments')
    return saved ? JSON.parse(saved) : [
      {
        id: 1,
        choreId: 1,
        userId: 1,
        choreTitle: 'Take out trash',
        userName: 'Ava',
        dueDate: today,
        status: 'Pending',
        priority: 'High',
      },
      {
        id: 2,
        choreId: 2,
        userId: 1,
        choreTitle: 'Mop kitchen floor',
        userName: 'Ava',
        dueDate: today,
        status: 'In Progress',
        priority: 'Normal',
      },
    ]
  })

  const [choreTitle, setChoreTitle] = useState('')
  const [choreDescription, setChoreDescription] = useState('')
  const [frequency, setFrequency] = useState('Weekly')
  const [editingChoreId, setEditingChoreId] = useState<number | null>(null)
  const [editingChoreDraft, setEditingChoreDraft] = useState({ title: '', description: '', frequency: 'Weekly' })
  const [selectedChoreId, setSelectedChoreId] = useState<number | ''>(chores[0]?.id ?? '')
  const [selectedUserId, setSelectedUserId] = useState<number | ''>(users[0]?.id ?? '')
  const [assignmentDate, setAssignmentDate] = useState(today)
  const [assignmentStatus, setAssignmentStatus] = useState<AssignmentStatus>('Pending')
  const [assignmentPriority, setAssignmentPriority] = useState<AssignmentPriority>('Normal')
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(today)
  const [editingAssignmentId, setEditingAssignmentId] = useState<number | null>(null)
  const [editingAssignmentDraft, setEditingAssignmentDraft] = useState({
    choreId: 0,
    userId: 0,
    dueDate: today,
    status: 'Pending' as AssignmentStatus,
    priority: 'Normal' as AssignmentPriority,
  })
  const [notification, setNotification] = useState<{ message: string; tone: 'success' | 'info' } | null>(null)

  const pendingAssignments = useMemo(() => assignments.filter((item) => item.status !== 'Done'), [assignments])
  const doneAssignments = useMemo(() => assignments.filter((item) => item.status === 'Done'), [assignments])
  const notAssignedChores = useMemo(
    () => chores.filter((chore) => !assignments.some((item) => item.choreId === chore.id)),
    [assignments, chores],
  )
  const selectedDateAssignments = useMemo(
    () => assignments.filter((item) => item.dueDate === selectedDate),
    [assignments, selectedDate],
  )
  const calendarCells = useMemo(() => getCalendarCells(calendarMonth), [calendarMonth])

  useEffect(() => {
    window.localStorage.setItem('chore-chart-users', JSON.stringify(users))
  }, [users])

  useEffect(() => {
    window.localStorage.setItem('chore-chart-chores', JSON.stringify(chores))
  }, [chores])

  useEffect(() => {
    window.localStorage.setItem('chore-chart-assignments', JSON.stringify(assignments))
  }, [assignments])

  useEffect(() => {
    if (!notification) return
    const timer = window.setTimeout(() => setNotification(null), 2400)
    return () => window.clearTimeout(timer)
  }, [notification])

  const pushNotification = (message: string, tone: 'success' | 'info' = 'success') => {
    setNotification({ message, tone })
  }

  const handleAddChore = () => {
    if (!choreTitle.trim()) return
    const nextChore: Chore = {
      id: Date.now(),
      title: choreTitle.trim(),
      description: choreDescription.trim(),
      frequency,
    }
    setChores((current) => [...current, nextChore])
    setSelectedChoreId(nextChore.id)
    setChoreTitle('')
    setChoreDescription('')
    setFrequency('Weekly')
    pushNotification('Chore added')
  }

  const handleStartChoreEdit = (chore: Chore) => {
    setEditingChoreId(chore.id)
    setEditingChoreDraft({
      title: chore.title,
      description: chore.description ?? '',
      frequency: chore.frequency,
    })
  }

  const handleSaveChoreEdit = (choreId: number) => {
    const title = editingChoreDraft.title.trim()
    if (!title) return

    setChores((current) =>
      current.map((chore) =>
        chore.id === choreId
          ? {
              ...chore,
              title,
              description: editingChoreDraft.description.trim(),
              frequency: editingChoreDraft.frequency,
            }
          : chore,
      ),
    )
    setAssignments((current) =>
      current.map((assignment) =>
        assignment.choreId === choreId ? { ...assignment, choreTitle: title } : assignment,
      ),
    )
    setEditingChoreId(null)
    pushNotification('Chore updated')
  }

  const handleCancelChoreEdit = () => {
    setEditingChoreId(null)
    setEditingChoreDraft({ title: '', description: '', frequency: 'Weekly' })
  }

  const handleDeleteChore = (choreId: number) => {
    setChores((current) => current.filter((chore) => chore.id !== choreId))
    setAssignments((current) => current.filter((assignment) => assignment.choreId !== choreId))
    pushNotification('Chore deleted')
  }

  const handleStartAssignmentEdit = (assignment: Assignment) => {
    setEditingAssignmentId(assignment.id)
    setEditingAssignmentDraft({
      choreId: assignment.choreId,
      userId: assignment.userId,
      dueDate: assignment.dueDate,
      status: assignment.status,
      priority: assignment.priority,
    })
  }

  const handleSaveAssignmentEdit = (assignmentId: number) => {
    const chore = chores.find((item) => item.id === editingAssignmentDraft.choreId)
    const user = users.find((item) => item.id === editingAssignmentDraft.userId)
    if (!chore || !user) return

    setAssignments((current) =>
      current.map((assignment) =>
        assignment.id === assignmentId
          ? {
              ...assignment,
              choreId: chore.id,
              userId: user.id,
              choreTitle: chore.title,
              userName: user.name,
              dueDate: editingAssignmentDraft.dueDate,
              status: editingAssignmentDraft.status,
              priority: editingAssignmentDraft.priority,
            }
          : assignment,
      ),
    )
    setEditingAssignmentId(null)
    pushNotification('Assignment updated')
  }

  const handleDeleteAssignment = (assignmentId: number) => {
    setAssignments((current) => current.filter((assignment) => assignment.id !== assignmentId))
    pushNotification('Assignment deleted')
  }

  const handleAddAssignment = () => {
    if (selectedChoreId === '' || selectedUserId === '') return

    const chore = chores.find((item) => item.id === selectedChoreId)
    const user = users.find((item) => item.id === selectedUserId)
    if (!chore || !user) return

    const nextAssignment: Assignment = {
      id: Date.now(),
      choreId: chore.id,
      userId: user.id,
      choreTitle: chore.title,
      userName: user.name,
      dueDate: assignmentDate,
      status: assignmentStatus,
      priority: assignmentPriority,
    }

    setAssignments((current) => [nextAssignment, ...current])
    setAssignmentDate(assignmentDate)
    setAssignmentStatus('Pending')
    setAssignmentPriority('Normal')
    setSelectedDate(assignmentDate)
    pushNotification('Assignment saved')
  }

  const handleSelectCalendarDate = (date: string) => {
    setSelectedDate(date)
    setAssignmentDate(date)
  }

  return (
    <div className="app-shell">
      <header className="page-header">
        <h1>🧹 Chore Chart</h1>
      </header>

      {notification ? (
        <div className={`toast ${notification.tone}`}>{notification.message}</div>
      ) : null}

      <nav className="tabs" aria-label="Chore sections">
        {[
          ['lists', 'Chore lists'],
          ['calendar', 'Calendar'],
          ['settings', 'Settings']
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`tab-button ${activeTab === key ? 'active' : ''}`}
            onClick={() => setActiveTab(key as TabKey)}
          >
            {label}
          </button>
        ))}
      </nav>

      {activeTab === 'lists' && (
        <section className="panel">
          <div className="panel-grid three-up">
            <div className="panel-card">
              <h2>Pending</h2>
              {pendingAssignments.length === 0 ? (
                <p className="muted">No pending chores.</p>
              ) : (
                pendingAssignments.map((item) => (
                  <div key={item.id} className="list-row stacked">
                    <div className="list-details">
                      <strong>{item.choreTitle}</strong>
                      <span>{item.userName}</span>
                      <span>{item.dueDate}</span>
                    </div>
                    <div className="button-row">
                      <button type="button" onClick={() => handleStartAssignmentEdit(item)}>Edit</button>
                      <button type="button" onClick={() => handleDeleteAssignment(item.id)}>Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="panel-card">
              <h2>Done</h2>
              {doneAssignments.length === 0 ? (
                <p className="muted">No completed chores yet.</p>
              ) : (
                doneAssignments.map((item) => (
                  <div key={item.id} className="list-row stacked">
                    <div className="list-details">
                      <strong>{item.choreTitle}</strong>
                      <span>{item.userName}</span>
                      <span>{item.dueDate}</span>
                    </div>
                    <div className="button-row">
                      <button type="button" onClick={() => handleStartAssignmentEdit(item)}>Edit</button>
                      <button type="button" onClick={() => handleDeleteAssignment(item.id)}>Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="panel-card">
              <h2>Not assigned</h2>
              {notAssignedChores.length === 0 ? (
                <p className="muted">Every chore is assigned.</p>
              ) : (
                notAssignedChores.map((chore) => (
                  <div key={chore.id} className="list-row stacked">
                    <strong>{chore.title}</strong>
                    <span>{chore.frequency}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'calendar' && (
        <section className="panel calendar-layout">
          <div className="panel-card calendar-card">
            <div className="calendar-header">
              <button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>
                ← Previous
              </button>
              <h2>{calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
              <button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>
                Next →
              </button>
            </div>
            <div className="calendar-grid" role="grid">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div key={day} className="calendar-day-label">
                  {day}
                </div>
              ))}
              {calendarCells.map((cell, index) => {
                const dateValue = toInputDate(cell.date)
                const hasAssignments = assignments.some((item) => item.dueDate === dateValue)
                const isSelected = dateValue === selectedDate
                return (
                  <button
                    key={`${dateValue}-${index}`}
                    type="button"
                    className={`calendar-cell ${cell.inMonth ? '' : 'muted'} ${isSelected ? 'selected' : ''}`}
                    onDoubleClick={() => handleSelectCalendarDate(dateValue)}
                    onClick={() => handleSelectCalendarDate(dateValue)}
                  >
                    <span>{cell.date.getDate()}</span>
                    {hasAssignments ? <small>{assignments.filter((item) => item.dueDate === dateValue).length} chore(s)</small> : null}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="panel-card">
            <h2>Due on {formatDateLabel(selectedDate)}</h2>
            {selectedDateAssignments.length === 0 ? (
              <p className="muted">No chores scheduled for this day.</p>
            ) : (
              selectedDateAssignments.map((item) => (
                <div key={item.id} className="list-row stacked">
                  <div className="list-details">
                    <strong>{item.choreTitle}</strong>
                    <span>{item.userName}</span>
                    <span>{item.status}</span>
                  </div>
                  <div className="button-row">
                    <button type="button" onClick={() => handleStartAssignmentEdit(item)}>Edit</button>
                    <button type="button" onClick={() => handleDeleteAssignment(item.id)}>Delete</button>
                  </div>
                </div>
              ))
            )}

            <div className="calendar-form">
              <label>
                Chore
                <select
                  value={selectedChoreId}
                  onChange={(event) => setSelectedChoreId(event.target.value === '' ? '' : Number(event.target.value))}
                >
                  {chores.map((chore) => (
                    <option key={chore.id} value={chore.id}>
                      {chore.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Assign to
                <select
                  value={selectedUserId}
                  onChange={(event) => setSelectedUserId(event.target.value === '' ? '' : Number(event.target.value))}
                >
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Due date
                <input type="date" value={assignmentDate} onChange={(event) => setAssignmentDate(event.target.value)} />
              </label>
              <label>
                Status
                <select value={assignmentStatus} onChange={(event) => setAssignmentStatus(event.target.value as AssignmentStatus)}>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Done">Done</option>
                </select>
              </label>
              <button type="button" className="primary" onClick={handleAddAssignment}>Add chore for this date</button>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'settings' && (
        <section className="panel">
            <div className="panel-card">
              <h2>Add chore</h2>
              <label>
                Chore title
                <input value={choreTitle} onChange={(event) => setChoreTitle(event.target.value)} placeholder="Enter a chore" />
              </label>
              <label>
                Description / instructions
                <textarea value={choreDescription} onChange={(event) => setChoreDescription(event.target.value)} rows={4} />
              </label>
              <label>
                Frequency
                <select value={frequency} onChange={(event) => setFrequency(event.target.value)}>
                  <option value="One-time">One-time</option>
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Biweekly">Biweekly</option>
                  <option value="Monthly">Monthly</option>
                </select>
              </label>
              <button type="button" onClick={handleAddChore}>Add chore</button>
              <div className="list-card">
                {chores.map((chore) => (
                  <div key={chore.id} className="list-row">
                    {editingChoreId === chore.id ? (
                      <div className="inline-editor">
                        <input
                          value={editingChoreDraft.title}
                          onChange={(event) => setEditingChoreDraft((current) => ({ ...current, title: event.target.value }))}
                          placeholder="Chore title"
                        />
                        <textarea
                          value={editingChoreDraft.description}
                          onChange={(event) => setEditingChoreDraft((current) => ({ ...current, description: event.target.value }))}
                          rows={3}
                        />
                        <select
                          value={editingChoreDraft.frequency}
                          onChange={(event) => setEditingChoreDraft((current) => ({ ...current, frequency: event.target.value }))}
                        >
                          <option value="One-time">One-time</option>
                          <option value="Daily">Daily</option>
                          <option value="Weekly">Weekly</option>
                          <option value="Biweekly">Biweekly</option>
                          <option value="Monthly">Monthly</option>
                        </select>
                        <div className="button-row">
                          <button type="button" className="primary" onClick={() => handleSaveChoreEdit(chore.id)}>Save</button>
                          <button type="button" onClick={handleCancelChoreEdit}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="list-details">
                          <strong>{chore.title}</strong>
                          <span>{chore.frequency}</span>
                        </div>
                        <div className="button-row">
                          <button type="button" onClick={() => handleStartChoreEdit(chore)}>Edit</button>
                          <button type="button" onClick={() => handleDeleteChore(chore.id)}>Delete</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

          <div className="panel-card">
            <h2>Add or update an assignment</h2>
            <div className="form-grid">
              <label>
                Chore
                <select
                  value={editingAssignmentId === null ? selectedChoreId : editingAssignmentDraft.choreId}
                  onChange={(event) => {
                    const nextValue = event.target.value === '' ? '' : Number(event.target.value)
                    if (editingAssignmentId === null) {
                      setSelectedChoreId(nextValue)
                    } else {
                      setEditingAssignmentDraft((current) => ({ ...current, choreId: Number(nextValue) }))
                    }
                  }}
                >
                  {chores.map((chore) => (
                    <option key={chore.id} value={chore.id}>
                      {chore.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Assign to
                <select
                  value={editingAssignmentId === null ? selectedUserId : editingAssignmentDraft.userId}
                  onChange={(event) => {
                    const nextValue = event.target.value === '' ? '' : Number(event.target.value)
                    if (editingAssignmentId === null) {
                      setSelectedUserId(nextValue)
                    } else {
                      setEditingAssignmentDraft((current) => ({ ...current, userId: Number(nextValue) }))
                    }
                  }}
                >
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Due date
                <input
                  type="date"
                  value={editingAssignmentId === null ? assignmentDate : editingAssignmentDraft.dueDate}
                  onChange={(event) => {
                    const nextValue = event.target.value
                    if (editingAssignmentId === null) {
                      setAssignmentDate(nextValue)
                    } else {
                      setEditingAssignmentDraft((current) => ({ ...current, dueDate: nextValue }))
                    }
                  }}
                />
              </label>
              <label>
                Status
                <select
                  value={editingAssignmentId === null ? assignmentStatus : editingAssignmentDraft.status}
                  onChange={(event) => {
                    const nextValue = event.target.value as AssignmentStatus
                    if (editingAssignmentId === null) {
                      setAssignmentStatus(nextValue)
                    } else {
                      setEditingAssignmentDraft((current) => ({ ...current, status: nextValue }))
                    }
                  }}
                >
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Done">Done</option>
                </select>
              </label>
              <label>
                Priority
                <select
                  value={editingAssignmentId === null ? assignmentPriority : editingAssignmentDraft.priority}
                  onChange={(event) => {
                    const nextValue = event.target.value as AssignmentPriority
                    if (editingAssignmentId === null) {
                      setAssignmentPriority(nextValue)
                    } else {
                      setEditingAssignmentDraft((current) => ({ ...current, priority: nextValue }))
                    }
                  }}
                >
                  <option value="Low">Low</option>
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                </select>
              </label>
            </div>
            {editingAssignmentId === null ? (
              <button type="button" className="primary" onClick={handleAddAssignment}>Save assignment</button>
            ) : (
              <div className="button-row">
                <button type="button" className="primary" onClick={() => handleSaveAssignmentEdit(editingAssignmentId)}>Save changes</button>
                <button type="button" onClick={() => setEditingAssignmentId(null)}>Cancel</button>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

export default App
