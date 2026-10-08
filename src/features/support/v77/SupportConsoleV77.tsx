import { useCallback, useEffect, useMemo, useState } from 'react'
import { Avatar } from '../../../components/Avatar'
import { ContextMenu, useContextMenu, type ContextAction } from '../../../components/ContextMenu'
import { Icon, type IconName } from '../../../components/Icon'
import { useAppDialog } from '../../../components/AppDialog'
import { useSpaces } from '../../../state/SpacesContext'
import { timeAgo } from '../../../utils/format'
import { platformRoleLabel } from '../../../utils/permissions'
import { SupportOperationsV48 } from '../SupportOperationsV48'
import { SupportFormattedTextV77 } from './SupportFormattedTextV77'
import {
  openProfileV77,
  supportCaseTypeLabelV77,
  supportStatusLabelV77,
  supportV77Request,
  type SupportV77Access,
  type SupportV77Audit,
  type SupportV77Case,
  type SupportV77CaseStatus,
  type SupportV77Restriction,
} from './support-v77-api'

type Tab = 'overview' | 'waiting' | 'reviewing' | 'resolved' | 'archive' | 'user_reports' | 'space_reports' | 'bugs' | 'appeals' | 'accounts' | 'restrictions' | 'audit' | 'staff_chat' | 'team'

type StaffMessage = { id: string; senderUserId: string; senderName: string; body: string; createdAt: number }

const tabs: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'overview', label: 'Overview / Queue', icon: 'shield' },
  { id: 'waiting', label: 'Waiting', icon: 'bell' },
  { id: 'reviewing', label: 'Reviewing', icon: 'activity' },
  { id: 'resolved', label: 'Resolved', icon: 'check' },
  { id: 'archive', label: 'Archive', icon: 'pin' },
  { id: 'user_reports', label: 'User Reports', icon: 'user' },
  { id: 'space_reports', label: 'Space Reports', icon: 'grid' },
  { id: 'bugs', label: 'Bug Reports', icon: 'activity' },
  { id: 'appeals', label: 'Appeals', icon: 'reply' },
  { id: 'accounts', label: 'Accounts', icon: 'members' },
  { id: 'restrictions', label: 'Restrictions', icon: 'lock' },
  { id: 'audit', label: 'Audit Log', icon: 'notes' },
  { id: 'staff_chat', label: 'Staff Chat', icon: 'message' },
  { id: 'team', label: 'Team & Permissions', icon: 'roles' },
]

function statusOrder(status: SupportV77CaseStatus) {
  return status === 'waiting' ? 0 : status === 'reviewing' ? 1 : status === 'resolved' ? 2 : 3
}

export function SupportConsoleV77({ onClose, onOpenSecurity: _onOpenSecurity, mobile = false }: { onClose: () => void; onOpenSecurity?: () => void; mobile?: boolean }) {
  const dialog = useAppDialog()
  const {
    apiUrl, session, profile, pushToast,
    listSupportStaffMessages, sendSupportStaffMessage,
  } = useSpaces()
  const menu = useContextMenu()
  const [access, setAccess] = useState<SupportV77Access | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [cases, setCases] = useState<SupportV77Case[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState<SupportV77Case | null>(null)
  const [restrictions, setRestrictions] = useState<SupportV77Restriction[]>([])
  const [audit, setAudit] = useState<SupportV77Audit[]>([])
  const [staffMessages, setStaffMessages] = useState<StaffMessage[]>([])
  const [staffDraft, setStaffDraft] = useState('')
  const [replyDraft, setReplyDraft] = useState('')
  const [internalDraft, setInternalDraft] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [restrictionTarget, setRestrictionTarget] = useState<{ type: 'user' | 'space' | 'channel'; id: string; label: string; caseId?: string | null } | null>(null)
  const [restrictionCapability, setRestrictionCapability] = useState('send_messages')
  const [restrictionReason, setRestrictionReason] = useState('Repeated rule violations')
  const [restrictionDuration, setRestrictionDuration] = useState('1440')
  const [restrictionNote, setRestrictionNote] = useState('')

  const request = useCallback(<T,>(route: string, init?: RequestInit) => supportV77Request<T>(apiUrl, session?.token, route, init), [apiUrl, session?.token])

  const loadAccess = useCallback(async () => {
    try { setAccess(await request<SupportV77Access>('/v1/support/me')) }
    catch (error) { pushToast(error instanceof Error ? error.message : 'Support access could not load.', 'danger') }
  }, [pushToast, request])

  const loadCases = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const next = await request<SupportV77Case[]>('/v1/support/v77/cases')
      setCases(next.sort((a, b) => statusOrder(a.status) - statusOrder(b.status) || b.lastActivityAt - a.lastActivityAt))
      setSelectedId(current => current && next.some(item => item.id === current) ? current : (next[0]?.id ?? ''))
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not load Support cases.', 'danger')
    } finally { if (!quiet) setLoading(false) }
  }, [pushToast, request])

  const loadDetail = useCallback(async (id: string, quiet = false) => {
    if (!id) { setDetail(null); return }
    try { setDetail(await request<SupportV77Case>(`/v1/support/v77/cases/${encodeURIComponent(id)}`)) }
    catch (error) { if (!quiet) pushToast(error instanceof Error ? error.message : 'Could not load that case.', 'danger') }
  }, [pushToast, request])

  const loadRestrictions = useCallback(async () => {
    try { setRestrictions(await request<SupportV77Restriction[]>('/v1/support/v77/restrictions')) }
    catch (error) { pushToast(error instanceof Error ? error.message : 'Could not load restrictions.', 'danger') }
  }, [pushToast, request])

  const loadAudit = useCallback(async () => {
    try { setAudit(await request<SupportV77Audit[]>('/v1/support/v77/audit')) }
    catch (error) { pushToast(error instanceof Error ? error.message : 'Could not load audit history.', 'danger') }
  }, [pushToast, request])

  useEffect(() => { void loadAccess(); void loadCases(false) }, [loadAccess, loadCases])
  useEffect(() => { if (selectedId) void loadDetail(selectedId) }, [loadDetail, selectedId])
  useEffect(() => { if (tab === 'restrictions') void loadRestrictions(); if (tab === 'audit') void loadAudit() }, [loadAudit, loadRestrictions, tab])
  useEffect(() => {
    if (tab !== 'staff_chat') return
    let cancelled = false
    const load = () => void listSupportStaffMessages().then(items => { if (!cancelled) setStaffMessages(items as StaffMessage[]) }).catch(() => undefined)
    load(); const timer = window.setInterval(load, 5000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [listSupportStaffMessages, tab])
  useEffect(() => {
    const sync = () => void loadCases(true)
    window.addEventListener('spaces-support-v77-changed', sync)
    const timer = window.setInterval(sync, 8000)
    return () => { window.removeEventListener('spaces-support-v77-changed', sync); window.clearInterval(timer) }
  }, [loadCases])

  const counts = useMemo(() => ({
    waiting: cases.filter(item => item.status === 'waiting').length,
    reviewing: cases.filter(item => item.status === 'reviewing').length,
    resolved: cases.filter(item => item.status === 'resolved').length,
    archive: cases.filter(item => item.status === 'archived').length,
    user_reports: cases.filter(item => item.caseType === 'user_report' && item.status !== 'archived').length,
    space_reports: cases.filter(item => item.caseType === 'space_report' && item.status !== 'archived').length,
    bugs: cases.filter(item => item.caseType === 'bug_report' && item.status !== 'archived').length,
    appeals: cases.filter(item => item.caseType === 'appeal' && item.status !== 'archived').length,
  }), [cases])

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase()
    return cases.filter(item => {
      if (tab === 'waiting' && item.status !== 'waiting') return false
      if (tab === 'reviewing' && item.status !== 'reviewing') return false
      if (tab === 'resolved' && item.status !== 'resolved') return false
      if (tab === 'archive' && item.status !== 'archived') return false
      if (tab === 'user_reports' && item.caseType !== 'user_report') return false
      if (tab === 'space_reports' && item.caseType !== 'space_report') return false
      if (tab === 'bugs' && item.caseType !== 'bug_report') return false
      if (tab === 'appeals' && item.caseType !== 'appeal') return false
      if (['accounts','restrictions','audit','staff_chat','team'].includes(tab)) return false
      if (!search) return true
      return `${item.caseNumber} ${item.subject} ${item.reporter.displayName} ${item.reporter.username} ${item.targetUser?.displayName ?? ''} ${item.targetSpaceName ?? ''}`.toLowerCase().includes(search)
    })
  }, [cases, query, tab])

  const selected = detail ?? cases.find(item => item.id === selectedId) ?? null

  async function caseAction(item: SupportV77Case, action: string) {
    setBusy(`${action}:${item.id}`)
    try {
      const next = await request<SupportV77Case>(`/v1/support/v77/cases/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: JSON.stringify({ action }) })
      setDetail(next)
      setSelectedId(next.id)
      await loadCases(true)
      window.dispatchEvent(new Event('spaces-support-v77-changed'))
    } catch (error) { pushToast(error instanceof Error ? error.message : `Could not ${action} that case.`, 'danger') }
    finally { setBusy('') }
  }

  async function sendSupportNotice(item: SupportV77Case) {
    const recipient = item.targetUser ?? item.reporter
    const subject = await dialog.prompt({ title: `Message ${recipient.displayName}`, message: 'Send an official Support Bot notice. You can use <R>, <P>, <Y>, and <G> formatting tokens.', label: 'Subject', initialValue: item.caseType === 'space_report' ? 'Space moderation notice' : `Update about ${item.caseNumber}`, maxLength: 180, confirmText: 'Next' })
    if (!subject) return
    const body = await dialog.prompt({ title: 'Official Support notice', message: 'This creates a member-visible Support case from the Support Bot identity.', label: 'Message', placeholder: '<Y>Please review this notice.</Y>', maxLength: 2400, confirmText: 'Send notice' })
    if (!body) return
    setBusy(`notice:${item.id}`)
    try {
      await request('/v1/support/v77/notices', { method: 'POST', body: JSON.stringify({ recipientUserId: recipient.id, subject, body, targetSpaceId: item.targetSpaceId, reasonCategory: 'Case follow-up' }) })
      pushToast(`Support notice sent to ${recipient.displayName}.`, 'success')
      await loadCases(true)
    } catch (error) { pushToast(error instanceof Error ? error.message : 'Could not send Support notice.', 'danger') }
    finally { setBusy('') }
  }

  async function deleteForever(item: SupportV77Case) {
    if (!access?.founder || item.status !== 'archived') return
    const confirmed = await dialog.confirm({ title: `Delete ${item.caseNumber} forever?`, message: 'This permanently removes the server-side case record, timeline, linked audit entries, collaborators, and any legacy Support backing record. This cannot be undone.', confirmText: 'Delete Forever', danger: true })
    if (!confirmed) return
    setBusy(`delete:${item.id}`)
    try {
      await request<void>(`/v1/support/v77/cases/${encodeURIComponent(item.id)}`, { method: 'DELETE' })
      setDetail(null); setSelectedId(''); await loadCases(true)
      pushToast(`${item.caseNumber} permanently deleted.`, 'success')
      window.dispatchEvent(new Event('spaces-support-v77-changed'))
    } catch (error) { pushToast(error instanceof Error ? error.message : 'Could not permanently delete that case.', 'danger') }
    finally { setBusy('') }
  }

  function actionsFor(item: SupportV77Case): ContextAction[] {
    const isMine = Boolean(access?.id && item.assignedTo === access.id)
    const targetUser = item.targetUser ?? item.reporter
    return [
      { id: 'open', label: 'Open case', icon: 'message', onSelect: () => { setSelectedId(item.id); setDetail(null) } },
      ...(item.status === 'waiting' ? [{ id: 'take', label: 'Take case', note: 'Assign to yourself and begin reviewing', icon: 'check' as const, onSelect: () => caseAction(item, 'take') }] : []),
      ...(isMine && item.status === 'reviewing' ? [{ id: 'release', label: 'Release case', note: 'Return it to Waiting', icon: 'reply' as const, onSelect: () => caseAction(item, 'release') }] : []),
      ...(item.status === 'waiting' ? [{ id: 'reviewing', label: 'Move to Reviewing', icon: 'activity' as const, onSelect: () => caseAction(item, 'reviewing') }] : []),
      ...(['waiting','reviewing'].includes(item.status) ? [{ id: 'resolve', label: 'Mark Resolved', icon: 'check' as const, onSelect: () => caseAction(item, 'resolve') }] : []),
      ...(item.status === 'resolved' ? [{ id: 'archive', label: 'Close & Archive', note: 'Remove from active history without deleting it', icon: 'pin' as const, onSelect: () => caseAction(item, 'archive') }] : []),
      ...(['resolved','archived'].includes(item.status) ? [{ id: 'reopen', label: 'Reopen', icon: 'refresh' as const, onSelect: () => caseAction(item, 'reopen') }] : []),
      { id: 'profile', label: 'View member profile', icon: 'user', onSelect: () => openProfileV77(targetUser.id, targetUser) },
      { id: 'notice', label: 'Message Member', note: 'Send an official Support Bot notice', icon: 'message', onSelect: () => sendSupportNotice(item) },
      { id: 'restrict', label: 'Apply restriction', note: `Moderate ${targetUser.displayName}`, icon: 'lock', onSelect: () => setRestrictionTarget({ type: 'user', id: targetUser.id, label: targetUser.displayName, caseId: item.id }) },
      ...(access?.founder && item.status === 'archived' ? [{ id: 'delete', label: 'Delete Forever', note: 'Founder only · permanent', icon: 'trash' as const, danger: true, onSelect: () => deleteForever(item) }] : []),
    ]
  }

  async function sendCaseEvent(eventType: 'message' | 'note') {
    if (!selected) return
    const value = (eventType === 'message' ? replyDraft : internalDraft).trim()
    if (!value) return
    setBusy(`${eventType}:${selected.id}`)
    try {
      await request(`/v1/support/v77/cases/${encodeURIComponent(selected.id)}/events`, { method: 'POST', body: JSON.stringify({ eventType, body: value }) })
      if (eventType === 'message') setReplyDraft(''); else setInternalDraft('')
      await Promise.all([loadDetail(selected.id, true), loadCases(true)])
      window.dispatchEvent(new Event('spaces-support-v77-changed'))
    } catch (error) { pushToast(error instanceof Error ? error.message : 'Could not send that Support update.', 'danger') }
    finally { setBusy('') }
  }

  function wrapToken(token: 'R' | 'P' | 'Y' | 'G') {
    setReplyDraft(current => `${current}${current && !current.endsWith(' ') ? ' ' : ''}<${token}>text</${token}>`)
  }

  async function applyRestriction() {
    if (!restrictionTarget) return
    const durationMinutes = restrictionDuration === 'permanent' ? null : Number(restrictionDuration)
    setBusy('restriction')
    try {
      await request('/v1/support/v77/restrictions', { method: 'POST', body: JSON.stringify({ targetType: restrictionTarget.type, targetId: restrictionTarget.id, capability: restrictionCapability, reasonCategory: restrictionReason, note: restrictionNote.trim(), durationMinutes, caseId: restrictionTarget.caseId ?? null }) })
      setRestrictionTarget(null); setRestrictionNote(''); await loadRestrictions(); if (selected) await loadDetail(selected.id, true)
      pushToast(`Restriction applied to ${restrictionTarget.label}.`, 'success')
    } catch (error) { pushToast(error instanceof Error ? error.message : 'Could not apply restriction.', 'danger') }
    finally { setBusy('') }
  }

  async function revokeRestriction(item: SupportV77Restriction) {
    setBusy(`revoke:${item.id}`)
    try { await request<void>(`/v1/support/v77/restrictions/${encodeURIComponent(item.id)}`, { method: 'DELETE' }); await loadRestrictions() }
    catch (error) { pushToast(error instanceof Error ? error.message : 'Could not remove restriction.', 'danger') }
    finally { setBusy('') }
  }

  async function sendStaffChat() {
    const body = staffDraft.trim(); if (!body) return
    setBusy('staff-chat')
    try { const sent = await sendSupportStaffMessage(body); setStaffMessages(current => [...current, sent as StaffMessage]); setStaffDraft('') }
    catch (error) { pushToast(error instanceof Error ? error.message : 'Could not send staff message.', 'danger') }
    finally { setBusy('') }
  }

  const operationalTab = !['accounts','restrictions','audit','staff_chat','team'].includes(tab)

  return <div className={`support-console-v77 ${mobile ? 'mobile' : ''}`}>
    <header className="support-console-top-v77">
      <div><span className="support-v77-mark"><Icon name="shield" size={18}/></span><span><small>SPACES TRUST & SAFETY</small><strong>{mobile ? 'Staff Panel' : 'Support Operations'}</strong></span></div>
      <div><button className="icon-button" title="Close Support" onClick={onClose}><Icon name="x" size={15}/></button></div>
    </header>

    <div className="support-console-body-v77">
      <aside className="support-console-nav-v77">
        <div className="support-console-user-v77"><Avatar name={profile?.displayName} initials={profile?.initials} src={profile?.avatarUrl} size={32} accent={profile?.profileAccent}/><span><strong>{profile?.displayName}</strong><small>{profile?.platformRole ? platformRoleLabel(profile.platformRole) : 'Member'}</small></span></div>
        <nav>{tabs.map(item => {
          if (item.id === 'team' && !access?.founder) return null
          const count = item.id in counts ? counts[item.id as keyof typeof counts] : 0
          return <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => { setTab(item.id); if (mobile) setSelectedId('') }}><Icon name={item.icon} size={15}/><span>{item.label}</span>{count > 0 && <b>{count > 99 ? '99+' : count}</b>}</button>
        })}</nav>
      </aside>

      <main className="support-console-main-v77">
        {operationalTab ? <>
          <section className="support-case-column-v77">
            <header><div><span className="eyebrow">{tabs.find(item => item.id === tab)?.label.toUpperCase()}</span><h2>{tab === 'overview' ? 'Support Queue' : tabs.find(item => item.id === tab)?.label}</h2></div><label><Icon name="search" size={14}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search cases, people, Spaces…" /></label></header>
            <div className="support-case-list-v77">
              {loading ? <div className="support-list-loading-v77"><span/><span/><span/></div> : visible.length ? visible.map(item => <button {...menu.bind(item.subject, actionsFor(item), `${item.caseNumber} · ${supportStatusLabelV77(item.status)}`)} key={item.id} className={`support-case-row-v77 ${selectedId === item.id ? 'active' : ''} status-${item.status}`} onClick={() => { setSelectedId(item.id); setDetail(null) }}>
                <span className={`support-case-type-v77 type-${item.caseType}`}><Icon name={item.caseType === 'user_report' ? 'user' : item.caseType === 'space_report' ? 'grid' : item.caseType === 'bug_report' ? 'activity' : item.caseType === 'appeal' ? 'reply' : 'message'} size={14}/></span>
                <span className="support-case-row-copy-v77"><span><strong>{item.subject}</strong><em>{item.priority !== 'normal' ? item.priority : ''}</em></span><small>{item.caseNumber} · {item.reporter.displayName}{item.targetUser ? ` → ${item.targetUser.displayName}` : item.targetSpaceName ? ` → ${item.targetSpaceName}` : ''}</small><small>{item.assignedToName ? `Assigned to ${item.assignedToName}` : 'Unassigned'} · {timeAgo(item.lastActivityAt)}</small></span>
                <span className={`support-status-dot-v77 status-${item.status}`} />
              </button>) : <div className="support-console-empty-v77"><Icon name="check" size={22}/><strong>Nothing here right now</strong><span>This section is clear.</span></div>}
            </div>
          </section>

          <section className={`support-case-inspector-v77 ${selected ? 'open' : ''}`}>
            {selected ? <>
              <header><div><span className="eyebrow">{supportCaseTypeLabelV77(selected.caseType).toUpperCase()}</span><h2>{selected.subject}</h2><small>{selected.caseNumber} · created {timeAgo(selected.createdAt)}</small></div><button className="icon-button support-mobile-back-v77" onClick={() => setSelectedId('')}><Icon name="x" size={13}/></button><button className="icon-button" onClick={event => menu.open(selected.subject, actionsFor(selected), event.clientX, event.clientY, selected.caseNumber)}><Icon name="more" size={16}/></button></header>
              <div className="support-inspector-scroll-v77">
                <div className="support-inspector-status-v77"><span className={`support-status-pill-v77 status-${selected.status}`}>{supportStatusLabelV77(selected.status)}</span><span>{selected.assignedToName ? `Assigned · ${selected.assignedToName}` : 'Unassigned'}</span><span>{selected.priority} priority</span></div>

                <button className="support-person-card-v77" onClick={() => openProfileV77((selected.targetUser ?? selected.reporter).id, selected.targetUser ?? selected.reporter)}><Avatar name={(selected.targetUser ?? selected.reporter).displayName} initials={(selected.targetUser ?? selected.reporter).initials} src={(selected.targetUser ?? selected.reporter).avatarUrl} size={42} accent={(selected.targetUser ?? selected.reporter).profileAccent}/><span><strong>{(selected.targetUser ?? selected.reporter).displayName}</strong><small>@{(selected.targetUser ?? selected.reporter).username} · View full profile</small></span><Icon name="chevron" size={13}/></button>

                {selected.targetSpaceId && <button className="support-target-space-v77" data-spaces-v78-touch-moderation="SPACES_V78_TOUCH_MODERATION"
                  {...menu.bind(selected.targetSpaceName || 'Reported Space', [
                    { id: 'moderate-space-v78', label: 'Moderate Space', note: 'Open restriction controls', icon: 'shield' as const, onSelect: () => setRestrictionTarget({ type: 'space', id: selected.targetSpaceId!, label: selected.targetSpaceName || 'Space', caseId: selected.id }) },
                  ], 'Space actions')}><Icon name="grid" size={15}/><span><strong>{selected.targetSpaceName || 'Reported Space'}</strong><small>{selected.targetChannelName ? `#${selected.targetChannelName}` : 'Space target'} · right-click to moderate</small></span></button>}

                {Object.keys(selected.answers ?? {}).length > 0 && <section className="support-answer-card-v77"><header><Icon name="notes" size={13}/><strong>Structured report</strong></header>{Object.entries(selected.answers).map(([key, value]) => <div key={key}><span>{key.replaceAll('_', ' ')}</span><strong>{String(value)}</strong></div>)}</section>}
                {selected.details && <section className="support-detail-card-v77"><span className="eyebrow">DETAILS</span><p>{selected.details}</p></section>}

                <section className="support-timeline-v77"><header><Icon name="activity" size={13}/><strong>Case timeline</strong></header>{(selected.events ?? []).map(event => <article key={event.id} className={event.actorRole ? 'official' : ''}><span className="support-timeline-node-v77"><Icon name={event.eventType === 'message' ? 'message' : event.eventType === 'note' ? 'notes' : 'activity'} size={11}/></span><div><div><strong>{event.actorName || 'System'}</strong>{event.actorRole && <em>{platformRoleLabel(event.actorRole)}</em>}<time>{timeAgo(event.createdAt)}</time></div>{event.body && <p><SupportFormattedTextV77 text={event.body}/></p>}<small>{event.eventType.replaceAll('_', ' ')}</small></div></article>)}</section>

                <section className="support-reply-box-v77"><header><strong>Official Support reply</strong><span>Sent through the Support Bot identity</span></header><div className="support-token-toolbar-v77"><button onClick={() => wrapToken('R')}>&lt;R&gt; Warning</button><button onClick={() => wrapToken('P')}>&lt;P&gt; Purple</button><button onClick={() => wrapToken('Y')}>&lt;Y&gt; Caution</button><button onClick={() => wrapToken('G')}>&lt;G&gt; Cleared</button></div><textarea value={replyDraft} onChange={event => setReplyDraft(event.target.value)} rows={4} placeholder="Reply to the member…"/><button className="primary-button" disabled={!replyDraft.trim() || Boolean(busy)} onClick={() => void sendCaseEvent('message')}><Icon name="send" size={13}/> Send Support Reply</button></section>
                <section className="support-note-box-v77"><header><strong>Internal note</strong><span>Staff only · never shown to the member</span></header><textarea value={internalDraft} onChange={event => setInternalDraft(event.target.value)} rows={3} placeholder="Add internal context…"/><button className="secondary-button compact" disabled={!internalDraft.trim() || Boolean(busy)} onClick={() => void sendCaseEvent('note')}>Add note</button></section>
              </div>
            </> : <div className="support-console-empty-v77"><Icon name="shield" size={24}/><strong>Select a case</strong><span>The case, member profile, history, and moderation controls will appear here.</span></div>}
          </section>
        </> : tab === 'accounts' ? <div className="support-legacy-host-v77"><SupportOperationsV48 mode="accounts" /></div>
          : tab === 'team' ? <div className="support-legacy-host-v77"><SupportOperationsV48 mode="team" /></div>
          : tab === 'restrictions' ? <section className="support-wide-panel-v77"><header><div><span className="eyebrow">SAFETY</span><h2>Active Restrictions</h2></div><button className="secondary-button compact" onClick={() => void loadRestrictions()}><Icon name="refresh" size={13}/> Refresh</button></header><div className="support-restriction-list-v77">{restrictions.length ? restrictions.map(item => <article key={item.id}><span className="support-case-type-v77"><Icon name="lock" size={14}/></span><div><strong>{item.targetLabel}</strong><small>{item.targetType} · {item.capability.replaceAll('_', ' ')}</small><p>{item.reasonCategory}{item.note ? ` · ${item.note}` : ''}</p><small>{item.expiresAt ? `Expires ${new Date(item.expiresAt).toLocaleString()}` : 'Until removed'} · by {item.createdByName}</small></div><button className="ghost-danger" disabled={busy === `revoke:${item.id}`} onClick={() => void revokeRestriction(item)}>Remove</button></article>) : <div className="support-console-empty-v77"><Icon name="check" size={22}/><strong>No active restrictions</strong></div>}</div></section>
          : tab === 'audit' ? <section className="support-wide-panel-v77"><header><div><span className="eyebrow">ACCOUNTABILITY</span><h2>Audit Log</h2></div><button className="secondary-button compact" onClick={() => void loadAudit()}><Icon name="refresh" size={13}/> Refresh</button></header><div className="support-audit-list-v77">{audit.map(item => <article key={item.id}><span><Icon name="activity" size={13}/></span><div><strong>{item.action.replaceAll('.', ' ')}</strong><small>{item.actorName} · {item.targetLabel || `${item.targetType} ${item.targetId}`}</small><p>{item.reasonCategory}{item.note ? ` · ${item.note}` : ''}</p></div><time>{timeAgo(item.createdAt)}</time></article>)}</div></section>
          : tab === 'staff_chat' ? <section className="support-staff-chat-v77"><header><div><span className="eyebrow">INTERNAL</span><h2>Staff Chat</h2></div></header><div>{staffMessages.map(item => <article key={item.id}><strong>{item.senderName}</strong><p>{item.body}</p><time>{timeAgo(item.createdAt)}</time></article>)}</div><footer><textarea value={staffDraft} onChange={event => setStaffDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendStaffChat() } }} placeholder="Message the Support team…"/><button className="primary-button" disabled={!staffDraft.trim() || busy === 'staff-chat'} onClick={() => void sendStaffChat()}><Icon name="send" size={14}/></button></footer></section>
          : null}
      </main>
    </div>

    {restrictionTarget && <div className="support-restriction-modal-v77"><button aria-label="Close" onClick={() => setRestrictionTarget(null)}/><section><header><div><span className="eyebrow">MODERATE</span><h2>Restrict {restrictionTarget.label}</h2></div><button className="icon-button" onClick={() => setRestrictionTarget(null)}><Icon name="x" size={13}/></button></header><label>Restriction<select value={restrictionCapability} onChange={event => setRestrictionCapability(event.target.value)}>{restrictionTarget.type === 'user' && <><option value="platform_access">Platform access / ban</option><option value="send_messages">View-only · cannot message</option><option value="direct_messages">Direct messages</option><option value="uploads">Uploads / media</option><option value="create_spaces">Create Spaces</option><option value="join_spaces">Join Spaces</option></>}{restrictionTarget.type === 'space' && <><option value="send_messages">Freeze Space posting</option><option value="join_space">Block new joins</option></>}{restrictionTarget.type === 'channel' && <option value="send_messages">Lock channel posting</option>}</select></label><label>Reason<select value={restrictionReason} onChange={event => setRestrictionReason(event.target.value)}><option>Spam</option><option>Harassment</option><option>Unsafe content</option><option>Impersonation</option><option>Scam / fraud</option><option>Repeated rule violations</option><option>Disruptive behavior</option><option>Other</option></select></label><label>Duration<select value={restrictionDuration} onChange={event => setRestrictionDuration(event.target.value)}><option value="60">1 hour</option><option value="480">8 hours</option><option value="1440">24 hours</option><option value="4320">3 days</option><option value="10080">7 days</option><option value="43200">30 days</option><option value="permanent">Until removed</option></select></label><label>Optional staff note<textarea value={restrictionNote} onChange={event => setRestrictionNote(event.target.value)} rows={3}/></label><footer><button className="secondary-button" onClick={() => setRestrictionTarget(null)}>Cancel</button><button className="primary-button" disabled={busy === 'restriction'} onClick={() => void applyRestriction()}><Icon name="lock" size={13}/> Apply restriction</button></footer></section></div>}
    <ContextMenu menu={menu.menu} onClose={menu.close}/>
  </div>
}

export function MobileStaffPanelV77({ onClose }: { onClose: () => void }) {
  return <SupportConsoleV77 mobile onClose={onClose}/>
}
