import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { SPACES_API_URL } from '../api/config'
import { clearWorkspaceSession, loadWorkspaceSession, saveWorkspaceSession } from '../api/session'
import { WorkspaceApi, WorkspaceApiError } from '../api/workspace-api'
import { defaultAdministratorRole, defaultStaffRole, flexibleRoleModelKey } from '../utils/default-roles'
import { loadRoleLabels } from '../utils/workspace-local-meta'
import type {
  WorkspaceBootstrap,
  WorkspaceChannel,
  WorkspaceCustomPermission,
  WorkspaceCustomRole,
  WorkspaceBaseRoleSetting,
  WorkspaceMessageAttachment,
  WorkspaceNote,
  WorkspaceProfile,
  WorkspacePingNotification,
  WorkspaceChannelPermissionAction,
  WorkspaceChannelPermissionOverwrite,
  WorkspaceChannelPermissionTarget,
  WorkspaceRole,
  WorkspaceSession,
  WorkspaceAccountSecurity,
  WorkspaceBetaAccessEntry,
  WorkspaceBetaAccessInviteResult,
  WorkspaceEmailVerificationStart,
  WorkspaceTwoFactorSetup,
  WorkspaceTwoFactorEnableResult,
  WorkspaceSessionInfo,
  WorkspaceSummary,
  WorkspaceModerationReport,
  WorkspaceSupportCase,
  WorkspaceSupportCaseKind,
  WorkspaceSupportCaseStatus,
  WorkspaceSupportMessage,
  WorkspaceSupportPriority,
  WorkspaceSupportUser,
  WorkspaceSupportStaffMessage,
  WorkspaceDirectCenter,
  WorkspaceDirectConversation,
  WorkspaceDirectMessage,
  WorkspaceDirectGroup,
  WorkspaceDirectGroupMessage,
  WorkspaceDmPreference,
} from '../types/spaces'

export type AppView = 'home' | 'chat' | 'notes' | 'members' | 'roles' | 'emoji' | 'activity' | 'invites' | 'settings' | 'staff'

type Toast = { id: number; tone: 'info' | 'success' | 'danger'; message: string }
export type SpacesNotification = WorkspacePingNotification

type SpacesContextValue = {
  apiUrl: string
  session: WorkspaceSession | null
  profile: WorkspaceProfile | null
  workspaces: WorkspaceSummary[]
  activeWorkspaceId: string
  activeWorkspace: WorkspaceSummary | null
  data: WorkspaceBootstrap | null
  activeChannelId: string
  activeChannel: WorkspaceChannel | null
  view: AppView
  loading: boolean
  workspaceLoading: boolean
  error: string
  memberRailOpen: boolean
  mobileNavOpen: boolean
  commandOpen: boolean
  toasts: Toast[]
  notifications: SpacesNotification[]
  clearNotifications: () => void
  login: (identifier: string, password: string, twoFactorCode?: string) => Promise<'authenticated' | 'two-factor'>
  completeBetaProfile: (input: { username: string; displayName: string; avatarUrl?: string | null }) => Promise<void>
  logout: () => Promise<void>
  goHome: () => void
  chooseWorkspace: (workspaceId: string) => Promise<void>
  chooseChannel: (channelId: string) => void
  setView: (view: AppView) => void
  setMemberRailOpen: (open: boolean) => void
  setMobileNavOpen: (open: boolean) => void
  setCommandOpen: (open: boolean) => void
  refreshWorkspaces: () => Promise<void>
  refreshWorkspace: () => Promise<void>
  createWorkspace: (name: string, options?: { description?: string; avatarUrl?: string | null; accentColor?: string }) => Promise<void>
  joinWorkspace: (code: string) => Promise<void>
  createChannel: (name: string, description: string, kind: WorkspaceChannel['kind']) => Promise<WorkspaceChannel | null>
  deleteChannel: (channelId: string) => Promise<void>
  updateChannelPermissions: (channelId: string, postMinRole: import('../types/spaces').WorkspaceChannelPermission, noteMinRole: import('../types/spaces').WorkspaceChannelPermission) => Promise<void>
  listChannelPermissionOverwrites: (channelId: string) => Promise<WorkspaceChannelPermissionOverwrite[]>
  saveChannelPermissionOverwrite: (channelId: string, targetType: WorkspaceChannelPermissionTarget, targetId: string, allow: WorkspaceChannelPermissionAction[], deny: WorkspaceChannelPermissionAction[]) => Promise<WorkspaceChannelPermissionOverwrite>
  deleteChannelPermissionOverwrite: (channelId: string, targetType: WorkspaceChannelPermissionTarget, targetId: string) => Promise<void>
  reportUser: (userId: string, reason: string, details: string) => Promise<void>
  sendMessage: (body: string, attachment?: WorkspaceMessageAttachment | null) => Promise<void>
  editMessage: (messageId: string, body: string) => Promise<void>
  deleteMessage: (messageId: string) => Promise<void>
  saveNote: (note: Pick<WorkspaceNote, 'id' | 'channelId' | 'title' | 'body'>, reason?: string) => Promise<WorkspaceNote | null>
  deleteNote: (noteId: string) => Promise<void>
  addComment: (noteId: string, body: string) => Promise<void>
  deleteComment: (commentId: string) => Promise<void>
  createRole: (input: { name: string; color: string; permissions: WorkspaceCustomPermission[]; hoist?: boolean; mentionable?: boolean }) => Promise<void>
  updateRole: (roleId: string, input: Partial<Pick<WorkspaceCustomRole, 'name' | 'color' | 'permissions' | 'position' | 'hoist' | 'mentionable'>>) => Promise<void>
  updateBaseRoleSetting: (role: 'owner' | 'member', input: Partial<Pick<WorkspaceBaseRoleSetting, 'color' | 'hoist' | 'mentionable'>>) => Promise<WorkspaceBaseRoleSetting>
  reorderRoles: (orderedRoleIds: string[]) => Promise<void>
  deleteRole: (roleId: string) => Promise<void>
  upgradeRoleModel: () => Promise<void>
  setMemberRoles: (memberId: string, roleIds: string[]) => Promise<void>
  changeMemberRole: (memberId: string, role: WorkspaceRole) => Promise<void>
  removeMember: (memberId: string) => Promise<void>
  createEmoji: (name: string, imageType: string, imageData: string) => Promise<void>
  deleteEmoji: (emojiId: string) => Promise<void>
  updateWorkspace: (input: Parameters<WorkspaceApi['updateWorkspace']>[1]) => Promise<void>
  leaveWorkspace: () => Promise<void>
  deleteWorkspace: () => Promise<void>
  updateProfile: (input: Parameters<WorkspaceApi['updateMyProfile']>[0]) => Promise<void>
  setAvatar: (avatarUrl: string | null) => Promise<void>
  setBanner: (bannerUrl: string | null) => Promise<void>
  listSessions: () => Promise<WorkspaceSessionInfo[]>
  revokeSession: (sessionId: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  getAccountSecurity: () => Promise<WorkspaceAccountSecurity>
  startEmailVerification: (email: string, currentPassword?: string, twoFactorCode?: string) => Promise<WorkspaceEmailVerificationStart>
  verifyEmail: (code: string) => Promise<WorkspaceAccountSecurity>
  beginTwoFactorSetup: () => Promise<WorkspaceTwoFactorSetup>
  enableTwoFactor: (code: string) => Promise<WorkspaceTwoFactorEnableResult>
  disableTwoFactor: (code: string) => Promise<WorkspaceAccountSecurity>
  regenerateRecoveryCodes: (code: string) => Promise<WorkspaceTwoFactorEnableResult>
  getDirectCenter: () => Promise<WorkspaceDirectCenter>
  requestDirectConversation: (input: { username?: string; targetUserId?: string; sourceWorkspaceId?: string | null }) => Promise<WorkspaceDirectConversation>
  acceptDirectConversation: (conversationId: string) => Promise<WorkspaceDirectConversation>
  declineDirectConversation: (conversationId: string) => Promise<void>
  listDirectMessages: (conversationId: string) => Promise<WorkspaceDirectMessage[]>
  sendDirectMessage: (conversationId: string, body: string) => Promise<WorkspaceDirectMessage>
  createDirectGroup: (name: string, memberUserIds: string[]) => Promise<WorkspaceDirectGroup>
  updateDirectGroup: (groupId: string, name: string) => Promise<WorkspaceDirectGroup>
  listDirectGroupMessages: (groupId: string) => Promise<WorkspaceDirectGroupMessage[]>
  sendDirectGroupMessage: (groupId: string, body: string) => Promise<WorkspaceDirectGroupMessage>
  getWorkspaceDmPreference: (workspaceId: string) => Promise<WorkspaceDmPreference>
  updateWorkspaceDmPreference: (workspaceId: string, allowDms: boolean) => Promise<WorkspaceDmPreference>
  setPlatformSupportRole: (userId: string, role: 'support' | null) => Promise<void>
  listModerationReports: () => Promise<WorkspaceModerationReport[]>
  updateModerationReport: (reportId: string, status: 'reviewed' | 'dismissed') => Promise<void>
  banPlatformUser: (userId: string, reason: string, reportId?: string | null) => Promise<void>
  unbanPlatformUser: (userId: string) => Promise<void>
  createSupportCase: (input: { kind: WorkspaceSupportCaseKind; subject: string; details: string; workspaceId?: string | null; priority?: WorkspaceSupportPriority }) => Promise<WorkspaceSupportCase>
  listSupportCases: () => Promise<WorkspaceSupportCase[]>
  updateSupportCase: (caseId: string, input: { status?: WorkspaceSupportCaseStatus; priority?: WorkspaceSupportPriority; assignToMe?: boolean }) => Promise<WorkspaceSupportCase>
  listSupportMessages: () => Promise<WorkspaceSupportMessage[]>
  sendSupportMessage: (input: { recipientUserId: string; subject: string; body: string; caseId?: string | null }) => Promise<WorkspaceSupportMessage>
  searchSupportUsers: (query: string) => Promise<WorkspaceSupportUser[]>
  listSupportStaffMessages: () => Promise<WorkspaceSupportStaffMessage[]>
  sendSupportStaffMessage: (body: string) => Promise<WorkspaceSupportStaffMessage>
  restrictSupportSpace: (workspaceId: string, reason: string) => Promise<void>
  unrestrictSupportSpace: (workspaceId: string) => Promise<void>
  deleteSupportSpace: (workspaceId: string, confirmation: string, reason: string) => Promise<void>
  listBetaAccess: () => Promise<WorkspaceBetaAccessEntry[]>
  inviteBetaEmail: (email: string, options?: { subject?: string; message?: string }) => Promise<WorkspaceBetaAccessInviteResult>
  revokeBetaAccess: (accessId: string) => Promise<void>
  pushToast: (message: string, tone?: Toast['tone']) => void
}

const SpacesContext = createContext<SpacesContextValue | null>(null)

function messageFromError(error: unknown): string {
  if (error instanceof WorkspaceApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}

export function SpacesProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<WorkspaceSession | null>(() => loadWorkspaceSession())
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('')
  const [data, setData] = useState<WorkspaceBootstrap | null>(null)
  const [activeChannelId, setActiveChannelId] = useState('')
  const [view, setView] = useState<AppView>('home')
  const [loading, setLoading] = useState(true)
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [error, setError] = useState('')
  const [memberRailOpen, setMemberRailOpen] = useState(true)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [notifications, setNotifications] = useState<SpacesNotification[]>(() => { try { return JSON.parse(localStorage.getItem('spaces.notifications.v1') || '[]') as SpacesNotification[] } catch { return [] } })
  const toastCounter = useRef(0)
  const notificationReadBefore = useRef(Number(localStorage.getItem('spaces.notifications.readBefore') || 0))
  const notificationPollSince = useRef(Math.max(notificationReadBefore.current, Date.now() - 7 * 24 * 60 * 60 * 1000))
  const workspaceCacheV44 = useRef(new Map<string, WorkspaceBootstrap>())

  const api = useMemo(
    () => new WorkspaceApi({ baseUrl: SPACES_API_URL, getToken: () => session?.token ?? '' }),
    [session?.token],
  )

  // Keep the current profile available to callbacks without referencing an undeclared identifier.
  // v32.0's role-model upgrade used `profile` before defining it, which crashed the provider
  // during the first render and left the Tauri window blank.
  const profile = session?.profile ?? null

  useEffect(() => { localStorage.setItem('spaces.notifications.v1', JSON.stringify(notifications.slice(0, 40))) }, [notifications])

  const clearNotifications = useCallback(() => {
    const now = Date.now()
    notificationReadBefore.current = now
    notificationPollSince.current = now
    localStorage.setItem('spaces.notifications.readBefore', String(now))
    setNotifications([])
  }, [])

  const pushToast = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    const id = ++toastCounter.current
    setToasts(current => [...current, { id, tone, message }])
    window.setTimeout(() => setToasts(current => current.filter(toast => toast.id !== id)), 3400)
  }, [])

  const refreshWorkspaces = useCallback(async () => {
    if (!session) return
    const items = await api.listWorkspaces()
    setWorkspaces(items)
  }, [api, session])

  const refreshWorkspace = useCallback(async () => {
    if (!activeWorkspaceId || !session) return
    const next = await api.bootstrapWorkspace(activeWorkspaceId)
    workspaceCacheV44.current.set(activeWorkspaceId, next)
    setData(next)
    setWorkspaces(current => current.map(item => item.id === next.workspace.id ? next.workspace : item))
    setActiveChannelId(current => {
      if (current && next.channels.some(channel => channel.id === current)) return current
      return next.channels[0]?.id ?? ''
    })
  }, [activeWorkspaceId, api, session])

  useEffect(() => {
    let cancelled = false
    async function restore() {
      if (!session) {
        setLoading(false)
        return
      }
      try {
        const profile = await api.getMyProfile()
        if (cancelled) return
        const nextSession = { ...session, profile }
        setSession(nextSession)
        saveWorkspaceSession(nextSession)
        const items = await api.listWorkspaces()
        if (!cancelled) setWorkspaces(items)
      } catch (cause) {
        if (!cancelled) {
          clearWorkspaceSession()
          setSession(null)
          setWorkspaces([])
          setError(messageFromError(cause))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void restore()
    return () => { cancelled = true }
    // Only restore when the token identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token])

  useEffect(() => {
    if (!activeWorkspaceId || !session) return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshWorkspace().catch(() => undefined)
    }, 12000)
    return () => window.clearInterval(timer)
  }, [activeWorkspaceId, refreshWorkspace, session])

  useEffect(() => {
    if (!session) return
    let cancelled = false

    const poll = async () => {
      try {
        const found = await api.listPingNotifications(notificationPollSince.current)
        if (cancelled) return
        if (found.length) {
          notificationPollSince.current = Math.max(notificationPollSince.current, ...found.map(item => item.createdAt))
          setNotifications(current => {
            const existing = new Set(current.map(item => item.id))
            const map = new Map(current.map(item => [item.id, item]))
            for (const item of found) {
              if (item.createdAt <= notificationReadBefore.current) continue
              map.set(item.id, item)
              if (!existing.has(item.id) && Date.now() - item.createdAt < 45_000) {
                window.dispatchEvent(new CustomEvent('spaces-notification-peek', { detail: item }))
              }
            }
            return [...map.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 80)
          })
        }
      } catch {
        // Notification polling is intentionally quiet; the main app remains usable.
      }
    }

    void poll()
    const timer = window.setInterval(() => void poll(), 8000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [api, session])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(value => !value)
      }
      if (event.key === 'Escape') {
        setCommandOpen(false)
        setMobileNavOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const login = useCallback(async (identifier: string, password: string, twoFactorCode?: string): Promise<'authenticated' | 'two-factor'> => {
    setError('')
    setLoading(true)
    try {
      const loginApi = new WorkspaceApi({ baseUrl: SPACES_API_URL })
      const cleanIdentifier = identifier.trim().toLowerCase()
      const result = await loginApi.login(cleanIdentifier, password, twoFactorCode)
      if ('requiresTwoFactor' in result) return 'two-factor'
      const nextSession = { ...result, loginIdentifier: cleanIdentifier }
      saveWorkspaceSession(nextSession)
      setSession(nextSession)
      pushToast(result.profileSetupRequired ? 'Access confirmed. Finish your profile to continue.' : `Welcome back, ${result.profile.displayName}.`, 'success')
      return 'authenticated'
    } catch (cause) {
      const message = messageFromError(cause)
      // Some deployed Worker revisions return the two-factor challenge as an
      // auth error instead of { requiresTwoFactor: true }. Treat only explicit
      // 2FA/TOTP/authenticator-required messages as a challenge so a bad
      // password still behaves like a normal login error.
      if (!twoFactorCode && /(?:two[- ]?factor|2fa|totp|authenticator).*(?:required|enabled|code)|(?:required|enter).*(?:two[- ]?factor|2fa|totp|authenticator)/i.test(message)) {
        setError('')
        return 'two-factor'
      }
      setError(message)
      throw cause
    } finally {
      setLoading(false)
    }
  }, [pushToast])

  const completeBetaProfile = useCallback(async (input: { username: string; displayName: string; avatarUrl?: string | null }) => {
    const completed = await api.completeBetaProfile(input)
    const next = { ...completed, profileSetupRequired: false, loginIdentifier: session?.loginIdentifier ?? completed.loginIdentifier }
    saveWorkspaceSession(next)
    setSession(next)
    pushToast('Your Spaces profile is ready.', 'success')
  }, [api, pushToast, session?.loginIdentifier])

  const logout = useCallback(async () => {
    try { if (session) await api.logout() } catch { /* Local logout still proceeds. */ }
    clearWorkspaceSession()
    setSession(null)
    setWorkspaces([])
    setData(null)
    setActiveWorkspaceId('')
    setActiveChannelId('')
    setView('home')
  }, [api, session])

  const goHome = useCallback(() => {
    setActiveWorkspaceId('')
    setData(null)
    setActiveChannelId('')
    setView('home')
    setMobileNavOpen(false)
  }, [])

  const chooseWorkspace = useCallback(async (workspaceId: string) => {
    const cached = workspaceCacheV44.current.get(workspaceId)
    setWorkspaceLoading(!cached)
    setActiveWorkspaceId(workspaceId)
    setMobileNavOpen(false)

    if (cached) {
      setData(cached)
      const cachedFirst = cached.channels[0]
      setActiveChannelId(current => current && cached.channels.some(channel => channel.id === current) ? current : (cachedFirst?.id ?? ''))
      if (cachedFirst?.kind === 'notes') setView('notes')
      else setView('chat')
    } else {
      setData(null)
      setActiveChannelId('')
      setView('home')
    }

    try {
      const next = await api.bootstrapWorkspace(workspaceId)
      workspaceCacheV44.current.set(workspaceId, next)
      setData(next)
      setWorkspaces(current => current.some(item => item.id === next.workspace.id)
        ? current.map(item => item.id === next.workspace.id ? next.workspace : item)
        : [...current, next.workspace])
      try {
        localStorage.setItem(`spaces.background.${next.workspace.id}`, next.workspace.background)
        localStorage.setItem(`spaces.workspace.${next.workspace.id}`, JSON.stringify({ background: next.workspace.background, accentColor: next.workspace.accentColor, avatarUrl: next.workspace.avatarUrl, bannerUrl: next.workspace.bannerUrl, iconDecoration: next.workspace.iconDecoration }))
      } catch { /* Bootstrap data is still authoritative. */ }

      if (!cached) {
        const first = next.channels[0]
        setActiveChannelId(first?.id ?? '')
        setView('home')
      }
    } catch (cause) {
      if (!cached) {
        pushToast(messageFromError(cause), 'danger')
        setActiveWorkspaceId('')
        setData(null)
        throw cause
      }
      pushToast('Could not refresh this Space. Showing the last loaded copy.', 'info')
    } finally {
      setWorkspaceLoading(false)
    }
  }, [api, pushToast])

  const chooseChannel = useCallback((channelId: string) => {
    setActiveChannelId(channelId)
    const channel = data?.channels.find(item => item.id === channelId)
    setView(channel?.kind === 'notes' ? 'notes' : 'chat')
    setMobileNavOpen(false)
  }, [data?.channels])

  const createWorkspace = useCallback(async (name: string, options?: { description?: string; avatarUrl?: string | null; accentColor?: string }) => {
    let created = await api.createWorkspace(name)
    if (options && (options.description || options.avatarUrl || options.accentColor)) {
      created = await api.updateWorkspace(created.id, options)
    }

    // Owner and Member are the only permanent base roles. Administrator and Staff
    // are created as normal, movable roles so every Space can arrange its own hierarchy.
    try {
      await api.createCustomRole(created.id, { ...defaultStaffRole, permissions: [...defaultStaffRole.permissions] })
      await api.createCustomRole(created.id, { ...defaultAdministratorRole, permissions: [...defaultAdministratorRole.permissions] })
      localStorage.setItem(flexibleRoleModelKey(created.id), '1')
    } catch {
      // The Space itself was created successfully. Roles can still be added later.
    }

    await refreshWorkspaces()
    pushToast(`${created.name} created.`, 'success')
    await chooseWorkspace(created.id)
  }, [api, chooseWorkspace, pushToast, refreshWorkspaces])

  const joinWorkspace = useCallback(async (code: string) => {
    const joined = await api.joinWorkspace(code.trim())
    await refreshWorkspaces()
    pushToast(`Joined ${joined.name}.`, 'success')
    await chooseWorkspace(joined.id)
  }, [api, chooseWorkspace, pushToast, refreshWorkspaces])

  const createChannel = useCallback(async (name: string, description: string, kind: WorkspaceChannel['kind']) => {
    if (!activeWorkspaceId) return null
    const channel = await api.createChannel(activeWorkspaceId, name, description, kind)
    await refreshWorkspace()
    setActiveChannelId(channel.id)
    setView(channel.kind === 'notes' ? 'notes' : 'chat')
    pushToast(`#${channel.name} created.`, 'success')
    return channel
  }, [activeWorkspaceId, api, pushToast, refreshWorkspace])

  const deleteChannel = useCallback(async (channelId: string) => {
    if (!activeWorkspaceId) return
    await api.deleteChannel(activeWorkspaceId, channelId)
    setData(current => current ? {
      ...current,
      channels: current.channels.filter(channel => channel.id !== channelId),
      messages: current.messages.filter(message => message.channelId !== channelId),
      notes: current.notes.filter(note => note.channelId !== channelId),
      comments: current.comments.filter(comment => {
        const note = current.notes.find(item => item.id === comment.noteId)
        return note?.channelId !== channelId
      }),
    } : current)
    if (activeChannelId === channelId) {
      const fallback = data?.channels.find(channel => channel.id !== channelId)
      setActiveChannelId(fallback?.id ?? '')
      setView(fallback?.kind === 'notes' ? 'notes' : fallback ? 'chat' : 'home')
    }
    pushToast('Channel deleted.', 'success')
  }, [activeChannelId, activeWorkspaceId, api, data?.channels, pushToast])

  const updateChannelPermissions = useCallback(async (channelId: string, postMinRole: import('../types/spaces').WorkspaceChannelPermission, noteMinRole: import('../types/spaces').WorkspaceChannelPermission) => {
    if (!activeWorkspaceId) return
    const updated = await api.updateChannelPermissions(activeWorkspaceId, channelId, postMinRole, noteMinRole)
    setData(current => current ? { ...current, channels: current.channels.map(channel => channel.id === updated.id ? updated : channel) } : current)
    pushToast('Channel permissions updated.', 'success')
  }, [activeWorkspaceId, api, pushToast])

  const listChannelPermissionOverwrites = useCallback(async (channelId: string) => {
    if (!activeWorkspaceId) return []
    return api.listChannelPermissionOverwrites(activeWorkspaceId, channelId)
  }, [activeWorkspaceId, api])

  const saveChannelPermissionOverwrite = useCallback(async (channelId: string, targetType: WorkspaceChannelPermissionTarget, targetId: string, allow: WorkspaceChannelPermissionAction[], deny: WorkspaceChannelPermissionAction[]) => {
    if (!activeWorkspaceId) throw new Error('Open a Space first.')
    return api.saveChannelPermissionOverwrite(activeWorkspaceId, channelId, targetType, targetId, allow, deny)
  }, [activeWorkspaceId, api])

  const deleteChannelPermissionOverwrite = useCallback(async (channelId: string, targetType: WorkspaceChannelPermissionTarget, targetId: string) => {
    if (!activeWorkspaceId) return
    await api.deleteChannelPermissionOverwrite(activeWorkspaceId, channelId, targetType, targetId)
  }, [activeWorkspaceId, api])

  const reportUser = useCallback(async (userId: string, reason: string, details: string) => {
    await api.reportUser(userId, activeWorkspaceId || null, reason, details)
    pushToast('Report sent to Spaces moderation.', 'success')
  }, [activeWorkspaceId, api, pushToast])

  const sendMessage = useCallback(async (body: string, attachment: WorkspaceMessageAttachment | null = null) => {
    if (!activeWorkspaceId || !activeChannelId) return
    const message = await api.sendMessage(activeWorkspaceId, activeChannelId, body, attachment)
    setData(current => current ? { ...current, messages: [...current.messages.filter(item => item.id !== message.id), message] } : current)
  }, [activeChannelId, activeWorkspaceId, api])

  const editMessage = useCallback(async (messageId: string, body: string) => {
    if (!activeWorkspaceId) return
    const message = await api.editMessage(activeWorkspaceId, messageId, body)
    setData(current => current ? { ...current, messages: current.messages.map(item => item.id === message.id ? message : item) } : current)
  }, [activeWorkspaceId, api])

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!activeWorkspaceId) return
    await api.deleteMessage(activeWorkspaceId, messageId)
    await refreshWorkspace()
    pushToast('Message removed.', 'success')
  }, [activeWorkspaceId, api, pushToast, refreshWorkspace])

  const saveNote = useCallback(async (note: Pick<WorkspaceNote, 'id' | 'channelId' | 'title' | 'body'>, reason = '') => {
    if (!activeWorkspaceId) return null
    const saved = await api.saveNote(activeWorkspaceId, note, reason)
    setData(current => current ? { ...current, notes: [...current.notes.filter(item => item.id !== saved.id), saved] } : current)
    pushToast(note.id ? 'Note updated.' : 'Note created.', 'success')
    return saved
  }, [activeWorkspaceId, api, pushToast])

  const deleteNote = useCallback(async (noteId: string) => {
    if (!activeWorkspaceId) return
    await api.deleteNote(activeWorkspaceId, noteId)
    setData(current => current ? { ...current, notes: current.notes.filter(note => note.id !== noteId), comments: current.comments.filter(comment => comment.noteId !== noteId) } : current)
    pushToast('Note deleted.', 'success')
  }, [activeWorkspaceId, api, pushToast])

  const addComment = useCallback(async (noteId: string, body: string) => {
    if (!activeWorkspaceId) return
    const comment = await api.addNoteComment(activeWorkspaceId, noteId, body)
    setData(current => current ? { ...current, comments: [...current.comments, comment] } : current)
  }, [activeWorkspaceId, api])

  const deleteComment = useCallback(async (commentId: string) => {
    if (!activeWorkspaceId) return
    await api.deleteNoteComment(activeWorkspaceId, commentId)
    await refreshWorkspace()
  }, [activeWorkspaceId, api, refreshWorkspace])

  const upgradeRoleModel = useCallback(async () => {
    if (!activeWorkspaceId || !data || !profile) return
    const currentMember = data.members.find(member => member.profileId === profile.id)
    if (currentMember?.role !== 'owner' && data.workspace.ownerId !== profile.id) return

    const markerKey = flexibleRoleModelKey(activeWorkspaceId)
    const alreadyUpgraded = localStorage.getItem(markerKey) === '1'
    const legacyAdmins = data.members.filter(member => member.role === 'admin')
    const legacyStaff = data.members.filter(member => member.role === 'contributor')
    if (alreadyUpgraded && legacyAdmins.length === 0 && legacyStaff.length === 0) return

    const labels = loadRoleLabels(activeWorkspaceId)
    let snapshot = data
    let administratorRole = snapshot.roles.find(role => role.name.trim().toLowerCase() === labels.admin.trim().toLowerCase())
      ?? snapshot.roles.find(role => role.name.trim().toLowerCase() === 'administrator')
    let staffRole = snapshot.roles.find(role => role.name.trim().toLowerCase() === labels.staff.trim().toLowerCase())
      ?? snapshot.roles.find(role => role.name.trim().toLowerCase() === 'staff')

    if (!staffRole && (!alreadyUpgraded || legacyStaff.length > 0)) {
      await api.createCustomRole(activeWorkspaceId, {
        ...defaultStaffRole,
        name: labels.staff || defaultStaffRole.name,
        permissions: [...defaultStaffRole.permissions],
      })
    }
    if (!administratorRole && (!alreadyUpgraded || legacyAdmins.length > 0)) {
      await api.createCustomRole(activeWorkspaceId, {
        ...defaultAdministratorRole,
        name: labels.admin || defaultAdministratorRole.name,
        permissions: [...defaultAdministratorRole.permissions],
      })
    }

    snapshot = await api.bootstrapWorkspace(activeWorkspaceId)
    administratorRole = snapshot.roles.find(role => role.name.trim().toLowerCase() === labels.admin.trim().toLowerCase())
      ?? snapshot.roles.find(role => role.name.trim().toLowerCase() === 'administrator')
    staffRole = snapshot.roles.find(role => role.name.trim().toLowerCase() === labels.staff.trim().toLowerCase())
      ?? snapshot.roles.find(role => role.name.trim().toLowerCase() === 'staff')

    for (const member of snapshot.members) {
      if (member.role !== 'admin' && member.role !== 'contributor') continue
      const destinationRole = member.role === 'admin' ? administratorRole : staffRole
      if (destinationRole && !member.customRoleIds.includes(destinationRole.id)) {
        await api.setMemberCustomRoles(activeWorkspaceId, member.id, [...member.customRoleIds, destinationRole.id])
      }
      await api.changeMemberRole(activeWorkspaceId, member.id, 'viewer')
    }

    localStorage.setItem(markerKey, '1')
    await refreshWorkspace()
  }, [activeWorkspaceId, api, data, profile, refreshWorkspace])

  const updateBaseRoleSetting = useCallback(async (
    role: 'owner' | 'member',
    input: Partial<Pick<WorkspaceBaseRoleSetting, 'color' | 'hoist' | 'mentionable'>>,
  ) => {
    if (!activeWorkspaceId) throw new Error('Open a Space first.')
    const saved = await api.updateBaseRoleSetting(activeWorkspaceId, role, input)
    setData(current => {
      if (!current) return current
      const defaults = {
        owner: { role: 'owner' as const, color: '#b58ad8', hoist: true, mentionable: false, updatedAt: 0 },
        member: { role: 'member' as const, color: '#8b6ca8', hoist: false, mentionable: false, updatedAt: 0 },
      }
      return {
        ...current,
        baseRoles: {
          ...defaults,
          ...(current.baseRoles ?? {}),
          [role]: saved,
        },
      }
    })
    pushToast(`${role === 'owner' ? 'Owner' : 'Member'} appearance updated.`, 'success')
    return saved
  }, [activeWorkspaceId, api, pushToast])

  const createRole = useCallback(async (input: { name: string; color: string; permissions: WorkspaceCustomPermission[]; hoist?: boolean; mentionable?: boolean }) => {
    if (!activeWorkspaceId) return
    await api.createCustomRole(activeWorkspaceId, input)
    await refreshWorkspace()
    pushToast(`Role ${input.name} created.`, 'success')
  }, [activeWorkspaceId, api, pushToast, refreshWorkspace])

  const updateRole = useCallback(async (roleId: string, input: Partial<Pick<WorkspaceCustomRole, 'name' | 'color' | 'permissions' | 'position' | 'hoist' | 'mentionable'>>) => {
    if (!activeWorkspaceId) return
    await api.updateCustomRole(activeWorkspaceId, roleId, input)
    await refreshWorkspace()
    pushToast('Role updated.', 'success')
  }, [activeWorkspaceId, api, pushToast, refreshWorkspace])

  const deleteRole = useCallback(async (roleId: string) => {
    if (!activeWorkspaceId) return
    await api.deleteCustomRole(activeWorkspaceId, roleId)
    await refreshWorkspace()
    pushToast('Role deleted.', 'success')
  }, [activeWorkspaceId, api, pushToast, refreshWorkspace])

  const reorderRoles = useCallback(async (orderedRoleIds: string[]) => {
    if (!activeWorkspaceId || !data) return
    const existing = new Map(data.roles.map(role => [role.id, role]))
    const unique = orderedRoleIds.filter((id, index) => existing.has(id) && orderedRoleIds.indexOf(id) === index)
    for (const role of data.roles) {
      if (!unique.includes(role.id)) unique.push(role.id)
    }
    const changes = unique.map((id, index) => {
      const role = existing.get(id)!
      const position = (unique.length - index) * 10
      return { role, position }
    }).filter(item => item.role.position !== item.position)
    if (!changes.length) return
    for (const item of changes) {
      await api.updateCustomRole(activeWorkspaceId, item.role.id, { position: item.position })
    }
    await refreshWorkspace()
    pushToast('Role order updated.', 'success')
  }, [activeWorkspaceId, api, data, pushToast, refreshWorkspace])


  const setMemberRoles = useCallback(async (memberId: string, roleIds: string[]) => {
    if (!activeWorkspaceId) return
    await api.setMemberCustomRoles(activeWorkspaceId, memberId, roleIds)
    await refreshWorkspace()
    pushToast('Member roles updated.', 'success')
  }, [activeWorkspaceId, api, pushToast, refreshWorkspace])

  const changeMemberRole = useCallback(async (memberId: string, role: WorkspaceRole) => {
    if (!activeWorkspaceId) return
    await api.changeMemberRole(activeWorkspaceId, memberId, role)
    await refreshWorkspace()
    pushToast('Member access updated.', 'success')
  }, [activeWorkspaceId, api, pushToast, refreshWorkspace])

  const removeMember = useCallback(async (memberId: string) => {
    if (!activeWorkspaceId) return
    await api.removeMember(activeWorkspaceId, memberId)
    await refreshWorkspace()
    pushToast('Member removed from this Space.', 'success')
  }, [activeWorkspaceId, api, pushToast, refreshWorkspace])

  const createEmoji = useCallback(async (name: string, imageType: string, imageData: string) => {
    if (!activeWorkspaceId) return
    await api.createEmoji(activeWorkspaceId, name, imageType, imageData)
    await refreshWorkspace()
    pushToast(`:${name}: added.`, 'success')
  }, [activeWorkspaceId, api, pushToast, refreshWorkspace])

  const deleteEmoji = useCallback(async (emojiId: string) => {
    if (!activeWorkspaceId) return
    await api.deleteEmoji(activeWorkspaceId, emojiId)
    await refreshWorkspace()
    pushToast('Emoji removed.', 'success')
  }, [activeWorkspaceId, api, pushToast, refreshWorkspace])

  const updateWorkspace = useCallback(async (input: Parameters<WorkspaceApi['updateWorkspace']>[1]) => {
    if (!activeWorkspaceId) return
    const saved = await api.updateWorkspace(activeWorkspaceId, input)
    setData(current => current ? { ...current, workspace: saved } : current)
    setWorkspaces(current => current.some(item => item.id === saved.id)
      ? current.map(item => item.id === saved.id ? saved : item)
      : [...current, saved])
    try {
      localStorage.setItem(`spaces.background.${saved.id}`, saved.background)
      localStorage.setItem(`spaces.workspace.${saved.id}`, JSON.stringify({ background: saved.background, accentColor: saved.accentColor, avatarUrl: saved.avatarUrl, bannerUrl: saved.bannerUrl, iconDecoration: saved.iconDecoration }))
    } catch { /* Server state remains authoritative. */ }
    await Promise.all([refreshWorkspace(), refreshWorkspaces()])
    pushToast('Space updated.', 'success')
  }, [activeWorkspaceId, api, pushToast, refreshWorkspace, refreshWorkspaces])

  const leaveWorkspace = useCallback(async () => {
    if (!activeWorkspaceId) return
    const leavingId = activeWorkspaceId
    await api.leaveWorkspace(leavingId)
    setActiveWorkspaceId('')
    setActiveChannelId('')
    setData(null)
    setView('home')
    await refreshWorkspaces()
    pushToast('You left the Space.', 'success')
  }, [activeWorkspaceId, api, pushToast, refreshWorkspaces])

  const deleteWorkspace = useCallback(async () => {
    if (!activeWorkspaceId) return
    const deletingId = activeWorkspaceId
    await api.deleteWorkspace(deletingId)
    setActiveWorkspaceId('')
    setActiveChannelId('')
    setData(null)
    setView('home')
    await refreshWorkspaces()
    pushToast('Space deleted.', 'success')
  }, [activeWorkspaceId, api, pushToast, refreshWorkspaces])

  const commitProfile = useCallback((profile: WorkspaceProfile) => {
    setSession(current => {
      if (!current) return current
      const next = { ...current, profile }
      saveWorkspaceSession(next)
      return next
    })
  }, [])

  const syncLoadedProfile = useCallback((nextProfile: WorkspaceProfile) => {
    setData(current => current ? {
      ...current,
      members: current.members.map(member => member.profileId === nextProfile.id ? {
        ...member,
        username: nextProfile.username,
        displayName: nextProfile.displayName,
        initials: nextProfile.initials,
        avatarUrl: nextProfile.avatarUrl,
        bannerUrl: nextProfile.bannerUrl,
        profileAccent: nextProfile.profileAccent,
        bio: nextProfile.bio,
        platformRole: nextProfile.platformRole,
      } : member),
    } : current)
  }, [])

  const updateProfile = useCallback(async (input: Parameters<WorkspaceApi['updateMyProfile']>[0]) => {
    const profile = await api.updateMyProfile(input)
    commitProfile(profile)
    syncLoadedProfile(profile)
    void refreshWorkspace().catch(() => undefined)
    pushToast('Profile updated.', 'success')
  }, [api, commitProfile, pushToast, refreshWorkspace, syncLoadedProfile])

  const setAvatar = useCallback(async (avatarUrl: string | null) => {
    const profile = await api.setMyAvatar(avatarUrl)
    commitProfile(profile)
    syncLoadedProfile(profile)
    void refreshWorkspace().catch(() => undefined)
    pushToast(avatarUrl ? 'Profile photo updated.' : 'Profile photo removed.', 'success')
  }, [api, commitProfile, pushToast, refreshWorkspace, syncLoadedProfile])

  const setBanner = useCallback(async (bannerUrl: string | null) => {
    const profile = await api.setMyBanner(bannerUrl)
    commitProfile(profile)
    syncLoadedProfile(profile)
    void refreshWorkspace().catch(() => undefined)
    pushToast(bannerUrl ? 'Profile banner updated everywhere.' : 'Profile banner removed.', 'success')
  }, [api, commitProfile, pushToast, refreshWorkspace, syncLoadedProfile])

  const listSessions = useCallback(async () => api.listSessions(), [api])

  const revokeSession = useCallback(async (sessionId: string) => {
    await api.revokeSession(sessionId)
    pushToast('Session revoked.', 'success')
  }, [api, pushToast])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const username = session?.profile.username
    if (!username) return
    await api.changePassword(username, currentPassword, newPassword)
    pushToast('Password changed.', 'success')
  }, [api, pushToast, session?.profile.username])

  const getAccountSecurity = useCallback(async () => api.getAccountSecurity(), [api])
  const startEmailVerification = useCallback(async (email: string, currentPassword?: string, twoFactorCode?: string) => {
    const username = session?.profile.username
    return api.startEmailVerification(email, username, currentPassword, twoFactorCode)
  }, [api, session?.profile.username])
  const verifyEmail = useCallback(async (code: string) => api.verifyEmail(code), [api])
  const beginTwoFactorSetup = useCallback(async () => api.beginTwoFactorSetup(), [api])
  const enableTwoFactor = useCallback(async (code: string) => api.enableTwoFactor(code), [api])
  const disableTwoFactor = useCallback(async (code: string) => api.disableTwoFactor(code), [api])
  const regenerateRecoveryCodes = useCallback(async (code: string) => api.regenerateRecoveryCodes(code), [api])
  const getDirectCenter = useCallback(async () => api.getDirectCenter(), [api])
  const requestDirectConversation = useCallback(async (input: { username?: string; targetUserId?: string; sourceWorkspaceId?: string | null }) => api.requestDirectConversation(input), [api])
  const acceptDirectConversation = useCallback(async (conversationId: string) => api.acceptDirectConversation(conversationId), [api])
  const declineDirectConversation = useCallback(async (conversationId: string) => api.declineDirectConversation(conversationId), [api])
  const listDirectMessages = useCallback(async (conversationId: string) => api.listDirectMessages(conversationId), [api])
  const sendDirectMessage = useCallback(async (conversationId: string, body: string) => api.sendDirectMessage(conversationId, body), [api])
  const createDirectGroup = useCallback(async (name: string, memberUserIds: string[]) => api.createDirectGroup(name, memberUserIds), [api])
  const updateDirectGroup = useCallback(async (groupId: string, name: string) => api.updateDirectGroup(groupId, name), [api])
  const listDirectGroupMessages = useCallback(async (groupId: string) => api.listDirectGroupMessages(groupId), [api])
  const sendDirectGroupMessage = useCallback(async (groupId: string, body: string) => api.sendDirectGroupMessage(groupId, body), [api])
  const getWorkspaceDmPreference = useCallback(async (workspaceId: string) => api.getWorkspaceDmPreference(workspaceId), [api])
  const updateWorkspaceDmPreference = useCallback(async (workspaceId: string, allowDms: boolean) => api.updateWorkspaceDmPreference(workspaceId, allowDms), [api])
  const setPlatformSupportRole = useCallback(async (userId: string, role: 'support' | null) => {
    await api.setPlatformSupportRole(userId, role)
    await refreshWorkspace()
    pushToast(role === 'support' ? 'Support access granted.' : 'Support access removed.', 'success')
  }, [api, pushToast, refreshWorkspace])

  const listModerationReports = useCallback(async () => api.listModerationReports(), [api])
  const updateModerationReport = useCallback(async (reportId: string, status: 'reviewed' | 'dismissed') => {
    await api.updateReportStatus(reportId, status)
  }, [api])
  const banPlatformUser = useCallback(async (userId: string, reason: string, reportId: string | null = null) => {
    await api.banUser(userId, reason, reportId)
    pushToast('Account banned from Spaces.', 'success')
  }, [api, pushToast])
  const unbanPlatformUser = useCallback(async (userId: string) => {
    await api.unbanUser(userId)
    pushToast('Account ban removed.', 'success')
  }, [api, pushToast])
  const createSupportCase = useCallback(async (input: { kind: WorkspaceSupportCaseKind; subject: string; details: string; workspaceId?: string | null; priority?: WorkspaceSupportPriority }) => api.createSupportCase(input), [api])
  const listSupportCases = useCallback(async () => api.listSupportCases(), [api])
  const updateSupportCase = useCallback(async (caseId: string, input: { status?: WorkspaceSupportCaseStatus; priority?: WorkspaceSupportPriority; assignToMe?: boolean }) => api.updateSupportCase(caseId, input), [api])
  const listSupportMessages = useCallback(async () => api.listSupportMessages(), [api])
  const sendSupportMessage = useCallback(async (input: { recipientUserId: string; subject: string; body: string; caseId?: string | null }) => api.sendSupportMessage(input), [api])
  const searchSupportUsers = useCallback(async (query: string) => api.searchSupportUsers(query), [api])
  const listSupportStaffMessages = useCallback(async () => api.listSupportStaffMessages(), [api])
  const sendSupportStaffMessage = useCallback(async (body: string) => api.sendSupportStaffMessage(body), [api])
  const restrictSupportSpace = useCallback(async (workspaceId: string, reason: string) => {
    await api.restrictSupportSpace(workspaceId, reason)
    pushToast('Space restricted to read-only.', 'success')
  }, [api, pushToast])
  const unrestrictSupportSpace = useCallback(async (workspaceId: string) => {
    await api.unrestrictSupportSpace(workspaceId)
    pushToast('Space restriction removed.', 'success')
  }, [api, pushToast])
  const deleteSupportSpace = useCallback(async (workspaceId: string, confirmation: string, reason: string) => {
    await api.deleteSupportSpace(workspaceId, confirmation, reason)
    pushToast('Space deleted by Support.', 'success')
    if (workspaceId === activeWorkspaceId) goHome()
    await refreshWorkspaces()
  }, [activeWorkspaceId, api, goHome, pushToast, refreshWorkspaces])

  const listBetaAccess = useCallback(async () => api.listBetaAccess(), [api])
  const inviteBetaEmail = useCallback(async (email: string, options?: { subject?: string; message?: string }) => api.inviteBetaEmail(email, options), [api])
  const revokeBetaAccess = useCallback(async (accessId: string) => {
    await api.revokeBetaAccess(accessId)
    pushToast('Beta access revoked.', 'success')
  }, [api, pushToast])

  const activeWorkspace = data?.workspace?.id === activeWorkspaceId
    ? data.workspace
    : workspaces.find(item => item.id === activeWorkspaceId) ?? null
  const activeChannel = data?.channels.find(item => item.id === activeChannelId) ?? null

  const value = useMemo<SpacesContextValue>(() => ({
    apiUrl: SPACES_API_URL,
    session,
    profile,
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    data,
    activeChannelId,
    activeChannel,
    view,
    loading,
    workspaceLoading,
    error,
    memberRailOpen,
    mobileNavOpen,
    commandOpen,
    toasts,
    notifications,
    clearNotifications,
    login,
    completeBetaProfile,
    logout,
    goHome,
    chooseWorkspace,
    chooseChannel,
    setView,
    setMemberRailOpen,
    setMobileNavOpen,
    setCommandOpen,
    refreshWorkspaces,
    refreshWorkspace,
    createWorkspace,
    joinWorkspace,
    createChannel,
    deleteChannel,
    updateChannelPermissions,
    listChannelPermissionOverwrites,
    saveChannelPermissionOverwrite,
    deleteChannelPermissionOverwrite,
    reportUser,
    sendMessage,
    editMessage,
    deleteMessage,
    saveNote,
    deleteNote,
    addComment,
    deleteComment,
    createRole,
    updateRole,
    updateBaseRoleSetting,
    reorderRoles,
    deleteRole,
    upgradeRoleModel,
    setMemberRoles,
    changeMemberRole,
    removeMember,
    createEmoji,
    deleteEmoji,
    updateWorkspace,
    leaveWorkspace,
    deleteWorkspace,
    updateProfile,
    setAvatar,
    setBanner,
    listSessions,
    revokeSession,
    changePassword,
    getAccountSecurity,
    startEmailVerification,
    verifyEmail,
    beginTwoFactorSetup,
    enableTwoFactor,
    disableTwoFactor,
    regenerateRecoveryCodes,
    getDirectCenter, requestDirectConversation, acceptDirectConversation, declineDirectConversation, listDirectMessages, sendDirectMessage, createDirectGroup, updateDirectGroup, listDirectGroupMessages, sendDirectGroupMessage, getWorkspaceDmPreference, updateWorkspaceDmPreference,
    setPlatformSupportRole,
    listModerationReports, updateModerationReport, banPlatformUser, unbanPlatformUser,
    createSupportCase, listSupportCases, updateSupportCase, listSupportMessages, sendSupportMessage,
    searchSupportUsers, listSupportStaffMessages, sendSupportStaffMessage,
    restrictSupportSpace, unrestrictSupportSpace, deleteSupportSpace,
    listBetaAccess, inviteBetaEmail, revokeBetaAccess,
    pushToast,
  }), [
    activeChannel, activeChannelId, activeWorkspace, activeWorkspaceId, addComment, chooseChannel,
    chooseWorkspace, commandOpen, createChannel, deleteChannel, createEmoji, createRole, createWorkspace, data, deleteComment,
    deleteEmoji, deleteMessage, deleteNote, deleteRole, upgradeRoleModel, editMessage, error, goHome, joinWorkspace, loading, login, completeBetaProfile,
    clearNotifications, logout, memberRailOpen, mobileNavOpen, pushToast, refreshWorkspace, refreshWorkspaces, saveNote, updateChannelPermissions, listChannelPermissionOverwrites, saveChannelPermissionOverwrite, deleteChannelPermissionOverwrite, reportUser,
    sendMessage, session, notifications, setMemberRoles, changeMemberRole, removeMember, toasts, updateRole, updateBaseRoleSetting, reorderRoles, updateWorkspace, leaveWorkspace, deleteWorkspace, updateProfile, setAvatar, setBanner, listSessions, revokeSession, changePassword, getAccountSecurity, startEmailVerification, verifyEmail, beginTwoFactorSetup, enableTwoFactor, disableTwoFactor, regenerateRecoveryCodes, getDirectCenter, requestDirectConversation, acceptDirectConversation, declineDirectConversation, listDirectMessages, sendDirectMessage, createDirectGroup, updateDirectGroup, listDirectGroupMessages, sendDirectGroupMessage, getWorkspaceDmPreference, updateWorkspaceDmPreference, setPlatformSupportRole, listModerationReports, updateModerationReport, banPlatformUser, unbanPlatformUser, createSupportCase, listSupportCases, updateSupportCase, listSupportMessages, sendSupportMessage, searchSupportUsers, listSupportStaffMessages, sendSupportStaffMessage, restrictSupportSpace, unrestrictSupportSpace, deleteSupportSpace, listBetaAccess, inviteBetaEmail, revokeBetaAccess, view, workspaceLoading, workspaces,
  ])

  return <SpacesContext.Provider value={value}>{children}</SpacesContext.Provider>
}

export function useSpaces() {
  const value = useContext(SpacesContext)
  if (!value) throw new Error('useSpaces must be used inside SpacesProvider.')
  return value
}
