import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { useAppDialog } from '../../components/AppDialog'
import { useSpaces } from '../../state/SpacesContext'
import { hasWorkspacePermission } from '../../utils/permissions'
import { loadRoleLabels, saveRoleLabels } from '../../utils/workspace-local-meta'
import { startPressDrag } from '../../utils/press-drag'
import { administratorPermissions, staffPermissions } from '../../utils/default-roles'
import type { WorkspaceCustomPermission, WorkspaceCustomRole } from '../../types/spaces'

const permissionLabels: Record<WorkspaceCustomPermission, [string, string]> = {
  send_messages: ['Send messages', 'Write in channels that allow this role.'],
  attach_files: ['Attach files', 'Upload supported files in chat.'],
  mention_everyone: ['Mention @everyone / @here', 'Send high-priority pings to the whole Space or active members.'],
  edit_notes: ['Create & edit notes', 'Create, import and update shared notes.'],
  delete_notes: ['Delete notes', 'Remove shared notes.'],
  create_channels: ['Create channels', 'Add new chat and note channels.'],
  manage_channels: ['Manage channels', 'Change channel access and structure.'],
  create_invites: ['Create invites', 'Invite new members to this Space.'],
  manage_members: ['Manage members', 'Remove members and manage access.'],
  manage_roles: ['Manage roles', 'Create roles and manage roles below this one.'],
  manage_space: ['Manage Space', 'Edit Space profile and shared settings.'],
  manage_emojis: ['Manage emoji', 'Add and remove custom emoji.'],
  moderate_messages: ['Moderate messages', 'Remove messages and review reports.'],
  moderate_comments: ['Moderate comments', 'Remove comments from shared notes.'],
  view_audit_log: ['View audit log', 'See staff and moderation activity.'],
}

const groups: { title: string; description: string; permissions: WorkspaceCustomPermission[] }[] = [
  { title: 'Messaging', description: 'Conversation and attachment controls.', permissions: ['send_messages', 'attach_files', 'mention_everyone'] },
  { title: 'Knowledge', description: 'Shared notes and documentation.', permissions: ['edit_notes', 'delete_notes'] },
  { title: 'Channels', description: 'Structure and channel-level access.', permissions: ['create_channels', 'manage_channels'] },
  { title: 'Community', description: 'Invites, members, roles and customization.', permissions: ['create_invites', 'manage_members', 'manage_roles', 'manage_emojis'] },
  { title: 'Moderation', description: 'Sensitive staff capabilities.', permissions: ['moderate_messages', 'moderate_comments', 'view_audit_log'] },
  { title: 'Administration', description: 'Space-wide management.', permissions: ['manage_space'] },
]

const allPermissions = Object.keys(permissionLabels) as WorkspaceCustomPermission[]
const blank = { name: '', color: '#8b6ca8', permissions: [] as WorkspaceCustomPermission[], hoist: false, mentionable: false }
type BaseRole = 'owner' | 'member'
type EditorTab = 'permissions' | 'members'

export function RolesView() {
  const dialog = useAppDialog()
  const {
    data, profile, createRole, updateRole, reorderRoles, deleteRole, setMemberRoles,
    upgradeRoleModel, updateBaseRoleSetting, pushToast,
  } = useSpaces()
  const roles = useMemo(() => [...(data?.roles ?? [])].sort((a, b) => b.position - a.position), [data?.roles])
  const members = data?.members ?? []
  const currentMember = members.find(member => member.profileId === profile?.id)
  const isHubFounder = data?.workspace.id === 'spaces-hub' && profile?.platformRole === 'founder'
  const canManage = isHubFounder || hasWorkspacePermission(data, profile?.id, 'manage_roles')
  const actorIsOwner = isHubFounder || currentMember?.role === 'owner' || data?.workspace.ownerId === profile?.id

  const [selectedId, setSelectedId] = useState('')
  const [baseRole, setBaseRole] = useState<BaseRole | null>('owner')
  const [creating, setCreating] = useState(false)
  const [editorTab, setEditorTab] = useState<EditorTab>('permissions')
  const [memberQuery, setMemberQuery] = useState('')
  const [memberBusyId, setMemberBusyId] = useState('')
  const selected = roles.find(role => role.id === selectedId) ?? null
  const [draft, setDraft] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [dragRoleId, setDragRoleId] = useState('')
  const [dragOverRoleId, setDragOverRoleId] = useState('')
  const [reordering, setReordering] = useState(false)
  const roleDragClickSuppressUntil = useRef(0)
  const upgradeStarted = useRef(false)
  const [baseLabels, setBaseLabels] = useState(() => loadRoleLabels(data?.workspace.id ?? ''))
  const [baseLabelDraft, setBaseLabelDraft] = useState('')
  const [basePresentationDraft, setBasePresentationDraft] = useState({ color: '#b58ad8', hoist: true, mentionable: false })
  const [basePresentationSaving, setBasePresentationSaving] = useState(false)

  useEffect(() => {
    const owner = data?.baseRoles?.owner
    if (!owner) return
    setBasePresentationDraft({ color: owner.color, hoist: owner.hoist, mentionable: owner.mentionable })
  }, [data?.workspace.id])

  // Older builds used Administrator and Staff as hard-coded access levels. Convert
  // them once into ordinary custom roles. Owner and Member are the only fixed roles.
  useEffect(() => {
    if (!actorIsOwner || upgradeStarted.current) return
    upgradeStarted.current = true
    void upgradeRoleModel().catch(error => {
      pushToast(error instanceof Error ? error.message : 'Could not update the role model.', 'danger')
    })
  }, [actorIsOwner, pushToast, upgradeRoleModel])

  useEffect(() => {
    const workspaceId = data?.workspace.id ?? ''
    const sync = () => setBaseLabels(loadRoleLabels(workspaceId))
    sync()
    window.addEventListener('spaces-role-labels-changed', sync)
    return () => window.removeEventListener('spaces-role-labels-changed', sync)
  }, [data?.workspace.id])

  useEffect(() => {
    if (!selected) return
    setBaseRole(null)
    setCreating(false)
    setDraft({
      name: selected.name,
      color: selected.color,
      permissions: [...selected.permissions],
      hoist: selected.hoist,
      mentionable: selected.mentionable,
    })
  }, [selected?.id])

  const actorHighestCustomPosition = roles
    .filter(role => currentMember?.customRoleIds.includes(role.id))
    .reduce((highest, role) => Math.max(highest, role.position), 0)
  const legacyActorRank = currentMember?.role === 'admin' ? 3_000_000 : currentMember?.role === 'contributor' ? 2_000_000 : 0
  const actorHierarchyRank = actorIsOwner ? Number.POSITIVE_INFINITY : Math.max(actorHighestCustomPosition, legacyActorRank)

  function memberHierarchyRank(member: (typeof members)[number]) {
    if (member.role === 'owner' || member.profileId === data?.workspace.ownerId) return Number.POSITIVE_INFINITY
    const customRank = roles
      .filter(role => member.customRoleIds.includes(role.id))
      .reduce((highest, role) => Math.max(highest, role.position), 0)
    const legacyRank = member.role === 'admin' ? 3_000_000 : member.role === 'contributor' ? 2_000_000 : 0
    return Math.max(customRank, legacyRank)
  }

  function canManageCustomRole(role: WorkspaceCustomRole | null) {
    if (!role || !canManage) return false
    if (actorIsOwner) return true
    return actorHierarchyRank > role.position
  }

  function canManageMember(member: (typeof members)[number]) {
    if (!canManage || member.role === 'owner' || member.profileId === data?.workspace.ownerId) return false
    if (actorIsOwner) return true
    return actorHierarchyRank > memberHierarchyRank(member)
  }

  function begin(input = blank) {
    setSelectedId('')
    setBaseRole(null)
    setCreating(true)
    setEditorTab('permissions')
    setMemberQuery('')
    setDraft({ ...input, permissions: [...input.permissions] })
  }

  function selectBase(role: BaseRole) {
    setSelectedId('')
    setCreating(false)
    setBaseRole(role)
    setEditorTab('permissions')
    setMemberQuery('')
    const labels = loadRoleLabels(data?.workspace.id ?? '')
    setBaseLabelDraft(role === 'owner' ? labels.owner : labels.member)
    const presentation = role === 'owner' ? data?.baseRoles?.owner : data?.baseRoles?.member
    setBasePresentationDraft({
      color: presentation?.color ?? (role === 'owner' ? '#b58ad8' : '#8b6ca8'),
      hoist: presentation?.hoist ?? role === 'owner',
      mentionable: presentation?.mentionable ?? false,
    })
  }

  function saveBaseLabel() {
    const workspaceId = data?.workspace.id
    if (!workspaceId || !baseRole || !actorIsOwner || !baseLabelDraft.trim()) return
    const next = { ...loadRoleLabels(workspaceId), [baseRole]: baseLabelDraft.trim().slice(0, 32) }
    saveRoleLabels(workspaceId, next)
    setBaseLabels(next)
    pushToast(`${next[baseRole]} label updated.`, 'success')
  }

  async function saveBasePresentation() {
    if (!baseRole || !actorIsOwner || basePresentationSaving) return
    setBasePresentationSaving(true)
    try {
      const saved = await updateBaseRoleSetting(baseRole, basePresentationDraft)
      setBasePresentationDraft({ color: saved.color, hoist: saved.hoist, mentionable: saved.mentionable })
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not update base role.', 'danger')
    } finally {
      setBasePresentationSaving(false)
    }
  }

  function selectRole(roleId: string) {
    setBaseRole(null)
    setCreating(false)
    setSelectedId(roleId)
    setEditorTab('permissions')
    setMemberQuery('')
  }

  async function save() {
    if (!draft.name.trim() || (selected ? !canManageCustomRole(selected) : !canManage)) return
    setSaving(true)
    try {
      if (selected) await updateRole(selected.id, draft)
      else await createRole(draft)
      setCreating(false)
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not save role.', 'danger')
    } finally {
      setSaving(false)
    }
  }

  async function remove(role: WorkspaceCustomRole) {
    if (!canManageCustomRole(role)) return
    if (!await dialog.confirm({ title: `Delete role “${role.name}”?`, message: 'This removes the role from everyone who has it. Their other roles stay the same.', confirmText: 'Delete role', danger: true })) return
    try {
      await deleteRole(role.id)
      setSelectedId('')
      setBaseRole('owner')
      setCreating(false)
      setEditorTab('permissions')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not delete role.', 'danger')
    }
  }

  async function moveRole(sourceId: string, targetId: string | null) {
    if (!canManage || !sourceId || reordering) return
    const sourceRole = roles.find(role => role.id === sourceId)
    const targetRole = targetId ? roles.find(role => role.id === targetId) ?? null : null
    if (!sourceRole || !canManageCustomRole(sourceRole)) return
    if (targetRole && !canManageCustomRole(targetRole)) {
      pushToast('You can only move roles below your highest role.', 'danger')
      return
    }

    const ordered = roles.map(role => role.id)
    const sourceIndex = ordered.indexOf(sourceId)
    if (sourceIndex < 0) return
    const [moved] = ordered.splice(sourceIndex, 1)
    const targetIndex = targetId ? ordered.indexOf(targetId) : ordered.length
    ordered.splice(targetIndex >= 0 ? targetIndex : ordered.length, 0, moved)

    setDragRoleId('')
    setDragOverRoleId('')
    setReordering(true)
    try {
      await reorderRoles(ordered)
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not reorder roles.', 'danger')
    } finally {
      setReordering(false)
    }
  }

  function beginRolePressDrag(event: ReactPointerEvent<HTMLElement>, role: WorkspaceCustomRole) {
    if (!canManageCustomRole(role) || reordering) return
    let target: string | null = null
    let hasTarget = false
    startPressDrag(event, {
      onStart: () => setDragRoleId(role.id),
      onMove: (clientX, clientY) => {
        const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null
        const row = element?.closest<HTMLElement>('[data-role-drag-id]')
        const targetId = row?.dataset.roleDragId
        if (targetId && targetId !== role.id) {
          target = targetId
          hasTarget = true
          setDragOverRoleId(targetId)
          return
        }
        if (element?.closest('[data-role-member-drop="true"]')) {
          target = null
          hasTarget = true
          setDragOverRoleId('__member__')
          return
        }
        target = null
        hasTarget = false
        setDragOverRoleId('')
      },
      onDrop: () => {
        roleDragClickSuppressUntil.current = Date.now() + 450
        if (hasTarget) void moveRole(role.id, target)
        setDragRoleId('')
        setDragOverRoleId('')
      },
      onCancel: () => { setDragRoleId(''); setDragOverRoleId('') },
    })
  }

  function roleClickSuppressed() { return Date.now() < roleDragClickSuppressUntil.current }

  function toggle(permission: WorkspaceCustomPermission, checked: boolean) {
    setDraft(current => ({
      ...current,
      permissions: checked
        ? [...new Set([...current.permissions, permission])]
        : current.permissions.filter(item => item !== permission),
    }))
  }

  async function toggleMemberRole(memberId: string) {
    if (!selected || !canManageCustomRole(selected)) return
    const member = members.find(item => item.id === memberId)
    if (!member) return
    if (!canManageMember(member)) {
      pushToast('You cannot change roles for a member at or above your hierarchy.', 'danger')
      return
    }
    const nextRoleIds = member.customRoleIds.includes(selected.id)
      ? member.customRoleIds.filter(id => id !== selected.id)
      : [...member.customRoleIds, selected.id]
    setMemberBusyId(memberId)
    try {
      await setMemberRoles(memberId, nextRoleIds)
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not update member roles.', 'danger')
    } finally {
      setMemberBusyId('')
    }
  }

  const preset = (name: string, color: string, permissions: WorkspaceCustomPermission[]) => begin({ name, color, permissions, hoist: true, mentionable: true })
  const canEditSelected = selected ? canManageCustomRole(selected) : canManage
  const selectedMemberCount = selected ? members.filter(member => member.customRoleIds.includes(selected.id)).length : 0
  const filteredMembers = useMemo(() => {
    const query = memberQuery.trim().toLowerCase()
    if (!query) return members
    return members.filter(member => `${member.displayName} ${member.username}`.toLowerCase().includes(query))
  }, [memberQuery, members])

  const baseLabel = baseRole === 'owner' ? baseLabels.owner : baseLabels.member
  const basePermissions = baseRole === 'owner' ? allPermissions : ['send_messages', 'attach_files'] as WorkspaceCustomPermission[]
  const dragSourceIndex = roles.findIndex(role => role.id === dragRoleId)

  return (
    <div className="roles-view roles-view-v2 roles-view-v9 roles-view-v14 roles-view-v40 page-enter">
      <aside className="roles-list-panel">
        <header><div><span className="eyebrow">ROLE HIERARCHY</span><h2>Roles</h2></div></header>

        {canManage && (
          <button className="create-role-button" onClick={() => begin()}>
            <Icon name="plus" size={15}/>
            <span><strong>Create role</strong></span>
          </button>
        )}

        <div className="hierarchy-stack role-hierarchy-v14">
          <button className={`protected-role-row owner ${baseRole === 'owner' ? 'active' : ''}`} onClick={() => selectBase('owner')}>
            <i className="role-swatch owner" style={{ background: data?.baseRoles?.owner.color ?? '#b58ad8' }}/>
            <span><strong>{baseLabels.owner}</strong></span><Icon name="lock" size={13}/>
          </button>

          {roles.map((role, roleIndex) => {
            const assigned = members.filter(member => member.customRoleIds.includes(role.id)).length
            const manageable = canManageCustomRole(role)
            return (
              <button
                data-role-drag-id={role.id}
                className={`custom-hierarchy-row draggable-role-v33 press-draggable-v37 ${selected?.id === role.id ? 'active' : ''} ${dragRoleId === role.id ? 'dragging-v33 press-drag-source-v37' : ''} ${dragOverRoleId === role.id ? `drag-over-v33 ${dragSourceIndex >= 0 && dragSourceIndex < roleIndex ? 'drag-shift-up-v41' : dragSourceIndex > roleIndex ? 'drag-shift-down-v41' : ''}` : ''} ${!manageable ? 'hierarchy-locked-v35' : ''}`}
                key={role.id}
                onPointerDown={event => beginRolePressDrag(event, role)}
                onClick={() => { if (roleClickSuppressed()) return; selectRole(role.id) }}
              >
                <span className="role-swatch" style={{ background: role.color }}/>
                <span><strong>{role.name}</strong><small>{role.permissions.length} permissions · {assigned} member{assigned === 1 ? '' : 's'}</small></span>
                <Icon name="chevron" size={14}/>
              </button>
            )
          })}

          <button
            data-role-member-drop="true"
            className={`protected-role-row member ${baseRole === 'member' ? 'active' : ''} ${dragOverRoleId === '__member__' ? 'drag-over-v33' : ''}`}
            onClick={() => { if (roleClickSuppressed()) return; selectBase('member') }}
          >
            <i className="role-swatch member"/>
            <span><strong>{baseLabels.member}</strong></span><Icon name="lock" size={12}/>
          </button>
        </div>
      </aside>

      <section className="role-editor-panel">
        {baseRole ? (
          <>
            <div className="content-heading compact-heading">
              <div><span className="eyebrow">BASE ROLE</span><h1>{baseLabel}</h1></div>
              <span className="protected-role-badge"><Icon name="lock" size={13}/>Protected</span>
            </div>

            {actorIsOwner && <section className="base-role-presentation-v44">
              <label className="role-color-field"><span>COLOR</span><input type="color" value={basePresentationDraft.color} onChange={event => setBasePresentationDraft(current => ({ ...current, color: event.target.value }))}/><code>{basePresentationDraft.color}</code></label>
              <button className="primary-button compact" disabled={basePresentationSaving} onClick={() => void saveBasePresentation()}>{basePresentationSaving ? 'Saving…' : 'Save'}</button>
            </section>}

            {actorIsOwner && <section className="base-role-name-editor-v29"><div><span className="eyebrow">DISPLAY NAME</span><strong>Rename this base role</strong></div><div><input className="text-input" value={baseLabelDraft || baseLabel} maxLength={32} onFocus={() => !baseLabelDraft && setBaseLabelDraft(baseLabel)} onChange={event => setBaseLabelDraft(event.target.value)}/><button className="primary-button compact" disabled={!baseLabelDraft.trim() || baseLabelDraft.trim() === baseLabel} onClick={saveBaseLabel}>Save name</button></div></section>}

            <div className="owner-role-callout"><Icon name="shield" size={22}/><div><strong>{baseRole === 'owner' ? `${baseLabels.owner} stays above every role` : `${baseLabels.member} stays below every role`}</strong></div></div>

            <div className="permission-matrix protected-permission-matrix">
              {groups.map(group => (
                <section key={group.title}>
                  <header><div><strong>{group.title}</strong></div><small>{group.permissions.filter(permission => basePermissions.includes(permission)).length}/{group.permissions.length}</small></header>
                  <div>{group.permissions.map(permission => {
                    const [label] = permissionLabels[permission]
                    const checked = basePermissions.includes(permission)
                    return <div className={`permission-line ${checked ? 'enabled' : ''}`} key={permission}><div><strong>{label}</strong></div><span className={`permission-toggle ${checked ? 'on' : ''} locked`}><i/></span></div>
                  })}</div>
                </section>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="content-heading compact-heading role-heading-v14">
              <div><span className="eyebrow">{selected ? 'EDIT ROLE' : creating ? 'NEW ROLE' : 'ROLE DESIGNER'}</span><h1>{selected?.name ?? (creating ? 'Create role' : 'Roles & Permissions')}</h1></div>
              {selected && canEditSelected && <button className="ghost-danger" onClick={() => void remove(selected)}><Icon name="trash" size={15}/>Delete role</button>}
            </div>

            {selected && (
              <div className="role-editor-tabs" role="tablist" aria-label="Role editor">
                <button className={editorTab === 'permissions' ? 'active' : ''} onClick={() => setEditorTab('permissions')}><Icon name="settings" size={14}/><span>Permissions</span></button>
                <button className={editorTab === 'members' ? 'active' : ''} onClick={() => setEditorTab('members')}><Icon name="members" size={14}/><span>Manage members</span><small>{selectedMemberCount}</small></button>
              </div>
            )}

            {!selected && !creating && canManage && (
              <div className="role-onboarding"><Icon name="roles" size={28}/><h3>Build your hierarchy</h3><div className="role-preset-cards"><button onClick={() => preset('Administrator', '#7f9dbb', administratorPermissions)}><strong>Administrator</strong><span>Full Space management</span></button><button onClick={() => preset('Staff', '#839887', staffPermissions)}><strong>Staff</strong><span>Community + moderation</span></button><button onClick={() => preset('Moderator', '#83a98f', ['send_messages', 'attach_files', 'moderate_messages', 'moderate_comments', 'view_audit_log'])}><strong>Moderator</strong><span>Moderation focused</span></button><button onClick={() => begin()}><strong>Custom</strong><span>Start with no permissions</span></button></div></div>
            )}

            {(selected || creating) && (creating || editorTab === 'permissions') && (
              <>
                <section className="role-identity-card role-identity-card-v14">
                  <div className="role-preview-orb" style={{ background: draft.color }}/>
                  <label><span>ROLE NAME</span><input className="text-input" disabled={!canEditSelected} value={draft.name} maxLength={32} onChange={e => setDraft(current => ({ ...current, name: e.target.value }))}/></label>
                  <label className="role-color-field"><span>COLOR</span><input type="color" disabled={!canEditSelected} value={draft.color} onChange={e => setDraft(current => ({ ...current, color: e.target.value }))}/><code>{draft.color}</code></label>
                </section>
                <div className="role-toggle-row">
                  <label><input type="checkbox" disabled={!canEditSelected} checked={draft.hoist} onChange={e => setDraft(current => ({ ...current, hoist: e.target.checked }))}/><span><strong>Display members separately</strong></span></label>
                  <label><input type="checkbox" disabled={!canEditSelected} checked={draft.mentionable} onChange={e => setDraft(current => ({ ...current, mentionable: e.target.checked }))}/><span><strong>Allow role mentions</strong></span></label>
                </div>
                <div className="permission-matrix">
                  {groups.map(group => (
                    <section key={group.title}>
                      <header><div><strong>{group.title}</strong></div><small>{group.permissions.filter(permission => draft.permissions.includes(permission)).length}/{group.permissions.length}</small></header>
                      <div>{group.permissions.map(permission => {
                        const [label] = permissionLabels[permission]
                        const checked = draft.permissions.includes(permission)
                        return <div className={`permission-line permission-line-clickable-v29 ${checked ? 'enabled' : ''}`} key={permission} onClick={() => { if (canEditSelected) toggle(permission, !checked) }}><div><strong>{label}</strong></div><button type="button" className={`permission-toggle ${checked ? 'on' : ''}`} disabled={!canEditSelected} onClick={event => { event.stopPropagation(); toggle(permission, !checked) }} aria-pressed={checked}><i/></button></div>
                      })}</div>
                    </section>
                  ))}
                </div>
                {canEditSelected && <div className="sticky-save"><span>{draft.permissions.length} permission{draft.permissions.length === 1 ? '' : 's'} enabled · hierarchy rules apply</span><button className="primary-button" disabled={saving || !draft.name.trim()} onClick={() => void save()}>{saving ? 'Saving…' : selected ? 'Save role' : 'Create role'}</button></div>}
              </>
            )}

            {selected && editorTab === 'members' && (
              <section className="role-member-manager">
                <div className="role-member-manager-head">
                  <div><span className="eyebrow">ROLE MEMBERS</span><h2>Assign {selected.name}</h2></div>
                  <span className="role-member-count"><i style={{ background: selected.color }}/>{selectedMemberCount} assigned</span>
                </div>
                <label className="role-member-search"><Icon name="search" size={14}/><input value={memberQuery} onChange={event => setMemberQuery(event.target.value)} placeholder="Search members"/></label>
                <div className="role-member-list">
                  {filteredMembers.map(member => {
                    const assigned = member.customRoleIds.includes(selected.id)
                    const canChangeThisMember = canManageCustomRole(selected) && canManageMember(member)
                    return (
                      <label className={`role-member-row ${assigned ? 'assigned' : ''} ${!canChangeThisMember ? 'hierarchy-locked-v35' : ''}`} key={member.id} title={!canChangeThisMember ? 'This member is at or above your hierarchy.' : undefined}>
                        <Avatar name={member.displayName} initials={member.initials} src={member.avatarUrl} size={36} accent={assigned ? selected.color : member.profileAccent}/>
                        <span className="role-member-copy"><strong>{member.displayName}</strong><small>@{member.username}</small></span>
                        <input type="checkbox" checked={assigned} disabled={!canChangeThisMember || memberBusyId === member.id} onChange={() => void toggleMemberRole(member.id)}/>
                        <span className="role-assignment-toggle"><i/></span>
                      </label>
                    )
                  })}
                  {!filteredMembers.length && <div className="mini-empty"><Icon name="members"/><span>No members match that search.</span></div>}
                </div>
              </section>
            )}
          </>
        )}
      </section>
    </div>
  )
}
