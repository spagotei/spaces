import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { createPortal } from 'react-dom'

export type ContextAction = {
  id: string
  label: string
  note?: string
  icon?: IconName
  danger?: boolean
  disabled?: boolean
  checked?: boolean
  separatorBefore?: boolean
  submenu?: ContextAction[]
  onSelect?: () => void | Promise<void>
}

type MenuState = {
  title: string
  subtitle?: string
  x: number
  y: number
  actions: ContextAction[]
} | null

export function useContextMenu() {
  const [menu, setMenu] = useState<MenuState>(null)
  const holdTimer = useRef<number | null>(null)
  const holdOrigin = useRef<{ x: number; y: number } | null>(null)
  const suppressClick = useRef(false)
  const suppressResetV78 = useRef<number | null>(null) // SPACES_V78_TOUCH_CONTEXT
  const close = useCallback(() => setMenu(null), [])

  useEffect(() => {
    if (!menu) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close()
    const onScroll = () => close()
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [close, menu])

  function clearHold() {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current)
    holdTimer.current = null
    holdOrigin.current = null
  }

  function open(title: string, actions: ContextAction[], x: number, y: number, subtitle?: string) {
    setMenu({ title, actions, x, y, subtitle })
  }

  function bind(title: string, actions: ContextAction[], subtitle?: string) {
    return {
      onContextMenu: (event: ReactMouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        open(title, actions, event.clientX, event.clientY, subtitle)
      },
      onClickCapture: (event: ReactMouseEvent) => {
        if (!suppressClick.current) return
        event.preventDefault()
        event.stopPropagation()
        suppressClick.current = false
        if (suppressResetV78.current !== null) window.clearTimeout(suppressResetV78.current)
        suppressResetV78.current = null
      },
      onPointerDown: (event: ReactPointerEvent) => {
        if (event.pointerType === 'mouse' || event.button !== 0) return
        if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return
        clearHold()
        holdOrigin.current = { x: event.clientX, y: event.clientY }
        holdTimer.current = window.setTimeout(() => {
          if (!holdOrigin.current) return
          suppressClick.current = true
          if (suppressResetV78.current !== null) window.clearTimeout(suppressResetV78.current)
          suppressResetV78.current = window.setTimeout(() => {
            suppressClick.current = false
            suppressResetV78.current = null
          }, 850)
          open(title, actions, holdOrigin.current.x, holdOrigin.current.y, subtitle)
          navigator.vibrate?.(18)
          clearHold()
        }, 460)
      },
      onPointerMove: (event: ReactPointerEvent) => {
        const origin = holdOrigin.current
        if (!origin) return
        if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 16) clearHold()
      },
      onPointerUp: clearHold,
      onPointerCancel: clearHold,
      onPointerLeave: (event: ReactPointerEvent) => { if (event.pointerType === 'mouse') clearHold() },
    }
  }


  return { menu, close, bind, open }
}

function ContextActionButton({ action, onClose }: { action: ContextAction; onClose: () => void }) {
  const [open, setOpen] = useState(false)
  const hasSubmenu = Boolean(action.submenu?.length)
  return (
    <div className={`context-action-wrap-v70 ${action.separatorBefore ? 'separator-v70' : ''}`} onMouseLeave={() => setOpen(false)}>
      <button
        role="menuitem"
        className={`${action.danger ? 'danger' : ''} ${action.checked ? 'checked' : ''}`}
        disabled={action.disabled}
        onMouseEnter={() => hasSubmenu && setOpen(true)}
        onClick={() => {
          if (hasSubmenu) { setOpen(value => !value); return }
          onClose()
          void action.onSelect?.()
        }}
      >
        <span className="context-action-icon">{action.icon ? <Icon name={action.icon} size={15}/> : <span/>}</span>
        <span className="context-action-copy"><strong>{action.label}</strong>{action.note && <small>{action.note}</small>}</span>
        {action.checked && <Icon name="check" size={14}/>}
        {hasSubmenu && <Icon name="chevron" size={12}/>}
      </button>
      {hasSubmenu && open && (
        <aside className="spaces-context-submenu-v70" role="menu">
          {action.submenu!.map(child => <ContextActionButton key={child.id} action={child} onClose={onClose}/>) }
        </aside>
      )}
    </div>
  )
}

export function ContextMenu({ menu, onClose, footer }: { menu: MenuState; onClose: () => void; footer?: ReactNode }) {
  const viewport = useMemo(() => ({ width: window.innerWidth, height: window.innerHeight }), [menu])
  if (!menu) return null
  const style = {
    '--context-x': `${Math.max(10, Math.min(menu.x, viewport.width - 300))}px`,
    '--context-y': `${Math.max(10, Math.min(menu.y, viewport.height - 420))}px`,
  } as CSSProperties
  return createPortal(
<>
    <button className="context-scrim" aria-label="Close menu" onPointerDown={onClose} />
    <aside className="spaces-context-menu" style={style} role="menu">
      <header><div><strong>{menu.title}</strong>{menu.subtitle && <span>{menu.subtitle}</span>}</div><button onClick={onClose} aria-label="Close"><Icon name="x" size={14}/></button></header>
      <div className="context-action-list">{menu.actions.map(action => <ContextActionButton key={action.id} action={action} onClose={onClose}/>)}</div>
      {footer && <footer>{footer}</footer>}
    </aside>
  </>,
    document.body,
  )
}
