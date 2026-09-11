import { SPACES_API_URL } from './config'
import type { WorkspaceProfile, WorkspacePresence } from '../types/spaces'

async function socialRequest<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('Accept', 'application/json')
  if (init?.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${SPACES_API_URL}${path}`, { ...init, headers })
  if (!response.ok) {
    let message = `Spaces request failed (${response.status}).`
    try {
      const body = await response.json() as { error?: string; message?: string }
      message = body.message ?? body.error ?? message
    } catch {
      // Keep the status-based message.
    }
    throw new Error(message)
  }
  if (response.status === 204) return undefined as T
  return await response.json() as T
}

export function updateSocialPresence(
  token: string,
  presence: WorkspacePresence,
  customStatus: string,
): Promise<WorkspaceProfile> {
  return socialRequest(token, '/v1/account/presence', {
    method: 'PATCH',
    body: JSON.stringify({ presence, customStatus }),
  })
}

export function listBlockedUsers(token: string): Promise<WorkspaceProfile[]> {
  return socialRequest(token, '/v1/account/blocks')
}

export async function blockUser(token: string, userId: string): Promise<void> {
  await socialRequest(token, `/v1/account/blocks/${encodeURIComponent(userId)}`, {
    method: 'PUT',
  })
  window.dispatchEvent(new Event('spaces-blocks-changed'))
}

export async function unblockUser(token: string, userId: string): Promise<void> {
  await socialRequest(token, `/v1/account/blocks/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  })
  window.dispatchEvent(new Event('spaces-blocks-changed'))
}
