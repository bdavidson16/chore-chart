import { useCallback, useEffect, useState } from 'react'
import './App.css'
import {
  api,
  type Assignment,
  type Chore,
  type Notification,
  type PointsEntry,
  type User,
  type UserProgress,
} from './api'
import Calendar from './components/Calendar'
import ChoreList from './components/ChoreList'
import NotificationBell from './components/NotificationBell'
import PointBar from './components/PointBar'
import Settings from './components/Settings'

type TabKey = 'chores' | 'calendar' | 'settings'

const TABS: Array<[TabKey, string]> = [
  ['chores', '🧽 Chores'],
  ['calendar', '📅 Calendar'],
  ['settings', '⚙️ Settings'],
]

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('chores')

  const [users, setUsers] = useState<User[]>([])
  const [chores, setChores] = useState<Chore[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [progress, setProgress] = useState<UserProgress[]>([])
  const [history, setHistory] = useState<PointsEntry[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)

  const [status, setStatus] = useState('All')
  const [userFilter, setUserFilter] = useState(0)
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('Priority')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'info' | 'error' } | null>(null)

  const reload = useCallback(async () => {
    try {
      const [nextUsers, nextChores, nextAssignments, nextProgress, nextNotifications] =
        await Promise.all([
          api.users(),
          api.chores(),
          api.assignments({ status, userId: userFilter, query, sortBy }),
          api.progress(),
          api.notifications(),
        ])

      setUsers(nextUsers)
      setChores(nextChores)
      setAssignments(nextAssignments)
      setProgress(nextProgress.progress)
      setHistory(nextProgress.history)
      setNotifications(nextNotifications.notifications)
      setUnread(nextNotifications.unread)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reach the API')
    } finally {
      setLoading(false)
    }
  }, [status, userFilter, query, sortBy])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  /** Run a mutation, refresh from the server, and say what happened. */
  const run = async (action: () => Promise<string>) => {
    try {
      const message = await action()
      await reload()
      setToast({ message, tone: 'success' })
    } catch (cause) {
      setToast({
        message: cause instanceof Error ? cause.message : 'Something went wrong',
        tone: 'error',
      })
    }
  }

  const openCount = assignments.filter((item) => item.status !== 'Done').length
  const pastDue = assignments.filter((item) => item.dueState === 'Past due').length
  const dueSoon = assignments.filter((item) => item.dueState === 'Due soon').length
  const completed = assignments.filter((item) => item.status === 'Done').length

  return (
    <div className="app-shell">
      <header className="page-header">
        <div>
          <h1>🧹 Chore Chart</h1>
          <p className="subtext">
            Points scale with each chore's frequency and how long it had been since it was last done.
          </p>
        </div>
        <NotificationBell
          notifications={notifications}
          unread={unread}
          onMarkRead={() =>
            void run(async () => {
              await api.markNotificationsRead()
              return 'Notifications marked read'
            })
          }
        />
      </header>

      {error ? (
        <div className="banner error">
          {error} — is the API running? Start it with <code>npm run api</code>.
        </div>
      ) : null}

      {toast ? <div className={`toast ${toast.tone}`}>{toast.message}</div> : null}

      <PointBar progress={progress} />

      <nav className="tabs" aria-label="Chore sections">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`tab-button ${activeTab === key ? 'active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {loading ? <p className="muted">Loading chores…</p> : null}

      {activeTab !== 'settings' ? (
        <section className="filters">
          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {['All', 'Open', 'Pending', 'In Progress', 'Done'].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            Assigned to
            <select value={userFilter} onChange={(event) => setUserFilter(Number(event.target.value))}>
              <option value={0}>Everyone</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Search
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="e.g. laundry"
            />
          </label>
          {activeTab === 'chores' ? (
            <label>
              Sort by
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                {['Priority', 'Due date', 'Assigned user'].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="metrics">
            <span>
              <strong>{openCount}</strong> open
            </span>
            <span className="past-due">
              <strong>{pastDue}</strong> past due
            </span>
            <span className="due-soon">
              <strong>{dueSoon}</strong> due soon
            </span>
            <span className="completed">
              <strong>{completed}</strong> done
            </span>
          </div>
        </section>
      ) : null}

      {activeTab === 'chores' ? (
        <ChoreList
          assignments={assignments}
          chores={chores}
          users={users}
          onAssign={(choreId, userId, dueDate, priority) =>
            void run(async () => {
              const assignment = await api.assignChore(choreId, { userId, dueDate, priority })
              return `Assigned ${assignment.choreTitle} to ${assignment.userName}`
            })
          }
          onComplete={(id) =>
            void run(async () => {
              const result = await api.completeAssignment(id)
              return `${result.assignment.choreTitle}: +${result.points} points`
            })
          }
          onReopen={(id) =>
            void run(async () => {
              const result = await api.reopenAssignment(id)
              return `Reopened — ${result.pointsRemoved} points removed`
            })
          }
          onSave={(id, fields) =>
            void run(async () => {
              await api.updateAssignment(id, fields)
              return 'Assignment updated'
            })
          }
          onDelete={(id) =>
            void run(async () => {
              await api.deleteAssignment(id)
              return 'Assignment deleted'
            })
          }
          onMarkInProgress={(id) =>
            void run(async () => {
              await api.updateAssignment(id, { status: 'In Progress' })
              return 'Marked in progress'
            })
          }
        />
      ) : null}

      {activeTab === 'calendar' ? (
        <Calendar
          assignments={assignments}
          chores={chores}
          users={users}
          onCreate={(body) =>
            void run(async () => {
              const assignment = await api.createAssignment(body)
              return `Added ${assignment.choreTitle} for ${assignment.dueDate}`
            })
          }
          onComplete={(id) =>
            void run(async () => {
              const result = await api.completeAssignment(id)
              return `${result.assignment.choreTitle}: +${result.points} points`
            })
          }
          onReopen={(id) =>
            void run(async () => {
              const result = await api.reopenAssignment(id)
              return `Reopened — ${result.pointsRemoved} points removed`
            })
          }
          onDelete={(id) =>
            void run(async () => {
              await api.deleteAssignment(id)
              return 'Assignment deleted'
            })
          }
        />
      ) : null}

      {activeTab === 'settings' ? (
        <Settings
          chores={chores}
          users={users}
          history={history}
          onCreateChore={(body) =>
            void run(async () => {
              const chore = await api.createChore(body)
              return `Added ${chore.title}`
            })
          }
          onUpdateChore={(id, body) =>
            void run(async () => {
              await api.updateChore(id, body)
              return 'Chore updated'
            })
          }
          onDeleteChore={(id) =>
            void run(async () => {
              await api.deleteChore(id)
              return 'Chore deleted'
            })
          }
          onCreateUser={(body) =>
            void run(async () => {
              const user = await api.createUser(body)
              return `Added ${user.name}`
            })
          }
          onDeleteUser={(id) =>
            void run(async () => {
              await api.deleteUser(id)
              return 'Person deleted'
            })
          }
        />
      ) : null}
    </div>
  )
}

export default App
