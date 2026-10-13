import { useEffect } from 'react'

/** Small, opt-out desktop wheel easing. Never intercept chat auto-scroll, inputs, zoom, or mobile scrolling. */
export function useDesktopWheelSmoothV902(reducedMotion: boolean) {
  useEffect(() => {
    if (reducedMotion || !window.matchMedia('(hover:hover) and (pointer:fine)').matches) return
    const selector = '.sidebar-scroll, .view-scroll, .note-list, .support-console-nav-v77 nav, .support-inspector-scroll-v77'
    type Motion = { frame: number; target: number; element: HTMLElement }
    const motions = new Map<HTMLElement, Motion>()
    const tick = (item: Motion) => {
      if (!item.element.isConnected) { motions.delete(item.element); return }
      const distance = item.target - item.element.scrollTop
      if (Math.abs(distance) < 0.8) {
        item.element.scrollTop = item.target
        motions.delete(item.element)
        return
      }
      item.element.scrollTop += distance * 0.28
      item.frame = window.requestAnimationFrame(() => tick(item))
    }
    const onWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || !event.deltaY) return
      const origin = event.target
      if (!(origin instanceof Element)) return
      if (origin.closest('input,textarea,select,[contenteditable="true"],.message-list,.direct-messages-scroll,.direct-message-list,[role="dialog"]')) return
      const element = origin.closest<HTMLElement>(selector)
      if (!element || element.scrollHeight <= element.clientHeight + 1) return
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1)
      const current = motions.get(element)
      const max = element.scrollHeight - element.clientHeight
      const next = Math.max(0, Math.min(max, (current?.target ?? element.scrollTop) + delta))
      if (next === (current?.target ?? element.scrollTop)) return // preserve parent scrolling at limits
      event.preventDefault()
      if (current) { current.target = next; return }
      const item: Motion = { frame: 0, target: next, element }
      motions.set(element, item)
      item.frame = window.requestAnimationFrame(() => tick(item))
    }
    document.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      document.removeEventListener('wheel', onWheel)
      for (const item of motions.values()) window.cancelAnimationFrame(item.frame)
      motions.clear()
    }
  }, [reducedMotion])
}
