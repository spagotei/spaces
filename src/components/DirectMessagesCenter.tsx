import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { useAppDialog } from './AppDialog'
import { ContextMenu, useContextMenu } from './ContextMenu'
import { ContentSearchPanel, type ContentSearchItem } from './ContentSearchPanel'
import { useSpaces } from '../state/SpacesContext'
import { useBlockedUserIds } from '../hooks/useBlockedUsers'
import { blockUser, unblockUser } from '../api/social-api'
import { dismissNotifications } from '../utils/notification-read'
import type {
  WorkspaceDirectCenter,
  WorkspaceDirectConversation,
  WorkspaceDirectGroup,
  WorkspaceDirectGroupMessage,
  WorkspaceDirectMessage,
  WorkspacePlatformRole,
  WorkspaceTypingUser,
} from '../types/spaces'
import { timeAgo } from '../utils/format'
import { platformRoleLabel } from '../utils/permissions'
import { SupportGlyphV73 } from '../features/support/SupportTicketsV73'
import { SupportMemberV77 } from '../features/support/v77/SupportMemberV77'
import { dispatchSupportIntakeV77, openProfileV77 } from '../features/support/v77/support-v77-api'

export type DirectTab = 'friends' | 'support' | 'requests' | 'groups' | 'add'

type ThreadPreferenceV59 = {
  pinnedAt: number | null
  mutedUntil: number | null
  closedAt: number | null
}

type DirectConversationV59 = WorkspaceDirectConversation & ThreadPreferenceV59
type DirectGroupV59 = WorkspaceDirectGroup & ThreadPreferenceV59
type SupportDirectThreadV59 = ThreadPreferenceV59 & {
  id: 'support'
  title: 'Support Tickets'
  lastMessage: string | null
  lastMessageAt: number | null
  unreadCount: number
}
type DirectCenterV59 = Omit<WorkspaceDirectCenter, 'conversations' | 'friends' | 'groups'> & {
  conversations: DirectConversationV59[]
  friends: DirectConversationV59[]
  groups: DirectGroupV59[]
  supportThread: SupportDirectThreadV59 | null
}

type PinnedDirectMessage = {
  id: string
  senderUserId: string
  senderName: string
  body: string
  createdAt: number
  pinnedBy: string
  pinnedAt: number
}

type SupportInboxMessage = {
  id: string
  recipientUserId: string
  recipientName: string
  senderUserId: string
  senderName: string
  caseId: string | null
  subject: string
  body: string
  messageKind: 'official' | 'reply'
  createdAt: number
  readAt: number | null
  direction: 'incoming' | 'outgoing'
}

const emptyCenter: DirectCenterV59 = {
  conversations: [],
  friends: [],
  incomingRequests: [],
  outgoingRequests: [],
  groups: [],
  supportThread: null,
}

export function DirectMessagesCenter({
  onClose,
  initialConversationId = null,
  initialGroupId = null,
  initialTab = 'friends',
  embedded = false,
}: {
  onClose: () => void
  initialConversationId?: string | null
  initialGroupId?: string | null
  initialTab?: DirectTab
  embedded?: boolean
}) {
  const dialog = useAppDialog()
  const {
    apiUrl,
    session,
    profile,
    getDirectCenter,
    requestDirectConversation,
    acceptDirectConversation,
    declineDirectConversation,
    listDirectMessages,
    sendDirectMessage,
    createDirectGroup,
    listDirectGroupMessages,
    sendDirectGroupMessage,
    pushToast,
    listTypingPresence,
    setTypingPresence,
  } = useSpaces()
  const blockedUserIds = useBlockedUserIds(session?.token)
  const [center, setCenter] = useState<DirectCenterV59>(emptyCenter)
  const [tab, setTab] = useState<DirectTab>(initialTab)
  const [selectedId, setSelectedId] = useState<string | null>(initialConversationId)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId)
  const [messages, setMessages] = useState<WorkspaceDirectMessage[]>([])
  const [groupMessages, setGroupMessages] = useState<WorkspaceDirectGroupMessage[]>([])
  const [supportMessages, setSupportMessages] = useState<SupportInboxMessage[]>([])
  const [, setSupportLoading] = useState(false)
  const [directSearchOpenV71, setDirectSearchOpenV71] = useState(false)
  const [username, setUsername] = useState('')
  const [draft, setDraft] = useState('')
  const [groupDraft, setGroupDraft] = useState('')
  const [groupName, setGroupName] = useState('')
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([])
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pinnedMessages, setPinnedMessages] = useState<PinnedDirectMessage[]>([])
  const [pinsOpen, setPinsOpen] = useState(false)
  const [typingUsersV72, setTypingUsersV72] = useState<WorkspaceTypingUser[]>([])
  const typingLastSignalV72 = useRef(0)
  const typingStopTimerV72 = useRef<number | null>(null)
  const [directProfilePerson, setDirectProfilePerson] = useState<WorkspaceDirectConversation['person'] | null>(null)
  const [groupMembersOpen, setGroupMembersOpen] = useState(false)
  const [groupInviteOpen, setGroupInviteOpen] = useState(false)
  const [groupInviteBusy, setGroupInviteBusy] = useState('')
  const threadMenu = useContextMenu()
  const [profilePersonV76, setProfilePersonV76] = useState<WorkspaceDirectConversation['person'] | null>(null)

  const selected = useMemo(() => {
    const all = [
      ...center.conversations,
      ...center.incomingRequests,
      ...center.outgoingRequests,
    ]
    return all.find(item => item.id === selectedId) ?? null
  }, [center, selectedId])

  const selectedGroup = useMemo(
    () => center.groups.find(item => item.id === selectedGroupId) ?? null,
    [center.groups, selectedGroupId],
  )

  const typingScopeV72 = tab === 'support'
    ? { kind: 'support' as const, id: 'support' }
    : selected
      ? { kind: 'dm' as const, id: selected.id }
      : selectedGroup
        ? { kind: 'group' as const, id: selectedGroup.id }
        : null

  function updateDirectDraftV72(value: string, kind: 'dm' | 'group' | 'support', id: string, setter: (value: string) => void) {
    setter(value)
    if (typingStopTimerV72.current) window.clearTimeout(typingStopTimerV72.current)
    if (!value.trim()) {
      void setTypingPresence(kind, id, false).catch(() => undefined)
      return
    }
    const now = Date.now()
    if (now - typingLastSignalV72.current > 1200) {
      typingLastSignalV72.current = now
      void setTypingPresence(kind, id, true).catch(() => undefined)
    }
    typingStopTimerV72.current = window.setTimeout(() => {
      void setTypingPresence(kind, id, false).catch(() => undefined)
    }, 2800)
  }

  useEffect(() => {
    if (!typingScopeV72 || !session?.token) {
      setTypingUsersV72([])
      return
    }
    let cancelled = false
    const scope = typingScopeV72
    const load = () => void listTypingPresence(scope.kind, scope.id)
      .then(items => { if (!cancelled) setTypingUsersV72(items) })
      .catch(() => undefined)
    load()
    const timer = window.setInterval(load, 1400)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      if (typingStopTimerV72.current) window.clearTimeout(typingStopTimerV72.current)
      void setTypingPresence(scope.kind, scope.id, false).catch(() => undefined)
    }
  }, [typingScopeV72?.kind, typingScopeV72?.id, listTypingPresence, session?.token, setTypingPresence])

  const supportUnread = supportMessages.filter(
    item => item.direction === 'incoming' && !item.readAt,
  ).length

  useEffect(() => {
    setSelectedId(initialConversationId)
    setSelectedGroupId(initialGroupId)
    if (initialConversationId) setTab('friends')
    else if (initialGroupId) setTab('groups')
    else setTab(initialTab)
  }, [initialConversationId, initialGroupId, initialTab])

  useEffect(() => {
    if (selectedId) {
      dismissNotifications({ conversationId: selectedId, kind: 'direct' })
      void loadPins('dm', selectedId)
    } else if (!selectedGroupId) {
      setPinnedMessages([])
      setPinsOpen(false)
    }
  }, [selectedId])

  useEffect(() => {
    if (selectedGroupId) {
      dismissNotifications({ groupId: selectedGroupId, kind: 'group' })
      void loadPins('group', selectedGroupId)
    }
  }, [selectedGroupId])

  useEffect(() => {
    if (tab === 'support') dismissNotifications({ kind: 'support' })
    if (tab === 'requests') dismissNotifications({ kind: 'friend_request' })
  }, [tab])

  const directSearchItemsV71 = useMemo<ContentSearchItem[]>(() => {
    const items: ContentSearchItem[] = []
    const linkPattern = /https?:\/\/[^\s<>()]+/giu
    const append = (id: string, sender: string, body: string, createdAt: number) => {
      items.push({ id: `message:${id}`, kind: 'message', title: sender, preview: body, createdAt })
      for (const [index, link] of [...body.matchAll(linkPattern)].entries()) {
        items.push({ id: `link:${id}:${index}`, kind: 'link', title: link[0], subtitle: sender, preview: body, createdAt })
      }
    }

    if (tab === 'support') {
      for (const item of supportMessages) append(item.id, item.direction === 'outgoing' ? 'You' : item.senderName || 'Spaces Support', item.body, item.createdAt)
    } else if (selectedGroup) {
      for (const item of groupMessages) append(item.id, item.senderUserId === profile?.id ? 'You' : item.senderName, item.body, item.createdAt)
    } else {
      for (const item of messages) append(item.id, item.senderUserId === profile?.id ? 'You' : item.senderName, item.body, item.createdAt)
    }
    return items
  }, [groupMessages, messages, profile?.id, selectedGroup, supportMessages, tab])

  const directSearchTitleV71 = tab === 'support'
    ? 'Search Support Tickets'
    : selectedGroup
      ? `Search ${selectedGroup.name}`
      : selected
        ? `Search ${selected.person.displayName}`
        : 'Search conversation'

  function openThreadSearchV71(kind: 'dm' | 'group' | 'support', id: string) {
    if (kind === 'dm') {
      setSelectedId(id)
      setSelectedGroupId(null)
      setTab('friends')
    } else if (kind === 'group') {
      setSelectedGroupId(id)
      setSelectedId(null)
      setTab('groups')
    } else {
      setSelectedId(null)
      setSelectedGroupId(null)
      setTab('support')
      void reloadSupport(true)
    }
    setDirectSearchOpenV71(true)
  }

  async function supportRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers)
    headers.set('Content-Type', 'application/json')
    if (session?.token) headers.set('Authorization', `Bearer ${session.token}`)
    const response = await fetch(`${apiUrl}${path}`, { ...init, headers })
    if (!response.ok) {
      let message = `Support request failed (${response.status}).`
      try {
        const payload = (await response.json()) as { error?: string; message?: string }
        message = payload.message || payload.error || message
      } catch {
        // Keep the status message.
      }
      throw new Error(message)
    }
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  async function reload() {
    setLoading(true)
    try {
      const next = await getDirectCenter()
      const normalized = {
        ...emptyCenter,
        ...next,
        conversations: (next.conversations ?? []) as DirectConversationV59[],
        friends: ((next as DirectCenterV59).friends ?? next.conversations ?? []) as DirectConversationV59[],
        groups: (next.groups ?? []) as DirectGroupV59[],
        supportThread: (next as DirectCenterV59).supportThread ?? null,
      } as DirectCenterV59
      setCenter(normalized)
      if (
        selectedId &&
        ![
          ...normalized.friends,
          ...normalized.conversations,
          ...normalized.incomingRequests,
          ...normalized.outgoingRequests,
        ].some(item => item.id === selectedId)
      )
        setSelectedId(null)
      if (
        selectedGroupId &&
        !normalized.groups.some(item => item.id === selectedGroupId)
      )
        setSelectedGroupId(null)
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : 'Could not load friends and messages.',
        'danger',
      )
    } finally {
      setLoading(false)
    }
  }

  async function reloadSupport(markRead = false) {
    setSupportLoading(true)
    try {
      const items = await supportRequest<SupportInboxMessage[]>(
        `/v1/support/inbox${markRead ? '?markRead=1' : ''}`,
      )
      setSupportMessages(items)
    } catch (error) {
      // Older Workers may not have the Support Reply route yet. Do not break normal DMs.
      if (tab === 'support') {
        pushToast(
          error instanceof Error ? error.message : 'Could not load Support messages.',
          'danger',
        )
      }
    } finally {
      setSupportLoading(false)
    }
  }

  useEffect(() => {
    void reload()
    void reloadSupport(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const switchTab = (event: Event) => {
      const requested = (
        event as CustomEvent<'people' | 'friends' | 'support' | 'requests' | 'groups' | 'add'>
      ).detail
      const next: DirectTab = requested === 'people' ? 'friends' : requested
      if (
        next === 'friends' ||
        next === 'support' ||
        next === 'requests' ||
        next === 'groups' ||
        next === 'add'
      ) {
        setTab(next)
        setSelectedId(null)
        setSelectedGroupId(null)
        setCreatingGroup(false)
        if (next === 'support') void reloadSupport(true)
      }
    }
    window.addEventListener('spaces-direct-tab', switchTab)
    return () => window.removeEventListener('spaces-direct-tab', switchTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (tab !== 'support') return
    void reloadSupport(true)
    const timer = window.setInterval(() => void reloadSupport(true), 5000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  useEffect(() => {
    if (!selected || selected.status !== 'accepted') {
      setMessages([])
      return
    }
    let cancelled = false
    void listDirectMessages(selected.id)
      .then(items => {
        if (!cancelled) setMessages(items)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [listDirectMessages, selected?.id, selected?.status])

  useEffect(() => {
    if (!selectedGroup) {
      setGroupMessages([])
      return
    }
    let cancelled = false
    void listDirectGroupMessages(selectedGroup.id)
      .then(items => {
        if (!cancelled) setGroupMessages(items)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [listDirectGroupMessages, selectedGroup?.id])

  async function addFriend() {
    const clean = username.trim().replace(/^@/, '')
    if (!clean || busy) return
    setBusy(true)
    try {
      const conversation = await requestDirectConversation({ username: clean })
      setUsername('')
      await reload()
      setSelectedId(conversation.id)
      setSelectedGroupId(null)
      setTab(conversation.status === 'accepted' ? 'friends' : 'requests')
      pushToast(
        conversation.status === 'accepted'
          ? `${conversation.person.displayName} is now in Your Friends.`
          : `Friend request sent to @${conversation.person.username}.`,
        'success',
      )
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : 'Could not send that friend request.',
        'danger',
      )
    } finally {
      setBusy(false)
    }
  }

  async function accept(conversation: WorkspaceDirectConversation) {
    setBusy(true)
    try {
      const next = await acceptDirectConversation(conversation.id)
      await reload()
      setSelectedId(next.id)
      setSelectedGroupId(null)
      setTab('friends')
      window.dispatchEvent(new CustomEvent('spaces-direct-activity-v69', {
        detail: { kind: 'direct', id: next.id, at: Date.now() },
      }))
      window.dispatchEvent(new Event('spaces-direct-sidebar-refresh'))
      pushToast(`${next.person.displayName} added to Your Friends.`, 'success')
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : 'Could not accept request.',
        'danger',
      )
    } finally {
      setBusy(false)
    }
  }

  async function decline(conversation: WorkspaceDirectConversation) {
    setBusy(true)
    try {
      await declineDirectConversation(conversation.id)
      if (selectedId === conversation.id) setSelectedId(null)
      await reload()
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : 'Could not decline request.',
        'danger',
      )
    } finally {
      setBusy(false)
    }
  }

  async function send() {
    const body = draft.trim()
    if (!selected || selected.status !== 'accepted' || !body || busy) return
    setBusy(true)
    try {
      const sent = await sendDirectMessage(selected.id, body)
      setMessages(current => [...current, sent])
      setDraft('')
      window.dispatchEvent(new CustomEvent('spaces-direct-activity-v69', {
        detail: { kind: 'direct', id: selected.id, preview: body, at: Number(sent.createdAt ?? Date.now()) },
      }))
      window.dispatchEvent(new Event('spaces-direct-sidebar-refresh'))
      await reload()
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : 'Could not send message.',
        'danger',
      )
    } finally {
      setBusy(false)
    }
  }

  function toggleGroupFriend(userId: string) {
    setGroupMemberIds(current =>
      current.includes(userId)
        ? current.filter(id => id !== userId)
        : current.length >= 9
          ? current
          : [...current, userId],
    )
  }

  async function makeGroup() {
    const name = groupName.trim()
    if (!name || groupMemberIds.length < 1 || busy) return
    setBusy(true)
    try {
      const group = await createDirectGroup(name, groupMemberIds)
      setGroupName('')
      setGroupMemberIds([])
      setCreatingGroup(false)
      await reload()
      setSelectedId(null)
      setSelectedGroupId(group.id)
      setTab('groups')
      window.dispatchEvent(new CustomEvent('spaces-direct-activity-v69', {
        detail: { kind: 'group', id: group.id, at: Date.now() },
      }))
      window.dispatchEvent(new Event('spaces-direct-sidebar-refresh'))
      pushToast(`${group.name} created.`, 'success')
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : 'Could not create group chat.',
        'danger',
      )
    } finally {
      setBusy(false)
    }
  }

  async function sendGroup() {
    const body = groupDraft.trim()
    if (!selectedGroup || !body || busy) return
    setBusy(true)
    try {
      const sent = await sendDirectGroupMessage(selectedGroup.id, body)
      setGroupMessages(current => [...current, sent])
      setGroupDraft('')
      window.dispatchEvent(new CustomEvent('spaces-direct-activity-v69', {
        detail: { kind: 'group', id: selectedGroup.id, preview: body, at: Number(sent.createdAt ?? Date.now()) },
      }))
      window.dispatchEvent(new Event('spaces-direct-sidebar-refresh'))
      await reload()
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : 'Could not send group message.',
        'danger',
      )
    } finally {
      setBusy(false)
    }
  }


  async function loadPins(kind: 'dm' | 'group', threadId: string) {
    try {
      setPinnedMessages(await supportRequest<PinnedDirectMessage[]>(`/v1/direct/pins/${kind}/${encodeURIComponent(threadId)}`))
    } catch {
      setPinnedMessages([])
    }
  }

  async function toggleMessagePin(kind: 'dm' | 'group', threadId: string, messageId: string) {
    const pinned = pinnedMessages.some(item => item.id === messageId)
    try {
      await supportRequest(`/v1/direct/pins/${kind}/${encodeURIComponent(threadId)}/${encodeURIComponent(messageId)}`, {
        method: pinned ? 'DELETE' : 'PUT',
      })
      await loadPins(kind, threadId)
      pushToast(pinned ? 'Message unpinned.' : 'Message pinned.', 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not update the pin.', 'danger')
    }
  }

  async function reportDirectPerson(userId: string, displayName: string) {
    const conversation = [...center.conversations, ...center.incomingRequests, ...center.outgoingRequests].find(item => item.person.id === userId)
    dispatchSupportIntakeV77({ type: 'user_report', targetUserId: userId, targetUsername: conversation?.person.username ?? null, targetDisplayName: displayName, source: 'dm_context' })
  }

  async function toggleDirectBlock(userId: string, displayName: string) {
    if (!session?.token) return
    const blocked = blockedUserIds.includes(userId)

    if (!blocked) {
      const confirmed = await dialog.confirm({
        title: `Block ${displayName}?`,
        message: 'Their shared-Space messages stay hidden unless you reveal them. Direct contact and friend requests stop until you unblock them.',
        confirmText: 'Block',
        danger: true,
      })
      if (!confirmed) return
    }

    try {
      if (blocked) await unblockUser(session.token, userId)
      else await blockUser(session.token, userId)
      await reload()
      pushToast(blocked ? `${displayName} unblocked.` : `${displayName} blocked.`, 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not update block.', 'danger')
    }
  }

  // SPACES_GROUP_PANEL_STATE_V67
  useEffect(() => {
    if (selectedGroupId) {
      setGroupMembersOpen(true)
      setGroupInviteOpen(false)
    } else {
      setGroupMembersOpen(false)
      setGroupInviteOpen(false)
    }
  }, [selectedGroupId])

  async function inviteDirectGroupMember(
    groupId: string,
    userId: string,
    displayName: string,
  ) {
    setGroupInviteBusy(userId)
    try {
      await supportRequest(
        `/v1/direct/groups/${encodeURIComponent(groupId)}/members`,
        {
          method: 'POST',
          body: JSON.stringify({ userId }),
        },
      )
      await reload()
      pushToast(`${displayName} added to the group DM.`, 'success')
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : 'Could not invite that person.',
        'danger',
      )
    } finally {
      setGroupInviteBusy('')
    }
  }

  async function updateThreadPreference(
    kind: 'dm' | 'group' | 'support',
    id: string,
    input: { pinned?: boolean; muteMinutes?: number; unmute?: boolean; closed?: boolean },
  ) {
    try {
      await supportRequest(`/v1/direct/preferences/${kind}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      })
      if (kind === 'dm' && input.closed && selectedId === id) setSelectedId(null)
      if (kind === 'group' && input.closed && selectedGroupId === id) setSelectedGroupId(null)
      if (kind === 'support' && input.closed && tab === 'support') setTab('friends')
      await reload()
      if (kind === 'support') await reloadSupport(false)
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : 'Could not update that conversation.',
        'danger',
      )
    }
  }

  const friendListV68 = center.friends.length ? center.friends : center.conversations

  async function openFriendConversationV68(item: DirectConversationV59) {
    if (item.closedAt) {
      await updateThreadPreference('dm', item.id, { closed: false })
    }
    window.dispatchEvent(new CustomEvent('spaces-direct-activity-v69', {
      detail: { kind: 'direct', id: item.id, at: Date.now() },
    }))
    window.dispatchEvent(new Event('spaces-direct-sidebar-refresh'))
    setSelectedId(item.id)
  }

  function threadActions(
    kind: 'dm' | 'group' | 'support',
    id: string,
    item: ThreadPreferenceV59,
  ) {
    const muted = Boolean(item.mutedUntil && item.mutedUntil > Date.now())
    const conversation = kind === 'dm'
      ? [...center.conversations, ...center.incomingRequests, ...center.outgoingRequests].find(row => row.id === id)
      : null
    const blocked = Boolean(conversation && blockedUserIds.includes(conversation.person.id))
    const noun = kind === 'group' ? 'Group DM' : kind === 'support' ? 'Support Tickets' : 'DM'

    return [
      ...(conversation ? [{
        id: 'view-profile-thread-v77',
        label: 'View Profile',
        note: 'Open this member profile',
        icon: 'user' as const,
        onSelect: () => openProfileV77(conversation.person.id, conversation.person),
      }] : []),
      {
        id: 'search-v71',
        label: 'Search conversation',
        note: 'Messages, media, files, and links',
        icon: 'search' as const,
        onSelect: () => openThreadSearchV71(kind, id),
      },
      {
        id: 'pin',
        label: item.pinnedAt ? `Unpin ${noun}` : `Pin ${noun}`,
        icon: 'pin' as const,
        checked: Boolean(item.pinnedAt),
        onSelect: () => updateThreadPreference(kind, id, { pinned: !item.pinnedAt }),
      },
      ...(muted
        ? [{ id: 'unmute', label: 'Unmute', icon: 'bell' as const, onSelect: () => updateThreadPreference(kind, id, { unmute: true }) }]
        : [{ id: 'mute-v70', label: kind === 'dm' ? 'Mute DM' : kind === 'group' ? 'Mute group' : 'Mute Support', icon: 'bell' as const, onSelect: () => updateThreadPreference(kind, id, { muteMinutes: -1 }), submenu: [
            { id: 'mute-1h', label: '1 hour', onSelect: () => updateThreadPreference(kind, id, { muteMinutes: 60 }) },
            { id: 'mute-8h', label: '8 hours', onSelect: () => updateThreadPreference(kind, id, { muteMinutes: 480 }) },
            { id: 'mute-24h', label: '24 hours', onSelect: () => updateThreadPreference(kind, id, { muteMinutes: 1440 }) },
            { id: 'mute-forever', label: 'Until I turn it back on', onSelect: () => updateThreadPreference(kind, id, { muteMinutes: -1 }) },
          ] }]),
      ...(conversation ? [{
        id: 'report',
        label: 'Report user',
        icon: 'shield' as const,
        separatorBefore: true,
        onSelect: () => reportDirectPerson(conversation.person.id, conversation.person.displayName),
      }, {
        id: 'block',
        label: blocked ? 'Unblock user' : 'Block user',
        icon: 'lock' as const,
        danger: !blocked,
        checked: blocked,
        onSelect: () => toggleDirectBlock(conversation.person.id, conversation.person.displayName),
      }] : []),
      {
        id: 'close',
        label: kind === 'group' ? 'Close Group DM' : kind === 'support' ? 'Close Support Tickets' : 'Close DM',
        icon: 'x' as const,
        separatorBefore: true,
        onSelect: () => updateThreadPreference(kind, id, { closed: true }),
      },
    ]
  }

  function directHeaderActions(conversation: {
    id: string
    person: {
      id: string
      displayName: string
      username: string
    }
  }) {
    const blocked = blockedUserIds.includes(conversation.person.id)
    return [
      {
        id: 'view-profile-v77',
        label: 'View Profile',
        note: 'Open this member without leaving the conversation',
        icon: 'user' as const,
        onSelect: () => openProfileV77(conversation.person.id, conversation.person),
      },
      {
        id: 'search-v71-header',
        label: 'Search conversation',
        note: 'Messages and links',
        icon: 'search' as const,
        onSelect: () => openThreadSearchV71('dm', conversation.id),
      },
      {
        id: 'report',
        label: 'Report user',
        note: 'Send this account to Spaces moderation',
        icon: 'shield' as const,
        onSelect: () => reportDirectPerson(conversation.person.id, conversation.person.displayName),
      },
      {
        id: 'block',
        label: blocked ? 'Unblock user' : 'Block user',
        note: blocked ? 'Allow direct contact again' : 'Hide messages and stop direct contact',
        icon: 'lock' as const,
        danger: !blocked,
        checked: blocked,
        onSelect: () => toggleDirectBlock(conversation.person.id, conversation.person.displayName),
      },
      {
        id: 'close',
        label: 'Close DM',
        note: 'It returns if a new message arrives.',
        icon: 'x' as const,
        onSelect: () => updateThreadPreference('dm', conversation.id, { closed: true }),
      },
    ]
  }

  const selectTab = (next: DirectTab) => {
    setTab(next)
    setSelectedId(null)
    setSelectedGroupId(null)
    setCreatingGroup(false)
    if (next === 'support') void reloadSupport(true)
  }

  return (
    <Modal
      title="Friends & Messages"
      subtitle="Friends, requests, direct messages, Support replies, and private group chats."
      onClose={onClose}
      wide
      embedded={embedded}
      hideHeader={embedded}
    >
      <div className={`direct-center-v23 direct-center-v43 direct-center-v53 ${embedded ? 'direct-center-embedded-v55' : ''}`}>
        {!embedded && <aside className="direct-center-sidebar-v23 direct-center-sidebar-v43">
          <button
            className={tab === 'friends' ? 'active' : ''}
            onClick={() => selectTab('friends')}
          >
            <Icon name="members" size={16} />
            <span>Friends</span>
            <small>{center.conversations.length}</small>
          </button>
          <button
            className={tab === 'requests' ? 'active' : ''}
            onClick={() => selectTab('requests')}
          >
            <Icon name="message" size={16} />
            <span>Requests</span>
            {center.incomingRequests.length > 0 && (
              <small>{center.incomingRequests.length}</small>
            )}
          </button>
          <button
            className={tab === 'groups' ? 'active' : ''}
            onClick={() => selectTab('groups')}
          >
            <Icon name="chat" size={16} />
            <span>Group Chats</span>
            <small>{center.groups.length}</small>
          </button>
          <button
            className={tab === 'add' ? 'active' : ''}
            onClick={() => selectTab('add')}
          >
            <span className="person-plus-icon-v68" aria-hidden="true"><Icon name="members" size={14}/><i>+</i></span><span>Add Friend</span>
          </button>
        </aside>}

        <section className="direct-center-main-v23">
          {tab === 'support' ? (
            <div className="direct-thread-v23 direct-support-v77"><SupportMemberV77 /></div>
          ) : selected ? (
            <DirectThread
              conversation={selected}
              messages={messages}
              draft={draft}
              setDraft={value => selected && updateDirectDraftV72(value, 'dm', selected.id, setDraft)}
              onSend={send}
              busy={busy}
              currentUserId={profile?.id ?? ''}
              currentUser={{
                name: profile?.displayName ?? 'You',
                initials: profile?.initials ?? 'Y',
                avatarUrl: profile?.avatarUrl ?? null,
                accent: profile?.profileAccent,
                platformRole: profile?.platformRole ?? null,
              }}
              onAccept={() => void accept(selected)}
              onDecline={() => void decline(selected)}
              blocked={blockedUserIds.includes(selected.person.id)}
              pinnedMessages={pinnedMessages}
              pinsOpen={pinsOpen}
              onPinsOpen={() => setPinsOpen(value => !value)}
              onPinsClose={() => setPinsOpen(false)}
              onTogglePin={messageId => void toggleMessagePin('dm', selected.id, messageId)}
              onReport={() => void reportDirectPerson(selected.person.id, selected.person.displayName)}
              onProfile={() => openProfileV77(selected.person.id, selected.person)}
              onMore={(x, y) => threadMenu.open(selected.person.displayName, directHeaderActions(selected), x, y, `@${selected.person.username}`)}
              onOpenProfile={() => setDirectProfilePerson(selected.person)}
            />
          ) : selectedGroup ? (
            <div className={`direct-group-shell-v67 ${groupMembersOpen ? 'members-open' : ''}`}>
              <GroupThread
              group={selectedGroup}
              messages={groupMessages}
              draft={groupDraft}
              setDraft={value => selectedGroup && updateDirectDraftV72(value, 'group', selectedGroup.id, setGroupDraft)}
              onSend={sendGroup}
              busy={busy}
              currentUserId={profile?.id ?? ''}
              blockedUserIds={blockedUserIds}
            />

              {!groupMembersOpen && (
                <button
                  type="button"
                  className="direct-group-members-toggle-v67"
                  title="Show group members"
                  aria-label="Show group members"
                  onClick={() => setGroupMembersOpen(true)}
                >
                  <Icon name="members" size={15}/>
                </button>
              )}

              {groupMembersOpen && (
                <aside className="direct-group-members-v67" aria-label="Group DM members">
                  <header>
                    <div>
                      <strong>Members</strong>
                      <small>{selectedGroup.members.length} in this group</small>
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Close members"
                      onClick={() => {
                        setGroupMembersOpen(false)
                        setGroupInviteOpen(false)
                      }}
                    >
                      <Icon name="x" size={13}/>
                    </button>
                  </header>

                  <div className="direct-group-member-list-v67">
                    {selectedGroup.members.map(member => (
                      <div className="direct-group-member-row-v67" key={member.id}>
                        <Avatar
                          name={member.displayName}
                          initials={member.initials}
                          src={member.avatarUrl}
                          size={30}
                          accent={member.profileAccent}
                        />
                        <span>
                          <strong>{member.displayName}</strong>
                          <small>@{member.username}</small>
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="direct-group-invite-v67"
                    onClick={() => setGroupInviteOpen(value => !value)}
                  >
                    <Icon name="plus" size={14}/>
                    <span>Invite to Group DM</span>
                  </button>

                  {groupInviteOpen && (
                    <div className="direct-group-invite-picker-v67">
                      {center.conversations
                        .filter(conversation =>
                          !selectedGroup.members.some(member => member.id === conversation.person.id),
                        )
                        .map(conversation => (
                          <button
                            type="button"
                            className="direct-group-invite-person-v67"
                            key={conversation.person.id}
                            disabled={groupInviteBusy === conversation.person.id}
                            onClick={() => void inviteDirectGroupMember(
                              selectedGroup.id,
                              conversation.person.id,
                              conversation.person.displayName,
                            )}
                          >
                            <Avatar
                              name={conversation.person.displayName}
                              initials={conversation.person.initials}
                              src={conversation.person.avatarUrl}
                              size={28}
                              accent={conversation.person.profileAccent}
                            />
                            <span>
                              <strong>{conversation.person.displayName}</strong>
                              <small>@{conversation.person.username}</small>
                            </span>
                            <Icon name="plus" size={12}/>
                          </button>
                        ))}

                      {!center.conversations.some(conversation =>
                        !selectedGroup.members.some(member => member.id === conversation.person.id),
                      ) && (
                        <small>Everyone you can invite is already here.</small>
                      )}
                    </div>
                  )}
                </aside>
              )}
            </div>
          ) : tab === 'add' ? (
            <div className="direct-add-person-v23">
              <span className="direct-big-icon-v23">
                <Icon name="members" size={24} />
              </span>
              <span className="eyebrow">ADD FRIEND</span>
              <h2>Find a friend by username</h2>
              <p>
                Send a friend request first. Direct messages and group chats unlock
                after they accept.
              </p>
              <div className="direct-add-input-v23">
                <span>@</span>
                <input
                  autoFocus
                  value={username}
                  onChange={event => setUsername(event.target.value)}
                  onKeyDown={event => event.key === 'Enter' && void addFriend()}
                  placeholder="username"
                />
                <button
                  className="primary-button compact"
                  disabled={!username.trim() || busy}
                  onClick={() => void addFriend()}
                >
                  {busy ? 'Sending…' : 'Send request'}
                </button>
              </div>
            </div>
          ) : tab === 'groups' ? (
            creatingGroup ? (
              <CreateGroup
                friends={center.conversations}
                selectedIds={groupMemberIds}
                groupName={groupName}
                setGroupName={setGroupName}
                toggleFriend={toggleGroupFriend}
                onCancel={() => {
                  setCreatingGroup(false)
                  setGroupMemberIds([])
                  setGroupName('')
                }}
                onCreate={() => void makeGroup()}
                busy={busy}
              />
            ) : (
              <div className="direct-list-page-v23 direct-groups-page-v43">
                <header>
                  <div>
                    <span className="eyebrow">GROUP CHATS</span>
                    <h2>Talk with Your Friends</h2>
                    <p>Only accepted friends can be added. Groups support up to 10 people.</p>
                  </div>
                  <button
                    className="primary-button compact"
                    disabled={!center.conversations.length}
                    onClick={() => setCreatingGroup(true)}
                  >
                    <Icon name="plus" size={13} /> New group
                  </button>
                </header>
                {loading ? (
                  <div className="settings-loading">Loading groups…</div>
                ) : center.groups.length ? (
                  <div className="direct-group-list-v43">
                    {center.groups.map(group => (
                      <button
                        key={group.id}
                        className={`${group.pinnedAt ? 'thread-pinned-v59' : ''} ${group.mutedUntil && group.mutedUntil > Date.now() ? 'thread-muted-v59' : ''}`}
                        onClick={() => setSelectedGroupId(group.id)}
                        {...threadMenu.bind(group.name, threadActions('group', group.id, group), `${group.members.length} members`)}
                        onContextMenu={event => {
                          event.preventDefault()
                          event.stopPropagation()
                          threadMenu.open(group.name, threadActions('group', group.id, group), event.clientX, event.clientY, `${group.members.length} members`)
                        }}
                      >
                        <span className="direct-group-avatar-v43">
                          <Icon name="members" size={18} />
                        </span>
                        <span>
                          <strong>{group.name}</strong>
                          <small>
                            {group.members.length} members
                            {group.lastMessage ? ` · ${group.lastMessage}` : ''}
                          </small>
                        </span>
                        <Icon name="chevron" size={13} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="direct-empty-v23">
                    <Icon name="chat" size={23} />
                    <strong>No group chats yet</strong>
                    <span>Create one from people already in Your Friends.</span>
                  </div>
                )}
              </div>
            )
          ) : tab === 'requests' ? (
            <div className="direct-list-page-v23">
              <header>
                <div>
                  <span className="eyebrow">FRIEND REQUESTS</span>
                  <h2>Choose who joins Your Friends</h2>
                </div>
                <button className="secondary-button compact" onClick={() => void reload()}>
                  <Icon name="refresh" size={13} /> Refresh
                </button>
              </header>
              {loading ? (
                <div className="settings-loading">Loading requests…</div>
              ) : (
                <>
                  {center.incomingRequests.length > 0 ? (
                    <div className="direct-request-list-v23">
                      {center.incomingRequests.map(item => (
                        <article key={item.id}>
                          <Avatar
                            name={item.person.displayName}
                            initials={item.person.initials}
                            src={item.person.avatarUrl}
                            size={42}
                            accent={item.person.profileAccent}
                          />
                          <div>
                            <span className="direct-name-with-badge-v55"><strong>{item.person.displayName}</strong><PlatformVerifiedBadge role={item.person.platformRole} compact /></span>
                            <span>@{item.person.username}</span>
                            <small>Requested {timeAgo(item.updatedAt)}</small>
                          </div>
                          <div>
                            <button
                              className="primary-button compact"
                              disabled={busy}
                              onClick={() => void accept(item)}
                            >
                              Accept
                            </button>
                            <button
                              className="secondary-button compact"
                              disabled={busy}
                              onClick={() => void decline(item)}
                            >
                              Decline
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="direct-empty-v23">
                      <Icon name="check" size={23} />
                      <strong>No friend requests</strong>
                      <span>You are all caught up.</span>
                    </div>
                  )}
                  {center.outgoingRequests.length > 0 && (
                    <div className="direct-outgoing-v23">
                      <span className="eyebrow">SENT REQUESTS</span>
                      {center.outgoingRequests.map(item => (
                        <button key={item.id} onClick={() => setSelectedId(item.id)}>
                          <Avatar
                            name={item.person.displayName}
                            initials={item.person.initials}
                            src={item.person.avatarUrl}
                            size={30}
                            accent={item.person.profileAccent}
                          />
                          <span>
                            <span className="direct-name-with-badge-v55"><strong>{item.person.displayName}</strong><PlatformVerifiedBadge role={item.person.platformRole} compact /></span>
                            <small>@{item.person.username}</small>
                          </span>
                          <em>Pending</em>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="direct-list-page-v23">
              <header>
                <div>
                  <span className="eyebrow">YOUR FRIENDS</span>
                  <h2>Friends & direct messages</h2>
                </div>
                <div className="direct-friends-actions-v73">
                  <button className="secondary-button compact direct-support-launch-v73" onClick={() => selectTab('support')}>
                    <SupportGlyphV73 kind="robot" size={13} /> Support
                  </button>
                  <button className="primary-button compact" onClick={() => setTab('add')}>
                  <span className="person-plus-icon-v68" aria-hidden="true"><Icon name="members" size={14}/><i>+</i></span> Add Friend
                </button>
                </div>
              </header>
              {loading ? (
                <div className="settings-loading">Loading friends…</div>
              ) : (center.supportThread || friendListV68.length) ? (
                <div className="direct-people-grid-v23">
                  {center.supportThread && (
                    <button
                      className={`direct-support-dm-v59 ${center.supportThread.pinnedAt ? 'thread-pinned-v59' : ''} ${center.supportThread.mutedUntil && center.supportThread.mutedUntil > Date.now() ? 'thread-muted-v59' : ''}`}
                      onClick={() => selectTab('support')}
                      {...threadMenu.bind('Support Tickets', threadActions('support', 'support', center.supportThread), 'Spaces Support')}
                      onContextMenu={event => {
                        event.preventDefault()
                        event.stopPropagation()
                        threadMenu.open(
                          'Support Tickets',
                          threadActions(
                            'support',
                            'support',
                            center.supportThread ?? { pinnedAt: null, mutedUntil: null, closedAt: null },
                          ),
                          event.clientX,
                          event.clientY,
                          'Spaces Support',
                        )
                      }}
                    >
                      <span className="support-reply-avatar-v53"><Icon name="shield" size={18} /></span>
                      <span>
                        <strong>Support Tickets</strong>
                        <small>{center.supportThread.lastMessage || 'Official Spaces Support conversation'}</small>
                      </span>
                      {supportUnread > 0 ? <small>{supportUnread > 99 ? '99+' : supportUnread}</small> : <Icon name="chevron" size={13} />}
                    </button>
                  )}
                  {friendListV68.map(item => (
                    <button
                      key={item.id}
                      className={`friend-relationship-v68 ${item.closedAt ? 'direct-friend-closed-v68' : ''} ${item.pinnedAt ? 'thread-pinned-v59' : ''} ${item.mutedUntil && item.mutedUntil > Date.now() ? 'thread-muted-v59' : ''}`}
                      onClick={() => void openFriendConversationV68(item)}
                      {...threadMenu.bind(item.person.displayName, threadActions('dm', item.id, item), `@${item.person.username}`)}
                      onContextMenu={event => {
                        event.preventDefault()
                        event.stopPropagation()
                        threadMenu.open(item.person.displayName, threadActions('dm', item.id, item), event.clientX, event.clientY, `@${item.person.username}`)
                      }}
                    >
                      <Avatar
                        name={item.person.displayName}
                        initials={item.person.initials}
                        src={item.person.avatarUrl}
                        size={42}
                        accent={item.person.profileAccent}
                      />
                      <span>
                        <span className="direct-name-with-badge-v55"><strong>{item.person.displayName}</strong><PlatformVerifiedBadge role={item.person.platformRole} compact /></span>
                        <small>
                          @{item.person.username}
                          {item.lastMessage ? ` · ${item.lastMessage}` : ''}
                        </small>
                      </span>
                      <Icon name="chevron" size={13} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="direct-empty-v23 direct-empty-v76">
                  <Icon name="members" size={23} />
                  <strong>Start a conversation</strong>
                  <span>Messages, group chats, and Support all live here.</span>
                  <div className="direct-empty-actions-v76">
                    <button className="secondary-button compact" onClick={() => setTab('add')}><Icon name="message" size={12}/> New Message</button>
                    <button className="secondary-button compact" onClick={() => setTab('add')}><Icon name="plus" size={12}/> Add Friend</button>
                    <button className="secondary-button compact" onClick={() => { setTab('groups'); setCreatingGroup(true) }} disabled={!center.conversations.length}><Icon name="members" size={12}/> New Group DM</button>
                    <button className="secondary-button compact" onClick={() => selectTab('support')}><Icon name="shield" size={12}/> Open Support Ticket</button>
                  </div>
                </div>
              )}
            </div>
          )}
        <DirectTypingIndicatorV72 users={typingUsersV72}/>
        </section>
      </div>
      {directProfilePerson && (
        <DirectPersonProfileCard
          person={directProfilePerson}
          onClose={() => setDirectProfilePerson(null)}
          onMore={(x, y) => {
            const conversation = center.conversations.find(item => item.person.id === directProfilePerson.id)
            if (!conversation) return
            threadMenu.open(
              directProfilePerson.displayName,
              directHeaderActions(conversation),
              x,
              y,
              `@${directProfilePerson.username}`,
            )
          }}
        />
      )}
      {directSearchOpenV71 && <ContentSearchPanel title={directSearchTitleV71} subtitle="Search this conversation" items={directSearchItemsV71} onClose={() => setDirectSearchOpenV71(false)} />}
      {profilePersonV76 && (
        <div className="direct-profile-drawer-v76" role="dialog" aria-label={`Profile for ${profilePersonV76.displayName}`}>
          <button className="direct-profile-backdrop-v76" aria-label="Close profile" onClick={() => setProfilePersonV76(null)} />
          <aside>
            <button className="direct-profile-close-v76" aria-label="Close profile" onClick={() => setProfilePersonV76(null)}><Icon name="x" size={14}/></button>
            <Avatar name={profilePersonV76.displayName} initials={profilePersonV76.initials} src={profilePersonV76.avatarUrl} size={74} accent={profilePersonV76.profileAccent} />
            <h2>{profilePersonV76.displayName}</h2>
            <span>@{profilePersonV76.username}</span>
            {profilePersonV76.publicUserId && <code>#{profilePersonV76.publicUserId}</code>}
            {profilePersonV76.platformRole && <b>{platformRoleLabel(profilePersonV76.platformRole)}</b>}
            <div className="direct-profile-actions-v76">
              <button className="secondary-button compact" onClick={() => setProfilePersonV76(null)}><Icon name="message" size={12}/> Back to DM</button>
            </div>
          </aside>
        </div>
      )}
      <ContextMenu menu={threadMenu.menu} onClose={threadMenu.close} />
    </Modal>
  )
}

function CreateGroup({
  friends,
  selectedIds,
  groupName,
  setGroupName,
  toggleFriend,
  onCancel,
  onCreate,
  busy,
}: {
  friends: WorkspaceDirectConversation[]
  selectedIds: string[]
  groupName: string
  setGroupName: (value: string) => void
  toggleFriend: (id: string) => void
  onCancel: () => void
  onCreate: () => void
  busy: boolean
}) {
  return (
    <div className="direct-create-group-v43">
      <header>
        <div>
          <span className="eyebrow">NEW GROUP CHAT</span>
          <h2>Create a private group</h2>
          <p>Choose up to 9 friends. You are included automatically.</p>
        </div>
        <button className="secondary-button compact" onClick={onCancel}>
          Cancel
        </button>
      </header>
      <label className="field-label">
        Group name
        <input
          className="text-input"
          autoFocus
          value={groupName}
          maxLength={48}
          onChange={event => setGroupName(event.target.value)}
          placeholder="Late night crew"
        />
      </label>
      <div className="direct-group-friend-picker-v43">
        {friends.map(friend => {
          const checked = selectedIds.includes(friend.person.id)
          return (
            <button
              type="button"
              key={friend.id}
              className={checked ? 'active' : ''}
              onClick={() => toggleFriend(friend.person.id)}
              disabled={!checked && selectedIds.length >= 9}
            >
              <Avatar
                name={friend.person.displayName}
                initials={friend.person.initials}
                src={friend.person.avatarUrl}
                size={34}
                accent={friend.person.profileAccent}
              />
              <span>
                <strong>{friend.person.displayName}</strong>
                <small>@{friend.person.username}</small>
              </span>
              <i>{checked ? <Icon name="check" size={12} /> : <Icon name="plus" size={12} />}</i>
            </button>
          )
        })}
      </div>
      <div className="direct-group-create-footer-v43">
        <span>{selectedIds.length + 1}/10 members</span>
        <button
          className="primary-button"
          disabled={busy || !groupName.trim() || selectedIds.length < 1}
          onClick={onCreate}
        >
          {busy ? 'Creating…' : 'Create group chat'}
        </button>
      </div>
    </div>
  )
}

function GroupThread({
  group,
  messages,
  draft,
  setDraft,
  onSend,
  busy,
  currentUserId,
  blockedUserIds,
}: {
  group: WorkspaceDirectGroup
  messages: WorkspaceDirectGroupMessage[]
  draft: string
  setDraft: (value: string) => void
  onSend: () => Promise<void>
  busy: boolean
  currentUserId: string
  blockedUserIds: string[]
}) {
  return (
    <div className="direct-thread-v23 direct-group-thread-v43">
      <header>
        <span className="direct-group-avatar-v43">
          <Icon name="members" size={18} />
        </span>
        <div>
          <strong>{group.name}</strong>
          <span>{group.members.map(member => member.displayName).join(', ')}</span>
        </div>
      </header>
      <div className="direct-message-feed-v23 direct-message-feed-v28">
        {messages.length ? (
          messages.map(message => {
            const own = message.senderUserId === currentUserId
            const sender = group.members.find(member => member.id === message.senderUserId)
            return (
              <div
                key={message.id}
                className={own ? 'own direct-message-row-v28' : 'direct-message-row-v28'}
              >
                <Avatar
                  name={message.senderName}
                  initials={sender?.initials}
                  src={sender?.avatarUrl}
                  size={34}
                  accent={sender?.profileAccent}
                />
                <div className="direct-message-copy-v28">
                  <div className="direct-message-author-v55"><strong>{message.senderName}</strong><PlatformVerifiedBadge role={sender?.platformRole ?? null} compact /></div>
                  <p>{blockedUserIds.includes(message.senderUserId) ? <BlockedMessageText body={message.body} /> : message.body}</p>
                  <time>{timeAgo(message.createdAt)}</time>
                </div>
              </div>
            )
          })
        ) : (
          <div className="direct-empty-v23">
            <Icon name="chat" size={22} />
            <strong>Start the group conversation</strong>
            <span>Messages are visible only to members of this group.</span>
          </div>
        )}
      </div>
      <div className="direct-compose-v23">
        <textarea
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void onSend()
            }
          }}
          placeholder={`Message ${group.name}`}
          maxLength={2000}
        />
        <button
          className="primary-button"
          disabled={busy || !draft.trim()}
          onClick={() => void onSend()}
        >
          <Icon name="send" size={14} /> Send
        </button>
      </div>
    </div>
  )
}

function DirectPersonProfileCard({
  person,
  onClose,
  onMore,
}: {
  person: WorkspaceDirectConversation['person']
  onClose: () => void
  onMore: (x: number, y: number) => void
}) {
  return (
    <>
      <button
        className="direct-person-card-scrim-v66"
        aria-label="Close profile"
        onClick={onClose}
      />
      <aside
        className="direct-person-card-v66"
        aria-label={`${person.displayName} profile`}
      >
        <div
          className="direct-profile-banner-v66"
          style={{
            background: `radial-gradient(circle at 20% 20%, ${person.profileAccent ?? '#8b6ca8'}55, transparent 60%), rgba(255,255,255,.025)`,
          }}
        />
        <button
          className="icon-button direct-profile-close-v66"
          onClick={onClose}
          aria-label="Close"
        >
          <Icon name="x" size={13}/>
        </button>

        <div className="direct-profile-body-v66">
          <div className="direct-profile-avatar-v66">
            <Avatar
              name={person.displayName}
              initials={person.initials}
              src={person.avatarUrl}
              size={64}
              accent={person.profileAccent}
            />
          </div>

          <div className="direct-profile-copy-v66">
            <div className="direct-name-with-badge-v55">
              <strong>{person.displayName}</strong>
              <PlatformVerifiedBadge role={person.platformRole} compact />
            </div>
            <small>@{person.username}</small>
          </div>

          <div className="direct-profile-actions-v66">
            <button type="button" onClick={onClose}>
              <Icon name="message" size={14}/>
              <span>Message</span>
            </button>

            <button
              type="button"
              title="More actions"
              aria-label="More actions"
              onClick={event => {
                const rect = event.currentTarget.getBoundingClientRect()
                onMore(rect.right - 8, rect.bottom + 6)
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>•••</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

function DirectThread({
  conversation,
  messages,
  draft,
  setDraft,
  onSend,
  busy,
  currentUserId,
  currentUser,
  onAccept,
  onDecline,
  blocked,
  pinnedMessages,
  pinsOpen,
  onPinsOpen,
  onPinsClose,
  onTogglePin,
  onReport,
  onProfile,
  onMore,
  onOpenProfile,
}: {
  conversation: WorkspaceDirectConversation
  messages: WorkspaceDirectMessage[]
  draft: string
  setDraft: (value: string) => void
  onSend: () => Promise<void>
  busy: boolean
  currentUserId: string
  currentUser: {
    name: string
    initials: string
    avatarUrl: string | null
    accent?: string
    platformRole: WorkspacePlatformRole
  }
  onAccept: () => void
  onDecline: () => void
  blocked: boolean
  pinnedMessages: PinnedDirectMessage[]
  pinsOpen: boolean
  onPinsOpen: () => void
  onPinsClose: () => void
  onTogglePin: (messageId: string) => void
  onReport: () => void
  onProfile: () => void
  onMore: (x: number, y: number) => void
  onOpenProfile: () => void
}) {
  const incoming = conversation.status === 'pending' && !conversation.requestedByMe
  const outgoing = conversation.status === 'pending' && conversation.requestedByMe

  return (
    <div className="direct-thread-v23 direct-thread-v63">
      <header>
        <button className="direct-profile-avatar-button-v77" title="View profile" onClick={onProfile} onContextMenu={event => { event.preventDefault(); onMore(event.clientX, event.clientY) }}>
          <Avatar name={conversation.person.displayName} initials={conversation.person.initials} src={conversation.person.avatarUrl} size={38} accent={conversation.person.profileAccent} />
        </button>
        <div>
          <button
          type="button"
          className="direct-profile-name-v66"
          onClick={onOpenProfile}
          title="View profile"
        >
          <strong>{conversation.person.displayName}</strong>
        </button>
          <span>
            @{conversation.person.username}
            {conversation.person.publicUserId
              ? ` · #${conversation.person.publicUserId}`
              : ''}
          </span>
        </div>
        <PlatformVerifiedBadge role={conversation.person.platformRole} />
        <div className="direct-thread-tools-v63">
          <button className={`direct-thread-tool-v63 ${pinsOpen ? 'active' : ''}`} title="Pinned messages" onClick={onPinsOpen}><Icon name="pin" size={15}/>{pinnedMessages.length > 0 && <small>{pinnedMessages.length > 9 ? '9+' : pinnedMessages.length}</small>}</button>
          <button className="direct-thread-tool-v63" title="Report" onClick={onReport}><Icon name="shield" size={15}/></button>
          <button className="direct-thread-tool-v63" title="More" onClick={event => onMore(event.clientX, event.clientY)}><Icon name="more" size={16}/></button>
        </div>
        {pinsOpen && <aside className="direct-pins-popover-v63">
          <header><div><span className="eyebrow">PINNED</span><strong>Pinned messages</strong></div><button className="icon-button" onClick={onPinsClose}><Icon name="x" size={13}/></button></header>
          <div className="direct-pins-list-v63">
            {pinnedMessages.length ? pinnedMessages.map(message => <article className="direct-pin-item-v63" key={message.id}><span className="context-action-icon"><Icon name="pin" size={14}/></span><div><strong>{message.senderName}</strong><p>{message.body}</p></div><button className="icon-button" title="Unpin" onClick={() => onTogglePin(message.id)}><Icon name="x" size={12}/></button></article>) : <div className="direct-empty-v23"><Icon name="pin" size={18}/><strong>No pinned messages</strong><span>Pin an important DM and it will show here.</span></div>}
          </div>
        </aside>}
      </header>
      {incoming ? (
        <div className="direct-request-hero-v23">
          <Icon name="members" size={24} />
          <h3>{conversation.person.displayName} sent a friend request</h3>
          <p>Accept before direct messages and group invitations unlock.</p>
          <div>
            <button className="primary-button" disabled={busy} onClick={onAccept}>
              Accept request
            </button>
            <button className="secondary-button" disabled={busy} onClick={onDecline}>
              Decline
            </button>
          </div>
        </div>
      ) : outgoing ? (
        <div className="direct-request-hero-v23">
          <Icon name="activity" size={24} />
          <h3>Friend request sent</h3>
          <p>You can message {conversation.person.displayName} after they accept.</p>
        </div>
      ) : (
        <>
          <div className="direct-message-feed-v23 direct-message-feed-v28">
            {messages.length ? (
              messages.map(message => {
                const own = message.senderUserId === currentUserId
                return (
                  <div
                    key={message.id}
                    className={own ? 'own direct-message-row-v28' : 'direct-message-row-v28'}
                    onContextMenu={event => { if (!own) { event.preventDefault(); onMore(event.clientX, event.clientY) } }}
                  >
                    <Avatar
                      name={own ? currentUser.name : conversation.person.displayName}
                      initials={own ? currentUser.initials : conversation.person.initials}
                      src={own ? currentUser.avatarUrl : conversation.person.avatarUrl}
                      size={34}
                      accent={own ? currentUser.accent : conversation.person.profileAccent}
                    />
                    <div className="direct-message-copy-v28">
                      <div className="direct-message-author-v55"><strong>{message.senderName}</strong><PlatformVerifiedBadge role={own ? currentUser.platformRole : conversation.person.platformRole} compact /></div>
                      <p>{blocked && !own ? <BlockedMessageText body={message.body} /> : message.body}</p>
                      <time>{timeAgo(message.createdAt)}</time>
                    </div>
                    <button className={`dm-message-pin-v63 ${pinnedMessages.some(item => item.id === message.id) ? 'pinned' : ''}`} title={pinnedMessages.some(item => item.id === message.id) ? 'Unpin message' : 'Pin message'} onClick={() => onTogglePin(message.id)}><Icon name="pin" size={13}/></button>
                  </div>
                )
              })
            ) : (
              <div className="direct-empty-v23">
                <Icon name="message" size={22} />
                <strong>Start the conversation</strong>
                <span>Your direct messages stay between you and this friend.</span>
              </div>
            )}
          </div>
          {blocked && <div className="blocked-thread-banner-v62"><Icon name="lock" size={13}/>You blocked this person. Unblock them from their profile before sending another DM.</div>}
          <div className={`direct-compose-v23 ${blocked ? 'is-blocked-v62' : ''}`}>
            <textarea
              value={draft}
              disabled={blocked}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void onSend()
                }
              }}
              placeholder={blocked ? 'Unblock this person to send a DM' : `Message ${conversation.person.displayName}`}
              maxLength={2000}
            />
            <button
              className="primary-button"
              disabled={blocked || busy || !draft.trim()}
              onClick={() => void onSend()}
            >
              <Icon name="send" size={14} /> Send
            </button>
          </div>
        </>
      )}
    </div>
  )
}


function BlockedMessageText({ body }: { body: string }) {
  const [revealed, setRevealed] = useState(false)
  if (revealed) return <>{body}</>
  return (
    <button className="blocked-message-v62" onClick={() => setRevealed(true)}>
      <Icon name="lock" size={13}/>
      <span>Message hidden from a blocked user</span>
      <strong>Show</strong>
    </button>
  )
}

function PlatformVerifiedBadge({
  role,
  compact = false,
}: {
  role: WorkspacePlatformRole | undefined
  compact?: boolean
}) {
  if (!role) return null
  return (
    <span
      className={`platform-verified-v55 platform-${role} ${compact ? 'compact' : ''}`}
      title={`${platformRoleLabel(role)} · verified by Spaces`}
    >
      <Icon name="check" size={compact ? 9 : 10} />
      VERIFIED
    </span>
  )
}


function DirectTypingIndicatorV72({ users }: { users: WorkspaceTypingUser[] }) {
  if (!users.length) return null
  const text = users.length === 1
    ? `${users[0].displayName} is typing...`
    : users.length === 2
      ? `${users[0].displayName} and ${users[1].displayName} are typing...`
      : 'Multiple People are Talking'
  return <div className="typing-indicator-v72 direct-typing-v72"><span aria-hidden="true"><i/><i/><i/></span><span>{text}</span></div>
}
