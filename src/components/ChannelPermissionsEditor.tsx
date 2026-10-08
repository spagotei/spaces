import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { UnsavedChangesBar } from './UnsavedChangesBar'
import { useAppDialog } from './AppDialog'
import { useSpaces } from '../state/SpacesContext'
import {
  getCategoryPermissionTemplate,
  getChannelPermissionSyncCategory,
  loadChannelMeta,
  saveCategoryPermissionTemplate,
  setChannelPermissionSyncCategory,
  type CategoryPermissionOverride,
} from '../utils/workspace-local-meta'
import type { WorkspaceChannel, WorkspaceChannelPermissionAction, WorkspaceChannelPermissionOverwrite, WorkspaceChannelPermissionTarget } from '../types/spaces'

const permissions: { id: WorkspaceChannelPermissionAction; label: string }[] = [
  { id: 'view_channel', label: 'View channel' },
  { id: 'send_messages', label: 'Send messages' },
  { id: 'attach_files', label: 'Attach files' },
  { id: 'create_notes', label: 'Create notes' },
  { id: 'edit_notes', label: 'Edit notes' },
  { id: 'delete_notes', label: 'Delete notes' },
]

type Target = { type: WorkspaceChannelPermissionTarget; id: string; label: string; sublabel?: string }
type TriState = 'allow' | 'neutral' | 'deny'
type Draft = Record<WorkspaceChannelPermissionAction, TriState>

function emptyDraft(): Draft {
  return Object.fromEntries(permissions.map(permission => [permission.id, 'neutral'])) as Draft
}
function draftFrom(item?: Pick<WorkspaceChannelPermissionOverwrite | CategoryPermissionOverride, 'allow' | 'deny'>): Draft {
  return Object.fromEntries(permissions.map(permission => [permission.id,
    item?.allow.includes(permission.id) ? 'allow' : item?.deny.includes(permission.id) ? 'deny' : 'neutral',
  ])) as Draft
}
function sameDraft(a: Draft, b: Draft) { return permissions.every(permission => a[permission.id] === b[permission.id]) }
function arraysFromDraft(draft: Draft) {
  return {
    allow: permissions.map(item => item.id).filter(id => draft[id] === 'allow'),
    deny: permissions.map(item => item.id).filter(id => draft[id] === 'deny'),
  }
}
function keyOf(target: Pick<Target, 'type' | 'id'>) { return `${target.type}:${target.id}` }

function TargetList({ targets, selectedKey, search, setSearch, onSelect }: {
  targets: Target[]; selectedKey: string; search: string; setSearch: (value: string) => void; onSelect: (target: Target) => void
}) {
  const query = search.trim().toLowerCase()
  const visible = targets.filter(target => !query || `${target.label} ${target.sublabel ?? ''}`.toLowerCase().includes(query))
  return <aside className="channel-acl-targets channel-acl-targets-v46">
    <div className="channel-acl-target-head-v46"><strong>Roles & members</strong></div>
    <label className="channel-acl-search-v46"><Icon name="search" size={13}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search"/></label>
    <div className="channel-acl-target-scroll-v46">{visible.map(target => <button type="button" key={keyOf(target)} className={selectedKey === keyOf(target) ? 'active' : ''} onClick={() => onSelect(target)}><span className="acl-target-icon"><Icon name={target.type === 'member' ? 'user' : target.type === 'role' ? 'roles' : 'members'} size={14}/></span><span><strong>{target.label}</strong>{target.sublabel && <small>{target.sublabel}</small>}</span></button>)}</div>
  </aside>
}

function TriStateEditor({ label, draft, setDraft }: { label: string; draft: Draft; setDraft: (draft: Draft) => void }) {
  return <section className="channel-acl-permissions channel-acl-permissions-v46">
    <header className="channel-acl-heading channel-acl-heading-v46"><div><span className="channel-acl-channel-v46">PERMISSIONS</span><h3>{label}</h3></div></header>
    <div className="channel-acl-list channel-acl-list-v46">{permissions.map(permission => <div className="channel-acl-row channel-acl-row-v46" key={permission.id}><span>{permission.label}</span><div className="channel-acl-tristate channel-acl-tristate-v46">
      <button type="button" className={draft[permission.id] === 'deny' ? 'active deny' : ''} title="Deny" onClick={() => setDraft({ ...draft, [permission.id]: 'deny' })}><Icon name="x" size={13}/></button>
      <button type="button" className={draft[permission.id] === 'neutral' ? 'active neutral' : ''} title="Default" onClick={() => setDraft({ ...draft, [permission.id]: 'neutral' })}>/</button>
      <button type="button" className={draft[permission.id] === 'allow' ? 'active allow' : ''} title="Allow" onClick={() => setDraft({ ...draft, [permission.id]: 'allow' })}><Icon name="check" size={13}/></button>
    </div></div>)}</div>
  </section>
}

export function ChannelPermissionsEditor({ channel, onClose = () => undefined, embedded = false }: { channel: WorkspaceChannel; onClose?: () => void; embedded?: boolean }) {
  const dialog = useAppDialog()
  const { data, listChannelPermissionOverwrites, saveChannelPermissionOverwrite, deleteChannelPermissionOverwrite, pushToast } = useSpaces()
  const [items, setItems] = useState<WorkspaceChannelPermissionOverwrite[]>([])
  const [selectedKey, setSelectedKey] = useState('everyone:everyone')
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const baseline = useRef<Draft>(emptyDraft())
  const [busy, setBusy] = useState(true)
  const [search, setSearch] = useState('')
  const [syncVersion, setSyncVersion] = useState(0)
  const workspaceId = data?.workspace.id ?? ''
  const meta = useMemo(() => loadChannelMeta(workspaceId, data?.channels ?? []), [data?.channels, syncVersion, workspaceId])
  const categoryId = meta.assignments[channel.id] ?? null
  const category = meta.categories.find(item => item.id === categoryId) ?? null
  const syncedCategoryId = getChannelPermissionSyncCategory(workspaceId, data?.channels ?? [], channel.id)
  const synced = Boolean(categoryId && syncedCategoryId === categoryId)
  const targets = useMemo<Target[]>(() => [
    { type: 'everyone', id: 'everyone', label: '@everyone' },
    ...(data?.roles ?? []).map(role => ({ type: 'role' as const, id: role.id, label: role.name, sublabel: 'Role' })),
    ...(data?.members ?? []).map(member => ({ type: 'member' as const, id: member.id, label: member.displayName, sublabel: `@${member.username}` })),
  ], [data?.members, data?.roles])
  const selected = targets.find(target => keyOf(target) === selectedKey) ?? targets[0]
  const dirty = !sameDraft(draft, baseline.current)

  function loadSelected(nextItems: WorkspaceChannelPermissionOverwrite[], target = selected) {
    if (!target) return
    const current = nextItems.find(item => item.targetType === target.type && item.targetId === target.id)
    const next = draftFrom(current)
    baseline.current = next
    setDraft(next)
  }

  useEffect(() => {
    let cancelled = false
    setBusy(true)
    setSelectedKey('everyone:everyone')
    setSearch('')
    void listChannelPermissionOverwrites(channel.id).then(next => {
      if (cancelled) return
      setItems(next)
      const target = targets.find(item => keyOf(item) === 'everyone:everyone') ?? targets[0]
      loadSelected(next, target)
    }).catch(error => pushToast(error instanceof Error ? error.message : 'Could not load channel permissions.', 'danger')).finally(() => !cancelled && setBusy(false))
    return () => { cancelled = true }
    // target list changes must not overwrite a dirty draft
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id])

  async function confirmResetToContinue() {
    if (!dirty) return true
    return dialog.confirm({ title: 'You have unsaved changes', message: 'Reset your current permission changes before leaving this selection.', confirmText: 'Reset and Continue', cancelText: 'Keep Editing' })
  }
  async function selectTarget(target: Target) {
    if (keyOf(target) === selectedKey) return
    if (!await confirmResetToContinue()) return
    setSelectedKey(keyOf(target))
    loadSelected(items, target)
  }
  async function closeEditor() {
    if (!await confirmResetToContinue()) return
    onClose()
  }
  async function save() {
    if (!selected || !workspaceId) return
    setBusy(true)
    try {
      const { allow, deny } = arraysFromDraft(draft)
      let nextItems: WorkspaceChannelPermissionOverwrite[]
      if (!allow.length && !deny.length) {
        await deleteChannelPermissionOverwrite(channel.id, selected.type, selected.id)
        nextItems = items.filter(item => !(item.targetType === selected.type && item.targetId === selected.id))
      } else {
        const saved = await saveChannelPermissionOverwrite(channel.id, selected.type, selected.id, allow, deny)
        nextItems = [...items.filter(item => !(item.targetType === saved.targetType && item.targetId === saved.targetId)), saved]
      }
      setItems(nextItems)
      baseline.current = { ...draft }
      setChannelPermissionSyncCategory(workspaceId, data?.channels ?? [], channel.id, null)
      setSyncVersion(value => value + 1)
      pushToast(`Permissions saved for ${selected.label}.`, 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not save channel permissions.', 'danger')
    } finally { setBusy(false) }
  }
  function reset() { setDraft({ ...baseline.current }) }

  async function syncNow() {
    if (!workspaceId || !category) return
    if (dirty && !await confirmResetToContinue()) return
    setBusy(true)
    try {
      const template = getCategoryPermissionTemplate(workspaceId, data?.channels ?? [], category.id)
      for (const current of items) await deleteChannelPermissionOverwrite(channel.id, current.targetType, current.targetId)
      const nextItems: WorkspaceChannelPermissionOverwrite[] = []
      for (const row of template) {
        if (!row.allow.length && !row.deny.length) continue
        nextItems.push(await saveChannelPermissionOverwrite(channel.id, row.targetType, row.targetId, row.allow, row.deny))
      }
      setItems(nextItems)
      setChannelPermissionSyncCategory(workspaceId, data?.channels ?? [], channel.id, category.id)
      setSyncVersion(value => value + 1)
      loadSelected(nextItems)
      pushToast(`Synced with ${category.name}.`, 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not sync category permissions.', 'danger')
    } finally { setBusy(false) }
  }

  const editor = <div className={`channel-acl-shell channel-acl-shell-v46 ${embedded ? 'embedded-v46' : ''}`}>
    <TargetList targets={targets} selectedKey={selectedKey} search={search} setSearch={setSearch} onSelect={target => void selectTarget(target)} />
    <div className="channel-acl-editor-stack-v70">
      <div className="permission-sync-status-v70"><div><strong>{synced && category ? `Synced with ${category.name}` : 'Custom permissions'}</strong><span>{category ? (synced ? 'Category changes automatically update this channel.' : `This channel can be synced to ${category.name}.`) : 'This channel is not inside a category.'}</span></div>{category && !synced && <button type="button" className="secondary-button compact" disabled={busy} onClick={() => void syncNow()}>Sync Now</button>}</div>
      <TriStateEditor label={selected?.label ?? '@everyone'} draft={draft} setDraft={setDraft}/>
      <UnsavedChangesBar dirty={dirty} busy={busy} onReset={reset} onSave={save}/>
    </div>
  </div>

  if (embedded) return editor
  return <Modal title={`Permissions · #${channel.name}`} subtitle="Role and member overrides for this channel." onClose={() => void closeEditor()} wide>{editor}</Modal>
}

export function CategoryPermissionsEditor({ categoryId, categoryName, onClose }: { categoryId: string; categoryName: string; onClose: () => void }) {
  const dialog = useAppDialog()
  const { data, listChannelPermissionOverwrites, saveChannelPermissionOverwrite, deleteChannelPermissionOverwrite, pushToast } = useSpaces()
  const workspaceId = data?.workspace.id ?? ''
  const channels = data?.channels ?? []
  const [template, setTemplate] = useState<CategoryPermissionOverride[]>(() => getCategoryPermissionTemplate(workspaceId, channels, categoryId))
  const [selectedKey, setSelectedKey] = useState('everyone:everyone')
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const baseline = useRef<Draft>(emptyDraft())
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const targets = useMemo<Target[]>(() => [
    { type: 'everyone', id: 'everyone', label: '@everyone' },
    ...(data?.roles ?? []).map(role => ({ type: 'role' as const, id: role.id, label: role.name, sublabel: 'Role' })),
    ...(data?.members ?? []).map(member => ({ type: 'member' as const, id: member.id, label: member.displayName, sublabel: `@${member.username}` })),
  ], [data?.members, data?.roles])
  const selected = targets.find(target => keyOf(target) === selectedKey) ?? targets[0]
  const dirty = !sameDraft(draft, baseline.current)

  useEffect(() => {
    const current = template.find(item => item.targetType === selected?.type && item.targetId === selected?.id)
    const next = draftFrom(current)
    baseline.current = next
    setDraft(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey])

  async function confirmResetToContinue() {
    if (!dirty) return true
    return dialog.confirm({ title: 'You have unsaved changes', message: 'Reset your current permission changes before leaving this selection.', confirmText: 'Reset and Continue', cancelText: 'Keep Editing' })
  }
  async function selectTarget(target: Target) {
    if (!await confirmResetToContinue()) return
    setSelectedKey(keyOf(target))
  }
  async function closeEditor() { if (await confirmResetToContinue()) onClose() }
  async function save() {
    if (!selected || !workspaceId) return
    setBusy(true)
    try {
      const { allow, deny } = arraysFromDraft(draft)
      const next = [
        ...template.filter(item => !(item.targetType === selected.type && item.targetId === selected.id)),
        ...(allow.length || deny.length ? [{ targetType: selected.type, targetId: selected.id, allow, deny }] : []),
      ]
      saveCategoryPermissionTemplate(workspaceId, channels, categoryId, next)
      setTemplate(next)
      baseline.current = { ...draft }
      const meta = loadChannelMeta(workspaceId, channels)
      const syncedChannels = channels.filter(channel => meta.assignments[channel.id] === categoryId && getChannelPermissionSyncCategory(workspaceId, channels, channel.id) === categoryId)
      for (const channel of syncedChannels) {
        const existing = await listChannelPermissionOverwrites(channel.id)
        const existingTarget = existing.find(item => item.targetType === selected.type && item.targetId === selected.id)
        if (existingTarget) await deleteChannelPermissionOverwrite(channel.id, selected.type, selected.id)
        if (allow.length || deny.length) await saveChannelPermissionOverwrite(channel.id, selected.type, selected.id, allow, deny)
      }
      pushToast(`Category permissions saved for ${selected.label}.`, 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not save category permissions.', 'danger')
    } finally { setBusy(false) }
  }

  return <Modal title={`Permissions · ${categoryName}`} subtitle="Synced channels inherit these role and member overrides." onClose={() => void closeEditor()} wide><div className="channel-acl-shell channel-acl-shell-v46 category-acl-v70"><TargetList targets={targets} selectedKey={selectedKey} search={search} setSearch={setSearch} onSelect={target => void selectTarget(target)}/><div className="channel-acl-editor-stack-v70"><div className="permission-sync-status-v70"><div><strong>Category permission template</strong><span>Only channels marked Synced automatically follow this category.</span></div></div><TriStateEditor label={selected?.label ?? '@everyone'} draft={draft} setDraft={setDraft}/><UnsavedChangesBar dirty={dirty} busy={busy} onReset={() => setDraft({ ...baseline.current })} onSave={save}/></div></div></Modal>
}
