import { useEffect, useState } from 'react'
import { useSpaces } from '../../../state/SpacesContext'

export type SpacesDmEventV85 = {
  callId: string
  kind: 'missed' | 'declined' | 'ended'
  direction: 'incoming' | 'outgoing'
  durationSeconds: number
  createdAt: number
}
/** Fetches account-bound, authenticated history only while a DM thread is visible. */
export function useSpacesDmEventsV85(conversationId: string) {
  const {apiUrl,session} = useSpaces()
  const [items,setItems] = useState<SpacesDmEventV85[]>([])
  const token = session?.token ?? ''
  useEffect(() => {
    setItems([])
    if (!token || !conversationId) return
    let cancelled=false
    let busy=false
    const refresh=async () => {
      if(cancelled || busy || document.hidden)return
      busy=true
      try {
        const res=await fetch(`${apiUrl}/v1/voice/v85/events?conversationId=${encodeURIComponent(conversationId)}`,{
          cache:'no-store',headers:{Authorization:`Bearer ${token}`},credentials:'omit'
        })
        if(!res.ok)return
        const result=await res.json() as {events?:SpacesDmEventV85[]}
        if(!cancelled)setItems(Array.isArray(result.events)?result.events:[])
      }catch{ /* Offline or older worker: chat remains available. */ }
      finally{busy=false}
    }
    void refresh()
    const onFocus=()=>void refresh()
    window.addEventListener('focus',onFocus)
    window.addEventListener('spaces-v85-call-history-changed',onFocus)
    const interval=window.setInterval(()=>void refresh(),12000)
    return ()=>{cancelled=true;window.clearInterval(interval);window.removeEventListener('focus',onFocus);window.removeEventListener('spaces-v85-call-history-changed',onFocus)}
  },[apiUrl,token,conversationId])
  return items
}
