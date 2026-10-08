import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react'
import { Avatar } from '../../components/Avatar'
import { AnimatedBackdrop } from '../../components/AnimatedImage'
import { SpacesLogo } from '../../components/SpacesLogo'
import { Icon, type IconName } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { ImageCropper } from '../../components/ImageCropper'
import { MemberProfileDrawer } from '../../components/MemberProfileDrawer'
import { NotificationCenter } from '../../components/NotificationCenter'
import { DirectMessagesCenter, type DirectTab } from '../../components/DirectMessagesCenter'
import { WorkspacePrivacyModal } from '../../components/WorkspacePrivacyModal'
import { ContextMenu, useContextMenu, type ContextAction } from '../../components/ContextMenu'
import { ContentSearchPanel, type ContentSearchItem } from '../../components/ContentSearchPanel'
import { CategoryPermissionsEditor, ChannelPermissionsEditor } from '../../components/ChannelPermissionsEditor'
import { ActivityView } from '../activity/ActivityView'
import { ChatView } from '../chat/ChatView'
import { HomeView } from '../home/HomeView'
import { InvitesView } from '../invites/InvitesView'
import { MembersView } from '../members/MembersView'
import { NotesView } from '../notes/NotesView'
import { RolesView } from '../roles/RolesView'
import { SettingsView } from '../settings/SettingsView'
import { WorkspaceOverview } from '../overview/WorkspaceOverview'
import { PersonalSettings, type PersonalSettingsTab } from '../account/PersonalSettings'
import { SupportConsoleV77 as SupportConsole, MobileStaffPanelV77 } from '../support/v77/SupportConsoleV77'
import { SupportGlyphV73 } from '../support/SupportTicketsV73'
import { useAppDialog } from '../../components/AppDialog'
import { StaffView } from '../staff/StaffView'
import { useSpaces, type AppView, type SpacesNotification } from '../../state/SpacesContext'
import { usePreferences } from '../../state/PreferencesContext'
import { normalizeChannelName } from '../../utils/format'
import { EMOJI_CATEGORIES } from '../../utils/default-emojis'
import {
  buildThreadDescription, channelThreadChildren, channelThreadParent, cleanThreadDescription,
  createChannelCategory, deleteChannelCategory, getWorkspaceNumber, loadChannelMeta, renameChannelCategory,
  moveChannelInMeta, moveChannelCategory, setChannelCategory, setChannelIcon, setChannelThreadParent, sortChannelsByMeta,
  workspaceRoleDisplayName, getCategoryPermissionTemplate, setChannelPermissionSyncCategory, channelPermissionOverridesEqual, type ChannelCategoryMeta, type ChannelIconChoice,
} from '../../utils/workspace-local-meta'
import { startPressDrag } from '../../utils/press-drag'
import { gifFileToDataUrl, imageFileToRawDataUrl, isGifFile } from '../../utils/image'
import { playSpacesNotificationSound, playSpacesQueueAlert, playSpacesSupportSound } from '../../utils/notification-sound'
import { clearDesktopAttention, requestDesktopAttention, syncDesktopUnread } from '../../utils/desktop-unread'
import { sendMobileNotificationV72, sendMobileTextNotificationV72 } from '../../utils/native-notifications'
import { hasWorkspacePermission, platformRoleLabel } from '../../utils/permissions'
import { updateSocialPresence } from '../../api/social-api'
import { dismissNotifications } from '../../utils/notification-read'
import type { WorkspaceChannel, WorkspaceSummary, WorkspaceDirectCenter } from '../../types/spaces'
import '../../styles/standalone-v54.css'
import '../../styles/standalone-v55.css'
import '../../styles/standalone-v56.css'
import { SupportIntakeHostV77 } from '../support/v77/SupportIntakeV77'
import { SpacesDmCallHostV812 } from '../voice/v81/SpacesDmCallHostV812'
import { GlobalProfileHostV77 } from '../support/v77/GlobalProfileV77'

const navItems: { view: AppView; label: string; icon: IconName }[] = [
  { view: 'members', label: 'People', icon: 'members' },
  { view: 'activity', label: 'Activity', icon: 'activity' },
  { view: 'invites', label: 'Invites', icon: 'plus' },
  { view: 'staff', label: 'Space Staff', icon: 'shield' },
  { view: 'roles', label: 'Roles & Permissions', icon: 'roles' },
  { view: 'settings', label: 'Settings', icon: 'settings' },
]

const channelIconPresets: { id: string; label: string; icon: IconName }[] = [
  ['hash','Text'], ['chat','Chat'], ['notes','Notes'], ['message','Message'], ['bell','News'], ['pin','Pinned'],
  ['members','People'], ['user','Person'], ['roles','Roles'], ['shield','Shield'], ['lock','Private'], ['globe','Public'],
  ['home','Home'], ['grid','Grid'], ['activity','Activity'], ['sparkle','Spark'], ['emoji','Emoji'], ['settings','Settings'],
  ['search','Search'], ['command','Command'], ['plus','Add'], ['check','Check'], ['more','More'], ['edit','Edit'],
  ['paperclip','File'], ['upload','Upload'], ['download','Download'], ['copy','Copy'], ['reply','Reply'], ['send','Send'],
  ['refresh','Refresh'], ['rotate','Rotate'], ['monitor','Desktop'], ['tablet','Tablet'], ['phone','Phone'],
  ['menu','Menu'], ['chevron','Arrow'], ['x','Close'], ['trash','Trash'], ['logout','Exit'], ['maximize','Expand'], ['minimize','Collapse'],
] .map(([id, label]) => ({ id, label, icon: id as IconName }))


export function AppShell() {
  const dialog = useAppDialog()
  const { effectivePresence, preferences, setPreference } = usePreferences()
  const contextMenu = useContextMenu()
  const {
    apiUrl, session, profile, workspaces, activeWorkspaceId, activeWorkspace, data, activeChannel, view,
    memberRailOpen, mobileNavOpen, commandOpen, workspaceLoading, toasts, notifications,
    goHome, chooseWorkspace, chooseChannel, setView, setMemberRailOpen, setMobileNavOpen,
    setCommandOpen, createWorkspace, joinWorkspace, createChannel, deleteChannel, createSupportCase, pushToast,
    listModerationReports, listSupportCases, getDirectCenter, refreshWorkspace, listChannelPermissionOverwrites, saveChannelPermissionOverwrite, deleteChannelPermissionOverwrite,
  } = useSpaces()
  const [spaceDialog, setSpaceDialog] = useState<'create' | 'join' | null>(null)
  const [spaceValue, setSpaceValue] = useState('')
  const [spaceDescription, setSpaceDescription] = useState('')
  const [spaceAvatarUrl, setSpaceAvatarUrl] = useState<string | null>(null)
  const [spaceAccent, setSpaceAccent] = useState('#8b6ca8')
  const [spaceCropSource, setSpaceCropSource] = useState<string | null>(null)
  const spaceAvatarInput = useRef<HTMLInputElement>(null)
  const canUseAnimatedCreatedSpace = profile?.platformRole === 'founder' && (profile?.username?.toLowerCase() === 'spagotei' || profile?.publicUserId === '0001' || profile?.publicUserId === '00001')
  const createdSpaceImageAccept = canUseAnimatedCreatedSpace ? 'image/png,image/jpeg,image/webp,image/gif' : 'image/png,image/jpeg,image/webp'
  const [channelDialog, setChannelDialog] = useState(false)
  const [channelName, setChannelName] = useState('')
  const [channelDescription, setChannelDescription] = useState('')
  const [channelKind, setChannelKind] = useState<'chat' | 'notes' | 'mixed' | 'announcement'>('chat')
  const [channelCategoryId, setChannelCategoryId] = useState<string | null>(null)
  const [channelIconChoice, setChannelIconChoice] = useState<ChannelIconChoice>({ kind: 'icon', value: 'hash' })
  const [categoryDialog, setCategoryDialog] = useState(false)
  const [channelIconTarget, setChannelIconTarget] = useState<WorkspaceChannel | null>(null)
  const [categoryName, setCategoryName] = useState('')
  const [channelThreadParentId, setChannelThreadParentId] = useState<string | null>(null)
  const [channelMetaVersion, setChannelMetaVersion] = useState(0)
  const [draggingChannelId, setDraggingChannelId] = useState<string | null>(null)
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const sidebarDragClickSuppressUntil = useRef(0)
  const [busy, setBusy] = useState(false)
  const [profileDialog, setProfileDialog] = useState<PersonalSettingsTab | null>(null)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [previewBackground, setPreviewBackground] = useState<string | null>(null)
  const [selectedRailMember, setSelectedRailMember] = useState<string | null>(null)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [noticePeek, setNoticePeek] = useState<SpacesNotification | null>(null)
  const [channelPermissionTarget, setChannelPermissionTarget] = useState<WorkspaceChannel | null>(null)
  const [categoryPermissionTarget, setCategoryPermissionTarget] = useState<ChannelCategoryMeta | null>(null)
  const [pendingPermissionMoveV70, setPendingPermissionMoveV70] = useState<{ channelId: string; targetCategoryId: string; beforeChannelId: string | null } | null>(null)
  const [supportConsoleOpen, setSupportConsoleOpen] = useState(false)
  // SPACES_V81_3_TEAM_NAV: the Founder alone sees this shortcut. Server checks every mutation.
  const [founderTeamLookupV813, setFounderTeamLookupV813] = useState('')
  useEffect(() => {
    const openTeam = (event: Event) => {
      if (profile?.platformRole !== 'founder') return
      const username = (event as CustomEvent<{ username?: string }>).detail?.username ?? ''
      setFounderTeamLookupV813(username.slice(0,48))
      setSupportConsoleOpen(true)
    }
    window.addEventListener('spaces-founder-team-v813', openTeam)
    return () => window.removeEventListener('spaces-founder-team-v813', openTeam)
  }, [profile?.platformRole])
  const [mobileStaffOpenV77, setMobileStaffOpenV77] = useState(false)
  const [supportQueueCount, setSupportQueueCount] = useState(0)
  const supportQueueInitialized = useRef(false)
  const [channelNavCollapsed, setChannelNavCollapsed] = useState(false)
  const [channelNavWidth, setChannelNavWidth] = useState(() => {
    const stored = Number(localStorage.getItem('spaces.channelNavWidth.v53') || 238)
    return Number.isFinite(stored) ? Math.max(184, Math.min(360, stored)) : 238
  })
  const [channelNavResizing, setChannelNavResizing] = useState(false)
  const channelNavResizeState = useRef<{ startX: number; startWidth: number; lastRaw: number; allowCollapse: boolean } | null>(null)
  const [directCenterOpen, setDirectCenterOpen] = useState(false)
  const [directConversationId, setDirectConversationId] = useState<string | null>(null)
  const [directGroupId, setDirectGroupId] = useState<string | null>(null)
  const [directPageTab, setDirectPageTab] = useState<DirectTab>('friends')
  const [directRecentV70, setDirectRecentV70] = useState<Record<string, { lastAt: number; preview: string }>>(() => { try { return JSON.parse(localStorage.getItem('spaces.directRecent.v70') || '{}') } catch { return {} } })
  const [directSidebarCenter, setDirectSidebarCenter] = useState<WorkspaceDirectCenter>({ conversations: [], friends: [], incomingRequests: [], outgoingRequests: [], groups: [] })
  const [supportSidebarSummary, setSupportSidebarSummary] = useState({ hasMessages: false, lastAt: 0, preview: '' })
  const [activeSupportTicketsV753, setActiveSupportTicketsV753] = useState(0)
  const [waitingSupportTicketsV753, setWaitingSupportTicketsV753] = useState(0)
  const [pinnedDirectKeys, setPinnedDirectKeys] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('spaces.pinnedDirects.v54') || '[]') as string[] } catch { return [] }
  })
  const [directActivityV69, setDirectActivityV69] = useState<Record<string, { at: number; preview?: string }>>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('spaces.directActivity.v69') || '{}') as Record<string, { at?: number; preview?: string }>
      const clean: Record<string, { at: number; preview?: string }> = {}
      for (const [key, value] of Object.entries(parsed ?? {})) {
        const at = Number(value?.at ?? 0)
        if (at > 0) clean[key] = { at, preview: typeof value?.preview === 'string' ? value.preview : undefined }
      }
      return clean
    } catch {
      return {}
    }
  })
  const [workspacePrivacyOpen, setWorkspacePrivacyOpen] = useState<WorkspaceSummary | null>(null)
  const [spaceSearchTitleV71, setSpaceSearchTitleV71] = useState<string | null>(null)
  const [, forceTheme] = useState(0)
  const mobileSwipeStart = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => { const rerender = () => forceTheme(value => value + 1); window.addEventListener('spaces-theme-updated', rerender); return () => window.removeEventListener('spaces-theme-updated', rerender) }, [])
  useEffect(() => { document.title = 'Spaces' }, [])

  const presenceHydratedFor = useRef('')
  useEffect(() => {
    if (!profile) return
    if (presenceHydratedFor.current === profile.id) return
    presenceHydratedFor.current = profile.id
    setPreference(
      'presence',
      profile.presence === 'invisible'
        ? 'offline'
        : profile.presence === 'idle' || profile.presence === 'dnd' || profile.presence === 'online'
          ? profile.presence
          : 'online',
    )
    setPreference('customStatus', profile.customStatus ?? '')
  }, [profile?.id])

  // SPACES_PRESENCE_HEARTBEAT_V65
  useEffect(() => {
    if (!session?.token || !profile?.id || presenceHydratedFor.current !== profile.id) return

    let stopped = false

    const syncPresence = () => {
      if (stopped) return
      void updateSocialPresence(
        session.token,
        preferences.presence === 'offline' ? 'invisible' : preferences.presence,
        preferences.customStatus,
      ).catch(() => undefined)
    }

    const initialTimer = window.setTimeout(syncPresence, 260)
    const heartbeat = window.setInterval(syncPresence, 25_000)

    const onVisible = () => {
      if (!document.hidden) syncPresence()
    }

    window.addEventListener('focus', syncPresence)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      stopped = true
      window.clearTimeout(initialTimer)
      window.clearInterval(heartbeat)
      window.removeEventListener('focus', syncPresence)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [preferences.customStatus, preferences.presence, profile?.id, session?.token])
  useEffect(() => {
    if (!channelNavResizing) return
    const move = (event: PointerEvent) => {
      const drag = channelNavResizeState.current
      if (!drag) return
      const raw = drag.startWidth + event.clientX - drag.startX
      drag.lastRaw = raw
      setChannelNavWidth(Math.max(184, Math.min(360, raw)))
    }
    const up = () => {
      const drag = channelNavResizeState.current
      channelNavResizeState.current = null
      setChannelNavResizing(false)
      if (!drag) return
      if (drag.allowCollapse && drag.lastRaw < 164) {
        setChannelNavCollapsed(true)
        return
      }
      const next = Math.max(184, Math.min(360, drag.lastRaw))
      setChannelNavWidth(next)
      localStorage.setItem('spaces.channelNavWidth.v53', String(Math.round(next)))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [channelNavResizing])
  function beginChannelNavResize(event: ReactPointerEvent<HTMLButtonElement>) {
    if (window.innerWidth <= 900) return
    event.preventDefault()
    event.stopPropagation()
    setChannelNavCollapsed(false)
    channelNavResizeState.current = {
      startX: event.clientX,
      startWidth: channelNavWidth,
      lastRaw: channelNavWidth,
      allowCollapse: Boolean(activeWorkspaceId),
    }
    setChannelNavResizing(true)
  }
  useEffect(() => {
    const onTouchStart = (event: TouchEvent) => {
      if (window.innerWidth > 900 || event.touches.length !== 1) return
      const touch = event.touches[0]
      if (!mobileNavOpen && touch.clientX > 34) { mobileSwipeStart.current = null; return }
      mobileSwipeStart.current = { x: touch.clientX, y: touch.clientY }
    }
    const onTouchEnd = (event: TouchEvent) => {
      const start = mobileSwipeStart.current
      mobileSwipeStart.current = null
      if (!start || window.innerWidth > 900 || event.changedTouches.length < 1) return
      const touch = event.changedTouches[0]
      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y
      if (Math.abs(dx) < 56 || Math.abs(dx) <= Math.abs(dy) * 1.25) return
      if (!mobileNavOpen && dx > 0) setMobileNavOpen(true)
      else if (mobileNavOpen && dx < 0) setMobileNavOpen(false)
    }
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [mobileNavOpen, setMobileNavOpen])
  useEffect(() => {
    if (directCenterOpen || profileDialog) setMobileNavOpen(false)
  }, [directCenterOpen, profileDialog, setMobileNavOpen])
  useEffect(() => {
    if (!activeWorkspaceId) setMobileNavOpen(false)
  }, [activeWorkspaceId, setMobileNavOpen])
  useEffect(() => { const sync = () => setChannelMetaVersion(value => value + 1); window.addEventListener('spaces-channel-meta-changed', sync); return () => window.removeEventListener('spaces-channel-meta-changed', sync) }, [])
  useEffect(() => {
    // Tauri/WebView should feel like an app, not a webpage. Context-enabled
    // controls still open the Spaces menu because their handlers run first.
    const suppressNativeMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target?.closest('.spaces-app-shell')) return
      event.preventDefault()
    }
    window.addEventListener('contextmenu', suppressNativeMenu)
    return () => window.removeEventListener('contextmenu', suppressNativeMenu)
  }, [])
  useEffect(() => {
    if (!accountMenuOpen) return
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('.account-quick-menu') || target?.closest('.account-identity')) return
      setAccountMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setAccountMenuOpen(false) }
    window.addEventListener('pointerdown', closeOutside, true)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('pointerdown', closeOutside, true)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [accountMenuOpen])
  useEffect(() => { const preview = (event: Event) => setPreviewBackground((event as CustomEvent<string>).detail); window.addEventListener('spaces-background-preview', preview); return () => window.removeEventListener('spaces-background-preview', preview) }, [])
  useEffect(() => setPreviewBackground(null), [activeWorkspaceId])
  useEffect(() => { const open = () => setNotificationOpen(true); window.addEventListener('spaces-open-notifications', open); return () => window.removeEventListener('spaces-open-notifications', open) }, [])
  useEffect(() => {
    const open = (event: Event) => {
      const detail = (event as CustomEvent<{ conversationId?: string | null; groupId?: string | null }>).detail
      const conversationId = detail?.conversationId ?? null
      const groupId = detail?.groupId ?? null
      goHome()
      setDirectConversationId(conversationId)
      setDirectGroupId(groupId)
      setDirectPageTab(conversationId ? 'friends' : groupId ? 'groups' : 'friends')
      setDirectCenterOpen(true)
      setMobileNavOpen(false)
    }
    window.addEventListener('spaces-open-direct-center', open)
    return () => window.removeEventListener('spaces-open-direct-center', open)
  }, [goHome, setMobileNavOpen])

  useEffect(() => {
    const switchTab = (event: Event) => {
      const requested = (event as CustomEvent<DirectTab | 'people'>).detail
      const next: DirectTab = requested === 'people' ? 'friends' : requested
      if (!['friends', 'support', 'requests', 'groups', 'add'].includes(next)) return
      goHome()
      setDirectConversationId(null)
      setDirectGroupId(null)
      setDirectPageTab(next)
      setDirectCenterOpen(true)
      setMobileNavOpen(false)
    }
    window.addEventListener('spaces-direct-tab', switchTab)
    return () => window.removeEventListener('spaces-direct-tab', switchTab)
  }, [goHome, setMobileNavOpen])

  useEffect(() => {
    if (!session?.token) {
      setDirectSidebarCenter({ conversations: [], friends: [], incomingRequests: [], outgoingRequests: [], groups: [] })
      setSupportSidebarSummary({ hasMessages: false, lastAt: 0, preview: '' })
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const center = await getDirectCenter()
        if (!cancelled) setDirectSidebarCenter({
          ...center,
          conversations: center.conversations ?? [],
          incomingRequests: center.incomingRequests ?? [],
          outgoingRequests: center.outgoingRequests ?? [],
          groups: center.groups ?? [],
        })
      } catch { /* Sidebar DMs should never block the shell. */ }
      try {
        const response = await fetch(`${apiUrl}/v1/support/inbox`, { headers: { Authorization: `Bearer ${session.token}` } })
        if (response.ok) {
          const items = await response.json() as { body: string; createdAt: number }[]
          const last = items[items.length - 1]
          if (!cancelled) setSupportSidebarSummary({ hasMessages: items.length > 0, lastAt: Number(last?.createdAt ?? 0), preview: String(last?.body ?? '') })
        }
      } catch { /* Support history may be unavailable during an upgrade. */ }
    }
    const refreshFromSignal = () => void load()
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }

    void load()
    window.addEventListener('spaces-direct-sidebar-refresh', refreshFromSignal)
    window.addEventListener('focus', refreshFromSignal)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    const timer = window.setInterval(() => void load(), 2000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('spaces-direct-sidebar-refresh', refreshFromSignal)
      window.removeEventListener('focus', refreshFromSignal)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [apiUrl, getDirectCenter, session?.token])

  function markDirectActivityV69(
    kind: 'direct' | 'group' | 'support',
    id: string,
    preview?: string,
    at = Date.now(),
  ) {
    const key = kind === 'support' ? 'support' : (kind === 'direct' ? 'dm:' : 'group:') + id
    setDirectActivityV69(current => {
      const next = { ...current, [key]: { at: Math.max(at, current[key]?.at ?? 0), preview: preview ?? current[key]?.preview } }
      const trimmed = Object.fromEntries(
        Object.entries(next)
          .sort(([, left], [, right]) => right.at - left.at)
          .slice(0, 50),
      ) as Record<string, { at: number; preview?: string }>
      localStorage.setItem('spaces.directActivity.v69', JSON.stringify(trimmed))
      return trimmed
    })
  }

  useEffect(() => {
    const onActivity = (event: Event) => {
      const detail = (event as CustomEvent<{
        kind?: 'direct' | 'group' | 'support'
        id?: string | null
        preview?: string
        at?: number
      }>).detail
      if (!detail?.kind) return
      const id = detail.kind === 'support' ? 'support' : String(detail.id ?? '')
      if (!id) return
      markDirectActivityV69(detail.kind, id, detail.preview, Number(detail.at ?? Date.now()))
    }

    const onNotificationPeek = (event: Event) => {
      const item = (event as CustomEvent<SpacesNotification>).detail
      if (!item) return
      if (item.kind === 'direct' && item.conversationId) {
        markDirectActivityV69('direct', item.conversationId, item.preview, Number(item.createdAt ?? Date.now()))
      } else if (item.kind === 'group' && item.groupId) {
        markDirectActivityV69('group', item.groupId, item.preview, Number(item.createdAt ?? Date.now()))
      } else if (item.kind === 'support') {
        markDirectActivityV69('support', 'support', item.preview, Number(item.createdAt ?? Date.now()))
      } else {
        return
      }
      window.dispatchEvent(new Event('spaces-direct-sidebar-refresh'))
    }

    window.addEventListener('spaces-direct-activity-v69', onActivity)
    window.addEventListener('spaces-notification-peek', onNotificationPeek)
    return () => {
      window.removeEventListener('spaces-direct-activity-v69', onActivity)
      window.removeEventListener('spaces-notification-peek', onNotificationPeek)
    }
  }, [])

  useEffect(() => {
    if (!notifications.length) return

    const latestDirect = [...notifications]
      .filter(item => item.kind === 'direct' || item.kind === 'group' || item.kind === 'support')
      .sort((left, right) => Number(right.createdAt ?? 0) - Number(left.createdAt ?? 0))[0]

    if (latestDirect?.kind === 'direct' && latestDirect.conversationId) {
      markDirectActivityV69('direct', latestDirect.conversationId, latestDirect.preview, Number(latestDirect.createdAt ?? Date.now()))
    } else if (latestDirect?.kind === 'group' && latestDirect.groupId) {
      markDirectActivityV69('group', latestDirect.groupId, latestDirect.preview, Number(latestDirect.createdAt ?? Date.now()))
    } else if (latestDirect?.kind === 'support') {
      markDirectActivityV69('support', 'support', latestDirect.preview, Number(latestDirect.createdAt ?? Date.now()))
    }

    const timer = window.setTimeout(() => {
      window.dispatchEvent(new Event('spaces-direct-sidebar-refresh'))
    }, 30)
    return () => window.clearTimeout(timer)
  }, [notifications])

  useEffect(() => {
    const activity = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string; lastAt?: number; preview?: string }>).detail ?? {}
      if (!detail.key) return
      setDirectRecentV70(current => { const next = { ...current, [detail.key!]: { lastAt: Number(detail.lastAt ?? Date.now()), preview: String(detail.preview ?? '') } }; localStorage.setItem('spaces.directRecent.v70', JSON.stringify(next)); return next })
    }
    window.addEventListener('spaces-direct-activity', activity)
    return () => window.removeEventListener('spaces-direct-activity', activity)
  }, [])

  function togglePinnedDirect(key: string) {
    setPinnedDirectKeys(current => {
      const next = current.includes(key) ? current.filter(item => item !== key) : [...current, key]
      localStorage.setItem('spaces.pinnedDirects.v54', JSON.stringify(next))
      return next
    })
  }


  async function updateSidebarThreadPreference(
    item: (typeof sidebarDmItems)[number],
    input: { pinned?: boolean; muteMinutes?: number; unmute?: boolean; closed?: boolean },
  ) {
    if (!session?.token) return

    const kind = item.kind === 'direct' ? 'dm' : item.kind === 'group' ? 'group' : 'support'
    const id = item.kind === 'support' ? 'support' : item.id
    if (!id) return

    try {
      const response = await fetch(
        `${apiUrl}/v1/direct/preferences/${kind}/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${session.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        },
      )

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(payload?.error || 'Could not update that conversation.')
      }

      if (typeof input.pinned === 'boolean') {
        setPinnedDirectKeys(current => {
          const has = current.includes(item.key)
          const next = input.pinned
            ? (has ? current : [...current, item.key])
            : current.filter(key => key !== item.key)
          localStorage.setItem('spaces.pinnedDirects.v54', JSON.stringify(next))
          return next
        })
      }

      const center = await getDirectCenter()
      setDirectSidebarCenter({
        ...center,
        conversations: center.conversations ?? [],
        incomingRequests: center.incomingRequests ?? [],
        outgoingRequests: center.outgoingRequests ?? [],
        groups: center.groups ?? [],
      })

      if (input.closed) {
        if (item.kind === 'direct' && directConversationId === item.id) {
          setDirectConversationId(null)
        }
        if (item.kind === 'group' && directGroupId === item.id) {
          setDirectGroupId(null)
        }
      }
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : 'Could not update that conversation.',
        'danger',
      )
    }
  }

  function sidebarThreadActions(item: (typeof sidebarDmItems)[number]) {
    const muted = Boolean(item.mutedUntil && item.mutedUntil > Date.now())
    const pinned = Boolean(item.pinnedAt) || pinnedDirectKeys.includes(item.key)
    const noun = item.kind === 'group' ? 'Group DM' : item.kind === 'support' ? 'Support Tickets' : 'DM'

    return [
      {
        id: 'pin',
        label: pinned ? `Unpin ${noun}` : `Pin ${noun}`,
        icon: 'pin' as const,
        checked: pinned,
        onSelect: () => updateSidebarThreadPreference(item, { pinned: !pinned }),
      },
      ...(muted
        ? [{
            id: 'unmute',
            label: `Unmute ${noun}`,
            icon: 'bell' as const,
            onSelect: () => updateSidebarThreadPreference(item, { unmute: true }),
          }]
        : [{
            id: 'mute',
            label: `Mute ${noun}`,
            icon: 'bell' as const,
            onSelect: () => updateSidebarThreadPreference(item, { muteMinutes: -1 }),
            submenu: [
              {
                id: 'mute-1h',
                label: 'For 1 hour',
                icon: 'bell' as const,
                onSelect: () => updateSidebarThreadPreference(item, { muteMinutes: 60 }),
              },
              {
                id: 'mute-8h',
                label: 'For 8 hours',
                icon: 'bell' as const,
                onSelect: () => updateSidebarThreadPreference(item, { muteMinutes: 480 }),
              },
              {
                id: 'mute-24h',
                label: 'For 24 hours',
                icon: 'bell' as const,
                onSelect: () => updateSidebarThreadPreference(item, { muteMinutes: 1440 }),
              },
              {
                id: 'mute-forever',
                label: 'Until I turn it back on',
                icon: 'bell' as const,
                checked: true,
                onSelect: () => updateSidebarThreadPreference(item, { muteMinutes: -1 }),
              },
            ],
          }]),
      {
        id: 'close',
        label: item.kind === 'group' ? 'Close Group DM' : item.kind === 'support' ? 'Close Support Tickets' : 'Close DM',
        icon: 'x' as const,
        separatorBefore: true,
        onSelect: () => updateSidebarThreadPreference(item, { closed: true }),
      },
    ]
  }

  function openDirectPage(tab: DirectTab, conversationId: string | null = null, groupId: string | null = null) {
    if (conversationId) markDirectActivityV69('direct', conversationId)
    else if (groupId) markDirectActivityV69('group', groupId)
    else if (tab === 'support') markDirectActivityV69('support', 'support')
    if (conversationId || groupId || tab === 'support') {
      window.dispatchEvent(new Event('spaces-direct-sidebar-refresh'))
    }
    if (tab === 'support') dismissNotifications({ kind: 'support' })
    if (tab === 'requests') dismissNotifications({ kind: 'friend_request' })
    if (conversationId) dismissNotifications({ kind: 'direct', conversationId })
    if (groupId) dismissNotifications({ kind: 'group', groupId })
    goHome()
    setDirectConversationId(conversationId)
    setDirectGroupId(groupId)
    setDirectPageTab(tab)
    setDirectCenterOpen(true)
    setMobileNavOpen(false)
    const key = tab === 'support' ? 'support' : conversationId ? `dm:${conversationId}` : groupId ? `group:${groupId}` : ''
    if (key) window.dispatchEvent(new CustomEvent('spaces-direct-activity', { detail: { key, lastAt: Date.now(), preview: '' } }))
  }

  function openSpacesHome() {
    setDirectCenterOpen(false)
    setDirectConversationId(null)
    setDirectGroupId(null)
    setDirectPageTab('friends')
    goHome()
  }

  useEffect(() => {
    let timer = 0
    const show = (event: Event) => {
      const item = (event as CustomEvent<SpacesNotification>).detail
      const globalDirect = item.kind === 'support' || item.kind === 'direct' || item.kind === 'group' || item.kind === 'friend_request'
      const muted = globalDirect
        ? false
        : preferences.mutedWorkspaceIds.includes(item.workspaceId) || preferences.mutedChannelIds.includes(item.channelId)
      const blockedKind =
        (item.kind === 'mention' && !preferences.mentionNotifications) ||
        ((item.kind === 'everyone' || item.kind === 'here') && !preferences.everyoneNotifications) ||
        (item.kind === 'role' && !preferences.roleNotifications) ||
        (item.kind === 'support' && !preferences.supportNotifications) ||
        (item.kind === 'direct' && !preferences.directNotifications) ||
        (item.kind === 'group' && !preferences.groupNotifications) ||
        (item.kind === 'friend_request' && !preferences.friendRequestNotifications) ||
        (item.kind === 'comment' && !preferences.commentNotifications)
      const blockedLevel = globalDirect
        ? false
        : item.kind === 'message'
          ? preferences.notificationLevel !== 'all'
          : preferences.notificationLevel === 'none'
      if (muted || blockedKind || blockedLevel || preferences.presence === 'dnd') return
      if (preferences.notificationPreviews) setNoticePeek(item)
      if (preferences.mobileSystemNotifications && document.visibilityState !== 'visible') {
        void sendMobileNotificationV72(item, preferences.notificationPreviews)
      }
      if (preferences.desktopSounds) {
        if (item.kind === 'support') {
          const isReply = item.mentionLabel === 'Support reply'
          if (isReply ? preferences.supportReceivedSounds : preferences.supportIncomingSounds) {
            playSpacesSupportSound(isReply ? 'received' : 'incoming')
          }
        } else {
          playSpacesNotificationSound(item.kind)
        }
      }
      void requestDesktopAttention(item.kind === 'friend_request' ? 'request' : 'normal')
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setNoticePeek(null), 5200)
    }
    window.addEventListener('spaces-notification-peek', show)
    return () => { window.clearTimeout(timer); window.removeEventListener('spaces-notification-peek', show) }
  }, [preferences.desktopSounds, preferences.everyoneNotifications, preferences.mentionNotifications, preferences.mutedChannelIds, preferences.mutedWorkspaceIds, preferences.notificationLevel, preferences.notificationPreviews, preferences.mobileSystemNotifications, preferences.directNotifications, preferences.groupNotifications, preferences.friendRequestNotifications, preferences.commentNotifications, preferences.presence, preferences.roleNotifications, preferences.supportIncomingSounds, preferences.supportNotifications, preferences.supportReceivedSounds])

  // Spaces - Hub behaves like a normal Space for its Founder. The only special
  // rules are that membership is permanent and the protected updates channel cannot be deleted.
  const isHubFounder = activeWorkspaceId === 'spaces-hub' && profile?.platformRole === 'founder'
  const canCreateChannel = isHubFounder || hasWorkspacePermission(data, profile?.id, 'create_channels')
  const canManageChannels = isHubFounder || hasWorkspacePermission(data, profile?.id, 'manage_channels')
  const canManageSpace = isHubFounder || hasWorkspacePermission(data, profile?.id, 'manage_space')
  const canInvite = isHubFounder || hasWorkspacePermission(data, profile?.id, 'create_invites')
  const canManageRoles = isHubFounder || hasWorkspacePermission(data, profile?.id, 'manage_roles')
  const canManageMembers = isHubFounder || hasWorkspacePermission(data, profile?.id, 'manage_members')
  const canViewActivity = isHubFounder || hasWorkspacePermission(data, profile?.id, 'view_audit_log')
  const canModerate = isHubFounder || hasWorkspacePermission(data, profile?.id, 'moderate_messages') || hasWorkspacePermission(data, profile?.id, 'moderate_comments')
  const canStaff = canManageRoles || canManageMembers || canModerate || canViewActivity
  const canAccessNavItem = (item: (typeof navItems)[number]) => {
    // People is a normal Space surface, never a staff-only member-management page.
    if (item.view === 'members') return true
    if (item.view === 'staff') return canStaff
    if (item.view === 'roles') return canManageRoles
    if (item.view === 'activity') return canViewActivity
    if (item.view === 'invites') return canInvite
    if (item.view === 'settings') return true
    return true
  }
  useEffect(() => {
    if (!activeWorkspaceId) return
    const denied =
      (view === 'roles' && !canManageRoles) ||
      (view === 'activity' && !canViewActivity) ||
      (view === 'invites' && !canInvite) ||
      (view === 'staff' && !canStaff)
    if (denied) setView('home')
  }, [activeWorkspaceId, canInvite, canManageRoles, canManageSpace, canStaff, canViewActivity, setView, view])
  const background = previewBackground ?? activeWorkspace?.background ?? 'graphite'
  const secondaryAccent = activeWorkspaceId ? (localStorage.getItem(`spaces.theme2.${activeWorkspaceId}`) || '#342044') : '#342044'
  const visibleWorkspaces = workspaces.filter(space => !preferences.hiddenWorkspaceIds.includes(space.id))
  const ownedSpaceCount = workspaces.filter(space => space.id !== 'spaces-hub' && space.ownerId === profile?.id).length
  const canCreateAnotherSpace = canUseAnimatedCreatedSpace || ownedSpaceCount < 3
  const visibleNotifications = notifications.filter(item => {
    if (item.kind === 'support') return preferences.supportNotifications
    if (item.kind === 'direct') return preferences.directNotifications
    if (item.kind === 'group') return preferences.groupNotifications
    if (item.kind === 'friend_request') return preferences.friendRequestNotifications
    if (item.kind === 'comment') return preferences.commentNotifications
    if (preferences.mutedWorkspaceIds.includes(item.workspaceId) || preferences.mutedChannelIds.includes(item.channelId)) return false
    if (item.kind === 'message') return preferences.notificationLevel === 'all'
    if (preferences.notificationLevel === 'none') return false
    if (item.kind === 'mention') return preferences.mentionNotifications
    if (item.kind === 'everyone' || item.kind === 'here') return preferences.everyoneNotifications
    if (item.kind === 'role') return preferences.roleNotifications
    return true
  })
  const appStyle = {
    '--active-accent': preferences.appAccent,
    '--app-accent': preferences.appAccent,
    '--workspace-accent': activeWorkspace?.accentColor ?? preferences.appAccent,
    '--active-accent-2': secondaryAccent,
    '--channel-rail': channelNavCollapsed && activeWorkspaceId ? '0px' : `${channelNavWidth}px`,
  } as CSSProperties

  const hasPersonalDirectAttentionV755 = visibleNotifications.some(item => item.kind === 'direct')
  const hasSupportAttentionV70 = supportQueueCount > 0 || waitingSupportTicketsV753 > 0
  const notificationBadgeTone = hasPersonalDirectAttentionV755 ? 'blue' : hasSupportAttentionV70 ? 'orange' : 'blue'
  const desktopUnreadCountV70 = visibleNotifications.filter(item => !(item.kind === 'support' && item.supportTicketStaff)).length + (hasSupportAttentionV70 ? 1 : 0)

  useEffect(() => {
    void syncDesktopUnread(desktopUnreadCountV70, notificationBadgeTone)
  }, [desktopUnreadCountV70, notificationBadgeTone])

  useEffect(() => {
    const clearAttention = () => void clearDesktopAttention()
    window.addEventListener('focus', clearAttention)
    document.addEventListener('visibilitychange', clearAttention)
    return () => {
      window.removeEventListener('focus', clearAttention)
      document.removeEventListener('visibilitychange', clearAttention)
    }
  }, [])

  const workspaceUnreadCount = (workspaceId: string) =>
    visibleNotifications.filter(item =>
      item.workspaceId === workspaceId &&
      item.kind !== 'support' &&
      item.kind !== 'direct' &&
      item.kind !== 'group' &&
      item.kind !== 'friend_request'
    ).length

  const friendCountV69 = (
    directSidebarCenter as WorkspaceDirectCenter & { friends?: unknown[] }
  ).friends?.length ?? directSidebarCenter.conversations.length

  useEffect(() => {
    let cancelled = false
    const syncSupportTicketsV753 = async () => {
      if (!session?.token) {
        if (!cancelled) { setActiveSupportTicketsV753(0); setWaitingSupportTicketsV753(0) }
        return
      }
      try {
        const response = await fetch(`${apiUrl.replace(/\/$/, '')}/v1/support/tickets`, {
          headers: { Authorization: `Bearer ${session.token}` },
        })
        if (!response.ok) return
        const items = await response.json() as { status?: string; transcriptDeletedAt?: number | null }[]
        const active = items.filter(item => item.status !== 'resolved' && !item.transcriptDeletedAt).length
        const waiting = items.filter(item => item.status === 'waiting' && !item.transcriptDeletedAt).length
        if (!cancelled) {
          setActiveSupportTicketsV753(active)
          setWaitingSupportTicketsV753(waiting)
        }
      } catch {
        // Support sidebar attention is best-effort.
      }
    }
    void syncSupportTicketsV753()
    const timer = window.setInterval(() => void syncSupportTicketsV753(), 4000)
    const sync = () => void syncSupportTicketsV753()
    window.addEventListener('spaces-support-queue-changed', sync)
    window.addEventListener('focus', sync)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('spaces-support-queue-changed', sync)
      window.removeEventListener('focus', sync)
    }
  }, [apiUrl, session?.token])

  const sidebarDmItems = useMemo(() => {
    const items: {
      key: string
      kind: 'support' | 'direct' | 'group'
      id: string | null
      name: string
      preview: string
      lastAt: number
      avatarUrl?: string | null
      initials?: string
      accent?: string
      pinnedAt?: number | null
      mutedUntil?: number | null
    }[] = []

    const supportActivityV69 = directActivityV69.support
    const supportThread = (
      directSidebarCenter as WorkspaceDirectCenter & {
        supportThread?: {
          lastMessage?: string | null
          lastMessageAt?: number | null
          pinnedAt?: number | null
          mutedUntil?: number | null
        } | null
      }
    ).supportThread ?? null

    if (activeSupportTicketsV753 > 0) {
      items.push({
        key: 'support',
        kind: 'support',
        id: null,
        name: 'Support Tickets',
        preview: supportActivityV69?.preview || supportThread?.lastMessage || supportSidebarSummary.preview || 'Spaces Support',
        lastAt: Math.max(
          Number(supportThread?.lastMessageAt ?? supportSidebarSummary.lastAt ?? 0),
          Number(supportActivityV69?.at ?? 0),
        ),
        pinnedAt: supportThread?.pinnedAt ?? null,
        mutedUntil: supportThread?.mutedUntil ?? null,
      })
    }

    for (const conversation of directSidebarCenter.conversations) {
      const activityV69 = directActivityV69[`dm:${conversation.id}`]
      const preference = conversation as typeof conversation & {
        pinnedAt?: number | null
        mutedUntil?: number | null
      }

      items.push({
        key: `dm:${conversation.id}`,
        kind: 'direct',
        id: conversation.id,
        name: conversation.person.displayName,
        preview: activityV69?.preview || conversation.lastMessage || `@${conversation.person.username}`,
        lastAt: Math.max(
          Number(conversation.lastMessageAt ?? 0),
          Number(activityV69?.at ?? 0),
        ),
        avatarUrl: conversation.person.avatarUrl,
        initials: conversation.person.initials,
        accent: conversation.person.profileAccent,
        pinnedAt: preference.pinnedAt ?? null,
        mutedUntil: preference.mutedUntil ?? null,
      })
    }

    for (const group of directSidebarCenter.groups) {
      const activityV69 = directActivityV69[`group:${group.id}`]
      const preference = group as typeof group & {
        pinnedAt?: number | null
        mutedUntil?: number | null
      }

      items.push({
        key: `group:${group.id}`,
        kind: 'group',
        id: group.id,
        name: group.name,
        preview: activityV69?.preview || group.lastMessage || `${group.members.length} members`,
        lastAt: Math.max(
          Number(group.lastMessageAt ?? 0),
          Number(activityV69?.at ?? 0),
        ),
        pinnedAt: preference.pinnedAt ?? null,
        mutedUntil: preference.mutedUntil ?? null,
      })
    }

    for (const item of items) {
      const localRecentV70 = directRecentV70[item.key]
      if (localRecentV70 && localRecentV70.lastAt > item.lastAt) {
        item.lastAt = localRecentV70.lastAt
        if (localRecentV70.preview) item.preview = localRecentV70.preview
      }
    }
    return items.sort((a, b) => b.lastAt - a.lastAt || a.name.localeCompare(b.name))
  }, [directActivityV69, directSidebarCenter, pinnedDirectKeys, directRecentV70, activeSupportTicketsV753, supportSidebarSummary])

  function sidebarDmUnread(item: (typeof sidebarDmItems)[number]) {
    return visibleNotifications.filter(notification =>
      item.kind === 'support'
        ? notification.kind === 'support'
        : item.kind === 'direct'
          ? notification.kind === 'direct' && notification.conversationId === item.id
          : notification.kind === 'group' && notification.groupId === item.id
    ).length
  }

  const channelMeta = useMemo(
    () => loadChannelMeta(activeWorkspaceId, data?.channels ?? []),
    [activeWorkspaceId, data?.channels, channelMetaVersion],
  )
  const visibleChannelCategories = channelMeta.categories.filter(category => category.id !== 'staff' || canStaff)
  const rootChannelCategories = visibleChannelCategories
  const uncategorizedChannels = sortChannelsByMeta(channelMeta, (data?.channels ?? []).filter(channel => !channelMeta.assignments[channel.id] && !channelThreadParent(channelMeta, channel.id) && (canStaff || !/^(staff|mod|admin)[-_]/i.test(channel.name))))

  function channelIconNode(channel: WorkspaceChannel, size = 16) {
    const choice = channelMeta.icons[channel.id]
    if (choice?.kind === 'emoji') return <span className="channel-native-emoji-v29" aria-hidden="true">{choice.value}</span>
    return <Icon name={(choice?.kind === 'icon' ? choice.value : channel.kind === 'notes' ? 'notes' : channel.kind === 'announcement' ? 'bell' : 'hash') as IconName} size={size}/>
  }

  function channelsForCategory(categoryId: string) {
    return sortChannelsByMeta(channelMeta, (data?.channels ?? []).filter(channel => !channelThreadParent(channelMeta, channel.id) && channelMeta.assignments[channel.id] === categoryId && (categoryId !== 'staff' || canStaff)))
  }

  function threadChildren(parentChannelId: string) {
    return channelThreadChildren(channelMeta, data?.channels ?? [], parentChannelId)
  }

  function threadIsVisible(channel: WorkspaceChannel) {
    if (preferences.showAllChannelThreads || activeChannel?.id === channel.id) return true
    if (profile?.id && (channelMeta.threadMembers[channel.id] ?? []).includes(profile.id)) return true
    return Boolean(profile?.id && (data?.messages ?? []).some(message => message.channelId === channel.id && message.authorId === profile.id))
  }

  function threadGroupKey(parentChannelId: string) { return groupKey(`thread-open:${parentChannelId}`) }
  function threadExpanded(parentChannelId: string) { return preferences.collapsedChannelGroups.includes(threadGroupKey(parentChannelId)) }
  function toggleThreadGroup(parentChannelId: string) { toggleInList('collapsedChannelGroups', threadGroupKey(parentChannelId)) }

  function clearSidebarDrag() {
    setDraggingChannelId(null)
    setDraggingCategoryId(null)
    setDragOverKey(null)
  }


  function sidebarDropKeyAt(type: 'channel' | 'category', sourceId: string, clientX: number, clientY: number) {
    const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null
    if (!element) return null
    if (type === 'channel') {
      const channel = element.closest<HTMLElement>('[data-sidebar-channel-id]')
      const channelId = channel?.dataset.sidebarChannelId
      if (channelId && channelId !== sourceId) return `channel:${channelId}`
      const category = element.closest<HTMLElement>('[data-sidebar-category-id]')
      const categoryId = category?.dataset.sidebarCategoryId
      if (categoryId) return `category:${categoryId}:inside`
      const categoryZone = element.closest<HTMLElement>('[data-sidebar-category-zone]')
      const zoneId = categoryZone?.dataset.sidebarCategoryZone
      if (zoneId) return `category:${zoneId}:inside`
      if (element.closest('[data-sidebar-uncategorized="true"]')) return 'category:uncategorized'
      return null
    }

    const category = element.closest<HTMLElement>('[data-sidebar-category-id]')
    const categoryId = category?.dataset.sidebarCategoryId
    if (categoryId && categoryId !== sourceId) return `category:${categoryId}:before`
    if (element.closest('[data-sidebar-category-end="true"]')) return 'category:end'
    return null
  }

  async function syncChannelToCategoryV70(channelId: string, categoryId: string) {
    const channels = data?.channels ?? []
    const current = await listChannelPermissionOverwrites(channelId)
    for (const row of current) await deleteChannelPermissionOverwrite(channelId, row.targetType, row.targetId)
    const template = getCategoryPermissionTemplate(activeWorkspaceId, channels, categoryId)
    for (const row of template) if (row.allow.length || row.deny.length) await saveChannelPermissionOverwrite(channelId, row.targetType, row.targetId, row.allow, row.deny)
    setChannelPermissionSyncCategory(activeWorkspaceId, channels, channelId, categoryId)
    void refreshWorkspace().catch(() => undefined)
  }

  async function requestChannelMoveV70(channelId: string, targetCategoryId: string | null, beforeChannelId: string | null = null) {
    const channels = data?.channels ?? []
    if (!targetCategoryId) {
      moveChannelInMeta(activeWorkspaceId, channels, channelId, null, beforeChannelId)
      setChannelPermissionSyncCategory(activeWorkspaceId, channels, channelId, null)
      return
    }
    try {
      const current = await listChannelPermissionOverwrites(channelId)
      const template = getCategoryPermissionTemplate(activeWorkspaceId, channels, targetCategoryId)
      const comparable = current.map(row => ({ targetType: row.targetType, targetId: row.targetId, allow: row.allow, deny: row.deny }))
      if (channelPermissionOverridesEqual(comparable, template)) {
        moveChannelInMeta(activeWorkspaceId, channels, channelId, targetCategoryId, beforeChannelId)
        setChannelPermissionSyncCategory(activeWorkspaceId, channels, channelId, targetCategoryId)
        return
      }
      setPendingPermissionMoveV70({ channelId, targetCategoryId, beforeChannelId })
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not compare channel permissions.', 'danger')
    }
  }

  async function finishPermissionMoveV70(sync: boolean) {
    const pending = pendingPermissionMoveV70
    if (!pending) return
    const channels = data?.channels ?? []
    try {
      if (sync) await syncChannelToCategoryV70(pending.channelId, pending.targetCategoryId)
      else setChannelPermissionSyncCategory(activeWorkspaceId, channels, pending.channelId, null)
      moveChannelInMeta(activeWorkspaceId, channels, pending.channelId, pending.targetCategoryId, pending.beforeChannelId)
      setPendingPermissionMoveV70(null)
      setChannelMetaVersion(value => value + 1)
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not move that channel.', 'danger')
    }
  }

  function commitSidebarPressDrop(type: 'channel' | 'category', sourceId: string, key: string | null) {
    if (!key || !canManageChannels) return
    const channels = data?.channels ?? []
    if (type === 'channel') {
      if (key.startsWith('channel:')) {
        const targetId = key.slice('channel:'.length)
        if (targetId === sourceId) return
        void requestChannelMoveV70(sourceId, channelMeta.assignments[targetId] ?? null, targetId)
        return
      }
      if (key === 'category:uncategorized') {
        void requestChannelMoveV70(sourceId, null, null)
        return
      }
      const match = key.match(/^category:(.+):inside$/)
      if (match) void requestChannelMoveV70(sourceId, match[1], null)
      return
    }

    if (key === 'category:end') {
      moveChannelCategory(activeWorkspaceId, channels, sourceId, null, null)
      return
    }
    const before = key.match(/^category:(.+):before$/)
    if (before) {
      const target = channelMeta.categories.find(category => category.id === before[1])
      moveChannelCategory(activeWorkspaceId, channels, sourceId, target?.parentId ?? null, before[1])
      return
    }
  }

  function beginSidebarPressDrag(event: ReactPointerEvent<HTMLElement>, type: 'channel' | 'category', id: string) {
    if (!canManageChannels) return
    let currentKey: string | null = null
    startPressDrag(event, {
      onStart: () => {
        if (type === 'channel') { setDraggingChannelId(id); setDraggingCategoryId(null) }
        else { setDraggingCategoryId(id); setDraggingChannelId(null) }
      },
      onMove: (clientX, clientY) => {
        currentKey = sidebarDropKeyAt(type, id, clientX, clientY)
        setDragOverKey(currentKey)
      },
      onDrop: () => {
        sidebarDragClickSuppressUntil.current = Date.now() + 450
        commitSidebarPressDrop(type, id, currentKey)
        clearSidebarDrag()
      },
      onCancel: clearSidebarDrag,
    })
  }

  function sidebarClickSuppressed() {
    return Date.now() < sidebarDragClickSuppressUntil.current
  }

  async function openNotificationItem(item: SpacesNotification) {
    dismissNotifications({ id: item.id })
    setNoticePeek(null)
    setNotificationOpen(false)
    if (item.kind === 'support') {
      if (item.supportTicketNumber) {
        try {
          localStorage.setItem(
            item.supportTicketStaff ? 'spaces.support.adminTicket.v73' : 'spaces.support.openTicket.v73',
            item.supportTicketNumber,
          )
        } catch {
          // Ignore local storage restrictions.
        }
      }
      if (item.supportTicketStaff && ['founder', 'staff', 'support'].includes(profile?.platformRole ?? '')) {
        goHome()
        setDirectCenterOpen(false)
        setSupportConsoleOpen(true)
        setMobileNavOpen(false)
        return
      }
      openDirectPage('support')
      return
    }
    if (item.kind === 'friend_request') {
      openDirectPage('requests')
      return
    }
    if (item.kind === 'direct' && item.conversationId) {
      openDirectPage('friends', item.conversationId)
      return
    }
    if (item.kind === 'group' && item.groupId) {
      openDirectPage('groups', null, item.groupId)
      return
    }
    await chooseWorkspace(item.workspaceId)
    chooseChannel(item.channelId)
  }

  function toggleInList(key: 'hiddenWorkspaceIds' | 'mutedWorkspaceIds' | 'mutedChannelIds' | 'pinnedChannelIds' | 'collapsedChannelGroups', id: string) {
    const current = preferences[key]
    setPreference(key, current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  async function reportWorkspace(space: WorkspaceSummary) {
    const subject = await dialog.prompt({ title: `Report ${space.name}`, message: 'Tell Spaces Support what is wrong with this Space.', label: 'Short reason', maxLength: 120, confirmText: 'Next' })
    if (!subject) return
    const details = await dialog.prompt({ title: 'Add report details', message: 'Include enough context for Support to review the Space.', label: 'Details', maxLength: 1200, confirmText: 'Send report' })
    if (!details) return
    try {
      await createSupportCase({ kind: 'space', subject, details, workspaceId: space.id })
      pushToast('Space report sent to Support.', 'success')
    } catch (error) { pushToast(error instanceof Error ? error.message : 'Could not report Space.', 'danger') }
  }

  const spaceSearchItemsV71 = useMemo<ContentSearchItem[]>(() => {
    if (!data) return []
    const channelNames = new Map(data.channels.map(channel => [channel.id, channel.name]))
    const items: ContentSearchItem[] = []
    const linkPattern = /https?:\/\/[^\s<>()]+/giu

    for (const message of data.messages) {
      const channelName = channelNames.get(message.channelId) ?? 'channel'
      items.push({
        id: `message:${message.id}`,
        kind: 'message',
        title: message.authorName,
        subtitle: `#${channelName}`,
        preview: message.body || message.attachment?.name || 'Attachment',
        createdAt: message.createdAt,
        onOpen: () => chooseChannel(message.channelId),
      })

      if (message.attachment) {
        const media = /^image\//i.test(message.attachment.type)
        items.push({
          id: `${media ? 'media' : 'file'}:${message.id}`,
          kind: media ? 'media' : 'file',
          title: message.attachment.name,
          subtitle: `#${channelName} · ${message.authorName}`,
          preview: media ? 'Image attachment' : `${message.attachment.type || 'File'} · ${Math.max(1, Math.round(message.attachment.size / 1024))} KB`,
          createdAt: message.createdAt,
          onOpen: () => chooseChannel(message.channelId),
        })
      }

      for (const [index, link] of [...message.body.matchAll(linkPattern)].entries()) {
        items.push({
          id: `link:${message.id}:${index}`,
          kind: 'link',
          title: link[0],
          subtitle: `#${channelName} · ${message.authorName}`,
          preview: message.body,
          createdAt: message.createdAt,
          onOpen: () => chooseChannel(message.channelId),
        })
      }
    }

    for (const note of data.notes) {
      items.push({
        id: `note:${note.id}`,
        kind: 'note',
        title: note.title || 'Untitled note',
        subtitle: `#${channelNames.get(note.channelId) ?? 'notes'} · v${note.version}`,
        preview: note.body.replace(/\s+/g, ' ').slice(0, 180),
        createdAt: note.updatedAt,
        onOpen: () => chooseChannel(note.channelId),
      })
    }

    return items
  }, [chooseChannel, data])

  async function openSpaceSearchV71(space: WorkspaceSummary) {
    if (space.id !== activeWorkspaceId) await chooseWorkspace(space.id)
    setSpaceSearchTitleV71(`Search ${space.name}`)
  }

  function workspaceActions(space: WorkspaceSummary): ContextAction[] {
    const muted = preferences.mutedWorkspaceIds.includes(space.id)
    const hidden = preferences.hiddenWorkspaceIds.includes(space.id)
    const isHub = space.id === 'spaces-hub'
    const numericId = getWorkspaceNumber(space, workspaces)
    return [
      { id: 'search-space-v71', label: 'Search', note: 'Messages, media, files, links, and notes', icon: 'search' as IconName, onSelect: () => void openSpaceSearchV71(space) },
      ...(space.id !== activeWorkspaceId ? [{ id: 'open', label: 'Open Space', note: space.description || 'Open this Space', icon: 'grid' as IconName, onSelect: () => openWorkspace(space.id) }] : []),
      ...(space.id === activeWorkspaceId && canCreateChannel ? [{ id: 'new-channel', label: 'Create channel', note: 'Choose type, category and icon', icon: 'plus' as IconName, onSelect: async () => { if (space.id !== activeWorkspaceId) await chooseWorkspace(space.id); openChannelCreator(null) } }] : []),
      ...(space.id === activeWorkspaceId && canManageChannels ? [{ id: 'new-category', label: 'Create category', note: 'Add a new channel group', icon: 'grid' as IconName, onSelect: () => { setCategoryName(''); setCategoryDialog(true) } }] : []),
      ...(space.id === activeWorkspaceId && canInvite ? [{ id: 'invite', label: 'Invite people', note: 'Open invite management', icon: 'members' as IconName, onSelect: async () => { if (space.id !== activeWorkspaceId) await chooseWorkspace(space.id); setView('invites') } }] : []),
      ...(space.id === activeWorkspaceId ? [{ id: 'privacy-dms', label: 'Privacy & DMs', note: 'Control message requests from this Space', icon: 'message' as IconName, onSelect: () => setWorkspacePrivacyOpen(space) }] : []),
      { id: 'copy-space-id', label: `Copy Space ID #${numericId}`, note: 'Stable Space number · never reused on this installation', icon: 'copy' as IconName, onSelect: async () => { await navigator.clipboard.writeText(String(numericId)); pushToast(`Space ID #${numericId} copied.`, 'success') } },
      { id: 'mute', label: muted ? 'Unmute Space' : 'Mute Space', note: muted ? 'Resume mention alerts' : 'Silence notifications from this Space', icon: muted ? 'bell' : 'x', checked: muted, onSelect: () => toggleInList('mutedWorkspaceIds', space.id) },
      { id: 'hide', label: hidden ? 'Show Space' : 'Hide Space', note: isHub ? 'Keep Hub membership but remove it from your rail' : 'Remove it from your rail without leaving', icon: 'lock', checked: hidden, onSelect: () => toggleInList('hiddenWorkspaceIds', space.id) },
      { id: 'report-space', label: 'Report Space', note: 'Send this Space to Spaces Support for review', icon: 'shield' as IconName, onSelect: () => void reportWorkspace(space) },
      ...(space.id === activeWorkspaceId && canManageSpace ? [{ id: 'settings', label: 'Space settings', note: 'Identity, artwork and permissions', icon: 'settings' as IconName, onSelect: () => setView('settings') }] : []),
      ...(isHub ? [{ id: 'hub', label: 'Permanent platform Space', note: 'Spaces - Hub cannot be left or deleted', icon: 'shield' as IconName, disabled: true, onSelect: () => undefined }] : []),
    ]
  }


  function compactWorkspaceActions(space: WorkspaceSummary) {
    const actions = workspaceActions(space)

    return actions
      .filter(action => {
        const label = action.label.toLowerCase()

        // Full management lives in the top-left Space menu, not the right-click menu.
        if (
          label.includes('create channel') ||
          label.includes('create category') ||
          label.includes('privacy & dms') ||
          label.includes('privacy and dms') ||
          label.includes('space settings')
        ) return false

        // The Hub is permanent. Do not present leave/delete/permanence as a server right-click action.
        if (
          space.id === 'spaces-hub' &&
          (
            label.includes('leave') ||
            label.includes('delete') ||
            label.includes('permanent')
          )
        ) return false

        return true
      })
      .map(action => ({
        ...action,
        // Keep server right-click fast/compact. Full explanations remain in the top-left menu.
        note: undefined,
      }))
  }

  function channelActions(channel: WorkspaceChannel): ContextAction[] {
    const muted = preferences.mutedChannelIds.includes(channel.id)
    const currentCategory = channelMeta.categories.find(category => category.id === channelMeta.assignments[channel.id])
    const threadParentId = channelThreadParent(channelMeta, channel.id)
    return [
      { id: 'open', label: threadParentId ? 'Open thread' : 'Open channel', note: cleanThreadDescription(channel.description) || channel.kind, icon: threadParentId ? 'reply' : channel.kind === 'notes' ? 'notes' : 'hash', onSelect: () => chooseChannel(channel.id) },
      ...(!threadParentId && canCreateChannel ? [{ id: 'create-thread', label: 'Create thread', note: `Start a focused channel under #${channel.name}`, icon: 'reply' as IconName, onSelect: () => openThreadCreator(channel) }] : []),
      { id: 'mute', label: muted ? 'Unmute channel' : 'Mute channel', note: muted ? 'Resume notifications here' : 'Mentions stay in the channel but will not ping you', icon: 'bell', checked: muted, onSelect: () => toggleInList('mutedChannelIds', channel.id) },
      { id: 'pin', label: preferences.pinnedChannelIds.includes(channel.id) ? 'Unpin channel' : 'Pin channel', note: preferences.pinnedChannelIds.includes(channel.id) ? 'Remove from Pinned' : 'Keep this channel above categories', icon: 'pin' as IconName, checked: preferences.pinnedChannelIds.includes(channel.id), onSelect: () => toggleInList('pinnedChannelIds', channel.id) },
      { id: 'copy', label: 'Copy channel name', note: `#${channel.name}`, icon: 'copy', onSelect: async () => { await navigator.clipboard.writeText(`#${channel.name}`); pushToast('Channel name copied.', 'success') } },
      ...(canManageChannels ? [
        { id: 'change-icon', label: 'Change channel icon', note: 'Choose a gray Spaces icon or normal emoji', icon: 'emoji' as IconName, onSelect: () => { setChannelIconChoice(channelMeta.icons[channel.id] ?? { kind: 'icon', value: 'hash' }); setChannelIconTarget(channel) } },
        ...(!threadParentId ? [{ id: 'move-category', label: 'Move to category…', note: currentCategory?.name ?? 'Uncategorized', icon: 'grid' as IconName, onSelect: async () => { const name = await dialog.prompt({ title: `Move #${channel.name}`, message: `Type a category name, or leave blank for Uncategorized. Available: ${channelMeta.categories.map(category => category.name).join(', ')}`, label: 'Category', placeholder: currentCategory?.name ?? 'Uncategorized', confirmText: 'Move' }); if (name === null) return; const clean = name.trim(); const category = channelMeta.categories.find(item => item.name.toLowerCase() === clean.toLowerCase()); if (clean && !category) { pushToast('That category does not exist yet.', 'danger'); return } void requestChannelMoveV70(channel.id, category?.id ?? null, null) } }] : []),
        { id: 'permissions', label: 'Channel permissions', note: 'Control who can post, attach files or edit notes', icon: 'shield' as IconName, onSelect: () => setChannelPermissionTarget(channel) },
        ...(channel.id !== 'spaces-hub-updates' ? [{ id: 'delete-channel', label: 'Delete channel', note: 'Removes its messages and notes', icon: 'trash' as IconName, danger: true, onSelect: async () => { if (!await dialog.confirm({ title: `Delete #${channel.name}?`, message: 'Messages and notes inside this channel will be permanently removed.', confirmText: 'Delete channel', danger: true })) return; try { await deleteChannel(channel.id) } catch (error) { pushToast(error instanceof Error ? error.message : 'Could not delete channel.', 'danger') } } }] : []),
      ] : []),
    ]
  }

  function openChannelCreator(categoryId: string | null = null) {
    setChannelThreadParentId(null)
    setChannelCategoryId(categoryId)
    setChannelKind('chat')
    setChannelIconChoice({ kind: 'icon', value: 'hash' })
    setChannelDialog(true)
  }

  function openThreadCreator(parent: WorkspaceChannel) {
    setChannelThreadParentId(parent.id)
    setChannelCategoryId(channelMeta.assignments[parent.id] ?? null)
    setChannelKind('chat')
    setChannelIconChoice({ kind: 'icon', value: 'reply' })
    setChannelName('')
    setChannelDescription('')
    setChannelDialog(true)
  }

  function categoryActions(categoryId: string, label: string, channels: WorkspaceChannel[]): ContextAction[] {
    const allMuted = channels.length > 0 && channels.every(channel => preferences.mutedChannelIds.includes(channel.id))
    return [
      ...(canCreateChannel ? [{ id: 'category-new', label: 'Create channel', note: `Add a channel to ${label}`, icon: 'plus' as IconName, onSelect: () => openChannelCreator(categoryId) }] : []),
      ...(canManageChannels ? [
        { id: 'category-permissions', label: 'Category permissions', note: 'Set the template used by synced channels', icon: 'shield' as IconName, onSelect: () => setCategoryPermissionTarget(channelMeta.categories.find(item => item.id === categoryId) ?? null) },
        { id: 'category-rename', label: 'Rename category', note: label, icon: 'edit' as IconName, onSelect: async () => { const next = await dialog.prompt({ title: `Rename ${label}`, message: 'Category names only organize channels.', label: 'Category name', placeholder: label, maxLength: 36, confirmText: 'Rename' }); if (next?.trim()) renameChannelCategory(activeWorkspaceId, data?.channels ?? [], categoryId, next) } },
      ] : []),
      ...(channels.length ? [{ id: 'category-mute', label: allMuted ? 'Unmute category' : 'Mute category', note: `${channels.length} channel${channels.length === 1 ? '' : 's'}`, icon: 'bell' as IconName, checked: allMuted, onSelect: () => { const ids = new Set(preferences.mutedChannelIds); channels.forEach(channel => allMuted ? ids.delete(channel.id) : ids.add(channel.id)); setPreference('mutedChannelIds', [...ids]) } }] : []),
      ...(canManageChannels ? [{ id: 'category-delete', label: 'Delete category', note: channels.length ? 'Channels move to Uncategorized' : 'Remove this empty category', icon: 'trash' as IconName, danger: true, onSelect: async () => { if (!await dialog.confirm({ title: `Delete ${label}?`, message: channels.length ? 'The channels will stay in the Space and move to Uncategorized.' : 'This removes the empty category.', confirmText: 'Delete category', danger: true })) return; deleteChannelCategory(activeWorkspaceId, data?.channels ?? [], categoryId) } }] : []),
    ]
  }

  function sidebarActions(): ContextAction[] {
    if (!activeWorkspaceId) return []
    return [
      ...(canCreateChannel ? [{ id: 'sidebar-channel', label: 'Create channel', note: 'Choose channel type, category and icon', icon: 'plus' as IconName, onSelect: () => openChannelCreator(null) }] : []),
      ...(canManageChannels ? [{ id: 'sidebar-category', label: 'Create category', note: 'Add a new channel group', icon: 'grid' as IconName, onSelect: () => { setCategoryName(''); setCategoryDialog(true) } }] : []),
      ...(canInvite ? [{ id: 'sidebar-invite', label: 'Invite people', note: 'Open invite management', icon: 'members' as IconName, onSelect: () => setView('invites') }] : []),
      ...(canManageSpace ? [{ id: 'sidebar-settings', label: 'Space settings', note: 'Profile, roles and management', icon: 'settings' as IconName, onSelect: () => setView('settings') }] : []),
    ]
  }

  function renderChannelRow(channel: WorkspaceChannel, keyPrefix = '') {
    const isThread = Boolean(channelThreadParent(channelMeta, channel.id))
    const isActive = activeChannel?.id === channel.id && (view === 'chat' || view === 'notes')
    const pressDraggable = canManageChannels && !keyPrefix && !isThread
    const visibleThreads = isThread ? [] : threadChildren(channel.id).filter(threadIsVisible)
    const expanded = visibleThreads.length > 0 && threadExpanded(channel.id)
    return <div className={`channel-thread-group-v38 ${isThread ? 'thread-child-group-v38' : ''}`} key={`${keyPrefix}${channel.id}`}>
      <button
        {...contextMenu.bind(isThread ? channel.name : `#${channel.name}`, channelActions(channel), isThread ? 'Thread actions' : 'Channel actions')}
        data-sidebar-channel-id={pressDraggable ? channel.id : undefined}
        className={`sidebar-item channel-row ${isThread ? 'channel-thread-child-v38' : ''} ${pressDraggable ? 'press-draggable-v37' : ''} ${isActive ? 'active' : ''} ${preferences.mutedChannelIds.includes(channel.id) ? 'muted' : ''} ${draggingChannelId === channel.id ? 'dragging-v33 press-drag-source-v37' : ''} ${dragOverKey === `channel:${channel.id}` ? 'drag-over-v33' : ''}`}
        onPointerDown={event => { if (pressDraggable) beginSidebarPressDrag(event, 'channel', channel.id) }}
        onClick={() => { if (sidebarClickSuppressed()) return; chooseChannel(channel.id); setMobileNavOpen(false) }}
      >
        {isThread ? <span className="thread-branch-v38" aria-hidden="true"><Icon name="reply" size={12}/></span> : channelIconNode(channel, 16)}
        <span>{channel.name}</span>
        {preferences.mutedChannelIds.includes(channel.id) && <small>MUTED</small>}
        {!isThread && visibleThreads.length > 0 && <span
          className={`channel-thread-toggle-v38 ${expanded ? 'open' : ''}`}
          role="button"
          tabIndex={0}
          title={expanded ? 'Hide threads' : 'Show threads'}
          data-no-press-drag="true"
          onClick={event => { event.preventDefault(); event.stopPropagation(); toggleThreadGroup(channel.id) }}
          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); toggleThreadGroup(channel.id) } }}
        ><Icon name="chevron" size={11}/><i>{visibleThreads.length}</i></span>}
      </button>
      {!isThread && expanded && <div className="channel-thread-list-v38">{visibleThreads.map(thread => renderChannelRow(thread, `thread-${channel.id}-`))}</div>}
    </div>
  }

  function openSpaceCreator() {
    if (!canCreateAnotherSpace) {
      pushToast('Private beta accounts can own up to 3 Spaces for now.', 'info')
      return
    }
    setSpaceDialog('create')
  }

  async function submitSpace() {
    if (!spaceValue.trim() || !spaceDialog) return
    setBusy(true)
    try {
      if (spaceDialog === 'create') await createWorkspace(spaceValue.trim(), { description: spaceDescription.trim(), avatarUrl: spaceAvatarUrl, accentColor: spaceAccent })
      else await joinWorkspace(spaceValue.trim())
      setSpaceDialog(null)
      setSpaceValue('')
      setSpaceDescription('')
      setSpaceAvatarUrl(null)
      setSpaceAccent('#8b6ca8')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not continue.', 'danger')
    } finally { setBusy(false) }
  }

  async function chooseSpaceAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      if (isGifFile(file)) {
        if (!canUseAnimatedCreatedSpace) {
          pushToast('GIF Space pictures are reserved for Founder-owned Spaces.', 'info')
          return
        }
        setSpaceAvatarUrl(await gifFileToDataUrl(file))
        return
      }
      setSpaceCropSource(await imageFileToRawDataUrl(file))
    } catch (error) { pushToast(error instanceof Error ? error.message : 'Could not prepare that image.', 'danger') }
  }

  async function submitChannel() {
    const name = normalizeChannelName(channelName)
    if (!name) return
    setBusy(true)
    try {
      const description = channelThreadParentId
        ? buildThreadDescription(channelThreadParentId, profile?.id, channelDescription.trim())
        : channelDescription.trim()
      const created = await createChannel(name, description, channelThreadParentId ? 'chat' : channelKind)
      if (created) {
        const channels = [...(data?.channels ?? []), created]
        setChannelCategory(activeWorkspaceId, channels, created.id, channelCategoryId)
        if (channelCategoryId) void syncChannelToCategoryV70(created.id, channelCategoryId)
        else setChannelPermissionSyncCategory(activeWorkspaceId, channels, created.id, null)
        setChannelIcon(activeWorkspaceId, channels, created.id, channelIconChoice)
        if (channelThreadParentId) setChannelThreadParent(activeWorkspaceId, channels, created.id, channelThreadParentId, profile?.id)
      }
      setChannelDialog(false)
      setChannelName('')
      setChannelDescription('')
      setChannelKind('chat')
      setChannelCategoryId(null)
      setChannelThreadParentId(null)
      setChannelIconChoice({ kind: 'icon', value: 'hash' })
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not create channel.', 'danger')
    } finally { setBusy(false) }
  }

  function submitCategory() {
    const name = categoryName.trim()
    if (!name || !activeWorkspaceId || !canManageChannels) return
    createChannelCategory(activeWorkspaceId, data?.channels ?? [], name)
    setCategoryName('')
    setCategoryDialog(false)
    pushToast(`${name} category created.`, 'success')
  }

  const pinnedChannels = useMemo(() => (data?.channels ?? []).filter(channel => preferences.pinnedChannelIds.includes(channel.id)), [data?.channels, preferences.pinnedChannelIds])
  const groupKey = (name: string) => `${activeWorkspaceId}:${name}`
  const groupCollapsed = (name: string) => preferences.collapsedChannelGroups.includes(groupKey(name))
  const toggleGroup = (name: string) => toggleInList('collapsedChannelGroups', groupKey(name))

  function renderCategorySection(category: ChannelCategoryMeta): ReactNode {
    const categoryChannels = channelsForCategory(category.id)
    const collapsed = groupCollapsed(`category:${category.id}`)
    const insideKey = `category:${category.id}:inside`
    const beforeKey = `category:${category.id}:before`
    const dropInside = dragOverKey === insideKey
    const dropBefore = dragOverKey === beforeKey
    return (
      <div
        data-sidebar-category-zone={category.id}
        className={`sidebar-section sidebar-category-tree-v36 depth-0 ${dropInside ? 'drag-over-category-v36' : ''} ${dropBefore ? 'drag-before-category-v36' : ''}`}
        key={category.id}
      >
        <div
          {...contextMenu.bind(category.name, categoryActions(category.id, category.name, categoryChannels), 'Category actions')}
          data-sidebar-category-id={category.id}
          data-sidebar-category-depth="0"
          className={`sidebar-section-label context-enabled-label sidebar-category-label-v17 nested-category-label-v36 ${canManageChannels ? 'press-draggable-v37' : ''} ${draggingCategoryId === category.id ? 'dragging-v33 press-drag-source-v37' : ''}`}
          style={{ '--category-depth': 0 } as CSSProperties}
          onPointerDown={event => beginSidebarPressDrag(event, 'category', category.id)}
        >
          <button type="button" className={collapsed ? 'collapsed' : ''} onClick={() => { if (sidebarClickSuppressed()) return; toggleGroup(`category:${category.id}`) }}>
            <Icon name="chevron" size={11}/><span>{category.name.toUpperCase()}</span>
          </button>
          <div className="sidebar-category-actions-v36" data-no-press-drag="true">
            {canCreateChannel && <button data-no-press-drag="true" title={`Create channel in ${category.name}`} onClick={() => openChannelCreator(category.id)}><Icon name="plus" size={13}/></button>}
          </div>
        </div>
        {!collapsed && <div className="sidebar-category-contents-v36">{categoryChannels.map(channel => renderChannelRow(channel))}</div>}
      </div>
    )
  }

  const managementView = activeWorkspaceId && ['members', 'roles', 'emoji', 'activity', 'invites', 'settings', 'staff'].includes(view)
  const showMemberRail = Boolean(activeWorkspaceId && memberRailOpen && !managementView)
  const canOpenSupportConsole = profile?.platformRole === 'founder' || profile?.platformRole === 'staff' || profile?.platformRole === 'support'
  useEffect(() => {
    if (!canOpenSupportConsole) { setSupportQueueCount(0); supportQueueInitialized.current = false; return }
    let cancelled = false
    const loadQueueCount = async () => {
      try {
        const [reports, cases] = await Promise.all([listModerationReports(), listSupportCases()])
        if (cancelled) return
        const next = reports.filter(item => !(item as { archivedAt?: number | null }).archivedAt && item.status === 'open').length +
          cases.filter(item => !(item as { archivedAt?: number | null }).archivedAt && item.status === 'open').length
        setSupportQueueCount(previous => {
          if (supportQueueInitialized.current && next > previous && preferences.desktopSounds && preferences.presence !== 'dnd') playSpacesQueueAlert()
          if (supportQueueInitialized.current && next > previous && preferences.mobileSystemNotifications && preferences.supportNotifications && preferences.presence !== 'dnd') {
            void sendMobileTextNotificationV72('Spaces Support', next - previous === 1 ? 'New item waiting in Support Console.' : `${next - previous} new items waiting in Support Console.`)
          }
          return next
        })
        supportQueueInitialized.current = true
      } catch {
        // The console itself surfaces API errors when opened.
      }
    }
    void loadQueueCount()
    const timer = window.setInterval(() => void loadQueueCount(), 3000)
    const sync = () => void loadQueueCount()
    window.addEventListener('spaces-support-queue-changed', sync)
    window.addEventListener('focus', sync)
    window.addEventListener('spaces-notification-peek', sync)
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener('spaces-support-queue-changed', sync); window.removeEventListener('focus', sync); window.removeEventListener('spaces-notification-peek', sync) }
  }, [canOpenSupportConsole, listModerationReports, listSupportCases, preferences.desktopSounds, preferences.mobileSystemNotifications, preferences.supportNotifications, preferences.presence])

  function openWorkspace(workspaceId: string) {
    // A Space should always open with its navigation visible. Collapsing is an
    // explicit user choice, never something a management page does for them.
    setDirectCenterOpen(false)
    setDirectConversationId(null)
    setDirectGroupId(null)
    setChannelNavCollapsed(false)
    void chooseWorkspace(workspaceId)
  }

  return (
    <div className={`spaces-app-shell bg-${background} ${activeWorkspaceId ? 'has-space' : 'home-mode'} ${showMemberRail ? 'with-member-rail' : ''} ${channelNavCollapsed && activeWorkspaceId ? 'channel-nav-collapsed' : ''} ${channelNavResizing ? 'channel-nav-resizing-v53' : ''}`} style={appStyle}>
      <aside className="server-rail">
        <button className={`server-home ${!activeWorkspaceId && !directCenterOpen ? 'active' : ''}`} onClick={openSpacesHome} title="Home"><div className="brand-mark brand-home"><Icon name="home" size={22} /></div><span className="server-pill" /></button>
        <div className="server-divider" />
        <div className="server-list">
          {visibleWorkspaces.map(space => { const unread = workspaceUnreadCount(space.id); return <button {...contextMenu.bind(space.name, compactWorkspaceActions(space), space.id === 'spaces-hub' ? undefined : 'Space')} key={space.id} className={`server-button ${activeWorkspaceId === space.id ? 'active' : ''} ${unread ? 'has-unread-v41' : ''}`} onClick={() => openWorkspace(space.id)} title={unread ? `${space.name} · ${unread > 9 ? '9+' : unread} unread` : space.name} style={{ '--server-accent': space.accentColor, '--server-accent2': localStorage.getItem(`spaces.theme2.${space.id}`) || '#342044' } as CSSProperties}><span className="server-pill" /><span className={`server-avatar-shell space-icon-decor icon-decor-${space.iconDecoration ?? 'ring'}`} style={{ '--decor-accent': space.accentColor } as CSSProperties}><Avatar name={space.name} initials={space.initials} src={space.avatarUrl} size={46} accent={space.accentColor} /></span>{unread > 0 && <span className="server-unread-count-v41" aria-label={`${unread} unread`}>{unread > 9 ? '9+' : unread}</span>}</button> })}
          <button className="server-button server-add server-add-v20" title="Add a Space" onClick={openSpaceCreator}><span className="server-add-grid-v20"><Icon name="grid" size={24}/></span><span className="server-add-plus-v20"><Icon name="plus" size={13}/></span></button>
        </div>
      </aside>

      <aside className={`channel-sidebar ${mobileNavOpen ? 'mobile-open' : ''}`} aria-hidden={channelNavCollapsed && !mobileNavOpen ? true : undefined}>
        <button className="channel-sidebar-resize-v53" aria-label="Resize Space navigation" title="Drag to resize · drag left to collapse" onPointerDown={beginChannelNavResize} />
        <header className={`space-header ${activeWorkspace?.bannerUrl ? 'has-space-banner-v42' : ''}`}>
          {activeWorkspace?.bannerUrl && <AnimatedBackdrop src={activeWorkspace.bannerUrl} className="space-header-full-banner-v42" mode={channelNavCollapsed && !mobileNavOpen ? 'still' : 'always'}/>}
          {activeWorkspace ? <><button {...contextMenu.bind(activeWorkspace.name, workspaceActions(activeWorkspace), 'Space actions')} className="space-header-identity-v16 space-header-menu-v18" title="Open Space menu" onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); contextMenu.open(activeWorkspace.name, workspaceActions(activeWorkspace), rect.left + 14, rect.bottom + 8, 'Space actions') }}><span className={`space-icon-decor icon-decor-${activeWorkspace.iconDecoration ?? 'ring'}`} style={{ '--decor-accent': activeWorkspace.accentColor } as CSSProperties}><Avatar name={activeWorkspace.name} initials={activeWorkspace.initials} src={activeWorkspace.avatarUrl} size={34} accent={activeWorkspace.accentColor}/></span><div className="space-header-copy"><span className="eyebrow">SPACE</span><strong>{activeWorkspace.name}</strong><small>{canManageSpace ? 'Space menu · settings & tools' : 'Space menu'}</small></div><span className="space-header-menu-chevron-v18"><Icon name="chevron" size={13}/></span></button>{canManageSpace && <button className="icon-button" title="Space settings" onClick={() => setView('settings')}><Icon name="settings" size={16} /></button>}</> : <><div className="space-header-copy"><span className="eyebrow">SPACES</span><strong>{directCenterOpen ? 'Friends' : 'Home'}</strong></div><div className="private-chip"><Icon name={directCenterOpen ? 'message' : 'lock'} size={12} /> {directCenterOpen ? 'Direct' : 'Private'}</div></>}
        </header>

        <div className="sidebar-scroll" {...(activeWorkspace ? contextMenu.bind(activeWorkspace.name, sidebarActions(), 'Space sidebar actions') : {})}>
          {!activeWorkspace ? (
            <>
              <div className="sidebar-section"><button className={`sidebar-item ${!directCenterOpen ? 'active' : ''}`} onClick={openSpacesHome}><Icon name="home" /><span>Home</span></button><button className="sidebar-item" onClick={() => setCommandOpen(true)}><Icon name="search" /><span>Quick switcher</span><kbd>Ctrl K</kbd></button></div>
              <div className="sidebar-section sidebar-friends-v54">
                <div className="sidebar-section-label">FRIENDS</div>
                <button className={`sidebar-item ${directCenterOpen && directPageTab === 'friends' && !directConversationId && !directGroupId ? 'active' : ''}`} onClick={() => openDirectPage('friends')}><Icon name="members" /><span>Friends</span><small>{friendCountV69}</small></button>
                <button className={`sidebar-item sidebar-request-row-v54 ${directCenterOpen && directPageTab === 'requests' ? 'active' : ''}`} onClick={() => openDirectPage('requests')}><Icon name="message" /><span>Requests</span>{directSidebarCenter.incomingRequests.length > 0 && <b className="sidebar-request-badge-v54">{directSidebarCenter.incomingRequests.length > 99 ? '99+' : directSidebarCenter.incomingRequests.length}</b>}</button>
                <button className={`sidebar-item ${directCenterOpen && directPageTab === 'add' ? 'active' : ''}`} onClick={() => openDirectPage('add')}><span className="person-plus-icon-v68" aria-hidden="true"><Icon name="members" size={14}/><i>+</i></span><span>Add Friend</span></button>
                <div className="sidebar-dm-list-v54">
                  {sidebarDmItems.map(item => {
                    const unread = sidebarDmUnread(item)
                    const pinned = pinnedDirectKeys.includes(item.key)
                    const active = directCenterOpen && (item.kind === 'support'
                      ? directPageTab === 'support'
                      : item.kind === 'direct'
                        ? directConversationId === item.id
                        : directGroupId === item.id)
                    return <div className={`sidebar-dm-row-v54 sidebar-dm-row-v69 ${item.kind === 'support' ? 'sidebar-support-dm-v54' : ''} ${pinned ? 'is-pinned-v54' : ''} ${active ? 'active-v55' : ''}`} key={item.key}
                      {...contextMenu.bind(
                        item.name,
                        sidebarThreadActions(item),
                        item.kind === 'support' ? 'Spaces Support' : item.kind === 'group' ? 'Group DM' : 'Direct Message',
                      )}
                      onContextMenu={event => {
                        event.preventDefault()
                        event.stopPropagation()
                        contextMenu.open(
                          item.name,
                          sidebarThreadActions(item),
                          event.clientX,
                          event.clientY,
                          item.kind === 'support' ? 'Spaces Support' : item.kind === 'group' ? 'Group DM' : 'Direct Message',
                        )
                      }}
>
                      <button className="sidebar-dm-open-v54" onClick={() => {
                        if (item.kind === 'support') {
                          openDirectPage('support')
                        } else if (item.kind === 'direct') {
                          openDirectPage('friends', item.id)
                        } else {
                          openDirectPage('groups', null, item.id)
                        }
                      }}>
                        {item.kind === 'support' ? <span className="sidebar-support-avatar-v54"><SupportGlyphV73 kind="robot" size={14}/></span> : item.kind === 'group' ? <span className="sidebar-group-avatar-v54"><Icon name="chat" size={14}/></span> : <Avatar name={item.name} initials={item.initials} src={item.avatarUrl} size={30} accent={item.accent}/>}
                        <div><strong>{item.name}</strong><small>{item.preview}</small></div>
                        {unread > 0 && <span className="sidebar-dm-unread-v54">{unread > 99 ? '99+' : unread}</span>}
                      </button>
                      <button className="sidebar-dm-pin-v54" title={pinned ? 'Unpin DM' : 'Pin DM'} aria-label={pinned ? 'Unpin DM' : 'Pin DM'} onClick={() => togglePinnedDirect(item.key)}><Icon name="pin" size={11}/></button>
                    </div>
                  })}
                </div>
              </div>{canStaff && <div className="sidebar-section staff-sidebar-section"><div className="sidebar-section-label"><span>STAFF</span><Icon name="lock" size={11}/></div><button className={`sidebar-item ${view === 'staff' ? 'active' : ''}`} onClick={() => setView('staff')}><Icon name="shield" size={16}/><span>Staff</span></button>{canManageRoles && <button className={`sidebar-item ${view === 'roles' ? 'active' : ''}`} onClick={() => setView('roles')}><Icon name="roles" size={16}/><span>Roles & Permissions</span></button>}</div>}
            </>
          ) : (
            <>
              <div className="mobile-space-strip" aria-label="Switch Space">
                <button className="mobile-space-home" title="Spaces home" onClick={goHome}><Icon name="home" size={15} /></button>
                {visibleWorkspaces.map(space => { const unread = workspaceUnreadCount(space.id); return <button {...contextMenu.bind(space.name, compactWorkspaceActions(space), space.id === 'spaces-hub' ? undefined : 'Space')} key={space.id} className={`${activeWorkspaceId === space.id ? 'active' : ''} ${unread ? 'has-unread-v41' : ''}`} title={space.name} onClick={() => openWorkspace(space.id)}><span className={`space-icon-decor icon-decor-${space.iconDecoration ?? 'ring'}`} style={{ '--decor-accent': space.accentColor } as CSSProperties}><Avatar name={space.name} initials={space.initials} src={space.avatarUrl} size={34} accent={space.accentColor} /></span>{unread > 0 && <span className="mobile-space-unread-v41">{unread > 9 ? '9+' : unread}</span>}</button> })}
                <button className="mobile-space-add mobile-space-add-v20" title="New Space" onClick={openSpaceCreator}><span className="server-add-grid-v20"><Icon name="grid" size={20}/></span><span className="server-add-plus-v20"><Icon name="plus" size={11}/></span></button>
              </div>
              <div className="sidebar-section">
                <button className={`sidebar-item ${view === 'home' ? 'active' : ''}`} onClick={() => setView('home')}><Icon name="home" /><span>Overview</span></button>
              </div>
              {pinnedChannels.length > 0 && <div className="sidebar-section sidebar-pinned-v17"><div className="sidebar-section-label sidebar-category-label-v17"><button type="button" className={groupCollapsed('pinned') ? 'collapsed' : ''} onClick={() => toggleGroup('pinned')} aria-label="Toggle pinned channels"><Icon name="chevron" size={11}/><span>PINNED</span></button></div>{!groupCollapsed('pinned') && pinnedChannels.map(channel => renderChannelRow(channel, 'pinned-'))}</div>}
              {rootChannelCategories.sort((a, b) => a.order - b.order).map(category => renderCategorySection(category))}
              {draggingCategoryId && <div data-sidebar-category-end="true" className={`sidebar-category-drop-tail-v33 ${dragOverKey === 'category:end' ? 'active' : ''}`}>Move category here</div>}
              {uncategorizedChannels.length > 0 && <div data-sidebar-uncategorized="true" className={`sidebar-section ${dragOverKey === 'category:uncategorized' ? 'drag-over-category-v33' : ''}`}><div data-sidebar-uncategorized="true" className="sidebar-section-label sidebar-category-label-v17"><button type="button" className={groupCollapsed('uncategorized') ? 'collapsed' : ''} onClick={() => { if (sidebarClickSuppressed()) return; toggleGroup('uncategorized') }}><Icon name="chevron" size={11}/><span>UNCATEGORIZED</span></button>{canCreateChannel && <button data-no-press-drag="true" title="Create uncategorized channel" onClick={() => openChannelCreator(null)}><Icon name="plus" size={13}/></button>}</div>{!groupCollapsed('uncategorized') && uncategorizedChannels.map(channel => renderChannelRow(channel))}</div>}
              <div className="sidebar-section sidebar-management"><div className="sidebar-section-label sidebar-category-label-v17"><button type="button" className={groupCollapsed('space-tools') ? 'collapsed' : ''} onClick={() => toggleGroup('space-tools')}><Icon name="chevron" size={11}/><span>SPACE</span></button></div>{!groupCollapsed('space-tools') && navItems.filter(canAccessNavItem).map(item => <button key={item.view} className={`sidebar-item ${view === item.view ? 'active' : ''}`} onClick={() => { setView(item.view); setMobileNavOpen(false) }}><Icon name={item.icon} size={16} /><span>{item.label}</span>{item.view === 'members' && <small>{data?.members.length ?? 0}</small>}</button>)}</div>
            </>
          )}
        </div>

        {canOpenSupportConsole && <button data-support-waiting={supportQueueCount + waitingSupportTicketsV753 > 0} className={`support-console-launcher ${supportQueueCount > 0 ? 'has-queue-v31' : ''}`} onClick={() => setSupportConsoleOpen(true)} title="Open Support Console"><span><Icon name="shield" size={15}/>{supportQueueCount > 0 && <i className="support-queue-dot-v31"/>}</span><div><strong>Support Console</strong><small>{supportQueueCount + waitingSupportTicketsV753 > 0 ? `${supportQueueCount + waitingSupportTicketsV753} waiting` : platformRoleLabel(profile?.platformRole ?? 'support')}</small></div>{supportQueueCount > 0 && <b className="support-queue-count-v31">{supportQueueCount > 99 ? '99+' : supportQueueCount}</b>}<Icon name="chevron" size={12}/>{supportQueueCount + waitingSupportTicketsV753 > 0 && <b className="support-console-launcher-badge-v755">{supportQueueCount + waitingSupportTicketsV753 > 99 ? '99+' : supportQueueCount + waitingSupportTicketsV753}</b>}</button>}

        <footer className="account-dock">
          <button className="account-identity" onClick={() => setAccountMenuOpen(value => !value)} title="Account">
            <span className="account-avatar-wrap"><Avatar name={profile?.displayName} initials={profile?.initials} src={profile?.avatarUrl} size={36} /><i className={`presence-symbol dock-presence presence-${effectivePresence}`} /></span>
            <span><span className="account-name-line-v55"><strong>{profile?.displayName}</strong>{profile?.platformRole && <span className={`platform-verified-v55 compact platform-${profile.platformRole}`} title={`${platformRoleLabel(profile.platformRole)} · verified by Spaces`}><Icon name="check" size={9}/>VERIFIED</span>}</span><small>{preferences.customStatus ? `${preferences.customStatus}${profile?.platformRole ? ` · ${platformRoleLabel(profile.platformRole)}` : ''}` : `@${profile?.username}${profile?.platformRole ? ` · ${platformRoleLabel(profile.platformRole)}` : ''}`}</small></span>
          </button>
          <button className="icon-button" title="Account settings" onClick={() => { setAccountMenuOpen(false); setProfileDialog('profile') }}><Icon name="settings" size={16} /></button>
        </footer>
        {accountMenuOpen && <AccountQuickMenu onSettings={() => { setAccountMenuOpen(false); setProfileDialog('profile') }} />}
      </aside>

      <main className="main-stage">
        <header className="topbar">
          <div className="topbar-left"><button className={`mobile-menu-button nav-arrow-toggle-v19 ${mobileNavOpen ? 'open' : 'closed'}`} aria-label={mobileNavOpen ? 'Close Space navigation' : 'Open Space navigation'} aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(!mobileNavOpen)}><Icon name="chevron" size={17} /></button>{activeWorkspace && <button className={`desktop-nav-toggle nav-arrow-toggle-v19 ${channelNavCollapsed ? 'collapsed' : 'expanded'}`} aria-label={channelNavCollapsed ? 'Show Space navigation' : 'Hide Space navigation'} aria-expanded={!channelNavCollapsed} title={channelNavCollapsed ? 'Show Space navigation' : 'Hide Space navigation'} onClick={() => setChannelNavCollapsed(value => !value)}><Icon name="chevron" size={16}/></button>}{activeWorkspace ? <><span className="topbar-symbol"><Icon name={view === 'notes' ? 'notes' : view === 'chat' ? 'hash' : navItems.find(item => item.view === view)?.icon ?? 'home'} size={18} /></span><div><strong>{view === 'chat' || view === 'notes' ? activeChannel?.name ?? activeWorkspace.name : navItems.find(item => item.view === view)?.label ?? 'Overview'}</strong><span>{cleanThreadDescription(activeChannel?.description) || activeWorkspace.description || 'Spaces'}</span></div></> : directCenterOpen ? <><span className="topbar-symbol"><Icon name={directPageTab === 'support' ? 'shield' : directPageTab === 'groups' ? 'chat' : directPageTab === 'requests' ? 'message' : directPageTab === 'add' ? 'plus' : 'members'} /></span><div><strong>{directConversationId ? (directSidebarCenter.conversations.find(item => item.id === directConversationId)?.person.displayName ?? 'Direct Message') : directGroupId ? (directSidebarCenter.groups.find(item => item.id === directGroupId)?.name ?? 'Group Chat') : directPageTab === 'support' ? 'Support Tickets' : directPageTab === 'requests' ? 'Requests' : directPageTab === 'groups' ? 'Group Chats' : directPageTab === 'add' ? 'Add Friend' : 'Friends'}</strong><span>Friends & Messages</span></div></> : <><span className="topbar-symbol"><Icon name="home" /></span><div><strong>Home</strong><span>Everything, one layer up.</span></div></>}</div>
          <div className="topbar-actions">
            <button className="search-pill" onClick={() => setCommandOpen(true)}><Icon name="search" size={15} /><span>Search Spaces</span><kbd>Ctrl K</kbd></button>
            <button className={`icon-button topbar-icon notification-button badge-${notificationBadgeTone} ${notificationOpen ? 'active' : ''}`} title="Notifications" onClick={() => { setMobileNavOpen(false); setNotificationOpen(value => !value) }}><Icon name="bell" size={17}/>{visibleNotifications.length > 0 && <i>{visibleNotifications.length > 9 ? '9+' : visibleNotifications.length}</i>}</button>
            {activeWorkspace && <button className={`icon-button topbar-icon member-rail-toggle ${memberRailOpen ? 'active' : ''}`} title="Toggle member rail" onClick={() => setMemberRailOpen(!memberRailOpen)}><Icon name="members" /></button>}
          </div>
        </header>

        <section className="view-host">
          <div className="view-transition-frame" key={`${activeWorkspaceId || 'spaces-home'}:${directCenterOpen && !activeWorkspaceId ? 'direct' : view}:${activeChannel?.id ?? 'none'}`}>
            {workspaceLoading ? <div className="space-loading-placeholder-v44"><div><div className="space-loading-brand-v44"><SpacesLogo/><strong>{activeWorkspace?.name ?? 'Spaces'}</strong></div><div className="space-loading-lines-v44"><i/><i/><i/></div></div></div> : directCenterOpen && !activeWorkspaceId ? <DirectMessagesCenter embedded initialTab={directPageTab} initialConversationId={directConversationId} initialGroupId={directGroupId} onClose={openSpacesHome} /> : renderView(view, Boolean(activeWorkspaceId))}
          </div>
        </section>
      </main>

      <nav className="mobile-homebar" aria-label="Spaces navigation">
        <button className={!activeWorkspaceId && !directCenterOpen ? 'active' : ''} onClick={openSpacesHome}><Icon name="home" size={19} /><span>Home</span></button>
        <button className={mobileNavOpen || Boolean(activeWorkspaceId) ? 'active' : ''} onClick={() => setMobileNavOpen(!mobileNavOpen)}><Icon name="grid" size={19} /><span>Spaces</span></button>
        <button className={profileDialog ? 'active' : ''} onClick={() => setProfileDialog('profile')}><Icon name="settings" size={19} /><span>Settings</span></button>
      </nav>

      {showMemberRail && <MemberRail onOpenMember={setSelectedRailMember} onHide={() => setMemberRailOpen(false)} />}
      {mobileNavOpen && <div className="mobile-scrim" onPointerDown={() => setMobileNavOpen(false)} />}
      {commandOpen && <CommandPalette />}
      <NotificationCenter open={notificationOpen} onClose={() => setNotificationOpen(false)} />
      {noticePeek && <IncomingNotificationPeek item={noticePeek} onOpen={() => void openNotificationItem(noticePeek)} onClose={() => setNoticePeek(null)} />}
      <div className="toast-stack">{toasts.map(toast => <div key={toast.id} className={`toast toast-${toast.tone}`}><span /><p>{toast.message}</p></div>)}</div>

      {/* SPACES_V81_2_GLOBAL_CALL_HOST */}
      <SpacesDmCallHostV812 />
      <SupportIntakeHostV77 />
      <GlobalProfileHostV77 />
      {mobileStaffOpenV77 && <MobileStaffPanelV77 onClose={() => setMobileStaffOpenV77(false)} />}
      {profileDialog && <PersonalSettings initialTab={profileDialog} onClose={() => setProfileDialog(null)} />}
      {supportConsoleOpen && <SupportConsole initialTab={founderTeamLookupV813 && profile?.platformRole === 'founder' ? 'team' : 'overview'} initialLookup={founderTeamLookupV813} onClose={() => { setSupportConsoleOpen(false); setFounderTeamLookupV813('') }} onOpenSecurity={() => { setSupportConsoleOpen(false); setProfileDialog('security') }} />}
      {workspacePrivacyOpen && <WorkspacePrivacyModal workspaceId={workspacePrivacyOpen.id} workspaceName={workspacePrivacyOpen.name} onClose={() => setWorkspacePrivacyOpen(null)} />}
      {selectedRailMember && <MemberProfileDrawer memberId={selectedRailMember} onClose={() => setSelectedRailMember(null)} />}

      {pendingPermissionMoveV70 && <Modal title="Sync channel permissions?" subtitle="This category has different permissions from this channel." onClose={() => setPendingPermissionMoveV70(null)}><p className="modal-copy-v70">Choose whether this channel should follow the destination category permissions or keep its current custom permissions.</p><div className="modal-actions"><button className="secondary-button" onClick={() => setPendingPermissionMoveV70(null)}>Cancel</button><button className="secondary-button" onClick={() => void finishPermissionMoveV70(false)}>Keep Current Permissions</button><button className="primary-button" onClick={() => void finishPermissionMoveV70(true)}>Sync Permissions</button></div></Modal>}
      {spaceDialog && <Modal title={spaceDialog === 'create' ? 'Create a Space' : 'Join a Space'} subtitle={spaceDialog === 'create' ? 'Start with the Space profile. Everything can be changed later.' : 'Enter a Space or invite code.'} onClose={() => setSpaceDialog(null)}>{spaceDialog === 'create' && <div className="create-space-profile-v28"><button className="create-space-avatar-v28" onClick={() => spaceAvatarInput.current?.click()}><Avatar name={spaceValue || 'New Space'} initials={(spaceValue || 'NS').slice(0,2).toUpperCase()} src={spaceAvatarUrl} size={70} accent={spaceAccent}/><span><Icon name="edit" size={13}/></span></button><div><strong>Space picture</strong><small>Optional. Used in the Space rail and header.</small><button className="secondary-button compact" onClick={() => spaceAvatarInput.current?.click()}><Icon name="upload" size={13}/>Choose picture</button></div><input ref={spaceAvatarInput} hidden type="file" accept={createdSpaceImageAccept} onChange={event => void chooseSpaceAvatar(event)}/></div>}<label className="field-label">{spaceDialog === 'create' ? 'Space name' : 'Code'}<input className="text-input" autoFocus value={spaceValue} onChange={e => setSpaceValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && void submitSpace()} /></label>{spaceDialog === 'create' && <><label className="field-label">Description<textarea className="text-area" value={spaceDescription} onChange={e => setSpaceDescription(e.target.value)} maxLength={220} rows={3} placeholder="What is this Space for?"/></label><label className="field-label create-space-color-v28">Accent<input type="color" value={spaceAccent} onChange={e => setSpaceAccent(e.target.value)}/><code>{spaceAccent}</code></label></>}<div className="modal-actions"><button className="secondary-button" onClick={() => setSpaceDialog(null)}>Cancel</button><button className="primary-button" disabled={busy || !spaceValue.trim()} onClick={() => void submitSpace()}>{busy ? 'Working…' : spaceDialog === 'create' ? 'Create' : 'Join'}</button></div></Modal>}
      {spaceCropSource && <ImageCropper source={spaceCropSource} preset="avatar" title="Edit Space picture" onCancel={() => setSpaceCropSource(null)} onSave={dataUrl => { setSpaceAvatarUrl(dataUrl); setSpaceCropSource(null) }}/>}

      {channelDialog && <Modal title={channelThreadParentId ? 'Create thread' : 'Create channel'} subtitle={channelThreadParentId ? `This thread stays under #${data?.channels.find(item => item.id === channelThreadParentId)?.name ?? 'channel'} and uses normal chat.` : 'Choose the channel itself first; categories only organize where it appears.'} onClose={() => { setChannelDialog(false); setChannelThreadParentId(null) }} wide>
        <div className="channel-create-grid-v29">
          <div className="channel-create-main-v29">
            <label className="field-label">Channel name<input className="text-input" autoFocus value={channelName} onChange={e => setChannelName(e.target.value)} placeholder="design-room" /></label>
            <label className="field-label">Description<input className="text-input" value={channelDescription} onChange={e => setChannelDescription(e.target.value)} placeholder="What belongs here?" /></label>
            {!channelThreadParentId && <><label className="field-label">Category<select className="text-input channel-category-select-v29" value={channelCategoryId ?? ''} onChange={event => setChannelCategoryId(event.target.value || null)}><option value="">Uncategorized</option>{channelMeta.categories.filter(category => category.id !== 'staff' || canStaff).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <div className="channel-create-block-v29"><span className="field-label-static-v29">CHANNEL TYPE</span><div className="segmented-control channel-kind-control-v29">{(['chat', 'notes', 'mixed', 'announcement'] as const).map(kind => <button type="button" className={channelKind === kind ? 'active' : ''} key={kind} onClick={() => { setChannelKind(kind); if (channelIconChoice.kind === 'icon' && ['hash','chat','notes','bell'].includes(channelIconChoice.value)) setChannelIconChoice({ kind: 'icon', value: kind === 'notes' ? 'notes' : kind === 'announcement' ? 'bell' : kind === 'mixed' ? 'chat' : 'hash' }) }}>{kind}</button>)}</div></div></>}
          </div>
          <aside className="channel-icon-picker-v29">
            <div><span className="eyebrow">CHANNEL ICON</span><strong>Pick a gray Spaces icon</strong><small>Or choose a normal emoji below.</small></div>
            <div className="channel-icon-preset-grid-v29">{channelIconPresets.map(item => <button type="button" key={item.id} className={channelIconChoice.kind === 'icon' && channelIconChoice.value === item.icon ? 'active' : ''} title={item.label} onClick={() => setChannelIconChoice({ kind: 'icon', value: item.icon })}><Icon name={item.icon} size={17}/><span>{item.label}</span></button>)}</div>
            <details className="channel-emoji-details-v29"><summary>Normal emoji</summary><div className="channel-native-emoji-categories-v29">{EMOJI_CATEGORIES.filter(category => category.id !== 'frequent').map(category => <section key={category.id}><span>{category.label}</span><div className="channel-native-emoji-grid-v29">{category.emoji.map(emoji => <button type="button" key={`${category.id}-${emoji}`} title={emoji} className={channelIconChoice.kind === 'emoji' && channelIconChoice.value === emoji ? 'active' : ''} onClick={() => setChannelIconChoice({ kind: 'emoji', value: emoji })}>{emoji}</button>)}</div></section>)}</div></details>
          </aside>
        </div>
        <div className="modal-actions"><button className="secondary-button" onClick={() => { setChannelDialog(false); setChannelThreadParentId(null) }}>Cancel</button><button className="primary-button" disabled={busy || !normalizeChannelName(channelName)} onClick={() => void submitChannel()}>{busy ? 'Creating…' : channelThreadParentId ? 'Create thread' : 'Create channel'}</button></div>
      </Modal>}
      {categoryDialog && <Modal title="Create category" subtitle="Categories organize channels. Threads are created from an existing channel." onClose={() => setCategoryDialog(false)}><label className="field-label">Category name<input className="text-input" autoFocus value={categoryName} maxLength={36} onChange={event => setCategoryName(event.target.value)} onKeyDown={event => event.key === 'Enter' && submitCategory()} placeholder="Projects"/></label><div className="modal-actions"><button className="secondary-button" onClick={() => setCategoryDialog(false)}>Cancel</button><button className="primary-button" disabled={!categoryName.trim()} onClick={submitCategory}>Create category</button></div></Modal>}
      {channelIconTarget && <Modal title={`Change #${channelIconTarget.name} icon`} subtitle="Pick a gray Spaces icon or use a normal emoji." onClose={() => setChannelIconTarget(null)} wide><div className="channel-icon-edit-v29"><div className="channel-icon-preset-grid-v29">{channelIconPresets.map(item => <button type="button" key={item.id} className={channelIconChoice.kind === 'icon' && channelIconChoice.value === item.icon ? 'active' : ''} title={item.label} onClick={() => setChannelIconChoice({ kind: 'icon', value: item.icon })}><Icon name={item.icon} size={17}/><span>{item.label}</span></button>)}</div><details className="channel-emoji-details-v29" open><summary>Normal emoji</summary><div className="channel-native-emoji-categories-v29">{EMOJI_CATEGORIES.filter(category => category.id !== 'frequent').map(category => <section key={category.id}><span>{category.label}</span><div className="channel-native-emoji-grid-v29">{category.emoji.map(emoji => <button type="button" key={`${category.id}-${emoji}`} className={channelIconChoice.kind === 'emoji' && channelIconChoice.value === emoji ? 'active' : ''} onClick={() => setChannelIconChoice({ kind: 'emoji', value: emoji })}>{emoji}</button>)}</div></section>)}</div></details></div><div className="modal-actions"><button className="secondary-button" onClick={() => setChannelIconTarget(null)}>Cancel</button><button className="primary-button" onClick={() => { setChannelIcon(activeWorkspaceId, data?.channels ?? [], channelIconTarget.id, channelIconChoice); setChannelIconTarget(null); pushToast('Channel icon updated.', 'success') }}>Save icon</button></div></Modal>}

      {spaceSearchTitleV71 && <ContentSearchPanel title={spaceSearchTitleV71} subtitle="Search across this Space" items={spaceSearchItemsV71} onClose={() => setSpaceSearchTitleV71(null)} />}
      <ContextMenu menu={contextMenu.menu} onClose={contextMenu.close} />
      {categoryPermissionTarget && <CategoryPermissionsEditor categoryId={categoryPermissionTarget.id} categoryName={categoryPermissionTarget.name} onClose={() => setCategoryPermissionTarget(null)}/>}
      {channelPermissionTarget && <ChannelPermissionsEditor channel={channelPermissionTarget} onClose={() => setChannelPermissionTarget(null)} />}
    </div>
  )
}


function renderView(view: AppView, hasWorkspace: boolean) {
  if (!hasWorkspace) return <HomeView />

  switch (view) {
    case 'home': return <WorkspaceOverview />
    case 'chat': return <ChatView />
    case 'notes': return <NotesView />
    case 'members': return <MembersView />
    case 'roles': return <RolesView />
    case 'emoji': return <SettingsView initialTab="appearance" />
    case 'activity': return <ActivityView />
    case 'invites': return <InvitesView />
    case 'settings': return <SettingsView />
    case 'staff': return <StaffView />
    default: return <WorkspaceOverview />
  }
}


function IncomingNotificationPeek({ item, onOpen, onClose }: { item: SpacesNotification; onOpen: () => void; onClose: () => void }) {
  const title = item.kind === 'friend_request' ? `${item.authorName} sent a friend request`
    : item.kind === 'direct' ? `${item.authorName} sent you a DM`
    : item.kind === 'group' ? `${item.authorName} messaged ${item.channelName}`
    : item.kind === 'support' ? 'Spaces Support'
    : item.kind === 'everyone' ? `${item.authorName} pinged @everyone`
    : item.kind === 'here' ? `${item.authorName} pinged @here`
    : item.kind === 'role' ? `${item.authorName} pinged ${item.mentionLabel}`
    : item.kind === 'mention' ? `${item.authorName} mentioned you`
    : item.authorName
  const tone = item.kind === 'support' || item.kind === 'friend_request' ? 'orange' : 'blue'
  return <aside className={`incoming-notice page-enter notice-tone-${tone} ${item.kind === 'friend_request' ? 'incoming-request-v54' : ''}`} role="status">
    <button className="incoming-notice-main" onClick={onOpen}><span className="incoming-notice-icon notification-spaces-mark"><SpacesLogo title="Spaces ping" /></span><span><small>{item.workspaceName}</small><strong>{title}</strong><p>{item.preview}</p></span></button>
    <button className="incoming-notice-close" onClick={onClose} aria-label="Dismiss"><Icon name="x" size={13}/></button>
  </aside>
}

function MemberRail({ onOpenMember, onHide }: { onOpenMember: (memberId: string) => void; onHide: () => void }) {
  const { data, profile } = useSpaces()
  const [, setRoleLabelVersion] = useState(0)
  const { effectivePresence } = usePreferences()
  const [topOffset, setTopOffset] = useState(() => {
    const value = Number(localStorage.getItem('spaces.memberRailTop.v28') || 0)
    return Number.isFinite(value) ? Math.max(0, value) : 0
  })
  const drag = useRef<{ startY: number; startOffset: number } | null>(null)
  const currentOffset = useRef(topOffset)
  currentOffset.current = topOffset
  useEffect(() => {
    const onRoleLabels = () => setRoleLabelVersion(value => value + 1)
    window.addEventListener('spaces-role-labels-changed', onRoleLabels)
    return () => window.removeEventListener('spaces-role-labels-changed', onRoleLabels)
  }, [])
  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!drag.current) return
      const max = Math.max(0, window.innerHeight - 250)
      const next = Math.max(0, Math.min(max, drag.current.startOffset + event.clientY - drag.current.startY))
      currentOffset.current = next
      setTopOffset(next)
    }
    const up = () => {
      if (!drag.current) return
      drag.current = null
      const max = Math.max(0, window.innerHeight - 250)
      if (currentOffset.current > Math.max(210, max * .8)) { onHide(); return }
      localStorage.setItem('spaces.memberRailTop.v28', String(Math.round(currentOffset.current)))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [onHide])
  const members = useMemo(() => [...(data?.members ?? [])].sort((a, b) => a.displayName.localeCompare(b.displayName)), [data?.members])
  const roles = [...(data?.roles ?? [])].sort((a,b) => b.position-a.position)
  const hoisted = roles.filter(role => role.hoist)
  const claimed = new Set<string>()
  const ownerPresentationV44 = data?.baseRoles?.owner
  const ownerMembers = ownerPresentationV44?.hoist === false ? [] : members.filter(member => member.role === 'owner')
  ownerMembers.forEach(member => claimed.add(member.id))
  const roleGroups = hoisted.map(role => { const grouped = members.filter(member => member.customRoleIds.includes(role.id) && !claimed.has(member.id)); grouped.forEach(member => claimed.add(member.id)); return { role, members: grouped } }).filter(group => group.members.length)
  const remaining = members.filter(member => !claimed.has(member.id))
  const railPresence = (member: (typeof members)[number]) => member.profileId === profile?.id ? effectivePresence : member.status === 'away' ? 'idle' : member.status
  const online = remaining.filter(member => railPresence(member) !== 'offline')
  const offline = remaining.filter(member => railPresence(member) === 'offline')
  return <aside className="member-rail member-rail-v28" style={{ '--member-rail-top': `${topOffset}px` } as CSSProperties}><button className="member-rail-drag-v28" aria-label="Drag member list down to reduce it" title="Drag down to reduce · double-click to reset" onDoubleClick={() => { setTopOffset(0); localStorage.setItem('spaces.memberRailTop.v28', '0') }} onPointerDown={event => { event.preventDefault(); drag.current = { startY: event.clientY, startOffset: topOffset } }}><i/><span>PEOPLE</span><i/></button><header><strong>{members.length} members</strong><button onClick={onHide} title="Hide people"><Icon name="x" size={12}/></button></header><div className="member-rail-scroll">{ownerMembers.length > 0 && <MemberRailGroup workspaceId={data?.workspace.id ?? ''} title={workspaceRoleDisplayName(data?.workspace.id ?? '', 'owner').toUpperCase()} members={ownerMembers} roles={roles} onOpenMember={onOpenMember} />}{roleGroups.map(group => <MemberRailGroup workspaceId={data?.workspace.id ?? ''} key={group.role.id} title={group.role.name.toUpperCase()} members={group.members} roles={roles} onOpenMember={onOpenMember} />)}{online.length > 0 && <MemberRailGroup workspaceId={data?.workspace.id ?? ''} title="ONLINE" members={online} roles={roles} onOpenMember={onOpenMember} />}{offline.length > 0 && <MemberRailGroup workspaceId={data?.workspace.id ?? ''} title="OFFLINE" members={offline} roles={roles} onOpenMember={onOpenMember} />}</div></aside>
}

function MemberRailGroup({ workspaceId, title, members, roles, onOpenMember }: { workspaceId: string; title: string; members: NonNullable<ReturnType<typeof useSpaces>['data']>['members']; roles: NonNullable<ReturnType<typeof useSpaces>['data']>['roles']; onOpenMember: (memberId: string) => void }) {
  const { profile, data } = useSpaces()
  const { effectivePresence } = usePreferences()
  return <section className="member-rail-group"><div className="member-rail-label">{title} — {members.length}</div>{members.map(member => { const topRole = roles.filter(role => member.customRoleIds.includes(role.id)).sort((a, b) => b.position - a.position)[0]; const baseRoleColorV44 = member.role === 'owner' ? data?.baseRoles?.owner?.color : data?.baseRoles?.member?.color; const roleColorV44 = member.role === 'owner' ? baseRoleColorV44 : (topRole?.color ?? baseRoleColorV44); const status = member.profileId === profile?.id ? effectivePresence : member.status === 'away' ? 'idle' : member.status; return <button className="member-rail-row" key={member.id} onClick={() => onOpenMember(member.id)}><div className="avatar-wrap"><Avatar name={member.displayName} initials={member.initials} src={member.avatarUrl} size={32} accent={roleColorV44} /><span className={`presence-symbol member-rail-presence presence-${status}`} /></div><div><strong style={roleColorV44 ? { color: roleColorV44 } : undefined}>{member.displayName}</strong><span>{member.customStatus || (member.platformRole ? platformRoleLabel(member.platformRole) : (topRole?.name ?? workspaceRoleDisplayName(workspaceId, member.role)))}</span></div>{member.platformRole && <span className={`member-platform-rail platform-${member.platformRole} ${member.platformRole === 'founder' ? 'founder-distinct-v56' : ''}`}><Icon name={member.platformRole === 'founder' ? 'sparkle' : 'shield'} size={12}/>{platformRoleLabel(member.platformRole)}</span>}</button> })}</section>
}

function AccountQuickMenu({ onSettings }: { onSettings: () => void }) {
  const { profile } = useSpaces()
  const { preferences, effectivePresence, setPreference } = usePreferences()
  const statusOptions = [
    { id: 'online' as const, label: 'Online', note: 'You appear online' },
    { id: 'idle' as const, label: 'Idle', note: 'You appear away' },
    { id: 'dnd' as const, label: 'Do Not Disturb', note: 'Suppress notifications' },
    { id: 'offline' as const, label: 'Invisible', note: 'You appear offline' },
  ]
  return <div className="account-quick-menu page-enter">
    <div className="account-quick-head"><div className="account-quick-avatar profile-avatar-presence"><Avatar name={profile?.displayName} initials={profile?.initials} src={profile?.avatarUrl} size={48} accent={profile?.profileAccent}/><span className={`presence-symbol presence-${effectivePresence}`} aria-label={effectivePresence} title={effectivePresence === 'dnd' ? 'Do Not Disturb' : effectivePresence === 'offline' ? 'Invisible' : effectivePresence[0].toUpperCase() + effectivePresence.slice(1)} /></div><div><strong>{profile?.displayName}</strong><span>@{profile?.username}</span></div></div>
    <label className="quick-status-input"><span>STATUS <small>{preferences.customStatus.length}/128</small></span><input value={preferences.customStatus} maxLength={128} onChange={event => setPreference('customStatus', event.target.value)} placeholder="Set a custom status…" /></label>
    <div className="quick-presence-list">{statusOptions.map(option => <button key={option.id} className={preferences.presence === option.id ? 'active' : ''} onClick={() => setPreference('presence', option.id)}><span className={`presence-symbol presence-${option.id}`} /><div><strong>{option.label}</strong><span>{option.note}</span></div>{preferences.presence === option.id && <Icon name="check" size={14}/>}</button>)}</div>
    <button className="quick-settings-button" onClick={onSettings}><Icon name="settings" size={15}/><span>Account settings</span><Icon name="chevron" size={13}/></button>
  </div>
}

function CommandPalette() {
  const { profile, workspaces, data, activeWorkspaceId, chooseWorkspace, chooseChannel, setView, setCommandOpen } = useSpaces()
  const { preferences } = usePreferences()
  const visibleWorkspaces = workspaces.filter(space => !preferences.hiddenWorkspaceIds.includes(space.id))
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const q = query.trim().toLowerCase()
  const isHubFounder = activeWorkspaceId === 'spaces-hub' && profile?.platformRole === 'founder'
  const canInvite = isHubFounder || hasWorkspacePermission(data, profile?.id, 'create_invites')
  const canManageRoles = isHubFounder || hasWorkspacePermission(data, profile?.id, 'manage_roles')
  const canViewActivity = isHubFounder || hasWorkspacePermission(data, profile?.id, 'view_audit_log')
  const canAccessNavItem = (item: (typeof navItems)[number]) => item.view === 'staff' ? (canManageRoles || hasWorkspacePermission(data, profile?.id, 'manage_members') || hasWorkspacePermission(data, profile?.id, 'moderate_messages') || hasWorkspacePermission(data, profile?.id, 'moderate_comments') || canViewActivity) : item.view === 'roles' ? canManageRoles : item.view === 'activity' ? canViewActivity : item.view === 'invites' ? canInvite : true
  const commands = [
    ...visibleWorkspaces.map(space => ({ key: `space-${space.id}`, label: space.name, meta: 'Space', icon: 'grid' as IconName, run: () => void chooseWorkspace(space.id) })),
    ...(data?.channels ?? []).map(channel => ({ key: `channel-${channel.id}`, label: `# ${channel.name}`, meta: channel.kind, icon: channel.kind === 'notes' ? 'notes' as IconName : 'hash' as IconName, run: () => chooseChannel(channel.id) })),
    ...(data?.notes ?? []).map(note => ({ key: `note-${note.id}`, label: note.title, meta: 'Note', icon: 'notes' as IconName, run: () => chooseChannel(note.channelId) })),
    ...(data?.members ?? []).map(member => ({ key: `member-${member.id}`, label: `@${member.username}`, meta: member.displayName, icon: 'user' as IconName, run: () => setView('members') })),
    ...(activeWorkspaceId ? navItems.filter(canAccessNavItem).map(item => ({ key: `view-${item.view}`, label: item.label, meta: 'View', icon: item.icon, run: () => setView(item.view) })) : []),
  ].filter(item => !q || `${item.label} ${item.meta}`.toLowerCase().includes(q)).slice(0, 14)

  function openSelected() {
    const item = commands[Math.min(selected, Math.max(0, commands.length - 1))]
    if (!item) return
    item.run()
    setCommandOpen(false)
  }

  return <div className="command-backdrop" onPointerDown={event => event.target === event.currentTarget && setCommandOpen(false)}><section className="command-palette"><div className="command-search"><Icon name="search" /><input autoFocus value={query} onChange={event => { setQuery(event.target.value); setSelected(0) }} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setSelected(value => commands.length ? (value + 1) % commands.length : 0) } else if (event.key === 'ArrowUp') { event.preventDefault(); setSelected(value => commands.length ? (value - 1 + commands.length) % commands.length : 0) } else if (event.key === 'Enter') { event.preventDefault(); openSelected() } }} placeholder="Jump to a Space, channel, member…" /><kbd>ESC</kbd></div><div className="command-results">{commands.map((item, index) => <button className={selected === index ? 'selected' : ''} key={item.key} onMouseEnter={() => setSelected(index)} onClick={() => { item.run(); setCommandOpen(false) }}><span className="command-icon"><Icon name={item.icon} size={16} /></span><div><strong>{item.label}</strong><span>{item.meta}</span></div>{selected === index && <kbd>↵</kbd>}</button>)}{!commands.length && <div className="command-empty">No results for “{query}”.</div>}</div><footer><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>Enter</kbd> Open</span><span><kbd>Esc</kbd> Close</span></footer></section></div>
}

