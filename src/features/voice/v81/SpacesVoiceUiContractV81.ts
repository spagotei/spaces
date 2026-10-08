/**
 * SPACES V81.1 — Discord-style voice UX contract.
 * These are UI descriptors ONLY. The Worker must enforce all permissions and call authorization.
 * No voice channel or call is created by importing this module.
 */
export const SPACES_VOICE_CHANNEL_PERMISSIONS_V81 = [
  { key: 'view_channel', label: 'View Channel', description: 'See the voice channel in the server list.' },
  { key: 'connect', label: 'Connect', description: 'Join a voice channel.' },
  { key: 'speak', label: 'Speak', description: 'Transmit microphone audio when connected.' },
  { key: 'video', label: 'Video', description: 'Enable camera in the voice channel.' },
  { key: 'stream', label: 'Stream', description: 'Share a screen or application.' },
  { key: 'watch_stream', label: 'Watch Streams', description: 'Receive another member’s stream.' },
  { key: 'mute_members', label: 'Mute Members', description: 'Server-mute another member.' },
  { key: 'deafen_members', label: 'Deafen Members', description: 'Server-deafen another member.' },
  { key: 'move_members', label: 'Move Members', description: 'Move members between voice channels.' },
  { key: 'disconnect_members', label: 'Disconnect Members', description: 'Disconnect another member from voice.' },
  { key: 'manage_voice_channel', label: 'Manage Voice Channel', description: 'Edit voice-channel settings and permission overwrites.' },
] as const
export type SpacesVoicePermissionKeyV81 = typeof SPACES_VOICE_CHANNEL_PERMISSIONS_V81[number]['key']
export type SpacesVoiceChannelPermissionValueV81 = 'allow' | 'deny' | 'inherit'
export type SpacesVoiceChannelOverwriteV81 = {
  principalType: 'role' | 'member'
  principalId: string
  permissions: Partial<Record<SpacesVoicePermissionKeyV81, SpacesVoiceChannelPermissionValueV81>>
}
export type SpacesVoiceChannelSettingsV81 = {
  channelId: string
  serverId: string
  name: string
  kind: 'voice'
  userLimit: number | null
  bitrateKbps: number | null
  permissionOverwrites: SpacesVoiceChannelOverwriteV81[]
}
export type SpacesVoiceSurfaceV81 = 'dm' | 'group_dm' | 'server_voice'
export type SpacesVoiceIconNameV81 =
  | 'phone' | 'phone-off' | 'video' | 'video-off' | 'screen-share' | 'screen-stop'
  | 'mic' | 'mic-off' | 'headphones' | 'headphones-off' | 'speaker'
  | 'users' | 'lock' | 'voice' | 'settings' | 'move' | 'stream' | 'eye'

/** UI labels and icons for integration with existing Spaces DM/channel toolbars. */
export const SPACES_VOICE_UI_ACTIONS_V81 = {
  dm_voice_call: { icon: 'phone', label: 'Start Voice Call', surface: 'dm' },
  dm_video_call: { icon: 'video', label: 'Start Video Call', surface: 'dm' },
  dm_screen_share: { icon: 'screen-share', label: 'Share Screen', surface: 'dm' },
  dm_end_call: { icon: 'phone-off', label: 'End Call', surface: 'dm' },
  voice_join: { icon: 'voice', label: 'Join Voice', surface: 'server_voice' },
  voice_leave: { icon: 'phone-off', label: 'Disconnect', surface: 'server_voice' },
  voice_mute: { icon: 'mic-off', label: 'Mute', surface: 'server_voice' },
  voice_unmute: { icon: 'mic', label: 'Unmute', surface: 'server_voice' },
  voice_deafen: { icon: 'headphones-off', label: 'Deafen', surface: 'server_voice' },
  voice_undeafen: { icon: 'headphones', label: 'Undeafen', surface: 'server_voice' },
  voice_stream: { icon: 'stream', label: 'Go Live', surface: 'server_voice' },
  voice_watch_stream: { icon: 'eye', label: 'Watch Stream', surface: 'server_voice' },
  voice_permissions: { icon: 'lock', label: 'Voice Permissions', surface: 'server_voice' },
  voice_settings: { icon: 'settings', label: 'Edit Voice Channel', surface: 'server_voice' },
} as const satisfies Record<string, {icon: SpacesVoiceIconNameV81; label: string; surface: SpacesVoiceSurfaceV81}>

/** Fallback only; prefer vector icon components in real toolbars. */
export const SPACES_VOICE_EMOJI_FALLBACK_V81 = {
  phone: '📞', video: '📹', voice: '🔊', stream: '🖥️', mic: '🎙️', headphones: '🎧', lock: '🔒', users: '👥'
} as const
