import type { PointerEvent as ReactPointerEvent } from 'react'

type PressDragOptions = {
  mouseDelay?: number
  touchDelay?: number
  moveThreshold?: number
  onStart: () => void
  onMove: (clientX: number, clientY: number) => void
  onDrop: (clientX: number, clientY: number) => void
  onCancel?: () => void
}

/**
 * App-style reordering for Tauri/WebView + touch.
 *
 * Mouse/trackpad: grab the row and move it. No hold delay.
 * Touch/pen: a short hold keeps normal vertical scrolling from becoming an
 * accidental reorder. Native HTML5 drag/drop is never used, so WebView never
 * shows the prohibited-circle cursor.
 */
export function startPressDrag(event: ReactPointerEvent<HTMLElement>, options: PressDragOptions) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  const target = event.target as HTMLElement | null
  if (target?.closest('[data-no-press-drag="true"]')) return

  const pointerId = event.pointerId
  const source = event.currentTarget
  const startX = event.clientX
  const startY = event.clientY
  let lastX = startX
  let lastY = startY
  let active = false
  let finished = false
  let ghost: HTMLElement | null = null
  let ghostOffsetX = 0
  let ghostOffsetY = 0

  const pointerIsTouch = event.pointerType === 'touch' || event.pointerType === 'pen'
  const threshold = options.moveThreshold ?? (pointerIsTouch ? 14 : 4)
  const touchDelay = options.touchDelay ?? 340
  const mouseDelay = options.mouseDelay ?? 0

  const removeGhost = () => {
    if (!ghost) return
    ghost.remove()
    ghost = null
  }

  const positionGhost = (clientX: number, clientY: number) => {
    if (!ghost) return
    ghost.style.transform = `translate3d(${Math.round(clientX - ghostOffsetX)}px, ${Math.round(clientY - ghostOffsetY)}px, 0)`
  }

  const createGhost = () => {
    const rect = source.getBoundingClientRect()
    const clone = source.cloneNode(true) as HTMLElement
    clone.removeAttribute('id')
    clone.removeAttribute('data-press-drag-active')
    clone.classList.add('spaces-press-drag-ghost')
    clone.style.width = `${rect.width}px`
    clone.style.height = `${rect.height}px`
    clone.style.left = '0px'
    clone.style.top = '0px'
    clone.style.margin = '0'
    clone.style.pointerEvents = 'none'
    clone.style.position = 'fixed'
    clone.style.zIndex = '100000'
    ghostOffsetX = startX - rect.left
    ghostOffsetY = startY - rect.top
    document.body.appendChild(clone)
    ghost = clone
    positionGhost(lastX, lastY)
  }

  const cleanup = (cancelled: boolean) => {
    if (finished) return
    finished = true
    window.clearTimeout(timer)
    window.removeEventListener('pointermove', onMove, true)
    window.removeEventListener('pointerup', onUp, true)
    window.removeEventListener('pointercancel', onCancel, true)
    window.removeEventListener('blur', onWindowBlur)
    source.removeAttribute('data-press-drag-active')
    document.documentElement.classList.remove('spaces-press-dragging')
    removeGhost()
    if (cancelled && active) options.onCancel?.()
  }

  const activate = () => {
    if (finished || active) return
    active = true
    source.setAttribute('data-press-drag-active', 'true')
    document.documentElement.classList.add('spaces-press-dragging')
    createGhost()
    options.onStart()
    options.onMove(lastX, lastY)
  }

  const timer = window.setTimeout(() => {
    if (pointerIsTouch || mouseDelay > 0) activate()
  }, pointerIsTouch ? touchDelay : mouseDelay)

  const onMove = (nativeEvent: PointerEvent) => {
    if (nativeEvent.pointerId !== pointerId || finished) return
    lastX = nativeEvent.clientX
    lastY = nativeEvent.clientY

    if (!active) {
      const distance = Math.hypot(lastX - startX, lastY - startY)
      if (!pointerIsTouch && distance >= threshold) {
        activate()
      } else if (pointerIsTouch && distance > threshold) {
        // Scrolling wins if a touch moves before the hold delay completes.
        cleanup(false)
        return
      }
    }

    if (!active) return
    nativeEvent.preventDefault()
    positionGhost(lastX, lastY)
    options.onMove(lastX, lastY)
  }

  const onUp = (nativeEvent: PointerEvent) => {
    if (nativeEvent.pointerId !== pointerId || finished) return
    lastX = nativeEvent.clientX
    lastY = nativeEvent.clientY
    if (active) {
      nativeEvent.preventDefault()
      nativeEvent.stopPropagation()
      options.onDrop(lastX, lastY)
    }
    cleanup(false)
  }

  const onCancel = (nativeEvent: PointerEvent) => {
    if (nativeEvent.pointerId !== pointerId) return
    cleanup(true)
  }
  const onWindowBlur = () => cleanup(true)

  window.addEventListener('pointermove', onMove, { capture: true, passive: false })
  window.addEventListener('pointerup', onUp, true)
  window.addEventListener('pointercancel', onCancel, true)
  window.addEventListener('blur', onWindowBlur)
}
