import { getCurrentWindow, UserAttentionType } from '@tauri-apps/api/window'

export type DesktopUnreadTone = 'blue' | 'orange'

function tauriAvailable() {
  return typeof window !== 'undefined' && Boolean((window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
}

async function overlayIcon(count: number, tone: DesktopUnreadTone) {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const context = canvas.getContext('2d')
  if (!context) return undefined

  context.clearRect(0, 0, 64, 64)
  context.beginPath()
  context.arc(32, 32, 29, 0, Math.PI * 2)
  context.fillStyle = tone === 'orange' ? '#f59e0b' : '#3b82f6'
  context.fill()

  context.lineWidth = 4
  context.strokeStyle = 'rgba(255,255,255,.95)'
  context.stroke()

  const label = count > 99 ? '99+' : String(count)
  context.fillStyle = '#ffffff'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = `700 ${label.length > 2 ? 22 : 29}px Arial, sans-serif`
  context.fillText(label, 32, 34)

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return undefined
  return new Uint8Array(await blob.arrayBuffer())
}

export async function syncDesktopUnread(
  count: number,
  tone: DesktopUnreadTone = 'blue',
) {
  if (typeof document !== 'undefined') {
    document.title = count > 0 ? `(${count > 99 ? '99+' : count}) Spaces` : 'Spaces'
  }
  if (!tauriAvailable()) return

  const appWindow = getCurrentWindow()

  try {
    // macOS/Linux/iOS use native numeric badges. Windows ignores this API.
    await appWindow.setBadgeCount(count > 0 ? count : undefined)
  } catch {
    // Optional platform enhancement.
  }

  try {
    // Windows uses a taskbar overlay icon instead of setBadgeCount.
    await appWindow.setOverlayIcon(count > 0 ? await overlayIcon(count, tone) : undefined)
  } catch {
    // Non-Windows platforms and older runtimes can safely ignore this.
  }
}

export async function requestDesktopAttention(kind: 'normal' | 'request' = 'normal') {
  if (!tauriAvailable() || (typeof document !== 'undefined' && document.hasFocus())) return
  try {
    await getCurrentWindow().requestUserAttention(
      kind === 'request' ? UserAttentionType.Critical : UserAttentionType.Informational,
    )
  } catch {
    // Optional desktop enhancement only.
  }
}

export async function clearDesktopAttention() {
  if (!tauriAvailable()) return
  try {
    await getCurrentWindow().requestUserAttention(null)
  } catch {
    // Optional desktop enhancement only.
  }
}
