import { useMemo, useState, type CSSProperties } from 'react'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { MemberProfileDrawer } from '../../components/MemberProfileDrawer'
import { useSpaces } from '../../state/SpacesContext'
import { usePreferences } from '../../state/PreferencesContext'
import { platformRoleLabel } from '../../utils/permissions'
import { workspaceRoleDisplayName } from '../../utils/workspace-local-meta'

export function MembersView() {
  const { data, profile } = useSpaces()
  const { effectivePresence, preferences } = usePreferences()
  const [selectedId, setSelectedId] = useState('')
  const [query, setQuery] = useState('')

  const members = data?.members ?? []
  const roles = useMemo(() => [...(data?.roles ?? [])].sort((a, b) => b.position - a.position), [data?.roles])
  const search = query.trim().toLowerCase()
  const visibleMembers = useMemo(() => members.filter(member => {
    if (!search) return true
    const roleNames = roles.filter(role => member.customRoleIds.includes(role.id)).map(role => role.name).join(' ')
    return `${member.displayName} ${member.username} ${member.publicUserId} ${data?.workspace.id ? workspaceRoleDisplayName(data.workspace.id, member.role) : member.role} ${roleNames}`.toLowerCase().includes(search)
  }), [data?.workspace.id, members, roles, search])

  function presenceFor(member: (typeof members)[number]) {
    return member.profileId === profile?.id ? effectivePresence : member.status === 'away' ? 'idle' : member.status
  }

  return (
    <div className="members-view view-scroll page-enter members-view-v15 members-view-v18">
      <div className="content-heading people-heading-v15 people-heading-v17">
        <div><span className="eyebrow">COMMUNITY</span><h1>People</h1><p>Everyone in this Space. Open a profile to connect, see roles, and check presence.</p><label className="people-search-v15 people-search-v17"><Icon name="search" size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search people or roles…" /></label></div>
        <span className="big-count">{visibleMembers.length === members.length ? members.length : `${visibleMembers.length}/${members.length}`}</span>
      </div>

      <section className="people-bubble-grid" aria-label="Space members">
        {visibleMembers.map((member, index) => {
          const memberRoles = roles.filter(role => member.customRoleIds.includes(role.id))
          const topRole = memberRoles[0]
          const baseRoleColorV44 = member.role === 'owner'
            ? data?.baseRoles?.owner?.color
            : data?.baseRoles?.member?.color
          const roleColorV44 = member.role === 'owner' ? baseRoleColorV44 : (topRole?.color ?? baseRoleColorV44)
          const status = presenceFor(member)
          const roleLabel = member.platformRole ? platformRoleLabel(member.platformRole) : (topRole?.name ?? (data?.workspace.id ? workspaceRoleDisplayName(data.workspace.id, member.role) : member.role))
          return (
            <button
              className="people-bubble"
              key={member.id}
              onClick={() => setSelectedId(member.id)}
              style={{ '--people-role-color': roleColorV44 ?? member.profileAccent ?? '#8b6ca8', '--people-float-delay': `${(index % 7) * -0.57}s`, '--people-float-distance': `${1.5 + (index % 3) * 0.55}px`, '--people-float-x': `${((index % 3) - 1) * 0.65}px`, '--people-float-duration': `${4.8 + (index % 4) * 0.42}s` } as CSSProperties}
            >
              <span className="people-bubble-avatar profile-avatar-presence">
                <Avatar name={member.displayName} initials={member.initials} src={member.avatarUrl} size={46} accent={roleColorV44} />
                <i className={`presence-symbol presence-${status}`} />
              </span>
              <span className="people-bubble-copy">
                <strong style={roleColorV44 ? { color: roleColorV44 } : undefined}>{member.displayName}</strong>
                <small><i />{roleLabel}{preferences.developerMode && member.publicUserId ? ` · #${member.publicUserId}` : ''}</small>
              </span>
              <Icon name="chevron" size={13}/>
            </button>
          )
        })}
        {!visibleMembers.length && <div className="people-empty-v15"><Icon name="members" size={22}/><strong>No people found</strong><span>Try another name or role.</span></div>}
      </section>

      {selectedId && <MemberProfileDrawer memberId={selectedId} onClose={() => setSelectedId('')} />}
    </div>
  )
}
