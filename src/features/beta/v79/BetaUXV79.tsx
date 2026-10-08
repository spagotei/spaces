import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

// SPACES_V79_DISCORD_PLUS_BETA
// Self-contained beta UX: Discord-like quick switcher, keyboard sheet, DOM-safe external links.
type TargetV79 = { label: string; hint: string; element: HTMLElement }

function visible(element: HTMLElement) {
  const style = window.getComputedStyle(element)
  const rect = element.getBoundingClientRect()
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
}

function collectTargets(): TargetV79[] {
  const selectors = [
    '[data-channel-id]','[data-space-id]','[data-thread-id]','[data-dm-id]',
    '.channel-row','.space-row','.server-row','.direct-sidebar-row-v23','.direct-thread-row-v23',
    'button','[role="button"]','a[href]'
  ].join(',')
  const seen = new Set<string>()
  const out: TargetV79[] = []
  for (const raw of Array.from(document.querySelectorAll<HTMLElement>(selectors))) {
    if (raw.closest('[data-v79-overlay]') || !visible(raw) || raw.matches(':disabled,[aria-disabled="true"]')) continue
    const label = (raw.getAttribute('aria-label') || raw.getAttribute('title') || raw.textContent || '').replace(/\s+/g,' ').trim()
    if (!label || label.length > 90) continue
    const hint = raw.dataset.channelId ? 'Channel' : raw.dataset.spaceId ? 'Space' : raw.dataset.threadId || raw.dataset.dmId ? 'Direct message' : raw.tagName === 'A' ? 'Link' : 'Action'
    const key = hint + ':' + label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ label, hint, element: raw })
    if (out.length >= 160) break
  }
  return out
}

function hardenAnchors(root: ParentNode = document) {
  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(anchor => {
    const raw = anchor.getAttribute('href') || ''
    if (/^\s*javascript:/i.test(raw)) {
      anchor.removeAttribute('href')
      anchor.dataset.blockedUnsafeHref = 'true'
      return
    }
    try {
      const url = new URL(raw, window.location.href)
      if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== window.location.origin) {
        const rel = new Set((anchor.rel || '').split(/\s+/).filter(Boolean))
        rel.add('noopener'); rel.add('noreferrer')
        anchor.rel = Array.from(rel).join(' ')
      }
    } catch { /* relative/non-URL values are left alone */ }
  })
}

export function BetaUXV79({ children }: { children: ReactNode }) {
  const [palette, setPalette] = useState(false)
  const [shortcuts, setShortcuts] = useState(false)
  const [query, setQuery] = useState('')
  const [targets, setTargets] = useState<TargetV79[]>([])
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return targets.slice(0, 24)
    return targets.filter(item => item.label.toLowerCase().includes(q) || item.hint.toLowerCase().includes(q)).slice(0, 24)
  }, [query, targets])

  useEffect(() => {
    document.documentElement.dataset.spacesBeta = 'v79'
    hardenAnchors()
    const observer = new MutationObserver(records => {
      for (const record of records) for (const node of Array.from(record.addedNodes)) if (node instanceof Element) hardenAnchors(node)
    })
    observer.observe(document.documentElement,{subtree:true,childList:true})
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const editing = Boolean(target?.closest('input,textarea,select,[contenteditable="true"]'))
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setTargets(collectTargets()); setQuery(''); setActive(0); setShortcuts(false); setPalette(true); return
      }
      if ((event.ctrlKey || event.metaKey) && event.key === '/') {
        event.preventDefault(); setPalette(false); setShortcuts(value => !value); return
      }
      if (event.key === 'Escape') { setPalette(false); setShortcuts(false); return }
      if (!editing && event.altKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        const items=collectTargets().filter(item => /Channel|Direct message|Space/.test(item.hint))
        if (!items.length) return
        event.preventDefault()
        const focused=document.activeElement as HTMLElement | null
        let index=Math.max(0,items.findIndex(item => item.element===focused || item.element.contains(focused)))
        index=(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length
        items[index].element.focus(); items[index].element.scrollIntoView({block:'nearest'})
      }
    }
    window.addEventListener('keydown',key,true)
    return () => { observer.disconnect(); window.removeEventListener('keydown',key,true); delete document.documentElement.dataset.spacesBeta }
  },[])

  useEffect(() => { if (palette) window.setTimeout(() => inputRef.current?.focus(), 0) },[palette])
  useEffect(() => { setActive(0) },[query])

  function activate(index: number) {
    const item=filtered[index]
    if (!item) return
    setPalette(false); setQuery('')
    item.element.focus(); item.element.click()
  }

  return <>
    {children}
    <div className="v79-beta-corner" aria-hidden="true">BETA</div>
    {palette && <div className="v79-overlay" data-v79-overlay onMouseDown={event => { if (event.target===event.currentTarget) setPalette(false) }}>
      <section className="v79-quick-switcher" role="dialog" aria-modal="true" aria-label="Quick Switcher">
        <header><span className="v79-search-icon">⌕</span><input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setActive(v=>Math.min(v+1,filtered.length-1))}else if(e.key==='ArrowUp'){e.preventDefault();setActive(v=>Math.max(v-1,0))}else if(e.key==='Enter'){e.preventDefault();activate(active)}}} placeholder="Where would you like to go?" aria-label="Search Spaces, channels, DMs, and actions"/><kbd>ESC</kbd></header>
        <div className="v79-switcher-results" role="listbox">
          {filtered.length ? filtered.map((item,index)=><button key={item.hint+item.label+index} className={index===active?'active':''} onMouseEnter={()=>setActive(index)} onClick={()=>activate(index)} role="option" aria-selected={index===active}><span>{item.label}</span><small>{item.hint}</small></button>) : <p className="v79-empty">No matching destination.</p>}
        </div>
        <footer><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>ENTER</kbd> open</span><span><kbd>CTRL</kbd> + <kbd>/</kbd> shortcuts</span></footer>
      </section>
    </div>}
    {shortcuts && <div className="v79-overlay" data-v79-overlay onMouseDown={event=>{if(event.target===event.currentTarget)setShortcuts(false)}}>
      <section className="v79-shortcuts" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
        <header><div><strong>Keyboard Shortcuts</strong><span>Spaces beta navigation</span></div><button onClick={()=>setShortcuts(false)} aria-label="Close">×</button></header>
        <div className="v79-shortcut-grid"><span>Quick Switcher</span><kbd>Ctrl / ⌘ + K</kbd><span>Shortcut Sheet</span><kbd>Ctrl / ⌘ + /</kbd><span>Next Space / Channel / DM</span><kbd>Alt + ↓</kbd><span>Previous Space / Channel / DM</span><kbd>Alt + ↑</kbd><span>Close overlay</span><kbd>Esc</kbd></div>
      </section>
    </div>}
  </>
}
