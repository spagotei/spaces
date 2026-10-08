import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from './Icon'
import { Modal } from './Modal'

export type ContentSearchKind = 'message' | 'media' | 'file' | 'link' | 'note'

export type ContentSearchItem = {
  id: string
  kind: ContentSearchKind
  title: string
  subtitle?: string
  preview?: string
  createdAt?: number
  onOpen?: () => void
}

const tabs: { id: 'all' | ContentSearchKind; label: string; icon: IconName }[] = [
  { id: 'all', label: 'All', icon: 'search' },
  { id: 'message', label: 'Messages', icon: 'message' },
  { id: 'media', label: 'Media', icon: 'paperclip' },
  { id: 'file', label: 'Files', icon: 'download' },
  { id: 'link', label: 'Links', icon: 'globe' },
  { id: 'note', label: 'Notes', icon: 'notes' },
]

function itemIcon(kind: ContentSearchKind): IconName {
  if (kind === 'message') return 'message'
  if (kind === 'media') return 'paperclip'
  if (kind === 'file') return 'download'
  if (kind === 'link') return 'globe'
  return 'notes'
}

export function ContentSearchPanel({
  title,
  subtitle,
  items,
  onClose,
}: {
  title: string
  subtitle?: string
  items: ContentSearchItem[]
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'all' | ContentSearchKind>('all')

  const visible = useMemo(() => {
    const clean = query.trim().toLowerCase()
    return items
      .filter(item => tab === 'all' || item.kind === tab)
      .filter(item => !clean || `${item.title} ${item.subtitle ?? ''} ${item.preview ?? ''}`.toLowerCase().includes(clean))
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  }, [items, query, tab])

  const counts = useMemo(() => {
    const next = new Map<string, number>()
    for (const item of items) next.set(item.kind, (next.get(item.kind) ?? 0) + 1)
    return next
  }, [items])

  return createPortal(
    <Modal title={title} subtitle={subtitle} onClose={onClose} wide>
      <div className="content-search-v71">
        <label className="content-search-input-v71">
          <Icon name="search" size={15}/>
          <input
            autoFocus
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search messages, media, files, links, and notes"
          />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><Icon name="x" size={13}/></button>}
        </label>

        <nav className="content-search-tabs-v71" aria-label="Search filters">
          {tabs.map(item => {
            const count = item.id === 'all' ? items.length : (counts.get(item.id) ?? 0)
            return <button type="button" key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>
              <Icon name={item.icon} size={13}/>
              <span>{item.label}</span>
              <small>{count}</small>
            </button>
          })}
        </nav>

        <div className="content-search-results-v71">
          {visible.map(item => (
            <button type="button" key={item.id} onClick={() => { item.onOpen?.(); onClose() }}>
              <span className="content-search-kind-v71"><Icon name={itemIcon(item.kind)} size={14}/></span>
              <span className="content-search-copy-v71">
                <span><strong>{item.title}</strong>{item.createdAt ? <time>{new Date(item.createdAt).toLocaleString()}</time> : null}</span>
                {item.subtitle && <small>{item.subtitle}</small>}
                {item.preview && <p>{item.preview}</p>}
              </span>
              {item.onOpen && <Icon name="chevron" size={12}/>}
            </button>
          ))}
          {!visible.length && (
            <div className="content-search-empty-v71">
              <Icon name="search" size={22}/>
              <strong>No results</strong>
              <span>Try another phrase or filter.</span>
            </div>
          )}
        </div>
      </div>
    </Modal>,
    document.body,
  )
}
