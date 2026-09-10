type SpacesNotificationKind =
  | 'message'
  | 'mention'
  | 'everyone'
  | 'here'
  | 'role'
  | 'support'

export type SpacesSupportSoundKind = 'incoming' | 'received' | 'outgoing'

type SoundDefinition = {
  src: string
  volume: number
}

const soundDefinitions: Record<SpacesNotificationKind, SoundDefinition> = {
  message: { src: '/spaces-soft-pop.mp3', volume: 0.6 },
  mention: { src: '/spaces-notification-ding.mp3', volume: 1 },
  everyone: { src: '/spaces-double-ping.mp3', volume: 0.9 },
  here: { src: '/spaces-double-ping.mp3', volume: 0.9 },
  role: { src: '/spaces-soft-ping.mp3', volume: 0.8 },
  support: { src: '/spaces-soft-ping.mp3', volume: 0.52 },
}

const supportSoundDefinitions: Record<SpacesSupportSoundKind, SoundDefinition> = {
  // Official message delivered to a user.
  incoming: { src: '/spaces-soft-ping.mp3', volume: 0.52 },
  // A user replied and Support/Staff is receiving it.
  received: { src: '/spaces-double-ping.mp3', volume: 0.44 },
  // Local confirmation after sending a Support DM or Support reply.
  outgoing: { src: '/spaces-soft-pop.mp3', volume: 0.42 },
}

const audioCache = new Map<string, HTMLAudioElement>()

function playDefinition(sound: SoundDefinition) {
  try {
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
    // Audio is optional; a notification should never break Spaces.
  }
}

export function playSpacesNotificationSound(kind: SpacesNotificationKind) {
  playDefinition(soundDefinitions[kind] ?? soundDefinitions.mention)
}

export function playSpacesSupportSound(kind: SpacesSupportSoundKind) {
  playDefinition(supportSoundDefinitions[kind])
}

export function playSpacesQueueAlert() {
  playDefinition({ src: '/spaces-queue-alert.mp3', volume: 0.9 })
}
