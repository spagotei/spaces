import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

export function Modal({
  title,
  children,
  onClose,
  wide = false,
  embedded = false,
  hideHeader = false,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
  embedded?: boolean
  hideHeader?: boolean
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  const panel = (
    <section
      className={`modal modal-v16 ${wide ? 'modal-wide' : ''} ${embedded ? 'modal-embedded-v55' : ''}`}
      role={embedded ? 'region' : 'dialog'}
      aria-modal={embedded ? undefined : true}
      aria-label={title}
      onClick={event => event.stopPropagation()}
      onPointerDown={event => event.stopPropagation()}
    >
      {!hideHeader && (
        <header className="modal-header">
          <div>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </header>
      )}
      <div className="modal-body">{children}</div>
    </section>
  )

  if (embedded) return panel

  return createPortal(
    <div
      className="modal-backdrop modal-backdrop-v16 modal-backdrop-v28"
      onPointerDown={event => event.stopPropagation()}
      onPointerUp={event => event.stopPropagation()}
      onClick={event => {
        event.stopPropagation()
        if (event.target === event.currentTarget) onClose()
      }}
    >
      {panel}
    </div>,
    document.body,
  )
}
