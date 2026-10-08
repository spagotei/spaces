import { Fragment, type ReactNode } from 'react'

const toneClass = {
  R: 'support-token-red-v77',
  P: 'support-token-purple-v77',
  Y: 'support-token-yellow-v77',
  G: 'support-token-green-v77',
} as const

export function stripSupportFormattingV77(value: string) {
  return value.replace(/<\/?[RPYG]>/gu, '')
}

export function SupportFormattedTextV77({ text }: { text: string }) {
  const parts: ReactNode[] = []
  const pattern = /<([RPYG])>([\s\S]*?)<\/\1>/gu
  let cursor = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = pattern.exec(text))) {
    if (match.index > cursor) parts.push(<Fragment key={`plain-${key++}`}>{text.slice(cursor, match.index)}</Fragment>)
    const tone = match[1] as keyof typeof toneClass
    parts.push(<span key={`tone-${key++}`} className={toneClass[tone]}>{match[2]}</span>)
    cursor = match.index + match[0].length
  }
  if (cursor < text.length) parts.push(<Fragment key={`plain-${key++}`}>{text.slice(cursor)}</Fragment>)
  return <>{parts}</>
}
