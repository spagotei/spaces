type SpacesNotificationKind = 'message' | 'mention' | 'everyone' | 'here' | 'role' | 'support'

type SoundDefinition = {
  src: string
  volume: number
}

const soundDefinitions: Record<SpacesNotificationKind, SoundDefinition> = {
  // Low-priority incoming channel activity: short and unobtrusive.
  message: { src: '/spaces-soft-pop.mp3', volume: 0.6 },

  // A direct mention keeps the original Spaces notification identity.
  mention: { src: '/spaces-notification-ding.mp3', volume: 1 },

  // Broader pings get a clearer two-note alert.
  everyone: { src: '/spaces-double-ping.mp3', volume: 0.9 },
  here: { src: '/spaces-double-ping.mp3', volume: 0.9 },

  // Role pings are noticeable without sounding as urgent as @everyone/@here.
  role: { src: '/spaces-soft-ping.mp3', volume: 0.8 },

  // Official support keeps the distinctive original ding as well.
  support: { src: '/spaces-notification-ding.mp3', volume: 1 },
}

const audioCache = new Map<string, HTMLAudioElement>()

export function playSpacesNotificationSound(kind: SpacesNotificationKind) {
  try {
    const sound = soundDefinitions[kind] ?? soundDefinitions.mention
    let audio = audioCache.get(sound.src)

    if (!audio) {
      audio = new Audio(sound.src)
      audio.preload = 'auto'
      audioCache.set(sound.src, audio)
    }

    audio.pause()
    audio.currentTime = 0
    audio.volume = sound.volume

    void audio.play().catch(() => {
      // Browsers can block audio until the user has interacted with the app.
    })
  } catch {
    // Audio is optional; a notification should never break the app.
  }
}

export function playSpacesQueueAlert() {
  try {
    const src = '/spaces-queue-alert.mp3'
    let audio = audioCache.get(src)
    if (!audio) {
      audio = new Audio(src)
      audio.preload = 'auto'
      audioCache.set(src, audio)
    }
    audio.pause()
    audio.currentTime = 0
    audio.volume = 0.9
    void audio.play().catch(() => undefined)
  } catch {
    // Platform queue audio is optional.
  }
}
