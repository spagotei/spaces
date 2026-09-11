import { useEffect, useMemo, useState } from 'react'
import { Icon, type IconName } from '../../components/Icon'
import { Avatar } from '../../components/Avatar'
import { useAppDialog } from '../../components/AppDialog'
import { useSpaces } from '../../state/SpacesContext'
import { usePreferences } from '../../state/PreferencesContext'
import type {
  WorkspaceModerationReport,
  WorkspaceSupportCase,
  WorkspaceSupportMessage,
  WorkspaceSupportStaffMessage,
  WorkspaceBetaAccessEntry,
  WorkspaceSupportUser,
} from '../../types/spaces'
import { platformRoleLabel } from '../../utils/permissions'
import { SupportOperationsV48, useSupportV48Access } from './SupportOperationsV48'
import { formatPublicUserId } from '../../utils/public-id'
import { playSpacesSupportSound } from '../../utils/notification-sound'
import '../../styles/standalone-v53.css'

type SupportTab =
  | 'queue'
  | 'players'
  | 'spaces'
  | 'bugs'
  | 'archive'
  | 'accounts'
  | 'restrictions'
  | 'access'
  | 'team'
  | 'staff-chat'
  | 'dms'

type ReportV53 = WorkspaceModerationReport & {
  archivedAt?: number | null
  archivedBy?: string | null
}

type CaseV53 = WorkspaceSupportCase & {
  archivedAt?: number | null
  archivedBy?: string | null
  reporterPublicUserId?: string
  targetWorkspaceOwnerPublicUserId?: string
}

type SupportMessageV53 = WorkspaceSupportMessage & {
  messageKind?: 'official' | 'reply'
  recipientUsername?: string
  senderUsername?: string
}

const betaTemplateKey = 'spaces.support.beta-email-template.v1'
const defaultBetaSubject = 'You’re in Spaces'
const defaultBetaMessage =
  'Your access to the Spaces Public Beta is ready.\n\nSign in with {email} using the temporary password included below. You’ll choose your username after signing in.\n\nYour first sign-in must use the email address this invitation was sent to.\n\nSpaces'

function loadBetaTemplate() {
  try {
    const parsed = JSON.parse(localStorage.getItem(betaTemplateKey) || '{}') as {
      subject?: string
      message?: string
    }
    return {
      subject: parsed.subject || defaultBetaSubject,
      message: parsed.message || defaultBetaMessage,
    }
  } catch {
    return { subject: defaultBetaSubject, message: defaultBetaMessage }
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function publicIdFromReportProfile(profile: unknown) {
  const value = (profile as { publicUserId?: string } | null)?.publicUserId
  return value ? formatPublicUserId(value) : ''
}

function bugSummary(details: string) {
  const pick = (name: string) =>
    details.match(new RegExp(`\\[${name}\\]\\s*([^\\n]+)`, 'i'))?.[1]?.trim() ?? ''
  return {
    category: pick('Category'),
    severity: pick('Severity'),
    reproducibility: pick('Reproducibility'),
  }
}

export function SupportConsole({
  onClose,
  onOpenSecurity,
}: {
  onClose: () => void
  onOpenSecurity: () => void
}) {
  const dialog = useAppDialog()
  const { preferences } = usePreferences()
  const {
    apiUrl,
    session,
    profile,
    pushToast,
    listModerationReports,
    updateModerationReport,
    banPlatformUser,
    unbanPlatformUser,
    listSupportCases,
    updateSupportCase,
    listSupportMessages,
    sendSupportMessage,
    searchSupportUsers,
    listSupportStaffMessages,
    sendSupportStaffMessage,
    restrictSupportSpace,
    unrestrictSupportSpace,
    deleteSupportSpace,
    listBetaAccess,
    inviteBetaEmail,
    revokeBetaAccess,
  } = useSpaces()

  const access = useSupportV48Access()
  const [tab, setTab] = useState<SupportTab>('queue')
  const [reports, setReports] = useState<ReportV53[]>([])
  const [cases, setCases] = useState<CaseV53[]>([])
  const [messages, setMessages] = useState<SupportMessageV53[]>([])
  const [staffMessages, setStaffMessages] = useState<WorkspaceSupportStaffMessage[]>([])
  const [staffDraft, setStaffDraft] = useState('')
  const [betaAccess, setBetaAccess] = useState<WorkspaceBetaAccessEntry[]>([])
  const [betaEmail, setBetaEmail] = useState('')
  const [betaInviteSubject, setBetaInviteSubject] = useState(() => loadBetaTemplate().subject)
  const [betaInviteMessage, setBetaInviteMessage] = useState(() => loadBetaTemplate().message)
  const [betaTemplateSaved, setBetaTemplateSaved] = useState(
    () => Boolean(localStorage.getItem(betaTemplateKey)),
  )
  const [betaAccessLoading, setBetaAccessLoading] = useState(false)
  const [betaAccessError, setBetaAccessError] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [dmSearch, setDmSearch] = useState('')
  const [dmUsers, setDmUsers] = useState<WorkspaceSupportUser[]>([])
  const [dmSearching, setDmSearching] = useState(false)

  const allowed =
    profile?.platformRole === 'founder' ||
    profile?.platformRole === 'staff' ||
    profile?.platformRole === 'support'

  const canViewAccounts = access.can('view_accounts')

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
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
        // Keep the status-based message.
      }
      throw new Error(message)
    }
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  async function refresh() {
    if (!allowed) return
    setLoading(true)
    try {
      const [nextReports, nextCases, nextMessages, nextStaff] = await Promise.all([
        listModerationReports(),
        listSupportCases(),
        listSupportMessages().catch(() => []),
        listSupportStaffMessages().catch(() => []),
      ])
      setReports(nextReports as ReportV53[])
      setCases(nextCases as CaseV53[])
      setMessages(nextMessages as SupportMessageV53[])
      setStaffMessages(nextStaff)
      window.dispatchEvent(new Event('spaces-support-queue-changed'))
    } catch (error) {
      pushToast(errorMessage(error, 'Could not load Support Console.'), 'danger')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // The Console owns its own refresh lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  useEffect(() => {
    if (tab !== 'staff-chat') return
    let cancelled = false
    const load = () =>
      void listSupportStaffMessages()
        .then(items => {
          if (!cancelled) setStaffMessages(items)
        })
        .catch(() => undefined)
    load()
    const timer = window.setInterval(load, 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [listSupportStaffMessages, tab])

  useEffect(() => {
    if (tab !== 'dms' || !canViewAccounts) return
    const value = dmSearch.trim()
    if (!value) {
      setDmUsers([])
      setDmSearching(false)
      return
    }
    const timer = window.setTimeout(() => {
      setDmSearching(true)
      void searchSupportUsers(value)
        .then(setDmUsers)
        .catch(error =>
          pushToast(errorMessage(error, 'Could not search accounts.'), 'danger'),
        )
        .finally(() => setDmSearching(false))
    }, 220)
    return () => window.clearTimeout(timer)
  }, [canViewAccounts, dmSearch, pushToast, searchSupportUsers, tab])

  const activeReports = useMemo(
    () => reports.filter(item => !item.archivedAt),
    [reports],
  )
  const activeCases = useMemo(
    () => cases.filter(item => !item.archivedAt),
    [cases],
  )
  const archivedReports = useMemo(
    () => reports.filter(item => Boolean(item.archivedAt)),
    [reports],
  )
  const archivedCases = useMemo(
    () => cases.filter(item => Boolean(item.archivedAt)),
    [cases],
  )
  const openReports = activeReports.filter(item =>
    ['open', 'reviewed'].includes(item.status),
  )
  const openCases = activeCases.filter(item =>
    ['open', 'reviewed'].includes(item.status),
  )

  const search = query.trim().toLowerCase()
  const visibleReports = useMemo(
    () =>
      activeReports.filter(item => {
        if (tab === 'queue' && !['open', 'reviewed'].includes(item.status)) return false
        if (tab !== 'queue' && tab !== 'players') return false
        if (!search) return true
        const target = item.snapshot.reported
        const reporter = item.snapshot.reporter
        return `${item.reason} ${item.details} ${target.displayName} ${target.username} ${reporter.displayName} ${reporter.username}`
          .toLowerCase()
          .includes(search)
      }),
    [activeReports, search, tab],
  )

  const visibleCases = useMemo(
    () =>
      activeCases.filter(item => {
        if (tab === 'queue' && !['open', 'reviewed'].includes(item.status)) return false
        if (tab === 'spaces' && item.kind !== 'space') return false
        if (tab === 'bugs' && item.kind !== 'bug') return false
        if (!['queue', 'spaces', 'bugs'].includes(tab)) return false
        if (!search) return true
        return `${item.subject} ${item.details} ${item.reporterName} ${item.reporterUsername} ${item.targetWorkspaceName ?? ''}`
          .toLowerCase()
          .includes(search)
      }),
    [activeCases, search, tab],
  )

  function canManageCase(item: CaseV53) {
    return item.kind === 'bug'
      ? access.can('manage_bugs') || access.can('manage_reports')
      : access.can('manage_reports')
  }

  async function sendDm(
    recipientUserId: string,
    defaultSubject: string,
    caseId?: string | null,
  ) {
    const subject = await dialog.prompt({
      title: 'Support DM subject',
      message:
        'This appears in the user’s Friends & Messages area as the official Support Replys thread.',
      label: 'Subject',
      initialValue: defaultSubject,
      maxLength: 120,
      confirmText: 'Next',
    })
    if (!subject) return
    const body = await dialog.prompt({
      title: 'Write Support DM',
      message:
        'Support DMs bypass normal DM privacy settings. Never request passwords, session tokens, 2FA codes, or recovery codes.',
      label: 'Message',
      placeholder: 'Write the official Support notice…',
      maxLength: 2400,
      confirmText: 'Send Support DM',
    })
    if (!body) return

    setBusyId(`dm-${recipientUserId}`)
    try {
      const sent = await sendSupportMessage({
        recipientUserId,
        subject,
        body,
        caseId,
      })
      setMessages(current => [sent as SupportMessageV53, ...current])
      if (preferences.desktopSounds && preferences.supportOutgoingSounds) {
        playSpacesSupportSound('outgoing')
      }
      pushToast('Support DM sent.', 'success')
    } catch (error) {
      pushToast(errorMessage(error, 'Could not send Support DM.'), 'danger')
    } finally {
      setBusyId('')
    }
  }

  async function markReport(
    reportId: string,
    status: 'reviewed' | 'dismissed',
  ) {
    setBusyId(reportId)
    try {
      await updateModerationReport(reportId, status)
      await refresh()
    } catch (error) {
      pushToast(errorMessage(error, 'Could not update report.'), 'danger')
    } finally {
      setBusyId('')
    }
  }

  async function handleBan(report: ReportV53) {
    const target = report.snapshot.reported
    const reason = await dialog.prompt({
      title: `Ban ${target.displayName}?`,
      message:
        'This signs the account out and blocks future login until the ban is removed.',
      label: 'Moderation reason',
      initialValue: report.reason,
      maxLength: 800,
      danger: true,
      confirmText: 'Continue',
    })
    if (!reason) return
    if (
      !(await dialog.confirm({
        title: 'Confirm platform ban',
        message: `Ban @${target.username} from Spaces? This action is audit logged.`,
        confirmText: 'Ban account',
        danger: true,
      }))
    )
      return

    setBusyId(report.id)
    try {
      await banPlatformUser(target.id, reason, report.id)
      await refresh()
    } catch (error) {
      pushToast(errorMessage(error, 'Could not ban account.'), 'danger')
    } finally {
      setBusyId('')
    }
  }

  async function changeCase(
    item: CaseV53,
    status: 'reviewed' | 'resolved' | 'dismissed',
    assignToMe = false,
  ) {
    setBusyId(item.id)
    try {
      const next = await updateSupportCase(item.id, { status, assignToMe })
      setCases(current =>
        current.map(entry => (entry.id === next.id ? (next as CaseV53) : entry)),
      )
    } catch (error) {
      pushToast(errorMessage(error, 'Could not update case.'), 'danger')
    } finally {
      setBusyId('')
    }
  }

  async function archiveReport(report: ReportV53, archived: boolean) {
    setBusyId(`archive-${report.id}`)
    try {
      await request(`/v1/support/player-reports/${encodeURIComponent(report.id)}/archive`, {
        method: 'PATCH',
        body: JSON.stringify({ archived }),
      })
      await refresh()
      pushToast(archived ? 'Player report archived.' : 'Player report restored.', 'success')
    } catch (error) {
      pushToast(errorMessage(error, 'Could not update archive state.'), 'danger')
    } finally {
      setBusyId('')
    }
  }

  async function deleteReport(report: ReportV53) {
    if (
      !(await dialog.confirm({
        title: 'Permanently delete player report?',
        message:
          'The report body, snapshot, and evidence will be permanently deleted from storage. The moderation audit log will record that the deletion happened.',
        confirmText: 'Delete permanently',
        danger: true,
      }))
    )
      return
    setBusyId(`delete-${report.id}`)
    try {
      await request(`/v1/support/player-reports/${encodeURIComponent(report.id)}`, {
        method: 'DELETE',
      })
      await refresh()
      pushToast('Player report permanently deleted.', 'success')
    } catch (error) {
      pushToast(errorMessage(error, 'Could not delete report.'), 'danger')
    } finally {
      setBusyId('')
    }
  }

  async function archiveCase(item: CaseV53, archived: boolean) {
    setBusyId(`archive-${item.id}`)
    try {
      await request(`/v1/support/cases/${encodeURIComponent(item.id)}/archive`, {
        method: 'PATCH',
        body: JSON.stringify({ archived }),
      })
      await refresh()
      pushToast(
        archived
          ? `${item.kind === 'bug' ? 'Bug' : 'Spaces'} report archived.`
          : 'Report restored.',
        'success',
      )
    } catch (error) {
      pushToast(errorMessage(error, 'Could not update archive state.'), 'danger')
    } finally {
      setBusyId('')
    }
  }

  async function deleteCase(item: CaseV53) {
    if (
      !(await dialog.confirm({
        title: `Permanently delete ${item.kind === 'bug' ? 'bug' : 'Spaces'} report?`,
        message:
          'The report details and stored evidence will be permanently removed. The moderation audit log will record that the deletion happened.',
        confirmText: 'Delete permanently',
        danger: true,
      }))
    )
      return
    setBusyId(`delete-${item.id}`)
    try {
      await request(`/v1/support/cases/${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
      })
      await refresh()
      pushToast('Report permanently deleted.', 'success')
    } catch (error) {
      pushToast(errorMessage(error, 'Could not delete report.'), 'danger')
    } finally {
      setBusyId('')
    }
  }

  async function restrictCase(item: CaseV53) {
    if (!item.targetWorkspaceId) return
    const reason = await dialog.prompt({
      title: `Restrict ${item.targetWorkspaceName ?? 'Space'}?`,
      message:
        'Restriction makes the Space read-only for normal members while Support reviews it.',
      label: 'Reason',
      initialValue: item.subject,
      maxLength: 900,
      danger: true,
      confirmText: 'Restrict Space',
    })
    if (!reason) return
    setBusyId(item.id)
    try {
      await restrictSupportSpace(item.targetWorkspaceId, reason)
      const next = await updateSupportCase(item.id, {
        status: 'actioned',
        assignToMe: true,
      })
      setCases(current =>
        current.map(entry =>
          entry.id === next.id ? ({ ...next, restricted: true } as CaseV53) : entry,
        ),
      )
    } catch (error) {
      pushToast(errorMessage(error, 'Could not restrict Space.'), 'danger')
    } finally {
      setBusyId('')
    }
  }

  async function unrestrictCase(item: CaseV53) {
    if (!item.targetWorkspaceId) return
    setBusyId(item.id)
    try {
      await unrestrictSupportSpace(item.targetWorkspaceId)
      await refresh()
    } catch (error) {
      pushToast(errorMessage(error, 'Could not remove restriction.'), 'danger')
    } finally {
      setBusyId('')
    }
  }

  async function removeSpace(item: CaseV53) {
    if (!item.targetWorkspaceId || !item.targetWorkspaceName) return
    const reason = await dialog.prompt({
      title: `Delete ${item.targetWorkspaceName}?`,
      message: 'This is permanent Space deletion. Add the moderation reason first.',
      label: 'Deletion reason',
      maxLength: 900,
      danger: true,
      confirmText: 'Continue',
    })
    if (!reason) return
    const confirm = await dialog.prompt({
      title: 'Permanent Space deletion',
      message:
        'All channels, messages, notes, roles, and memberships for this Space will be removed.',
      label: 'Type the exact Space name',
      requiredText: item.targetWorkspaceName,
      danger: true,
      confirmText: 'Delete Space',
    })
    if (confirm !== item.targetWorkspaceName) return
    setBusyId(item.id)
    try {
      await deleteSupportSpace(item.targetWorkspaceId, item.targetWorkspaceName, reason)
      await updateSupportCase(item.id, { status: 'actioned', assignToMe: true })
      await refresh()
    } catch (error) {
      pushToast(errorMessage(error, 'Could not delete Space.'), 'danger')
    } finally {
      setBusyId('')
    }
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
      pushToast(errorMessage(error, 'Could not send staff message.'), 'danger')
    } finally {
      setBusyId('')
    }
  }

  async function inviteAccessEmail() {
    const email = betaEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || busyId === 'beta-access')
      return
    setBusyId('beta-access')
    setBetaAccessError('')
    try {
      const result = await inviteBetaEmail(email, {
        subject: betaInviteSubject,
        message: betaInviteMessage,
      })
      setBetaAccess(current => [
        result.entry,
        ...current.filter(item => item.id !== result.entry.id),
      ])
      setBetaEmail('')
      pushToast(
        result.delivery === 'sent' ? 'Beta invite sent.' : 'Beta access approved.',
        'success',
      )
    } catch (error) {
      const message = errorMessage(error, 'Beta access is unavailable right now.')
      setBetaAccessError(message)
      pushToast(message, 'danger')
    } finally {
      setBusyId('')
    }
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
    if (
      !(await dialog.confirm({
        title: `Revoke ${entry.email}?`,
        message:
          'This removes unused beta access for this email. Existing accounts are not deleted.',
        confirmText: 'Revoke access',
        danger: true,
      }))
    )
      return
    setBusyId(`access-${entry.id}`)
    try {
      await revokeBetaAccess(entry.id)
      setBetaAccess(current =>
        current.map(item =>
          item.id === entry.id ? { ...item, status: 'revoked' } : item,
        ),
      )
    } catch (error) {
      pushToast(errorMessage(error, 'Could not revoke access.'), 'danger')
    } finally {
      setBusyId('')
    }
  }

  useEffect(() => {
    if (tab !== 'access') return
    let cancelled = false
    setBetaAccessLoading(true)
    setBetaAccessError('')
    void listBetaAccess()
      .then(items => {
        if (!cancelled) setBetaAccess(items)
      })
      .catch(error => {
        if (!cancelled) {
          const message = errorMessage(error, 'Could not load beta access.')
          setBetaAccessError(message)
          pushToast(message, 'danger')
        }
      })
      .finally(() => {
        if (!cancelled) setBetaAccessLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [listBetaAccess, pushToast, tab])

  if (!allowed) return null

  const navItems: [SupportTab, string, IconName][] = [
    ['queue', 'Queue', 'activity'],
    ['players', 'Player reports', 'members'],
    ['spaces', 'Spaces reports', 'grid'],
    ['bugs', 'Bug reports', 'sparkle'],
    ['archive', 'Archived', 'download'],
    ['accounts', 'Accounts', 'user'],
    ['restrictions', 'Restrictions', 'lock'],
    ['access', 'Beta access', 'lock'],
    ['team', 'Team', 'members'],
    ['staff-chat', 'Staff chat', 'chat'],
    ['dms', 'Support DMs', 'message'],
  ]

  const navVisible = (id: SupportTab) => {
    if (id === 'team') return access.founder
    if (id === 'access') return access.can('manage_beta_access')
    if (id === 'accounts' || id === 'restrictions') return access.can('view_accounts')
    if (id === 'staff-chat') return access.can('staff_chat')
    if (id === 'dms') return access.can('send_support_dms')
    if (id === 'bugs') return access.can('view_reports') || access.can('manage_bugs')
    return access.can('view_reports')
  }

  return (
    <>
      <button
        className="support-console-scrim support-console-scrim-v17"
        aria-label="Close Support Console"
        onPointerDown={onClose}
      />
      <section
        className="support-console support-console-v17 support-console-v53"
        role="dialog"
        aria-modal="true"
        aria-label="Spaces Support Console"
      >
        <header className="support-console-header support-console-header-v17">
          <span className="support-console-mark">
            <Icon name="shield" size={19} />
          </span>
          <div>
            <span className="eyebrow">PLATFORM OPERATIONS</span>
            <h2>Support Console</h2>
            <p>Reports, account enforcement, Support conversations, and team operations.</p>
          </div>
          <div className="support-header-actions">
            <span className={`support-role-badge platform-${profile?.platformRole ?? 'support'}`}>
              <Icon name="shield" size={11} />
              {platformRoleLabel(profile?.platformRole ?? 'support')}
            </span>
            <button className="icon-button" onClick={onClose} aria-label="Close">
              <Icon name="x" size={15} />
            </button>
          </div>
        </header>

        <div className="support-console-layout-v17">
          <nav className="support-console-nav-v17 support-console-nav-v53">
            <div className="support-console-nav-stats">
              <strong>{openReports.length + openCases.length}</strong>
              <span>open items</span>
            </div>
            {navItems.filter(([id]) => navVisible(id)).map(([id, label, icon]) => {
              const count =
                id === 'players'
                  ? activeReports.length
                  : id === 'spaces'
                    ? activeCases.filter(item => item.kind === 'space').length
                    : id === 'bugs'
                      ? activeCases.filter(item => item.kind === 'bug').length
                      : id === 'archive'
                        ? archivedReports.length + archivedCases.length
                        : 0
              return (
                <button
                  key={id}
                  className={tab === id ? 'active' : ''}
                  onClick={() => {
                    setTab(id)
                    setQuery('')
                  }}
                >
                  <Icon name={icon} size={15} />
                  <span>{label}</span>
                  {count > 0 && <small>{count}</small>}
                </button>
              )
            })}
            <div className="support-console-nav-bottom">
              <button onClick={onOpenSecurity}>
                <Icon name="lock" size={14} />
                <span>My security</span>
              </button>
              <div>
                <Icon name="shield" size={13} />
                <span>Server-enforced permissions</span>
              </div>
            </div>
          </nav>

          <main className="support-console-main-v17 support-console-main-v53">
            <div className="support-console-toolbar-v17">
              <div>
                <span className="eyebrow">
                  {tab === 'queue'
                    ? 'ACTIVE QUEUE'
                    : tab === 'staff-chat'
                      ? 'PRIVATE OPERATIONS'
                      : tab.toUpperCase()}
                </span>
                <h3>
                  {tab === 'queue'
                    ? 'Needs attention'
                    : tab === 'players'
                      ? 'Player reports'
                      : tab === 'spaces'
                        ? 'Spaces reports'
                        : tab === 'bugs'
                          ? 'Bug reports'
                          : tab === 'archive'
                            ? 'Archived reports'
                            : tab === 'accounts'
                                ? 'Account inspector'
                                : tab === 'restrictions'
                                  ? 'Restrictions'
                                  : tab === 'access'
                                    ? 'Beta access'
                                    : tab === 'team'
                                      ? 'Team management'
                                      : tab === 'staff-chat'
                                        ? 'Staff chat'
                                        : 'Support conversations'}
                </h3>
              </div>
              {['queue', 'players', 'spaces', 'bugs'].includes(tab) && (
                <label>
                  <Icon name="search" size={14} />
                  <input
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Search reports, people, or Spaces…"
                  />
                </label>
              )}
              <button className="secondary-button compact" onClick={() => void refresh()}>
                <Icon name="refresh" size={13} /> Refresh
              </button>
            </div>

            {loading ? (
              <div className="support-console-loading support-console-loading-v17">
                Loading Support operations…
              </div>
            ) : tab === 'restrictions' || tab === 'team' ? (
              <SupportOperationsV48 mode={tab} />
            ) : tab === 'accounts' ? (
              <SupportOperationsV48 mode="accounts" />
            ) : tab === 'archive' ? (
              <ArchiveView
                reports={archivedReports}
                cases={archivedCases}
                busyId={busyId}
                canManageReports={access.can('manage_reports')}
                canManageBugs={access.can('manage_bugs')}
                onRestoreReport={item => void archiveReport(item, false)}
                onDeleteReport={item => void deleteReport(item)}
                onRestoreCase={item => void archiveCase(item, false)}
                onDeleteCase={item => void deleteCase(item)}
              />
            ) : tab === 'access' ? (
              <div className="support-beta-access-v33 support-beta-access-v53">
                <section className="support-beta-invite-v33">
                  <div>
                    <span className="eyebrow">LOCKED ACCESS</span>
                    <h4>Invite an email</h4>
                    <p>The exact approved address is required for the first sign-in.</p>
                  </div>
                  <div className="support-beta-invite-form-v33">
                    <label className="input-shell">
                      <Icon name="lock" size={14} />
                      <input
                        type="email"
                        value={betaEmail}
                        onChange={event => setBetaEmail(event.target.value)}
                        placeholder="name@example.com"
                      />
                    </label>
                    <button
                      className="primary-button"
                      disabled={
                        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(betaEmail.trim()) ||
                        !betaInviteSubject.trim() ||
                        !betaInviteMessage.trim() ||
                        busyId === 'beta-access'
                      }
                      onClick={() => void inviteAccessEmail()}
                    >
                      <Icon name="send" size={13} />
                      {busyId === 'beta-access' ? 'Approving…' : 'Approve & send'}
                    </button>
                  </div>
                  <div className="support-beta-message-v33 support-beta-message-editor-v35">
                    <label>
                      <span>Subject</span>
                      <input
                        className="text-input"
                        maxLength={120}
                        value={betaInviteSubject}
                        onChange={event => {
                          setBetaInviteSubject(event.target.value)
                          setBetaTemplateSaved(false)
                        }}
                      />
                    </label>
                    <label>
                      <span>Message</span>
                      <textarea
                        className="text-area"
                        rows={7}
                        maxLength={1800}
                        value={betaInviteMessage}
                        onChange={event => {
                          setBetaInviteMessage(event.target.value)
                          setBetaTemplateSaved(false)
                        }}
                      />
                    </label>
                    <button
                      className="secondary-button compact"
                      disabled={
                        betaTemplateSaved ||
                        !betaInviteSubject.trim() ||
                        !betaInviteMessage.trim()
                      }
                      onClick={saveBetaTemplate}
                    >
                      <Icon name="check" size={12} />
                      {betaTemplateSaved ? 'Saved' : 'Save email template'}
                    </button>
                  </div>
                </section>
                <section className="support-beta-list-v33">
                  <header>
                    <div>
                      <span className="eyebrow">ACCESS LIST</span>
                      <h4>Approved emails</h4>
                    </div>
                    <span>{betaAccess.length}</span>
                  </header>
                  {betaAccessError && <div className="support-beta-notice-v37">{betaAccessError}</div>}
                  {betaAccessLoading ? (
                    <div className="support-console-loading support-console-loading-v17">
                      Loading beta access…
                    </div>
                  ) : (
                    betaAccess.map(entry => (
                      <article key={entry.id}>
                        <div>
                          <strong>{entry.email}</strong>
                          <span>{entry.username ? `@${entry.username}` : 'Waiting for first sign-in'}</span>
                        </div>
                        <span className={`support-beta-status-v33 status-${entry.status}`}>
                          {entry.status}
                        </span>
                        <time>{new Date(entry.createdAt).toLocaleDateString()}</time>
                        {entry.status === 'invited' && (
                          <button
                            className="danger-soft"
                            disabled={busyId === `access-${entry.id}`}
                            onClick={() => void removeAccess(entry)}
                          >
                            Revoke
                          </button>
                        )}
                      </article>
                    ))
                  )}
                  {!betaAccessLoading && !betaAccess.length && (
                    <SupportEmpty icon="check" title="No beta invites yet" note="Approved emails will appear here." />
                  )}
                </section>
              </div>
            ) : tab === 'staff-chat' ? (
              <div className="support-staff-chat-v21 support-staff-chat-v53">
                <div className="support-staff-chat-feed-v21">
                  {staffMessages.map(message => (
                    <article
                      className={`support-staff-message-v21 ${
                        message.senderUserId === profile?.id ? 'own' : ''
                      }`}
                      key={message.id}
                    >
                      <header>
                        <strong>{message.senderName}</strong>
                        <code>{formatPublicUserId(message.senderPublicUserId)}</code>
                        <span
                          className={`support-role-badge platform-${
                            message.senderPlatformRole ?? 'support'
                          }`}
                        >
                          {platformRoleLabel(message.senderPlatformRole ?? 'support')}
                        </span>
                        <time>
                          {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                      </header>
                      <p>{message.body}</p>
                    </article>
                  ))}
                  {!staffMessages.length && (
                    <SupportEmpty
                      icon="message"
                      title="Staff chat is quiet"
                      note="Founder, Staff, and Support can coordinate here."
                    />
                  )}
                </div>
                <div className="support-staff-chat-compose-v21">
                  <textarea
                    className="text-area"
                    maxLength={1600}
                    value={staffDraft}
                    onChange={event => setStaffDraft(event.target.value)}
                    placeholder="Message Founder, Staff, and Support…"
                    onKeyDown={event => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        void sendStaffChat()
                      }
                    }}
                  />
                  <button
                    className="primary-button"
                    disabled={!staffDraft.trim() || busyId === 'staff-chat'}
                    onClick={() => void sendStaffChat()}
                  >
                    <Icon name="send" size={13} /> Send
                  </button>
                </div>
              </div>
            ) : tab === 'dms' ? (
              <div className="support-dm-center-v53">
                {access.can('view_accounts') && (
                  <section className="support-dm-compose-card-v53">
                    <header>
                      <div>
                        <span className="eyebrow">NEW OFFICIAL MESSAGE</span>
                        <h4>Start a Support conversation</h4>
                      </div>
                    </header>
                    <label className="support-v48-search">
                      <Icon name="search" size={14} />
                      <input
                        value={dmSearch}
                        onChange={event => setDmSearch(event.target.value)}
                        placeholder="Spaces ID, username, or display name…"
                      />
                    </label>
                    {dmSearch.trim() && (
                      <div className="support-dm-user-results-v53">
                        {dmSearching ? (
                          <span>Searching…</span>
                        ) : (
                          dmUsers.slice(0, 8).map(user => (
                            <article key={user.id}>
                              <Avatar
                                name={user.displayName}
                                src={user.avatarUrl}
                                size={34}
                              />
                              <div>
                                <strong>{user.displayName}</strong>
                                <span>
                                  @{user.username} · {formatPublicUserId(user.publicUserId)}
                                </span>
                              </div>
                              <button
                                onClick={() =>
                                  void sendDm(
                                    user.id,
                                    'Please review a Spaces Support notice',
                                  )
                                }
                              >
                                <Icon name="message" size={12} /> Message
                              </button>
                            </article>
                          ))
                        )}
                      </div>
                    )}
                  </section>
                )}
                <section className="support-dm-history-v17 support-dm-history-v53">
                  {messages.map(message => (
                    <article
                      key={message.id}
                      className={message.messageKind === 'reply' ? 'support-reply-v53' : ''}
                    >
                      <span className="support-dm-icon">
                        <Icon
                          name={message.messageKind === 'reply' ? 'reply' : 'shield'}
                          size={14}
                        />
                      </span>
                      <div>
                        <header>
                          <strong>
                            {message.messageKind === 'reply'
                              ? 'SUPPORT REPLY'
                              : message.subject}
                          </strong>
                          <small>{new Date(message.createdAt).toLocaleString()}</small>
                        </header>
                        <p>{message.body}</p>
                        <footer>
                          <span>
                            {message.messageKind === 'reply'
                              ? `From ${message.senderName}`
                              : `To ${message.recipientName}`}
                          </span>
                          {message.caseId && <span>Case {message.caseId.slice(0, 8)}</span>}
                        </footer>
                      </div>
                    </article>
                  ))}
                  {!messages.length && (
                    <SupportEmpty
                      icon="message"
                      title="No Support conversations yet"
                      note="Official messages and user replies will appear here."
                    />
                  )}
                </section>
              </div>
            ) : (
              <div className="support-case-list-v17 support-case-list-v53">
                {visibleReports.map(report => {
                  const target = report.snapshot.reported
                  const reporter = report.snapshot.reporter
                  const targetPublicId = publicIdFromReportProfile(target)
                  const reporterPublicId = publicIdFromReportProfile(reporter)
                  return (
                    <article className="support-case-card-v17 support-case-card-v53 player" key={report.id}>
                      <header>
                        <span className="support-case-type-v17">
                          <Icon name="members" size={13} /> PLAYER
                        </span>
                        <span className={`support-case-status-v17 status-${report.status}`}>
                          {report.status}
                        </span>
                        <time>{new Date(report.createdAt).toLocaleString()}</time>
                      </header>
                      <div className="support-case-body-v17">
                        <div>
                          <h4>{report.reason}</h4>
                          <p>{report.details || 'No additional details supplied.'}</p>
                          <div className="support-case-meta-v17">
                            <span>
                              Reported: <strong>{target.displayName}</strong> @{target.username}
                              {targetPublicId ? ` · ${targetPublicId}` : ''}
                            </span>
                            <span>
                              Reporter: <strong>{reporter.displayName}</strong> @{reporter.username}
                              {reporterPublicId ? ` · ${reporterPublicId}` : ''}
                            </span>
                          </div>
                          {report.snapshot.memberships.length > 0 && (
                            <details className="support-detail-v53">
                              <summary>
                                Spaces memberships ({report.snapshot.memberships.length})
                              </summary>
                              <div className="support-membership-grid-v53">
                                {report.snapshot.memberships.map(member => (
                                  <div key={member.workspaceId}>
                                    <strong>{member.workspaceName}</strong>
                                    <span>{member.role}</span>
                                    <code>{member.workspaceId}</code>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                          {report.snapshot.messages.length > 0 && (
                            <details className="support-detail-v53">
                              <summary>
                                Recent evidence ({report.snapshot.messages.length})
                              </summary>
                              <div className="support-evidence-v31">
                                {report.snapshot.messages.slice(0, 20).map((message, index) => (
                                  <article
                                    key={`${message.workspaceId}-${message.createdAt}-${index}`}
                                  >
                                    <header>
                                      <strong>{message.workspaceName}</strong>
                                      <span>#{message.channelName}</span>
                                      <time>{new Date(message.createdAt).toLocaleString()}</time>
                                    </header>
                                    <p>{message.body}</p>
                                  </article>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                        <div className="support-case-target-v17">
                          <strong>{target.displayName}</strong>
                          <span>@{target.username}</span>
                          {targetPublicId && <code>{targetPublicId}</code>}
                          <small>
                            {report.isBanned
                              ? 'BANNED'
                              : target.platformRole
                                ? platformRoleLabel(target.platformRole)
                                : 'MEMBER'}
                          </small>
                        </div>
                      </div>
                      <footer className="support-case-actions-v17">
                        {access.can('send_support_dms') && (
                          <button
                            disabled={busyId === report.id}
                            onClick={() =>
                              void sendDm(
                                target.id,
                                report.isBanned
                                  ? 'Action taken on your Spaces account'
                                  : 'Please review a Spaces Support notice',
                                report.id,
                              )
                            }
                          >
                            <Icon name="message" size={13} /> Support DM
                          </button>
                        )}
                        {access.can('ban_users') &&
                          (!report.isBanned ? (
                            <button
                              className="danger-soft"
                              disabled={busyId === report.id}
                              onClick={() => void handleBan(report)}
                            >
                              <Icon name="lock" size={13} /> Ban
                            </button>
                          ) : (
                            <button
                              disabled={busyId === report.id}
                              onClick={() =>
                                void unbanPlatformUser(target.id).then(refresh)
                              }
                            >
                              <Icon name="shield" size={13} /> Unban
                            </button>
                          ))}
                        {access.can('manage_reports') && (
                          <>
                            <button
                              disabled={busyId === report.id}
                              onClick={() => void markReport(report.id, 'reviewed')}
                            >
                              Review
                            </button>
                            <button
                              disabled={busyId === report.id}
                              onClick={() => void markReport(report.id, 'dismissed')}
                            >
                              Dismiss
                            </button>
                            <button
                              disabled={busyId === `archive-${report.id}`}
                              onClick={() => void archiveReport(report, true)}
                            >
                              <Icon name="download" size={12} /> Archive
                            </button>
                          </>
                        )}
                      </footer>
                    </article>
                  )
                })}

                {visibleCases.map(item => {
                  const bug = item.kind === 'bug' ? bugSummary(item.details) : null
                  return (
                    <article
                      className={`support-case-card-v17 support-case-card-v53 ${item.kind}`}
                      key={item.id}
                    >
                      <header>
                        <span className="support-case-type-v17">
                          <Icon name={item.kind === 'space' ? 'grid' : 'sparkle'} size={13} />
                          {item.kind === 'space' ? 'SPACES REPORT' : 'BUG'}
                        </span>
                        <span className={`support-priority-v17 priority-${item.priority}`}>
                          {item.priority}
                        </span>
                        <span className={`support-case-status-v17 status-${item.status}`}>
                          {item.status}
                        </span>
                        <time>{new Date(item.createdAt).toLocaleString()}</time>
                      </header>
                      <div className="support-case-body-v17">
                        <div>
                          <h4>{item.subject}</h4>
                          {bug && (bug.category || bug.severity || bug.reproducibility) && (
                            <div className="support-bug-chips-v53">
                              {bug.category && <span>{bug.category}</span>}
                              {bug.severity && <span>Severity: {bug.severity}</span>}
                              {bug.reproducibility && <span>Repro: {bug.reproducibility}</span>}
                            </div>
                          )}
                          <pre className="support-case-details-v53">{item.details}</pre>
                          <div className="support-case-meta-v17">
                            <span>
                              Reporter: <strong>{item.reporterName}</strong> @{item.reporterUsername}
                              {item.reporterPublicUserId
                                ? ` · ${formatPublicUserId(item.reporterPublicUserId)}`
                                : ''}
                            </span>
                            {item.targetWorkspaceId && (
                              <button
                                className="support-inline-id-v31"
                                onClick={() =>
                                  void navigator.clipboard?.writeText(
                                    item.targetWorkspaceId ?? '',
                                  )
                                }
                              >
                                <Icon name="copy" size={11} />
                                Space ID {item.targetWorkspaceId}
                              </button>
                            )}
                            {item.assignedToName && <span>Assigned: {item.assignedToName}</span>}
                          </div>
                        </div>
                        {item.kind === 'space' && (
                          <div className="support-case-target-v17">
                            <strong>{item.targetWorkspaceName ?? 'Deleted Space'}</strong>
                            <span>Owner: {item.targetWorkspaceOwnerName ?? 'Unknown'}</span>
                            {item.targetWorkspaceOwnerPublicUserId && (
                              <code>
                                {formatPublicUserId(item.targetWorkspaceOwnerPublicUserId)}
                              </code>
                            )}
                            <small>{item.restricted ? 'RESTRICTED' : 'ACTIVE'}</small>
                          </div>
                        )}
                      </div>
                      <footer className="support-case-actions-v17">
                        {access.can('send_support_dms') && (
                          <button
                            disabled={busyId === item.id}
                            onClick={() =>
                              void sendDm(
                                item.kind === 'space'
                                  ? item.targetWorkspaceOwnerId ?? item.reporterId
                                  : item.reporterId,
                                item.kind === 'space'
                                  ? `Regarding ${item.targetWorkspaceName ?? 'your Space'}`
                                  : `Regarding bug report: ${item.subject}`,
                                item.id,
                              )
                            }
                          >
                            <Icon name="message" size={13} /> Support DM
                          </button>
                        )}
                        {access.can('space_restrict') &&
                          item.kind === 'space' &&
                          item.targetWorkspaceId &&
                          (!item.restricted ? (
                            <button
                              className="danger-soft"
                              disabled={busyId === item.id}
                              onClick={() => void restrictCase(item)}
                            >
                              <Icon name="lock" size={13} /> Restrict
                            </button>
                          ) : (
                            <button
                              disabled={busyId === item.id}
                              onClick={() => void unrestrictCase(item)}
                            >
                              <Icon name="shield" size={13} /> Unrestrict
                            </button>
                          ))}
                        {access.can('delete_space') &&
                          item.kind === 'space' &&
                          item.targetWorkspaceId && (
                            <button
                              className="danger-soft"
                              disabled={busyId === item.id}
                              onClick={() => void removeSpace(item)}
                            >
                              <Icon name="trash" size={13} /> Delete Space
                            </button>
                          )}
                        {canManageCase(item) && (
                          <>
                            <button
                              disabled={busyId === item.id}
                              onClick={() => void changeCase(item, 'reviewed', true)}
                            >
                              Take case
                            </button>
                            <button
                              disabled={busyId === item.id}
                              onClick={() => void changeCase(item, 'resolved', true)}
                            >
                              Resolve
                            </button>
                            <button
                              disabled={busyId === item.id}
                              onClick={() => void changeCase(item, 'dismissed')}
                            >
                              Dismiss
                            </button>
                            <button
                              disabled={busyId === `archive-${item.id}`}
                              onClick={() => void archiveCase(item, true)}
                            >
                              <Icon name="download" size={12} /> Archive
                            </button>
                          </>
                        )}
                      </footer>
                    </article>
                  )
                })}

                {!visibleReports.length && !visibleCases.length && (
                  <SupportEmpty
                    icon="check"
                    title={tab === 'queue' ? 'Queue is clear' : 'Nothing here'}
                    note="Nothing matches this view right now."
                  />
                )}
              </div>
            )}
          </main>
        </div>
      </section>
    </>
  )
}

function ArchiveView({
  reports,
  cases,
  busyId,
  canManageReports,
  canManageBugs,
  onRestoreReport,
  onDeleteReport,
  onRestoreCase,
  onDeleteCase,
}: {
  reports: ReportV53[]
  cases: CaseV53[]
  busyId: string
  canManageReports: boolean
  canManageBugs: boolean
  onRestoreReport: (item: ReportV53) => void
  onDeleteReport: (item: ReportV53) => void
  onRestoreCase: (item: CaseV53) => void
  onDeleteCase: (item: CaseV53) => void
}) {
  if (!reports.length && !cases.length) {
    return (
      <SupportEmpty
        icon="download"
        title="Archive is empty"
        note="Archived Player, Spaces, and Bug reports will stay viewable here."
      />
    )
  }

  return (
    <div className="support-archive-list-v53">
      {reports.map(item => (
        <article key={item.id}>
          <header>
            <span><Icon name="members" size={13} /> PLAYER</span>
            <strong>{item.reason}</strong>
            <time>{item.archivedAt ? new Date(item.archivedAt).toLocaleString() : ''}</time>
          </header>
          <div className="support-archive-meta-v53">
            <span>Reported: {item.snapshot.reported.displayName} @{item.snapshot.reported.username}</span>
            <span>Reporter: {item.snapshot.reporter.displayName} @{item.snapshot.reporter.username}</span>
          </div>
          <details>
            <summary>View archived report and evidence</summary>
            <p>{item.details || 'No additional details.'}</p>
            {item.snapshot.messages.slice(0, 20).map((message, index) => (
              <div className="support-archive-evidence-v53" key={`${message.createdAt}-${index}`}>
                <strong>{message.workspaceName} · #{message.channelName}</strong>
                <span>{message.body}</span>
              </div>
            ))}
          </details>
          {canManageReports && (
            <footer>
              <button
                disabled={busyId === `archive-${item.id}`}
                onClick={() => onRestoreReport(item)}
              >
                <Icon name="rotate" size={12} /> Restore
              </button>
              <button
                className="danger-soft"
                disabled={busyId === `delete-${item.id}`}
                onClick={() => onDeleteReport(item)}
              >
                <Icon name="trash" size={12} /> Delete permanently
              </button>
            </footer>
          )}
        </article>
      ))}
      {cases.map(item => {
        const canManage = item.kind === 'bug' ? canManageBugs || canManageReports : canManageReports
        return (
          <article key={item.id}>
            <header>
              <span>
                <Icon name={item.kind === 'bug' ? 'sparkle' : 'grid'} size={13} />
                {item.kind === 'bug' ? 'BUG' : 'SPACES'}
              </span>
              <strong>{item.subject}</strong>
              <time>{item.archivedAt ? new Date(item.archivedAt).toLocaleString() : ''}</time>
            </header>
            <div className="support-archive-meta-v53">
              <span>Reporter: {item.reporterName} @{item.reporterUsername}</span>
              {item.targetWorkspaceName && <span>Space: {item.targetWorkspaceName}</span>}
            </div>
            <details>
              <summary>View archived report</summary>
              <pre>{item.details}</pre>
            </details>
            {canManage && (
              <footer>
                <button
                  disabled={busyId === `archive-${item.id}`}
                  onClick={() => onRestoreCase(item)}
                >
                  <Icon name="rotate" size={12} /> Restore
                </button>
                <button
                  className="danger-soft"
                  disabled={busyId === `delete-${item.id}`}
                  onClick={() => onDeleteCase(item)}
                >
                  <Icon name="trash" size={12} /> Delete permanently
                </button>
              </footer>
            )}
          </article>
        )
      })}
    </div>
  )
}

function SupportEmpty({
  icon,
  title,
  note,
}: {
  icon: IconName
  title: string
  note: string
}) {
  return (
    <div className="support-empty-v17">
      <Icon name={icon} size={22} />
      <strong>{title}</strong>
      <span>{note}</span>
    </div>
  )
}
