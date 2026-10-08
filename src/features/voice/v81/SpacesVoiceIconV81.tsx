/** SPACES V81.1 — Accessible vector voice/call icons. No external icon library required. */
import type { SVGProps } from 'react'
import type { SpacesVoiceIconNameV81 } from './SpacesVoiceUiContractV81'

type GlyphProps = Omit<SVGProps<SVGSVGElement>, 'name'> & {
  name: SpacesVoiceIconNameV81
  size?: number
  title?: string
}

const GLYPHS: Record<SpacesVoiceIconNameV81, readonly string[]> = {
  phone: ['M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.09 5.18 2 2 0 0 1 5.08 3h3a2 2 0 0 1 2 1.72l.42 2.81a2 2 0 0 1-.57 1.73L8.1 11.1a16 16 0 0 0 4.8 4.8l1.84-1.83a2 2 0 0 1 1.73-.57l2.81.42A2 2 0 0 1 22 16.92Z'],
  'phone-off': ['M3 3l18 18','M10.3 5.2l.2 1.5a2 2 0 0 1-.6 1.7L8.1 10.2','M13.8 15.6l.9-.9a2 2 0 0 1 1.7-.6l2.8.4a2 2 0 0 1 1.7 2v3a2 2 0 0 1-.4 1.2','M5 3h3a2 2 0 0 1 1.4.6','M3.4 5a19.8 19.8 0 0 0 15.6 15.6'],
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

/** Presentational only; controls must be connected to authenticated actions elsewhere. */
export function SpacesVoiceIconV81({ name, size = 20, title, ...props }: GlyphProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      role={title ? 'img' : 'presentation'} aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {GLYPHS[name].map((d, i) => <path key={i} d={d} />)}
    </svg>
  )
}
