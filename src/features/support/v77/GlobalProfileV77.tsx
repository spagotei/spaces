import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { AnimatedBackdrop } from '../../../components/AnimatedImage'
import { Avatar } from '../../../components/Avatar'
import { Icon } from '../../../components/Icon'
import { useSpaces } from '../../../state/SpacesContext'
import { platformRoleLabel } from '../../../utils/permissions'
import { timeAgo } from '../../../utils/format'
import {
  dispatchSupportIntakeV77,
  supportV77Request,
  type OpenProfileV77Detail,
  type SupportV77Identity,
  type SupportV77Profile,
} from './support-v77-api'

export function GlobalProfileHostV77() {
  const { apiUrl, session, profile, requestDirectConversation, pushToast } = useSpaces()
  const [open, setOpen] = useState<OpenProfileV77Detail | null>(null)
  const [data, setData] = useState<SupportV77Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const show = (event: Event) => {
      const next = (event as CustomEvent<OpenProfileV77Detail>).detail
      if (!next?.userId) return
      setOpen(next)
      setData(null)
      setError('')
    }
    window.addEventListener('spaces-open-profile-v77', show)
    return () => window.removeEventListener('spaces-open-profile-v77', show)
  }, [])

  useEffect(() => {
    if (!open?.userId || !session?.token) return
    let cancelled = false
    setLoading(true)
    void supportV77Request<SupportV77Profile>(apiUrl, session.token, `/v1/support/v77/profiles/${encodeURIComponent(open.userId)}`)
      .then(next => { if (!cancelled) { setData(next); setError('') } })
      .catch(caught => { if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load that profile.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [apiUrl, open?.userId, session?.token])

  const fallback = open?.fallback ?? null
  const view = useMemo<Partial<SupportV77Profile & SupportV77Identity>>(() => data ?? fallback ?? {}, [data, fallback])
  if (!open) return null

  const displayName = view.displayName || 'Spaces member'
  const username = view.username || ''
  const openUserId = open.userId
  const isSelf = openUserId === profile?.id

  async function message() {
    if (isSelf || busy) return
    setBusy(true)
    try {
      const conversation = await requestDirectConversation({ targetUserId: openUserId })
      window.dispatchEvent(new CustomEvent('spaces-open-direct-center', { detail: { conversationId: conversation.id } }))
      setOpen(null)
    } catch (caught) {
      pushToast(caught instanceof Error ? caught.message : 'Could not open a direct conversation.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <button className="profile-v77-scrim" aria-label="Close profile" onPointerDown={() => setOpen(null)} />
    <aside className="profile-v77-drawer" role="dialog" aria-label={`${displayName} profile`}>
      <div className="profile-v77-scroll">
        <div className="profile-v77-banner" style={{ '--profile-v77-accent': view.profileAccent || '#76509e' } as CSSProperties}>
          {view.bannerUrl && <AnimatedBackdrop src={view.bannerUrl} className="profile-v77-banner-media" mode="always" />}
          <button aria-label="Close profile" onClick={() => setOpen(null)}><Icon name="x" size={14}/></button>
        </div>
        <div className="profile-v77-identity">
          <span className="profile-v77-avatar"><Avatar name={displayName} initials={view.initials || displayName.slice(0, 1)} src={view.avatarUrl ?? null} size={82} accent={view.profileAccent}/><i className={`presence-symbol presence-${view.presence || 'offline'}`}/></span>
          <div><h2>{displayName}</h2><span>{username ? `@${username}` : 'Spaces member'}{view.publicUserId ? ` · #${view.publicUserId}` : ''}</span></div>
          {view.platformRole && <span className={`platform-verified-v55 platform-${view.platformRole}`}><Icon name="check" size={9}/> {platformRoleLabel(view.platformRole)}</span>}
          {view.customStatus && <p className="profile-v77-status">{view.customStatus}</p>}
          {view.bio && <p className="profile-v77-bio">{view.bio}</p>}
        </div>

        {loading && <div className="profile-v77-loading"><span/><span/><span/></div>}
        {error && !data && <div className="profile-v77-error"><Icon name="lock" size={14}/>{error}<small>The compact DM profile is still shown above.</small></div>}

        {data?.sharedSpaces?.length ? <section className="profile-v77-section"><header><Icon name="grid" size={14}/><strong>Shared Spaces</strong><small>{data.sharedSpaces.length}</small></header><div className="profile-v77-space-list">{data.sharedSpaces.map(space => <div key={space.id}><span><Icon name="grid" size={12}/></span><div><strong>{space.name}</strong><small>{space.role}</small></div></div>)}</div></section> : null}

        {data?.activeRestrictions?.length ? <section className="profile-v77-section staff"><header><Icon name="lock" size={14}/><strong>Active restrictions</strong><small>{data.activeRestrictions.length}</small></header><div className="profile-v77-mini-list">{data.activeRestrictions.map(item => <div key={item.id}><strong>{item.capability.replaceAll('_', ' ')}</strong><small>{item.reasonCategory}{item.expiresAt ? ` · until ${new Date(item.expiresAt).toLocaleString()}` : ' · until removed'}</small></div>)}</div></section> : null}

        {data?.recentCases?.length ? <section className="profile-v77-section staff"><header><Icon name="shield" size={14}/><strong>Recent Support cases</strong><small>{data.recentCases.length}</small></header><div className="profile-v77-mini-list">{data.recentCases.map(item => <div key={item.id}><strong>{item.caseNumber} · {item.subject}</strong><small>{item.status} · {timeAgo(item.updatedAt)}</small></div>)}</div></section> : null}

        <div className="profile-v77-actions">
          {!isSelf && <button className="primary-button" disabled={busy} onClick={() => void message()}><Icon name="message" size={14}/> Message</button>}
          {!isSelf && <button className="secondary-button" onClick={() => { dispatchSupportIntakeV77({ type: 'user_report', targetUserId: openUserId, targetUsername: username || null, targetDisplayName: displayName, source: 'member_context' }); setOpen(null) }}><Icon name="shield" size={14}/> Report</button>}
        </div>
      </div>
    </aside>
  </>
}
