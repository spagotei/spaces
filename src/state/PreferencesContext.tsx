import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { loadWorkspaceSession } from '../api/session'

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
  supportIncomingSounds: boolean
  supportReceivedSounds: boolean
  supportOutgoingSounds: boolean
  notificationPreviews: boolean
  commentNotifications: boolean
  friendRequestNotifications: boolean
  groupNotifications: boolean
  directNotifications: boolean
  mobileSystemNotifications: boolean
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
  supportIncomingSounds: true,
  supportReceivedSounds: true,
  supportOutgoingSounds: true,
  notificationPreviews: true,
  commentNotifications: true,
  friendRequestNotifications: true,
  groupNotifications: true,
  directNotifications: true,
  mobileSystemNotifications: true,
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

const LEGACY_STORAGE_KEY = 'spaces.preferences.v1'

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

function accountIdNow() {
  return loadWorkspaceSession()?.profile.id ?? 'signed-out'
}

function storageKey(accountId: string) {
  return `spaces.preferences.v62.${accountId}`
}

function normalizePreferences(parsed: Partial<SpacesPreferences>): SpacesPreferences {
  return {
    ...DEFAULTS,
    ...parsed,
    interfaceTextScale: clampScale(parsed.interfaceTextScale),
    sidebarTextScale: clampScale(parsed.sidebarTextScale),
    messageTextScale: clampScale(parsed.messageTextScale),
    sidebarDensity: parsed.sidebarDensity === 'compact' ? 'compact' : 'comfortable',
  }
}

function loadPreferences(accountId: string): SpacesPreferences {
  try {
    const scoped = localStorage.getItem(storageKey(accountId))
    if (scoped) return normalizePreferences(JSON.parse(scoped) as Partial<SpacesPreferences>)

    // Preserve harmless appearance/layout choices from older installs, but never
    // inherit somebody else's status into a newly signed-in account.
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!legacy) return DEFAULTS
    const parsed = JSON.parse(legacy) as Partial<SpacesPreferences>
    return normalizePreferences({
      ...parsed,
      presence: 'online',
      customStatus: '',
    })
  } catch {
    return DEFAULTS
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [accountId, setAccountId] = useState(accountIdNow)
  const [preferences, setPreferences] = useState<SpacesPreferences>(() => loadPreferences(accountId))
  const effectivePresence = preferences.presence

  useEffect(() => {
    const refreshAccount = () => {
      const next = accountIdNow()
      if (next === accountId) return
      setAccountId(next)
      setPreferences(loadPreferences(next))
    }
    window.addEventListener('spaces-session-changed', refreshAccount)
    return () => window.removeEventListener('spaces-session-changed', refreshAccount)
  }, [accountId])

  useEffect(() => {
    localStorage.setItem(storageKey(accountId), JSON.stringify(preferences))
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
  }, [accountId, preferences])

  function savePreferenceV72<K extends keyof SpacesPreferences>(key: K, next: SpacesPreferences[K]) {
    setPreferences(current => {
      const updated = { ...current, [key]: next }
      try { localStorage.setItem(storageKey(accountId), JSON.stringify(updated)) } catch { /* effect will retry */ }
      return updated
    })
  }

  const value = useMemo<PreferencesContextValue>(() => ({
    preferences,
    effectivePresence,
    setPreference: savePreferenceV72,
    resetPreferences: () => setPreferences(DEFAULTS),
  }), [effectivePresence, preferences, accountId])

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences() {
  const value = useContext(PreferencesContext)
  if (!value) throw new Error('usePreferences must be used inside PreferencesProvider.')
  return value
}
