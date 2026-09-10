import { useEffect, useMemo, useRef, useState, type CSSProperties, type ImgHTMLAttributes } from 'react'
import { isGifDataUrl } from '../utils/image'

const posterCache = new Map<string, string>()
const posterPromises = new Map<string, Promise<string | null>>()
const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='

function looksLikeGif(src: string | null | undefined) {
  if (!src) return false
  return isGifDataUrl(src) || /\.gif(?:[?#]|$)/i.test(src)
}

type GifDecoderImageV441 = {
  displayWidth?: number
  displayHeight?: number
  codedWidth?: number
  codedHeight?: number
  close?: () => void
}

type GifImageDecoderV441 = {
  tracks: {
    ready: Promise<void>
    selectedTrack?: { frameCount: number }
  }
  decode: (options: { frameIndex: number }) => Promise<{ image: CanvasImageSource }>
  close?: () => void
}

type GifImageDecoderCtorV441 = new (init: { data: ArrayBuffer; type: string }) => GifImageDecoderV441

function gifPosterCanvasV441(image: CanvasImageSource, width: number, height: number): string | null {
  try {
    const max = 720
    const scale = Math.min(1, max / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/webp', 0.84)
  } catch {
    return null
  }
}

async function decodeLateGifPosterV441(src: string): Promise<string | null> {
  const Decoder = (globalThis as unknown as { ImageDecoder?: GifImageDecoderCtorV441 }).ImageDecoder
  if (!Decoder) return null

  let decoder: GifImageDecoderV441 | null = null
  let decodedImage: (CanvasImageSource & GifDecoderImageV441) | null = null

  try {
    const response = await fetch(src)
    if (!response.ok) return null
    const data = await response.arrayBuffer()
    decoder = new Decoder({ data, type: 'image/gif' })
    await decoder.tracks.ready

    const frameCount = decoder.tracks.selectedTrack?.frameCount ?? 0
    if (frameCount < 1) return null

    // Do not use the literal last frame: build-up animations often fade back
    // to blank at the end. A frame around 76% tends to show the completed mark.
    const frameIndex = Math.max(0, Math.min(frameCount - 1, Math.round((frameCount - 1) * 0.76)))
    const result = await decoder.decode({ frameIndex })
    decodedImage = result.image as CanvasImageSource & GifDecoderImageV441

    const width = Math.max(1, decodedImage.displayWidth ?? decodedImage.codedWidth ?? 1)
    const height = Math.max(1, decodedImage.displayHeight ?? decodedImage.codedHeight ?? 1)
    return gifPosterCanvasV441(result.image, width, height)
  } catch {
    return null
  } finally {
    decodedImage?.close?.()
    decoder?.close?.()
  }
}

function legacyGifPosterV441(src: string): Promise<string | null> {
  return new Promise(resolve => {
    const image = new Image()
    image.decoding = 'sync'
    image.onload = () => {
      const width = Math.max(1, image.naturalWidth || image.width)
      const height = Math.max(1, image.naturalHeight || image.height)
      resolve(gifPosterCanvasV441(image, width, height))
    }
    image.onerror = () => resolve(null)
    image.src = src
  })
}

async function buildGifPoster(src: string): Promise<string | null> {
  if (!looksLikeGif(src)) return src
  if (posterCache.has(src)) return posterCache.get(src) ?? null
  if (posterPromises.has(src)) return posterPromises.get(src) ?? null

  const promise = (async () => {
    const poster = await decodeLateGifPosterV441(src) ?? await legacyGifPosterV441(src)
    if (poster) posterCache.set(src, poster)
    return poster
  })().finally(() => posterPromises.delete(src))

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
