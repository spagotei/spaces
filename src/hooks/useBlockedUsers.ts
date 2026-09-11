import { useEffect, useState } from 'react'
import { listBlockedUsers } from '../api/social-api'

export function useBlockedUserIds(token: string | undefined) {
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!token) {
        setBlockedUserIds([])
        return
      }
      try {
        const rows = await listBlockedUsers(token)
        if (!cancelled) setBlockedUserIds(rows.map(row => row.id))
      } catch {
        if (!cancelled) setBlockedUserIds([])
      }
    }

    void load()
    const refresh = () => void load()
    window.addEventListener('spaces-blocks-changed', refresh)
    return () => {
      cancelled = true
      window.removeEventListener('spaces-blocks-changed', refresh)
    }
  }, [token])

  return blockedUserIds
}
