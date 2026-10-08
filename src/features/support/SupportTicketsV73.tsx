import { useEffect, useMemo, useState } from 'react'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { useAppDialog } from '../../components/AppDialog'
import { useSpaces } from '../../state/SpacesContext'
import { timeAgo } from '../../utils/format'
import { formatPublicUserId } from '../../utils/public-id'

export type SupportTicketStatusV73 =
  | 'waiting'
  | 'taken'
  | 'reviewing'
  | 'resolving'
  | 'resolved'

export type SupportTicketV73 = {
  id: string
  ticketNumber: string
  userId: string
  userName: string
  username: string
  userPublicUserId: string
  userAvatarUrl: string | null
  topic: string
  status: SupportTicketStatusV73
  assignedTo: string | null
  assignedName: string | null
  assignedUsername: string | null
  createdAt: number
  updatedAt: number
  resolvedAt: number | null
  lastActivityAt: number
  deleteAfter: number | null
  reopenedAt: number | null
  transcriptDeletedAt: number | null
}

type SupportTicketMessageV73 = {
  id: string
  ticketId: string
  senderUserId: string
  senderName: string
  senderUsername: string
  recipientUserId: string
  recipientName: string
  body: string
  subject: string
  messageKind: string
  createdAt: number
  readAt: number | null
}

type SupportTicketEventV73 = {
  id: string
  eventType: string
  actorUserId: string | null
  actorName: string | null
  metadata: Record<string, unknown>
  createdAt: number
}

type SupportTicketCollaboratorV73 = {
  userId: string
  displayName: string
  username: string
  publicUserId: string
  platformRole: string | null
}

type SupportTicketDetailV73 = {
  ticket: SupportTicketV73
  messages: SupportTicketMessageV73[]
  events: SupportTicketEventV73[]
  collaborators: SupportTicketCollaboratorV73[]
}

type GlyphKindV73 = 'bug' | 'block' | 'robot'

export function SupportGlyphV73({
  kind,
  size = 16,
  className = '',
}: {
  kind: GlyphKindV73
  size?: number
  className?: string
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className: `spaces-custom-glyph-v73 ${className}`.trim(),
  }

  if (kind === 'bug') {
    return (
      <svg {...common}>
        <path d="M9 5.5 7.4 3.8M15 5.5l1.6-1.7" />
        <path d="M8 8.2C8 6.4 9.7 5 12 5s4 1.4 4 3.2v8.1c0 2.6-1.7 4.7-4 4.7s-4-2.1-4-4.7Z" />
        <path d="M8 10h8M12 10v11M8 12.2 5.3 10M8 15.5 4.7 15M8.2 18.2 6 20.1M16 12.2l2.7-2.2M16 15.5l3.3-.5M15.8 18.2l2.2 1.9" />
      </svg>
    )
  }

  if (kind === 'block') {
    return (
      <svg {...common}>
        <path d="m8.2 3.1 7.6 0 5.1 5.1v7.6l-5.1 5.1H8.2l-5.1-5.1V8.2Z" />
        <path d="M7.7 12h8.6" />
      </svg>
    )
  }

  return (
    <svg {...common} data-spaces-robot="v74" strokeWidth={1.45}>
      <path d="M12 3.5V6" />
      <circle cx="12" cy="2.7" r="1" fill="currentColor" stroke="none" />
      <rect x="1.4" y="10.2" width="2.3" height="5.8" rx="1.1" fill="currentColor" fillOpacity={0.2} />
      <rect x="20.3" y="10.2" width="2.3" height="5.8" rx="1.1" fill="currentColor" fillOpacity={0.2} />
      <rect x="3.7" y="6" width="16.6" height="14.7" rx="2.4" fill="currentColor" fillOpacity={0.14} />
      <circle cx="8.5" cy="11.5" r="2" fill="currentColor" fillOpacity={0.1} />
      <circle cx="15.5" cy="11.5" r="2" fill="currentColor" fillOpacity={0.1} />
      <circle cx="8.5" cy="11.5" r=".7" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="11.5" r=".7" fill="currentColor" stroke="none" />
      <rect x="7.6" y="16" width="8.8" height="2.5" rx=".65" />
      <path d="M10.5 16v2.5M13.5 16v2.5" strokeWidth={1} />
    </svg>
  )
}

function statusLabelV73(status: SupportTicketStatusV73) {
  if (status === 'waiting') return 'Waiting'
  if (status === 'taken') return 'Taken'
  if (status === 'reviewing') return 'Reviewing'
  if (status === 'resolving') return 'Resolving'
  return 'Resolved'
}

function eventTextV73(event: SupportTicketEventV73, ticket: SupportTicketV73) {
  const actor = event.actorName || 'Spaces Support'
  if (event.eventType === 'created') {
    return `Ticket ${ticket.ticketNumber} created. A member of Spaces Support will review it.`
  }
  if (event.eventType === 'taken') return `${actor} took this ticket.`
  if (event.eventType === 'reopened') return `Ticket ${ticket.ticketNumber} was reopened.`
  if (event.eventType === 'resolved') return `Ticket ${ticket.ticketNumber} was resolved by ${actor}.`
  if (event.eventType === 'closed') {
    const reason = String(event.metadata.reason ?? '').trim()
    return reason
      ? `Ticket ${ticket.ticketNumber} was closed by ${actor}. Reason: ${reason}`
      : `Ticket ${ticket.ticketNumber} was closed by ${actor}.`
  }
  if (event.eventType === 'transcript_deleted') return `The ticket transcript was deleted by ${actor}.`
  if (event.eventType === 'auto_transcript_deleted') return 'The ticket transcript expired after 30 days.'
  if (event.eventType === 'collaborator_added') {
    return `${String(event.metadata.displayName || 'A team member')} joined this ticket.`
  }
  if (event.eventType === 'collaborator_removed') {
    return `${String(event.metadata.displayName || 'A team member')} left this ticket.`
  }
  if (event.eventType === 'topic_changed') {
    return `Topic changed to ${String(event.metadata.topic || ticket.topic)}.`
  }
  if (event.eventType === 'assigned') {
    return `Assigned to ${String(event.metadata.displayName || actor)}.`
  }
  if (event.eventType === 'unassigned') return 'Ticket returned to the waiting queue.'
  if (event.eventType === 'status_changed') {
    const status = String(event.metadata.status || '')
    return status ? `Ticket moved to ${statusLabelV73(status as SupportTicketStatusV73)}.` : 'Ticket status changed.'
  }
  return 'Ticket updated.'
}

async function ticketRequestV73<T>(
  apiUrl: string,
  token: string | undefined,
  route: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${apiUrl}${route}`, { ...init, headers })
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

function canReopenV73(ticket: SupportTicketV73) {
  if (ticket.status !== 'resolved' || ticket.transcriptDeletedAt) return false
  return !ticket.deleteAfter || ticket.deleteAfter > Date.now()
}

function ticketStatusClassV73(status: SupportTicketStatusV73) {
  return `status-${status}`
}

function SupportTicketTimelineV73({
  detail,
  currentUserId,
  viewerMode = 'user',
}: {
  detail: SupportTicketDetailV73
  currentUserId: string
  viewerMode?: 'user' | 'staff'
}) {
  const timeline = useMemo(() => {
    const items: (
      | { type: 'message'; createdAt: number; value: SupportTicketMessageV73 }
      | { type: 'event'; createdAt: number; value: SupportTicketEventV73 }
    )[] = [
      ...detail.messages.map(value => ({ type: 'message' as const, createdAt: value.createdAt, value })),
      ...detail.events.map(value => ({ type: 'event' as const, createdAt: value.createdAt, value })),
    ]
    return items.sort((a, b) => a.createdAt - b.createdAt)
  }, [detail])

  if (!timeline.length) {
    return (
      <div className="ticket-empty-v73">
        <SupportGlyphV73 kind="robot" size={28} />
        <strong>No messages yet</strong>
        <span>This ticket is ready for its first reply.</span>
      </div>
    )
  }

  return (
    <>
      {timeline.map(item => {
        if (item.type === 'event') {
          return (
            <div className="ticket-event-v73" key={`event-${item.value.id}`}>
              <span>{eventTextV73(item.value, detail.ticket)}</span>
              <time>{timeAgo(item.value.createdAt)}</time>
            </div>
          )
        }

        const official = item.value.messageKind === 'official'
        const userOwn = item.value.senderUserId === currentUserId
        const senderLabel = official
          ? 'Ticket Reply'
          : viewerMode === 'user' && userOwn
            ? 'You'
            : item.value.senderName || detail.ticket.userName || 'Spaces member'

        return (
          <article
            className={`ticket-message-v73 ${official ? 'ticket-reply-bot-v753' : 'ticket-customer-v753'}`}
            key={item.value.id}
          >
            <div className="ticket-message-meta-v753">
              {official && <SupportGlyphV73 kind="robot" size={12} />}
              <strong>{senderLabel}</strong>
              {official && (
                <span className="ticket-reply-verified-v755" title="Verified official Spaces Support reply">
                  <span aria-hidden="true">✓</span> Verified
                </span>
              )}
              <time>{timeAgo(item.value.createdAt)}</time>
            </div>
            <p>{item.value.body}</p>
          </article>
        )
      })}
    </>
  )
}

export function SupportTicketUserV73() {
  const dialog = useAppDialog()
  const { apiUrl, session, profile, pushToast } = useSpaces()
  const [tickets, setTickets] = useState<SupportTicketV73[]>([])
  const [selectedNumber, setSelectedNumber] = useState('')
  const [detail, setDetail] = useState<SupportTicketDetailV73 | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const openNewTicketV76 = () => {
      setSelectedNumber('')
      setDetail(null)
      setMode('new')
    }
    window.addEventListener('spaces-open-support-ticket-new', openNewTicketV76)
    return () => window.removeEventListener('spaces-open-support-ticket-new', openNewTicketV76)
  }, [])
  const [mode, setMode] = useState<'auto' | 'new' | 'choose' | 'archive'>('auto')
  const [topic, setTopic] = useState('')
  const [firstMessage, setFirstMessage] = useState('')
  const [draft, setDraft] = useState('')

  async function loadDetail(ticketNumber: string, quiet = false) {
    if (!ticketNumber) return
    if (!quiet) setLoading(true)
    try {
      const next = await ticketRequestV73<SupportTicketDetailV73>(
        apiUrl,
        session?.token,
        `/v1/support/tickets/${encodeURIComponent(ticketNumber)}`,
      )
      setDetail(next)
      setSelectedNumber(ticketNumber)
      if (!quiet) setMode('auto')
    } catch (error) {
      if (!quiet) pushToast(error instanceof Error ? error.message : 'Could not open Support ticket.', 'danger')
    } finally {
      if (!quiet) setLoading(false)
    }
  }

  async function loadTickets(quiet = false) {
    if (!session?.token) return
    if (!quiet) setLoading(true)
    try {
      const next = await ticketRequestV73<SupportTicketV73[]>(
        apiUrl,
        session.token,
        '/v1/support/tickets',
      )
      setTickets(next)

      // v76-empty-ticket-reconcile: empty successful response is ready, not loading.
      if (!quiet && Array.isArray(next) && next.length === 0 && mode === 'auto') {
        setSelectedNumber('')
        setDetail(null)
        setMode('new')
      }
      // Background reconciliation must never change what the member is typing,
      // change modes, or jump to another ticket. Only refresh the currently
      // open thread when the member is actually viewing it.
      if (quiet) {
        const selectedRowV757 = selectedNumber
          ? next.find(item => item.ticketNumber === selectedNumber) ?? null
          : null
        const stillSelectedV757 = Boolean(selectedRowV757 && !selectedRowV757.transcriptDeletedAt)
        if (mode === 'auto' && stillSelectedV757) {
          await loadDetail(selectedNumber, true)
        } else if (mode === 'auto' && selectedNumber && !stillSelectedV757) {
          setDetail(null)
          setSelectedNumber('')
          const hasActiveV757 = next.some(item => item.status !== 'resolved' && !item.transcriptDeletedAt)
          setMode(hasActiveV757 ? 'auto' : 'new')
        }
        return
      }

      let preferred = ''
      try {
        preferred = localStorage.getItem('spaces.support.openTicket.v73') || ''
        if (preferred) localStorage.removeItem('spaces.support.openTicket.v73')
      } catch {
        // Ignore local storage restrictions.
      }

      const preferredTicket = preferred ? next.find(item => item.ticketNumber === preferred) : undefined
      const selected = selectedNumber ? next.find(item => item.ticketNumber === selectedNumber) : undefined
      const active = next.find(item => item.status !== 'resolved' && !item.transcriptDeletedAt)
      const target =
        preferredTicket?.ticketNumber ||
        (selected && !selected.transcriptDeletedAt ? selected.ticketNumber : '') ||
        active?.ticketNumber ||
        ''

      if (target) {
        setSelectedNumber(target)
        await loadDetail(target, true)
        const targetTicket = next.find(item => item.ticketNumber === target)
        setMode(targetTicket?.status === 'resolved' ? 'choose' : 'auto')
      } else {
        setDetail(null)
        setSelectedNumber('')
        setMode('new')
      }
    } catch (error) {
      if (!quiet) pushToast(error instanceof Error ? error.message : 'Could not load Support tickets.', 'danger')
    } finally {
      if (!quiet) setLoading(false)
    }
  }

  async function createTicket() {
    const cleanTopic = topic.trim()
    const body = firstMessage.trim()
    if (!cleanTopic || !body || busy) return
    setBusy(true)
    try {
      const next = await ticketRequestV73<SupportTicketDetailV73>(
        apiUrl,
        session?.token,
        '/v1/support/tickets',
        {
          method: 'POST',
          body: JSON.stringify({ topic: cleanTopic, message: body }),
        },
      )
      setTopic('')
      setFirstMessage('')
      setDetail(next)
      setSelectedNumber(next.ticket.ticketNumber)
      setMode('auto')
      await loadTickets(true)
      window.dispatchEvent(new Event('spaces-support-queue-changed'))
      pushToast(`Support ticket ${next.ticket.ticketNumber} created.`, 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not create Support ticket.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  async function sendMessage() {
    if (!detail || !draft.trim() || busy) return
    if (detail.ticket.status === 'resolved') {
      setMode('choose')
      return
    }
    setBusy(true)
    try {
      await ticketRequestV73(
        apiUrl,
        session?.token,
        `/v1/support/tickets/${encodeURIComponent(detail.ticket.ticketNumber)}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ body: draft.trim() }),
        },
      )
      setDraft('')
      await loadDetail(detail.ticket.ticketNumber, true)
      await loadTickets(true)
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not send Support message.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  async function reopenCurrent() {
    const ticket = detail?.ticket || tickets.find(item => item.status === 'resolved')
    if (!ticket || busy) return
    setBusy(true)
    try {
      const next = await ticketRequestV73<SupportTicketDetailV73>(
        apiUrl,
        session?.token,
        `/v1/support/tickets/${encodeURIComponent(ticket.ticketNumber)}/reopen`,
        { method: 'POST', body: '{}' },
      )
      setDetail(next)
      setSelectedNumber(next.ticket.ticketNumber)
      setMode('auto')
      await loadTickets(true)
      window.dispatchEvent(new Event('spaces-support-queue-changed'))
      pushToast(`Ticket ${next.ticket.ticketNumber} reopened.`, 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not reopen that ticket.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  async function closeCurrentTicketV755() {
    const ticket = detail?.ticket
    if (!ticket || ticket.status === 'resolved' || busy) return
    const reason = await dialog.prompt({
      title: `Close ${ticket.ticketNumber}?`,
      message: 'Tell Spaces Support why you are closing this ticket. It will move to Archived for 30 days and can be reopened during that time.',
      label: 'Reason',
      placeholder: 'Issue fixed, no longer needed, solved another way…',
      maxLength: 500,
      danger: true,
      confirmText: 'Close Ticket',
    })
    if (!reason?.trim()) return
    setBusy(true)
    try {
      const next = await ticketRequestV73<SupportTicketDetailV73>(
        apiUrl,
        session?.token,
        `/v1/support/tickets/${encodeURIComponent(ticket.ticketNumber)}/close`,
        { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) },
      )
      setDetail(next)
      setSelectedNumber('')
      setMode('archive')
      await loadTickets(true)
      window.dispatchEvent(new Event('spaces-support-queue-changed'))
      pushToast(`Ticket ${ticket.ticketNumber} moved to Archived.`, 'success')
    } catch (error) {
      const messageV757 = error instanceof Error ? error.message : 'Could not close that ticket.'
      // If another device/member of Support already closed or deleted the transcript,
      // reconcile instead of leaving a dead ticket selected.
      try {
        const latestV757 = await ticketRequestV73<SupportTicketV73[]>(apiUrl, session?.token, '/v1/support/tickets')
        setTickets(latestV757)
        const rowV757 = latestV757.find(item => item.ticketNumber === ticket.ticketNumber)
        if (!rowV757 || rowV757.status === 'resolved' || rowV757.transcriptDeletedAt) {
          setDetail(null)
          setSelectedNumber('')
          setMode('archive')
          window.dispatchEvent(new Event('spaces-support-queue-changed'))
          pushToast(`Ticket ${ticket.ticketNumber} is already closed or archived.`, 'success')
          return
        }
      } catch {
        // Keep the original close error below.
      }
      pushToast(messageV757, 'danger')
    } finally {
      setBusy(false)
    }
  }

  const activeTicketsV755 = tickets.filter(ticket => ticket.status !== 'resolved' && !ticket.transcriptDeletedAt)
  const archivedTicketsV755 = tickets.filter(ticket => ticket.status === 'resolved' && !ticket.transcriptDeletedAt)
  const selectedTicket = detail?.ticket ?? tickets.find(item => item.ticketNumber === selectedNumber) ?? null

  return (
    <div className="support-ticket-user-v73">
      <header className="ticket-user-header-v73">
        <div className="ticket-brand-v73">
          <span><SupportGlyphV73 kind="robot" size={20} /></span>
          <div>
            <strong>Spaces Support</strong>
            <small>Official Support channel</small>
          </div>
        </div>
        <div className="ticket-user-header-actions-v755">
          {archivedTicketsV755.length > 0 && (
            <button className="secondary-button compact ticket-archive-open-v755" onClick={() => setMode('archive')}>
              Archived <small>{archivedTicketsV755.length}</small>
            </button>
          )}
          <button className="secondary-button compact ticket-new-topic-v73" onClick={() => setMode('new')}>
            <Icon name="plus" size={12} /> New Topic
          </button>
        </div>
      </header>

      {activeTicketsV755.length > 0 && (
        <div className="ticket-user-strip-v73" aria-label="Your active Support tickets">
          {activeTicketsV755.map(ticket => (
            <button
              key={ticket.ticketNumber}
              className={ticket.ticketNumber === selectedNumber ? 'active' : ''}
              onClick={() => {
                setSelectedNumber(ticket.ticketNumber)
                setMode('auto')
                void loadDetail(ticket.ticketNumber)
              }}
            >
              <span className={`ticket-status-dot-v73 ${ticketStatusClassV73(ticket.status)}`} />
              <strong>{ticket.ticketNumber}</strong>
              <small>{ticket.topic}</small>
            </button>
          ))}
        </div>
      )}

      {mode === 'archive' ? (
        <section className="ticket-archive-v755">
          <header>
            <div><span className="eyebrow">ARCHIVED</span><h2>Past Support tickets</h2></div>
            <button className="secondary-button compact" onClick={() => setMode(activeTicketsV755.length ? 'auto' : 'new')}>Back</button>
          </header>
          <p>Closed and resolved tickets stay here for 30 days. After that, their transcript is deleted automatically.</p>
          <div className="ticket-archive-list-v755">
            {archivedTicketsV755.map(ticket => (
              <button key={ticket.ticketNumber} onClick={() => {
                setSelectedNumber(ticket.ticketNumber)
                setMode('choose')
                void loadDetail(ticket.ticketNumber, true)
              }}>
                <span className={`ticket-status-dot-v73 ${ticketStatusClassV73(ticket.status)}`} />
                <div><strong>{ticket.ticketNumber}</strong><span>{ticket.topic}</span></div>
                <small>{ticket.deleteAfter ? `Deletes ${new Date(ticket.deleteAfter).toLocaleDateString()}` : 'Archived'}</small>
              </button>
            ))}
            {!archivedTicketsV755.length && <div className="ticket-empty-v73"><strong>No archived tickets</strong><span>Closed tickets will appear here temporarily.</span></div>}
          </div>
        </section>
      ) : mode === 'new' ? (
        <section className="ticket-start-v73">
          <SupportGlyphV73 kind="robot" size={32} />
          <span className="eyebrow">NEW SUPPORT TICKET</span>
          <h2>What can we help with?</h2>
          <p>Start a new topic. Spaces Support can reply here on desktop or mobile.</p>
          <label>
            Topic
            <input
              className="text-input"
              value={topic}
              maxLength={120}
              onChange={event => setTopic(event.target.value)}
              placeholder="Short description of the issue"
            />
          </label>
          <label>
            Message
            <textarea
              className="text-area"
              value={firstMessage}
              maxLength={2400}
              rows={5}
              onChange={event => setFirstMessage(event.target.value)}
              placeholder="Tell us what happened..."
            />
          </label>
          <div>
            {activeTicketsV755.length > 0 && (
              <button className="secondary-button" onClick={() => {
                const latest = activeTicketsV755[0]
                if (latest) {
                  setSelectedNumber(latest.ticketNumber)
                  setMode(latest.status === 'resolved' ? 'choose' : 'auto')
                  void loadDetail(latest.ticketNumber)
                }
              }}>
                Cancel
              </button>
            )}
            <button
              className="primary-button"
              disabled={busy || !topic.trim() || !firstMessage.trim()}
              onClick={() => void createTicket()}
            >
              {busy ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </section>
      ) : loading && !detail ? (
        <div className="settings-loading">Loading Support...</div>
      ) : selectedTicket && detail ? (
        <section className="ticket-thread-v73">
          <header className="ticket-thread-header-v73">
            <div>
              <div className="ticket-number-line-v73">
                <strong>{selectedTicket.ticketNumber}</strong>
                <span className={`ticket-status-pill-v73 ${ticketStatusClassV73(selectedTicket.status)}`}>
                  <i />
                  {statusLabelV73(selectedTicket.status)}
                </span>
              </div>
              <h3>{selectedTicket.topic}</h3>
              <small>
                {selectedTicket.assignedName
                  ? `Assigned to ${selectedTicket.assignedName}`
                  : 'Waiting for Spaces Support'}
              </small>
            </div>
            {selectedTicket.status !== 'resolved' && (
              <button className="secondary-button compact ticket-user-close-v755" disabled={busy} onClick={() => void closeCurrentTicketV755()}>
                Close Ticket
              </button>
            )}
          </header>

          {mode === 'choose' && selectedTicket.status === 'resolved' && (
            <div className="ticket-topic-choice-v73">
              <SupportGlyphV73 kind="robot" size={22} />
              <div>
                <strong>What would you like to do?</strong>
                <span>Continue this topic or start a separate Support ticket.</span>
              </div>
              <div>
                <button
                  className="secondary-button"
                  disabled={busy || !canReopenV73(selectedTicket)}
                  onClick={() => void reopenCurrent()}
                >
                  Reopen Ticket
                </button>
                <button className="primary-button" onClick={() => setMode('new')}>
                  New Topic
                </button>
              </div>
              {!canReopenV73(selectedTicket) && (
                <small>This ticket is no longer reopenable. Start a new topic instead.</small>
              )}
            </div>
          )}

          <div className="ticket-feed-v73">
            <SupportTicketTimelineV73
              detail={detail}
              currentUserId={profile?.id ?? ''}
              viewerMode="user"
            />
          </div>

          {selectedTicket.status !== 'resolved' ? (
            <div className="ticket-compose-v73">
              <textarea
                value={draft}
                maxLength={2400}
                placeholder="Message Spaces Support..."
                onChange={event => setDraft(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void sendMessage()
                  }
                }}
              />
              <button
                className="primary-button"
                disabled={busy || !draft.trim()}
                onClick={() => void sendMessage()}
              >
                <Icon name="send" size={14} />
              </button>
            </div>
          ) : mode !== 'choose' ? (
            <div className="ticket-resolved-footer-v73">
              <span>This ticket is resolved.</span>
              <button className="secondary-button compact" onClick={() => setMode('choose')}>
                Continue or start new
              </button>
            </div>
          ) : null}
        </section>
      ) : (
        <div className="ticket-empty-v73">
          <SupportGlyphV73 kind="robot" size={30} />
          <strong>No Support tickets yet</strong>
          <button className="primary-button compact" onClick={() => setMode('new')}>
            Start a Support Ticket
          </button>
        </div>
      )}
    </div>
  )
}

type AdminFilterV73 =
  | 'waiting'
  | 'mine'
  | 'reviewing'
  | 'resolving'
  | 'resolved'
  | 'all'

export function SupportTicketConsoleV73() {
  const dialog = useAppDialog()
  const { apiUrl, session, profile, pushToast } = useSpaces()
  const [tickets, setTickets] = useState<SupportTicketV73[]>([])
  const [selectedNumber, setSelectedNumber] = useState('')
  const [detail, setDetail] = useState<SupportTicketDetailV73 | null>(null)
  const [filter, setFilter] = useState<AdminFilterV73>('waiting')
  const [query, setQuery] = useState('')
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  async function loadDetail(ticketNumber: string, quiet = false) {
    if (!ticketNumber) return
    if (!quiet) setLoading(true)
    try {
      const next = await ticketRequestV73<SupportTicketDetailV73>(
        apiUrl,
        session?.token,
        `/v1/support/tickets/${encodeURIComponent(ticketNumber)}`,
      )
      setDetail(next)
      setSelectedNumber(ticketNumber)
    } catch (error) {
      if (!quiet) pushToast(error instanceof Error ? error.message : 'Could not load ticket.', 'danger')
    } finally {
      if (!quiet) setLoading(false)
    }
  }

  async function loadTickets(quiet = false) {
    if (!session?.token) return
    if (!quiet) setLoading(true)
    try {
      const next = await ticketRequestV73<SupportTicketV73[]>(
        apiUrl,
        session.token,
        '/v1/support/tickets',
      )
      setTickets(next)

      // Staff polling is reconciliation only. Never replace the selected person,
      // clear the reply draft, or jump filters while someone is typing.
      if (quiet) {
        if (selectedNumber && next.some(item => item.ticketNumber === selectedNumber)) {
          await loadDetail(selectedNumber, true)
        }
        return
      }

      let pending = ''
      try {
        pending = localStorage.getItem('spaces.support.adminTicket.v73') || ''
        if (pending) localStorage.removeItem('spaces.support.adminTicket.v73')
      } catch {
        // Ignore storage restrictions.
      }

      const target =
        (pending && next.some(item => item.ticketNumber === pending) ? pending : '') ||
        (selectedNumber && next.some(item => item.ticketNumber === selectedNumber) ? selectedNumber : '') ||
        next.find(item => item.status !== 'resolved')?.ticketNumber ||
        next[0]?.ticketNumber ||
        ''

      if (target) {
        setSelectedNumber(target)
        await loadDetail(target, true)
      } else {
        setDetail(null)
        setSelectedNumber('')
      }
    } catch (error) {
      if (!quiet) pushToast(error instanceof Error ? error.message : 'Could not load Support tickets.', 'danger')
    } finally {
      if (!quiet) setLoading(false)
    }
  }

  useEffect(() => {
    void loadTickets()
    const timer = window.setInterval(() => void loadTickets(true), 4000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token])

  const waitingAttentionV753 = useMemo(
    () => tickets.filter(ticket => ticket.status === 'waiting' && !ticket.transcriptDeletedAt).length,
    [tickets],
  )

  const filteredTickets = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return tickets.filter(ticket => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'mine'
          ? ticket.assignedTo === profile?.id
          : ticket.status === filter)
      if (!matchesFilter) return false
      if (!needle) return true
      return [
        ticket.ticketNumber,
        ticket.userName,
        ticket.username,
        ticket.userPublicUserId,
        ticket.topic,
      ].some(value => String(value || '').toLowerCase().includes(needle))
    })
  }, [filter, profile?.id, query, tickets])

  const people = useMemo(() => {
    const map = new Map<string, { userId: string; userName: string; username: string; publicId: string; avatarUrl: string | null; tickets: SupportTicketV73[] }>()
    for (const ticket of filteredTickets) {
      const existing = map.get(ticket.userId)
      if (existing) existing.tickets.push(ticket)
      else {
        map.set(ticket.userId, {
          userId: ticket.userId,
          userName: ticket.userName,
          username: ticket.username,
          publicId: ticket.userPublicUserId,
          avatarUrl: ticket.userAvatarUrl,
          tickets: [ticket],
        })
      }
    }
    return [...map.values()].sort(
      (a, b) => Math.max(...b.tickets.map(item => item.lastActivityAt)) - Math.max(...a.tickets.map(item => item.lastActivityAt)),
    )
  }, [filteredTickets])

  const selectedTicket = detail?.ticket ?? tickets.find(item => item.ticketNumber === selectedNumber) ?? null
  const selectedPersonFromFilterV753 = selectedTicket ? people.find(person => person.userId === selectedTicket.userId) : people[0]
  const selectedPerson = selectedPersonFromFilterV753 ?? (selectedTicket ? {
    userId: selectedTicket.userId,
    userName: selectedTicket.userName,
    username: selectedTicket.username,
    publicId: selectedTicket.userPublicUserId,
    avatarUrl: selectedTicket.userAvatarUrl,
    tickets: tickets.filter(item => item.userId === selectedTicket.userId),
  } : people[0])
  const personTickets = (selectedPerson?.tickets ?? []).filter(ticket =>
    filter === 'resolved' || filter === 'all' ? true : ticket.status !== 'resolved'
  )

  async function updateTicket(input: Record<string, unknown>) {
    if (!selectedTicket || busy) return
    setBusy(true)
    try {
      const next = await ticketRequestV73<SupportTicketDetailV73>(
        apiUrl,
        session?.token,
        `/v1/support/tickets/${encodeURIComponent(selectedTicket.ticketNumber)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(input),
        },
      )
      setDetail(next)
      setMoreOpen(false)
      await loadTickets(true)
      window.dispatchEvent(new Event('spaces-support-queue-changed'))
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not update ticket.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  async function sendReply() {
    if (!selectedTicket || !reply.trim() || busy) return
    const moveToReviewingV753 = selectedTicket.status === 'waiting' || selectedTicket.status === 'taken'
    setBusy(true)
    try {
      await ticketRequestV73(
        apiUrl,
        session?.token,
        `/v1/support/tickets/${encodeURIComponent(selectedTicket.ticketNumber)}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ body: reply.trim() }),
        },
      )
      setReply('')
      if (moveToReviewingV753) setFilter('reviewing')
      await loadDetail(selectedTicket.ticketNumber, true)
      await loadTickets(true)
      window.dispatchEvent(new Event('spaces-support-queue-changed'))
      window.dispatchEvent(new CustomEvent('spaces-direct-activity', {
        detail: { key: 'support', lastAt: Date.now(), preview: 'Ticket Reply' },
      }))
      if (moveToReviewingV753) pushToast('Ticket moved to Reviewing.', 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not send Support reply.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  async function changeTopic() {
    if (!selectedTicket) return
    const nextTopic = await dialog.prompt({
      title: 'Change ticket topic',
      message: `Update ${selectedTicket.ticketNumber}.`,
      label: 'Topic',
      initialValue: selectedTicket.topic,
      maxLength: 120,
      confirmText: 'Change Topic',
    })
    if (nextTopic?.trim()) await updateTicket({ topic: nextTopic.trim() })
  }

  async function assignAgent() {
    const queryValue = await dialog.prompt({
      title: 'Assign ticket',
      message: 'Enter a Staff, Support, or Founder username, Spaces ID, or account ID.',
      label: 'Team member',
      placeholder: '@username or #0001',
      maxLength: 80,
      confirmText: 'Assign',
    })
    if (queryValue?.trim()) await updateTicket({ assigneeQuery: queryValue.trim() })
  }

  async function addCollaborator() {
    if (!selectedTicket) return
    const queryValue = await dialog.prompt({
      title: 'Add team member',
      message: 'Add another Staff, Support, or Founder to this ticket.',
      label: 'Team member',
      placeholder: '@username or #0001',
      maxLength: 80,
      confirmText: 'Add',
    })
    if (!queryValue?.trim()) return
    setBusy(true)
    try {
      const next = await ticketRequestV73<SupportTicketDetailV73>(
        apiUrl,
        session?.token,
        `/v1/support/tickets/${encodeURIComponent(selectedTicket.ticketNumber)}/collaborators`,
        {
          method: 'POST',
          body: JSON.stringify({ userQuery: queryValue.trim() }),
        },
      )
      setDetail(next)
      setMoreOpen(false)
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not add that team member.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  async function deleteTranscript() {
    if (!selectedTicket || busy) return
    const reason = await dialog.prompt({
      title: `Close ${selectedTicket.ticketNumber}?`,
      message: 'Give the closure reason. The ticket will leave active work and remain in Archived for 30 days before its transcript is deleted.',
      label: 'Reason',
      placeholder: 'Resolved, duplicate, member confirmed fix…',
      maxLength: 500,
      danger: true,
      confirmText: 'Close Ticket',
    })
    if (!reason?.trim()) return
    setBusy(true)
    try {
      let nextV757: SupportTicketDetailV73
      try {
        nextV757 = await ticketRequestV73<SupportTicketDetailV73>(
          apiUrl,
          session?.token,
          `/v1/support/tickets/${encodeURIComponent(selectedTicket.ticketNumber)}/close`,
          { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) },
        )
      } catch (closeErrorV757) {
        const messageV757 = closeErrorV757 instanceof Error ? closeErrorV757.message : ''
        // Compatibility for a Worker that has not received the new /close route yet.
        // Staff can still resolve through the original V73 PATCH endpoint, and we
        // preserve the requested reason as an official Ticket Reply first.
        if (!/404|not found/i.test(messageV757)) throw closeErrorV757
        await ticketRequestV73(
          apiUrl,
          session?.token,
          `/v1/support/tickets/${encodeURIComponent(selectedTicket.ticketNumber)}/messages`,
          {
            method: 'POST',
            body: JSON.stringify({ body: `Closing ticket. Reason: ${reason.trim()}` }),
          },
        )
        nextV757 = await ticketRequestV73<SupportTicketDetailV73>(
          apiUrl,
          session?.token,
          `/v1/support/tickets/${encodeURIComponent(selectedTicket.ticketNumber)}`,
          { method: 'PATCH', body: JSON.stringify({ status: 'resolved' }) },
        )
      }
      setDetail(nextV757)
      setFilter('resolved')
      setMoreOpen(false)
      await loadTickets(true)
      window.dispatchEvent(new Event('spaces-support-queue-changed'))
      pushToast(`Ticket ${selectedTicket.ticketNumber} closed and archived.`, 'success')
    } catch (error) {
      const messageV757 = error instanceof Error ? error.message : 'Could not close that ticket.'
      try {
        await loadTickets(true)
        if (detail?.ticket.status === 'resolved' || detail?.ticket.transcriptDeletedAt) {
          setFilter('resolved')
          setMoreOpen(false)
          window.dispatchEvent(new Event('spaces-support-queue-changed'))
          pushToast(`Ticket ${selectedTicket.ticketNumber} is already closed or archived.`, 'success')
          return
        }
      } catch {
        // Keep original error.
      }
      pushToast(messageV757, 'danger')
    } finally {
      setBusy(false)
    }
  }

  function choosePerson(userId: string) {
    const person = people.find(item => item.userId === userId)
    const ticket = person?.tickets[0]
    if (ticket) void loadDetail(ticket.ticketNumber)
  }

  return (
    <div className="support-ticket-admin-v73">
      <div className="ticket-admin-toolbar-v73">
        <label>
          <Icon name="search" size={13} />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Ticket, user, Spaces ID, or topic..."
          />
        </label>
        <div className="ticket-filter-v73">
          {(['waiting', 'mine', 'reviewing', 'resolving', 'resolved', 'all'] as AdminFilterV73[]).map(item => (
            <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>
              {item === 'mine' ? 'Mine' : item === 'all' ? 'All' : statusLabelV73(item as SupportTicketStatusV73)}
            </button>
          ))}
        </div>
        <button className="secondary-button compact" onClick={() => void loadTickets()}>
          <Icon name="refresh" size={12} /> Refresh
        </button>
      </div>

      <div className="ticket-admin-grid-v73">
        <aside className="ticket-people-v73">
          <header>
            <SupportGlyphV73 kind="robot" size={15} />
            <span>Support Tickets</span>
            <small className={waitingAttentionV753 > 0 ? 'ticket-waiting-count-v753' : ''}>{waitingAttentionV753 > 0 ? waitingAttentionV753 : filteredTickets.length}</small>
          </header>
          <div>
            {people.map(person => {
              const latest = person.tickets[0]
              const active = selectedTicket?.userId === person.userId
              return (
                <button key={person.userId} className={active ? 'active' : ''} onClick={() => choosePerson(person.userId)}>
                  <Avatar name={person.userName} src={person.avatarUrl} size={34} />
                  <span>
                    <strong>{person.userName}</strong>
                    <small>@{person.username} · {person.tickets.length} ticket{person.tickets.length === 1 ? '' : 's'}</small>
                  </span>
                  {latest && <i className={`ticket-status-dot-v73 ${ticketStatusClassV73(latest.status)}`} />}
                </button>
              )
            })}
            {!people.length && (
              <div className="ticket-admin-empty-v73">
                <SupportGlyphV73 kind="robot" size={24} />
                <span>No tickets match this view.</span>
              </div>
            )}
          </div>
        </aside>

        <section className="ticket-admin-thread-v73">
          {selectedPerson && personTickets.length > 0 && (
            <div className="ticket-tabs-v73">
              {personTickets.map(ticket => (
                <button
                  key={ticket.ticketNumber}
                  className={ticket.ticketNumber === selectedNumber ? 'active' : ''}
                  onClick={() => void loadDetail(ticket.ticketNumber)}
                >
                  <span className={`ticket-status-dot-v73 ${ticketStatusClassV73(ticket.status)}`} />
                  <strong>{ticket.ticketNumber}</strong>
                  <small>{ticket.topic}</small>
                </button>
              ))}
            </div>
          )}

          {loading && !detail ? (
            <div className="settings-loading">Loading ticket...</div>
          ) : detail ? (
            <>
              <header className="ticket-admin-header-v73">
                <div className="ticket-admin-identity-v73">
                  <Avatar
                    name={detail.ticket.userName}
                    src={detail.ticket.userAvatarUrl}
                    size={38}
                  />
                  <div>
                    <strong>{detail.ticket.userName}</strong>
                    <span>
                      @{detail.ticket.username}
                      {detail.ticket.userPublicUserId
                        ? ` · ${formatPublicUserId(detail.ticket.userPublicUserId)}`
                        : ''}
                    </span>
                    <small>{detail.ticket.ticketNumber}</small>
                  </div>
                </div>

                <div className="ticket-admin-topic-v73">
                  <span className="eyebrow">CURRENT TOPIC</span>
                  <strong>{detail.ticket.topic}</strong>
                  <small>
                    <span className={`ticket-status-dot-v73 ${ticketStatusClassV73(detail.ticket.status)}`} />
                    {statusLabelV73(detail.ticket.status)}
                    {detail.ticket.assignedName
                      ? ` · ${detail.ticket.assignedName}`
                      : ' · Unassigned'}
                    {detail.collaborators.length
                      ? ` · +${detail.collaborators.length} helping`
                      : ''}
                  </small>
                </div>

                <div className="ticket-admin-actions-v73">
                  {detail.ticket.status === 'waiting' ? (
                    <button className="primary-button compact" disabled={busy} onClick={() => void updateTicket({ take: true })}>
                      Take Ticket
                    </button>
                  ) : detail.ticket.status !== 'resolved' ? (
                    <button className="primary-button compact" disabled={busy} onClick={() => void updateTicket({ status: 'resolved' })}>
                      Resolve
                    </button>
                  ) : null}
                  <div className="ticket-more-v73">
                    <button
                      className="icon-button"
                      aria-label="More ticket actions"
                      onClick={() => setMoreOpen(value => !value)}
                    >
                      <Icon name="more" size={15} />
                    </button>
                    {moreOpen && (
                      <div className="ticket-more-menu-v73">
                        {detail.ticket.status !== 'resolved' && (
                          <>
                            <button onClick={() => void updateTicket({ status: 'reviewing' })}>Mark Reviewing</button>
                            <button onClick={() => void updateTicket({ status: 'resolving' })}>Mark Resolving</button>
                          </>
                        )}
                        {detail.ticket.status === 'resolved' && canReopenV73(detail.ticket) && (
                          <button onClick={() => void updateTicket({ status: 'waiting' })}>Reopen Ticket</button>
                        )}
                        <button onClick={() => void updateTicket({ assignToMe: true })}>Assign to Me</button>
                        <button onClick={() => void assignAgent()}>Assign Someone...</button>
                        <button onClick={() => void addCollaborator()}>Add Team Member...</button>
                        <button onClick={() => void changeTopic()}>Change Topic...</button>
                        {detail.ticket.status !== 'resolved' && (
                          <button onClick={() => void updateTicket({ status: 'resolved' })}>Resolve Ticket</button>
                        )}
                        <button className="danger" onClick={() => void deleteTranscript()}>Close Ticket...</button>
                      </div>
                    )}
                  </div>
                </div>
              </header>

              {detail.collaborators.length > 0 && (
                <div className="ticket-collaborators-v73">
                  <span>Team:</span>
                  {detail.collaborators.map(person => (
                    <button
                      key={person.userId}
                      title={`Remove @${person.username}`}
                      onClick={async () => {
                        if (busy) return
                        setBusy(true)
                        try {
                          const next = await ticketRequestV73<SupportTicketDetailV73>(
                            apiUrl,
                            session?.token,
                            `/v1/support/tickets/${encodeURIComponent(detail.ticket.ticketNumber)}/collaborators/${encodeURIComponent(person.userId)}`,
                            { method: 'DELETE' },
                          )
                          setDetail(next)
                        } catch (error) {
                          pushToast(error instanceof Error ? error.message : 'Could not remove team member.', 'danger')
                        } finally {
                          setBusy(false)
                        }
                      }}
                    >
                      @{person.username} <span>×</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="ticket-feed-v73 admin">
                <SupportTicketTimelineV73
                  detail={detail}
                  currentUserId={profile?.id ?? ''}
                  viewerMode="staff"
                />
              </div>

              {detail.ticket.status !== 'resolved' ? (
                <div className="ticket-compose-v73 admin">
                  <textarea
                    value={reply}
                    maxLength={2400}
                    placeholder={`Reply to ${detail.ticket.userName}...`}
                    onChange={event => setReply(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        void sendReply()
                      }
                    }}
                  />
                  <button className="primary-button" disabled={busy || !reply.trim()} onClick={() => void sendReply()}>
                    <Icon name="send" size={14} />
                  </button>
                </div>
              ) : (
                <div className="ticket-resolved-footer-v73">
                  <span>Resolved {detail.ticket.resolvedAt ? timeAgo(detail.ticket.resolvedAt) : ''}</span>
                  {detail.ticket.deleteAfter && !detail.ticket.transcriptDeletedAt && (
                    <small>Transcript expires {new Date(detail.ticket.deleteAfter).toLocaleDateString()}.</small>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="ticket-admin-empty-v73">
              <SupportGlyphV73 kind="robot" size={28} />
              <strong>Select a Support ticket</strong>
              <span>Tickets are grouped by person to keep this inbox compact.</span>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
