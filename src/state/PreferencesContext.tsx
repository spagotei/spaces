import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ContentFilterLevel = 'none' | 'low' | 'medium' | 'high'
export type MessageDensity = 'comfortable' | 'compact'
export type NotificationLevel = 'all' | 'mentions' | 'none'
export type AppTheme = 'obsidian' | 'midnight' | 'slate' | 'soft'
export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'offline'
export type SidebarDensity = 'comfortable' | 'compact'

export type SpacesPreferences = {
  contentFilter: ContentFilterLevel
  messageDensity: MessageDensity
  reducedMotion: boolean
  glassEffects: boolean
  enterToSend: boolean
  showMemberRail: boolean
  notificationLevel: NotificationLevel
  desktopSounds: boolean
  mentionNotifications: boolean
  everyoneNotifications: boolean
  roleNotifications: boolean
  supportNotifications: boolean
  notificationPreviews: boolean
  appTheme: AppTheme
  presence: PresenceStatus
  customStatus: string
  appAccent: string
  hiddenWorkspaceIds: string[]
  mutedWorkspaceIds: string[]
  mutedChannelIds: string[]
  pinnedChannelIds: string[]
  collapsedChannelGroups: string[]
  customCursor: boolean
  developerMode: boolean
  showAllChannelThreads: boolean
  interfaceTextScale: number
  sidebarTextScale: number
  messageTextScale: number
  highContrastText: boolean
  underlineLinks: boolean
  sidebarDensity: SidebarDensity
}

const DEFAULTS: SpacesPreferences = {
  contentFilter: 'none',
  messageDensity: 'comfortable',
  reducedMotion: false,
  glassEffects: true,
  enterToSend: true,
  showMemberRail: true,
  notificationLevel: 'mentions',
  desktopSounds: false,
  mentionNotifications: true,
  everyoneNotifications: true,
  roleNotifications: true,
  supportNotifications: true,
  notificationPreviews: true,
  appTheme: 'obsidian',
  presence: 'online',
  customStatus: '',
  appAccent: '#8b6ca8',
  hiddenWorkspaceIds: [],
  mutedWorkspaceIds: [],
  mutedChannelIds: [],
  pinnedChannelIds: [],
  collapsedChannelGroups: [],
  customCursor: true,
  developerMode: false,
  showAllChannelThreads: false,
  interfaceTextScale: 1,
  sidebarTextScale: 1,
  messageTextScale: 1,
  highContrastText: false,
  underlineLinks: false,
  sidebarDensity: 'comfortable',
}

const STORAGE_KEY = 'spaces.preferences.v1'

type PreferencesContextValue = {
  preferences: SpacesPreferences
  effectivePresence: PresenceStatus
  setPreference: <K extends keyof SpacesPreferences>(key: K, value: SpacesPreferences[K]) => void
  resetPreferences: () => void
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

function clampScale(value: unknown, fallback = 1) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(.85, Math.min(1.4, number)) : fallback
}

function loadPreferences(): SpacesPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<SpacesPreferences>
    return {
      ...DEFAULTS,
      ...parsed,
      interfaceTextScale: clampScale(parsed.interfaceTextScale),
      sidebarTextScale: clampScale(parsed.sidebarTextScale),
      messageTextScale: clampScale(parsed.messageTextScale),
      sidebarDensity: parsed.sidebarDensity === 'compact' ? 'compact' : 'comfortable',
    }
  } catch {
    return DEFAULTS
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<SpacesPreferences>(loadPreferences)
  const [effectivePresence, setEffectivePresence] = useState<PresenceStatus>(() => loadPreferences().presence)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    document.documentElement.dataset.motion = preferences.reducedMotion ? 'reduced' : 'full'
    document.documentElement.dataset.glass = preferences.glassEffects ? 'on' : 'off'
    document.documentElement.dataset.density = preferences.messageDensity
    document.documentElement.dataset.theme = preferences.appTheme
    document.documentElement.dataset.presence = preferences.presence
    document.documentElement.dataset.developer = preferences.developerMode ? 'on' : 'off'
    document.documentElement.dataset.textContrast = preferences.highContrastText ? 'high' : 'normal'
    document.documentElement.dataset.linkStyle = preferences.underlineLinks ? 'underline' : 'plain'
    document.documentElement.dataset.sidebarDensity = preferences.sidebarDensity
    document.documentElement.style.setProperty('--app-accent', preferences.appAccent)
    document.documentElement.style.setProperty('--spaces-interface-text-scale', String(clampScale(preferences.interfaceTextScale)))
    document.documentElement.style.setProperty('--spaces-sidebar-text-scale', String(clampScale(preferences.sidebarTextScale)))
    document.documentElement.style.setProperty('--spaces-message-text-scale', String(clampScale(preferences.messageTextScale)))
  }, [preferences])

  useEffect(() => {
    if (preferences.presence !== 'online') { setEffectivePresence(preferences.presence); return }
    let timer = window.setTimeout(() => setEffectivePresence('idle'), 5 * 60 * 1000)
    const wake = () => { setEffectivePresence('online'); window.clearTimeout(timer); timer = window.setTimeout(() => setEffectivePresence('idle'), 5 * 60 * 1000) }
    const events: (keyof WindowEventMap)[] = ['pointerdown','keydown','focus']
    events.forEach(name => window.addEventListener(name, wake, { passive: true }))
    return () => { window.clearTimeout(timer); events.forEach(name => window.removeEventListener(name, wake)) }
  }, [preferences.presence])

  const value = useMemo<PreferencesContextValue>(() => ({
    preferences,
    effectivePresence,
    setPreference: (key, next) => {
      if (key === 'presence') setEffectivePresence(next as PresenceStatus)
      setPreferences(current => ({ ...current, [key]: next }))
    },
    resetPreferences: () => {
      setEffectivePresence(DEFAULTS.presence)
      setPreferences(DEFAULTS)
    },
  }), [effectivePresence, preferences])

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences() {
  const value = useContext(PreferencesContext)
  if (!value) throw new Error('usePreferences must be used inside PreferencesProvider.')
  return value
}
