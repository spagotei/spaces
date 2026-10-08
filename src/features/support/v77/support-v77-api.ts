export type SupportV77CaseType =
  | 'request'
  | 'user_report'
  | 'space_report'
  | 'bug_report'
  | 'appeal'
  | 'other'

export type SupportV77CaseStatus = 'waiting' | 'reviewing' | 'resolved' | 'archived'
export type SupportV77Priority = 'low' | 'normal' | 'high' | 'urgent'

export type SupportV77Identity = {
  id: string
  publicUserId: string
  username: string
  displayName: string
  initials: string
  avatarUrl: string | null
  bannerUrl?: string | null
  profileAccent?: string
  bio?: string
  platformRole?: 'founder' | 'staff' | 'support' | null
  presence?: 'online' | 'idle' | 'dnd' | 'offline'
  customStatus?: string
}

export type SupportV77CaseEvent = {
  id: string
  caseId: string
  actorUserId: string | null
  actorName: string
  actorRole: 'founder' | 'staff' | 'support' | null
  eventType: string
  body: string
  metadata: Record<string, unknown>
  createdAt: number
}

export type SupportV77Case = {
  id: string
  caseNumber: string
  caseType: SupportV77CaseType
  subtype: string
  reporter: SupportV77Identity
  targetUser: SupportV77Identity | null
  targetSpaceId: string | null
  targetSpaceName: string | null
  targetChannelId: string | null
  targetChannelName: string | null
  subject: string
  answers: Record<string, unknown>
  details: string
  priority: SupportV77Priority
  status: SupportV77CaseStatus
  assignedTo: string | null
  assignedToName: string | null
  source: string
  createdAt: number
  updatedAt: number
  lastActivityAt: number
  resolvedAt: number | null
  archivedAt: number | null
  events?: SupportV77CaseEvent[]
}

export type SupportV77Restriction = {
  id: string
  targetType: 'user' | 'space' | 'channel'
  targetId: string
  targetLabel: string
  capability: string
  reasonCategory: string
  note: string
  createdBy: string
  createdByName: string
  createdAt: number
  expiresAt: number | null
  active: boolean
  caseId: string | null
}

export type SupportV77Audit = {
  id: string
  actorId: string
  actorName: string
  actorRole: 'founder' | 'staff' | 'support' | null
  action: string
  targetType: string
  targetId: string
  targetLabel: string
  caseId: string | null
  reasonCategory: string
  note: string
  expiresAt: number | null
  createdAt: number
}

export type SupportV77Profile = SupportV77Identity & {
  publicProfile: boolean
  createdAt: number
  sharedSpaces: { id: string; name: string; role: string }[]
  activeRestrictions: SupportV77Restriction[]
  recentCases: Pick<SupportV77Case, 'id' | 'caseNumber' | 'caseType' | 'subject' | 'status' | 'updatedAt'>[]
}

export type SupportV77Access = {
  id: string
  role: 'founder' | 'staff' | 'support' | null
  permissions: string[]
  founder: boolean
}

export type SupportIntakeV77Detail = {
  type?: SupportV77CaseType
  targetUserId?: string | null
  targetUsername?: string | null
  targetDisplayName?: string | null
  targetSpaceId?: string | null
  targetSpaceName?: string | null
  targetChannelId?: string | null
  targetChannelName?: string | null
  source?: string
}

export type OpenProfileV77Detail = {
  userId: string
  fallback?: Partial<SupportV77Identity> | null
}

export async function supportV77Request<T>(
  apiUrl: string,
  token: string | undefined,
  route: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${apiUrl.replace(/\/$/u, '')}${route}`, { ...init, headers })
  if (!response.ok) {
    let message = `Support request failed (${response.status}).`
    try {
      const payload = (await response.json()) as { error?: string; message?: string }
      message = payload.message || payload.error || message
    } catch {
      // Keep status fallback.
    }
    throw new Error(message)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export function dispatchSupportIntakeV77(detail: SupportIntakeV77Detail = {}) {
  window.dispatchEvent(new CustomEvent<SupportIntakeV77Detail>('spaces-support-intake-v77', { detail }))
}

export function openProfileV77(userId: string, fallback?: Partial<SupportV77Identity> | null) {
  window.dispatchEvent(new CustomEvent<OpenProfileV77Detail>('spaces-open-profile-v77', {
    detail: { userId, fallback },
  }))
}

export function supportCaseTypeLabelV77(type: SupportV77CaseType) {
  if (type === 'user_report') return 'User Report'
  if (type === 'space_report') return 'Space Report'
  if (type === 'bug_report') return 'Bug Report'
  if (type === 'appeal') return 'Appeal'
  if (type === 'other') return 'Other'
  return 'Request'
}

export function supportStatusLabelV77(status: SupportV77CaseStatus) {
  if (status === 'waiting') return 'Waiting'
  if (status === 'reviewing') return 'Reviewing'
  if (status === 'resolved') return 'Resolved'
  return 'Archive'
}
