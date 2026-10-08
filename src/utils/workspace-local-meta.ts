import type { IconName } from '../components/Icon'
import type { WorkspaceChannel, WorkspaceSummary, WorkspaceChannelPermissionAction, WorkspaceChannelPermissionTarget } from '../types/spaces'

export type ChannelIconChoice =
  | { kind: 'icon'; value: IconName }
  | { kind: 'emoji'; value: string }

export type ChannelCategoryMeta = {
  id: string
  name: string
  order: number
  /** @deprecated v31.8 flattens old nested categories into normal categories. */
  parentId?: string | null
}

type ChannelMetaStore = {
  categories: ChannelCategoryMeta[]
  assignments: Record<string, string | null>
  icons: Record<string, ChannelIconChoice>
  channelOrder: Record<string, number>
  /** Child channels that behave like thread-style subchannels under a parent channel. */
  threadParents: Record<string, string | null>
  /** Local membership hints so a newly-created thread remains visible before the creator posts. */
  threadMembers: Record<string, string[]>
}

type RoleLabelStore = {
  owner: string
  admin: string
  staff: string
  member: string
}

const META_VERSION = 1
const defaultRoleLabels: RoleLabelStore = { owner: 'Owner', admin: 'Administrator', staff: 'Staff', member: 'Member' }

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try { return JSON.parse(raw) as T } catch { return fallback }
}

function slug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'category'
}

function channelMetaKey(workspaceId: string) { return `spaces.channelMeta.v${META_VERSION}.${workspaceId}` }
function roleLabelKey(workspaceId: string) { return `spaces.roleLabels.v${META_VERSION}.${workspaceId}` }
const workspaceIdsKey = `spaces.workspaceNumbers.v${META_VERSION}`

const THREAD_META_RE = /^\[\[spaces-thread:([^:\]]+):([^\]]*)\]\]\s*/u

export function threadMetadataFromDescription(description: string | null | undefined) {
  const value = String(description ?? '')
  const match = value.match(THREAD_META_RE)
  return match ? { parentId: match[1], creatorProfileId: match[2] || null } : null
}

export function cleanThreadDescription(description: string | null | undefined) {
  return String(description ?? '').replace(THREAD_META_RE, '').trim()
}

export function buildThreadDescription(parentChannelId: string, creatorProfileId: string | null | undefined, description = '') {
  const creator = String(creatorProfileId ?? '').replace(/[:\]]/g, '')
  return `[[spaces-thread:${parentChannelId}:${creator}]] ${description.trim()}`.trim()
}

export function defaultChannelIcon(channel: WorkspaceChannel): ChannelIconChoice {
  if (channel.kind === 'announcement') return { kind: 'icon', value: 'bell' }
  if (channel.kind === 'notes') return { kind: 'icon', value: 'notes' }
  if (channel.kind === 'mixed') return { kind: 'icon', value: 'chat' }
  return { kind: 'icon', value: 'hash' }
}

function seededChannelMeta(channels: WorkspaceChannel[]): ChannelMetaStore {
  const categories: ChannelCategoryMeta[] = [
    { id: 'information', name: 'Information', order: 10, parentId: null },
    { id: 'conversations', name: 'Conversations', order: 20, parentId: null },
    { id: 'notes', name: 'Notes', order: 30, parentId: null },
    { id: 'staff', name: 'Staff Channels', order: 40, parentId: null },
  ]
  const assignments: Record<string, string | null> = {}
  const icons: Record<string, ChannelIconChoice> = {}
  const channelOrder: Record<string, number> = {}
  channels.forEach((channel, index) => {
    if (/^(staff|mod|admin)[-_]/i.test(channel.name)) assignments[channel.id] = 'staff'
    else if (channel.kind === 'announcement') assignments[channel.id] = 'information'
    else if (channel.kind === 'notes') assignments[channel.id] = 'notes'
    else assignments[channel.id] = 'conversations'
    icons[channel.id] = defaultChannelIcon(channel)
    channelOrder[channel.id] = Number.isFinite(channel.order) ? channel.order : (index + 1) * 10
  })
  return { categories, assignments, icons, channelOrder, threadParents: {}, threadMembers: {} }
}

/**
 * Earlier beta builds allowed categories under categories. v31.8 replaces those with
 * thread-style child channels, so old nested category records are flattened in place.
 */
function sanitizeCategories(categories: ChannelCategoryMeta[]) {
  const sorted = [...categories].sort((a, b) => a.order - b.order)
  return sorted.map((category, index) => ({
    ...category,
    parentId: null,
    order: Number.isFinite(category.order) ? category.order : (index + 1) * 10,
  }))
}

export function loadChannelMeta(workspaceId: string, channels: WorkspaceChannel[]): ChannelMetaStore {
  if (!workspaceId) return seededChannelMeta(channels)
  const seeded = seededChannelMeta(channels)
  const stored = safeParse<Partial<ChannelMetaStore>>(localStorage.getItem(channelMetaKey(workspaceId)), {})
  const categories = sanitizeCategories(Array.isArray(stored.categories) && stored.categories.length ? stored.categories : seeded.categories)
  const validCategoryIds = new Set(categories.map(category => category.id))
  const liveIds = new Set(channels.map(channel => channel.id))
  const assignments = { ...seeded.assignments, ...(stored.assignments ?? {}) }
  const icons = { ...seeded.icons, ...(stored.icons ?? {}) }
  const channelOrder = { ...seeded.channelOrder, ...(stored.channelOrder ?? {}) }
  const threadParents = { ...(stored.threadParents ?? {}) }
  const threadMembers = { ...(stored.threadMembers ?? {}) }

  // Thread relationships are carried in the existing channel description field so
  // every Spaces client can reconstruct them without a separate backend table.
  channels.forEach(channel => {
    const marker = threadMetadataFromDescription(channel.description)
    if (!marker || marker.parentId === channel.id) return
    threadParents[channel.id] = marker.parentId
    if (marker.creatorProfileId) threadMembers[channel.id] = [...new Set([...(threadMembers[channel.id] ?? []), marker.creatorProfileId])]
  })

  channels.forEach((channel, index) => {
    if (!(channel.id in assignments)) assignments[channel.id] = seeded.assignments[channel.id] ?? null
    if (assignments[channel.id] && !validCategoryIds.has(assignments[channel.id]!)) assignments[channel.id] = null
    if (!(channel.id in icons)) icons[channel.id] = defaultChannelIcon(channel)
    if (!(channel.id in channelOrder)) channelOrder[channel.id] = Number.isFinite(channel.order) ? channel.order : (index + 1) * 10
  })

  Object.keys(assignments).forEach(id => { if (!liveIds.has(id)) delete assignments[id] })
  Object.keys(icons).forEach(id => { if (!liveIds.has(id)) delete icons[id] })
  Object.keys(channelOrder).forEach(id => { if (!liveIds.has(id)) delete channelOrder[id] })
  Object.keys(threadParents).forEach(childId => {
    const parentId = threadParents[childId]
    if (!liveIds.has(childId) || !parentId || !liveIds.has(parentId) || childId === parentId || threadParents[parentId]) delete threadParents[childId]
  })
  Object.keys(threadMembers).forEach(threadId => {
    if (!liveIds.has(threadId) || !threadParents[threadId]) delete threadMembers[threadId]
    else threadMembers[threadId] = [...new Set((threadMembers[threadId] ?? []).filter(Boolean))]
  })

  // A thread always follows its parent category in the sidebar.
  Object.entries(threadParents).forEach(([childId, parentId]) => {
    if (parentId) assignments[childId] = assignments[parentId] ?? null
  })

  const result: ChannelMetaStore = {
    categories: [...categories].sort((a, b) => a.order - b.order),
    assignments,
    icons,
    channelOrder,
    threadParents,
    threadMembers,
  }
  localStorage.setItem(channelMetaKey(workspaceId), JSON.stringify(result))
  return result
}

export function saveChannelMeta(workspaceId: string, value: ChannelMetaStore) {
  if (!workspaceId) return
  localStorage.setItem(channelMetaKey(workspaceId), JSON.stringify(value))
  window.dispatchEvent(new CustomEvent('spaces-channel-meta-changed', { detail: workspaceId }))
}

export function createChannelCategory(workspaceId: string, channels: WorkspaceChannel[], name: string): ChannelCategoryMeta {
  const meta = loadChannelMeta(workspaceId, channels)
  const clean = name.trim().slice(0, 36) || 'New Category'
  const base = slug(clean)
  let id = base
  let suffix = 2
  while (meta.categories.some(category => category.id === id)) id = `${base}-${suffix++}`
  const next: ChannelCategoryMeta = {
    id,
    name: clean,
    order: (Math.max(0, ...meta.categories.map(category => category.order)) || 0) + 10,
    parentId: null,
  }
  saveChannelMeta(workspaceId, { ...meta, categories: [...meta.categories, next] })
  return next
}

export function renameChannelCategory(workspaceId: string, channels: WorkspaceChannel[], categoryId: string, name: string) {
  const meta = loadChannelMeta(workspaceId, channels)
  saveChannelMeta(workspaceId, { ...meta, categories: meta.categories.map(category => category.id === categoryId ? { ...category, name: name.trim().slice(0, 36) || category.name } : category) })
}

export function deleteChannelCategory(workspaceId: string, channels: WorkspaceChannel[], categoryId: string) {
  const meta = loadChannelMeta(workspaceId, channels)
  const assignments = { ...meta.assignments }
  Object.keys(assignments).forEach(channelId => { if (assignments[channelId] === categoryId) assignments[channelId] = null })
  saveChannelMeta(workspaceId, { ...meta, categories: meta.categories.filter(category => category.id !== categoryId), assignments })
}

export function setChannelCategory(workspaceId: string, channels: WorkspaceChannel[], channelId: string, categoryId: string | null) {
  const meta = loadChannelMeta(workspaceId, channels)
  const assignments = { ...meta.assignments, [channelId]: categoryId }
  // Moving a parent channel also moves its thread-style children with it.
  Object.entries(meta.threadParents).forEach(([childId, parentId]) => {
    if (parentId === channelId) assignments[childId] = categoryId
  })
  saveChannelMeta(workspaceId, { ...meta, assignments })
}

export function setChannelIcon(workspaceId: string, channels: WorkspaceChannel[], channelId: string, icon: ChannelIconChoice) {
  const meta = loadChannelMeta(workspaceId, channels)
  saveChannelMeta(workspaceId, { ...meta, icons: { ...meta.icons, [channelId]: icon } })
}

export function setChannelThreadParent(
  workspaceId: string,
  channels: WorkspaceChannel[],
  childChannelId: string,
  parentChannelId: string | null,
  participantProfileId?: string | null,
) {
  const meta = loadChannelMeta(workspaceId, channels)
  const live = new Set(channels.map(channel => channel.id))
  const safeParent = parentChannelId && parentChannelId !== childChannelId && live.has(parentChannelId) && !meta.threadParents[parentChannelId]
    ? parentChannelId
    : null
  const threadParents = { ...meta.threadParents }
  const threadMembers = { ...meta.threadMembers }
  const assignments = { ...meta.assignments }
  if (!safeParent) {
    delete threadParents[childChannelId]
    delete threadMembers[childChannelId]
  } else {
    threadParents[childChannelId] = safeParent
    assignments[childChannelId] = assignments[safeParent] ?? null
    if (participantProfileId) threadMembers[childChannelId] = [...new Set([...(threadMembers[childChannelId] ?? []), participantProfileId])]
  }
  saveChannelMeta(workspaceId, { ...meta, assignments, threadParents, threadMembers })
}

export function markChannelThreadParticipant(
  workspaceId: string,
  channels: WorkspaceChannel[],
  threadChannelId: string,
  profileId: string,
) {
  if (!profileId) return
  const meta = loadChannelMeta(workspaceId, channels)
  if (!meta.threadParents[threadChannelId]) return
  const members = [...new Set([...(meta.threadMembers[threadChannelId] ?? []), profileId])]
  saveChannelMeta(workspaceId, { ...meta, threadMembers: { ...meta.threadMembers, [threadChannelId]: members } })
}

export function channelThreadParent(meta: ChannelMetaStore, channelId: string) {
  return meta.threadParents[channelId] ?? null
}

export function channelThreadChildren(meta: ChannelMetaStore, channels: WorkspaceChannel[], parentChannelId: string) {
  return sortChannelsByMeta(meta, channels.filter(channel => meta.threadParents[channel.id] === parentChannelId))
}

export function sortChannelsByMeta(meta: ChannelMetaStore, channels: WorkspaceChannel[]): WorkspaceChannel[] {
  return [...channels].sort((a, b) => {
    const aOrder = Number(meta.channelOrder[a.id] ?? a.order ?? 0)
    const bOrder = Number(meta.channelOrder[b.id] ?? b.order ?? 0)
    return aOrder - bOrder || a.name.localeCompare(b.name)
  })
}

function normalizeChannelOrders(meta: ChannelMetaStore, channels: WorkspaceChannel[], categoryId: string | null) {
  const ids = sortChannelsByMeta(
    meta,
    channels.filter(channel => !meta.threadParents[channel.id] && (meta.assignments[channel.id] ?? null) === categoryId),
  ).map(channel => channel.id)
  const channelOrder = { ...meta.channelOrder }
  ids.forEach((id, index) => { channelOrder[id] = (index + 1) * 10 })
  return channelOrder
}

export function moveChannelInMeta(
  workspaceId: string,
  channels: WorkspaceChannel[],
  channelId: string,
  targetCategoryId: string | null,
  beforeChannelId: string | null = null,
) {
  const meta = loadChannelMeta(workspaceId, channels)
  // Moving a thread as a normal channel detaches it from the parent first.
  const threadParents = { ...meta.threadParents }
  const threadMembers = { ...meta.threadMembers }
  if (threadParents[channelId]) {
    delete threadParents[channelId]
    delete threadMembers[channelId]
  }
  const sourceCategoryId = meta.assignments[channelId] ?? null
  const assignments = { ...meta.assignments, [channelId]: targetCategoryId }
  let next: ChannelMetaStore = { ...meta, assignments, threadParents, threadMembers }

  const target = sortChannelsByMeta(
    next,
    channels.filter(channel => channel.id !== channelId && !next.threadParents[channel.id] && (assignments[channel.id] ?? null) === targetCategoryId),
  ).map(channel => channel.id)
  const foundIndex = beforeChannelId ? target.indexOf(beforeChannelId) : -1
  const insertIndex = foundIndex >= 0 ? foundIndex : target.length
  target.splice(insertIndex, 0, channelId)
  const channelOrder = { ...next.channelOrder }
  target.forEach((id, index) => { channelOrder[id] = (index + 1) * 10 })
  next = { ...next, channelOrder }

  if (sourceCategoryId !== targetCategoryId) next = { ...next, channelOrder: normalizeChannelOrders(next, channels, sourceCategoryId) }
  saveChannelMeta(workspaceId, next)
}

export function moveChannelCategory(
  workspaceId: string,
  channels: WorkspaceChannel[],
  sourceCategoryId: string,
  _targetParentId: string | null,
  beforeCategoryId: string | null = null,
) {
  const meta = loadChannelMeta(workspaceId, channels)
  const source = meta.categories.find(category => category.id === sourceCategoryId)
  if (!source) return
  const remaining = meta.categories.filter(category => category.id !== sourceCategoryId).sort((a, b) => a.order - b.order)
  const targetIndex = beforeCategoryId ? remaining.findIndex(category => category.id === beforeCategoryId) : -1
  remaining.splice(targetIndex >= 0 ? targetIndex : remaining.length, 0, { ...source, parentId: null })
  const categories = remaining.map((category, index) => ({ ...category, parentId: null, order: (index + 1) * 10 }))
  saveChannelMeta(workspaceId, { ...meta, categories })
}

export function reorderChannelCategory(workspaceId: string, channels: WorkspaceChannel[], sourceCategoryId: string, beforeCategoryId: string | null) {
  moveChannelCategory(workspaceId, channels, sourceCategoryId, null, beforeCategoryId)
}

export function loadRoleLabels(workspaceId: string): RoleLabelStore {
  if (!workspaceId) return defaultRoleLabels
  return { ...defaultRoleLabels, ...safeParse<Partial<RoleLabelStore>>(localStorage.getItem(roleLabelKey(workspaceId)), {}) }
}

export function saveRoleLabels(workspaceId: string, labels: RoleLabelStore) {
  if (!workspaceId) return
  localStorage.setItem(roleLabelKey(workspaceId), JSON.stringify(labels))
  window.dispatchEvent(new CustomEvent('spaces-role-labels-changed', { detail: workspaceId }))
}

export function workspaceRoleDisplayName(workspaceId: string, role: 'owner' | 'admin' | 'contributor' | 'viewer') {
  const labels = loadRoleLabels(workspaceId)
  if (role === 'owner') return labels.owner
  if (role === 'admin') return labels.admin
  if (role === 'contributor') return labels.staff
  return labels.member
}

type WorkspaceNumberStore = { next: number; values: Record<string, number> }

export function getWorkspaceNumber(space: WorkspaceSummary, allSpaces: WorkspaceSummary[]) {
  const stored = safeParse<WorkspaceNumberStore>(localStorage.getItem(workspaceIdsKey), { next: 2, values: { 'spaces-hub': 1 } })
  stored.values['spaces-hub'] = 1
  let next = Math.max(2, stored.next || 2, ...Object.values(stored.values).map(value => value + 1))
  const ordered = [...allSpaces].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
  ordered.forEach(item => {
    if (item.id === 'spaces-hub') return
    if (stored.values[item.id] == null) stored.values[item.id] = next++
  })
  stored.next = next
  localStorage.setItem(workspaceIdsKey, JSON.stringify(stored))
  return stored.values[space.id] ?? 0
}


// ---------------------------------------------------------------------------
// V70 category permission templates. Categories themselves are intentionally
// local Spaces UI metadata; synced child channels always receive real server
// channel overwrites.
// ---------------------------------------------------------------------------
export type CategoryPermissionOverride = {
  targetType: WorkspaceChannelPermissionTarget
  targetId: string
  allow: WorkspaceChannelPermissionAction[]
  deny: WorkspaceChannelPermissionAction[]
}

type PermissionMetaV70 = {
  templates: Record<string, CategoryPermissionOverride[]>
  sync: Record<string, string | null>
}

function permissionMetaKeyV70(workspaceId: string) { return `spaces.channelPermissions.v70.${workspaceId}` }
function loadPermissionMetaV70(workspaceId: string): PermissionMetaV70 {
  try {
    const parsed = JSON.parse(localStorage.getItem(permissionMetaKeyV70(workspaceId)) || '{}') as Partial<PermissionMetaV70>
    return { templates: parsed.templates ?? {}, sync: parsed.sync ?? {} }
  } catch { return { templates: {}, sync: {} } }
}
function savePermissionMetaV70(workspaceId: string, value: PermissionMetaV70) {
  localStorage.setItem(permissionMetaKeyV70(workspaceId), JSON.stringify(value))
  window.dispatchEvent(new CustomEvent('spaces-channel-meta-v70', { detail: { workspaceId } }))
}
function cleanPermissionRowsV70(rows: CategoryPermissionOverride[]): CategoryPermissionOverride[] {
  return rows.map(row => ({
    targetType: row.targetType,
    targetId: row.targetId,
    allow: [...new Set(row.allow)].sort(),
    deny: [...new Set(row.deny)].sort(),
  })).sort((a, b) => `${a.targetType}:${a.targetId}`.localeCompare(`${b.targetType}:${b.targetId}`))
}
export function channelPermissionOverridesEqual(a: CategoryPermissionOverride[], b: CategoryPermissionOverride[]) {
  return JSON.stringify(cleanPermissionRowsV70(a)) === JSON.stringify(cleanPermissionRowsV70(b))
}
export function getCategoryPermissionTemplate(workspaceId: string, _channels: WorkspaceChannel[], categoryId: string) {
  return cleanPermissionRowsV70(loadPermissionMetaV70(workspaceId).templates[categoryId] ?? [])
}
export function saveCategoryPermissionTemplate(workspaceId: string, _channels: WorkspaceChannel[], categoryId: string, rows: CategoryPermissionOverride[]) {
  const store = loadPermissionMetaV70(workspaceId)
  store.templates[categoryId] = cleanPermissionRowsV70(rows)
  savePermissionMetaV70(workspaceId, store)
}
export function getChannelPermissionSyncCategory(workspaceId: string, _channels: WorkspaceChannel[], channelId: string) {
  const store = loadPermissionMetaV70(workspaceId)
  return Object.prototype.hasOwnProperty.call(store.sync, channelId) ? store.sync[channelId] : null
}
export function setChannelPermissionSyncCategory(workspaceId: string, _channels: WorkspaceChannel[], channelId: string, categoryId: string | null) {
  const store = loadPermissionMetaV70(workspaceId)
  store.sync[channelId] = categoryId
  savePermissionMetaV70(workspaceId, store)
}
