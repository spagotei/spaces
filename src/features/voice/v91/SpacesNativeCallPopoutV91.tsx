import { useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

type CallPreviewV91 = {
  kind: 'call'
  name: string
  avatarUrl: string | null
  status: string
  muted: boolean
}

/** Separate Tauri window: receives display state only, never account tokens or WebRTC streams. */
export function SpacesNativeCallPopoutV91() {
  const [preview, setPreview] = useState<CallPreviewV91 | null>(null)
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel('spaces.call.preview.v91')
    channel.onmessage = event => {
      const data = event.data as CallPreviewV91 | {kind:'ended'} | null
      if (data?.kind === 'call' && typeof data.name === 'string') setPreview(data)
      if (data?.kind === 'ended') void getCurrentWindow().close().catch(() => undefined)
    }
    channel.postMessage({ kind: 'ready' })
    return () => channel.close()
  }, [])
  const status = preview?.status === 'calling' ? 'Ringing…' : preview?.status === 'connected' ? 'Connected' : preview?.status === 'reconnecting' ? 'Reconnecting…' : preview?.status === 'incoming' ? 'Incoming call' : 'Connecting…'
  return <main className="spaces-v91-native-popout" aria-label="Spaces compact call window">
    <header data-tauri-drag-region className="spaces-v91-native-drag" onPointerDown={event => { if (event.button === 0) void getCurrentWindow().startDragging().catch(() => undefined) }}>
      <span>SPACES · CALL</span><button type="button" title="Close mini-view (call stays active)" aria-label="Close mini-view" onPointerDown={event => event.stopPropagation()} onClick={() => void getCurrentWindow().close()}>×</button>
    </header>
    <section className="spaces-v91-native-person">
      {preview?.avatarUrl ? <img src={preview.avatarUrl} alt=""/> : <div className="spaces-v91-native-avatar">{preview?.name?.slice(0,1).toUpperCase() || 'S'}</div>}
      <div className="spaces-v91-native-person-copy"><strong>{preview?.name || 'Waiting for Spaces…'}</strong><span>{status}{preview?.muted ? ' · Mic muted' : ''}</span></div>
      <span className="spaces-v91-native-dot" aria-label="Call active" />
    </section>
    <footer>Manage microphone, camera and streams in your main Spaces window.</footer>
  </main>
}
