import { useEffect, useMemo, useState } from 'react'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { useSpaces } from '../state/SpacesContext'
import { usePreferences } from '../state/PreferencesContext'
import { playSpacesSupportSound } from '../utils/notification-sound'
import type {
  WorkspaceDirectCenter,
  WorkspaceDirectConversation,
  WorkspaceDirectGroup,
  WorkspaceDirectGroupMessage,
  WorkspaceDirectMessage,
} from '../types/spaces'
import { timeAgo } from '../utils/format'

type DirectTab = 'friends' | 'support' | 'requests' | 'groups' | 'add'

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

const emptyCenter: WorkspaceDirectCenter = {
  conversations: [],
  incomingRequests: [],
  outgoingRequests: [],
  groups: [],
}

export function DirectMessagesCenter({
  onClose,
  initialConversationId = null,
  initialGroupId = null,
}: {
  onClose: () => void
  initialConversationId?: string | null
  initialGroupId?: string | null
}) {
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
  } = useSpaces()
  const { preferences } = usePreferences()
  const [center, setCenter] = useState<WorkspaceDirectCenter>(emptyCenter)
  const [tab, setTab] = useState<DirectTab>('friends')
  const [selectedId, setSelectedId] = useState<string | null>(initialConversationId)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId)
  const [messages, setMessages] = useState<WorkspaceDirectMessage[]>([])
  const [groupMessages, setGroupMessages] = useState<WorkspaceDirectGroupMessage[]>([])
  const [supportMessages, setSupportMessages] = useState<SupportInboxMessage[]>([])
  const [supportDraft, setSupportDraft] = useState('')
  const [supportLoading, setSupportLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [draft, setDraft] = useState('')
  const [groupDraft, setGroupDraft] = useState('')
  const [groupName, setGroupName] = useState('')
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([])
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

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

  const supportUnread = supportMessages.filter(
    item => item.direction === 'incoming' && !item.readAt,
  ).length

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
      const normalized = { ...emptyCenter, ...next, groups: next.groups ?? [] }
      setCenter(normalized)
      if (
        selectedId &&
        ![
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

  async function sendSupportReply() {
    const body = supportDraft.trim()
    const lastIncoming = [...supportMessages]
      .reverse()
      .find(item => item.direction === 'incoming')
    if (!body || !lastIncoming || busy) return
    setBusy(true)
    try {
      const sent = await supportRequest<SupportInboxMessage>('/v1/support/reply', {
        method: 'POST',
        body: JSON.stringify({
          body,
          replyToMessageId: lastIncoming.id,
        }),
      })
      setSupportMessages(current => [...current, sent])
      setSupportDraft('')
      if (preferences.desktopSounds && preferences.supportOutgoingSounds) {
        playSpacesSupportSound('outgoing')
      }
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : 'Could not send Support reply.',
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
    >
      <div className="direct-center-v23 direct-center-v43 direct-center-v53">
        <aside className="direct-center-sidebar-v23 direct-center-sidebar-v43">
          <button
            className={tab === 'friends' ? 'active' : ''}
            onClick={() => selectTab('friends')}
          >
            <Icon name="members" size={16} />
            <span>Friends</span>
            <small>{center.conversations.length}</small>
          </button>
          <button
            className={`direct-support-tab-v53 ${tab === 'support' ? 'active' : ''}`}
            onClick={() => selectTab('support')}
          >
            <Icon name="shield" size={16} />
            <span>Support Replys</span>
            {supportUnread > 0 && <small>{supportUnread > 99 ? '99+' : supportUnread}</small>}
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
            <Icon name="plus" size={16} />
            <span>Add Friend</span>
          </button>
        </aside>

        <section className="direct-center-main-v23">
          {tab === 'support' ? (
            <SupportReplyThread
              messages={supportMessages}
              draft={supportDraft}
              setDraft={setSupportDraft}
              onSend={sendSupportReply}
              busy={busy}
              loading={supportLoading}
              currentUserId={profile?.id ?? ''}
            />
          ) : selected ? (
            <DirectThread
              conversation={selected}
              messages={messages}
              draft={draft}
              setDraft={setDraft}
              onSend={send}
              busy={busy}
              currentUserId={profile?.id ?? ''}
              currentUser={{
                name: profile?.displayName ?? 'You',
                initials: profile?.initials ?? 'Y',
                avatarUrl: profile?.avatarUrl ?? null,
                accent: profile?.profileAccent,
              }}
              onAccept={() => void accept(selected)}
              onDecline={() => void decline(selected)}
            />
          ) : selectedGroup ? (
            <GroupThread
              group={selectedGroup}
              messages={groupMessages}
              draft={groupDraft}
              setDraft={setGroupDraft}
              onSend={sendGroup}
              busy={busy}
              currentUserId={profile?.id ?? ''}
            />
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
                      <button key={group.id} onClick={() => setSelectedGroupId(group.id)}>
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
                            <strong>{item.person.displayName}</strong>
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
                            <strong>{item.person.displayName}</strong>
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
                <button className="primary-button compact" onClick={() => setTab('add')}>
                  <Icon name="plus" size={13} /> Add Friend
                </button>
              </header>
              {loading ? (
                <div className="settings-loading">Loading friends…</div>
              ) : center.conversations.length ? (
                <div className="direct-people-grid-v23">
                  {center.conversations.map(item => (
                    <button key={item.id} onClick={() => setSelectedId(item.id)}>
                      <Avatar
                        name={item.person.displayName}
                        initials={item.person.initials}
                        src={item.person.avatarUrl}
                        size={42}
                        accent={item.person.profileAccent}
                      />
                      <span>
                        <strong>{item.person.displayName}</strong>
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
                <div className="direct-empty-v23">
                  <Icon name="members" size={23} />
                  <strong>Your Friends is empty</strong>
                  <span>Add someone by username to start messaging.</span>
                  <button className="primary-button compact" onClick={() => setTab('add')}>
                    Add a friend
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </Modal>
  )
}

function SupportReplyThread({
  messages,
  draft,
  setDraft,
  onSend,
  busy,
  loading,
  currentUserId,
}: {
  messages: SupportInboxMessage[]
  draft: string
  setDraft: (value: string) => void
  onSend: () => Promise<void>
  busy: boolean
  loading: boolean
  currentUserId: string
}) {
  const canReply = messages.some(item => item.direction === 'incoming')
  return (
    <div className="direct-thread-v23 support-reply-thread-v53">
      <header>
        <span className="support-reply-avatar-v53">
          <Icon name="shield" size={18} />
        </span>
        <div>
          <strong>Spaces Support</strong>
          <span>Support Replys · official platform conversation</span>
        </div>
        <em>VERIFIED</em>
      </header>
      <div className="direct-message-feed-v23 direct-message-feed-v28 support-reply-feed-v53">
        {loading && !messages.length ? (
          <div className="settings-loading">Loading Support conversation…</div>
        ) : messages.length ? (
          messages.map(message => {
            const own = message.senderUserId === currentUserId || message.direction === 'outgoing'
            return (
              <div
                key={message.id}
                className={own ? 'own direct-message-row-v28 support-message-v53' : 'direct-message-row-v28 support-message-v53'}
              >
                <span className={`support-message-mark-v53 ${own ? 'own' : ''}`}>
                  <Icon name={own ? 'reply' : 'shield'} size={14} />
                </span>
                <div className="direct-message-copy-v28">
                  <strong>{own ? 'You' : message.senderName || 'Spaces Support'}</strong>
                  <small>{message.messageKind === 'reply' ? 'Support Replys' : message.subject}</small>
                  <p>{message.body}</p>
                  <time>{timeAgo(message.createdAt)}</time>
                </div>
              </div>
            )
          })
        ) : (
          <div className="direct-empty-v23">
            <Icon name="shield" size={24} />
            <strong>No Support conversation yet</strong>
            <span>
              Official Spaces Support messages will appear here even if normal DMs are disabled.
            </span>
          </div>
        )}
      </div>
      <div className="direct-compose-v23 support-reply-compose-v53">
        <textarea
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && canReply) {
              event.preventDefault()
              void onSend()
            }
          }}
          placeholder={
            canReply
              ? 'Reply to Spaces Support…'
              : 'A Support message is required before you can reply.'
          }
          maxLength={2400}
          disabled={!canReply}
        />
        <button
          className="primary-button"
          disabled={busy || !draft.trim() || !canReply}
          onClick={() => void onSend()}
        >
          <Icon name="send" size={14} /> Reply
        </button>
      </div>
    </div>
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
}: {
  group: WorkspaceDirectGroup
  messages: WorkspaceDirectGroupMessage[]
  draft: string
  setDraft: (value: string) => void
  onSend: () => Promise<void>
  busy: boolean
  currentUserId: string
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
                  <strong>{message.senderName}</strong>
                  <p>{message.body}</p>
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
  }
  onAccept: () => void
  onDecline: () => void
}) {
  const incoming = conversation.status === 'pending' && !conversation.requestedByMe
  const outgoing = conversation.status === 'pending' && conversation.requestedByMe

  return (
    <div className="direct-thread-v23">
      <header>
        <Avatar
          name={conversation.person.displayName}
          initials={conversation.person.initials}
          src={conversation.person.avatarUrl}
          size={38}
          accent={conversation.person.profileAccent}
        />
        <div>
          <strong>{conversation.person.displayName}</strong>
          <span>
            @{conversation.person.username}
            {conversation.person.publicUserId
              ? ` · #${conversation.person.publicUserId}`
              : ''}
          </span>
        </div>
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
                  >
                    <Avatar
                      name={own ? currentUser.name : conversation.person.displayName}
                      initials={own ? currentUser.initials : conversation.person.initials}
                      src={own ? currentUser.avatarUrl : conversation.person.avatarUrl}
                      size={34}
                      accent={own ? currentUser.accent : conversation.person.profileAccent}
                    />
                    <div className="direct-message-copy-v28">
                      <strong>{message.senderName}</strong>
                      <p>{message.body}</p>
                      <time>{timeAgo(message.createdAt)}</time>
                    </div>
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
              placeholder={`Message ${conversation.person.displayName}`}
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
        </>
      )}
    </div>
  )
}
