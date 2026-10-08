import type { WorkspacePingNotification } from '../types/spaces'
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'

export function isMobileDeviceV72() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export async function ensureMobileNotificationPermissionV72(prompt = false) {
  if (!isMobileDeviceV72()) return false
  try {
    let granted = await isPermissionGranted()
    if (!granted && prompt) granted = (await requestPermission()) === 'granted'
    return granted
  } catch {
    return false
  }
}

function notificationCopyV72(item: WorkspacePingNotification, previews: boolean) {
  const preview = item.preview.trim().replace(/\s+/g, ' ').slice(0, 180)
  if (item.kind === 'direct') {
    return {
      title: `${item.authorName} · DM`,
      body: previews ? preview || 'Sent you a direct message.' : 'Sent you a direct message.',
    }
  }
  if (item.kind === 'group') {
    return {
      title: `${item.authorName} · ${item.channelName || 'Group DM'}`,
      body: previews ? preview || 'Sent a group message.' : 'Sent a group message.',
    }
  }
  if (item.kind === 'support') {
    return {
      title: 'Spaces Support',
      body: previews ? preview || 'New Support message.' : 'New Support message.',
    }
  }
  if (item.kind === 'friend_request') {
    return {
      title: `${item.authorName} · Friend Request`,
      body: 'Sent you a friend request.',
    }
  }
  if (item.kind === 'comment') {
    return {
      title: `New Comment on ${item.noteTitle || 'note'}`,
      body: previews ? `${item.authorName}: ${preview}`.slice(0, 180) : 'A note has a new comment.',
    }
  }
  return {
    title: `${item.authorName} · #${item.channelName}`,
    body: previews ? preview || item.mentionLabel || 'New message' : item.mentionLabel || 'New message',
  }
}

export async function sendMobileNotificationV72(item: WorkspacePingNotification, previews: boolean) {
  if (!isMobileDeviceV72()) return false
  if (!(await ensureMobileNotificationPermissionV72(false))) return false
  try {
    const copy = notificationCopyV72(item, previews)
    sendNotification({ title: copy.title, body: copy.body })
    return true
  } catch {
    return false
  }
}

export async function sendMobileTextNotificationV72(title: string, body: string) {
  if (!isMobileDeviceV72()) return false
  if (!(await ensureMobileNotificationPermissionV72(false))) return false
  try {
    sendNotification({ title, body: body.slice(0, 180) })
    return true
  } catch {
    return false
  }
}
