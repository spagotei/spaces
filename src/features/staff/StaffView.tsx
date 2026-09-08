import { useMemo, useState } from 'react'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { useSpaces } from '../../state/SpacesContext'
import { hasWorkspacePermission } from '../../utils/permissions'
import { workspaceRoleDisplayName } from '../../utils/workspace-local-meta'
import type { WorkspaceMember } from '../../types/spaces'

const staffPermissionKeys = new Set([
  'manage_members',
  'manage_roles',
  'manage_space',
  'manage_channels',
  'moderate_messages',
  'moderate_comments',
  'view_audit_log',
])

export function StaffView() {
  const { data, profile, setView } = useSpaces()
  const [query, setQuery] = useState('')

  const members = data?.members ?? []
  const roles = useMemo(() => [...(data?.roles ?? [])].sort((a, b) => b.position - a.position), [data?.roles])
  const canModerate = hasWorkspacePermission(data, profile?.id, 'moderate_messages') || hasWorkspacePermission(data, profile?.id, 'moderate_comments')
  const canMembers = hasWorkspacePermission(data, profile?.id, 'manage_members')
  const canRoles = hasWorkspacePermission(data, profile?.id, 'manage_roles')
  const canAudit = hasWorkspacePermission(data, profile?.id, 'view_audit_log')
  const canSettings = hasWorkspacePermission(data, profile?.id, 'manage_space') || hasWorkspacePermission(data, profile?.id, 'manage_channels')
  const allowed = canModerate || canMembers || canRoles || canAudit || canSettings

  const customStaffRoleIds = useMemo(() => new Set(
    roles
      .filter(role => role.permissions.some(permission => staffPermissionKeys.has(permission)))
      .map(role => role.id),
  ), [roles])

  const isSpaceStaff = (member: WorkspaceMember) => (
    member.role === 'owner' ||
    // Legacy compatibility until an owner opens Roles & Permissions and the old
    // Administrator/Staff access levels are converted into ordinary roles.
    member.role === 'admin' || member.role === 'contributor' ||
    member.customRoleIds.some(roleId => customStaffRoleIds.has(roleId))
  )

  const staffMembers = useMemo(() => {
    const search = query.trim().toLowerCase()
    return members.filter(isSpaceStaff).filter(member => {
      if (!search) return true
      const custom = roles.filter(role => member.customRoleIds.includes(role.id)).map(role => role.name).join(' ')
      return `${member.displayName} ${member.username} ${custom}`.toLowerCase().includes(search)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customStaffRoleIds, members, query, roles])

  if (!allowed) return <div className="view-scroll page-enter"><div className="empty-state"><Icon name="lock"/><h3>Staff only</h3><p>You do not have permission to open this area.</p></div></div>

  return <div className="view-scroll staff-view staff-view-v31 page-enter">
    <div className="content-heading staff-heading-v31">
      <div><span className="eyebrow">SPACE STAFF</span><h1>Staff</h1><p>People with management or moderation permissions in this Space.</p></div>
      {canRoles && <button className="secondary-button compact" onClick={() => setView('roles')}><Icon name="roles" size={14}/>Manage roles</button>}
    </div>

    <section className="staff-roster-card-v31">
      <header>
        <div><span className="eyebrow">STAFF ROSTER</span><h2>{staffMembers.length} staff member{staffMembers.length === 1 ? '' : 's'}</h2></div>
        <label className="staff-search-v31"><Icon name="search" size={14}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search staff…"/></label>
      </header>
      <div className="staff-roster-list-v31">
        {staffMembers.map(member => {
          const memberRoles = roles.filter(role => member.customRoleIds.includes(role.id))
          const baseLabel = data?.workspace.id ? workspaceRoleDisplayName(data.workspace.id, member.role) : member.role
          const staffRoles = memberRoles.filter(role => role.permissions.some(permission => staffPermissionKeys.has(permission)))
          return <article className="staff-roster-row-v31" key={member.id}>
            <Avatar name={member.displayName} initials={member.initials} src={member.avatarUrl} size={38} accent={staffRoles[0]?.color ?? member.profileAccent}/>
            <div className="staff-roster-person-v31"><strong>{member.displayName}</strong><span>@{member.username}</span><small>{member.role === 'owner' ? baseLabel : (staffRoles.map(role => role.name).join(', ') || baseLabel)}</small></div>
            <div className="staff-access-pills-v31">
              {member.role === 'owner' && <span className="staff-base-pill-v31 role-owner">{baseLabel}</span>}
              {staffRoles.slice(0, 3).map(role => <span key={role.id} className="staff-base-pill-v31" style={{ borderColor: role.color, color: role.color }}>{role.name}</span>)}
              {member.platformRole && <span className="staff-platform-pill-v31"><Icon name="shield" size={11}/>Spaces {member.platformRole}</span>}
            </div>
          </article>
        })}
        {!staffMembers.length && <div className="mini-empty"><Icon name="members"/><span>No staff match that search.</span></div>}
      </div>
    </section>

    {canRoles && <section className="staff-add-card-v31">
      <div><span className="eyebrow">STAFF ACCESS</span><h2>Assign staff through roles</h2><p>Any role can become a staff role by giving it management or moderation permissions. Its position in the role list controls the hierarchy.</p></div>
      <button className="primary-button compact" onClick={() => setView('roles')}><Icon name="roles" size={14}/>Open Roles & Permissions</button>
    </section>}

    <div className="staff-tool-grid staff-tool-grid-v31">
      {canRoles && <button onClick={() => setView('roles')}><Icon name="roles"/><div><strong>Roles & permissions</strong><span>Create roles, order the hierarchy and assign permissions.</span></div><Icon name="chevron" size={15}/></button>}
      {canAudit && <button onClick={() => setView('activity')}><Icon name="activity"/><div><strong>Audit log</strong><span>Review staff actions and moderation activity.</span></div><Icon name="chevron" size={15}/></button>}
      {canSettings && <button onClick={() => setView('settings')}><Icon name="settings"/><div><strong>Space management</strong><span>Profile, channel access and shared settings.</span></div><Icon name="chevron" size={15}/></button>}
      {canMembers && <button onClick={() => setView('members')}><Icon name="members"/><div><strong>People</strong><span>Open the full member list and member controls.</span></div><Icon name="chevron" size={15}/></button>}
    </div>
  </div>
}
