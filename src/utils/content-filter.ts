import type { ContentFilterLevel } from '../state/PreferencesContext'

const PROFANITY = [
  'fuck', 'fucking', 'fucked', 'fucker',
  'shit', 'shitty',
  'bitch', 'bitches',
  'asshole', 'bullshit', 'motherfucker',
]

function maskWord(word: string, level: ContentFilterLevel): string {
  if (level === 'none') return word
  const chars = [...word]
  if (!chars.length) return word
  if (level === 'high') return '*'.repeat(chars.length)
  if (chars.length === 1) return '*'
  if (chars.length === 2) return `${chars[0]}*`

  // Low intentionally masks one inner character: Fuck -> F*ck.
  if (level === 'low') {
    return `${chars[0]}*${chars.slice(2).join('')}`
  }

  // Medium keeps only the first and final character: Fuck -> F**k.
  return `${chars[0]}${'*'.repeat(Math.max(1, chars.length - 2))}${chars.at(-1) ?? ''}`
}

export function filterContent(text: string, level: ContentFilterLevel): string {
  if (level === 'none' || !text) return text
  const terms = [...PROFANITY].sort((a, b) => b.length - a.length)
  const expression = new RegExp(`\\b(${terms.map(term => term.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')).join('|')})\\b`, 'gi')
  return text.replace(expression, match => maskWord(match, level))
}

export function contentFilterExample(level: ContentFilterLevel): string {
  if (level === 'none') return 'Badword'
  if (level === 'low') return 'B*dword'
  if (level === 'medium') return 'B**w***'
  return '********'
}


const USERNAME_BLOCKLIST = [
  ...PROFANITY,
  'admin', 'administrator', 'moderator', 'support', 'staff', 'founder',
  'spacesadmin', 'spacessupport', 'spacesstaff',
]

export function validateUsername(value: string): { ok: true; username: string } | { ok: false; message: string } {
  const username = value.trim().toLowerCase()
  if (username.length < 4) return { ok: false, message: 'Username must be at least 4 characters.' }
  if (username.length > 24) return { ok: false, message: 'Username must be 24 characters or fewer.' }
  if (!/^[a-z0-9_]+$/.test(username)) return { ok: false, message: 'Use lowercase letters, numbers or underscores only.' }
  if (/^_|_$/.test(username) || /__/.test(username)) return { ok: false, message: 'Underscores cannot start, end or repeat.' }
  const compact = username.replace(/_/g, '')
  if (USERNAME_BLOCKLIST.some(term => compact.includes(term.replace(/[^a-z0-9]/g, '')))) return { ok: false, message: 'Choose a different username.' }
  return { ok: true, username }
}
