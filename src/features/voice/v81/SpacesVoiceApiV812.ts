/** Authenticated Spaces V81.2 DM call signaling client. No media traverses the Worker. */
import type { SpacesCallSignalV81 } from './SpacesPeerCallV81'

export type SpacesDmCallInfoV812 = {
  callId: string
  conversationId: string
  direction: 'incoming' | 'outgoing'
  status: 'ringing' | 'active'
  person: { id: string; displayName: string; username: string; avatarUrl?: string | null }
  createdAt: number
  expiresAt: number
}
export type SpacesVoiceIceV812 = { iceServers: RTCIceServer[]; turnConfigured: boolean }

export class SpacesVoiceApiV812 {
  constructor(private baseUrl: string, private token: string) {}
  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers)
    headers.set('Authorization', `Bearer ${this.token}`)
    if (init?.body) headers.set('Content-Type', 'application/json')
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, cache: 'no-store', headers })
    const body = await response.json().catch(() => ({})) as T & { error?: string }
    if (!response.ok) throw new Error(body.error || `Call request failed (${response.status})`)
    return body
  }
  async create(conversationId: string): Promise<{ callId: string }> {
    return this.request('/v1/voice/v81/calls', { method: 'POST', body: JSON.stringify({ conversationId }) })
  }
  async inbox(): Promise<SpacesDmCallInfoV812[]> {
    return (await this.request<{ calls: SpacesDmCallInfoV812[] }>('/v1/voice/v81/inbox')).calls
  }
  ice(): Promise<SpacesVoiceIceV812> { return this.request('/v1/voice/v81/ice') }
  async send(signal: SpacesCallSignalV81): Promise<void> {
    const path = `/v1/voice/v81/calls/${encodeURIComponent(signal.callId)}/signals`
    // ICE gathering may begin while the SDP offer is still being uploaded.
    // Retry only the transient offer-not-ready conflict, never auth/permission errors.
    for (let attempt = 0; ; attempt++) {
      try {
        await this.request(path, { method: 'POST', body: JSON.stringify(signal) })
        return
      } catch (error) {
        if (signal.type !== 'ice' || attempt >= 6 || !(error instanceof Error) || !error.message.includes('offer is not ready')) throw error
        await new Promise(resolve => setTimeout(resolve, 250))
      }
    }
  }
  async poll(callId: string, after: number): Promise<{ status: 'ringing' | 'active' | 'ended'; signals: { seq: number; signal: SpacesCallSignalV81 }[]; lastSeq: number }> {
    return this.request(`/v1/voice/v81/calls/${encodeURIComponent(callId)}/signals?after=${after}`)
  }
}

export type SpacesDmCallRequestV812 = { conversationId: string; displayName: string; video?: boolean; avatarUrl?: string | null } // SPACES_V81_3_AVATAR
export function startSpacesDmCallV812(request: SpacesDmCallRequestV812): void {
  window.dispatchEvent(new CustomEvent<SpacesDmCallRequestV812>('spaces-dm-call-v812', { detail: request }))
}
