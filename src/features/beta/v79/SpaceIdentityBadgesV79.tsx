import { useEffect, useMemo, useState, type ReactNode } from 'react'

// SPACES_V79_TRUST_BADGES
// Display metadata only. NEVER use these badges to authorize privileged actions.
type RegistryEntry = { classification?: string; verified?: boolean; featured?: boolean; beta?: boolean; staffOwned?: boolean; label?: string }
type Registry = { spaces?: Record<string, RegistryEntry> }
let registryCache: Registry | null = null
let registryPromise: Promise<Registry> | null = null

function loadRegistry(){
  if (registryCache) return Promise.resolve(registryCache)
  if (!registryPromise) registryPromise=fetch('/spaces-trust.json',{cache:'no-cache'}).then(r=>r.ok?r.json():{}).catch(()=>({})).then(value=>{registryCache=(value&&typeof value==='object'?value:{}) as Registry;return registryCache})
  return registryPromise
}
function record(value: unknown): Record<string, unknown> { return value && typeof value==='object' ? value as Record<string,unknown> : {} }
function truthy(obj:Record<string,unknown>,keys:string[]){return keys.some(key=>obj[key]===true||obj[key]===1||obj[key]==='1')}
function text(obj:Record<string,unknown>,keys:string[]){for(const key of keys){const value=obj[key];if(typeof value==='string'&&value.trim())return value.trim()}return ''}
function idOf(obj:Record<string,unknown>){return text(obj,['id','spaceId','space_id','serverId','server_id'])}

const icons={
  official:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 20 5v6c0 5.2-3.1 9.4-8 11-4.9-1.6-8-5.8-8-11V5l8-3Z"/><path d="m8.2 12 2.4 2.4 5.3-5.4"/></svg>,
  partner:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7.2 8.2 3-3a3 3 0 0 1 4.2 0l1.4 1.4"/><path d="m16.8 15.8-3 3a3 3 0 0 1-4.2 0l-1.4-1.4"/><path d="m8.8 14.8 6-6"/><path d="M4 9.5 2.5 8 5 5.5 6.5 7M20 14.5l1.5 1.5-2.5 2.5-1.5-1.5"/></svg>,
  community:<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2"/><path d="M3.5 19c.4-3.3 2.2-5 5.5-5s5.1 1.7 5.5 5M14 15c3.3-.8 5.4.5 6 3"/></svg>,
  verified:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 2.2 2 3-.1.8 2.9 2.5 1.7-1 2.8 1 2.8-2.5 1.7-.8 2.9-3-.1-2.2 2-2.2-2-3 .1-.8-2.9-2.5-1.7 1-2.8-1-2.8L6 6.8l.8-2.9 3 .1L12 2Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>,
  featured:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>,
  beta:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6M10 3v5l-5 9a2.5 2.5 0 0 0 2.2 4h9.6A2.5 2.5 0 0 0 19 17l-5-9V3"/><path d="M8 15h8"/></svg>,
  staff:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8 8 12l4-7 4 7 4-4-2 11H6L4 8Z"/></svg>,
}

export function SpaceIdentityBadgesV79({space,compact=false}:{space:unknown;compact?:boolean}){
  const object=record(space)
  const id=idOf(object)
  const [registry,setRegistry]=useState<Registry>(registryCache||{})
  useEffect(()=>{let live=true;loadRegistry().then(value=>{if(live)setRegistry(value)});return()=>{live=false}},[])
  const entry=id?registry.spaces?.[id]:undefined
  const state=useMemo(()=>{
    const classification=(entry?.classification||text(object,['classification','spaceClassification','space_classification','serverType','server_type','trustType','trust_type'])).toLowerCase()
    return {
      classification,
      verified:Boolean(entry?.verified)||truthy(object,['verified','isVerified','is_verified']),
      featured:Boolean(entry?.featured)||truthy(object,['featured','isFeatured','is_featured']),
      beta:Boolean(entry?.beta)||truthy(object,['beta','isBeta','is_beta']),
      staffOwned:Boolean(entry?.staffOwned)||truthy(object,['staffOwned','staff_owned','isStaffOwned','is_staff_owned']),
      label:entry?.label||'',
    }
  },[entry,object])
  const badges:{id:string;label:string;icon:ReactNode}[]=[]
  if(state.classification==='official')badges.push({id:'official',label:state.label||'Official Space',icon:icons.official})
  else if(state.classification==='partner')badges.push({id:'partner',label:state.label||'Spaces Partner',icon:icons.partner})
  else if(state.classification==='community')badges.push({id:'community',label:state.label||'Community Space',icon:icons.community})
  if(state.verified)badges.push({id:'verified',label:'Verified',icon:icons.verified})
  if(state.featured)badges.push({id:'featured',label:'Featured',icon:icons.featured})
  if(state.staffOwned)badges.push({id:'staff',label:'Staff-owned',icon:icons.staff})
  if(state.beta)badges.push({id:'beta',label:'Beta',icon:icons.beta})
  if(!badges.length)return null
  return <span className={'space-identity-badges-v79'+(compact?' compact':'')} aria-label={badges.map(x=>x.label).join(', ')}>{badges.map(badge=><span key={badge.id} className={'space-identity-badge-v79 '+badge.id} title={badge.label}>{badge.icon}{!compact&&<b>{badge.label}</b>}</span>)}</span>
}
