import { useEffect,useState } from 'react'
import { useSpaces } from '../../state/SpacesContext'
import { Icon } from '../../components/Icon'

type Badge='verified'|'partner'
/** Server-side badge state; appearance only, never an authorization check. */
export function SpaceTrustBadgeV90({spaceId}:{spaceId:string}){
 const {apiUrl,session}=useSpaces()
 const [badges,setBadges]=useState<Badge[]>([])
 useEffect(()=>{
  let active=true
  setBadges([])
  if(!spaceId||!session?.token)return
  const sync=async()=>{
    try{
      const res=await fetch(`${apiUrl}/v1/workspaces/${encodeURIComponent(spaceId)}/program-badges`,{cache:'no-store',headers:{Authorization:`Bearer ${session.token}`}})
      if(!res.ok)return
      const data=await res.json() as {badges?:{program:string}[]}
      if(active)setBadges((data.badges??[]).map(x=>x.program).filter((p):p is Badge=>p==='partner'||p==='verified'))
    }catch{/* Offline, or Worker not updated yet: do not block navigation. */}
  }
  void sync();window.addEventListener('focus',sync)
  return()=>{active=false;window.removeEventListener('focus',sync)}
 },[apiUrl,spaceId,session?.token])
 if(!badges.length)return null
 return <span className="space-trust-v90" aria-label={`Space recognition: ${badges.join(', ')}`}>
  {badges.includes('verified')&&<span title="Verified by Spaces"><Icon name="check" size={11}/> Verified</span>}
  {badges.includes('partner')&&<span title="Spaces Partner"><Icon name="sparkle" size={11}/> Partner</span>}
 </span>
}
