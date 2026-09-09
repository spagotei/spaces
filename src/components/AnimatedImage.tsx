import { useEffect, useMemo, useRef, useState, type CSSProperties, type ImgHTMLAttributes } from 'react'
import { isGifDataUrl } from '../utils/image'

const posterCache = new Map<string, string>()
const posterPromises = new Map<string, Promise<string | null>>()
const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='

function looksLikeGif(src: string | null | undefined) {
  if (!src) return false
  return isGifDataUrl(src) || /\.gif(?:[?#]|$)/i.test(src)
}

async function buildGifPoster(src: string): Promise<string | null> {
  if (!looksLikeGif(src)) return src
  if (posterCache.has(src)) return posterCache.get(src) ?? null
  if (posterPromises.has(src)) return posterPromises.get(src) ?? null

  const promise = new Promise<string | null>(resolve => {
    const image = new Image()
    image.decoding = 'sync'
    image.onload = () => {
      try {
        const width = Math.max(1, image.naturalWidth || image.width)
        const height = Math.max(1, image.naturalHeight || image.height)
        const max = 720
        const scale = Math.min(1, max / Math.max(width, height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(width * scale))
        canvas.height = Math.max(1, Math.round(height * scale))
        const context = canvas.getContext('2d')
        if (!context) return resolve(null)
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        const poster = canvas.toDataURL('image/webp', 0.82)
        posterCache.set(src, poster)
        resolve(poster)
      } catch {
        resolve(null)
      }
    }
    image.onerror = () => resolve(null)
    image.src = src
  }).finally(() => posterPromises.delete(src))

  posterPromises.set(src, promise)
  return promise
}

export type AnimatedImageMode = 'hover' | 'always' | 'still'
type SpacePlaybackContext = 'normal' | 'active-space' | 'inactive-space'

function spacePlaybackContext(element: HTMLElement | null): SpacePlaybackContext {
  if (!element) return 'normal'

  const railButton = element.closest('.server-button, .mobile-space-strip > button')
  if (railButton) return railButton.classList.contains('active') ? 'active-space' : 'inactive-space'

  // The Space header only renders artwork for the currently opened Space.
  if (element.closest('.space-header')) return 'active-space'

  return 'normal'
}

type AnimatedImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string
  mode?: AnimatedImageMode
  forcePlay?: boolean
}

export function AnimatedImage({ src, mode = 'hover', forcePlay = false, className = '', onPointerEnter, onPointerLeave, onFocus, onBlur, style, ...rest }: AnimatedImageProps) {
  const animated = useMemo(() => looksLikeGif(src), [src])
  const imageRef = useRef<HTMLImageElement>(null)
  const [poster, setPoster] = useState<string | null>(() => posterCache.get(src) ?? null)
  const [hovered, setHovered] = useState(false)
  const [spaceContext, setSpaceContext] = useState<SpacePlaybackContext>('normal')

  useEffect(() => {
    let cancelled = false
    setPoster(posterCache.get(src) ?? null)
    if (!animated || mode === 'always') return
    void buildGifPoster(src).then(next => {
      if (!cancelled && next) setPoster(next)
    })
    return () => { cancelled = true }
  }, [animated, mode, src])

  useEffect(() => {
    const image = imageRef.current
    if (!image) return

    const sync = () => setSpaceContext(spacePlaybackContext(image))
    sync()

    const host = image.closest('.server-button, .mobile-space-strip > button, .space-header')
    if (!host) return

    const observer = new MutationObserver(sync)
    observer.observe(host, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [src])

  const activeSpacePlayback = spaceContext === 'active-space'
  const normalHoverPlayback = spaceContext === 'normal' && hovered
  const playing = animated && (
    mode === 'always' ||
    forcePlay ||
    (mode === 'hover' && (activeSpacePlayback || normalHoverPlayback))
  )

  // Keep the <img> mounted even before a poster exists so it can detect whether
  // its Space is active. The transparent pixel lets the Avatar initials remain
  // visible until the static first-frame poster is ready.
  const displaySource = animated && !playing ? (poster ?? transparentPixel) : src

  return (
    <img
      {...rest}
      ref={imageRef}
      src={displaySource}
      className={`animated-image-v41 ${animated ? 'is-gif-v41' : ''} ${playing ? 'is-playing-v41' : 'is-still-v41'} ${className}`.trim()}
      style={style as CSSProperties}
      onPointerEnter={event => { setHovered(true); onPointerEnter?.(event) }}
      onPointerLeave={event => { setHovered(false); onPointerLeave?.(event) }}
      onFocus={event => { setHovered(true); onFocus?.(event) }}
      onBlur={event => { setHovered(false); onBlur?.(event) }}
    />
  )
}

export function AnimatedBackdrop({
  src,
  className = '',
  mode = 'hover',
  forcePlay = false,
  style,
}: {
  src?: string | null
  className?: string
  mode?: AnimatedImageMode
  forcePlay?: boolean
  style?: CSSProperties
}) {
  if (!src) return null
  return (
    <span className={`animated-backdrop-v41 ${className}`.trim()} style={style} aria-hidden="true">
      <AnimatedImage src={src} mode={mode} forcePlay={forcePlay} alt="" draggable={false}/>
    </span>
  )
}
