import { useMemo, useState, type CSSProperties, type MouseEvent } from 'react'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { MemberProfileDrawer } from '../../components/MemberProfileDrawer'
import { useSpaces } from '../../state/SpacesContext'
import { usePreferences } from '../../state/PreferencesContext'
import { hasWorkspacePermission, platformRoleLabel } from '../../utils/permissions'
import { workspaceRoleDisplayName } from '../../utils/workspace-local-meta'

export function MembersView() {
  const { data, profile, setMemberRoles, pushToast } = useSpaces()
  const { effectivePresence, preferences } = usePreferences()
  const [selectedId, setSelectedId] = useState('')
  const [query, setQuery] = useState('')
  const [rolePickerId, setRolePickerId] = useState('')
  const [roleBusyId, setRoleBusyId] = useState('')

  const members = data?.members ?? []
  const roles = useMemo(() => [...(data?.roles ?? [])].sort((a, b) => b.position - a.position), [data?.roles])
  const currentMember = members.find(member => member.profileId === profile?.id)
  const isHubFounder = data?.workspace.id === 'spaces-hub' && profile?.platformRole === 'founder'
  const actorIsOwner = Boolean(
    isHubFounder ||
    currentMember?.role === 'owner' ||
    data?.workspace.ownerId === profile?.id,
  )
  const canManageRoles = isHubFounder || hasWorkspacePermission(data, profile?.id, 'manage_roles')
  const actorHighestRolePosition = actorIsOwner
    ? Number.POSITIVE_INFINITY
    : Math.max(
        roles
          .filter(role => currentMember?.customRoleIds.includes(role.id))
          .reduce((highest, role) => Math.max(highest, role.position), 0),
        currentMember?.role === 'admin' ? 3_000_000 : currentMember?.role === 'contributor' ? 2_000_000 : 0,
      )

  const search = query.trim().toLowerCase()
  const visibleMembers = useMemo(() => members.filter(member => {
    if (!search) return true
    const roleNames = roles.filter(role => member.customRoleIds.includes(role.id)).map(role => role.name).join(' ')
    return `${member.displayName} ${member.username} ${member.publicUserId} ${data?.workspace.id ? workspaceRoleDisplayName(data.workspace.id, member.role) : member.role} ${roleNames}`.toLowerCase().includes(search)
  }), [data?.workspace.id, members, roles, search])

  function memberHierarchyRank(member: (typeof members)[number]) {
    if (member.role === 'owner' || member.profileId === data?.workspace.ownerId) return Number.POSITIVE_INFINITY
    return Math.max(
      roles
        .filter(role => member.customRoleIds.includes(role.id))
        .reduce((highest, role) => Math.max(highest, role.position), 0),
      member.role === 'admin' ? 3_000_000 : member.role === 'contributor' ? 2_000_000 : 0,
    )
  }

  function canManageMember(member: (typeof members)[number]) {
    if (!canManageRoles || member.profileId === profile?.id || member.role === 'owner') return false
    return actorIsOwner || actorHighestRolePosition > memberHierarchyRank(member)
  }

  function presenceFor(member: (typeof members)[number]) {
    return member.profileId === profile?.id ? effectivePresence : member.status === 'away' ? 'idle' : member.status
  }

  async function toggleRole(member: (typeof members)[number], roleId: string) {
    if (!canManageMember(member)) return
    const role = roles.find(item => item.id === roleId)
    if (!role || (!actorIsOwner && role.position >= actorHighestRolePosition)) {
      pushToast('You can only assign roles below your highest role.', 'danger')
      return
    }

    const roleIds = member.customRoleIds.includes(roleId)
      ? member.customRoleIds.filter(id => id !== roleId)
      : [...member.customRoleIds, roleId]

    setRoleBusyId(member.id)
    try {
      await setMemberRoles(member.id, roleIds)
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not update roles.', 'danger')
    } finally {
      setRoleBusyId('')
    }
  }

  function toggleRolePicker(event: MouseEvent, memberId: string) {
    event.preventDefault()
    event.stopPropagation()
    setRolePickerId(current => current === memberId ? '' : memberId)
  }

  return (
    <div className="members-view view-scroll page-enter members-view-v15 members-view-v18 members-view-v63">
      {rolePickerId && <button className="people-role-picker-scrim-v63" aria-label="Close role picker" onClick={() => setRolePickerId('')} />}

      <div className="content-heading people-heading-v15 people-heading-v17">
        <div>
          <span className="eyebrow">COMMUNITY</span>
          <h1>People</h1>
          <p>Members, roles, presence, and quick actions in one place.</p>
          <label className="people-search-v15 people-search-v17">
            <Icon name="search" size={15}/>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search people or roles…" />
          </label>
        </div>
        <span className="big-count">{visibleMembers.length === members.length ? members.length : `${visibleMembers.length}/${members.length}`}</span>
      </div>

      <section className="people-bubble-grid people-grid-v63" aria-label="Space members">
        {visibleMembers.map((member, index) => {
          const memberRoles = roles.filter(role => member.customRoleIds.includes(role.id))
          const topRole = memberRoles[0]
          const baseRoleColor = member.role === 'owner'
            ? data?.baseRoles?.owner?.color
            : data?.baseRoles?.member?.color
          const roleColor = member.role === 'owner' ? baseRoleColor : (topRole?.color ?? baseRoleColor)
          const status = presenceFor(member)
          const roleLabel = topRole?.name ?? (data?.workspace.id ? workspaceRoleDisplayName(data.workspace.id, member.role) : member.role)
          const manageThisMember = canManageMember(member)
          const pickerOpen = rolePickerId === member.id

          return (
            <article
              className={`people-bubble people-card-v63 ${pickerOpen ? 'role-picker-open-v63' : ''}`}
              key={member.id}
              style={{
                '--people-role-color': roleColor ?? member.profileAccent ?? '#8b6ca8',
                '--people-float-delay': `${(index % 7) * -0.57}s`,
                '--people-float-distance': `${1.5 + (index % 3) * 0.55}px`,
                '--people-float-x': `${((index % 3) - 1) * 0.65}px`,
                '--people-float-duration': `${4.8 + (index % 4) * 0.42}s`,
              } as CSSProperties}
            >
              <button className="people-card-main-v63" onClick={() => setSelectedId(member.id)}>
                <span className="people-bubble-avatar profile-avatar-presence">
                  <Avatar name={member.displayName} initials={member.initials} src={member.avatarUrl} size={46} accent={roleColor} />
                  <i className={`presence-symbol presence-${status}`} />
                </span>
                <span className="people-bubble-copy">
                  <span className="people-name-line-v63">
                    <strong style={roleColor ? { color: roleColor } : undefined}>{member.displayName}</strong>
                    {member.platformRole && <em className={`people-platform-v63 platform-${member.platformRole}`}>{platformRoleLabel(member.platformRole)}</em>}
                  </span>
                  <small>
                    <i style={{ background: roleColor ?? undefined }} />
                    {roleLabel}
                    {preferences.developerMode && member.publicUserId ? ` · #${member.publicUserId}` : ''}
                  </small>
                </span>
                <Icon name="chevron" size={13}/>
              </button>

              <div className="people-role-line-v63">
                <div className="people-role-chips-v63">
                  <span className="people-role-chip-v63 base"><i style={{ background: baseRoleColor ?? undefined }}/>{data?.workspace.id ? workspaceRoleDisplayName(data.workspace.id, member.role) : member.role}</span>
                  {memberRoles.slice(0, 2).map(role => <span className="people-role-chip-v63" key={role.id} style={{ borderColor: role.color, color: role.color }}><i style={{ background: role.color }}/>{role.name}</span>)}
                  {memberRoles.length > 2 && <span className="people-role-more-v63">+{memberRoles.length - 2}</span>}
                </div>
                {manageThisMember && roles.length > 0 && (
                  <button className="people-role-add-v63" title={`Add or remove roles for ${member.displayName}`} onClick={event => toggleRolePicker(event, member.id)}>
                    <Icon name="plus" size={13}/>
                  </button>
                )}
              </div>

              {pickerOpen && (
                <aside className="people-role-picker-v63">
                  <header><div><span className="eyebrow">ROLES</span><strong>{member.displayName}</strong></div><button onClick={() => setRolePickerId('')} aria-label="Close"><Icon name="x" size={13}/></button></header>
                  <div>
                    {roles.map(role => {
                      const checked = member.customRoleIds.includes(role.id)
                      const allowed = actorIsOwner || role.position < actorHighestRolePosition
                      return (
                        <button
                          key={role.id}
                          disabled={!allowed || roleBusyId === member.id}
                          className={checked ? 'active' : ''}
                          onClick={() => void toggleRole(member, role.id)}
                        >
                          <i style={{ background: role.color }}/>
                          <span><strong>{role.name}</strong><small>{checked ? 'Assigned' : 'Not assigned'}</small></span>
                          {checked ? <Icon name="check" size={13}/> : <Icon name="plus" size={13}/>}
                        </button>
                      )
                    })}
                  </div>
                </aside>
              )}
            </article>
          )
        })}
        {!visibleMembers.length && <div className="people-empty-v15"><Icon name="members" size={22}/><strong>No people found</strong><span>Try another name or role.</span></div>}
      </section>

      {selectedId && <MemberProfileDrawer memberId={selectedId} onClose={() => setSelectedId('')} />}
    </div>
  )
}
