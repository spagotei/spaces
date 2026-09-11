import type {
  WorkspaceBootstrap,
  WorkspaceChatMessage,
  WorkspaceCustomPermission,
  WorkspaceCustomRole,
  WorkspaceBaseRoleSetting,
  WorkspaceEmoji,
  WorkspaceNoteComment,
  WorkspaceChannel,
  WorkspaceChannelPermission,
  WorkspaceChannelPermissionAction,
  WorkspaceChannelPermissionOverwrite,
  WorkspaceChannelPermissionTarget,
  WorkspaceBackgroundPreset,
  WorkspaceIconDecoration,
  WorkspaceMessageAttachment,
  WorkspaceInvite,
  WorkspaceModerationIdentityInput,
  WorkspaceModerationReport,
  WorkspaceNote,
  WorkspaceNoteVersion,
  WorkspaceProfile,
  WorkspacePingNotification,
  WorkspaceRole,
  WorkspaceSession,
  WorkspaceLoginResult,
  WorkspaceAccountSecurity,
  WorkspaceBetaAccessEntry,
  WorkspaceBetaAccessInviteResult,
  WorkspaceEmailVerificationStart,
  WorkspaceTwoFactorSetup,
  WorkspaceTwoFactorEnableResult,
  WorkspaceSessionInfo,
  WorkspaceSummary,
  WorkspaceSync,
  WorkspaceUpdateEntry,
  WorkspaceSupportCase,
  WorkspaceSupportMessage,
  WorkspaceSupportCaseKind,
  WorkspaceSupportCaseStatus,
  WorkspaceSupportPriority,
  WorkspaceSupportUser,
  WorkspaceSupportStaffMessage,
  WorkspaceDirectCenter,
  WorkspaceDirectConversation,
  WorkspaceDirectMessage,
  WorkspaceDirectGroup,
  WorkspaceDirectGroupMessage,
  WorkspaceDmPreference,
} from '../types/spaces'

const workspacePasswordEncoder =
  new TextEncoder()

const WORKSPACE_PASSWORD_ITERATIONS =
  310_000

function workspaceBytesToBase64(
  bytes:
    Uint8Array,
): string {
  let binary =
    ''

  for (
    const byte
    of bytes
  ) {
    binary +=
      String.fromCharCode(
        byte,
      )
  }

  return btoa(
    binary,
  )
}

function workspaceBase64ToBuffer(
  value:
    string,
): ArrayBuffer {
  const binary =
    atob(
      value,
    )

  const buffer =
    new ArrayBuffer(
      binary.length,
    )

  const bytes =
    new Uint8Array(
      buffer,
    )

  for (
    let index =
      0;
    index <
      binary.length;
    index +=
      1
  ) {
    bytes[index] =
      binary.charCodeAt(
        index,
      )
  }

  return buffer
}

function createWorkspacePasswordSalt():
  string {
  const bytes =
    new Uint8Array(
      16,
    )

  crypto.getRandomValues(
    bytes,
  )

  return workspaceBytesToBase64(
    bytes,
  )
}

async function deriveWorkspacePasswordVerifier(
  password:
    string,
  saltBase64:
    string,
  iterations:
    number,
): Promise<string> {
  const material =
    await crypto.subtle.importKey(
      'raw',
      workspacePasswordEncoder.encode(
        password,
      ),
      'PBKDF2',
      false,
      [
        'deriveBits',
      ],
    )

  const bits =
    await crypto.subtle.deriveBits(
      {
        name:
          'PBKDF2',

        hash:
          'SHA-256',

        salt:
          workspaceBase64ToBuffer(
            saltBase64,
          ),

        iterations,
      },
      material,
      256,
    )

  return workspaceBytesToBase64(
    new Uint8Array(
      bits,
    ),
  )
}

type WorkspaceAuthChallenge = {
  salt: string
  iterations: number
}

export type WorkspaceApiOptions = {
  baseUrl: string
  getToken?: () => string
}

type ApiErrorBody = {
  error?: string
  message?: string
}

export class WorkspaceApiError
  extends Error {
  readonly status:
    number

  constructor(
    message: string,
    status: number,
  ) {
    super(
      message,
    )

    this.name =
      'WorkspaceApiError'

    this.status =
      status
  }
}

/*
  Spaces API client.

  Cloudflare is only the infrastructure underneath this API.
  Accounts belong to Spaces; Cloudflare only hosts the infrastructure.

  The backend must be authoritative for:
  - account identity
  - platform badges
  - Space membership
  - Owner/Admin/Contributor/Viewer permissions
  - audit logs

  Never trust a client-supplied platformRole or Space role.
*/
export class WorkspaceApi {
  private readonly baseUrl:
    string

  private readonly getToken:
    () => string

  constructor(
    options: WorkspaceApiOptions,
  ) {
    this.baseUrl =
      options.baseUrl
        .replace(
          /\/+$/u,
          '',
        )

    this.getToken =
      options.getToken ??
      (() => '')
  }

  private async request<T>(
    path: string,
    init:
      RequestInit =
        {},
  ): Promise<T> {
    const headers =
      new Headers(
        init.headers,
      )

    headers.set(
      'Accept',
      'application/json',
    )

    if (
      init.body &&
      !headers.has(
        'Content-Type',
      )
    ) {
      headers.set(
        'Content-Type',
        'application/json',
      )
    }

    const token =
      this.getToken()

    if (token) {
      headers.set(
        'Authorization',
        `Bearer ${token}`,
      )
    }

    let response:
      Response

    try {
      response =
        await fetch(
          `${this.baseUrl}${path}`,
          {
            ...init,
            headers,
          },
        )
    } catch (
      caught
    ) {
      console.error(
        'Spaces request failed before receiving a response.',
        caught,
      )

      throw new WorkspaceApiError(
        'Could not reach the Spaces service. Check the Worker deployment and app network access.',
        0,
      )
    }

    if (
      !response.ok
    ) {
      let message =
        `Workspace request failed (${response.status}).`

      try {
        const body =
          await response
            .json() as
              ApiErrorBody

        message =
          body.message ??
          body.error ??
          message
      } catch {
        // Use the status message.
      }

      throw new WorkspaceApiError(
        message,
        response.status,
      )
    }

    if (
      response.status ===
      204
    ) {
      return undefined as T
    }

    return await response
      .json() as T
  }

  async login(
    identifier: string,
    password: string,
    twoFactorCode?: string,
  ): Promise<WorkspaceLoginResult> {
    const encodedIdentifier = encodeURIComponent(identifier)
    const challenge =
      await this.request<WorkspaceAuthChallenge>(
        `/v1/auth/challenge?username=${encodedIdentifier}&identifier=${encodedIdentifier}`,
      )

    const verifier =
      await deriveWorkspacePasswordVerifier(
        password,
        challenge.salt,
        challenge.iterations,
      )

    return this.request(
      '/v1/auth/login',
      {
        method:
          'POST',

        body:
          JSON.stringify({
            username: identifier,
            identifier,
            passwordVerifier:
              verifier,
            twoFactorCode,
          }),
      },
    )
  }

  async register(
    username: string,
    displayName: string,
    password: string,
  ): Promise<WorkspaceSession> {
    const passwordSalt =
      createWorkspacePasswordSalt()

    const passwordVerifier =
      await deriveWorkspacePasswordVerifier(
        password,
        passwordSalt,
        WORKSPACE_PASSWORD_ITERATIONS,
      )

    return this.request(
      '/v1/auth/register',
      {
        method:
          'POST',

        body:
          JSON.stringify({
            username,
            displayName,
            passwordSalt,
            passwordVerifier,
            passwordIterations:
              WORKSPACE_PASSWORD_ITERATIONS,
          }),
      },
    )
  }

  completeBetaProfile(input: {
    username: string
    displayName: string
    avatarUrl?: string | null
  }): Promise<WorkspaceSession> {
    return this.request(
      '/v1/account/complete-beta-profile',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    )
  }

  getMyProfile():
    Promise<WorkspaceProfile> {
    return this.request(
      '/v1/account/me',
    )
  }

  logout():
    Promise<void> {
    return this.request(
      '/v1/auth/logout',
      {
        method:
          'POST',
      },
    )
  }

  async changePassword(
    username: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const challenge =
      await this.request<WorkspaceAuthChallenge>(
        `/v1/auth/challenge?username=${encodeURIComponent(username)}`,
      )

    const currentVerifier =
      await deriveWorkspacePasswordVerifier(
        currentPassword,
        challenge.salt,
        challenge.iterations,
      )

    const newSalt =
      createWorkspacePasswordSalt()

    const newVerifier =
      await deriveWorkspacePasswordVerifier(
        newPassword,
        newSalt,
        WORKSPACE_PASSWORD_ITERATIONS,
      )

    return this.request(
      '/v1/account/password',
      {
        method:
          'PATCH',

        body:
          JSON.stringify({
            currentPasswordVerifier:
              currentVerifier,

            newPasswordSalt:
              newSalt,

            newPasswordVerifier:
              newVerifier,

            newPasswordIterations:
              WORKSPACE_PASSWORD_ITERATIONS,
          }),
      },
    )
  }

  listSessions():
    Promise<WorkspaceSessionInfo[]> {
    return this.request(
      '/v1/account/sessions',
    )
  }

  getAccountSecurity(): Promise<WorkspaceAccountSecurity> {
    return this.request('/v1/account/security')
  }

  async startEmailVerification(
    email: string,
    username?: string,
    currentPassword?: string,
    twoFactorCode?: string,
  ): Promise<WorkspaceEmailVerificationStart> {
    let currentPasswordVerifier: string | undefined
    if (currentPassword && username) {
      const challenge = await this.request<WorkspaceAuthChallenge>(
        `/v1/auth/challenge?username=${encodeURIComponent(username)}`,
      )
      currentPasswordVerifier = await deriveWorkspacePasswordVerifier(
        currentPassword,
        challenge.salt,
        challenge.iterations,
      )
    }
    return this.request('/v1/account/email/start', {
      method: 'POST',
      body: JSON.stringify({ email, currentPasswordVerifier, twoFactorCode }),
    })
  }

  verifyEmail(code: string): Promise<WorkspaceAccountSecurity> {
    return this.request('/v1/account/email/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
  }

  beginTwoFactorSetup(): Promise<WorkspaceTwoFactorSetup> {
    return this.request('/v1/account/2fa/setup', { method: 'POST' })
  }

  enableTwoFactor(code: string): Promise<WorkspaceTwoFactorEnableResult> {
    return this.request('/v1/account/2fa/enable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
  }

  disableTwoFactor(code: string): Promise<WorkspaceAccountSecurity> {
    return this.request('/v1/account/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
  }

  regenerateRecoveryCodes(code: string): Promise<WorkspaceTwoFactorEnableResult> {
    return this.request('/v1/account/2fa/recovery', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
  }

  getDirectCenter(): Promise<WorkspaceDirectCenter> {
    return this.request('/v1/direct/center')
  }

  requestDirectConversation(input: { username?: string; targetUserId?: string; sourceWorkspaceId?: string | null }): Promise<WorkspaceDirectConversation> {
    return this.request('/v1/direct/requests', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  acceptDirectConversation(conversationId: string): Promise<WorkspaceDirectConversation> {
    return this.request(`/v1/direct/conversations/${encodeURIComponent(conversationId)}/accept`, { method: 'POST' })
  }

  declineDirectConversation(conversationId: string): Promise<void> {
    return this.request(`/v1/direct/conversations/${encodeURIComponent(conversationId)}/request`, { method: 'DELETE' })
  }

  listDirectMessages(conversationId: string): Promise<WorkspaceDirectMessage[]> {
    return this.request(`/v1/direct/conversations/${encodeURIComponent(conversationId)}/messages`)
  }

  sendDirectMessage(conversationId: string, body: string): Promise<WorkspaceDirectMessage> {
    return this.request(`/v1/direct/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    })
  }

  createDirectGroup(name: string, memberUserIds: string[]): Promise<WorkspaceDirectGroup> {
    return this.request('/v1/direct/groups', {
      method: 'POST',
      body: JSON.stringify({ name, memberUserIds }),
    })
  }

  updateDirectGroup(groupId: string, name: string): Promise<WorkspaceDirectGroup> {
    return this.request(`/v1/direct/groups/${encodeURIComponent(groupId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    })
  }

  listDirectGroupMessages(groupId: string): Promise<WorkspaceDirectGroupMessage[]> {
    return this.request(`/v1/direct/groups/${encodeURIComponent(groupId)}/messages`)
  }

  sendDirectGroupMessage(groupId: string, body: string): Promise<WorkspaceDirectGroupMessage> {
    return this.request(`/v1/direct/groups/${encodeURIComponent(groupId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    })
  }

  getWorkspaceDmPreference(workspaceId: string): Promise<WorkspaceDmPreference> {
    return this.request(`/v1/workspaces/${encodeURIComponent(workspaceId)}/dm-preference`)
  }

  updateWorkspaceDmPreference(workspaceId: string, allowDms: boolean): Promise<WorkspaceDmPreference> {
    return this.request(`/v1/workspaces/${encodeURIComponent(workspaceId)}/dm-preference`, {
      method: 'PATCH',
      body: JSON.stringify({ allowDms }),
    })
  }

  setPlatformSupportRole(userId: string, role: 'support' | null): Promise<WorkspaceProfile> {
    return this.request(`/v1/platform/users/${encodeURIComponent(userId)}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    })
  }


  revokeSession(
    sessionId: string,
  ): Promise<void> {
    return this.request(
      `/v1/account/sessions/${encodeURIComponent(sessionId)}`,
      {
        method:
          'DELETE',
      },
    )
  }

  getPublicProfile(
    username: string,
  ): Promise<WorkspaceProfile> {
    return this.request(
      `/v1/profiles/${encodeURIComponent(username)}`,
    )
  }

  updateMyProfile(
    profile:
      Pick<
        WorkspaceProfile,
        'displayName' |
        'bio' |
        'publicProfile' |
        'profileAccent'
      >,
  ): Promise<WorkspaceProfile> {
    return this.request(
      '/v1/account/profile',
      {
        method:
          'PATCH',

        body:
          JSON.stringify(
            profile,
          ),
      },
    )
  }

  setMyAvatar(
    avatarUrl: string | null,
  ): Promise<WorkspaceProfile> {
    return this.request(
      '/v1/account/avatar',
      {
        method:
          'PATCH',

        body:
          JSON.stringify({
            avatarUrl,
          }),
      },
    )
  }

  setMyBanner(
    bannerUrl: string | null,
  ): Promise<WorkspaceProfile> {
    return this.request(
      '/v1/account/banner',
      {
        method: 'PATCH',
        body: JSON.stringify({ bannerUrl }),
      },
    )
  }


  listPingNotifications(
    since: number,
  ): Promise<WorkspacePingNotification[]> {
    return this.request(
      `/v1/notifications?since=${encodeURIComponent(String(since))}`,
    )
  }

  listWorkspaces():
    Promise<WorkspaceSummary[]> {
    return this.request(
      '/v1/workspaces',
    )
  }

  bootstrapWorkspace(
    workspaceId: string,
  ): Promise<WorkspaceBootstrap> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/bootstrap`,
    )
  }

  syncWorkspace(
    workspaceId: string,
    since: number,
    includeStructure = false,
  ): Promise<WorkspaceSync> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/sync?since=${encodeURIComponent(String(since))}&structure=${includeStructure ? '1' : '0'}`,
    )
  }

  createWorkspace(
    name: string,
  ): Promise<WorkspaceSummary> {
    return this.request(
      '/v1/workspaces',
      {
        method:
          'POST',

        body:
          JSON.stringify({
            name,
          }),
      },
    )
  }

  joinWorkspace(
    code: string,
  ): Promise<WorkspaceSummary> {
    return this.request(
      '/v1/workspaces/join',
      {
        method: 'POST',
        body: JSON.stringify({ code }),
      },
    )
  }

  joinInvite(
    code: string,
  ): Promise<WorkspaceSummary> {
    return this.request(
      '/v1/invites/join',
      {
        method:
          'POST',

        body:
          JSON.stringify({
            code,
          }),
      },
    )
  }

  updateWorkspace(
    workspaceId: string,
    input:
      | string
      | {
          name?: string
          description?: string
          avatarUrl?: string | null
          background?: WorkspaceBackgroundPreset
          accentColor?: string
          bannerUrl?: string | null
          iconDecoration?: WorkspaceIconDecoration
        },
  ): Promise<WorkspaceSummary> {
    const body =
      typeof input ===
        'string'
        ? {
            name:
              input,
          }
        : input

    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}`,
      {
        method:
          'PATCH',

        body:
          JSON.stringify(
            body,
          ),
      },
    )
  }


  listChannelPermissionOverwrites(
    workspaceId: string,
    channelId: string,
  ): Promise<WorkspaceChannelPermissionOverwrite[]> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/channels/${encodeURIComponent(channelId)}/permission-overwrites`,
    )
  }

  saveChannelPermissionOverwrite(
    workspaceId: string,
    channelId: string,
    targetType: WorkspaceChannelPermissionTarget,
    targetId: string,
    allow: WorkspaceChannelPermissionAction[],
    deny: WorkspaceChannelPermissionAction[],
  ): Promise<WorkspaceChannelPermissionOverwrite> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/channels/${encodeURIComponent(channelId)}/permission-overwrites`,
      { method: 'PUT', body: JSON.stringify({ targetType, targetId, allow, deny }) },
    )
  }

  deleteChannelPermissionOverwrite(
    workspaceId: string,
    channelId: string,
    targetType: WorkspaceChannelPermissionTarget,
    targetId: string,
  ): Promise<void> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/channels/${encodeURIComponent(channelId)}/permission-overwrites/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`,
      { method: 'DELETE' },
    )
  }

  updateChannelPermissions(
    workspaceId: string,
    channelId: string,
    postMinRole: WorkspaceChannelPermission,
    noteMinRole: WorkspaceChannelPermission,
  ): Promise<WorkspaceChannel> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/channels/${encodeURIComponent(channelId)}/permissions`,
      {
        method:
          'PATCH',

        body:
          JSON.stringify({
            postMinRole,
            noteMinRole,
          }),
      },
    )
  }

  leaveWorkspace(
    workspaceId: string,
  ): Promise<void> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/membership`,
      {
        method:
          'DELETE',
      },
    )
  }

  deleteWorkspace(
    workspaceId: string,
  ): Promise<void> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}`,
      {
        method:
          'DELETE',
      },
    )
  }

  listInvites(
    workspaceId: string,
  ): Promise<WorkspaceInvite[]> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/invites`,
    )
  }

  createInvite(
    workspaceId: string,
  ): Promise<WorkspaceInvite> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/invites`,
      {
        method:
          'POST',

        body:
          JSON.stringify({
            expiresInDays:
              7,

            maxUses:
              25,
          }),
      },
    )
  }

  revokeInvite(
    workspaceId: string,
    inviteId: string,
  ): Promise<void> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/invites/${encodeURIComponent(inviteId)}`,
      {
        method:
          'DELETE',
      },
    )
  }

  createChannel(
    workspaceId: string,
    name: string,
    description: string,
    kind:
      'notes' |
      'chat' |
      'mixed' |
      'announcement',
  ): Promise<WorkspaceChannel> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/channels`,
      {
        method:
          'POST',

        body:
          JSON.stringify({
            name,
            description,
            kind,
          }),
      },
    )
  }

  deleteChannel(
    workspaceId: string,
    channelId: string,
  ): Promise<void> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/channels/${encodeURIComponent(channelId)}`,
      { method: 'DELETE' },
    )
  }

  saveNote(
    workspaceId: string,
    note:
      Pick<
        WorkspaceNote,
        'id' |
        'channelId' |
        'title' |
        'body'
      >,
    reason: string,
  ): Promise<WorkspaceNote> {
    const path =
      note.id
        ? `/v1/workspaces/${encodeURIComponent(workspaceId)}/notes/${encodeURIComponent(note.id)}`
        : `/v1/workspaces/${encodeURIComponent(workspaceId)}/notes`

    return this.request(
      path,
      {
        method:
          note.id
            ? 'PATCH'
            : 'POST',

        body:
          JSON.stringify({
            channelId:
              note.channelId,

            title:
              note.title,

            body:
              note.body,

            reason,
          }),
      },
    )
  }

  listNoteVersions(
    workspaceId: string,
    noteId: string,
  ): Promise<WorkspaceNoteVersion[]> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/notes/${encodeURIComponent(noteId)}/versions`,
    )
  }

  deleteNote(
    workspaceId: string,
    noteId: string,
  ): Promise<void> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/notes/${encodeURIComponent(noteId)}`,
      {
        method:
          'DELETE',
      },
    )
  }

  sendMessage(
    workspaceId: string,
    channelId: string,
    body: string,
    attachment: WorkspaceMessageAttachment | null = null,
  ): Promise<WorkspaceChatMessage> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/channels/${encodeURIComponent(channelId)}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ body, attachment }),
      },
    )
  }

  editMessage(
    workspaceId: string,
    messageId: string,
    body: string,
  ): Promise<WorkspaceChatMessage> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/messages/${encodeURIComponent(messageId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ body }),
      },
    )
  }

  deleteMessage(
    workspaceId: string,
    messageId: string,
  ): Promise<void> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/messages/${encodeURIComponent(messageId)}`,
      { method: 'DELETE' },
    )
  }

  async downloadAttachment(
    downloadPath: string,
  ): Promise<Blob> {
    const headers = new Headers()
    const token = this.getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const response = await fetch(`${this.baseUrl}${downloadPath}`, { headers })
    if (!response.ok) {
      let message = `Attachment request failed (${response.status}).`
      try {
        const body = await response.json() as ApiErrorBody
        message = body.message ?? body.error ?? message
      } catch { /* Use status message. */ }
      throw new WorkspaceApiError(message, response.status)
    }
    return await response.blob()
  }


  updateBaseRoleSetting(
    workspaceId: string,
    role: 'owner' | 'member',
    input: Partial<Pick<WorkspaceBaseRoleSetting, 'color' | 'hoist' | 'mentionable'>>,
  ): Promise<WorkspaceBaseRoleSetting> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/base-roles/${encodeURIComponent(role)}`,
      { method: 'PATCH', body: JSON.stringify(input) },
    )
  }

  createCustomRole(
    workspaceId: string,
    input: {
      name: string
      color: string
      permissions: WorkspaceCustomPermission[]
      hoist?: boolean
      mentionable?: boolean
    },
  ): Promise<WorkspaceCustomRole> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/roles`,
      { method: 'POST', body: JSON.stringify(input) },
    )
  }

  updateCustomRole(
    workspaceId: string,
    roleId: string,
    input: Partial<Pick<WorkspaceCustomRole, 'name' | 'color' | 'permissions' | 'position' | 'hoist' | 'mentionable'>>,
  ): Promise<WorkspaceCustomRole> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/roles/${encodeURIComponent(roleId)}`,
      { method: 'PATCH', body: JSON.stringify(input) },
    )
  }

  deleteCustomRole(
    workspaceId: string,
    roleId: string,
  ): Promise<void> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/roles/${encodeURIComponent(roleId)}`,
      { method: 'DELETE' },
    )
  }

  setMemberCustomRoles(
    workspaceId: string,
    memberId: string,
    roleIds: string[],
  ): Promise<void> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(memberId)}/custom-roles`,
      { method: 'PATCH', body: JSON.stringify({ roleIds }) },
    )
  }

  createEmoji(
    workspaceId: string,
    name: string,
    imageType: string,
    imageData: string,
  ): Promise<WorkspaceEmoji> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/emojis`,
      { method: 'POST', body: JSON.stringify({ name, imageType, imageData }) },
    )
  }

  deleteEmoji(
    workspaceId: string,
    emojiId: string,
  ): Promise<void> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/emojis/${encodeURIComponent(emojiId)}`,
      { method: 'DELETE' },
    )
  }

  addNoteComment(
    workspaceId: string,
    noteId: string,
    body: string,
  ): Promise<WorkspaceNoteComment> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/notes/${encodeURIComponent(noteId)}/comments`,
      { method: 'POST', body: JSON.stringify({ body }) },
    )
  }

  editNoteComment(
    workspaceId: string,
    commentId: string,
    body: string,
  ): Promise<WorkspaceNoteComment> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/comments/${encodeURIComponent(commentId)}`,
      { method: 'PATCH', body: JSON.stringify({ body }) },
    )
  }

  deleteNoteComment(
    workspaceId: string,
    commentId: string,
  ): Promise<void> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/comments/${encodeURIComponent(commentId)}`,
      { method: 'DELETE' },
    )
  }

  changeMemberRole(
    workspaceId: string,
    memberId: string,
    role: WorkspaceRole,
  ): Promise<void> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(memberId)}/role`,
      {
        method:
          'PATCH',

        body:
          JSON.stringify({
            role,
          }),
      },
    )
  }
  removeMember(
    workspaceId: string,
    memberId: string,
  ): Promise<void> {
    return this.request(
      `/v1/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(memberId)}`,
      {
        method:
          'DELETE',
      },
    )
  }

  reportUser(
    reportedUserId: string,
    workspaceId: string | null,
    reason: string,
    details: string,
  ): Promise<{
    id: string
  }> {
    return this.request(
      '/v1/reports',
      {
        method:
          'POST',

        body:
          JSON.stringify({
            reportedUserId,
            workspaceId,
            reason,
            details,
          }),
      },
    )
  }

  listModerationReports():
    Promise<WorkspaceModerationReport[]> {
    return this.request(
      '/v1/moderation/reports',
    )
  }

  banUser(
    userId: string,
    reason: string,
    reportId: string | null,
  ): Promise<void> {
    return this.request(
      `/v1/moderation/users/${encodeURIComponent(userId)}/ban`,
      {
        method:
          'POST',

        body:
          JSON.stringify({
            reason,
            reportId,
          }),
      },
    )
  }

  unbanUser(
    userId: string,
  ): Promise<void> {
    return this.request(
      `/v1/moderation/users/${encodeURIComponent(userId)}/ban`,
      {
        method:
          'DELETE',
      },
    )
  }

  moderateUserIdentity(
    userId: string,
    input: WorkspaceModerationIdentityInput,
  ): Promise<WorkspaceProfile> {
    return this.request(
      `/v1/moderation/users/${encodeURIComponent(userId)}/identity`,
      {
        method:
          'PATCH',

        body:
          JSON.stringify(
            input,
          ),
      },
    )
  }

  updateReportStatus(
    reportId: string,
    status:
      'reviewed' |
      'dismissed',
  ): Promise<void> {
    return this.request(
      `/v1/moderation/reports/${encodeURIComponent(reportId)}`,
      {
        method:
          'PATCH',

        body:
          JSON.stringify({
            status,
          }),
      },
    )
  }

  createSupportCase(input: {
    kind: WorkspaceSupportCaseKind
    subject: string
    details: string
    workspaceId?: string | null
    priority?: WorkspaceSupportPriority
  }): Promise<WorkspaceSupportCase> {
    return this.request('/v1/support/cases', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  listSupportCases(): Promise<WorkspaceSupportCase[]> {
    return this.request('/v1/support/cases')
  }

  updateSupportCase(
    caseId: string,
    input: { status?: WorkspaceSupportCaseStatus; priority?: WorkspaceSupportPriority; assignToMe?: boolean },
  ): Promise<WorkspaceSupportCase> {
    return this.request(`/v1/support/cases/${encodeURIComponent(caseId)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  }

  listSupportMessages(): Promise<WorkspaceSupportMessage[]> {
    return this.request('/v1/support/messages')
  }

  sendSupportMessage(input: {
    recipientUserId: string
    subject: string
    body: string
    caseId?: string | null
  }): Promise<WorkspaceSupportMessage> {
    return this.request('/v1/support/messages', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  searchSupportUsers(query: string): Promise<WorkspaceSupportUser[]> {
    return this.request(`/v1/support/users?q=${encodeURIComponent(query)}`)
  }

  listSupportStaffMessages(): Promise<WorkspaceSupportStaffMessage[]> {
    return this.request('/v1/support/staff-chat')
  }

  sendSupportStaffMessage(body: string): Promise<WorkspaceSupportStaffMessage> {
    return this.request('/v1/support/staff-chat', {
      method: 'POST',
      body: JSON.stringify({ body }),
    })
  }

  listBetaAccess(): Promise<WorkspaceBetaAccessEntry[]> {
    return this.request('/v1/support/beta-access')
  }

  inviteBetaEmail(
    email: string,
    options?: { subject?: string; message?: string },
  ): Promise<WorkspaceBetaAccessInviteResult> {
    const subject = options?.subject?.trim() || 'You’re in Spaces'
    const template = options?.message?.trim()
      || 'Your access to the Spaces Public Beta is ready.\n\nOpen Spaces and continue with {email}. We’ll send a one-time verification code to confirm your invitation. Once verified, you’ll choose your username and password.\n\nThis invitation is linked to this email address.\n\nWelcome to Spaces.'
    const message = template.split('{email}').join(email)
    return this.request('/v1/support/beta-access', {
      method: 'POST',
      body: JSON.stringify({ email, subject, message }),
    })
  }

  revokeBetaAccess(accessId: string): Promise<void> {
    return this.request(`/v1/support/beta-access/${encodeURIComponent(accessId)}`, { method: 'DELETE' })
  }

  restrictSupportSpace(workspaceId: string, reason: string): Promise<void> {
    return this.request(`/v1/support/spaces/${encodeURIComponent(workspaceId)}/restriction`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  }

  unrestrictSupportSpace(workspaceId: string): Promise<void> {
    return this.request(`/v1/support/spaces/${encodeURIComponent(workspaceId)}/restriction`, { method: 'DELETE' })
  }

  deleteSupportSpace(workspaceId: string, confirmation: string, reason: string): Promise<void> {
    return this.request(`/v1/support/spaces/${encodeURIComponent(workspaceId)}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirmation, reason }),
    })
  }

  listUpdates():
    Promise<WorkspaceUpdateEntry[]> {
    return this.request(
      '/v1/updates',
    )
  }

  createUpdate(
    version: string,
    title: string,
    changes: string[],
  ): Promise<WorkspaceUpdateEntry> {
    return this.request(
      '/v1/updates',
      {
        method:
          'POST',

        body:
          JSON.stringify({
            version,
            title,
            changes,
          }),
      },
    )
  }

  updateUpdate(
    version: string,
    title: string,
    changes: string[],
  ): Promise<WorkspaceUpdateEntry> {
    return this.request(
      `/v1/updates/${encodeURIComponent(version)}`,
      {
        method:
          'PATCH',

        body:
          JSON.stringify({
            title,
            changes,
          }),
      },
    )
  }

  deleteUpdate(
    version: string,
  ): Promise<void> {
    return this.request(
      `/v1/updates/${encodeURIComponent(version)}`,
      {
        method:
          'DELETE',
      },
    )
  }

}
