import { useEffect, useMemo, useState } from 'react'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { useSpaces } from '../state/SpacesContext'
import type { WorkspaceChannel, WorkspaceChannelPermissionAction, WorkspaceChannelPermissionOverwrite } from '../types/spaces'

const permissions: { id: WorkspaceChannelPermissionAction; label: string }[] = [
  { id: 'view_channel', label: 'View channel' },
  { id: 'send_messages', label: 'Send messages' },
  { id: 'attach_files', label: 'Attach files' },
  { id: 'create_notes', label: 'Create notes' },
  { id: 'edit_notes', label: 'Edit notes' },
  { id: 'delete_notes', label: 'Delete notes' },
]

type Target = {
  type: 'everyone' | 'role' | 'member'
  id: string
  label: string
  sublabel?: string
}

type TriState = 'allow' | 'neutral' | 'deny'

function emptyDraft() {
  return Object.fromEntries(
    permissions.map(permission => [permission.id, 'neutral']),
  ) as Record<WorkspaceChannelPermissionAction, TriState>
}

export function ChannelPermissionsEditor({
  channel,
  onClose = () => undefined,
  embedded = false,
}: {
  channel: WorkspaceChannel
  onClose?: () => void
  embedded?: boolean
}) {
  const {
    data,
    listChannelPermissionOverwrites,
    saveChannelPermissionOverwrite,
    deleteChannelPermissionOverwrite,
    pushToast,
  } = useSpaces()

  const [items, setItems] = useState<WorkspaceChannelPermissionOverwrite[]>([])
  const [selectedKey, setSelectedKey] = useState('everyone:everyone')
  const [draft, setDraft] = useState<Record<WorkspaceChannelPermissionAction, TriState>>(emptyDraft)
  const [busy, setBusy] = useState(true)
  const [search, setSearch] = useState('')

  const targets = useMemo<Target[]>(() => [
    { type: 'everyone', id: 'everyone', label: '@everyone' },
    ...(data?.roles ?? []).map(role => ({
      type: 'role' as const,
      id: role.id,
      label: role.name,
      sublabel: 'Role',
    })),
    ...(data?.members ?? []).map(member => ({
      type: 'member' as const,
      id: member.id,
      label: member.displayName,
      sublabel: `@${member.username}`,
    })),
  ], [data?.members, data?.roles])

  const selected = targets.find(target => `${target.type}:${target.id}` === selectedKey) ?? targets[0]
  const query = search.trim().toLowerCase()
  const visibleTargets = targets.filter(target =>
    !query || `${target.label} ${target.sublabel ?? ''}`.toLowerCase().includes(query),
  )

  useEffect(() => {
    setSelectedKey('everyone:everyone')
    setSearch('')
    setBusy(true)
    void listChannelPermissionOverwrites(channel.id)
      .then(setItems)
      .catch(error => pushToast(error instanceof Error ? error.message : 'Could not load channel permissions.', 'danger'))
      .finally(() => setBusy(false))
  }, [channel.id, listChannelPermissionOverwrites, pushToast])

  useEffect(() => {
    if (!selected) return
    const current = items.find(item => item.targetType === selected.type && item.targetId === selected.id)
    setDraft(Object.fromEntries(permissions.map(permission => [
      permission.id,
      current?.allow.includes(permission.id)
        ? 'allow'
        : current?.deny.includes(permission.id)
          ? 'deny'
          : 'neutral',
    ])) as Record<WorkspaceChannelPermissionAction, TriState>)
  }, [items, selected])

  async function save() {
    if (!selected) return
    setBusy(true)
    try {
      const allow = permissions.map(item => item.id).filter(id => draft[id] === 'allow')
      const deny = permissions.map(item => item.id).filter(id => draft[id] === 'deny')
      const saved = await saveChannelPermissionOverwrite(
        channel.id,
        selected.type,
        selected.id,
        allow,
        deny,
      )
      setItems(current => [
        ...current.filter(item => !(item.targetType === saved.targetType && item.targetId === saved.targetId)),
        saved,
      ])
      pushToast(`Permissions saved for ${selected.label}.`, 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not save channel permissions.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  async function reset() {
    if (!selected) return
    setBusy(true)
    try {
      await deleteChannelPermissionOverwrite(channel.id, selected.type, selected.id)
      setItems(current => current.filter(item => !(item.targetType === selected.type && item.targetId === selected.id)))
      pushToast(`Permissions reset for ${selected.label}.`, 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not reset channel permissions.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  const content = (
    <div className={`channel-acl-v47 ${embedded ? 'is-embedded' : ''}`}>
      <aside className="channel-acl-people-v47">
        <div className="channel-acl-people-head-v47">
          <strong>Roles & members</strong>
          <label>
            <Icon name="search" size={12}/>
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search"/>
          </label>
        </div>

        <div className="channel-acl-target-list-v47">
          {visibleTargets.map(target => {
            const key = `${target.type}:${target.id}`
            return (
              <button
                type="button"
                key={key}
                className={selectedKey === key ? 'active' : ''}
                onClick={() => setSelectedKey(key)}
              >
                <span className="channel-acl-target-icon-v47">
                  <Icon name={target.type === 'member' ? 'user' : target.type === 'role' ? 'roles' : 'members'} size={14}/>
                </span>
                <span>
                  <strong>{target.label}</strong>
                  {target.sublabel && <small>{target.sublabel}</small>}
                </span>
              </button>
            )
          })}
        </div>
      </aside>

      <section className="channel-acl-editor-v47">
        <header>
          <div>
            <small>#{channel.name}</small>
            <h3>{selected?.label}</h3>
          </div>
          <button type="button" className="secondary-button compact" disabled={busy} onClick={() => void reset()}>
            Reset
          </button>
        </header>

        <div className="channel-acl-permission-list-v47">
          {permissions.map(permission => (
            <div className="channel-acl-permission-row-v47" key={permission.id}>
              <strong>{permission.label}</strong>
              <div className="channel-acl-tristate-v47" role="group" aria-label={permission.label}>
                <button
                  type="button"
                  className={draft[permission.id] === 'deny' ? 'active deny' : 'deny'}
                  title="Deny"
                  aria-label="Deny"
                  onClick={() => setDraft(current => ({ ...current, [permission.id]: 'deny' }))}
                >
                  <Icon name="x" size={16}/>
                </button>

                <button
                  type="button"
                  className={draft[permission.id] === 'neutral' ? 'active neutral' : 'neutral'}
                  title="Default"
                  aria-label="Default"
                  onClick={() => setDraft(current => ({ ...current, [permission.id]: 'neutral' }))}
                >
                  <span>/</span>
                </button>

                <button
                  type="button"
                  className={draft[permission.id] === 'allow' ? 'active allow' : 'allow'}
                  title="Allow"
                  aria-label="Allow"
                  onClick={() => setDraft(current => ({ ...current, [permission.id]: 'allow' }))}
                >
                  <Icon name="check" size={16}/>
                </button>
              </div>
            </div>
          ))}
        </div>

        <footer>
          <button type="button" className="primary-button compact" disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </footer>
      </section>
    </div>
  )

  if (embedded) return <div className="channel-acl-embedded-v47">{content}</div>

  return (
    <Modal title={`#${channel.name} Permissions`} onClose={onClose} wide>
      {content}
    </Modal>
  )
}
