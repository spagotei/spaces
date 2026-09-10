import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Avatar } from '../../components/Avatar'
import { useAppDialog } from '../../components/AppDialog'
import { useSpaces } from '../../state/SpacesContext'
import type { WorkspaceModerationReport, WorkspaceSupportCase, WorkspaceSupportMessage, WorkspaceSupportUser, WorkspaceSupportStaffMessage, WorkspaceBetaAccessEntry } from '../../types/spaces'
import { platformRoleLabel } from '../../utils/permissions'
import { SupportOperationsV48, useSupportV48Access } from './SupportOperationsV48'
import { formatPublicUserId } from '../../utils/public-id'

type SupportTab = 'queue' | 'players' | 'spaces' | 'bugs' | 'accounts' | 'restrictions' | 'access' | 'team' | 'staff-chat' | 'dms'

const betaTemplateKey = 'spaces.support.beta-email-template.v1'
const defaultBetaSubject = 'You’re in Spaces'
const defaultBetaMessage = 'Your access to the Spaces Public Beta is ready.\n\nSign in with {email} using the temporary password included below. You’ll choose your username after signing in.\n\nYour first sign-in must use the email address this invitation was sent to.\n\nSpaces'

function loadBetaTemplate() {
  try {
    const parsed = JSON.parse(localStorage.getItem(betaTemplateKey) || '{}') as { subject?: string; message?: string }
    return { subject: parsed.subject || defaultBetaSubject, message: parsed.message || defaultBetaMessage }
  } catch { return { subject: defaultBetaSubject, message: defaultBetaMessage } }
}

function friendlyBetaError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || '')
  if (/not found|404/i.test(raw)) return 'Beta access could not connect to the Worker route.'
  return raw || 'Beta access is unavailable right now.'
}

export function SupportConsole({
  onClose,
  onOpenSecurity,
}: {
  onClose: () => void
  onOpenSecurity: () => void
}) {
  const dialog = useAppDialog()
  const {
    profile, pushToast,
    listModerationReports, updateModerationReport, banPlatformUser, unbanPlatformUser,
    listSupportCases, updateSupportCase, listSupportMessages, sendSupportMessage,
    searchSupportUsers, listSupportStaffMessages, sendSupportStaffMessage,
    restrictSupportSpace, unrestrictSupportSpace, deleteSupportSpace,
    listBetaAccess, inviteBetaEmail, revokeBetaAccess,
  } = useSpaces()
  const [tab, setTab] = useState<SupportTab>('queue')
  const [reports, setReports] = useState<WorkspaceModerationReport[]>([])
  const [cases, setCases] = useState<WorkspaceSupportCase[]>([])
  const [messages, setMessages] = useState<WorkspaceSupportMessage[]>([])
  const [supportUsers, setSupportUsers] = useState<WorkspaceSupportUser[]>([])
  const [staffMessages, setStaffMessages] = useState<WorkspaceSupportStaffMessage[]>([])
  const [staffDraft, setStaffDraft] = useState('')
  const [betaAccess, setBetaAccess] = useState<WorkspaceBetaAccessEntry[]>([])
  const [betaEmail, setBetaEmail] = useState('')
  const [betaInviteSubject, setBetaInviteSubject] = useState(() => loadBetaTemplate().subject)
  const [betaInviteMessage, setBetaInviteMessage] = useState(() => loadBetaTemplate().message)
  const [betaTemplateSaved, setBetaTemplateSaved] = useState(() => Boolean(localStorage.getItem(betaTemplateKey)))
  const [betaAccessLoading, setBetaAccessLoading] = useState(false)
  const [betaAccessError, setBetaAccessError] = useState('')
  const [userSearchLoading, setUserSearchLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')

  const allowed = profile?.platformRole === 'founder' || profile?.platformRole === 'staff' || profile?.platformRole === 'support'
  const v48Access = useSupportV48Access()

  async function refresh() {
    if (!allowed) return
    setLoading(true)
    try {
      const [nextReports, nextCases, nextMessages, nextStaffMessages] = await Promise.all([
        listModerationReports(),
        listSupportCases(),
        listSupportMessages(),
        listSupportStaffMessages(),
      ])
      setReports(nextReports)
      setCases(nextCases)
      setMessages(nextMessages)
      setStaffMessages(nextStaffMessages)
      window.dispatchEvent(new Event('spaces-support-queue-changed'))
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not load Support Console.', 'danger')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  useEffect(() => {
    if (tab !== 'accounts') return
    const searchValue = query.trim()
    if (!searchValue) { setSupportUsers([]); setUserSearchLoading(false); return }
    const timer = window.setTimeout(() => {
      setUserSearchLoading(true)
      void searchSupportUsers(searchValue)
        .then(setSupportUsers)
        .catch(error => pushToast(error instanceof Error ? error.message : 'Could not search accounts.', 'danger'))
        .finally(() => setUserSearchLoading(false))
    }, 220)
    return () => window.clearTimeout(timer)
  }, [pushToast, query, searchSupportUsers, tab])

  useEffect(() => {
    if (tab !== 'access') return
    let cancelled = false
    setBetaAccessLoading(true)
    setBetaAccessError('')
    void listBetaAccess()
      .then(items => { if (!cancelled) setBetaAccess(items) })
      .catch(error => { if (!cancelled) { const message = friendlyBetaError(error); setBetaAccessError(message); pushToast(message, 'danger') } })
      .finally(() => { if (!cancelled) setBetaAccessLoading(false) })
    return () => { cancelled = true }
  }, [listBetaAccess, tab])

  async function inviteAccessEmail() {
    const email = betaEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || busyId === 'beta-access') return
    setBusyId('beta-access')
    setBetaAccessError('')
    try {
      const result = await inviteBetaEmail(email, { subject: betaInviteSubject, message: betaInviteMessage })
      setBetaAccess(current => [result.entry, ...current.filter(item => item.id !== result.entry.id)])
      setBetaEmail('')
      pushToast(result.delivery === 'sent' ? 'Beta invite sent.' : 'Beta access approved.', 'success')
    } catch (error) {
      const message = friendlyBetaError(error)
      setBetaAccessError(message)
      pushToast(message, 'danger')
    } finally { setBusyId('') }
  }

  function saveBetaTemplate() {
    const subject = betaInviteSubject.trim()
    const message = betaInviteMessage.trim()
    if (!subject || !message) return
    localStorage.setItem(betaTemplateKey, JSON.stringify({ subject, message }))
    setBetaTemplateSaved(true)
    pushToast('Invite email saved.', 'success')
  }

  async function removeAccess(entry: WorkspaceBetaAccessEntry) {
    if (!await dialog.confirm({ title: `Revoke ${entry.email}?`, message: 'This removes unused beta access for this email. Existing accounts are not deleted.', confirmText: 'Revoke access', danger: true })) return
    setBusyId(`access-${entry.id}`)
    try {
      await revokeBetaAccess(entry.id)
      setBetaAccess(current => current.map(item => item.id === entry.id ? { ...item, status: 'revoked' } : item))
    } catch (error) { pushToast(error instanceof Error ? error.message : 'Could not revoke access.', 'danger') }
    finally { setBusyId('') }
  }

  useEffect(() => {
    if (tab !== 'staff-chat') return
    let cancelled = false
    const load = () => void listSupportStaffMessages().then(items => { if (!cancelled) setStaffMessages(items) }).catch(() => undefined)
    load()
    const timer = window.setInterval(load, 5000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [listSupportStaffMessages, tab])

  const openPlayerReports = reports.filter(item => item.status === 'open' || item.status === 'reviewed')
  const openCases = cases.filter(item => item.status === 'open' || item.status === 'reviewed')
  const search = query.trim().toLowerCase()
  const visibleReports = useMemo(() => reports.filter(item => {
    if (tab === 'queue' && !['open', 'reviewed'].includes(item.status)) return false
    if (tab !== 'queue' && tab !== 'players') return false
    if (!search) return true
    const target = item.snapshot.reported
    return `${item.reason} ${item.details} ${target.displayName} ${target.username} ${item.snapshot.reporter.displayName}`.toLowerCase().includes(search)
  }), [reports, search, tab])
  const visibleCases = useMemo(() => cases.filter(item => {
    if (tab === 'queue' && !['open', 'reviewed'].includes(item.status)) return false
    if (tab === 'spaces' && item.kind !== 'space') return false
    if (tab === 'bugs' && item.kind !== 'bug') return false
    if (!['queue', 'spaces', 'bugs'].includes(tab)) return false
    if (!search) return true
    return `${item.subject} ${item.details} ${item.reporterName} ${item.targetWorkspaceName ?? ''}`.toLowerCase().includes(search)
  }), [cases, search, tab])

  async function sendDm(recipientUserId: string, defaultSubject: string, caseId?: string | null) {
    const subject = await dialog.prompt({
      title: 'Support DM subject',
      message: 'This appears as an official Spaces Support notification for the recipient.',
      label: 'Subject',
      initialValue: defaultSubject,
      maxLength: 120,
      confirmText: 'Next',
    })
    if (!subject) return
    const body = await dialog.prompt({
      title: 'Write Support DM',
      message: 'Keep the notice clear and specific. It is stored in the Support audit history.',
      label: 'Message',
      placeholder: 'There was action taken against… / Please review…',
      maxLength: 1200,
      confirmText: 'Send Support DM',
    })
    if (!body) return
    setBusyId(`dm-${recipientUserId}`)
    try {
      const sent = await sendSupportMessage({ recipientUserId, subject, body, caseId })
      setMessages(current => [sent, ...current])
      pushToast('Support DM sent.', 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not send Support DM.', 'danger')
    } finally { setBusyId('') }
  }

  async function handleBan(report: WorkspaceModerationReport) {
    const target = report.snapshot.reported
    const reason = await dialog.prompt({ title: `Ban ${target.displayName}?`, message: 'This signs the account out and blocks future Spaces login until unbanned.', label: 'Moderation reason', initialValue: report.reason, maxLength: 800, danger: true, confirmText: 'Continue' })
    if (!reason) return
    if (!await dialog.confirm({ title: 'Confirm platform ban', message: `Ban @${target.username} from Spaces? This action is audit logged.`, confirmText: 'Ban account', danger: true })) return
    setBusyId(report.id)
    try { await banPlatformUser(target.id, reason, report.id); await refresh() }
    catch (error) { pushToast(error instanceof Error ? error.message : 'Could not ban account.', 'danger') }
    finally { setBusyId('') }
  }

  async function markReport(reportId: string, status: 'reviewed' | 'dismissed') {
    setBusyId(reportId)
    try { await updateModerationReport(reportId, status); await refresh() }
    catch (error) { pushToast(error instanceof Error ? error.message : 'Could not update report.', 'danger') }
    finally { setBusyId('') }
  }

  async function changeCase(item: WorkspaceSupportCase, status: 'reviewed' | 'resolved' | 'dismissed', assignToMe = false) {
    setBusyId(item.id)
    try {
      const next = await updateSupportCase(item.id, { status, assignToMe })
      setCases(current => current.map(entry => entry.id === next.id ? next : entry))
    } catch (error) { pushToast(error instanceof Error ? error.message : 'Could not update case.', 'danger') }
    finally { setBusyId('') }
  }

  async function restrictCase(item: WorkspaceSupportCase) {
    if (!item.targetWorkspaceId) return
    const reason = await dialog.prompt({ title: `Restrict ${item.targetWorkspaceName ?? 'Space'}?`, message: 'Restriction makes the Space read-only for normal members while Support reviews it.', label: 'Reason', initialValue: item.subject, maxLength: 900, danger: true, confirmText: 'Restrict Space' })
    if (!reason) return
    setBusyId(item.id)
    try {
      await restrictSupportSpace(item.targetWorkspaceId, reason)
      const next = await updateSupportCase(item.id, { status: 'actioned', assignToMe: true })
      setCases(current => current.map(entry => entry.id === next.id ? { ...next, restricted: true } : entry))
    } catch (error) { pushToast(error instanceof Error ? error.message : 'Could not restrict Space.', 'danger') }
    finally { setBusyId('') }
  }

  async function unrestrictCase(item: WorkspaceSupportCase) {
    if (!item.targetWorkspaceId) return
    setBusyId(item.id)
    try { await unrestrictSupportSpace(item.targetWorkspaceId); await refresh() }
    catch (error) { pushToast(error instanceof Error ? error.message : 'Could not remove restriction.', 'danger') }
    finally { setBusyId('') }
  }

  async function removeSpace(item: WorkspaceSupportCase) {
    if (!item.targetWorkspaceId || !item.targetWorkspaceName) return
    const reason = await dialog.prompt({ title: `Delete ${item.targetWorkspaceName}?`, message: 'This is a permanent platform moderation action. Add the reason first.', label: 'Deletion reason', maxLength: 900, danger: true, confirmText: 'Continue' })
    if (!reason) return
    const confirm = await dialog.prompt({ title: 'Permanent Space deletion', message: 'All channels, messages, notes, roles and membership for this Space will be removed.', label: 'Type the exact Space name', requiredText: item.targetWorkspaceName, danger: true, confirmText: 'Delete Space' })
    if (confirm !== item.targetWorkspaceName) return
    setBusyId(item.id)
    try {
      await deleteSupportSpace(item.targetWorkspaceId, item.targetWorkspaceName, reason)
      await updateSupportCase(item.id, { status: 'actioned', assignToMe: true })
      await refresh()
    } catch (error) { pushToast(error instanceof Error ? error.message : 'Could not delete Space.', 'danger') }
    finally { setBusyId('') }
  }

  async function sendStaffChat() {
    const body = staffDraft.trim()
    if (!body || busyId === 'staff-chat') return
    setBusyId('staff-chat')
    try {
      const sent = await sendSupportStaffMessage(body)
      setStaffMessages(current => [...current, sent])
      setStaffDraft('')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not send staff message.', 'danger')
    } finally { setBusyId('') }
  }

  async function banSupportUser(user: WorkspaceSupportUser) {
    if (user.banned) {
      setBusyId(`user-${user.id}`)
      try { await unbanPlatformUser(user.id); setSupportUsers(current => current.map(item => item.id === user.id ? { ...item, banned: false } : item)) }
      catch (error) { pushToast(error instanceof Error ? error.message : 'Could not remove account ban.', 'danger') }
      finally { setBusyId('') }
      return
    }
    const reason = await dialog.prompt({ title: `Ban ${user.displayName}?`, message: `Spaces ID ${formatPublicUserId(user.publicUserId)}. This action is audit logged.`, label: 'Moderation reason', maxLength: 800, danger: true, confirmText: 'Ban account' })
    if (!reason) return
    setBusyId(`user-${user.id}`)
    try { await banPlatformUser(user.id, reason); setSupportUsers(current => current.map(item => item.id === user.id ? { ...item, banned: true } : item)) }
    catch (error) { pushToast(error instanceof Error ? error.message : 'Could not ban account.', 'danger') }
    finally { setBusyId('') }
  }

  if (!allowed) return null

  return <>
    <button className="support-console-scrim support-console-scrim-v17" aria-label="Close Support Console" onPointerDown={onClose}/>
    <section className="support-console support-console-v17" role="dialog" aria-modal="true" aria-label="Spaces Support Console">
      <header className="support-console-header support-console-header-v17">
        <span className="support-console-mark"><Icon name="shield" size={19}/></span>
        <div><span className="eyebrow">PLATFORM OPERATIONS</span><h2>Support Console</h2><p>Reports, account lookup, Space enforcement, staff chat and Support DMs.</p></div>
        <div className="support-header-actions"><span className={`support-role-badge platform-${profile?.platformRole ?? 'support'}`}><Icon name="shield" size={11}/>{platformRoleLabel(profile?.platformRole ?? 'support')}</span><button className="icon-button" onClick={onClose} aria-label="Close"><Icon name="x" size={15}/></button></div>
      </header>

      <div className="support-console-layout-v17">
        <nav className="support-console-nav-v17">
          <div className="support-console-nav-stats"><strong>{openPlayerReports.length + openCases.length}</strong><span>open items</span></div>
          {([
            ['queue', 'Queue', 'activity'], ['players', 'Player reports', 'members'], ['spaces', 'Space reports', 'grid'], ['bugs', 'Bug reports', 'sparkle'], ['accounts', 'Accounts', 'user'], ['restrictions', 'Restrictions', 'lock'], ['access', 'Beta access', 'lock'], ['team', 'Team', 'members'], ['staff-chat', 'Staff chat', 'chat'], ['dms', 'Support DMs', 'message'],
          ] as const).filter(([id]) => {
            if (id === 'team') return v48Access.founder
            if (id === 'access') return v48Access.can('manage_beta_access')
            if (id === 'accounts' || id === 'restrictions') return v48Access.can('view_accounts')
            if (id === 'staff-chat') return v48Access.can('staff_chat')
            if (id === 'dms') return v48Access.can('send_support_dms')
            if (id === 'bugs') return v48Access.can('view_reports') || v48Access.can('manage_bugs')
            return v48Access.can('view_reports')
          }).map(([id, label, icon]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon name={icon} size={15}/><span>{label}</span>{id === 'players' && <small>{reports.length}</small>}{id === 'spaces' && <small>{cases.filter(item => item.kind === 'space').length}</small>}{id === 'bugs' && <small>{cases.filter(item => item.kind === 'bug').length}</small>}</button>)}
          <div className="support-console-nav-bottom"><button onClick={onOpenSecurity}><Icon name="lock" size={14}/><span>My security</span></button><div><Icon name="shield" size={13}/><span>Founder, Staff & Support only</span></div></div>
        </nav>

        <main className="support-console-main-v17">
          <div className="support-console-toolbar-v17">
            <div><span className="eyebrow">{tab === 'queue' ? 'ACTIVE QUEUE' : tab === 'staff-chat' ? 'PRIVATE OPERATIONS' : tab.toUpperCase()}</span><h3>{tab === 'queue' ? 'Needs attention' : tab === 'players' ? 'Player reports' : tab === 'spaces' ? 'Space reports' : tab === 'bugs' ? 'Bug reports' : tab === 'accounts' ? 'Account inspector' : tab === 'restrictions' ? 'Restrictions' : tab === 'access' ? 'Beta access' : tab === 'team' ? 'Team management' : tab === 'staff-chat' ? 'Staff chat' : 'Support message history'}</h3></div>
            {!['dms','staff-chat','access','accounts','restrictions','team'].includes(tab) && <label><Icon name="search" size={14}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={tab === 'accounts' ? 'Search #ID, username or display name…' : 'Search cases, people, Spaces…'}/></label>}
            <button className="secondary-button compact" onClick={() => void refresh()}><Icon name="activity" size={13}/> Refresh</button>
          </div>

          {loading ? <div className="support-console-loading support-console-loading-v17">Loading Support operations…</div> : (tab === 'restrictions' || tab === 'team') ? <SupportOperationsV48 mode={tab}/> : tab === 'access' ? <div className="support-beta-access-v33">
            <section className="support-beta-invite-v33">
              <div><span className="eyebrow">LOCKED ACCESS</span><h4>Invite an email</h4><p>Approve the exact email the person must use for their first sign-in.</p></div>
              <div className="support-beta-invite-form-v33"><label className="input-shell"><Icon name="lock" size={14}/><input type="email" value={betaEmail} onChange={event => setBetaEmail(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void inviteAccessEmail() } }} placeholder="name@example.com"/></label><button className="primary-button" disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(betaEmail.trim()) || !betaInviteSubject.trim() || !betaInviteMessage.trim() || busyId === 'beta-access'} onClick={() => void inviteAccessEmail()}><Icon name="send" size={13}/>{busyId === 'beta-access' ? 'Approving…' : 'Approve & send'}</button></div>
              <div className="support-beta-message-v33 support-beta-message-editor-v35">
                <div className="support-beta-message-head-v35"><strong>Invite email</strong><span>Use <code>{'{email}'}</code> to insert the approved address.</span></div>
                <label><span>Subject</span><input className="text-input" maxLength={120} value={betaInviteSubject} onChange={event => { setBetaInviteSubject(event.target.value); setBetaTemplateSaved(false) }} /></label>
                <label><span>Message</span><textarea className="text-area" rows={7} maxLength={1800} value={betaInviteMessage} onChange={event => { setBetaInviteMessage(event.target.value); setBetaTemplateSaved(false) }} /></label>
                <div className="support-beta-template-actions-v37"><button className="secondary-button compact" disabled={betaTemplateSaved || !betaInviteSubject.trim() || !betaInviteMessage.trim()} onClick={saveBetaTemplate}><Icon name="check" size={12}/>{betaTemplateSaved ? 'Saved' : 'Save email template'}</button><span>Saved templates stay here for future beta invites.</span></div>
              </div>
            </section>
            <section className="support-beta-list-v33">
              <header><div><span className="eyebrow">ACCESS LIST</span><h4>Approved emails</h4></div><span>{betaAccess.length}</span></header>
              {betaAccessError && <div className="support-beta-notice-v37"><Icon name="activity" size={13}/><div><strong>Could not load beta access</strong><span>{betaAccessError}</span></div><button onClick={() => { setBetaAccessError(''); setTab('queue'); window.setTimeout(() => setTab('access'), 0) }}>Retry</button></div>}
              {betaAccessLoading ? <div className="support-console-loading support-console-loading-v17">Loading beta access…</div> : betaAccess.map(entry => <article key={entry.id}><div><strong>{entry.email}</strong><span>{entry.username ? `@${entry.username}` : entry.status === 'claimed' ? 'Account created' : entry.status === 'revoked' ? 'Access revoked' : 'Waiting for first sign-in'}</span></div><span className={`support-beta-status-v33 status-${entry.status}`}>{entry.status}</span><time>{new Date(entry.createdAt).toLocaleDateString()}</time>{entry.status === 'invited' && <button className="danger-soft" disabled={busyId === `access-${entry.id}`} onClick={() => void removeAccess(entry)}>Revoke</button>}</article>)}
              {!betaAccessLoading && !betaAccess.length && !betaAccessError && <SupportEmpty icon="check" title="No beta invites yet" note="Approved emails will appear here."/>}
            </section>
          </div> : tab === 'dms' ? <div className="support-dm-history-v17">
            {messages.map(message => <article key={message.id}><span className="support-dm-icon"><Icon name="message" size={14}/></span><div><header><strong>{message.subject}</strong><small>{new Date(message.createdAt).toLocaleString()}</small></header><p>{message.body}</p><footer><span>To {message.recipientName}</span><span>by {message.senderName}</span>{message.caseId && <span>Case {message.caseId.slice(0, 8)}</span>}</footer></div></article>)}
            {!messages.length && <SupportEmpty icon="message" title="No Support DMs yet" note="Official messages sent from Support will appear here."/>}
          </div> : tab === 'accounts' ? <><SupportOperationsV48 mode="accounts"/><div className="support-account-results-v21 support-v48-legacy-hidden">
            {!query.trim() ? <div className="support-account-helper-v21"><div><Icon name="search" size={22}/><h4>Find an account</h4><p>Search a Spaces ID, username, or display name.</p></div></div> : userSearchLoading ? <div className="support-console-loading support-console-loading-v17">Searching accounts…</div> : <div className="support-account-list-v21">
              {supportUsers.map(user => <article className="support-account-row-v21" key={user.id}><Avatar name={user.displayName} src={user.avatarUrl} size={40}/><div className="support-account-copy-v21"><strong>{user.displayName}</strong><span>@{user.username} · {user.spaceCount} Space{user.spaceCount === 1 ? '' : 's'}</span><code>{formatPublicUserId(user.publicUserId)}</code><span className={`support-account-state-v21 ${user.banned ? 'banned' : ''}`}>{user.banned ? 'BANNED' : user.platformRole ? platformRoleLabel(user.platformRole) : 'MEMBER'}</span></div><div className="support-account-actions-v21"><button onClick={() => void navigator.clipboard?.writeText(user.publicUserId)}><Icon name="copy" size={12}/> Copy ID</button><button onClick={() => void sendDm(user.id, 'Please review a Spaces Support notice')}><Icon name="message" size={12}/> Support DM</button><button className={user.banned ? '' : 'danger-soft'} disabled={busyId === `user-${user.id}`} onClick={() => void banSupportUser(user)}>{user.banned ? 'Unban' : 'Ban'}</button></div></article>)}
              {!supportUsers.length && <SupportEmpty icon="check" title="No matching account" note="Try the exact Spaces ID, username, or another display name."/>}
            </div>}
          </div></> : tab === 'staff-chat' ? <div className="support-staff-chat-v21">
            <div className="support-staff-chat-feed-v21">{staffMessages.map(message => <article className={`support-staff-message-v21 ${message.senderUserId === profile?.id ? 'own' : ''}`} key={message.id}><header><strong>{message.senderName}</strong><code>{formatPublicUserId(message.senderPublicUserId)}</code><span className={`support-role-badge platform-${message.senderPlatformRole ?? 'support'}`}>{platformRoleLabel(message.senderPlatformRole ?? 'support')}</span><time>{new Date(message.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</time></header><p>{message.body}</p></article>)}{!staffMessages.length && <SupportEmpty icon="message" title="Staff chat is quiet" note="Founder, Staff and Support can coordinate here."/>}</div>
            <div className="support-staff-chat-compose-v21"><textarea className="text-area" maxLength={1600} value={staffDraft} onChange={event => setStaffDraft(event.target.value)} placeholder="Message Founder, Staff and Support…" onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendStaffChat() } }}/><button className="primary-button" disabled={!staffDraft.trim() || busyId === 'staff-chat'} onClick={() => void sendStaffChat()}><Icon name="send" size={13}/> Send</button></div>
          </div> : <div className="support-case-list-v17">
            {visibleReports.map(report => {
              const target = report.snapshot.reported
              const reporter = report.snapshot.reporter
              return <article className="support-case-card-v17 player" key={report.id}>
                <header><span className="support-case-type-v17"><Icon name="members" size={13}/> PLAYER</span><span className={`support-case-status-v17 status-${report.status}`}>{report.status}</span><time>{new Date(report.createdAt).toLocaleString()}</time></header>
                <div className="support-case-body-v17"><div><h4>{report.reason}</h4><p>{report.details || 'No additional details supplied.'}</p><div className="support-case-meta-v17"><span>Reported: <strong>{target.displayName}</strong> @{target.username}</span><span>Reporter: <strong>{reporter.displayName}</strong> @{reporter.username}</span>{report.workspaceId && <button className="support-inline-id-v31" onClick={() => void navigator.clipboard?.writeText(report.workspaceId ?? '')}><Icon name="copy" size={11}/>Space ID {report.workspaceId}</button>}</div>{report.snapshot.messages.length > 0 && <div className="support-evidence-v31"><span className="eyebrow">RECENT CONTEXT</span>{report.snapshot.messages.slice(0, 4).map((message, index) => <article key={`${message.workspaceId}-${message.createdAt}-${index}`}><header><strong>{message.workspaceName}</strong><span>#{message.channelName}</span><time>{new Date(message.createdAt).toLocaleString()}</time></header><p>{message.body}</p></article>)}</div>}</div><div className="support-case-target-v17"><strong>{target.displayName}</strong><span>@{target.username}</span><small>{report.isBanned ? 'BANNED' : target.platformRole ? platformRoleLabel(target.platformRole) : 'Member'}</small></div></div>
                <footer className="support-case-actions-v17"><button disabled={busyId === report.id} onClick={() => void sendDm(target.id, report.isBanned ? 'Action taken on your Spaces account' : 'Please review a Spaces Support notice', report.id)}><Icon name="message" size={13}/> Support DM</button>{v48Access.can('ban_users') && (!report.isBanned ? <button className="danger-soft" disabled={busyId === report.id} onClick={() => void handleBan(report)}><Icon name="lock" size={13}/> Ban</button> : <button disabled={busyId === report.id} onClick={() => void unbanPlatformUser(target.id).then(refresh)}><Icon name="shield" size={13}/> Unban</button>)}<button disabled={busyId === report.id} onClick={() => void markReport(report.id, 'reviewed')}>Review</button><button disabled={busyId === report.id} onClick={() => void markReport(report.id, 'dismissed')}>Dismiss</button></footer>
              </article>
            })}

            {visibleCases.map(item => <article className={`support-case-card-v17 ${item.kind}`} key={item.id}>
              <header><span className="support-case-type-v17"><Icon name={item.kind === 'space' ? 'grid' : 'sparkle'} size={13}/>{item.kind === 'space' ? 'SPACE' : 'BUG'}</span><span className={`support-priority-v17 priority-${item.priority}`}>{item.priority}</span><span className={`support-case-status-v17 status-${item.status}`}>{item.status}</span><time>{new Date(item.createdAt).toLocaleString()}</time></header>
              <div className="support-case-body-v17"><div><h4>{item.subject}</h4><p>{item.details}</p><div className="support-case-meta-v17"><span>Reporter: <strong>{item.reporterName}</strong> @{item.reporterUsername}</span>{item.targetWorkspaceId && <button className="support-inline-id-v31" onClick={() => void navigator.clipboard?.writeText(item.targetWorkspaceId ?? '')}><Icon name="copy" size={11}/>Space ID {item.targetWorkspaceId}</button>}{item.assignedToName && <span>Assigned: {item.assignedToName}</span>}</div></div>{item.kind === 'space' && <div className="support-case-target-v17"><strong>{item.targetWorkspaceName ?? 'Deleted Space'}</strong><span>Owner: {item.targetWorkspaceOwnerName ?? 'Unknown'}</span><small>{item.restricted ? 'RESTRICTED' : 'ACTIVE'}</small></div>}</div>
              <footer className="support-case-actions-v17">
                <button disabled={busyId === item.id} onClick={() => void sendDm(item.kind === 'space' ? (item.targetWorkspaceOwnerId ?? item.reporterId) : item.reporterId, item.kind === 'space' ? `Regarding ${item.targetWorkspaceName ?? 'your Space'}` : `Regarding bug report: ${item.subject}`, item.id)}><Icon name="message" size={13}/> Support DM</button>
                {v48Access.can('space_restrict') && item.kind === 'space' && item.targetWorkspaceId && (!item.restricted ? <button className="danger-soft" disabled={busyId === item.id} onClick={() => void restrictCase(item)}><Icon name="lock" size={13}/> Restrict</button> : <button disabled={busyId === item.id} onClick={() => void unrestrictCase(item)}><Icon name="shield" size={13}/> Unrestrict</button>)}
                {v48Access.can('delete_space') && item.kind === 'space' && item.targetWorkspaceId && <button className="danger-soft" disabled={busyId === item.id} onClick={() => void removeSpace(item)}><Icon name="trash" size={13}/> Delete Space</button>}
                <button disabled={busyId === item.id} onClick={() => void changeCase(item, 'reviewed', true)}>Take case</button><button disabled={busyId === item.id} onClick={() => void changeCase(item, 'resolved', true)}>Resolve</button><button disabled={busyId === item.id} onClick={() => void changeCase(item, 'dismissed')}>Dismiss</button>
              </footer>
            </article>)}

            {!visibleReports.length && !visibleCases.length && <SupportEmpty icon="check" title="Queue is clear" note="Nothing matches this view right now."/>}
          </div>}
        </main>
      </div>
    </section>
  </>
}

function SupportEmpty({ icon, title, note }: { icon: 'message' | 'check'; title: string; note: string }) {
  return <div className="support-empty-v17"><Icon name={icon} size={22}/><strong>{title}</strong><span>{note}</span></div>
}
