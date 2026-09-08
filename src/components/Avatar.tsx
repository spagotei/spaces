import type { CSSProperties } from 'react'
import { AnimatedImage, type AnimatedImageMode } from './AnimatedImage'

export function Avatar({
  name,
  initials,
  src,
  size = 40,
  accent,
  className = '',
  animation = 'hover',
  forceAnimation = false,
}: {
  name?: string
  initials?: string
  src?: string | null
  size?: number
  accent?: string
  className?: string
  animation?: AnimatedImageMode
  forceAnimation?: boolean
}) {
  const fallback = initials || (name ?? 'S').split(/\s+/).slice(0, 2).map(v => v[0] ?? '').join('').toUpperCase()
  const style = { '--avatar-size': `${size}px`, '--avatar-accent': accent ?? '#8b6ca8' } as CSSProperties
  return (
    <div className={`avatar ${className}`} style={style} title={name}>
      <span>{fallback}</span>
      {src ? <AnimatedImage src={src} mode={animation} forcePlay={forceAnimation} alt="" draggable={false} decoding="async" /> : null}
    </div>
  )
}
