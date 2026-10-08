import { useCallback, useEffect, useMemo, useState } from 'react'
import { Avatar } from '../../../components/Avatar'
import { Icon } from '../../../components/Icon'
import { useSpaces } from '../../../state/SpacesContext'
import { timeAgo } from '../../../utils/format'
import { SupportFormattedTextV77 } from './SupportFormattedTextV77'
import {
  dispatchSupportIntakeV77,
  supportCaseTypeLabelV77,
  supportStatusLabelV77,
  supportV77Request,
  type SupportV77Case,
} from './support-v77-api'

export function SupportMemberV77() {
  const { apiUrl, session, profile, pushToast } = useSpaces()
  const [cases, setCases] = useState<SupportV77Case[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState<SupportV77Case | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (quiet = false) => {
    if (!session?.token) return
    if (!quiet) setState('loading')
    try {
      const next = await supportV77Request<SupportV77Case[]>(apiUrl, session.token, '/v1/support/v77/my-cases')
      setCases(next)
      setError('')
      setState('ready')
      setSelectedId(current => current && next.some(item => item.id === current) ? current : (next[0]?.id ?? ''))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load Support cases.')
      if (!quiet) setState('error')
    }
  }, [apiUrl, session?.token])

  const loadDetail = useCallback(async (id: string, quiet = false) => {
    if (!id || !session?.token) { setDetail(null); return }
    try {
      const next = await supportV77Request<SupportV77Case>(apiUrl, session.token, `/v1/support/v77/cases/${encodeURIComponent(id)}`)
      setDetail(next)
      if (!quiet) setError('')
    } catch (caught) {
      if (!quiet) pushToast(caught instanceof Error ? caught.message : 'Could not load that case.', 'danger')
    }
  }, [apiUrl, pushToast, session?.token])

  useEffect(() => { void load(false) }, [load])
  useEffect(() => { if (selectedId) void loadDetail(selectedId) }, [loadDetail, selectedId])

  useEffect(() => {
    const sync = () => void load(true)
    window.addEventListener('spaces-support-v77-changed', sync)
    const timer = window.setInterval(() => void load(true), 7000)
    return () => { window.removeEventListener('spaces-support-v77-changed', sync); window.clearInterval(timer) }
  }, [load])

  useEffect(() => {
    if (!selectedId) return
    const timer = window.setInterval(() => void loadDetail(selectedId, true), 7000)
    return () => window.clearInterval(timer)
  }, [loadDetail, selectedId])

  const selected = useMemo(() => detail ?? cases.find(item => item.id === selectedId) ?? null, [cases, detail, selectedId])

  async function sendReply() {
    const body = draft.trim()
    if (!selected || !body || busy) return
    setBusy(true)
    try {
      await supportV77Request(apiUrl, session?.token, `/v1/support/v77/cases/${encodeURIComponent(selected.id)}/events`, {
        method: 'POST',
        body: JSON.stringify({ eventType: 'message', body }),
      })
      setDraft('')
      await Promise.all([load(true), loadDetail(selected.id, true)])
      window.dispatchEvent(new Event('spaces-support-v77-changed'))
    } catch (caught) {
      pushToast(caught instanceof Error ? caught.message : 'Could not send your Support reply.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  async function reopen() {
    if (!selected || busy) return
    setBusy(true)
    try {
      const next = await supportV77Request<SupportV77Case>(apiUrl, session?.token, `/v1/support/v77/cases/${encodeURIComponent(selected.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'reopen' }),
      })
      setDetail(next)
      await load(true)
      window.dispatchEvent(new Event('spaces-support-v77-changed'))
      pushToast(`${next.caseNumber} reopened.`, 'success')
    } catch (caught) {
      pushToast(caught instanceof Error ? caught.message : 'Could not reopen that case.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading') {
    return <div className="support-member-v77 support-member-state-v77"><span className="support-pulse-v77"><Icon name="shield" size={22}/></span><strong>Opening Support…</strong><small>Loading your cases</small></div>
  }

  if (state === 'error') {
    return <div className="support-member-v77 support-member-state-v77 error"><Icon name="shield" size={24}/><strong>Support could not load</strong><span>{error}</span><div><button className="primary-button compact" onClick={() => void load(false)}><Icon name="refresh" size={13}/> Retry</button><button className="secondary-button compact" onClick={() => dispatchSupportIntakeV77({ source: 'support_bot' })}><Icon name="plus" size={13}/> Start New Ticket</button></div></div>
  }

  if (!cases.length) {
    return <div className="support-member-v77 support-member-state-v77 empty">
      <span className="support-bot-orb-v77"><Icon name="shield" size={25}/></span>
      <span className="eyebrow">SPACES SUPPORT</span>
      <h2>How can we help?</h2>
      <p>Requests, user reports, Space reports, bugs, and appeals all start here.</p>
      <button className="primary-button" onClick={() => dispatchSupportIntakeV77({ source: 'support_bot' })}><Icon name="plus" size={14}/> Start New Ticket</button>
      <small>No open Support cases yet.</small>
    </div>
  }

  return <div className="support-member-v77 support-member-layout-v77">
    <aside className="support-member-list-v77">
      <header><div><span className="eyebrow">SUPPORT BOT</span><strong>Your cases</strong></div><button className="primary-button compact" onClick={() => dispatchSupportIntakeV77({ source: 'support_bot' })}><Icon name="plus" size={13}/> New</button></header>
      <div className="support-member-case-list-v77">
        {cases.map(item => <button key={item.id} className={selectedId === item.id ? 'active' : ''} onClick={() => { setSelectedId(item.id); setDetail(null) }}>
          <span className={`support-case-type-v77 type-${item.caseType}`}><Icon name={item.caseType === 'user_report' ? 'user' : item.caseType === 'space_report' ? 'grid' : item.caseType === 'bug_report' ? 'activity' : item.caseType === 'appeal' ? 'shield' : 'message'} size={14}/></span>
          <span><strong>{item.subject}</strong><small>{item.caseNumber} · {supportStatusLabelV77(item.status)} · {timeAgo(item.lastActivityAt)}</small></span>
          <Icon name="chevron" size={12}/>
        </button>)}
      </div>
    </aside>

    <section className="support-member-thread-v77">
      {selected ? <>
        <header>
          <span className="support-bot-orb-v77 small"><Icon name="shield" size={18}/></span>
          <div><span className="eyebrow">{supportCaseTypeLabelV77(selected.caseType).toUpperCase()}</span><strong>{selected.subject}</strong><small>{selected.caseNumber} · {supportStatusLabelV77(selected.status)}{selected.assignedToName ? ` · ${selected.assignedToName}` : ''}</small></div>
          <span className={`support-status-pill-v77 status-${selected.status}`}>{supportStatusLabelV77(selected.status)}</span>
        </header>
        <div className="support-member-feed-v77">
          <article className="support-opening-card-v77"><strong>Case opened</strong><p>{selected.details || `${selected.subtype} submitted to Spaces Support.`}</p></article>
          {(selected.events ?? []).map(event => {
            const own = event.actorUserId === profile?.id
            const official = Boolean(event.actorRole)
            return <article key={event.id} className={`support-event-v77 ${own ? 'own' : ''} ${official ? 'official' : ''}`}>
              <Avatar name={own ? profile?.displayName ?? 'You' : event.actorName || 'Spaces Support'} initials={(own ? profile?.initials : event.actorName?.slice(0, 1)) || 'S'} src={own ? profile?.avatarUrl : null} size={32} accent={own ? profile?.profileAccent : '#8d6fc2'} />
              <div><div><strong>{own ? 'You' : event.actorName || 'Spaces Support'}</strong>{official && <em><Icon name="check" size={9}/> VERIFIED</em>}<time>{timeAgo(event.createdAt)}</time></div>{event.body && <p><SupportFormattedTextV77 text={event.body}/></p>}{event.eventType !== 'message' && <small>{event.eventType.replaceAll('_', ' ')}</small>}</div>
            </article>
          })}
        </div>
        {(selected.status === 'resolved' || selected.status === 'archived') ? <div className="support-case-closed-v77"><Icon name="check" size={15}/><span><strong>This case is {selected.status === 'archived' ? 'archived' : 'resolved'}.</strong><small>You can reopen it if you still need help.</small></span><button className="secondary-button compact" disabled={busy} onClick={() => void reopen()}>Reopen</button></div> : <div className="support-member-compose-v77"><textarea value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendReply() } }} placeholder="Reply to Spaces Support…" maxLength={2400}/><button className="primary-button" disabled={busy || !draft.trim()} onClick={() => void sendReply()}><Icon name="send" size={14}/></button></div>}
      </> : <div className="support-member-state-v77"><Icon name="shield" size={22}/><strong>Select a Support case</strong></div>}
    </section>
  </div>
}
