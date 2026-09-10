import { Icon } from './Icon'
import { SpacesLogo } from './SpacesLogo'
import { usePreferences } from '../state/PreferencesContext'
import { useSpaces } from '../state/SpacesContext'
import { timeAgo } from '../utils/format'

export function NotificationCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { notifications, clearNotifications, chooseWorkspace, chooseChannel } = useSpaces()
  const { preferences } = usePreferences()
  const visible = notifications.filter(item => {
    if (item.kind === 'support') return preferences.supportNotifications
    if (preferences.mutedWorkspaceIds.includes(item.workspaceId) || preferences.mutedChannelIds.includes(item.channelId)) return false
    if (item.kind === 'message') return preferences.notificationLevel === 'all'
    if (preferences.notificationLevel === 'none') return false
    if (item.kind === 'mention') return preferences.mentionNotifications
    if (item.kind === 'everyone' || item.kind === 'here') return preferences.everyoneNotifications
    if (item.kind === 'role') return preferences.roleNotifications
    return true
  })

  async function openNotification(item: (typeof notifications)[number]) {
    if (item.kind === 'support') {
      onClose()
      window.dispatchEvent(new CustomEvent('spaces-open-direct-center', { detail: { conversationId: null } }))
      window.setTimeout(() => window.dispatchEvent(new CustomEvent('spaces-direct-tab', { detail: 'support' })), 0)
      return
    }
    await chooseWorkspace(item.workspaceId)
    chooseChannel(item.channelId)
    onClose()
  }

  if (!open) return null
  return <>
    <button className="notification-center-scrim" aria-label="Close notifications" onPointerDown={onClose} />
    <aside className="notification-center page-enter" aria-label="Notifications">
      <header>
        <div><span className="eyebrow">INBOX</span><strong>Notifications</strong></div>
        <div>{visible.length > 0 && <button className="notification-clear" onClick={clearNotifications}>Mark all read</button>}<button className="icon-button" onClick={onClose}><Icon name="x" size={15}/></button></div>
      </header>
      <div className="notification-center-list">
        {visible.map(item => <button className={`notification-card ${item.kind === 'support' ? 'support-notification-card-v17' : ''}`} key={item.id} onClick={() => void openNotification(item)}>
          <span className={`notification-card-icon ${item.kind === 'support' ? 'support-notification-icon-v17' : 'notification-spaces-mark'}`}>{item.kind === 'support' ? <Icon name="shield" size={15}/> : <SpacesLogo title="Spaces notification" />}</span>
          <div><div><strong>{item.kind === 'support' ? 'Spaces Support' : item.authorName}</strong><time>{timeAgo(item.createdAt)}</time></div><span>{item.kind === 'support' ? (item.mentionLabel === 'Support reply' ? 'SUPPORT REPLY' : 'OFFICIAL SUPPORT DM') : `${item.workspaceName} · #${item.channelName} · ${item.kind === 'message' ? 'message' : item.mentionLabel}`}</span><p>{item.preview}</p></div>
          <Icon name="chevron" size={14}/>
        </button>)}
        {!visible.length && <div className="notification-empty"><span className="notification-empty-icon notification-spaces-mark"><SpacesLogo title="Spaces" /></span><strong>You're all caught up</strong><p>Mentions and important activity will collect here.</p></div>}
      </div>
    </aside>
  </>
}
