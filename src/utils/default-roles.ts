import type { WorkspaceCustomPermission } from '../types/spaces'

export const administratorPermissions: WorkspaceCustomPermission[] = [
  'send_messages',
  'attach_files',
  'mention_everyone',
  'edit_notes',
  'delete_notes',
  'create_channels',
  'manage_channels',
  'create_invites',
  'manage_members',
  'manage_roles',
  'manage_space',
  'manage_emojis',
  'moderate_messages',
  'moderate_comments',
  'view_audit_log',
]

export const staffPermissions: WorkspaceCustomPermission[] = [
  'send_messages',
  'attach_files',
  'mention_everyone',
  'edit_notes',
  'delete_notes',
  'create_channels',
  'manage_channels',
  'create_invites',
  'manage_members',
  'manage_roles',
  'manage_emojis',
  'moderate_messages',
  'moderate_comments',
  'view_audit_log',
]

export const defaultAdministratorRole = {
  name: 'Administrator',
  color: '#7f9dbb',
  permissions: administratorPermissions,
  hoist: true,
  mentionable: true,
} as const

export const defaultStaffRole = {
  name: 'Staff',
  color: '#839887',
  permissions: staffPermissions,
  hoist: true,
  mentionable: true,
} as const

export function flexibleRoleModelKey(workspaceId: string) {
  return `spaces.flexibleRoleModel.v1.${workspaceId}`
}
