/**
 * Client for the PHP API in lib/Controller, routed by appinfo/routes.php.
 *
 * Under Nextcloud the same routes live beneath the app's base URL, so only
 * API_BASE has to change.
 */

const API_BASE = '/api'

export type AssignmentStatus = 'Pending' | 'In Progress' | 'Done'
export type Priority = 'High' | 'Medium' | 'Low'
export type DueState = 'Past due' | 'Due soon' | 'Upcoming' | 'Completed'

export type User = {
  id: number
  name: string
  email: string | null
}

export type RewardTier = {
  slug: string
  title: string
  description: string
  threshold: number
}

export type UserProgress = {
  id: number
  name: string
  points: number
  completed: number
  openChores: number
  tier: string | null
  nextTier: RewardTier | null
  progress: number
}

export type Chore = {
  id: number
  title: string
  description: string
  frequency: string
  lastCompleted: string | null
  openAssignments: number
  scheduledDue: string
  dueState: DueState
  suggestedPriority: Priority
}

export type Assignment = {
  id: number
  choreId: number
  userId: number
  choreTitle: string
  description: string
  frequency: string
  userName: string
  email: string | null
  dueDate: string
  status: AssignmentStatus
  priority: Priority
  lastUpdate: string | null
  completedAt: string | null
  choreLastCompleted: string | null
  pointsAwarded: number
  scheduledDue: string
  dueState: DueState
  suggestedPriority: Priority
  pointsIfCompletedToday: number
}

export type Notification = {
  id: number
  message: string
  read: boolean
  createdAt: string
  assignmentId: number | null
  userName: string | null
}

export type PointsEntry = {
  points: number
  reason: string
  createdAt: string
  user: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed with status ${response.status}`)
  }
  return payload as T
}

const send = <T>(method: string, path: string, body?: unknown) =>
  request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })

export const api = {
  chores: () => request<{ chores: Chore[] }>('/chores').then((r) => r.chores),

  createChore: (body: { title: string; description: string; frequency: string }) =>
    send<{ chore: Chore }>('POST', '/chores', body).then((r) => r.chore),

  updateChore: (id: number, body: Partial<{ title: string; description: string; frequency: string }>) =>
    send<{ chore: Chore }>('PUT', `/chores/${id}`, body).then((r) => r.chore),

  deleteChore: (id: number) => send<{ deleted: boolean }>('DELETE', `/chores/${id}`),

  assignChore: (id: number, body: { userId: number; dueDate?: string; priority?: Priority }) =>
    send<{ assignment: Assignment }>('POST', `/chores/${id}/assign`, body).then((r) => r.assignment),

  assignments: (params: { status?: string; userId?: number; query?: string; sortBy?: string } = {}) => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '' && value !== 0) search.set(key, String(value))
    }
    const suffix = search.toString() ? `?${search}` : ''
    return request<{ assignments: Assignment[] }>(`/assignments${suffix}`).then((r) => r.assignments)
  },

  createAssignment: (body: {
    choreId: number
    userId: number
    dueDate: string
    priority?: Priority
    status?: AssignmentStatus
  }) => send<{ assignment: Assignment }>('POST', '/assignments', body).then((r) => r.assignment),

  updateAssignment: (
    id: number,
    body: Partial<{
      choreId: number
      userId: number
      dueDate: string
      priority: Priority
      status: AssignmentStatus
    }>,
  ) => send<{ assignment: Assignment }>('PUT', `/assignments/${id}`, body).then((r) => r.assignment),

  deleteAssignment: (id: number) => send<{ deleted: boolean }>('DELETE', `/assignments/${id}`),

  completeAssignment: (id: number) =>
    send<{ assignment: Assignment; points: number }>('POST', `/assignments/${id}/complete`),

  reopenAssignment: (id: number) =>
    send<{ assignment: Assignment; pointsRemoved: number }>('POST', `/assignments/${id}/reopen`),

  users: () => request<{ users: User[] }>('/users').then((r) => r.users),

  createUser: (body: { name: string; email?: string }) =>
    send<{ user: User }>('POST', '/users', body).then((r) => r.user),

  deleteUser: (id: number) => send<{ deleted: boolean }>('DELETE', `/users/${id}`),

  progress: () => request<{ progress: UserProgress[]; history: PointsEntry[] }>('/users/progress'),

  notifications: () =>
    request<{ notifications: Notification[]; unread: number }>('/notifications'),

  markNotificationsRead: () => send<{ unread: number }>('POST', '/notifications/read'),
}
