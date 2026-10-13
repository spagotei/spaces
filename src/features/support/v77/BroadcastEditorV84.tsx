import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { useSpaces } from '../../../state/SpacesContext'
import './broadcast-studio-v84.css'

type Format = 'banner' | 'modal'
type BroadcastItem = {
  id: string; format: Format; title: string; body: string; imageUrl: string | null
  actionLabel: string | null; actionUrl: string | null; published: boolean; publishedAt: number
}

// SPACES_V84_BROADCAST_STUDIO: a preview that matches the live banner/modal, with history on demand.
export function BroadcastEditorV84() {
  const { apiUrl, session, pushToast } = useSpaces()
  const [format, setFormat] = useState<Format>('modal')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [actionLabel, setActionLabel] = useState('')
  const [actionUrl, setActionUrl] = useState('')
  const [items, setItems] = useState<BroadcastItem[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [previewFullscreen, setPreviewFullscreen] = useState<BroadcastItem | 'draft' | null>(null)
  const [busy, setBusy] = useState(false)

  const api = useCallback(async <T,>(route: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${apiUrl}${route}`, {
      ...init, headers: { Authorization: `Bearer ${session?.token || ''}`, ...(init.body instanceof Blob ? {} : { 'Content-Type': 'application/json' }), ...init.headers }, cache: 'no-store',
    })
    const data = await response.json().catch(() => ({})) as T & { error?: string }
    if (!response.ok) throw Error(data.error || `Spaces returned HTTP ${response.status}`)
    return data
  }, [apiUrl, session?.token])
  const reload = useCallback(async () => {
    try { setItems((await api<{broadcasts: BroadcastItem[]}>('/v1/staff/broadcasts')).broadcasts ?? []) }
    catch (e) { pushToast(e instanceof Error ? e.message : 'Could not load announcement history.', 'danger') }
  }, [api, pushToast])
  useEffect(() => { void reload() }, [reload])

  const draft: BroadcastItem = {
    id: 'draft', title, body, format, imageUrl: format === 'modal' ? imageUrl : null,
    actionLabel, actionUrl, published: false, publishedAt: Date.now(),
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) {
      pushToast('Choose PNG, JPEG or WebP, up to 1 MB.', 'danger'); return
    }
    setBusy(true)
    try {
      const result = await api<{imageUrl: string}>('/v1/staff/broadcasts/image', { method: 'POST', headers: { 'Content-Type': file.type }, body: file })
      setImageUrl(result.imageUrl)
      pushToast('Announcement artwork uploaded.', 'success')
    } catch (e) { pushToast(e instanceof Error ? e.message : 'Artwork upload failed.', 'danger') }
    finally { setBusy(false) }
  }
  async function publish() {
    if (busy || title.trim().length < 2) return
    if (!window.confirm('Publish this announcement to Spaces members on Windows, web and Android? The active announcement of the same type will be archived.')) return
    setBusy(true)
    try {
      await api('/v1/staff/broadcasts', { method: 'POST', body: JSON.stringify({ format, title, body, imageUrl: format === 'modal' ? imageUrl : '', actionLabel, actionUrl }) })
      setTitle(''); setBody(''); setImageUrl(''); setActionLabel(''); setActionUrl(''); setPreviewFullscreen(null)
      pushToast('New announcement published.', 'success')
      window.dispatchEvent(new Event('spaces-broadcast-changed'))
      await reload()
    } catch (e) { pushToast(e instanceof Error ? e.message : 'Publication failed.', 'danger') }
    finally { setBusy(false) }
  }
  async function unpublish(id: string) {
    if (!window.confirm('Unpublish this announcement for all members?')) return
    setBusy(true)
    try {
      await api(`/v1/staff/broadcasts/${encodeURIComponent(id)}/unpublish`, { method: 'POST' })
      pushToast('Announcement unpublished.', 'success')
      window.dispatchEvent(new Event('spaces-broadcast-changed'))
      await reload()
    } catch (e) { pushToast(e instanceof Error ? e.message : 'Unpublish failed.', 'danger') }
    finally { setBusy(false) }
  }

  const Preview = ({ item }: { item: BroadcastItem }) => <div className={`spaces-v84-announcement-render ${item.format}`}>
    {item.format === 'modal' && item.imageUrl && <img src={item.imageUrl} alt="Announcement artwork" />}
    <div className="spaces-v84-announcement-copy"><span>SPACES ANNOUNCEMENT</span><h3>{item.title || 'Your announcement title'}</h3>
      <p>{item.body || 'Your announcement text appears here exactly as members will see it.'}</p>
      {item.actionLabel && <span className="spaces-v84-action-demo">{item.actionLabel} ↗</span>}
    </div>
    <span className="spaces-v84-dismiss-demo" aria-hidden="true">×</span>
  </div>

  return <div className="spaces-v84-studio">
    <header className="spaces-v84-studio-head">
      <div><span className="eyebrow">SPACES COMMUNICATIONS</span><h2>Broadcast Studio</h2><p>Compose and preview before sending an announcement to everyone.</p></div>
      <button className="secondary-button" onClick={() => { setHistoryOpen(!historyOpen); if (!historyOpen) void reload() }}>
        {historyOpen ? 'Back to editor' : `Past announcements (${items.length})`}
      </button>
    </header>
    {historyOpen ? <section className="spaces-v84-history">
      <div className="spaces-v84-history-title"><h3>Announcement history</h3><button className="secondary-button compact" onClick={() => void reload()}>Refresh</button></div>
      {!items.length && <p>No announcements have been published yet.</p>}
      {items.map(item => <article key={item.id} className="spaces-v84-history-card">
        <div><span className="spaces-v84-history-status">{item.published ? '● LIVE' : 'ARCHIVED'} · {item.format === 'modal' ? 'Popup' : 'Banner'}</span>
          <h4>{item.title}</h4><small>{new Date(item.publishedAt).toLocaleString()}</small></div>
        <div className="spaces-v84-history-actions"><button className="secondary-button compact" onClick={() => setPreviewFullscreen(item)}>View announcement</button>
          {item.published && <button className="secondary-button compact" disabled={busy} onClick={() => void unpublish(item.id)}>Unpublish</button>}
        </div>
      </article>)}
    </section> : <div className="spaces-v84-broadcast-grid">
      <section className="spaces-v84-pane spaces-v84-form">
        <h3>Create announcement</h3>
        <label>Announcement type<select value={format} onChange={e => setFormat(e.target.value as Format)}><option value="banner">Top banner</option><option value="modal">Welcome popup</option></select></label>
        <label>Title<input value={title} maxLength={120} placeholder="What's new in Spaces?" onChange={e => setTitle(e.target.value)} /></label>
        <label>Description<textarea value={body} rows={5} maxLength={format === 'banner' ? 220 : 4000} placeholder="Tell the community what's happening..." onChange={e => setBody(e.target.value)} /></label>
        {format === 'modal' && <label>Popup artwork (optional)<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => void upload(e)}/>{imageUrl && <button type="button" className="secondary-button compact" onClick={() => setImageUrl('')}>Remove artwork</button>}</label>}
        <div className="spaces-v84-field-row"><label>Link text<input value={actionLabel} maxLength={50} onChange={e => setActionLabel(e.target.value)} placeholder="Read more" /></label>
          <label>Link URL (HTTPS)<input value={actionUrl} maxLength={1200} onChange={e => setActionUrl(e.target.value)} placeholder="https://yourspaces.net/" /></label></div>
        <div className="spaces-v84-actions"><button className="secondary-button" onClick={() => setPreviewFullscreen('draft')}>Full-screen preview</button><button className="primary-button" disabled={busy || title.trim().length < 2} onClick={() => void publish()}>{busy ? 'Working...' : 'Publish announcement'}</button></div>
      </section>
      <section className="spaces-v84-pane spaces-v84-preview-panel"><div className="spaces-v84-preview-caption"><h3>Live preview</h3><span>{format === 'modal' ? 'Popup on app open' : 'Top-of-app banner'}</span></div>
        <div className="spaces-v84-preview-stage"><Preview item={draft} /></div><p className="spaces-v84-note">Preview only. Your draft is not visible to members until you publish it.</p>
      </section>
    </div>}
    {previewFullscreen !== null && <div className="spaces-v84-preview-overlay" role="dialog" aria-modal="true" aria-label="Announcement preview" onMouseDown={e => { if (e.target === e.currentTarget) setPreviewFullscreen(null) }}>
      <div className="spaces-v84-preview-modal"><div className="spaces-v84-preview-modal-bar"><strong>{previewFullscreen === 'draft' ? 'Draft preview' : 'Past announcement'}</strong><button onClick={() => setPreviewFullscreen(null)} aria-label="Close preview">×</button></div>
        <Preview item={previewFullscreen === 'draft' ? draft : previewFullscreen} /></div>
    </div>}
  </div>
}
