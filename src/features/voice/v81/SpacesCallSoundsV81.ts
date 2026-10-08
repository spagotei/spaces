/** SPACES V81 — Sound pack controller. No network, no microphone access. */
import manifest from './sound-manifest-v81.json'

export type SpacesCallSoundId =
  | 'ringtone' | 'outgoing_call' | 'entered_call' | 'left_call'
  | 'member_joined' | 'member_left' | 'call_ended' | 'call_declined'
  | 'missed_call' | 'started_streaming' | 'stopped_streaming'
  | 'viewer_joined' | 'viewer_left' | 'mute' | 'unmute'
  | 'deafen' | 'undeafen' | 'camera_on' | 'camera_off'
  | 'reconnecting' | 'reconnected' | 'connection_lost'
export type SpacesSoundCategory = 'CALLS' | 'STREAMING' | 'CONTROLS' | 'CONNECTION'
export type SpacesSoundOptions = {
  /** Wire to the existing SPACES Do Not Disturb setting. */
  isDoNotDisturb?: () => boolean
  /** Wire to the existing SPACES sound setting. */
  isSoundsEnabled?: () => boolean
  categoryEnabled?: Partial<Record<SpacesSoundCategory, boolean>>
  volume?: number
  /** Default false, as specified in the supplied sound pack. */
  viewerSounds?: boolean
  onPlaybackError?: (event: SpacesCallSoundId, error: unknown) => void
}

type SoundEntry = (typeof manifest.sounds)[number]
const SOUND_MAP = new Map<string, SoundEntry>(manifest.sounds.map(sound => [sound.id, sound]))
const LOOP_IDS = new Set<SpacesCallSoundId>(['ringtone', 'outgoing_call', 'reconnecting'])
const BASE = '/spaces-call-sounds/v81'

/** Sound playback is best-effort: autoplay policies may require a user gesture. */
export class SpacesCallSoundsV81 {
  private playing = new Map<SpacesCallSoundId, HTMLAudioElement>()
  private lastPlayed = new Map<SpacesCallSoundId, number>()
  private opts: SpacesSoundOptions
  private destroyed = false

  constructor(options: SpacesSoundOptions = {}) { this.opts = { ...options } }
  configure(options: Partial<SpacesSoundOptions>): void { this.opts = { ...this.opts, ...options }; this.refreshSettings() }
  /** Call when external SPACES DND/sound settings change. */
  refreshSettings(): void { if (this.opts.isDoNotDisturb?.() === true || this.opts.isSoundsEnabled?.() === false) this.stopAll() }
  private allowed(id: SpacesCallSoundId, entry: SoundEntry): boolean {
    if (this.destroyed || this.opts.isSoundsEnabled?.() === false || this.opts.isDoNotDisturb?.() === true) return false
    if (this.opts.categoryEnabled?.[entry.category as SpacesSoundCategory] === false) return false
    if ((id === 'viewer_joined' || id === 'viewer_left') && this.opts.viewerSounds !== true) return false
    return entry.default_enabled !== false || this.opts.viewerSounds === true
  }
  async play(id: SpacesCallSoundId): Promise<boolean> {
    const entry = SOUND_MAP.get(id)
    if (!entry || !this.allowed(id, entry)) return false
    const now = Date.now()
    const quietPeriod = id === 'member_joined' || id === 'member_left' || id === 'viewer_joined' || id === 'viewer_left' ? 700 : 180
    if (now - (this.lastPlayed.get(id) ?? 0) < quietPeriod) return false
    if (LOOP_IDS.has(id)) {
      if (this.playing.has(id)) return true
      // Never play two different repeating call cues together.
      for (const loop of LOOP_IDS) if (loop !== id) this.stop(loop)
    }
    this.lastPlayed.set(id, now)
    const audio = new Audio(`${BASE}/${LOOP_IDS.has(id) ? entry.files.wav : entry.files.mp3}`)
    audio.preload = 'auto'
    audio.loop = Boolean(entry.loop)
    audio.volume = Math.min(1, Math.max(0, this.opts.volume ?? 1)) * entry.recommended_volume
    if (LOOP_IDS.has(id)) this.playing.set(id, audio)
    else audio.addEventListener('ended', () => { if (this.playing.get(id) === audio) this.playing.delete(id) }, { once: true })
    try {
      await audio.play()
      if (!LOOP_IDS.has(id)) this.playing.set(id, audio)
      return true
    } catch (error) {
      if (this.playing.get(id) === audio) this.playing.delete(id)
      this.opts.onPlaybackError?.(id, error)
      return false
    }
  }
  stop(id: SpacesCallSoundId): void {
    const audio = this.playing.get(id)
    if (!audio) return
    this.playing.delete(id)
    audio.pause()
    audio.currentTime = 0
  }
  stopLoops(): void { for (const id of LOOP_IDS) this.stop(id) }
  stopAll(): void { for (const id of Array.from(this.playing.keys())) this.stop(id) }
  destroy(): void { this.destroyed = true; this.stopAll(); this.lastPlayed.clear() }
}

export const spacesCallSoundEventsV81: readonly SpacesCallSoundId[] = manifest.sounds.map(s => s.id as SpacesCallSoundId)
