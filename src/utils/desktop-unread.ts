import { getCurrentWindow, UserAttentionType } from '@tauri-apps/api/window'

function tauriAvailable() {
  return typeof window !== 'undefined' && Boolean((window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
}

export async function syncDesktopUnread(count: number) {
  if (typeof document !== 'undefined') {
    document.title = count > 0 ? `(${count > 9 ? '9+' : count}) Spaces` : 'Spaces'
  }
  if (!tauriAvailable()) return
  try {
    // Native badge count is supported where the OS exposes it. Windows ignores
    // this API, so requestUserAttention below handles the taskbar there.
    await getCurrentWindow().setBadgeCount(count > 0 ? count : undefined)
  } catch {
    // Keep web/PWA and restrictive Tauri capability sets fully functional.
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
