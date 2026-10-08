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
import { ContextMenu, useContextMenu, type ContextAction } from './ContextMenu'
import { useBlockedUserIds } from '../hooks/useBlockedUsers'
import { blockUser, unblockUser } from '../api/social-api'
import { dispatchSupportIntakeV77 } from '../features/support/v77/support-v77-api'

export function MemberProfileDrawer({ memberId, onClose }: { memberId: string; onClose: () => void }) {
  const dialog = useAppDialog()
  const {
    data, profile, session, setMemberRoles, removeMember, reportUser,
    pushToast, chooseChannel, requestDirectConversation,
    getDirectCenter, acceptDirectConversation,
  } = useSpaces()
  const { preferences, effectivePresence } = usePreferences()
  const [savingAccess, setSavingAccess] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [relationship, setRelationship] = useState<'loading' | 'none' | 'friend' | 'incoming' | 'outgoing'>('loading')
  const [relationshipConversationId, setRelationshipConversationId] = useState<string | null>(null)
  const quickMenu = useContextMenu()
  const blockedUserIds = useBlockedUserIds(session?.token)

  const members = data?.members ?? []
  const member = members.find(item => item.id === memberId) ?? null
  const roles = useMemo(() => [...(data?.roles ?? [])].sort((a, b) => b.position - a.position), [data?.roles])
  const memberRoles = useMemo(() => roles.filter(role => member?.customRoleIds.includes(role.id)), [member?.customRoleIds, roles])
  const currentMember = members.find(item => item.profileId === profile?.id) ?? null
  const isHubFounder = data?.workspace.id === 'spaces-hub' && profile?.platformRole === 'founder'
  const canManageMembers = isHubFounder || hasWorkspacePermission(data, profile?.id, 'manage_members')
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

  const contributions = useMemo(() => {
    if (!member || !data) return []
    return data.notes
      .filter(note => note.createdBy === member.profileId || note.updatedBy === member.profileId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5)
      .map(note => ({ ...note, action: note.createdBy === member.profileId ? 'Created' : 'Edited' }))
  }, [data, member])

  useEffect(() => {
    let cancelled = false
    const loadRelationship = async () => {
      if (!member || member.profileId === profile?.id) return
      setRelationship('loading')
      setRelationshipConversationId(null)
      try {
        const center = await getDirectCenter()
        const acceptedFriends = (
          center as typeof center & { friends?: typeof center.conversations }
        ).friends ?? center.conversations

        const all = [
          ...acceptedFriends,
          ...center.incomingRequests,
          ...center.outgoingRequests,
        ]
        const item = all.find(row => row.person.id === member.profileId)
        if (cancelled) return
        setRelationshipConversationId(item?.id ?? null)
        setRelationship(
          !item
            ? 'none'
            : item.status === 'accepted'
              ? 'friend'
              : item.requestedByMe
                ? 'outgoing'
                : 'incoming',
        )
      } catch {
        if (!cancelled) {
          setRelationship('none')
          setRelationshipConversationId(null)
        }
      }
    }
    void loadRelationship()
    return () => { cancelled = true }
  }, [getDirectCenter, member?.profileId, profile?.id])

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
  const customStatus = member.profileId === profile?.id
    ? preferences.customStatus.trim()
    : member.customStatus?.trim() ?? ''
  const isBlocked = blockedUserIds.includes(member.profileId)
  const topRole = memberRoles[0]

  async function reportMember() {
    if (!member || member.profileId === profile?.id) return
    dispatchSupportIntakeV77({ type: 'user_report', targetUserId: member.profileId, targetUsername: member.username, targetDisplayName: member.displayName, source: 'member_context' })
  }
  async function kickMember() {
    if (!member || !canManageSelected) return
    const confirmed = await dialog.confirm({ title: `Kick ${member.displayName}?`, message: 'They will leave this Space and need a valid invite to rejoin.', confirmText: 'Kick from Space', danger: true })
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

  async function addFriendFromProfile() {
    if (!member || member.profileId === profile?.id || isBlocked) return
    setSavingAccess(true)
    try {
      if (relationship === 'incoming' && relationshipConversationId) {
        await acceptDirectConversation(relationshipConversationId)
        setRelationship('friend')
        pushToast(`${member.displayName} is now your friend.`, 'success')
        return
      }
      const conversation = await requestDirectConversation({
        targetUserId: member.profileId,
        sourceWorkspaceId: data?.workspace.id ?? null,
      })
      setRelationshipConversationId(conversation.id)
      setRelationship(conversation.status === 'accepted' ? 'friend' : conversation.requestedByMe ? 'outgoing' : 'incoming')
      pushToast(
        conversation.status === 'accepted'
          ? `${member.displayName} is now your friend.`
          : `Friend request sent to ${member.displayName}.`,
        'success',
      )
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not update friend request.', 'danger')
    } finally {
      setSavingAccess(false)
    }
  }

  async function toggleBlockFromProfile() {
    if (!member || member.profileId === profile?.id || !session?.token) return

    if (!isBlocked) {
      const confirmed = await dialog.confirm({
        title: `Block ${member.displayName}?`,
        message: 'They will be removed from your Friends list. Their Space and group messages stay available as hidden messages you can reveal manually.',
        confirmText: 'Block',
        danger: true,
      })
      if (!confirmed) return
    }

    setSavingAccess(true)
    try {
      if (isBlocked) {
        await unblockUser(session.token, member.profileId)
        pushToast(`${member.displayName} unblocked. You can send a new friend request whenever you want.`, 'success')
      } else {
        await blockUser(session.token, member.profileId)
        setRelationship('none')
        setRelationshipConversationId(null)
        pushToast(`${member.displayName} blocked.`, 'success')
      }
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not update block.', 'danger')
    } finally {
      setSavingAccess(false)
    }
  }

  const roleOptionsV68 = [...(data?.roles ?? [])].sort((a, b) => b.position - a.position)
  const currentMemberV68 = data?.members.find(item => item.profileId === profile?.id)
  const actorIsOwnerV68 = Boolean(
    (data?.workspace.id === 'spaces-hub' && profile?.platformRole === 'founder') ||
    currentMemberV68?.role === 'owner' ||
    data?.workspace.ownerId === profile?.id
  )
  const actorCanManageRolesV68 =
    (data?.workspace.id === 'spaces-hub' && profile?.platformRole === 'founder') ||
    hasWorkspacePermission(data, profile?.id, 'manage_roles')

  const actorHighestRoleV68 = actorIsOwnerV68
    ? Number.POSITIVE_INFINITY
    : Math.max(
        ...roleOptionsV68
          .filter(role => currentMemberV68?.customRoleIds.includes(role.id))
          .map(role => role.position),
        currentMemberV68?.role === 'admin'
          ? 3_000_000
          : currentMemberV68?.role === 'contributor'
            ? 2_000_000
            : 0,
      )

  const selectedHighestRoleV68 = Math.max(
    ...roleOptionsV68
      .filter(role => member.customRoleIds.includes(role.id))
      .map(role => role.position),
    member.role === 'owner'
      ? Number.POSITIVE_INFINITY
      : member.role === 'admin'
        ? 3_000_000
        : member.role === 'contributor'
          ? 2_000_000
          : 0,
  )

  const canAssignProfileRolesV68 = Boolean(
    member.profileId !== profile?.id &&
    member.role !== 'owner' &&
    actorCanManageRolesV68 &&
    (actorIsOwnerV68 || actorHighestRoleV68 > selectedHighestRoleV68),
  )

  async function toggleProfileRoleV68(roleId: string) {
    if (!member || !canAssignProfileRolesV68) return

    const role = roleOptionsV68.find(item => item.id === roleId)
    if (!role || (!actorIsOwnerV68 && role.position >= actorHighestRoleV68)) {
      pushToast('You can only assign roles below your highest role.', 'danger')
      return
    }

    const nextRoleIds = member.customRoleIds.includes(roleId)
      ? member.customRoleIds.filter(id => id !== roleId)
      : [...member.customRoleIds, roleId]

    setSavingAccess(true)
    try {
      await setMemberRoles(member.id, nextRoleIds)
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not update roles.', 'danger')
    } finally {
      setSavingAccess(false)
    }
  }

  const profileRoleActionsV68: ContextAction[] = roleOptionsV68
    .filter(role => actorIsOwnerV68 || role.position < actorHighestRoleV68)
    .map(role => ({
      id: `profile-role:${role.id}`,
      label: role.name,
      icon: 'shield',
      checked: member.customRoleIds.includes(role.id),
      disabled: savingAccess,
      onSelect: () => toggleProfileRoleV68(role.id),
    }))

  const canRemoveFromSpace = Boolean(
    member.profileId !== profile?.id &&
    member.role !== 'owner' &&
    (
      profile?.platformRole === 'founder' ||
      data?.workspace.ownerId === profile?.id ||
      data?.members.find(item => item.profileId === profile?.id)?.role === 'admin'
    ),
  )

  async function reportFromProfile() {
    if (!member || member.profileId === profile?.id) return

    const reason = await dialog.prompt({
      title: `Report ${member.displayName}`,
      message: 'Tell Spaces what happened. Reports are reviewed by the Support team.',
      label: 'Reason',
      placeholder: 'Harassment, spam, impersonation…',
      maxLength: 120,
      confirmText: 'Continue',
      danger: true,
    })
    if (!reason) return

    const details = await dialog.prompt({
      title: 'Add details',
      message: 'Include any context that would help review this report.',
      label: 'Details',
      placeholder: 'What happened?',
      maxLength: 900,
      confirmText: 'Send report',
      danger: true,
    })
    if (!details) return

    setReporting(true)
    try {
      await reportUser(member.profileId, reason, details)
      pushToast('Report sent to Spaces moderation.', 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not send report.', 'danger')
    } finally {
      setReporting(false)
    }
  }

  async function removeFromSpaceProfile() {
    if (!member || !canRemoveFromSpace) return

    const confirmed = await dialog.confirm({
      title: `Remove ${member.displayName} from this Space?`,
      message: 'This removes them from the current Space. Their Spaces account is not deleted.',
      confirmText: 'Remove from Space',
      danger: true,
    })
    if (!confirmed) return

    setSavingAccess(true)
    try {
      await removeMember(member.id)
      pushToast(`${member.displayName} removed from the Space.`, 'success')
      onClose()
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not remove member.', 'danger')
    } finally {
      setSavingAccess(false)
    }
  }

  const actorCanManageRolesV70 = isHubFounder || hasWorkspacePermission(data, profile?.id, 'manage_roles')
  const canAssignProfileRolesV70 = Boolean(member && member.profileId !== profile?.id && member.role !== 'owner' && actorCanManageRolesV70 && targetIsBelowActor)
  async function toggleProfileRoleV70(roleId: string) {
    if (!member || !canAssignProfileRolesV70) return
    const role = roles.find(item => item.id === roleId)
    if (!role || (!actorIsOwner && role.position >= actorHighestRolePosition)) {
      pushToast('You can only assign roles below your highest role.', 'danger')
      return
    }
    const nextRoleIds = member.customRoleIds.includes(roleId) ? member.customRoleIds.filter(id => id !== roleId) : [...member.customRoleIds, roleId]
    setSavingAccess(true)
    try { await setMemberRoles(member.id, nextRoleIds) }
    catch (error) { pushToast(error instanceof Error ? error.message : 'Could not update roles.', 'danger') }
    finally { setSavingAccess(false) }
  }
  const profileRoleActionsV70: ContextAction[] = roles
    .filter(role => actorIsOwner || role.position < actorHighestRolePosition)
    .map(role => ({ id: `profile-role:${role.id}`, label: role.name, icon: 'roles', checked: member.customRoleIds.includes(role.id), disabled: savingAccess, onSelect: () => toggleProfileRoleV70(role.id) }))

  const socialActions: ContextAction[] = member.profileId === profile?.id
    ? []
    : [
        {
          id: 'message',
          label: 'Message',
          note: isBlocked ? 'Unblock before messaging' : 'Open direct messages',
          icon: 'message',
          disabled: isBlocked,
          onSelect: () => messageMember(),
        },
        {
          id: 'friend',
          label:
            relationship === 'loading' ? 'Checking friendship…'
              : relationship === 'friend' ? 'Friends'
                : relationship === 'outgoing' ? 'Request sent'
                  : relationship === 'incoming' ? 'Accept friend request'
                    : 'Add Friend',
          icon: relationship === 'friend' ? 'check' : 'plus',
          checked: relationship === 'friend',
          disabled:
            isBlocked ||
            relationship === 'loading' ||
            relationship === 'friend' ||
            relationship === 'outgoing',
          onSelect: () => addFriendFromProfile(),
        },
        {
          id: 'report',
          label: 'Report',
          note: 'Send this account to Spaces moderation',
          icon: 'shield',
          disabled: reporting,
          onSelect: () => reportFromProfile(),
        },
        ...(canAssignProfileRolesV68 && profileRoleActionsV68.length
          ? [{
              id: 'roles-v68',
              label: 'Roles',
              icon: 'shield',
              separatorBefore: true,
              submenu: profileRoleActionsV68,
            } satisfies ContextAction]
          : []),
        ...(canAssignProfileRolesV70 && profileRoleActionsV70.length ? [{ id: 'roles-v70', label: 'Roles', icon: 'roles', separatorBefore: true, submenu: profileRoleActionsV70 } satisfies ContextAction] : []),
        {
          id: 'block',
          label: isBlocked ? 'Unblock' : 'Block',
          note: isBlocked ? 'Allow direct contact again' : 'Hide messages and stop direct contact',
          icon: 'lock',
          danger: !isBlocked,
          checked: isBlocked,
          onSelect: () => toggleBlockFromProfile(),
        },
        ...(canRemoveFromSpace
          ? [{
              id: 'remove',
              label: 'Remove from Space',
              note: 'Space moderation action',
              icon: 'x',
              danger: true,
              onSelect: () => removeFromSpaceProfile(),
            } satisfies ContextAction]
          : []),
      ]

  return (
    <>
      <button className="member-profile-scrim" aria-label="Close profile" onPointerDown={onClose} />
      <aside
        className="member-profile-drawer profile-clean-v63"
        role="dialog"
        aria-modal="true"
        aria-label={`${member.displayName} profile`}
        {...(socialActions.length ? quickMenu.bind(member.displayName, socialActions, `@${member.username}`) : {})}
      >
        <div className="member-profile-drawer-scroll">
          <div
            className="member-profile-drawer-banner"
            style={{ '--member-profile-accent': member.profileAccent } as CSSProperties}
          >
            {member.bannerUrl && <AnimatedBackdrop src={member.bannerUrl} className="member-profile-banner-media-v41" mode="always"/>}
            <button className="profile-drawer-close profile-close-v65" aria-label="Close profile" onClick={onClose}><Icon name="x" size={15} /></button>
          </div>

          <div className="member-profile-drawer-identity">
            <span className="drawer-avatar profile-avatar-presence">
              <Avatar name={member.displayName} initials={member.initials} src={member.avatarUrl} size={78} accent={topRole?.color} animation="always" />
              <i className={`presence-symbol presence-${status}`} />
              {/* SPACES_V81_3_FOUNDER_SHIELD: platform team, never per-Space roles. */}
              {profile?.platformRole === 'founder' && member.profileId !== profile.id && <button type="button" className="spaces-founder-shield-v813 spaces-founder-profile-shield-v813" aria-label={`Manage Spaces Staff and Support for ${member.displayName}`} title="Founder · Manage Spaces team" onClick={() => { window.dispatchEvent(new CustomEvent('spaces-founder-team-v813', { detail: { username: member.username } })); onClose() }}><Icon name="shield" size={14}/></button>}
            </span>
            <div className="drawer-name-row">
              <div><h2 style={topRole ? { color: topRole.color } : undefined}>{member.displayName}</h2><span>@{member.username}</span></div>
              <span className={`drawer-presence-label presence-text presence-text-${status}`}>{statusLabel}</span>
            </div>
            {preferences.developerMode && member.publicUserId && <button className="developer-id-chip-v21" onClick={() => { void navigator.clipboard?.writeText(member.publicUserId); pushToast(`Copied Spaces ID #${member.publicUserId}.`, 'success') }}><Icon name="copy" size={11}/> Spaces ID #{member.publicUserId}</button>}
            {customStatus && <p className="drawer-custom-status">{customStatus}</p>}
            {member.bio && <p className="drawer-bio">{member.bio}</p>}
            {member.platformRole && <><span className={`founder-badge drawer-platform-badge platform-${member.platformRole} ${member.platformRole === 'founder' ? 'founder-distinct-v56' : ''}`}><Icon name={member.platformRole === 'founder' ? 'sparkle' : 'shield'} size={12}/>{platformRoleLabel(member.platformRole)}</span><span className={`platform-verified-v55 drawer-verified-v55 platform-${member.platformRole}`} title={`${platformRoleLabel(member.platformRole)} · verified by Spaces`}><Icon name="check" size={10}/>VERIFIED</span></>}
            {member.profileId !== profile?.id && <div className="profile-command-bar-v65">
              <button
                type="button"
                className="profile-command-v65 primary"
                disabled={savingAccess || isBlocked}
                onClick={() => void messageMember()}
                title="Message"
                aria-label="Message"
              >
                <Icon name="message" size={14}/>
                <span>Message</span>
              </button>

              <button
                type="button"
                className="profile-command-v65"
                disabled={
                  savingAccess ||
                  isBlocked ||
                  relationship === 'loading' ||
                  relationship === 'friend' ||
                  relationship === 'outgoing'
                }
                onClick={() => void addFriendFromProfile()}
                title={
                  relationship === 'loading' ? 'Checking friendship'
                    : relationship === 'friend' ? 'Friends'
                      : relationship === 'outgoing' ? 'Request sent'
                        : relationship === 'incoming' ? 'Accept friend request'
                          : 'Add Friend'
                }
                aria-label={
                  relationship === 'loading' ? 'Checking friendship'
                    : relationship === 'friend' ? 'Friends'
                      : relationship === 'outgoing' ? 'Request sent'
                        : relationship === 'incoming' ? 'Accept friend request'
                          : 'Add Friend'
                }
              >
                <Icon
                  name={
                    relationship === 'friend' ? 'check'
                      : relationship === 'incoming' ? 'members'
                        : 'plus'
                  }
                  size={14}
                />
                <span>
                  {relationship === 'loading' ? 'Checking…'
                    : relationship === 'friend' ? 'Friends'
                      : relationship === 'outgoing' ? 'Sent'
                        : relationship === 'incoming' ? 'Accept'
                          : 'Add Friend'}
                </span>
              </button>

              <button
                type="button"
                className="profile-command-v65 icon-only"
                title="More actions"
                aria-label="More actions"
                onClick={event => {
                  const rect = event.currentTarget.getBoundingClientRect()
                  quickMenu.open(
                    member.displayName,
                    socialActions,
                    Math.max(8, rect.right - 12),
                    rect.bottom + 6,
                    `@${member.username}`,
                  )
                }}
              >
                <span className="profile-more-glyph-v65" aria-hidden="true">•••</span>
              </button>
            </div>}
          </div>

          <section className="drawer-section">
            <div className="drawer-section-heading"><span><Icon name="roles" size={14}/><strong>Roles</strong>{canAssignProfileRolesV68 && profileRoleActionsV68.length > 0 && (
              <button
                type="button"
                className="profile-role-add-v68"
                title="Add or remove roles"
                aria-label="Add or remove roles"
                onClick={event => {
                  const rect = event.currentTarget.getBoundingClientRect()
                  quickMenu.open(
                    'Roles',
                    profileRoleActionsV68,
                    rect.right + 6,
                    rect.bottom + 4,
                    member.displayName,
                  )
                }}
              >
                <Icon name="plus" size={12}/>
              </button>
            )}</span><small>{1 + memberRoles.length + (member.platformRole ? 1 : 0)}</small></div>
            <div className="drawer-role-chips">
              {member.platformRole && <span className={`profile-role-chip platform-role-chip platform-${member.platformRole} ${member.platformRole === 'founder' ? 'founder-distinct-v56' : ''}`}><Icon name={member.platformRole === 'founder' ? 'sparkle' : 'shield'} size={11}/>{platformRoleLabel(member.platformRole)}</span>}
              <span className={`profile-role-chip base role-${member.role}`}><Icon name={member.role === 'owner' ? 'shield' : 'roles'} size={11}/>{data?.workspace.id ? workspaceRoleDisplayName(data.workspace.id, member.role) : member.role}</span>
              {memberRoles.map(role => <span className="profile-role-chip" key={role.id} style={{ color: role.color, borderColor: role.color }}><i style={{ background: role.color }}/>{role.name}</span>)}
            </div>

          </section>

          <section className="drawer-section">
            <div className="drawer-section-heading"><span><Icon name="notes" size={14}/><strong>Recent contributions</strong></span></div>
            {contributions.length ? <div className="drawer-contributions">{contributions.map(item => <button key={item.id} onClick={() => { chooseChannel(item.channelId); onClose() }}><span className="contribution-icon"><Icon name="notes" size={13}/></span><span><strong>{item.title}</strong><small>{item.action} · v{item.version} · {timeAgo(item.updatedAt)}</small></span><Icon name="chevron" size={12}/></button>)}</div> : <p className="drawer-empty-copy">No note contributions yet.</p>}
          </section>

          <div className="drawer-actions">
            {member.profileId !== profile?.id && <button className="secondary-button" disabled={savingAccess} onClick={() => void messageMember()}><Icon name="message" size={14}/> Message</button>}
            {member.profileId !== profile?.id && <button className="secondary-button" disabled={reporting} onClick={() => void reportMember()}><Icon name="shield" size={14}/> Report</button>}
            {canManageSelected && <button className="ghost-danger" disabled={savingAccess} onClick={() => void kickMember()}><Icon name="logout" size={14}/> Kick</button>}
          </div>
        </div>
      </aside>
      <ContextMenu menu={quickMenu.menu} onClose={quickMenu.close} />
    </>
  )
}
