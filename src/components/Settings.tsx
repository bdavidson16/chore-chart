/** Managing the chore catalogue and the people it can be assigned to. */

import { useState } from 'react'
import type { Chore, PointsEntry, User } from '../api'

const FREQUENCIES = ['One-time', 'Daily', 'Weekly', 'Biweekly', 'Monthly']

type Props = {
  chores: Chore[]
  users: User[]
  history: PointsEntry[]
  onCreateChore: (body: { title: string; description: string; frequency: string }) => void
  onUpdateChore: (id: number, body: { title: string; description: string; frequency: string }) => void
  onDeleteChore: (id: number) => void
  onCreateUser: (body: { name: string; email?: string }) => void
  onDeleteUser: (id: number) => void
}

export default function Settings({
  chores,
  users,
  history,
  onCreateChore,
  onUpdateChore,
  onDeleteChore,
  onCreateUser,
  onDeleteUser,
}: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [frequency, setFrequency] = useState('Weekly')

  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState({ title: '', description: '', frequency: 'Weekly' })

  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')

  const submitChore = () => {
    if (!title.trim()) return
    onCreateChore({ title: title.trim(), description: description.trim(), frequency })
    setTitle('')
    setDescription('')
    setFrequency('Weekly')
  }

  const submitUser = () => {
    if (!userName.trim()) return
    onCreateUser({ name: userName.trim(), email: userEmail.trim() || undefined })
    setUserName('')
    setUserEmail('')
  }

  return (
    <div className="panel-grid">
      <section className="panel-card">
        <h2>Chores</h2>
        <label>
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Vacuum"
          />
        </label>
        <label>
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
          />
        </label>
        <label>
          Frequency
          <select value={frequency} onChange={(event) => setFrequency(event.target.value)}>
            {FREQUENCIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="primary" onClick={submitChore}>
          Add chore
        </button>

        <div className="list-card">
          {chores.map((chore) => (
            <div key={chore.id} className="list-row">
              {editingId === chore.id ? (
                <div className="inline-editor">
                  <input
                    value={draft.title}
                    onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  />
                  <textarea
                    value={draft.description}
                    rows={2}
                    onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  />
                  <select
                    value={draft.frequency}
                    onChange={(event) => setDraft({ ...draft, frequency: event.target.value })}
                  >
                    {FREQUENCIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <div className="button-row">
                    <button
                      type="button"
                      className="primary"
                      onClick={() => {
                        onUpdateChore(chore.id, draft)
                        setEditingId(null)
                      }}
                    >
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="list-details">
                    <strong>{chore.title}</strong>
                    <span>{chore.frequency}</span>
                    {chore.description ? <small>{chore.description}</small> : null}
                  </div>
                  <div className="button-row">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(chore.id)
                        setDraft({
                          title: chore.title,
                          description: chore.description,
                          frequency: chore.frequency,
                        })
                      }}
                    >
                      Edit
                    </button>
                    <button type="button" className="danger" onClick={() => onDeleteChore(chore.id)}>
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="panel-card">
        <h2>People</h2>
        <label>
          Name
          <input value={userName} onChange={(event) => setUserName(event.target.value)} />
        </label>
        <label>
          Email
          <input
            type="email"
            value={userEmail}
            onChange={(event) => setUserEmail(event.target.value)}
          />
        </label>
        <button type="button" className="primary" onClick={submitUser}>
          Add person
        </button>

        <div className="list-card">
          {users.map((user) => (
            <div key={user.id} className="list-row">
              <div className="list-details">
                <strong>{user.name}</strong>
                <span>{user.email ?? 'no email'}</span>
              </div>
              <button type="button" className="danger" onClick={() => onDeleteUser(user.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>

        <h3>Recent points</h3>
        {history.length === 0 ? (
          <p className="muted">No points awarded yet.</p>
        ) : (
          <div className="list-card">
            {history.slice(0, 10).map((entry, index) => (
              <div key={`${entry.createdAt}-${index}`} className="list-row compact">
                <span>
                  <strong>{entry.user}</strong> · {entry.reason}
                </span>
                <span className="points-badge">+{entry.points}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
