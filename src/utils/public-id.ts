export function formatPublicUserId(value: string | number): string {
  const raw = String(value ?? '').trim()
  const parsed = Number.parseInt(raw, 10)

  if (!Number.isSafeInteger(parsed) || parsed < 1) return raw ? `#${raw}` : ''
  if (parsed < 20) return `#${parsed}`
  if (parsed < 1000) return `#${String(parsed).padStart(5, '0')}`
  return `#${parsed}`
}
