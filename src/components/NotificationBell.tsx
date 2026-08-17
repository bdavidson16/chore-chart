/** Notification bell — port of components/users/notify_user.jsx. */

import { useEffect, useRef, useState } from 'react'
import type { Notification } from '../api'

type Props = {
  notifications: Notification[]
  unread: number
  onMarkRead: () => void
}

export default function NotificationBell({ notifications, unread, onMarkRead }: Props) {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [open])

  return (
    <div className="bell" ref={container}>
      <button type="button" className="bell-button" onClick={() => setOpen((value) => !value)}>
        🔔
        {unread > 0 ? <span className="bell-badge">{unread}</span> : null}
      </button>

      {open ? (
        <div className="bell-dropdown">
          <div className="bell-header">
            <strong>Notifications</strong>
            {unread > 0 ? (
              <button type="button" onClick={onMarkRead}>
                Mark all read
              </button>
            ) : null}
          </div>

          {notifications.length === 0 ? (
            <p className="muted">Nothing yet. Assign or complete a chore.</p>
          ) : (
            <ul className="bell-list">
              {notifications.map((note) => (
                <li key={note.id} className={note.read ? 'read' : 'unread'}>
                  <span>{note.message}</span>
                  <small>{note.createdAt}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
