/** V81.3 Solo voice idle policy: deterministic and testable. Server VC must enforce separately. */
export type SpacesVoiceIdleInputV813 = {
  now: number
  aloneSince: number | null
  participants: number
  streaming: boolean
  designatedAfk: boolean
  exempt: boolean
  recentActivityAt?: number | null
  idleMinutes?: number
}
export type SpacesVoiceIdleDecisionV813 = { action: 'none' | 'warn' | 'disconnect'; remainingMs: number }
export function spacesVoiceIdleDecisionV813(v: SpacesVoiceIdleInputV813): SpacesVoiceIdleDecisionV813 {
  if (v.participants !== 1 || v.aloneSince === null || v.streaming || v.designatedAfk || v.exempt) return { action: 'none', remainingMs: 0 }
  const minutes = Math.min(60, Math.max(2, Number.isFinite(v.idleMinutes ?? 10) ? (v.idleMinutes ?? 10) : 10))
  const last = Math.max(v.aloneSince, v.recentActivityAt ?? v.aloneSince)
  const remainingMs = Math.max(0, minutes * 60_000 - Math.max(0, v.now - last))
  return { action: remainingMs === 0 ? 'disconnect' : remainingMs <= 60_000 ? 'warn' : 'none', remainingMs }
}
