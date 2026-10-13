import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom' // SPACES_V86_CALL
// SPACES_V88_POPOUT: picture-in-picture is browser gated and requires a click gesture.
import { setActiveVoicePeerV87, VoiceMemberVolumeV87 } from '../v87/VoiceMemberVolumeV87' // SPACES_V87_CALL_VOLUME
import { useSpaces } from '../../../state/SpacesContext'
import { Avatar } from '../../../components/Avatar'
import { usePreferences } from '../../../state/PreferencesContext'
import { SpacesPeerCallV81, type SpacesCallStateV81 } from './SpacesPeerCallV81'
import { SpacesCallSoundsV81 } from './SpacesCallSoundsV81'
import { SpacesVoiceIconV81 } from './SpacesVoiceIconV81'
import { isTauriDesktopRuntime } from '../../../components/DesktopTitlebar'
import { SpacesVoiceApiV812, type SpacesDmCallInfoV812, type SpacesDmCallRequestV812 } from './SpacesVoiceApiV812'
import '../../../styles/voice-v81-2.css'
import '../../../styles/voice-v85.css' // SPACES_V85_CAMERA_TILES

type DisplayCall = Pick<SpacesDmCallInfoV812, 'callId' | 'conversationId' | 'direction' | 'person'>

/** Global call dock persists when navigating between DMs and Spaces. */
export function SpacesDmCallHostV812() {
  const { apiUrl, session, pushToast } = useSpaces()
  const { preferences, effectivePresence, setPreference } = usePreferences()
  const token = session?.token ?? ''
  const userId = session?.profile.id ?? ''
  const api = useMemo(() => token ? new SpacesVoiceApiV812(apiUrl, token) : null, [apiUrl, token])
  const prefsRef = useRef({ sounds: preferences.desktopSounds, dnd: effectivePresence === 'dnd' })
  prefsRef.current = { sounds: preferences.desktopSounds, dnd: effectivePresence === 'dnd' }
  const [soundBlockedV91,setSoundBlockedV91] = useState(false)
  const nativeCallWindowV91 = useRef<{close:()=>Promise<void>} | null>(null)
  const nativeCallChannelV91 = useRef<BroadcastChannel | null>(null)
  const soundsRef = useRef<SpacesCallSoundsV81 | null>(null)
  if (!soundsRef.current) soundsRef.current = new SpacesCallSoundsV81({
    isSoundsEnabled: () => prefsRef.current.sounds,
    isDoNotDisturb: () => prefsRef.current.dnd,
    onPlaybackError: () => setSoundBlockedV91(true),
  })
  const [call, setCall] = useState<DisplayCall | null>(null)
  const [memberVolumeOpenV87, setMemberVolumeOpenV87] = useState(false)
  const [sharePickerV87, setSharePickerV87] = useState(false)
  const [slotV86, setSlotV86] = useState<HTMLElement | null>(null)
  const [popoutWindowV88, setPopoutWindowV88] = useState<Window | null>(null)
  const popoutRefV88 = useRef<Window | null>(null)
  const [anchorResetV88, setAnchorResetV88] = useState(0)
  const lastAnchorV88 = useRef(preferences.callOverlayAnchorV88)
  const [floatPositionV86, setFloatPositionV86] = useState<{x:number;y:number} | null>(null)
  useEffect(() => {
    if (lastAnchorV88.current === preferences.callOverlayAnchorV88) return
    lastAnchorV88.current = preferences.callOverlayAnchorV88
    setFloatPositionV86(null)
    setAnchorResetV88(v=>v+1)
  }, [preferences.callOverlayAnchorV88])
  const dragV86 = useRef<{x:number;y:number;left:number;top:number} | null>(null)
  const [pipPositionV86, setPipPositionV86] = useState({x:0,y:0})
  const pipDragV86 = useRef<{x:number;y:number;initialX:number;initialY:number;maxX:number;maxY:number} | null>(null)

  const [status, setStatus] = useState<SpacesCallStateV81>('idle')
  const [muted, setMuted] = useState(false)
  const [deafened, setDeafened] = useState(false)
  const [camera, setCamera] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [working, setWorking] = useState(false)
  const [speakingV813, setSpeakingV813] = useState({ local: false, remote: false }) // SPACES_V81_3_SPEAKING
  const [error, setError] = useState('')
  const [remoteVideo, setRemoteVideo] = useState<MediaStream | null>(null)
  const [remoteCameraLiveV85, setRemoteCameraLiveV85] = useState(false)
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

  useEffect(() => { if (remoteVideoEl.current) remoteVideoEl.current.srcObject = remoteVideo }, [remoteVideo, remoteCameraLiveV85, slotV86, popoutWindowV88])
  useEffect(() => { if (remoteAudioEl.current) remoteAudioEl.current.srcObject = remoteAudio }, [remoteAudio, slotV86, popoutWindowV88])
  useEffect(() => {
    if (!remoteAudioEl.current) return
    const otherVolume = Math.max(0,Math.min(100,preferences.callMemberVolumesV87?.[call?.person.id ?? ''] ?? 100)) / 100
    remoteAudioEl.current.volume = Math.max(0,Math.min(1,preferences.voiceOutputVolumeV87 / 100 * otherVolume))
  }, [slotV86, popoutWindowV88, remoteAudio, preferences.voiceOutputVolumeV87, preferences.callMemberVolumesV87, call?.person.id])
  useEffect(() => { soundsRef.current?.configure({volume:preferences.callSoundVolumeV87 / 100}) }, [preferences.callSoundVolumeV87]) // SPACES_V87_REMOTE_GAIN
  useEffect(() => { if (localVideoEl.current) localVideoEl.current.srcObject = localVideo }, [localVideo, camera, sharing, remoteCameraLiveV85, slotV86, popoutWindowV88])
  useEffect(() => { soundsRef.current?.refreshSettings() }, [preferences.desktopSounds, effectivePresence])

  // V86: portal the persistent WebRTC call into the open DM without recreating the peer.
  useEffect(() => {
    if (!call?.conversationId || preferences.callDisplayV86 !== 'integrated') { setSlotV86(null); return }
    const update = () => {
      const node = document.getElementById('spaces-v86-call-slot')
      setSlotV86(node?.dataset.conversationId === call.conversationId ? node : null)
    }
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.body, {childList:true,subtree:true})
    return () => observer.disconnect()
  }, [call?.conversationId, preferences.callDisplayV86])

  function dragStartV86(event: ReactPointerEvent<HTMLDivElement>) {
    if (popoutRefV88.current) return
    if (slotV86 || !preferences.callDraggableV86 || event.button !== 0 || (event.target as HTMLElement).closest('button,input,select,.spaces-v87-member-volume,.spaces-v88-layout-tools')) return
    const panel = event.currentTarget.closest('.spaces-v86-call-panel')
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    dragV86.current = {x:event.clientX,y:event.clientY,left:rect.left,top:rect.top}
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function dragMoveV86(event: ReactPointerEvent<HTMLDivElement>) {
    const start = dragV86.current
    if (!start) return
    const panel = event.currentTarget.closest('.spaces-v86-call-panel')
    const width = panel?.getBoundingClientRect().width ?? 420
    const height = panel?.getBoundingClientRect().height ?? 280
    setFloatPositionV86({
      x: Math.max(8, Math.min(window.innerWidth-width-8, start.left+event.clientX-start.x)),
      y: Math.max(8, Math.min(window.innerHeight-Math.min(height,window.innerHeight-55)-8, start.top+event.clientY-start.y))
    })
  }
  function dragEndV86() {dragV86.current = null}
  function pipStartV86(event: ReactPointerEvent<HTMLDivElement>) {
    if (!preferences.cameraTileDraggableV86 || event.button !== 0) return
    const stage = event.currentTarget.parentElement?.getBoundingClientRect()
    const tile = event.currentTarget.getBoundingClientRect()
    if (!stage) return
    pipDragV86.current = {x:event.clientX,y:event.clientY,initialX:pipPositionV86.x,initialY:pipPositionV86.y,maxX:Math.max(0,stage.width-tile.width-22),maxY:Math.max(0,stage.height-tile.height-22)}
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function pipMoveV86(event: ReactPointerEvent<HTMLDivElement>) {
    const start = pipDragV86.current
    if (!start) return
    setPipPositionV86({
      x: Math.max(-start.maxX,Math.min(0,start.initialX+event.clientX-start.x)),
      y: Math.max(-start.maxY,Math.min(0,start.initialY+event.clientY-start.y))
    })
  }
  function pipEndV86() {pipDragV86.current = null}

  const supportsPopoutV88 = typeof window !== 'undefined' && typeof (window as unknown as {documentPictureInPicture?: {requestWindow:(options:{width:number;height:number})=>Promise<Window>}}).documentPictureInPicture?.requestWindow === 'function'
  const openPopoutV88 = async () => {
    if (popoutRefV88.current && !popoutRefV88.current.closed) { popoutRefV88.current.focus(); return }
    const api = (window as unknown as {documentPictureInPicture?: {requestWindow:(options:{width:number;height:number})=>Promise<Window>}}).documentPictureInPicture
    if (!api) { setError('Pop-out needs a supported Chromium browser. Floating mode works inside Spaces.'); return }
    try {
      // Always call requestWindow directly from a click; browser consent is required.
      const popup = await api.requestWindow({width:Math.min(520,window.screen?.availWidth || 520),height:preferences.callOverlayViewV88 === 'media' ? 500 : 285})
      if (!callRef.current) { popup.close(); return }
      popup.document.title='Spaces · Call viewer'
      popup.document.body.style.cssText='margin:0;min-height:100vh;padding:10px;box-sizing:border-box;background:#101217;overflow:auto;color:#f1f1f7;'
      const attrs = document.documentElement.dataset
      for (const [key,value] of Object.entries(attrs)) if(value!==undefined) popup.document.documentElement.dataset[key]=value
      document.querySelectorAll('style,link[rel="stylesheet"]').forEach(source=>popup.document.head.appendChild(source.cloneNode(true)))
      popup.addEventListener('pagehide',()=>{
        if (popoutRefV88.current === popup) { popoutRefV88.current=null;setPopoutWindowV88(null) }
      },{once:true})
      popoutRefV88.current=popup
      setFloatPositionV86(null)
      setPopoutWindowV88(popup)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The browser did not open the call pop-out.')
    }
  }
  const closePopoutV88 = () => {
    const popup = popoutRefV88.current
    popoutRefV88.current = null
    setPopoutWindowV88(null)
    if (popup && !popup.closed) popup.close()
  }
  useEffect(()=>()=>{ if(popoutRefV88.current&&!popoutRefV88.current.closed) popoutRefV88.current.close() },[])
  // SPACES_V88_DOCUMENT_PIP
  useEffect(() => {
    if (!isTauriDesktopRuntime() || typeof BroadcastChannel === "undefined") return
    const channel=new BroadcastChannel("spaces.call.preview.v91")
    nativeCallChannelV91.current=channel
    const send=()=>{try{channel.postMessage(call ? {kind:"call",name:call.person.displayName,avatarUrl:call.person.avatarUrl ?? null,status,muted} : {kind:"ended"})}catch{/* closed */}}
    const timer=window.setInterval(send,800)
    channel.onmessage=e=>{if(e.data?.kind==="ready")send()}
    send()
    return ()=>{window.clearInterval(timer);channel.close();if(nativeCallChannelV91.current===channel)nativeCallChannelV91.current=null}
  },[call,status,muted])
  const openNativePopoutV91=async()=>{
    if (!isTauriDesktopRuntime() || !callRef.current) return
    try {
      const {WebviewWindow}=await import("@tauri-apps/api/webviewWindow")
      const existing=await WebviewWindow.getByLabel("spaces-call-popout-v91")
      if(existing){await existing.show();await existing.setFocus();nativeCallWindowV91.current=existing;return}
      const win=new WebviewWindow("spaces-call-popout-v91",{url:"index.html?spaces-popout=v91",title:"Spaces · Call",width:354,height:166,minWidth:280,minHeight:145,resizable:true,alwaysOnTop:true,decorations:false,x:60,y:90,visible:true})
      win.once("tauri://error",e=>setError("Desktop pop-out failed: "+String(e.payload)))
      nativeCallWindowV91.current=win
    }catch(e){setError(e instanceof Error?e.message:"Desktop pop-out unavailable")}
  }
  const enableSoundV91=async()=>{
    // User clicked directly: browser gesture is available for audio playback.
    prefsRef.current.sounds=true
    setPreference("desktopSounds",true)
    const el=remoteAudioEl.current
    if(el && remoteAudio){
      el.srcObject=remoteAudio
      el.muted=deafened
      if(!deafened)try{await el.play()}catch{setSoundBlockedV91(true);setError("Browser blocked voice audio. Allow sound for this tab, then retry.");return}
    }
    const id=status==="incoming"?"ringtone":status==="calling"?"outgoing_call":"entered_call"
    const played=await soundsRef.current?.play(id)
    setSoundBlockedV91(played===false && !remoteAudio)
  }
  useEffect(()=>{
    const el=remoteAudioEl.current
    if(!el || !remoteAudio)return
    el.srcObject=remoteAudio
    el.muted=deafened
    if(!deafened)void el.play().then(()=>setSoundBlockedV91(false)).catch(()=>setSoundBlockedV91(true))
  },[remoteAudio,slotV86,popoutWindowV88,call?.callId,deafened])
  // SPACES_V91_BROWSER_AUDIO
    const reset = useCallback(() => {
    try{nativeCallChannelV91.current?.postMessage({kind:"ended"})}catch{/* closed */}
    if(nativeCallWindowV91.current){void nativeCallWindowV91.current.close().catch(()=>undefined);nativeCallWindowV91.current=null}
    setSoundBlockedV91(false)
    generationRef.current++
    window.dispatchEvent(new Event('spaces-v85-call-history-changed'))
    peerRef.current?.destroy()
    peerRef.current = null
    callRef.current = null
    soundsRef.current?.stopLoops()
    if (popoutRefV88.current && !popoutRefV88.current.closed) popoutRefV88.current.close()
    popoutRefV88.current=null; setPopoutWindowV88(null)
    setActiveVoicePeerV87(''); setMemberVolumeOpenV87(false); setSharePickerV87(false)
    setSlotV86(null); setFloatPositionV86(null); setPipPositionV86({x:0,y:0})
    setCall(null); setStatus('idle'); setError(''); setMuted(false); setDeafened(false)
    setCamera(false); setSharing(false); setRemoteVideo(null); setRemoteCameraLiveV85(false); setRemoteAudio(null); setLocalVideo(null); setSpeakingV813({ local: false, remote: false })
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
          if (track.kind === 'video') {
            setRemoteVideo(stream)
            setRemoteCameraLiveV85(!track.muted && track.readyState === 'live')
            track.addEventListener('mute', () => setRemoteCameraLiveV85(false))
            track.addEventListener('unmute', () => setRemoteCameraLiveV85(track.readyState === 'live'))
            track.addEventListener('ended', () => setRemoteCameraLiveV85(false))
          }
          else setRemoteAudio(stream)
        },
        onLocalTrack: (track, kind) => { if (kind === 'video') { setLocalVideo(track ? new MediaStream([track]) : null); if (!track) { setSharing(false); setCamera(false) } } },
        onError: e => setError(e instanceof Error ? e.message : String(e)),
      },
    })
    peerRef.current = peer
    callRef.current = info
    setActiveVoicePeerV87(info.person.id ?? '')
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
      const info: DisplayCall = { callId: created.callId, conversationId: detail.conversationId, direction: 'outgoing', person: { id: detail.personId ?? '', username: '', displayName: detail.displayName, avatarUrl: detail.avatarUrl ?? null } }
      const peer = attach(info, { iceServers: ice.iceServers })
      await peer.call()
      if (detail.video === true) await peer.setCamera(true)
      // SPACES_V91_CONNECTING: status already shows Connecting or Ringing; TURN not configured is not itself an error.
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
  // SPACES_V926_RING_TIMEOUT: unanswered outgoing calls stop after 45 seconds.
  useEffect(() => {
    if (!api || !call || call.direction !== 'outgoing' || status !== 'calling') return
    const callId = call.callId
    const timer = window.setTimeout(() => {
      if (callRef.current?.callId !== callId || peerRef.current?.state !== 'calling') return
      void api.send({ callId, type: 'hangup' }).catch(() => undefined).finally(() => {
        if (callRef.current?.callId === callId) {
          pushToast('No answer. Call ended.', 'info')
          reset()
        }
      })
    }, 45000)
    return () => window.clearTimeout(timer)
  }, [api, call?.callId, call?.direction, status, pushToast, reset])
  const incoming = call?.direction === 'incoming' && status === 'incoming'
  const canControl = status === 'connected' || status === 'connecting' || status === 'calling'
  if (!call) return null
  const callPanelV86 = (
    <aside className={'spaces-voice-dock-v812 spaces-v86-call-panel spaces-v88-call-panel '+(popoutWindowV88 ? 'spaces-v88-external' : slotV86 ? 'spaces-v86-integrated' : 'spaces-v86-floating')} role="dialog" aria-label="Spaces direct call" aria-live="polite"
      data-v88-view={preferences.callOverlayViewV88} data-v88-anchor={preferences.callOverlayAnchorV88} data-v88-placement-version={anchorResetV88}
      style={!slotV86 && !popoutWindowV88 && floatPositionV86 ? {left:floatPositionV86.x,top:floatPositionV86.y,right:'auto',bottom:'auto'} as CSSProperties : undefined}>
      <div className="spaces-voice-top-v812" onPointerDown={dragStartV86} onPointerMove={dragMoveV86} onPointerUp={dragEndV86} onPointerCancel={dragEndV86}>
        <span role="button" tabIndex={0} title="Right-click or press to adjust voice volume" onClick={() => setMemberVolumeOpenV87(value=>!value)} onContextMenu={event => {event.preventDefault();setMemberVolumeOpenV87(true)}} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setMemberVolumeOpenV87(value=>!value)}}} className={`spaces-voice-pfp-v813 ${speakingV813.remote ? 'is-speaking' : ''}`} aria-label={speakingV813.remote ? 'Other member speaking' : 'Other member'}><Avatar name={call.person.displayName} src={call.person.avatarUrl ?? null} size={38} /></span>
        <div><strong>{call.person.displayName}</strong>{speakingV813.remote && <span className="spaces-voice-speaking-label-v813" aria-label="Speaking"><span/><span/><span/> Speaking</span>}<small>{incoming ? 'Incoming voice call' : status === 'calling' ? 'Ringing…' : status === 'connected' ? 'Connected' : status === 'reconnecting' ? 'Reconnecting' : status === 'connecting' ? 'Connecting' : 'Call ended'}{(status === 'connecting' || status === 'reconnecting') && <span className="spaces-voice-dots-v812" aria-hidden="true"><i/><i/><i/></span>}</small></div>
        <button type="button" className="spaces-v86-call-layout-toggle" title={slotV86 ? 'Float this call' : 'Use DM top panel'} aria-label={slotV86 ? 'Float this call' : 'Use DM top panel'} onClick={() => setPreference('callDisplayV86', slotV86 ? 'floating' : 'integrated')}><SpacesVoiceIconV81 name="screen-share" size={16} /></button>
        {memberVolumeOpenV87 && call.person.id && <div className="spaces-v87-member-popover" onPointerDown={event=>event.stopPropagation()}><VoiceMemberVolumeV87 userId={call.person.id} displayName={call.person.displayName} /></div>}
        <div className="spaces-v88-layout-tools" aria-label="Call viewer options">
          {isTauriDesktopRuntime() && <button type="button" title="Always-on-top desktop avatar mini-view" aria-label="Open desktop mini-view" onClick={()=>void openNativePopoutV91()}>▣</button>}
          <button type="button" title="Compact avatar and username" aria-label="Compact avatar viewer" className={preferences.callOverlayViewV88 === 'avatar' ? 'active' : ''} onClick={()=>setPreference('callOverlayViewV88','avatar')}><span aria-hidden="true">●</span></button>
          <button type="button" title="Larger camera / stream view" aria-label="Video and stream viewer" className={preferences.callOverlayViewV88 === 'media' ? 'active' : ''} onClick={()=>setPreference('callOverlayViewV88','media')}><SpacesVoiceIconV81 name="video" size={16}/></button>
          {popoutWindowV88 ? <button type="button" title="Return call to Spaces" aria-label="Return pop-out to Spaces" onClick={closePopoutV88}>↙</button> : <button type="button" title={supportsPopoutV88 ? 'Pop out over other windows' : 'Separate pop-out is not supported on this device'} aria-label="Pop out call viewer" disabled={!supportsPopoutV88} onClick={()=>void openPopoutV88()}>↗</button>}
        </div>
        <span className={`spaces-voice-indicator-v812 ${status}`} role="status" aria-label={`Call status: ${status}`}>
          {status === 'connected' ? <span className="spaces-voice-signal-v812" aria-hidden="true"><i/><i/><i/></span> : incoming ? <SpacesVoiceIconV81 name="phone" size={13} /> : null}
        </span>
      </div>
      <div className="spaces-voice-stage-v85" aria-label="Call participants">
        {remoteCameraLiveV85 && remoteVideo ? <video className="spaces-v85-main-video" ref={remoteVideoEl} autoPlay playsInline aria-label="Other member's camera" />
          : localVideo && (camera || sharing) && preferences.callSelfViewV86 ? <video className="spaces-v85-main-video" ref={localVideoEl} autoPlay playsInline muted aria-label="Your camera preview" />
          : <div className="spaces-v85-avatar-stage"><span className="spaces-v85-avatar-circle"><Avatar name={call.person.displayName} src={call.person.avatarUrl ?? null} size={76}/></span><strong>{call.person.displayName}</strong><small>{status === 'connected' ? 'Camera off · Voice connected' : 'Connecting voice…'}</small></div>}
        {remoteCameraLiveV85 && remoteVideo && localVideo && (camera || sharing) && preferences.callSelfViewV86 && <div className={'spaces-v85-tile-pip '+(preferences.cameraTileDraggableV86 ? 'spaces-v86-pip-drag' : '')} style={{transform:'translate('+pipPositionV86.x+'px,'+pipPositionV86.y+'px)'}} onPointerDown={pipStartV86} onPointerMove={pipMoveV86} onPointerUp={pipEndV86} onPointerCancel={pipEndV86}><video ref={localVideoEl} autoPlay playsInline muted aria-label="Your camera preview" /></div>}
        {!remoteCameraLiveV85 && localVideo && (camera || sharing) && <div className="spaces-v85-remote-chip"><span className="spaces-v85-avatar-circle"><Avatar name={call.person.displayName} src={call.person.avatarUrl ?? null} size={26}/></span><span>{call.person.displayName}</span></div>}
        {(remoteCameraLiveV85 || localVideo && (camera || sharing)) && <span className="spaces-v85-stage-label">{remoteCameraLiveV85 ? call.person.displayName : 'Your camera'}</span>}
      </div>
      <audio ref={remoteAudioEl} autoPlay playsInline />
      {!isTauriDesktopRuntime() && <button type="button" className="spaces-v91-enable-audio" title="Test browser call sound or enable audio" onClick={()=>void enableSoundV91()}>{soundBlockedV91 ? "Enable Sound · Browser Blocked" : "Test / Enable Call Sound"}</button>}
      {error && <p className="spaces-voice-error-v812" role="alert">{error}</p>}
      <div className="spaces-voice-actions-v812">
        {incoming ? <>
          <button className="spaces-voice-accept-v812" disabled={working} onClick={() => void action(peer => peer.accept())}><SpacesVoiceIconV81 name="phone" size={18}/> Accept</button>
          <button className="spaces-voice-hangup-v812" disabled={working} onClick={() => void action(async peer => { try { await peer.decline() } finally { reset() } })}><SpacesVoiceIconV81 name="phone-off" size={18}/> Decline</button>
        </> : <>
          <button title={muted ? 'Unmute' : 'Mute'} aria-label={muted ? 'Unmute' : 'Mute'} disabled={!canControl} className={muted ? 'active' : ''} onClick={() => { peerRef.current?.setMuted(!muted); setMuted(!muted) }}><SpacesVoiceIconV81 name={muted ? 'mic-off' : 'mic'} size={19}/></button>
          <button title={deafened ? 'Undeafen' : 'Deafen'} aria-label={deafened ? 'Undeafen' : 'Deafen'} disabled={!canControl} className={deafened ? 'active' : ''} onClick={() => { peerRef.current?.setDeafened(!deafened); setDeafened(!deafened) }}><SpacesVoiceIconV81 name={deafened ? 'headphones-off' : 'headphones'} size={19}/></button>
          <button title={camera ? 'Camera off' : 'Camera on'} aria-label={camera ? 'Camera off' : 'Camera on'} disabled={!canControl || working || sharing} className={camera ? 'active' : ''} onClick={() => void action(async peer => { await peer.setCamera(!camera); setCamera(!camera) })}><SpacesVoiceIconV81 name={camera ? 'video-off' : 'video'} size={19}/></button>
          <button title={sharing ? 'Stop screen sharing' : 'Share screen'} aria-label={sharing ? 'Stop screen sharing' : 'Share screen'} disabled={status !== 'connected' || working} className={sharing ? 'active' : ''} onClick={() => { if (sharing) void action(async peer => { await peer.stopScreenShare(); setSharing(false) }); else setSharePickerV87(value => !value) }}><SpacesVoiceIconV81 name={sharing ? 'screen-stop' : 'screen-share'} size={19}/></button>
          {sharePickerV87 && !sharing && <div className="spaces-v87-stream-picker" role="group" aria-label="Choose what to stream">
            <p className="spaces-v87-stream-hint">The browser or system will ask what to share. Choosing a type below only suggests which tab opens first.</p>
            {([['monitor','Entire screen'],['window','App / window'],['browser','Browser tab']] as const).map(([type,label])=><button key={type} disabled={working || !navigator.mediaDevices?.getDisplayMedia} type="button" onClick={() => void action(async peer => { await peer.startScreenShare(type); setSharing(true); setCamera(false); setSharePickerV87(false) })}>{label}</button>)}
            <button type="button" onClick={() => setSharePickerV87(false)}>Cancel</button>
          </div>}
          <button className="spaces-voice-hangup-v812" title="End call" aria-label="End call" disabled={working} onClick={leave}><SpacesVoiceIconV81 name="phone-off" size={19}/></button>
        </>}
      </div>
    </aside>
  )
  return popoutWindowV88 && !popoutWindowV88.closed ? createPortal(callPanelV86, popoutWindowV88.document.body) : slotV86 ? createPortal(callPanelV86, slotV86) : callPanelV86
}
