import type { WorkspacePingNotificationKind } from '../types/spaces'

export type NotificationDismissFilter = {
  id?: string
  workspaceId?: string
  channelId?: string
  conversationId?: string
  groupId?: string
  kind?: WorkspacePingNotificationKind
}

export function dismissNotifications(filter: NotificationDismissFilter) {
  window.dispatchEvent(
    new CustomEvent('spaces-notifications-dismiss', { detail: filter }),
  )
}
