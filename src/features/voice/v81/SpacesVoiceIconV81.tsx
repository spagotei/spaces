/** SPACES V81.1 — Accessible vector voice/call icons. No external icon library required. */
import type { SVGProps } from 'react'
import type { SpacesVoiceIconNameV81 } from './SpacesVoiceUiContractV81'

type GlyphProps = Omit<SVGProps<SVGSVGElement>, 'name'> & {
  name: SpacesVoiceIconNameV81
  size?: number
  title?: string
}

const GLYPHS: Record<SpacesVoiceIconNameV81, readonly string[]> = {
  phone: [], // Drawn as a clean filled handset below.
  'phone-off': [], // Drawn as a horizontal receiver below.
  video: ['M15 10l5-3v10l-5-3','M3 7h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z'],
  'video-off': ['M2 2l20 20','M9.5 7H13a2 2 0 0 1 2 2v1l5-3v10l-2.2-1.3','M3 7h1M3 7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 1.7-1'],
  'screen-share': ['M3 4h18v12H3z','M8 20h8','M12 16v4','M12 12V7','M9 10l3-3 3 3'],
  'screen-stop': ['M3 4h18v12H3z','M8 20h8','M12 16v4','M9 8l6 6','M15 8l-6 6'],
  mic: ['M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z','M5 10v2a7 7 0 0 0 14 0v-2','M12 19v3','M8 22h8'],
  'mic-off': ['M2 2l20 20','M9 9v3a3 3 0 0 0 5.1 2.1','M15 9V5a3 3 0 0 0-5.7-1.3','M5 10v2a7 7 0 0 0 12.5 4.3','M12 19v3','M8 22h8'],
  headphones: ['M3 14v-3a9 9 0 0 1 18 0v3','M3 14h4v7H5a2 2 0 0 1-2-2v-5Z','M17 14h4v5a2 2 0 0 1-2 2h-2v-7Z'],
  'headphones-off': ['M2 2l20 20','M3 14v-3a9 9 0 0 1 15.6-6','M3 14h4v7H5a2 2 0 0 1-2-2v-5Z','M17 14h4v5a2 2 0 0 1-2 2h-2v-7Z'],
  speaker: ['M3 9v6h4l5 4V5L7 9H3Z','M16 9a4 4 0 0 1 0 6','M19 6a8 8 0 0 1 0 12'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2','M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z','M22 21v-2a4 4 0 0 0-3-3.9','M16 3.1a4 4 0 0 1 0 7.8'],
  lock: ['M5 11h14v10H5z','M8 11V7a4 4 0 0 1 8 0v4'],
  voice: ['M3 10v4','M7 6v12','M11 3v18','M15 7v10','M19 10v4'],
  settings: ['M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z','M10 2h4l.5 2.2 1.7.7 1.9-1.2 2.8 2.8-1.2 1.9.7 1.7L22 10v4l-2.2.5-.7 1.7 1.2 1.9-2.8 2.8-1.9-1.2-1.7.7L14 22h-4l-.5-2.2-1.7-.7-1.9 1.2-2.8-2.8 1.2-1.9-.7-1.7L2 14v-4l2.2-.5.7-1.7-1.2-1.9 2.8-2.8 1.9 1.2 1.7-.7L10 2Z'],
  move: ['M4 12h16','M14 6l6 6-6 6','M4 5v14'],
  stream: ['M3 5h18v14H3z','M10 9l5 3-5 3V9Z'],
  eye: ['M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z','M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
}

/** V81.2.1: Clean handset silhouette; horizontal receiver for end-call.
 * Other media/permission icons retain their existing vector appearance.
 * Presentational only; controls must be connected to authenticated actions elsewhere. */
export function SpacesVoiceIconV81({ name, size = 20, title, ...props }: GlyphProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      role={title ? 'img' : 'presentation'} aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {name === 'phone' ? (
        <path fill="currentColor" stroke="none" d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.56 3.57.56a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.56 3.57a1 1 0 0 1-.25 1.02l-2.19 2.2Z" />
      ) : name === 'phone-off' ? (
        <path fill="currentColor" stroke="none" d="M2.5 13.2c5-4.2 14-4.2 19 0l.7 2.9c.2.8-.2 1.4-1 1.7l-3.4 1.1c-.8.3-1.5-.1-1.7-.8l-.8-2.8c-2.1-.6-4.6-.6-6.6 0l-.8 2.8c-.2.7-.9 1.1-1.7.8l-3.4-1.1c-.8-.3-1.2-.9-1-1.7l.7-2.9Z" />
      ) : GLYPHS[name].map((d, i) => <path key={i} d={d} />)}
    </svg>
  )
}
