import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { useSpaces } from '../../../state/SpacesContext'
import './broadcast-editor-v83.css'

// SPACES_V83_BROADCAST_EDITOR: author-controlled publishing; server enforces platform roles.
type Item = { id: string; format: 'banner' | 'modal'; title: string; body: string; imageUrl: string | null; published: boolean; publishedAt: number }
export function BroadcastEditorV83() {
  const { apiUrl, session, pushToast } = useSpaces()
  const [format, setFormat] = useState<'banner' | 'modal'>('banner')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [actionLabel, setActionLabel] = useState('')
  const [actionUrl, setActionUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [preview, setPreview] = useState(false)
  const api = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const res = await fetch(`${apiUrl}${path}`, {
      ...init, headers: { Authorization: `Bearer ${session?.token || ''}`, ...(init.body instanceof Blob ? {} : { 'Content-Type': 'application/json' }), ...init.headers },
      cache: 'no-store',
    })
    const result = await res.json().catch(() => ({})) as T & { error?: string }
    if (!res.ok) throw Error(result.error || `Spaces returned HTTP ${res.status}`)
    return result
  }, [apiUrl, session?.token])
  const reload = useCallback(async () => {
    try { setItems((await api<{broadcasts: Item[]}>('/v1/staff/broadcasts')).broadcasts) }
    catch (e) { pushToast(e instanceof Error ? e.message : 'Could not load broadcasts.', 'danger') }
  }, [api, pushToast])
  useEffect(() => { void reload() }, [reload])
  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) {
      pushToast('Use PNG, JPEG or WebP up to 1 MB.', 'danger'); return
    }
    setBusy(true)
    try {
      const r = await api<{imageUrl:string}>('/v1/staff/broadcasts/image', { method: 'POST', headers: { 'Content-Type': file.type }, body: file })
      setImageUrl(r.imageUrl)
      pushToast('Image uploaded.', 'success')
    } catch (e) { pushToast(e instanceof Error ? e.message : 'Image upload failed.', 'danger') }
    finally { setBusy(false) }
  }
  async function publish() {
    if (busy || title.trim().length < 2) return
    if (!window.confirm('Publish this announcement to all signed-in Spaces clients? It replaces the active announcement of the same type.')) return
    setBusy(true)
    try {
      await api('/v1/staff/broadcasts', { method: 'POST', body: JSON.stringify({ format, title, body, imageUrl: format === 'modal' ? imageUrl : '', actionLabel, actionUrl }) })
      setTitle(''); setBody(''); setImageUrl(''); setActionLabel(''); setActionUrl(''); setPreview(false)
      pushToast('Broadcast published to Spaces.', 'success')
      window.dispatchEvent(new Event('spaces-broadcast-changed'))
      await reload()
    } catch (e) { pushToast(e instanceof Error ? e.message : 'Broadcast publication failed.', 'danger') }
    finally { setBusy(false) }
  }
  async function unpublish(id: string) {
    if (!window.confirm('Remove this broadcast from all clients? Dismissal history will be kept.')) return
    setBusy(true)
    try {
      await api(`/v1/staff/broadcasts/${encodeURIComponent(id)}/unpublish`, { method: 'POST' })
      pushToast('Broadcast unpublished.', 'success')
      window.dispatchEvent(new Event('spaces-broadcast-changed'))
      await reload()
    } catch (e) { pushToast(e instanceof Error ? e.message : 'Unpublish failed.', 'danger') }
    finally { setBusy(false) }
  }
  return <div className="spaces-broadcast-editor-v83">
    <header><div><span className="eyebrow">PLATFORM COMMUNICATIONS</span><h2>Broadcasts</h2><p>Write once. Announce across Windows, the web app, and Android. Never sent without publishing.</p></div><button className="secondary-button compact" onClick={() => void reload()} disabled={busy}>Refresh</button></header>
    <div className="spaces-broadcast-editor-grid-v83">
      <section className="spaces-broadcast-compose-v83">
        <h3>New announcement</h3>
        <label>Format <select value={format} onChange={e => setFormat(e.target.value as 'banner' | 'modal')}><option value="banner">Top banner</option><option value="modal">Welcome popup</option></select></label>
        <label>Title <input value={title} maxLength={120} placeholder="What's new in Spaces?" onChange={e => setTitle(e.target.value)} /></label>
        <label>Description <textarea value={body} maxLength={4000} rows={5} placeholder="Write your announcement here..." onChange={e => setBody(e.target.value)} /></label>
        {format === 'modal' && <label>Image (optional, up to 1 MB)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => void upload(e)} disabled={busy} />{imageUrl && <img src={imageUrl} alt="Selected broadcast artwork" />}</label>}
        <label>Link button text (optional)<input value={actionLabel} maxLength={50} placeholder="Read more" onChange={e => setActionLabel(e.target.value)} /></label>
        <label>HTTPS button link (optional)<input value={actionUrl} maxLength={1200} placeholder="https://yourspaces.net/..." onChange={e => setActionUrl(e.target.value)} /></label>
        <div className="spaces-broadcast-compose-actions-v83"><button className="secondary-button" onClick={() => setPreview(!preview)} disabled={busy}>Preview</button><button className="primary-button" onClick={() => void publish()} disabled={busy || title.trim().length < 2}>{busy ? 'Working...' : 'Publish broadcast'}</button></div>
      </section>
      <section className="spaces-broadcast-history-v83"><h3>Recent announcements</h3>
        {items.map(item => <article key={item.id}>
          <span>{item.format === 'modal' ? 'POPUP' : 'BANNER'} · {item.published ? 'LIVE' : 'ARCHIVED'}</span>
          <strong>{item.title}</strong><p>{item.body}</p>
          <small>{new Date(item.publishedAt).toLocaleString()}</small>
          {item.published && <button className="secondary-button compact" disabled={busy} onClick={() => void unpublish(item.id)}>Unpublish</button>}
        </article>)}
        {!items.length && <p>No announcements yet. Write the first one above.</p>}
      </section>
    </div>
    {preview && <div className="spaces-broadcast-preview-v83" role="dialog" aria-modal="true" aria-label="Broadcast preview"><section>{format === 'modal' && imageUrl && <img src={imageUrl} alt=""/>}<span>{format === 'banner' ? 'TOP BANNER PREVIEW' : 'WELCOME POPUP PREVIEW'}</span><h3>{title || 'Announcement title'}</h3><p>{body || 'Announcement description'}</p><button className="primary-button" onClick={() => setPreview(false)}>Close preview</button></section></div>}
  </div>
}
