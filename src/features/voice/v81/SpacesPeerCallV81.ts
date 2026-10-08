/**
 * SPACES V81 — 1:1 WebRTC media foundation.
 * Does NOT supply signaling, TURN credentials, identity, server-side permissions,
 * group calls or SFU infrastructure. Integrate only with authenticated Worker signaling.
 * Browser capture requires HTTPS/secure context and explicit user permission.
 */
import { SpacesCallSoundsV81 } from './SpacesCallSoundsV81'

export type SpacesCallSignalV81 =
  | { callId: string; type: 'offer' | 'answer'; description: RTCSessionDescriptionInit }
  | { callId: string; type: 'ice'; candidate: RTCIceCandidateInit }
  | { callId: string; type: 'decline' | 'hangup' }
export type SpacesCallStateV81 = 'idle' | 'incoming' | 'calling' | 'connecting' | 'connected' | 'reconnecting' | 'ended'
export type SpacesCallTransportV81 = {
  /** The Worker must validate sender identity, recipient, callId and authorization. */
  send: (signal: SpacesCallSignalV81) => Promise<void>
}
export type SpacesCallCallbacksV81 = {
  onState?: (state: SpacesCallStateV81) => void
  onIncoming?: () => void
  onRemoteTrack?: (track: MediaStreamTrack, stream: MediaStream) => void
  onLocalTrack?: (track: MediaStreamTrack | null, kind: 'audio' | 'video') => void
  onError?: (error: unknown) => void
}

export class SpacesPeerCallV81 {
  readonly callId: string
  state: SpacesCallStateV81 = 'idle'
  private readonly transport: SpacesCallTransportV81
  private readonly rtcConfig: RTCConfiguration
  private readonly callbacks: SpacesCallCallbacksV81
  private readonly sounds: SpacesCallSoundsV81
  private pc: RTCPeerConnection | null = null
  private audioTrack: MediaStreamTrack | null = null
  private cameraTrack: MediaStreamTrack | null = null
  private screenTrack: MediaStreamTrack | null = null
  private audioSender: RTCRtpSender | null = null
  private videoSender: RTCRtpSender | null = null
  private pendingOffer: RTCSessionDescriptionInit | null = null
  private pendingCandidates: RTCIceCandidateInit[] = []
  private localMuted = false
  private localDeafened = false
  private connectedOnce = false
  private destroyed = false

  constructor(args: { callId: string; transport: SpacesCallTransportV81; rtcConfig: RTCConfiguration; sounds: SpacesCallSoundsV81; callbacks?: SpacesCallCallbacksV81 }) {
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(args.callId)) throw new Error('Invalid call ID')
    this.callId = args.callId
    this.transport = args.transport
    this.rtcConfig = args.rtcConfig
    this.sounds = args.sounds
    this.callbacks = args.callbacks ?? {}
  }
  private setState(next: SpacesCallStateV81): void {
    if (this.state === next) return
    this.state = next
    this.callbacks.onState?.(next)
  }
  private async send(signal: { type: 'offer' | 'answer'; description: RTCSessionDescriptionInit } | { type: 'ice'; candidate: RTCIceCandidateInit } | { type: 'decline' | 'hangup' }): Promise<void> {
    await this.transport.send({ callId: this.callId, ...signal } as SpacesCallSignalV81)
  }
  private ensurePc(): RTCPeerConnection {
    if (this.pc) return this.pc
    const pc = new RTCPeerConnection(this.rtcConfig)
    this.pc = pc
    this.audioSender = pc.addTransceiver('audio', { direction: 'sendrecv' }).sender
    this.videoSender = pc.addTransceiver('video', { direction: 'sendrecv' }).sender
    pc.onicecandidate = event => {
      if (event.candidate && !this.destroyed) void this.send({ type: 'ice', candidate: event.candidate.toJSON() }).catch(err => this.callbacks.onError?.(err))
    }
    pc.ontrack = event => {
      const stream = event.streams[0] ?? new MediaStream([event.track])
      if (this.localDeafened && event.track.kind === 'audio') event.track.enabled = false
      this.callbacks.onRemoteTrack?.(event.track, stream)
    }
    pc.onconnectionstatechange = () => {
      if (this.destroyed || this.state === 'ended') return
      if (pc.connectionState === 'connected') {
        this.sounds.stopLoops()
        this.setState('connected')
        void this.sounds.play(this.connectedOnce ? 'reconnected' : 'entered_call')
        this.connectedOnce = true
      } else if (pc.connectionState === 'disconnected') {
        this.setState('reconnecting')
        void this.sounds.play('reconnecting')
      } else if (pc.connectionState === 'failed') {
        this.sounds.stopLoops()
        void this.sounds.play('connection_lost')
        this.setState('reconnecting')
        pc.restartIce()
      }
    }
    return pc
  }
  private async acquireMic(deviceId?: string): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access is unavailable on this device')
    const stream = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true, video: false })
    const track = stream.getAudioTracks()[0]
    if (!track) throw new Error('No microphone track returned')
    track.enabled = !this.localMuted
    try {
      await this.audioSender?.replaceTrack(track)
      this.audioTrack?.stop()
      this.audioTrack = track
      this.callbacks.onLocalTrack?.(track, 'audio')
    } catch (error) { track.stop(); throw error }
  }
  async call(): Promise<void> {
    if (this.destroyed || this.state !== 'idle') throw new Error('Call is already active')
    try {
      const pc = this.ensurePc()
      await this.acquireMic()
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      this.setState('calling')
      void this.sounds.play('outgoing_call')
      await this.send({ type: 'offer', description: offer })
    } catch (error) { this.end(false); this.callbacks.onError?.(error); throw error }
  }
  async accept(): Promise<void> {
    if (this.destroyed || this.state !== 'incoming' || !this.pendingOffer) throw new Error('No incoming call to accept')
    try {
      const pc = this.ensurePc()
      await this.acquireMic()
      await pc.setRemoteDescription(this.pendingOffer)
      this.pendingOffer = null
      await this.flushCandidates()
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await this.send({ type: 'answer', description: answer })
      this.sounds.stop('ringtone')
      this.setState('connecting')
    } catch (error) { this.end(false); this.callbacks.onError?.(error); throw error }
  }
  async decline(): Promise<void> {
    if (this.state !== 'incoming') return
    try { await this.send({ type: 'decline' }) } finally { this.end(false); void this.sounds.play('call_declined') }
  }
  async hangup(): Promise<void> {
    if (this.state === 'idle' || this.state === 'ended') return
    try { await this.send({ type: 'hangup' }) } finally { this.end(false); void this.sounds.play('left_call') }
  }
  async receive(signal: SpacesCallSignalV81): Promise<void> {
    if (signal.callId !== this.callId || this.destroyed || this.state === 'ended') return
    if (signal.type === 'hangup' || signal.type === 'decline') {
      this.end(false)
      void this.sounds.play(signal.type === 'decline' ? 'call_declined' : 'call_ended')
      return
    }
    if (signal.type === 'offer') {
      if (this.state !== 'idle' || signal.description.type !== 'offer') return
      this.pendingOffer = signal.description
      this.setState('incoming')
      void this.sounds.play('ringtone')
      this.callbacks.onIncoming?.()
      return
    }
    if (signal.type === 'answer') {
      if (this.state !== 'calling' || signal.description.type !== 'answer') return
      const pc = this.ensurePc()
      await pc.setRemoteDescription(signal.description)
      await this.flushCandidates()
      this.sounds.stop('outgoing_call')
      this.setState('connecting')
      return
    }
    if (signal.type === 'ice') {
      if (!this.pc?.remoteDescription) this.pendingCandidates.push(signal.candidate)
      else await this.pc.addIceCandidate(signal.candidate)
    }
  }
  private async flushCandidates(): Promise<void> {
    if (!this.pc?.remoteDescription) return
    for (const candidate of this.pendingCandidates.splice(0)) await this.pc.addIceCandidate(candidate)
  }
  setMuted(muted: boolean): void {
    if (this.localMuted === muted) return
    this.localMuted = muted
    if (this.audioTrack) this.audioTrack.enabled = !muted
    void this.sounds.play(muted ? 'mute' : 'unmute')
  }
  setDeafened(deafened: boolean): void {
    if (this.localDeafened === deafened) return
    this.localDeafened = deafened
    this.pc?.getReceivers().filter(r => r.track?.kind === 'audio').forEach(r => { if (r.track) r.track.enabled = !deafened })
    void this.sounds.play(deafened ? 'deafen' : 'undeafen')
  }
  async switchMicrophone(deviceId: string): Promise<void> {
    if (!this.pc || this.state === 'ended') throw new Error('No active call')
    await this.acquireMic(deviceId)
  }
  async setCamera(enabled: boolean): Promise<void> {
    if (!this.pc || this.state === 'ended') throw new Error('No active call')
    if (this.screenTrack) throw new Error('Stop screen sharing before switching camera')
    if (!enabled) {
      await this.videoSender?.replaceTrack(null)
      this.cameraTrack?.stop(); this.cameraTrack = null
      this.callbacks.onLocalTrack?.(null, 'video')
      void this.sounds.play('camera_off')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access unavailable')
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true })
    const track = stream.getVideoTracks()[0]
    if (!track) throw new Error('No camera track returned')
    try {
      await this.videoSender?.replaceTrack(track)
      this.cameraTrack?.stop(); this.cameraTrack = track
      this.callbacks.onLocalTrack?.(track, 'video')
      void this.sounds.play('camera_on')
    } catch (error) { track.stop(); throw error }
  }
  async startScreenShare(): Promise<void> {
    if (!this.pc || this.state !== 'connected') throw new Error('Join a call before sharing your screen')
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Screen capture is unavailable on this platform')
    if (this.screenTrack) return
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
    const track = stream.getVideoTracks()[0]
    if (!track) throw new Error('No screen track returned')
    try {
      await this.videoSender?.replaceTrack(track)
      this.screenTrack = track
      // Screen sharing replaces camera in this 1:1 foundation. Stop the camera
      // capture instead of leaving a hidden camera track running.
      this.cameraTrack?.stop(); this.cameraTrack = null
      this.callbacks.onLocalTrack?.(track, 'video')
      track.onended = () => { if (this.screenTrack === track) void this.stopScreenShare().catch(error => this.callbacks.onError?.(error)) }
      void this.sounds.play('started_streaming')
    } catch (error) { track.stop(); throw error }
  }
  async stopScreenShare(): Promise<void> {
    const screen = this.screenTrack
    if (!screen) return
    this.screenTrack = null
    screen.onended = null
    try { await this.videoSender?.replaceTrack(null) }
    finally {
      screen.stop()
      this.callbacks.onLocalTrack?.(null, 'video')
      void this.sounds.play('stopped_streaming')
    }
  }
  /** SPACES_V81_3_LEVELS: stats-only speaking indicator; no extra media/network requests. */
  async getVoiceActivityV813(): Promise<{ local: boolean; remote: boolean }> {
    if (!this.pc || this.state !== 'connected') return { local: false, remote: false }
    const stats = await this.pc.getStats()
    let local = false, remote = false
    stats.forEach(item => {
      const row = item as { kind?: string; mediaType?: string; audioLevel?: number; type: string; remoteSource?: boolean }
      if (row.kind !== 'audio' && row.mediaType !== 'audio') return
      const level = typeof row.audioLevel === 'number' ? row.audioLevel : 0
      if (row.type === 'inbound-rtp' || (row.type === 'track' && row.remoteSource)) remote ||= level > .035
      if (row.type === 'media-source' || (row.type === 'track' && !row.remoteSource)) local ||= level > .035
    })
    return { local: local && !this.localMuted, remote: remote && !this.localDeafened }
  }
  /** Call on navigation, logout, or app shutdown; stops every local capture track. */
  destroy(): void { this.end(true) }
  private end(markDestroyed: boolean): void {
    if (markDestroyed) this.destroyed = true
    this.sounds.stopLoops()
    this.screenTrack?.stop(); this.screenTrack = null
    this.cameraTrack?.stop(); this.cameraTrack = null
    this.audioTrack?.stop(); this.audioTrack = null
    this.callbacks.onLocalTrack?.(null, 'audio')
    this.callbacks.onLocalTrack?.(null, 'video')
    if (this.pc) { this.pc.onicecandidate = null; this.pc.ontrack = null; this.pc.onconnectionstatechange = null; this.pc.close(); this.pc = null }
    this.pendingOffer = null
    this.pendingCandidates = []
    this.setState('ended')
  }
}
