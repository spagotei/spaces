import { SPACES_API_URL } from './config'
import type { WorkspaceSession } from '../types/spaces'

const encoder = new TextEncoder()
const PASSWORD_ITERATIONS = 310_000

type BetaClaimMode = 'claim' | 'login' | 'unavailable'

export type BetaClaimStatus = {
  mode: BetaClaimMode
}

export type BetaClaimStart = {
  sent: boolean
  email: string
  expiresAt: number
}

export type BetaClaimVerification = {
  email: string
  claimToken: string
  expiresAt: number
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('Accept', 'application/json')
  if (init?.body) headers.set('Content-Type', 'application/json')

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
  return await response.json() as T
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string): ArrayBuffer {
  const binary = atob(value)
  const buffer = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(buffer)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return buffer
}

function newSalt(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return bytesToBase64(bytes)
}

async function deriveVerifier(password: string, salt: string): Promise<string> {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: base64ToBytes(salt),
      iterations: PASSWORD_ITERATIONS,
    },
    material,
    256,
  )
  return bytesToBase64(new Uint8Array(bits))
}

export function getBetaClaimStatus(email: string): Promise<BetaClaimStatus> {
  return request(`/v1/auth/beta/status?email=${encodeURIComponent(email)}`)
}

export function startBetaClaim(email: string): Promise<BetaClaimStart> {
  return request('/v1/auth/beta/start', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function verifyBetaClaim(email: string, code: string): Promise<BetaClaimVerification> {
  return request('/v1/auth/beta/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  })
}

export async function claimBetaAccount(input: {
  email: string
  claimToken: string
  username: string
  displayName: string
  password: string
}): Promise<WorkspaceSession> {
  const passwordSalt = newSalt()
  const passwordVerifier = await deriveVerifier(input.password, passwordSalt)

  return request('/v1/auth/beta/claim', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      claimToken: input.claimToken,
      username: input.username,
      displayName: input.displayName,
      passwordSalt,
      passwordVerifier,
      passwordIterations: PASSWORD_ITERATIONS,
    }),
  })
}
