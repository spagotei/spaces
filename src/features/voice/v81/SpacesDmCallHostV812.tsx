import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSpaces } from '../../../state/SpacesContext'
import { Avatar } from '../../../components/Avatar'
import { usePreferences } from '../../../state/PreferencesContext'
import { SpacesPeerCallV81, type SpacesCallStateV81 } from './SpacesPeerCallV81'
import { SpacesCallSoundsV81 } from './SpacesCallSoundsV81'
import { SpacesVoiceIconV81 } from './SpacesVoiceIconV81'
import { SpacesVoiceApiV812, type SpacesDmCallInfoV812, type SpacesDmCallRequestV812 } from './SpacesVoiceApiV812'
import '../../../styles/voice-v81-2.css'

type DisplayCall = Pick<SpacesDmCallInfoV812, 'callId' | 'conversationId' | 'direction' | 'person'>

/** Global call dock persists when navigating between DMs and Spaces. */
export function SpacesDmCallHostV812() {
  const { apiUrl, session, pushToast } = useSpaces()
  const { preferences, effectivePresence } = usePreferences()
  const token = session?.token ?? ''
  const userId = session?.profile.id ?? ''
  const api = useMemo(() => token ? new SpacesVoiceApiV812(apiUrl, token) : null, [apiUrl, token])
  const prefsRef = useRef({ sounds: preferences.desktopSounds, dnd: effectivePresence === 'dnd' })
  prefsRef.current = { sounds: preferences.desktopSounds, dnd: effectivePresence === 'dnd' }
  const soundsRef = useRef<SpacesCallSoundsV81 | null>(null)
  if (!soundsRef.current) soundsRef.current = new SpacesCallSoundsV81({
    isSoundsEnabled: () => prefsRef.current.sounds,
    isDoNotDisturb: () => prefsRef.current.dnd,
  })
  const [call, setCall] = useState<DisplayCall | null>(null)
  const [status, setStatus] = useState<SpacesCallStateV81>('idle')
  const [muted, setMuted] = useState(false)
  const [deafened, setDeafened] = useState(false)
  const [camera, setCamera] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [working, setWorking] = useState(false)
  const [speakingV813, setSpeakingV813] = useState({ local: false, remote: false }) // SPACES_V81_3_SPEAKING
  const [error, setError] = useState('')
  const [remoteVideo, setRemoteVideo] = useState<MediaStream | null>(null)
  const [remoteAudio, setRemoteAudio] = useState<MediaStream | null>(null)
  const [localVideo, setLocalVideo] = useState<MediaStream | null>(null)
  const remoteVideoEl = useRef<HTMLVideoElement>(null)
  const remoteAudioEl = useRef<HTMLAudioElement>(null)
  const localVideoEl = useRef<HTMLVideoElement>(null)
  const peerRef = useRef<SpacesPeerCallV81 | null>(null)
  const callRef = useRef<DisplayCall | null>(null)
  const seqRef = useRef(0)
  const inFlightRef = useRef(false)
  const generationRef = useRef(0)

  useEffect(() => { if (remoteVideoEl.current) remoteVideoEl.current.srcObject = remoteVideo }, [remoteVideo])
  useEffect(() => { if (remoteAudioEl.current) remoteAudioEl.current.srcObject = remoteAudio }, [remoteAudio])
  useEffect(() => { if (localVideoEl.current) localVideoEl.current.srcObject = localVideo }, [localVideo])
  useEffect(() => { soundsRef.current?.refreshSettings() }, [preferences.desktopSounds, effectivePresence])

  const reset = useCallback(() => {
    generationRef.current++
    peerRef.current?.destroy()
    peerRef.current = null
    callRef.current = null
    soundsRef.current?.stopLoops()
    setCall(null); setStatus('idle'); setError(''); setMuted(false); setDeafened(false)
    setCamera(false); setSharing(false); setRemoteVideo(null); setRemoteAudio(null); setLocalVideo(null); setSpeakingV813({ local: false, remote: false })
    seqRef.current = 0
  }, [])
  const attach = useCallback((info: DisplayCall, rtc: RTCConfiguration) => {
    if (!api) throw new Error('Sign in to start a call.')
    const peer = new SpacesPeerCallV81({
      callId: info.callId, rtcConfig: rtc, sounds: soundsRef.current!,
      transport: { send: signal => api.send(signal) },
      callbacks: {
        onState: next => setStatus(next),
        onRemoteTrack: (track, stream) => {
          if (track.kind === 'video') setRemoteVideo(stream)
          else setRemoteAudio(stream)
        },
        onLocalTrack: (track, kind) => { if (kind === 'video') { setLocalVideo(track ? new MediaStream([track]) : null); if (!track) { setSharing(false); setCamera(false) } } },
        onError: e => setError(e instanceof Error ? e.message : String(e)),
      },
    })
    peerRef.current = peer
    callRef.current = info
    seqRef.current = 0
    setCall(info); setStatus(info.direction === 'outgoing' ? 'calling' : 'connecting')
    return peer
  }, [api])
  const start = useCallback(async (detail: SpacesDmCallRequestV812) => {
    if (!api || !userId) return
    if (peerRef.current || inFlightRef.current) { pushToast('Finish your current call first.', 'info'); return }
    inFlightRef.current = true
    setError(''); setWorking(true)
    const generation = generationRef.current
    let createdCallId = ''
    try {
      const created = await api.create(detail.conversationId)
      createdCallId = created.callId
      if (generation !== generationRef.current) return
      const ice = await api.ice()
      if (generation !== generationRef.current) return
      const info: DisplayCall = { callId: created.callId, conversationId: detail.conversationId, direction: 'outgoing', person: { id: '', username: '', displayName: detail.displayName, avatarUrl: detail.avatarUrl ?? null } }
      const peer = attach(info, { iceServers: ice.iceServers })
      await peer.call()
      if (detail.video) await peer.setCamera(true)
      if (!ice.turnConfigured) setError('STUN-only connection: some networks need a TURN server.')
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setError(message)
      pushToast(message, 'danger')
      // If microphone/camera permission fails, cancel the server-side ringing call.
      if (createdCallId) { try { await api.send({ callId: createdCallId, type: 'hangup' }) } catch { /* best effort */ } }
      if (peerRef.current) reset()
    } finally { inFlightRef.current = false; setWorking(false) }
  }, [api, userId, attach, pushToast, reset])

  useEffect(() => {
    const onCall = (event: Event) => {
      const detail = (event as CustomEvent<SpacesDmCallRequestV812>).detail
      if (detail?.conversationId) void start(detail)
    }
    window.addEventListener('spaces-dm-call-v812', onCall)
    return () => window.removeEventListener('spaces-dm-call-v812', onCall)
  }, [start])

  useEffect(() => {
    if (!api || !userId) { reset(); return }
    let disposed = false
    let fetching = false
    const check = async () => {
      if (disposed || fetching || callRef.current || inFlightRef.current) return
      fetching = true
      try {
        const calls = await api.inbox()
        if (disposed || callRef.current || inFlightRef.current) return
        const incoming = calls.find(item => item.direction === 'incoming' && item.status === 'ringing')
        if (!incoming) return
        const ice = await api.ice()
        if (disposed || callRef.current) return
        attach(incoming, { iceServers: ice.iceServers })
      } catch { /* Offline/older Worker: don't interrupt chat. */ }
      finally { fetching = false }
    }
    void check()
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible' || Math.floor(Date.now()/1700)%4===0) void check() }, 1700)
    return () => {
      disposed = true; window.clearInterval(interval)
      // Best-effort cleanup on sign-out, navigation/unmount, or account switch.
      if (callRef.current) void api.send({callId:callRef.current.callId,type:'hangup'}).catch(() => {})
      reset()
    }
  }, [api, userId, attach, reset])

  useEffect(() => {
    if (!api || !call) return
    let disposed = false
    let busy = false
    const poll = async () => {
      if (disposed || inFlightRef.current || !peerRef.current || busy) return
      const current = peerRef.current
      if (current.callId !== call.callId) return
      // Polls are serialized, preventing duplicate ICE or SDP deliveries.
      busy = true
      try {
        const result = await api.poll(call.callId, seqRef.current)
        if (disposed || peerRef.current !== current) return
        for (const event of result.signals) {
          await current.receive(event.signal)
          seqRef.current = event.seq
        }
        if (result.status === 'ended' || current.state === 'ended') {
          if (call.direction === 'incoming' && current.state === 'incoming') void soundsRef.current?.play('missed_call')
          reset()
        }
      } catch (e) {
        if (!disposed) setError(e instanceof Error ? e.message : String(e))
      } finally { busy = false }
    }
    void poll()
    const interval = window.setInterval(() => void poll(), 800)
    return () => { disposed = true; window.clearInterval(interval) }
  }, [api, call, reset])

  // V81.3: client-only media stats, throttled when hidden to avoid unnecessary work.
  useEffect(() => {
    if (!call || status !== 'connected') return
    let disposed = false
    let busy = false
    const readLevel = async () => {
      if (disposed || busy || document.hidden) return
      const peer = peerRef.current
      if (!peer || peer.callId !== call.callId) return
      busy = true
      try { const next = await peer.getVoiceActivityV813(); if (!disposed) setSpeakingV813(prev => prev.local === next.local && prev.remote === next.remote ? prev : next) }
      catch { /* Unsupported RTC audioLevel stats: no fake speaking glow. */ }
      finally { busy = false }
    }
    void readLevel()
    const timer = window.setInterval(() => void readLevel(), 450)
    return () => { disposed = true; window.clearInterval(timer); setSpeakingV813({ local: false, remote: false }) }
  }, [call, status])

  const action = async (fn: (peer: SpacesPeerCallV81) => Promise<void>) => {
    const peer = peerRef.current
    if (!peer || working) return
    setWorking(true); setError('')
    try { await fn(peer) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setWorking(false) }
  }
  const leave = () => void action(async peer => { try { await peer.hangup() } finally { reset() } })
  const incoming = call?.direction === 'incoming' && status === 'incoming'
  const canControl = status === 'connected' || status === 'connecting' || status === 'calling'
  if (!call) return null
  return (
    <aside className="spaces-voice-dock-v812" role="dialog" aria-label="Spaces direct call" aria-live="polite">
      <div className="spaces-voice-top-v812">
        <span className={`spaces-voice-pfp-v813 ${speakingV813.remote ? 'is-speaking' : ''}`} aria-label={speakingV813.remote ? 'Other member speaking' : 'Other member'}><Avatar name={call.person.displayName} src={call.person.avatarUrl ?? null} size={38} /></span>
        <div><strong>{call.person.displayName}</strong>{speakingV813.remote && <span className="spaces-voice-speaking-label-v813" aria-label="Speaking"><span/><span/><span/> Speaking</span>}<small>{incoming ? 'Incoming voice call' : status === 'calling' ? 'Ringing…' : status === 'connected' ? 'Connected' : status === 'reconnecting' ? 'Reconnecting' : status === 'connecting' ? 'Connecting' : 'Call ended'}{(status === 'connecting' || status === 'reconnecting') && <span className="spaces-voice-dots-v812" aria-hidden="true"><i/><i/><i/></span>}</small></div>
        <span className={`spaces-voice-indicator-v812 ${status}`} role="status" aria-label={`Call status: ${status}`}>
          {status === 'connected' ? <span className="spaces-voice-signal-v812" aria-hidden="true"><i/><i/><i/></span> : incoming ? <SpacesVoiceIconV81 name="phone" size={13} /> : null}
        </span>
      </div>
      <div className="spaces-voice-videos-v812" hidden={!remoteVideo && !localVideo}>
        <video ref={remoteVideoEl} autoPlay playsInline aria-label="Remote video" />
        <video ref={localVideoEl} autoPlay playsInline muted aria-label="Your camera or screen" />
      </div>
      <audio ref={remoteAudioEl} autoPlay playsInline />
      {error && <p className="spaces-voice-error-v812" role="alert">{error}</p>}
      <div className="spaces-voice-actions-v812">
        {incoming ? <>
          <button className="spaces-voice-accept-v812" disabled={working} onClick={() => void action(peer => peer.accept())}><SpacesVoiceIconV81 name="phone" size={18}/> Accept</button>
          <button className="spaces-voice-hangup-v812" disabled={working} onClick={() => void action(async peer => { try { await peer.decline() } finally { reset() } })}><SpacesVoiceIconV81 name="phone-off" size={18}/> Decline</button>
        </> : <>
          <button title={muted ? 'Unmute' : 'Mute'} aria-label={muted ? 'Unmute' : 'Mute'} disabled={!canControl} className={muted ? 'active' : ''} onClick={() => { peerRef.current?.setMuted(!muted); setMuted(!muted) }}><SpacesVoiceIconV81 name={muted ? 'mic-off' : 'mic'} size={19}/></button>
          <button title={deafened ? 'Undeafen' : 'Deafen'} aria-label={deafened ? 'Undeafen' : 'Deafen'} disabled={!canControl} className={deafened ? 'active' : ''} onClick={() => { peerRef.current?.setDeafened(!deafened); setDeafened(!deafened) }}><SpacesVoiceIconV81 name={deafened ? 'headphones-off' : 'headphones'} size={19}/></button>
          <button title={camera ? 'Camera off' : 'Camera on'} aria-label={camera ? 'Camera off' : 'Camera on'} disabled={!canControl || working || sharing} className={camera ? 'active' : ''} onClick={() => void action(async peer => { await peer.setCamera(!camera); setCamera(!camera) })}><SpacesVoiceIconV81 name={camera ? 'video-off' : 'video'} size={19}/></button>
          <button title={sharing ? 'Stop screen sharing' : 'Share screen'} aria-label={sharing ? 'Stop screen sharing' : 'Share screen'} disabled={status !== 'connected' || working} className={sharing ? 'active' : ''} onClick={() => void action(async peer => { if (sharing) await peer.stopScreenShare(); else await peer.startScreenShare(); setSharing(!sharing); setCamera(false) })}><SpacesVoiceIconV81 name={sharing ? 'screen-stop' : 'screen-share'} size={19}/></button>
          <button className="spaces-voice-hangup-v812" title="End call" aria-label="End call" disabled={working} onClick={leave}><SpacesVoiceIconV81 name="phone-off" size={19}/></button>
        </>}
      </div>
    </aside>
  )
}
