import { useEffect, useMemo, useState } from 'react'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { useSpaces } from '../state/SpacesContext'
import type { WorkspaceDirectCenter, WorkspaceDirectConversation, WorkspaceDirectMessage } from '../types/spaces'
import { timeAgo } from '../utils/format'

export function DirectMessagesCenter({ onClose, initialConversationId = null }: { onClose: () => void; initialConversationId?: string | null }) {
  const {
    profile, getDirectCenter, requestDirectConversation, acceptDirectConversation, declineDirectConversation,
    listDirectMessages, sendDirectMessage, pushToast,
  } = useSpaces()
  const [center, setCenter] = useState<WorkspaceDirectCenter>({ conversations: [], incomingRequests: [], outgoingRequests: [] })
  const [tab, setTab] = useState<'people' | 'requests' | 'add'>('people')
  const [selectedId, setSelectedId] = useState<string | null>(initialConversationId)
  const [messages, setMessages] = useState<WorkspaceDirectMessage[]>([])
  const [username, setUsername] = useState('')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const selected = useMemo(() => {
    const all = [...center.conversations, ...center.incomingRequests, ...center.outgoingRequests]
    return all.find(item => item.id === selectedId) ?? null
  }, [center, selectedId])

  async function reload() {
    setLoading(true)
    try {
      const next = await getDirectCenter()
      setCenter(next)
      if (selectedId && ![...next.conversations, ...next.incomingRequests, ...next.outgoingRequests].some(item => item.id === selectedId)) setSelectedId(null)
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not load messages.', 'danger')
    } finally { setLoading(false) }
  }

  useEffect(() => { void reload() }, [])
  useEffect(() => {
    const switchTab = (event: Event) => {
      const next = (event as CustomEvent<'people' | 'requests' | 'add'>).detail
      if (next === 'people' || next === 'requests' || next === 'add') { setTab(next); setSelectedId(null) }
    }
    window.addEventListener('spaces-direct-tab', switchTab)
    return () => window.removeEventListener('spaces-direct-tab', switchTab)
  }, [])

  useEffect(() => {
    if (!selected || selected.status !== 'accepted') { setMessages([]); return }
    let cancelled = false
    void listDirectMessages(selected.id).then(items => { if (!cancelled) setMessages(items) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [listDirectMessages, selected?.id, selected?.status])

  async function addPerson() {
    const clean = username.trim().replace(/^@/, '')
    if (!clean || busy) return
    setBusy(true)
    try {
      const conversation = await requestDirectConversation({ username: clean })
      setUsername('')
      await reload()
      setSelectedId(conversation.id)
      setTab(conversation.status === 'accepted' ? 'people' : 'requests')
      pushToast(conversation.status === 'accepted' ? `Opened ${conversation.person.displayName}.` : `Request sent to @${conversation.person.username}.`, 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not add that person.', 'danger')
    } finally { setBusy(false) }
  }

  async function accept(conversation: WorkspaceDirectConversation) {
    setBusy(true)
    try {
      const next = await acceptDirectConversation(conversation.id)
      await reload()
      setSelectedId(next.id)
      setTab('people')
      pushToast(`${next.person.displayName} added.`, 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not accept request.', 'danger')
    } finally { setBusy(false) }
  }

  async function decline(conversation: WorkspaceDirectConversation) {
    setBusy(true)
    try {
      await declineDirectConversation(conversation.id)
      if (selectedId === conversation.id) setSelectedId(null)
      await reload()
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not decline request.', 'danger')
    } finally { setBusy(false) }
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
      pushToast(error instanceof Error ? error.message : 'Could not send message.', 'danger')
    } finally { setBusy(false) }
  }

  return (
    <Modal title="People & Messages" subtitle="Connections, message requests, and direct conversations." onClose={onClose} wide>
      <div className="direct-center-v23">
        <aside className="direct-center-sidebar-v23">
          <button className={tab === 'people' ? 'active' : ''} onClick={() => { setTab('people'); setSelectedId(null) }}><Icon name="members" size={16}/><span>People</span><small>{center.conversations.length}</small></button>
          <button className={tab === 'requests' ? 'active' : ''} onClick={() => { setTab('requests'); setSelectedId(null) }}><Icon name="message" size={16}/><span>Message Requests</span>{center.incomingRequests.length > 0 && <small>{center.incomingRequests.length}</small>}</button>
          <button className={tab === 'add' ? 'active' : ''} onClick={() => { setTab('add'); setSelectedId(null) }}><Icon name="plus" size={16}/><span>Add a Person</span></button>
        </aside>

        <section className="direct-center-main-v23">
          {selected ? <DirectThread conversation={selected} messages={messages} draft={draft} setDraft={setDraft} onSend={send} busy={busy} currentUserId={profile?.id ?? ''} currentUser={{ name: profile?.displayName ?? 'You', initials: profile?.initials ?? 'Y', avatarUrl: profile?.avatarUrl ?? null, accent: profile?.profileAccent }} onAccept={() => void accept(selected)} onDecline={() => void decline(selected)} /> : tab === 'add' ? (
            <div className="direct-add-person-v23">
              <span className="direct-big-icon-v23"><Icon name="members" size={24}/></span>
              <span className="eyebrow">ADD A PERSON</span>
              <h2>Find someone by username</h2>
              <p>Enter their Spaces username. They will receive a request before direct messaging opens.</p>
              <div className="direct-add-input-v23"><span>@</span><input autoFocus value={username} onChange={event => setUsername(event.target.value)} onKeyDown={event => event.key === 'Enter' && void addPerson()} placeholder="username"/><button className="primary-button" disabled={!username.trim() || busy} onClick={() => void addPerson()}>{busy ? 'Sending…' : 'Send request'}</button></div>
            </div>
          ) : tab === 'requests' ? (
            <div className="direct-list-page-v23">
              <header><div><span className="eyebrow">MESSAGE REQUESTS</span><h2>Choose who can reach you</h2><p>Requests stay here until you accept them.</p></div><button className="secondary-button compact" onClick={() => void reload()}><Icon name="refresh" size={13}/>Refresh</button></header>
              {loading ? <div className="settings-loading">Loading requests…</div> : <>
                {center.incomingRequests.length > 0 ? <div className="direct-request-list-v23">{center.incomingRequests.map(item => <article key={item.id}><Avatar name={item.person.displayName} initials={item.person.initials} src={item.person.avatarUrl} size={42} accent={item.person.profileAccent}/><div><strong>{item.person.displayName}</strong><span>@{item.person.username}{item.person.publicUserId ? ` · #${item.person.publicUserId}` : ''}</span><small>Requested {timeAgo(item.updatedAt)}</small></div><div><button className="primary-button compact" disabled={busy} onClick={() => void accept(item)}>Accept</button><button className="secondary-button compact" disabled={busy} onClick={() => void decline(item)}>Decline</button></div></article>)}</div> : <div className="direct-empty-v23"><Icon name="check" size={23}/><strong>No message requests</strong><span>You are all caught up.</span></div>}
                {center.outgoingRequests.length > 0 && <div className="direct-outgoing-v23"><span className="eyebrow">SENT REQUESTS</span>{center.outgoingRequests.map(item => <button key={item.id} onClick={() => setSelectedId(item.id)}><Avatar name={item.person.displayName} initials={item.person.initials} src={item.person.avatarUrl} size={30} accent={item.person.profileAccent}/><span><strong>{item.person.displayName}</strong><small>@{item.person.username}</small></span><em>Pending</em></button>)}</div>}
              </>}
            </div>
          ) : (
            <div className="direct-list-page-v23">
              <header><div><span className="eyebrow">YOUR PEOPLE</span><h2>Direct conversations</h2><p>Accepted connections appear here.</p></div><button className="primary-button compact" onClick={() => setTab('add')}><Icon name="plus" size={13}/>Add a Person</button></header>
              {loading ? <div className="settings-loading">Loading people…</div> : center.conversations.length ? <div className="direct-people-grid-v23">{center.conversations.map(item => <button key={item.id} onClick={() => setSelectedId(item.id)}><Avatar name={item.person.displayName} initials={item.person.initials} src={item.person.avatarUrl} size={42} accent={item.person.profileAccent}/><span><strong>{item.person.displayName}</strong><small>@{item.person.username}{item.lastMessage ? ` · ${item.lastMessage}` : ''}</small></span><Icon name="chevron" size={13}/></button>)}</div> : <div className="direct-empty-v23"><Icon name="members" size={23}/><strong>No people added yet</strong><span>Use Add a Person to connect by username.</span><button className="primary-button compact" onClick={() => setTab('add')}>Add someone</button></div>}
            </div>
          )}
        </section>
      </div>
    </Modal>
  )
}

function DirectThread({ conversation, messages, draft, setDraft, onSend, busy, currentUserId, currentUser, onAccept, onDecline }: { conversation: WorkspaceDirectConversation; messages: WorkspaceDirectMessage[]; draft: string; setDraft: (value: string) => void; onSend: () => Promise<void>; busy: boolean; currentUserId: string; currentUser: { name: string; initials: string; avatarUrl: string | null; accent?: string }; onAccept: () => void; onDecline: () => void }) {
  const incoming = conversation.status === 'pending' && !conversation.requestedByMe
  const outgoing = conversation.status === 'pending' && conversation.requestedByMe
  return <div className="direct-thread-v23">
    <header><Avatar name={conversation.person.displayName} initials={conversation.person.initials} src={conversation.person.avatarUrl} size={38} accent={conversation.person.profileAccent}/><div><strong>{conversation.person.displayName}</strong><span>@{conversation.person.username}{conversation.person.publicUserId ? ` · #${conversation.person.publicUserId}` : ''}</span></div></header>
    {incoming ? <div className="direct-request-hero-v23"><Icon name="message" size={24}/><h3>{conversation.person.displayName} wants to connect</h3><p>Accept before either of you can send direct messages.</p><div><button className="primary-button" disabled={busy} onClick={onAccept}>Accept request</button><button className="secondary-button" disabled={busy} onClick={onDecline}>Decline</button></div></div> : outgoing ? <div className="direct-request-hero-v23"><Icon name="activity" size={24}/><h3>Request sent</h3><p>You can message {conversation.person.displayName} after they accept.</p></div> : <>
      <div className="direct-message-feed-v23 direct-message-feed-v28">{messages.length ? messages.map(message => { const own = message.senderUserId === currentUserId; return <div key={message.id} className={own ? 'own direct-message-row-v28' : 'direct-message-row-v28'}><Avatar name={own ? currentUser.name : conversation.person.displayName} initials={own ? currentUser.initials : conversation.person.initials} src={own ? currentUser.avatarUrl : conversation.person.avatarUrl} size={34} accent={own ? currentUser.accent : conversation.person.profileAccent}/><div className="direct-message-copy-v28"><strong>{message.senderName}</strong><p>{message.body}</p><time>{timeAgo(message.createdAt)}</time></div></div> }) : <div className="direct-empty-v23"><Icon name="message" size={22}/><strong>Start the conversation</strong><span>Your direct messages stay between you and this person.</span></div>}</div>
      <div className="direct-compose-v23"><textarea value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void onSend() } }} placeholder={`Message ${conversation.person.displayName}`} maxLength={2000}/><button className="primary-button" disabled={busy || !draft.trim()} onClick={() => void onSend()}><Icon name="send" size={14}/>Send</button></div>
    </>}
  </div>
}
