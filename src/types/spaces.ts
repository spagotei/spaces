export type WorkspaceRole =
  | 'owner'
  | 'admin'
  | 'contributor'
  | 'viewer'

export type WorkspaceView =
  | 'overview'
  | 'notes'
  | 'chat'
  | 'logs'
  | 'members'
  | 'account'
  | 'updates'
  | 'settings'
  | 'moderation'

export type WorkspaceChannelKind =
  | 'notes'
  | 'chat'
  | 'mixed'
  | 'announcement'


export type WorkspaceChannelPermission =
  | 'viewer'
  | 'contributor'
  | 'admin'
  | 'owner'
  | 'disabled'

export type WorkspaceChannelPermissionAction =
  | 'view_channel'
  | 'send_messages'
  | 'attach_files'
  | 'create_notes'
  | 'edit_notes'
  | 'delete_notes'

export type WorkspaceChannelPermissionTarget = 'everyone' | 'role' | 'member'

export type WorkspaceChannelPermissionOverwrite = {
  id: string
  workspaceId: string
  channelId: string
  targetType: WorkspaceChannelPermissionTarget
  targetId: string
  allow: WorkspaceChannelPermissionAction[]
  deny: WorkspaceChannelPermissionAction[]
  createdAt: number
  updatedAt: number
}


export type WorkspaceCustomPermission =
  | 'send_messages'
  | 'attach_files'
  | 'mention_everyone'
  | 'edit_notes'
  | 'delete_notes'
  | 'create_channels'
  | 'manage_channels'
  | 'create_invites'
  | 'manage_members'
  | 'manage_roles'
  | 'manage_space'
  | 'manage_emojis'
  | 'moderate_messages'
  | 'moderate_comments'
  | 'view_audit_log'

export type WorkspaceCustomRole = {
  id: string
  workspaceId: string
  name: string
  color: string
  permissions: WorkspaceCustomPermission[]
  position: number
  hoist: boolean
  mentionable: boolean
  createdAt: number
  updatedAt: number
}

export type WorkspaceBaseRoleSetting = {
  role: 'owner' | 'member'
  color: string
  hoist: boolean
  mentionable: boolean
  updatedAt: number
}

export type WorkspaceBaseRoleSettings = {
  owner: WorkspaceBaseRoleSetting
  member: WorkspaceBaseRoleSetting
}

export type WorkspaceEmoji = {
  id: string
  workspaceId: string
  name: string
  imageType: string
  imageData: string
  createdBy: string
  createdAt: number
  updatedAt: number
}

export type WorkspaceNoteComment = {
  id: string
  workspaceId: string
  noteId: string
  authorId: string
  authorName: string
  authorInitials: string
  authorAvatarUrl: string | null
  body: string
  createdAt: number
  editedAt: number | null
  deletedAt: number | null
  deletedBy: string | null
}

export type WorkspaceBackgroundPreset =
  | 'graphite'
  | 'midnight'
  | 'slate'
  | 'black'
  | 'carbon'
  | 'violet-grid' // legacy saved preset; rendered without the old wire grid
  | 'deep-space'
  | 'glassline'
  | 'velvet'
  | 'blue-hour'
  | 'noir-bloom'
  | 'smoke'
  | 'ember'
  | 'forest'
  | 'ocean'
  | 'rose-noir'

export type WorkspaceIconDecoration = 'none' | 'ring' | 'double' | 'halo' | 'badge'

export type WorkspaceMessageAttachment = {
  name: string
  type: string
  size: number
  dataUrl?: string
  downloadPath?: string
}

export type WorkspaceMemberStatus =
  | 'online'
  | 'away'
  | 'dnd'
  | 'offline'

export type WorkspacePresence =
  | 'online'
  | 'idle'
  | 'dnd'
  | 'invisible'

export type WorkspacePlatformRole =
  | 'founder'
  | 'staff'
  | 'support'
  | null

export type WorkspaceProfile = {
  id: string
  publicUserId: string
  username: string
  displayName: string
  initials: string
  avatarUrl: string | null
  bannerUrl: string | null
  profileAccent: string
  bio: string
  platformRole: WorkspacePlatformRole
  publicProfile: boolean
  presence: WorkspacePresence
  customStatus: string
  createdAt: number
}

export type WorkspaceSession = {
  token: string
  expiresAt: number
  profile: WorkspaceProfile
  profileSetupRequired?: boolean
  loginIdentifier?: string
}


export type WorkspaceLoginTwoFactor = {
  requiresTwoFactor: true
}

export type WorkspaceLoginResult = WorkspaceSession | WorkspaceLoginTwoFactor


export type WorkspaceBetaAccessStatus = 'invited' | 'claimed' | 'revoked'

export type WorkspaceBetaAccessEntry = {
  id: string
  email: string
  status: WorkspaceBetaAccessStatus
  invitedByName: string
  createdAt: number
  claimedAt: number | null
  username: string | null
}

export type WorkspaceBetaAccessInviteResult = {
  entry: WorkspaceBetaAccessEntry
  delivery: 'sent' | 'queued' | 'unavailable'
}

export type WorkspaceAccountSecurity = {
  email: string | null
  emailVerified: boolean
  twoFactorEnabled: boolean
  recoveryCodesRemaining: number
  emailServiceAvailable: boolean
  emailSenderConfigured: boolean
}

export type WorkspaceEmailVerificationStart = {
  sent: boolean
  email: string
  expiresAt: number
}

export type WorkspaceTwoFactorSetup = {
  secret: string
  otpauthUri: string
  expiresAt: number
}

export type WorkspaceTwoFactorEnableResult = {
  security: WorkspaceAccountSecurity
  recoveryCodes: string[]
}


export type WorkspaceDirectPerson = {
  id: string
  publicUserId: string
  username: string
  displayName: string
  initials: string
  avatarUrl: string | null
  profileAccent: string
  platformRole: WorkspacePlatformRole
  presence: 'online' | 'idle' | 'dnd' | 'offline'
  customStatus: string
}

export type WorkspaceDirectConversation = {
  id: string
  status: 'pending' | 'accepted'
  requestedByMe: boolean
  sourceWorkspaceId: string | null
  person: WorkspaceDirectPerson
  createdAt: number
  updatedAt: number
  lastMessage: string | null
  lastMessageAt: number | null
}

export type WorkspaceDirectGroupMember = WorkspaceDirectPerson

export type WorkspaceDirectGroup = {
  id: string
  name: string
  ownerUserId: string
  members: WorkspaceDirectGroupMember[]
  createdAt: number
  updatedAt: number
  lastMessage: string | null
  lastMessageAt: number | null
}

export type WorkspaceDirectCenter = {
  conversations: WorkspaceDirectConversation[]
  incomingRequests: WorkspaceDirectConversation[]
  outgoingRequests: WorkspaceDirectConversation[]
  groups: WorkspaceDirectGroup[]
}

export type WorkspaceDirectMessage = {
  id: string
  conversationId: string
  senderUserId: string
  senderName: string
  body: string
  createdAt: number
}

export type WorkspaceDirectGroupMessage = {
  id: string
  groupId: string
  senderUserId: string
  senderName: string
  body: string
  createdAt: number
}

export type WorkspaceDmPreference = {
  workspaceId: string
  allowDms: boolean
  updatedAt: number
}

export type WorkspaceSessionInfo = {
  id: string
  createdAt: number
  expiresAt: number
  lastSeenAt: number
  current: boolean
}

export type WorkspaceInvite = {
  id: string
  workspaceId: string
  code: string
  createdBy: string
  createdAt: number
  expiresAt: number | null
  maxUses: number | null
  uses: number
  revoked: boolean
}

export type WorkspaceSummary = {
  id: string
  name: string
  code: string
  initials: string
  avatarUrl: string | null
  description: string
  background: WorkspaceBackgroundPreset
  accentColor: string
  bannerUrl: string | null
  iconDecoration: WorkspaceIconDecoration
  createdAt: number
  ownerId: string
  role: WorkspaceRole
}

export type WorkspaceChannel = {
  id: string
  workspaceId: string
  name: string
  description: string
  kind: WorkspaceChannelKind
  order: number
  postMinRole: WorkspaceChannelPermission
  noteMinRole: WorkspaceChannelPermission
  effectivePermissions?: Record<WorkspaceChannelPermissionAction, boolean>
}

export type WorkspaceMember = {
  id: string
  workspaceId: string
  profileId: string
  publicUserId: string
  username: string
  displayName: string
  initials: string
  avatarUrl: string | null
  bannerUrl: string | null
  profileAccent: string
  bio: string
  platformRole: WorkspacePlatformRole
  role: WorkspaceRole
  customRoleIds: string[]
  status: WorkspaceMemberStatus
  customStatus: string
  joinedAt: number
}

export type WorkspaceNote = {
  id: string
  workspaceId: string
  channelId: string
  title: string
  body: string
  createdBy: string
  updatedBy: string
  createdAt: number
  updatedAt: number
  version: number
}

export type WorkspaceChatMessage = {
  id: string
  workspaceId: string
  channelId: string
  authorId: string
  authorName: string
  authorInitials: string
  body: string
  createdAt: number
  editedAt: number | null
  deletedAt: number | null
  deletedBy: string | null
  attachment: WorkspaceMessageAttachment | null
}

export type WorkspaceAuditAction =
  | 'workspace.created'
  | 'channel.created'
  | 'note.created'
  | 'note.edited'
  | 'note.deleted'
  | 'member.joined'
  | 'member.role_changed'
  | 'member.removed'
  | 'settings.changed'
  | 'message.edited'
  | 'message.deleted'
  | 'report.created'
  | 'member.banned'
  | 'role.created'
  | 'role.updated'
  | 'role.deleted'
  | 'member.custom_roles_changed'
  | 'emoji.created'
  | 'emoji.deleted'
  | 'comment.created'
  | 'comment.edited'
  | 'comment.deleted'

export type WorkspaceAuditEntry = {
  id: string
  workspaceId: string
  actorId: string
  actorName: string
  action: WorkspaceAuditAction
  targetLabel: string
  reason: string
  createdAt: number
  metadata?: Record<string, string>
}

export type WorkspaceUpdateEntry = {
  version: string
  publishedAt: number
  title: string
  changes: string[]
}


export type WorkspaceNoteVersion = {
  id: string
  noteId: string
  version: number
  title: string
  body: string
  reason: string
  editedBy: string
  editorName: string
  createdAt: number
}


export type WorkspaceReportStatus =
  | 'open'
  | 'reviewed'
  | 'actioned'
  | 'dismissed'

export type WorkspaceReportProfile = {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  bannerUrl: string | null
  profileAccent: string
  bio: string
  platformRole: WorkspacePlatformRole
}

export type WorkspaceReportMembership = {
  workspaceId: string
  workspaceName: string
  role: WorkspaceRole
}

export type WorkspaceReportMessage = {
  workspaceId: string
  workspaceName: string
  channelName: string
  body: string
  createdAt: number
}

export type WorkspaceReportSnapshot = {
  reporter: WorkspaceReportProfile
  reported: WorkspaceReportProfile
  memberships: WorkspaceReportMembership[]
  messages: WorkspaceReportMessage[]
}


export type WorkspaceSupportCaseKind = 'bug' | 'space'
export type WorkspaceSupportCaseStatus = 'open' | 'reviewed' | 'actioned' | 'resolved' | 'dismissed'
export type WorkspaceSupportPriority = 'low' | 'normal' | 'high' | 'urgent'

export type WorkspaceSupportCase = {
  id: string
  kind: WorkspaceSupportCaseKind
  reporterId: string
  reporterName: string
  reporterUsername: string
  targetWorkspaceId: string | null
  targetWorkspaceName: string | null
  targetWorkspaceOwnerId: string | null
  targetWorkspaceOwnerName: string | null
  subject: string
  details: string
  status: WorkspaceSupportCaseStatus
  priority: WorkspaceSupportPriority
  assignedTo: string | null
  assignedToName: string | null
  restricted: boolean
  createdAt: number
  updatedAt: number
  resolvedAt: number | null
}


export type WorkspaceSupportUser = {
  id: string
  publicUserId: string
  username: string
  displayName: string
  avatarUrl: string | null
  platformRole: WorkspacePlatformRole
  banned: boolean
  spaceCount: number
  createdAt: number
}

export type WorkspaceSupportStaffMessage = {
  id: string
  senderUserId: string
  senderPublicUserId: string
  senderName: string
  senderUsername: string
  senderPlatformRole: WorkspacePlatformRole
  body: string
  createdAt: number
}
export type WorkspaceSupportMessage = {
  id: string
  recipientUserId: string
  recipientName: string
  senderUserId: string
  senderName: string
  caseId: string | null
  subject: string
  body: string
  createdAt: number
}

export type WorkspaceModerationReport = {
  id: string
  reporterId: string
  reportedUserId: string
  workspaceId: string | null
  reason: string
  details: string
  status: WorkspaceReportStatus
  createdAt: number
  reviewedAt: number | null
  reviewedBy: string | null
  isBanned: boolean
  snapshot: WorkspaceReportSnapshot
}

export type WorkspaceModerationIdentityInput = {
  username?: string
  displayName?: string
  randomizeUsername?: boolean
  randomizeDisplayName?: boolean
  clearAvatar?: boolean
}

export type WorkspaceUiState = {
  mode: 'preview' | 'connected'
  profile: WorkspaceProfile
  workspaces: WorkspaceSummary[]
  activeWorkspaceId: string
  channels: WorkspaceChannel[]
  members: WorkspaceMember[]
  notes: WorkspaceNote[]
  messages: WorkspaceChatMessage[]
  comments: WorkspaceNoteComment[]
  roles: WorkspaceCustomRole[]
  emojis: WorkspaceEmoji[]
  logs: WorkspaceAuditEntry[]
  updates: WorkspaceUpdateEntry[]
  activeChannelId: string
  activeView: WorkspaceView
  selectedNoteId: string | null
  mobileSidebarOpen: boolean
  memberRailOpen: boolean
}


export type WorkspaceSync = {
  serverTime: number
  workspace: WorkspaceSummary
  channels: WorkspaceChannel[] | null
  members: WorkspaceMember[] | null
  notes: WorkspaceNote[]
  messages: WorkspaceChatMessage[]
  comments: WorkspaceNoteComment[]
  roles: WorkspaceCustomRole[] | null
  emojis: WorkspaceEmoji[] | null
  logs: WorkspaceAuditEntry[]
  deletedNoteIds: string[]
}

export type WorkspaceBootstrap = {
  workspace: WorkspaceSummary
  channels: WorkspaceChannel[]
  members: WorkspaceMember[]
  notes: WorkspaceNote[]
  messages: WorkspaceChatMessage[]
  comments: WorkspaceNoteComment[]
  roles: WorkspaceCustomRole[]
  baseRoles?: WorkspaceBaseRoleSettings
  emojis: WorkspaceEmoji[]
  logs: WorkspaceAuditEntry[]
  updates: WorkspaceUpdateEntry[]
}

export type WorkspacePingNotificationKind = 'message' | 'mention' | 'everyone' | 'here' | 'role' | 'support' | 'direct' | 'group' | 'friend_request'

export type WorkspacePingNotification = {
  id: string
  workspaceId: string
  workspaceName: string
  channelId: string
  channelName: string
  authorName: string
  preview: string
  createdAt: number
  kind: WorkspacePingNotificationKind
  mentionLabel: string
  conversationId?: string | null
  groupId?: string | null
}
