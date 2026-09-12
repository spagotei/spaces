import { useEffect, useMemo, useState } from 'react'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { useAppDialog } from '../../components/AppDialog'
import { useSpaces } from '../../state/SpacesContext'
import { formatPublicUserId } from '../../utils/public-id'
import { platformRoleLabel } from '../../utils/permissions'
import type { WorkspaceSupportUser } from '../../types/spaces'

export type SupportCapabilityV48 =
  | 'view_reports' | 'manage_reports' | 'manage_bugs' | 'view_accounts'
  | 'view_verified_emails' | 'send_support_dms' | 'ban_users' | 'chat_restrict'
  | 'space_create_restrict' | 'space_join_restrict' | 'space_restrict'
  | 'delete_space' | 'reset_identity' | 'view_audit' | 'manage_beta_access' | 'staff_chat'

type AccessState = { role: 'founder' | 'staff' | 'support' | null; permissions: SupportCapabilityV48[]; founder: boolean; loading: boolean }
type TeamEntry = { id: string; publicUserId: string; username: string; displayName: string; avatarUrl: string | null; platformRole: 'founder' | 'staff' | 'support' | null; email: string | null; emailVerified: boolean; createdAt: number; permissions: SupportCapabilityV48[]; customPermissions: boolean }
type RestrictionItem = { source: 'ban' | 'restriction' | 'space'; id: string; kind: 'ban' | 'chat' | 'space_create' | 'space_join' | 'space'; userId?: string; publicUserId?: string; username?: string; displayName?: string; avatarUrl?: string | null; email?: string | null; emailVerified?: boolean; workspaceId?: string; workspaceName?: string; reason: string; createdBy?: string; createdByName: string; createdAt: number; expiresAt: number | null; active: boolean; revokedAt?: number | null }
type Inspector = {
  profile: { id: string; publicUserId: string; username: string; displayName: string; avatarUrl: string | null; platformRole: 'founder' | 'staff' | 'support' | null; createdAt: number; bio: string }
  security: { email: string | null; emailVerified: boolean; emailVisible: boolean; twoFactorEnabled: boolean }
  memberships: { workspaceId: string; workspaceName: string; role: string; joinedAt: number }[]
  restrictions: { source: 'ban' | 'restriction'; id: string; kind: string; reason: string; createdAt: number; expiresAt: number | null; active: boolean }[]
  reports: { id: string; reason: string; details: string; status: string; workspace_id?: string; created_at: number }[]
  cases: { id: string; kind: string; subject: string; details: string; status: string; created_at: number }[]
  supportMessages: { id: string; subject: string; body: string; created_at: number }[]
  moderationActions: { id: string; moderatorName: string; action: string; reason: string; createdAt: number }[]
}

const ALL_CAPABILITIES: { id: SupportCapabilityV48; label: string; note: string }[] = [
  { id: 'view_reports', label: 'View reports', note: 'Player, Space and bug report queues' },
  { id: 'manage_reports', label: 'Manage reports', note: 'Review, assign, resolve and dismiss reports' },
  { id: 'manage_bugs', label: 'Manage bugs', note: 'Work structured bug reports' },
  { id: 'view_accounts', label: 'View accounts', note: 'Search and inspect member accounts' },
  { id: 'view_verified_emails', label: 'View verified emails', note: 'Only verified addresses; never verification codes' },
  { id: 'send_support_dms', label: 'Send Support DMs', note: 'Official audited Support messages' },
  { id: 'ban_users', label: 'Ban / unban', note: 'Timed or permanent platform bans' },
  { id: 'chat_restrict', label: 'Restrict chat', note: 'Block sending messages while preserving login' },
  { id: 'space_create_restrict', label: 'Restrict Space creation', note: 'Block creating new Spaces' },
  { id: 'space_join_restrict', label: 'Restrict Space joining', note: 'Block joining new Spaces' },
  { id: 'space_restrict', label: 'Restrict Spaces', note: 'Place a Space into Support read-only restriction' },
  { id: 'delete_space', label: 'Delete Spaces', note: 'Permanent Space removal' },
  { id: 'reset_identity', label: 'Reset identity', note: 'Platform identity moderation tools' },
  { id: 'view_audit', label: 'View audit history', note: 'See moderation history attached to accounts' },
  { id: 'manage_beta_access', label: 'Manage Beta access', note: 'Approve and revoke private-beta invitations' },
  { id: 'staff_chat', label: 'Staff chat', note: 'Founder / Staff / Support coordination' },
]

function fallbackPermissions(role: AccessState['role']): SupportCapabilityV48[] {
  if (role === 'founder' || role === 'staff') return ALL_CAPABILITIES.map(item => item.id)
  if (role === 'support') return ['view_reports','manage_reports','manage_bugs','view_accounts','send_support_dms','staff_chat']
  return []
}

async function v48Request<T>(apiUrl: string, token: string, route: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}${route}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  })
  if (!response.ok) {
    let message = `Request failed (${response.status}).`
    try { const body = await response.json() as { error?: string; message?: string }; message = body.error || body.message || message } catch { /* ignore */ }
    throw new Error(message)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function useSupportV48Access() {
  const { apiUrl, session, profile } = useSpaces()
  const baseRole = profile?.platformRole ?? null
  const [state, setState] = useState<AccessState>(() => ({ role: baseRole, founder: baseRole === 'founder', permissions: fallbackPermissions(baseRole), loading: true }))

  useEffect(() => {
    if (!session?.token || !baseRole) return
    let cancelled = false
    void v48Request<Omit<AccessState, 'loading'>>(apiUrl, session.token, '/v1/support/me')
      .then(value => { if (!cancelled) setState({ ...value, loading: false }) })
      .catch(() => { if (!cancelled) setState({ role: baseRole, founder: baseRole === 'founder', permissions: fallbackPermissions(baseRole), loading: false }) })
    return () => { cancelled = true }
  }, [apiUrl, baseRole, session?.token])

  return {
    ...state,
    can: (capability: SupportCapabilityV48) => state.founder || state.permissions.includes(capability),
  }
}

function durationLabel(item: { expiresAt: number | null; active: boolean }) {
  if (!item.active) return 'Inactive'
  if (!item.expiresAt) return 'Permanent'
  const ms = item.expiresAt - Date.now()
  if (ms <= 0) return 'Expired'
  const hours = Math.ceil(ms / 3_600_000)
  if (hours < 48) return `${hours}h remaining`
  return `${Math.ceil(hours / 24)}d remaining`
}

function durationMinutesFromInput(value: string): number | null {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '')
  if (!normalized || ['permanent','perm','forever'].includes(normalized)) return null
  const presets: Record<string, number> = { '1h': 60, '12h': 720, '1d': 1440, '7d': 10080, '30d': 43200 }
  if (presets[normalized]) return presets[normalized]
  const numeric = Number(normalized)
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null
}

export function SupportOperationsV48({ mode }: { mode: 'accounts' | 'restrictions' | 'team' }) {
  const dialog = useAppDialog()
  const { apiUrl, session, searchSupportUsers, pushToast } = useSpaces()
  const access = useSupportV48Access()
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<WorkspaceSupportUser[]>([])
  const [searching, setSearching] = useState(false)
  const [inspector, setInspector] = useState<Inspector | null>(null)
  const [inspecting, setInspecting] = useState(false)
  const [team, setTeam] = useState<TeamEntry[]>([])
  const [restrictions, setRestrictions] = useState<RestrictionItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [busy, setBusy] = useState('')
  const [permissionTarget, setPermissionTarget] = useState<TeamEntry | null>(null)
  const [permissionDraft, setPermissionDraft] = useState<SupportCapabilityV48[]>([])
  const [spaceId, setSpaceId] = useState('')

  const token = session?.token ?? ''
  const request = <T,>(route: string, init?: RequestInit) => v48Request<T>(apiUrl, token, route, init)

  async function loadTeam() {
    if (!token || !access.founder) return
    try { setTeam(await request<TeamEntry[]>('/v1/support/team')) }
    catch (error) { pushToast(error instanceof Error ? error.message : 'Could not load Support team.', 'danger') }
  }

  async function loadRestrictions() {
    if (!token || !access.can('view_accounts')) return
    try { setRestrictions(await request<RestrictionItem[]>('/v1/support/restrictions')) }
    catch (error) { pushToast(error instanceof Error ? error.message : 'Could not load restrictions.', 'danger') }
  }

  useEffect(() => { if (mode === 'team') void loadTeam(); if (mode === 'restrictions') void loadRestrictions() }, [mode, token, access.founder])

  useEffect(() => {
    if (!['accounts','team'].includes(mode)) return
    const value = query.trim()
    if (!value) { setUsers([]); setSearching(false); return }
    const timer = window.setTimeout(() => {
      setSearching(true)
      void searchSupportUsers(value).then(setUsers).catch(error => pushToast(error instanceof Error ? error.message : 'Could not search accounts.', 'danger')).finally(() => setSearching(false))
    }, 220)
    return () => window.clearTimeout(timer)
  }, [mode, pushToast, query, searchSupportUsers])

  async function inspect(userId: string) {
    setInspecting(true)
    try { setInspector(await request<Inspector>(`/v1/support/users/${encodeURIComponent(userId)}`)) }
    catch (error) { pushToast(error instanceof Error ? error.message : 'Could not inspect account.', 'danger') }
    finally { setInspecting(false) }
  }

  async function applyRestriction(userId: string, kind: 'ban' | 'chat' | 'space_create' | 'space_join', label: string) {
    const reason = await dialog.prompt({ title: label, message: 'Give the moderation reason. This is stored in the audit history.', label: 'Reason', maxLength: 900, danger: true, confirmText: 'Next' })
    if (!reason) return
    const duration = await dialog.prompt({ title: 'Restriction length', message: 'Use 1h, 12h, 1d, 7d, 30d, or permanent.', label: 'Duration', initialValue: '7d', maxLength: 20, danger: true, confirmText: 'Apply' })
    if (!duration) return
    const durationMinutes = durationMinutesFromInput(duration)
    if (duration.trim().toLowerCase() !== 'permanent' && durationMinutes === null) {
      pushToast('Use 1h, 12h, 1d, 7d, 30d, permanent, or a number of minutes.', 'danger')
      return
    }
    setBusy(`${kind}-${userId}`)
    try {
      await request(`/v1/support/users/${encodeURIComponent(userId)}/restrictions`, { method: 'POST', body: JSON.stringify({ kind, reason, durationMinutes }) })
      pushToast(`${label} applied.`, 'success')
      if (inspector?.profile.id === userId) await inspect(userId)
      await loadRestrictions()
    } catch (error) { pushToast(error instanceof Error ? error.message : 'Could not apply restriction.', 'danger') }
    finally { setBusy('') }
  }

  async function revoke(item: RestrictionItem | Inspector['restrictions'][number]) {
    const source = item.source
    if (!await dialog.confirm({ title: 'Remove restriction?', message: 'The historical record stays in the moderation history.', confirmText: source === 'ban' ? 'Unban' : 'Unrestrict', danger: true })) return
    setBusy(`revoke-${item.id}`)
    try {
      await request(`/v1/support/restrictions/${source}/${encodeURIComponent(item.id)}`, { method: 'DELETE' })
      if (inspector) await inspect(inspector.profile.id)
      await loadRestrictions()
    } catch (error) { pushToast(error instanceof Error ? error.message : 'Could not remove restriction.', 'danger') }
    finally { setBusy('') }
  }

  async function setTeamRole(user: WorkspaceSupportUser | TeamEntry, role: 'staff' | 'support' | null) {
    const removing = role === null
    const label = role === 'staff' ? 'Staff' : role === 'support' ? 'Support' : 'Member'
    if (!await dialog.confirm({
      title: removing ? `Remove ${user.displayName} from Team?` : `Set ${user.displayName} to ${label}?`,
      message: removing
        ? 'This removes Staff/Support platform access and clears their custom Support capabilities. Their normal Spaces account stays intact.'
        : 'Only the Founder can change platform team roles. This action is audit logged.',
      confirmText: removing ? 'Remove from Team' : `Set ${label}`,
      danger: removing,
    })) return
    setBusy(`role-${user.id}`)
    try {
      await request(`/v1/support/team/${encodeURIComponent(user.id)}`, { method: 'PATCH', body: JSON.stringify({ role }) })
      pushToast(removing ? `${user.displayName} removed from Team.` : `${user.displayName} is now ${label}.`, 'success')
      await loadTeam()
    } catch (error) { pushToast(error instanceof Error ? error.message : 'Could not change team role.', 'danger') }
    finally { setBusy('') }
  }

  async function assignReservedId(user: TeamEntry) {
    const value = await dialog.prompt({ title: `Assign a reserved Spaces ID`, message: 'Founder-only. Choose a number from 2 through 19. Normal member IDs still continue from #00020+.', label: 'Reserved number', placeholder: '2', maxLength: 2, danger: true, confirmText: 'Assign ID' })
    if (!value) return
    const number = Number.parseInt(value, 10)
    if (!Number.isInteger(number) || number < 2 || number > 19) { pushToast('Reserved IDs must be #2 through #19.', 'danger'); return }
    setBusy(`id-${user.id}`)
    try {
      await request(`/v1/support/team/${encodeURIComponent(user.id)}/public-id`, { method: 'PATCH', body: JSON.stringify({ number }) })
      pushToast(`Assigned #${number}.`, 'success')
      await loadTeam()
    } catch (error) { pushToast(error instanceof Error ? error.message : 'Could not assign reserved ID.', 'danger') }
    finally { setBusy('') }
  }

  async function savePermissions() {
    if (!permissionTarget) return
    setBusy(`perms-${permissionTarget.id}`)
    try {
      await request(`/v1/support/team/${encodeURIComponent(permissionTarget.id)}/permissions`, { method: 'PATCH', body: JSON.stringify({ permissions: permissionDraft }) })
      pushToast('Support permissions saved.', 'success')
      setPermissionTarget(null)
      await loadTeam()
    } catch (error) { pushToast(error instanceof Error ? error.message : 'Could not save permissions.', 'danger') }
    finally { setBusy('') }
  }

  async function restrictSpace() {
    const workspaceId = spaceId.trim()
    if (!workspaceId) return
    const reason = await dialog.prompt({ title: 'Restrict Space', message: 'This makes the Space read-only for normal members while Support reviews it.', label: 'Reason', maxLength: 900, danger: true, confirmText: 'Next' })
    if (!reason) return
    const duration = await dialog.prompt({ title: 'Restriction length', message: 'Use 1h, 12h, 1d, 7d, 30d, or permanent.', label: 'Duration', initialValue: '7d', maxLength: 20, danger: true, confirmText: 'Restrict Space' })
    if (!duration) return
    const durationMinutes = durationMinutesFromInput(duration)
    if (duration.trim().toLowerCase() !== 'permanent' && durationMinutes === null) { pushToast('Invalid duration.', 'danger'); return }
    setBusy('space-restrict')
    try {
      await request(`/v1/support/spaces/${encodeURIComponent(workspaceId)}/restriction`, { method: 'POST', body: JSON.stringify({ reason, durationMinutes }) })
      setSpaceId('')
      await loadRestrictions()
      pushToast('Space restriction applied.', 'success')
    } catch (error) { pushToast(error instanceof Error ? error.message : 'Could not restrict Space.', 'danger') }
    finally { setBusy('') }
  }

  const visibleRestrictions = useMemo(() => restrictions.filter(item => showHistory || item.active), [restrictions, showHistory])

  if (mode === 'team') {
    if (!access.founder) return <div className="support-v48-empty"><Icon name="lock" size={22}/><strong>Founder only</strong><span>Only the Founder can manage team roles, permissions, and reserved IDs.</span></div>
    return <div className="support-v48-stack">
      <section className="support-v48-panel">
        <header><div><span className="eyebrow">TEAM CONTROL</span><h4>Founder-managed platform team</h4><p>Add Staff or Support, customize their server-enforced capabilities, and assign reserved IDs #2–#19.</p></div><button className="secondary-button compact" onClick={() => void loadTeam()}><Icon name="activity" size={13}/>Refresh</button></header>
        <label className="support-v48-search"><Icon name="search" size={14}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find an account to add to the team…"/></label>
        {query.trim() && <div className="support-v48-search-results">{searching ? <span>Searching…</span> : users.slice(0, 8).map(user => <article key={user.id}><Avatar name={user.displayName} src={user.avatarUrl} size={36}/><div><strong>{user.displayName}</strong><span>@{user.username} · {formatPublicUserId(user.publicUserId)}</span></div><div><button onClick={() => void setTeamRole(user, 'support')}>Make Support</button><button onClick={() => void setTeamRole(user, 'staff')}>Make Staff</button></div></article>)}</div>}
      </section>

      <section className="support-v48-panel">
        <header><div><span className="eyebrow">CURRENT TEAM</span><h4>{team.length} platform team account{team.length === 1 ? '' : 's'}</h4></div></header>
        <div className="support-v48-team-list">{team.map(member => <article key={member.id} className="support-v48-team-row"><Avatar name={member.displayName} src={member.avatarUrl} size={42}/><div className="support-v48-grow"><strong>{member.displayName}</strong><span>@{member.username} · {formatPublicUserId(member.publicUserId)}</span>{member.email && <small>{member.email} · verified</small>}</div><span className={`support-role-badge platform-${member.platformRole ?? 'support'}`}>{platformRoleLabel(member.platformRole)}</span>{member.platformRole !== 'founder' && <div className="support-v48-actions"><button disabled={busy === `id-${member.id}`} onClick={() => void assignReservedId(member)}><Icon name="copy" size={12}/>Reserved ID</button><button onClick={() => { setPermissionTarget(member); setPermissionDraft(member.permissions) }}><Icon name="shield" size={12}/>Permissions</button><button onClick={() => void setTeamRole(member, member.platformRole === 'staff' ? 'support' : 'staff')}>{member.platformRole === 'staff' ? 'Set Support' : 'Set Staff'}</button><button className="danger-soft remove-team-v63" onClick={() => void setTeamRole(member, null)}>Remove from Team</button></div>}</article>)}</div>
      </section>

      {permissionTarget && <section className="support-v48-panel support-v48-permission-editor"><header><div><span className="eyebrow">PERMISSIONS</span><h4>{permissionTarget.displayName}</h4><p>These are checked on the Worker for every sensitive Support action.</p></div><button className="icon-button" onClick={() => setPermissionTarget(null)} aria-label="Close"><Icon name="x" size={14}/></button></header><div className="support-v48-permission-grid">{ALL_CAPABILITIES.map(item => { const checked = permissionDraft.includes(item.id); return <label key={item.id} className={checked ? 'enabled' : ''}><input type="checkbox" checked={checked} onChange={() => setPermissionDraft(current => checked ? current.filter(id => id !== item.id) : [...current, item.id])}/><span><strong>{item.label}</strong><small>{item.note}</small></span></label> })}</div><div className="support-v48-save"><button className="primary-button" disabled={busy === `perms-${permissionTarget.id}`} onClick={() => void savePermissions()}>Save permissions</button></div></section>}
    </div>
  }

  if (mode === 'restrictions') {
    return <div className="support-v48-stack">
      <section className="support-v48-panel"><header><div><span className="eyebrow">ACTIVE RESTRICTIONS</span><h4>Punishment control</h4><p>Bans, chat restrictions, Space creation/join restrictions, and Space restrictions. Expired or removed items remain in history.</p></div><div className="support-v48-actions"><button className={showHistory ? 'active' : ''} onClick={() => setShowHistory(value => !value)}>{showHistory ? 'Active only' : 'Show history'}</button><button onClick={() => void loadRestrictions()}><Icon name="activity" size={12}/>Refresh</button></div></header>{access.can('space_restrict') && <div className="support-v48-space-restrict"><label><span>SPACE ID</span><input className="text-input" value={spaceId} onChange={event => setSpaceId(event.target.value)} placeholder="Internal Space UUID"/></label><button className="danger-soft" disabled={!spaceId.trim() || busy === 'space-restrict'} onClick={() => void restrictSpace()}><Icon name="lock" size={12}/>Restrict Space</button></div>}</section>
      <section className="support-v48-panel"><div className="support-v48-restriction-list">{visibleRestrictions.map(item => <article key={`${item.source}-${item.id}`} className={!item.active ? 'inactive' : ''}><div className="support-v48-restriction-icon"><Icon name={item.kind === 'space' ? 'grid' : 'lock'} size={15}/></div><div className="support-v48-grow"><header><strong>{item.kind === 'space' ? item.workspaceName : item.displayName}</strong><span>{item.kind.replaceAll('_', ' ')}</span></header><p>{item.reason}</p><footer>{item.publicUserId && <code>{formatPublicUserId(item.publicUserId)}</code>}{item.email && <span>{item.email}</span>}{item.workspaceId && <code>{item.workspaceId}</code>}<span>by {item.createdByName}</span><time>{new Date(item.createdAt).toLocaleString()}</time><strong>{durationLabel(item)}</strong></footer></div>{item.active && <button className="danger-soft" disabled={busy === `revoke-${item.id}`} onClick={() => void revoke(item)}>{item.source === 'ban' ? 'Unban' : 'Unrestrict'}</button>}</article>)}{!visibleRestrictions.length && <div className="support-v48-empty"><Icon name="check" size={22}/><strong>No restrictions here</strong><span>{showHistory ? 'No punishment history has been recorded yet.' : 'No active restrictions right now.'}</span></div>}</div></section>
    </div>
  }

  return <div className="support-v48-stack">
    <section className="support-v48-panel"><header><div><span className="eyebrow">ACCOUNT INSPECTOR</span><h4>Find a Spaces account</h4><p>Safe profile, Space IDs, verified email when permitted, restrictions, reports, Support DMs, and moderation history. Secrets are never returned.</p></div></header><label className="support-v48-search"><Icon name="search" size={14}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Spaces ID, username or display name…"/></label>{query.trim() && <div className="support-v48-search-results">{searching ? <span>Searching…</span> : users.slice(0, 12).map(user => <article key={user.id}><Avatar name={user.displayName} src={user.avatarUrl} size={38}/><div className="support-v48-grow"><strong>{user.displayName}</strong><span>@{user.username} · {formatPublicUserId(user.publicUserId)} · {user.spaceCount} Space{user.spaceCount === 1 ? '' : 's'}</span></div><button onClick={() => void inspect(user.id)}><Icon name="user" size={12}/>Inspect</button></article>)}</div>}</section>

    {inspecting && <div className="support-console-loading support-console-loading-v17">Loading account…</div>}
    {inspector && !inspecting && <>
      <section className="support-v48-panel support-v48-account-head"><Avatar name={inspector.profile.displayName} src={inspector.profile.avatarUrl} size={58}/><div className="support-v48-grow"><span className="eyebrow">{inspector.profile.platformRole ? platformRoleLabel(inspector.profile.platformRole) : 'MEMBER'}</span><h4>{inspector.profile.displayName}</h4><p>@{inspector.profile.username} · {formatPublicUserId(inspector.profile.publicUserId)}</p><code>{inspector.profile.id}</code></div><div className="support-v48-security"><span>Email: {inspector.security.emailVisible ? inspector.security.email : inspector.security.emailVerified ? 'Verified · hidden by permission' : 'Not verified'}</span><span>2FA: {inspector.security.twoFactorEnabled ? 'On' : 'Off'}</span><span>Created: {new Date(inspector.profile.createdAt).toLocaleDateString()}</span></div></section>

      <section className="support-v48-panel"><header><div><span className="eyebrow">ACCOUNT ACTIONS</span><h4>Restrictions</h4><p>Choose a reason and 1h, 12h, 1d, 7d, 30d or permanent duration.</p></div></header><div className="support-v48-action-grid">{access.can('ban_users') && <button className="danger-soft" onClick={() => void applyRestriction(inspector.profile.id, 'ban', 'Ban account')}><Icon name="lock" size={13}/>Ban</button>}{access.can('chat_restrict') && <button onClick={() => void applyRestriction(inspector.profile.id, 'chat', 'Restrict chat')}><Icon name="message" size={13}/>Chat restriction</button>}{access.can('space_create_restrict') && <button onClick={() => void applyRestriction(inspector.profile.id, 'space_create', 'Restrict Space creation')}><Icon name="grid" size={13}/>Block Space creation</button>}{access.can('space_join_restrict') && <button onClick={() => void applyRestriction(inspector.profile.id, 'space_join', 'Restrict Space joining')}><Icon name="members" size={13}/>Block Space joining</button>}</div><div className="support-v48-mini-history">{inspector.restrictions.map(item => <article key={`${item.source}-${item.id}`}><div><strong>{item.kind.replaceAll('_',' ')}</strong><span>{item.reason}</span></div><span>{durationLabel(item)}</span>{item.active && <button disabled={busy === `revoke-${item.id}`} onClick={() => void revoke(item)}>{item.source === 'ban' ? 'Unban' : 'Remove'}</button>}</article>)}</div></section>

      <section className="support-v48-grid-two"><article className="support-v48-panel"><header><div><span className="eyebrow">SPACES</span><h4>Memberships</h4></div><span>{inspector.memberships.length}</span></header><div className="support-v48-compact-list">{inspector.memberships.map(item => <div key={item.workspaceId}><div><strong>{item.workspaceName}</strong><span>{item.role}</span></div><code>{item.workspaceId}</code></div>)}</div></article><article className="support-v48-panel"><header><div><span className="eyebrow">REPORTS</span><h4>Account history</h4></div><span>{inspector.reports.length + inspector.cases.length}</span></header><div className="support-v48-compact-list">{inspector.reports.slice(0, 12).map(item => <div key={item.id}><div><strong>{item.reason}</strong><span>{item.status}</span></div><small>{new Date(item.created_at).toLocaleString()}</small></div>)}{inspector.cases.slice(0, 12).map(item => <div key={item.id}><div><strong>{item.subject}</strong><span>{item.kind} · {item.status}</span></div><small>{new Date(item.created_at).toLocaleString()}</small></div>)}</div></article></section>

      <section className="support-v48-grid-two"><article className="support-v48-panel"><header><div><span className="eyebrow">SUPPORT DMS</span><h4>Official messages</h4></div><span>{inspector.supportMessages.length}</span></header><div className="support-v48-compact-list">{inspector.supportMessages.slice(0, 12).map(item => <div key={item.id}><div><strong>{item.subject}</strong><span>{item.body}</span></div><small>{new Date(item.created_at).toLocaleString()}</small></div>)}</div></article><article className="support-v48-panel"><header><div><span className="eyebrow">AUDIT</span><h4>Moderation actions</h4></div><span>{inspector.moderationActions.length}</span></header><div className="support-v48-compact-list">{access.can('view_audit') ? inspector.moderationActions.slice(0, 16).map(item => <div key={item.id}><div><strong>{item.action}</strong><span>{item.reason || 'No reason recorded'} · {item.moderatorName}</span></div><small>{new Date(item.createdAt).toLocaleString()}</small></div>) : <div><span>Audit history permission required.</span></div>}</div></article></section>
    </>}
  </div>
}
