import { Icon } from './Icon'
import { SpacesLogo } from './SpacesLogo'
import { usePreferences } from '../state/PreferencesContext'
import { useSpaces } from '../state/SpacesContext'
import { timeAgo } from '../utils/format'
import { dismissNotifications } from '../utils/notification-read'

function isGlobalDirectKind(kind: string) {
  return kind === 'support' || kind === 'direct' || kind === 'group' || kind === 'friend_request'
}

function notificationTone(kind: string) {
  return kind === 'support' || kind === 'friend_request' ? 'orange' : 'blue'
}

export function NotificationCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { notifications, clearNotifications, chooseWorkspace, chooseChannel } = useSpaces()
  const { preferences } = usePreferences()
  const visible = notifications.filter(item => {
    if (item.kind === 'support') return preferences.supportNotifications
    if (item.kind === 'direct') return preferences.directNotifications
    if (item.kind === 'group') return preferences.groupNotifications
    if (item.kind === 'friend_request') return preferences.friendRequestNotifications
    if (item.kind === 'comment') return preferences.commentNotifications
    if (preferences.mutedWorkspaceIds.includes(item.workspaceId) || preferences.mutedChannelIds.includes(item.channelId)) return false
    if (item.kind === 'message') return preferences.notificationLevel === 'all'
    if (preferences.notificationLevel === 'none') return false
    if (item.kind === 'mention') return preferences.mentionNotifications
    if (item.kind === 'everyone' || item.kind === 'here') return preferences.everyoneNotifications
    if (item.kind === 'role') return preferences.roleNotifications
    return true
  })

  async function openNotification(item: (typeof notifications)[number]) {
    dismissNotifications({ id: item.id })
    onClose()

    if (item.kind === 'support') {
      window.dispatchEvent(new CustomEvent('spaces-open-direct-center', { detail: { conversationId: null, groupId: null } }))
      window.setTimeout(() => window.dispatchEvent(new CustomEvent('spaces-direct-tab', { detail: 'support' })), 0)
      return
    }
    if (item.kind === 'friend_request') {
      window.dispatchEvent(new CustomEvent('spaces-open-direct-center', { detail: { conversationId: null, groupId: null } }))
      window.setTimeout(() => window.dispatchEvent(new CustomEvent('spaces-direct-tab', { detail: 'requests' })), 0)
      return
    }
    if (item.kind === 'direct' && item.conversationId) {
      window.dispatchEvent(new CustomEvent('spaces-open-direct-center', { detail: { conversationId: item.conversationId, groupId: null } }))
      return
    }
    if (item.kind === 'group' && item.groupId) {
      window.dispatchEvent(new CustomEvent('spaces-open-direct-center', { detail: { conversationId: null, groupId: item.groupId } }))
      return
    }

    await chooseWorkspace(item.workspaceId)
    chooseChannel(item.channelId)
  }

  function sourceLabel(item: (typeof notifications)[number]) {
    if (item.kind === 'support') return item.mentionLabel === 'Support reply' ? 'Support Reply' : 'Support DM'
    if (item.kind === 'friend_request') return 'Friend request'
    if (item.kind === 'direct') return 'Direct message'
    if (item.kind === 'group') return item.channelName || 'Group chat'
    if (item.kind === 'comment') return `New Comment on ${item.noteTitle || 'note'}`
    return `${item.workspaceName} · #${item.channelName} · ${item.kind === 'message' ? 'message' : item.mentionLabel}`
  }

  function sourceIcon(item: (typeof notifications)[number]) {
    if (item.kind === 'support') return <Icon name="shield" size={15}/>
    if (item.kind === 'friend_request') return <Icon name="members" size={15}/>
    if (item.kind === 'direct') return <Icon name="message" size={15}/>
    if (item.kind === 'group') return <Icon name="chat" size={15}/>
    if (item.kind === 'comment') return <Icon name="notes" size={15}/>
    return <SpacesLogo title="Spaces notification" />
  }

  if (!open) return null

  return <>
    <button className="notification-center-scrim" aria-label="Close notifications" onPointerDown={onClose} />
    <aside className="notification-center page-enter notification-center-v62" aria-label="Notifications">
      <header>
        <div><span className="eyebrow">GLOBAL INBOX</span><strong>Notifications</strong></div>
        <div>
          {visible.length > 0 && <button className="notification-clear" onClick={clearNotifications}>Mark all read</button>}
          <button className="icon-button" onClick={onClose}><Icon name="x" size={15}/></button>
        </div>
      </header>
      <div className="notification-center-list">
        {visible.map(item => <button
          className={`notification-card notification-tone-${notificationTone(item.kind)} ${isGlobalDirectKind(item.kind) ? `global-notification-v54 notification-${item.kind}-v54` : ''}`}
          key={item.id}
          onClick={() => void openNotification(item)}
        >
          <span className={`notification-card-icon ${item.kind === 'support' ? 'support-notification-icon-v17' : isGlobalDirectKind(item.kind) ? 'global-notification-icon-v54' : 'notification-spaces-mark'}`}>{sourceIcon(item)}</span>
          <div>
            <div><strong>{item.kind === 'support' ? 'Spaces Support' : item.authorName}</strong><time>{timeAgo(item.createdAt)}</time></div>
            <span>{sourceLabel(item)}</span>
            <p>{item.preview}</p>
          </div>
          <Icon name="chevron" size={14}/>
        </button>)}
        {!visible.length && <div className="notification-empty"><span className="notification-empty-icon notification-spaces-mark"><SpacesLogo title="Spaces" /></span><strong>You're all caught up</strong><p>Server activity, DMs, friend requests, and Support messages collect here.</p></div>}
      </div>
    </aside>
  </>
}
