import { useCallback, useEffect, useState } from 'react'
import { useSpaces } from '../state/SpacesContext'
import './broadcast-v83.css'

// SPACES_V83_BROADCAST_UI: same signed-in data on Windows, web app, and Android.
type Broadcast = {
  id: string
  format: 'banner' | 'modal'
  title: string
  body: string
  imageUrl: string | null
  actionLabel: string | null
  actionUrl: string | null
  publishedAt: number
}

export function BroadcastSurfaceV83() {
  const { apiUrl, session } = useSpaces()
  const [items, setItems] = useState<Broadcast[]>([])
  const [hidden, setHidden] = useState<string[]>([])
  const refresh = useCallback(async () => {
    if (!session?.token || document.visibilityState === 'hidden') return
    try {
      const res = await fetch(`${apiUrl}/v1/broadcasts/active`, {
        headers: { Authorization: `Bearer ${session.token}` }, cache: 'no-store',
      })
      if (!res.ok) return
      const data = await res.json() as { broadcasts?: Broadcast[] }
      if (Array.isArray(data.broadcasts)) setItems(data.broadcasts)
    } catch { /* Network disconnected: retry when app becomes visible */ }
  }, [apiUrl, session?.token])

  useEffect(() => {
    setItems([])
    setHidden([])
    void refresh()
    const timer = window.setInterval(() => void refresh(), 60000)
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    const onFocus = () => void refresh()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    window.addEventListener('spaces-broadcast-changed', onFocus)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('spaces-broadcast-changed', onFocus)
    }
  }, [refresh])

  const visible = items.filter(item => !hidden.includes(item.id))
  const banner = visible.find(item => item.format === 'banner')
  const modal = visible.find(item => item.format === 'modal')

  useEffect(() => {
    document.documentElement.classList.toggle('spaces-v83-has-banner', Boolean(banner))
    return () => document.documentElement.classList.remove('spaces-v83-has-banner')
  }, [banner])

  const dismiss = async (id: string) => {
    setHidden(old => old.includes(id) ? old : [...old, id])
    try {
      const r = await fetch(`${apiUrl}/v1/broadcasts/${encodeURIComponent(id)}/dismiss`, {
        method: 'POST', headers: { Authorization: `Bearer ${session?.token || ''}` },
      })
      if (!r.ok) throw Error('Could not save broadcast dismissal')
    } catch {
      // Restore eligibility next time the app opens if the server could not persist dismissal.
      console.warn('[Spaces] Announcement dismissal did not sync; will retry on next launch.')
    }
  }
  if (!banner && !modal) return null
  return <>
    {banner && <aside className="spaces-broadcast-banner-v83" aria-label="Spaces announcement">
      <strong>{banner.title}</strong>
      <span>{banner.body}</span>
      {banner.actionUrl && banner.actionLabel && <a href={banner.actionUrl} target="_blank" rel="noopener noreferrer">{banner.actionLabel}</a>}
      <button type="button" aria-label="Dismiss announcement" onClick={() => void dismiss(banner.id)}>×</button>
    </aside>}
    {modal && <div className="spaces-broadcast-backdrop-v83" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="spaces-broadcast-title-v83" aria-describedby="spaces-broadcast-desc-v83" className="spaces-broadcast-modal-v83">
        <button className="spaces-broadcast-close-v83" type="button" aria-label="Close announcement" onClick={() => void dismiss(modal.id)}>×</button>
        {modal.imageUrl && <img className="spaces-broadcast-image-v83" src={modal.imageUrl} alt="" />}
        <div className="spaces-broadcast-content-v83">
          <span>SPACES UPDATE</span>
          <h2 id="spaces-broadcast-title-v83">{modal.title}</h2>
          <p id="spaces-broadcast-desc-v83">{modal.body}</p>
          <div className="spaces-broadcast-actions-v83">
            {modal.actionUrl && modal.actionLabel && <a href={modal.actionUrl} target="_blank" rel="noopener noreferrer">{modal.actionLabel}</a>}
            <button type="button" onClick={() => void dismiss(modal.id)}>Got it</button>
          </div>
        </div>
      </section>
    </div>}
  </>
}
