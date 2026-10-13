/** Browser tab/PWA unread visual. Tauri retains the existing Windows 9+ badge. */
let originalFavicon: string | null = null
let originalIcon: HTMLLinkElement | null = null
export function syncBrowserUnreadV88(unread: number): void {
  if (typeof document === 'undefined') return
  const count = Number.isFinite(unread) ? Math.max(0, Math.floor(unread)) : 0
  const label = count > 99 ? '99+' : String(count)
  document.title = count ? `(${label}) Spaces` : 'Spaces'
  const icon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
  if (icon) {
    if (icon !== originalIcon) { originalIcon = icon; originalFavicon = icon.getAttribute('href') }
    if (count) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect x="2" y="2" width="60" height="60" rx="15" fill="#1a1c21" stroke="#817c8b" stroke-width="3"/><text x="22" y="43" font-size="35" text-anchor="middle" fill="#efedf2" font-family="system-ui" font-weight="700">S</text><rect x="28" y="1" width="35" height="25" rx="11" fill="#d34a67"/><text x="45.5" y="18" font-size="14" text-anchor="middle" fill="white" font-family="system-ui" font-weight="700">${label}</text></svg>`
      icon.setAttribute('href', 'data:image/svg+xml,' + encodeURIComponent(svg))
    } else if (originalFavicon !== null) icon.setAttribute('href', originalFavicon)
    else icon.removeAttribute('href')
  }
  const nav = typeof navigator !== 'undefined' ? navigator as Navigator & {setAppBadge?: (n: number) => Promise<void>;clearAppBadge?: () => Promise<void>} : null
  if (count) void nav?.setAppBadge?.(count).catch(() => {})
  else void nav?.clearAppBadge?.().catch(() => {})
}
