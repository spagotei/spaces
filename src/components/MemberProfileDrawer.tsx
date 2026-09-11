import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Avatar } from './Avatar'
import { AnimatedBackdrop } from './AnimatedImage'
import { Icon } from './Icon'
import { useSpaces } from '../state/SpacesContext'
import { useAppDialog } from './AppDialog'
import { usePreferences } from '../state/PreferencesContext'
import { timeAgo } from '../utils/format'
import { hasWorkspacePermission, platformRoleLabel } from '../utils/permissions'
import { workspaceRoleDisplayName } from '../utils/workspace-local-meta'

export function MemberProfileDrawer({ memberId, onClose }: { memberId: string; onClose: () => void }) {
  const dialog = useAppDialog()
  const {
    data, profile, setMemberRoles, removeMember, reportUser,
    pushToast, chooseChannel, setPlatformSupportRole, requestDirectConversation,
  } = useSpaces()
  const { preferences, effectivePresence } = usePreferences()
  const [savingRoles, setSavingRoles] = useState(false)
  const [savingAccess, setSavingAccess] = useState(false)
  const [reporting, setReporting] = useState(false)

  const members = data?.members ?? []
  const member = members.find(item => item.id === memberId) ?? null
  const roles = useMemo(() => [...(data?.roles ?? [])].sort((a, b) => b.position - a.position), [data?.roles])
  const memberRoles = useMemo(() => roles.filter(role => member?.customRoleIds.includes(role.id)), [member?.customRoleIds, roles])
  const currentMember = members.find(item => item.profileId === profile?.id) ?? null
  const isHubFounder = data?.workspace.id === 'spaces-hub' && profile?.platformRole === 'founder'
  const canManageRoles = isHubFounder || hasWorkspacePermission(data, profile?.id, 'manage_roles')
  const canManageMembers = isHubFounder || hasWorkspacePermission(data, profile?.id, 'manage_members')
  const canManagePlatformSupport = profile?.platformRole === 'founder'
  const actorIsOwner = Boolean(currentMember?.role === 'owner' || data?.workspace.ownerId === profile?.id || isHubFounder)
  const actorHighestRolePosition = actorIsOwner
    ? Number.POSITIVE_INFINITY
    : Math.max(
      roles.filter(role => currentMember?.customRoleIds.includes(role.id)).reduce((highest, role) => Math.max(highest, role.position), 0),
      currentMember?.role === 'admin' ? 3_000_000 : currentMember?.role === 'contributor' ? 2_000_000 : 0,
    )
  const targetHighestRolePosition = member?.role === 'owner' || member?.profileId === data?.workspace.ownerId
    ? Number.POSITIVE_INFINITY
    : Math.max(
      roles.filter(role => member?.customRoleIds.includes(role.id)).reduce((highest, role) => Math.max(highest, role.position), 0),
      member?.role === 'admin' ? 3_000_000 : member?.role === 'contributor' ? 2_000_000 : 0,
    )
  const targetIsBelowActor = actorIsOwner || actorHighestRolePosition > targetHighestRolePosition
  const canManageSelected = Boolean(
    member && member.profileId !== profile?.id && member.role !== 'owner' && canManageMembers && targetIsBelowActor,
  )
  const canAssignRolesToSelected = Boolean(
    member && member.profileId !== profile?.id && member.role !== 'owner' && canManageRoles && targetIsBelowActor,
  )

  const contributions = useMemo(() => {
    if (!member || !data) return []
    return data.notes
      .filter(note => note.createdBy === member.profileId || note.updatedBy === member.profileId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5)
      .map(note => ({ ...note, action: note.createdBy === member.profileId ? 'Created' : 'Edited' }))
  }, [data, member])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  if (!member) return null

  const status = member.profileId === profile?.id
    ? effectivePresence
    : member.status === 'away' ? 'idle' : member.status
  const statusLabel = status === 'dnd' ? 'Do Not Disturb' : status === 'offline' ? 'Offline' : status === 'idle' ? 'Idle' : 'Online'
  const customStatus = member.profileId === profile?.id ? preferences.customStatus.trim() : ''
  const topRole = memberRoles[0]

  async function toggleRole(roleId: string) {
    if (!member || !canAssignRolesToSelected) return
    const role = roles.find(item => item.id === roleId)
    if (!role || (!actorIsOwner && role.position >= actorHighestRolePosition)) {
      pushToast('You can only assign roles below your highest role.', 'danger')
      return
    }
    const next = member.customRoleIds.includes(roleId)
      ? member.customRoleIds.filter(id => id !== roleId)
      : [...member.customRoleIds, roleId]
    setSavingRoles(true)
    try { await setMemberRoles(member.id, next) }
    catch (error) { pushToast(error instanceof Error ? error.message : 'Could not update roles.', 'danger') }
    finally { setSavingRoles(false) }
  }

  async function reportMember() {
    if (!member || member.profileId === profile?.id) return
    const reason = await dialog.prompt({
      title: `Report ${member.displayName}`,
      message: 'Tell Spaces moderation the main reason for this report.',
      label: 'Reason',
      placeholder: 'Spam, harassment, unsafe content…',
      confirmText: 'Next',
      maxLength: 120,
    })
    if (!reason) return
    const details = await dialog.prompt({
      title: 'Add context',
      message: 'Optional: include anything moderators should know. Leave it blank by pressing Cancel if there is nothing else.',
      label: 'Context',
      placeholder: 'What happened?',
      confirmText: 'Send report',
      maxLength: 500,
    })
    setReporting(true)
    try { await reportUser(member.profileId, reason, details ?? '') }
    catch (error) { pushToast(error instanceof Error ? error.message : 'Could not send report.', 'danger') }
    finally { setReporting(false) }
  }

  async function kickMember() {
    if (!member || !canManageSelected) return
    const confirmed = await dialog.confirm({ title: `Remove ${member.displayName}?`, message: 'They will leave this Space and need a valid invite to rejoin.', confirmText: 'Remove member', danger: true })
    if (!confirmed) return
    setSavingAccess(true)
    try { await removeMember(member.id); onClose() }
    catch (error) { pushToast(error instanceof Error ? error.message : 'Could not remove that member.', 'danger') }
    finally { setSavingAccess(false) }
  }


  async function messageMember() {
    if (!member || member.profileId === profile?.id || !data?.workspace.id) return
    setSavingAccess(true)
    try {
      const conversation = await requestDirectConversation({ targetUserId: member.profileId, sourceWorkspaceId: data.workspace.id })
      window.dispatchEvent(new CustomEvent('spaces-open-direct-center', { detail: { conversationId: conversation.id } }))
      onClose()
      if (conversation.status === 'pending') pushToast(`Message request sent to ${member.displayName}.`, 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not open a direct conversation.', 'danger')
    } finally { setSavingAccess(false) }
  }

  async function togglePlatformSupport() {
    if (!member || !canManagePlatformSupport || member.platformRole === 'founder') return
    const granting = member.platformRole !== 'support'
    const confirmed = await dialog.confirm({
      title: granting ? `Grant Support to ${member.displayName}?` : `Remove Support from ${member.displayName}?`,
      message: granting ? 'Support can open the platform Support Console and help with non-destructive support tools. Founder and Staff moderation powers remain separate.' : 'Their platform Support Console access will be removed.',
      confirmText: granting ? 'Grant Support' : 'Remove Support',
      danger: false,
    })
    if (!confirmed) return
    setSavingAccess(true)
    try { await setPlatformSupportRole(member.profileId, granting ? 'support' : null) }
    catch (error) { pushToast(error instanceof Error ? error.message : 'Could not update platform access.', 'danger') }
    finally { setSavingAccess(false) }
  }

  return (
    <>
      <button className="member-profile-scrim" aria-label="Close profile" onPointerDown={onClose} />
      <aside className="member-profile-drawer" role="dialog" aria-modal="true" aria-label={`${member.displayName} profile`}>
        <div className="member-profile-drawer-scroll">
          <div
            className="member-profile-drawer-banner"
            style={{ '--member-profile-accent': member.profileAccent } as CSSProperties}
          >
            {member.bannerUrl && <AnimatedBackdrop src={member.bannerUrl} className="member-profile-banner-media-v41" mode="always"/>}
            <button className="profile-drawer-close" aria-label="Close profile" onClick={onClose}><Icon name="x" size={15} /></button>
          </div>

          <div className="member-profile-drawer-identity">
            <span className="drawer-avatar profile-avatar-presence">
              <Avatar name={member.displayName} initials={member.initials} src={member.avatarUrl} size={78} accent={topRole?.color} animation="always" />
              <i className={`presence-symbol presence-${status}`} />
            </span>
            <div className="drawer-name-row">
              <div><h2 style={topRole ? { color: topRole.color } : undefined}>{member.displayName}</h2><span>@{member.username}</span></div>
              <span className={`drawer-presence-label presence-text presence-text-${status}`}>{statusLabel}</span>
            </div>
            {preferences.developerMode && member.publicUserId && <button className="developer-id-chip-v21" onClick={() => { void navigator.clipboard?.writeText(member.publicUserId); pushToast(`Copied Spaces ID #${member.publicUserId}.`, 'success') }}><Icon name="copy" size={11}/> Spaces ID #{member.publicUserId}</button>}
            {customStatus && <p className="drawer-custom-status">{customStatus}</p>}
            {member.bio && <p className="drawer-bio">{member.bio}</p>}
            {member.platformRole && <><span className={`founder-badge drawer-platform-badge platform-${member.platformRole} ${member.platformRole === 'founder' ? 'founder-distinct-v56' : ''}`}><Icon name={member.platformRole === 'founder' ? 'sparkle' : 'shield'} size={12}/>{platformRoleLabel(member.platformRole)}</span><span className={`platform-verified-v55 drawer-verified-v55 platform-${member.platformRole}`} title={`${platformRoleLabel(member.platformRole)} · verified by Spaces`}><Icon name="check" size={10}/>VERIFIED</span></>}
          </div>

          <section className="drawer-section">
            <div className="drawer-section-heading"><span><Icon name="roles" size={14}/><strong>Roles</strong></span><small>{1 + memberRoles.length + (member.platformRole ? 1 : 0)}</small></div>
            <div className="drawer-role-chips">
              {member.platformRole && <span className={`profile-role-chip platform-role-chip platform-${member.platformRole} ${member.platformRole === 'founder' ? 'founder-distinct-v56' : ''}`}><Icon name={member.platformRole === 'founder' ? 'sparkle' : 'shield'} size={11}/>{platformRoleLabel(member.platformRole)}</span>}
              <span className={`profile-role-chip base role-${member.role}`}><Icon name={member.role === 'owner' ? 'shield' : 'roles'} size={11}/>{data?.workspace.id ? workspaceRoleDisplayName(data.workspace.id, member.role) : member.role}</span>
              {memberRoles.map(role => <span className="profile-role-chip" key={role.id} style={{ color: role.color, borderColor: role.color }}><i style={{ background: role.color }}/>{role.name}</span>)}
            </div>
            {canManageRoles && roles.length > 0 && member.role !== 'owner' && <div className="drawer-role-picker">
              {roles.map(role => { const roleAllowed = canAssignRolesToSelected && (actorIsOwner || role.position < actorHighestRolePosition); return <label key={role.id} className={!roleAllowed ? 'hierarchy-locked-v35' : undefined}><input type="checkbox" disabled={savingRoles || !roleAllowed} checked={member.customRoleIds.includes(role.id)} onChange={() => void toggleRole(role.id)} /><span className="role-swatch" style={{ background: role.color }}/><span>{role.name}</span>{member.customRoleIds.includes(role.id) && <Icon name="check" size={13}/>}</label> })}
            </div>}
          </section>

          {canManagePlatformSupport && member.profileId !== profile?.id && (member.platformRole === null || member.platformRole === 'support') && <section className="drawer-section platform-access-section-v16">
            <div className="drawer-section-heading"><span><Icon name="shield" size={14}/><strong>Platform access</strong></span><small>Founder only</small></div>
            <div className="platform-support-control-v16"><div><strong>Support</strong><span>Lets this account open the Support Console without granting full platform moderation.</span></div><button className={member.platformRole === 'support' ? 'secondary-button compact' : 'primary-button compact'} disabled={savingAccess} onClick={() => void togglePlatformSupport()}>{member.platformRole === 'support' ? 'Remove Support' : 'Grant Support'}</button></div>
          </section>}

          <section className="drawer-section">
            <div className="drawer-section-heading"><span><Icon name="notes" size={14}/><strong>Recent contributions</strong></span></div>
            {contributions.length ? <div className="drawer-contributions">{contributions.map(item => <button key={item.id} onClick={() => { chooseChannel(item.channelId); onClose() }}><span className="contribution-icon"><Icon name="notes" size={13}/></span><span><strong>{item.title}</strong><small>{item.action} · v{item.version} · {timeAgo(item.updatedAt)}</small></span><Icon name="chevron" size={12}/></button>)}</div> : <p className="drawer-empty-copy">No note contributions yet.</p>}
          </section>

          <div className="drawer-actions">
            {member.profileId !== profile?.id && <button className="secondary-button" disabled={savingAccess} onClick={() => void messageMember()}><Icon name="message" size={14}/> Message</button>}
            {member.profileId !== profile?.id && <button className="secondary-button" disabled={reporting} onClick={() => void reportMember()}><Icon name="shield" size={14}/> Report</button>}
            {canManageSelected && <button className="ghost-danger" disabled={savingAccess} onClick={() => void kickMember()}><Icon name="trash" size={14}/> Remove</button>}
          </div>
        </div>
      </aside>
    </>
  )
}
