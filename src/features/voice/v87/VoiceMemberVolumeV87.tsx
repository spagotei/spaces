/** Local-only volume. Changes playback gain for this member on this device.
 * No microphone, account identity, signaling or server permissions are changed. */
import { useEffect, useState } from 'react'
import { usePreferences } from '../../../state/PreferencesContext'

let activePeerIdV87 = ''
export function setActiveVoicePeerV87(userId: string) {
  activePeerIdV87 = userId
  window.dispatchEvent(new Event('spaces-v87-voice-peer'))
}
export function useActiveVoicePeerV87() {
  const [userId, setUserId] = useState(activePeerIdV87)
  useEffect(() => {
    const sync = () => setUserId(activePeerIdV87)
    window.addEventListener('spaces-v87-voice-peer', sync)
    return () => window.removeEventListener('spaces-v87-voice-peer', sync)
  }, [])
  return userId
}
export function VoiceMemberVolumeV87({ userId, displayName }: { userId: string; displayName: string }) {
  const { preferences, setPreference } = usePreferences()
  if (!userId) return null
  const volume = Math.max(0, Math.min(100, preferences.callMemberVolumesV87?.[userId] ?? 100))
  return <div className="spaces-v87-member-volume">
    <label htmlFor={'spaces-volume-'+userId}>Voice volume · {displayName} <output>{volume}%</output></label>
    <input id={'spaces-volume-'+userId} type="range" min={0} max={100} step={5}
      value={volume} aria-label={'Voice volume for '+displayName}
      onChange={event => setPreference('callMemberVolumesV87', {
        ...preferences.callMemberVolumesV87,
        [userId]: Math.max(0,Math.min(100,Number(event.target.value)))
      })}/>
  </div>
}
