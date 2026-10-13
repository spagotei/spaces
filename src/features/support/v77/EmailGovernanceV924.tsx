import { useCallback, useEffect, useRef, useState } from 'react'
import { useSpaces } from '../../../state/SpacesContext'
import './email-governance-v924.css'

type Cap = { founder:boolean;canView:boolean;canCompose:boolean;canSend:boolean;canGlobalUpdates:boolean;canGlobalCritical:boolean;canManage:boolean;externalBatchLimit:number }
type Grant = { user_id:string;display_name:string;platform_role:string;can_view:number;can_compose:number;can_send:number;can_global_updates:number }
type Campaign = {id:string;status:string;total:number;queued:number;sending:number;sent:number;failed:number;skipped:number;category:string;subject:string}
const EMAIL_CATEGORIES = {updates:{label:'Spaces — Updates',sender:'hello',subject:'Spaces — Product update',heading:'An update from Spaces'},service:{label:'Spaces — Service Notice',sender:'hello',subject:'Important Spaces service notice',heading:'Spaces service notice'},critical:{label:'Critical service notice',sender:'security',subject:'Important information about Spaces',heading:'Important Spaces notice'}} as const
export function EmailGovernanceV924({cap}:{cap:Cap}) {
 const {apiUrl,session}=useSpaces()
 const [page,setPage]=useState<'global'|'permissions'>('global')
 const [category,setCategory]=useState<'updates'|'service'|'critical'>('updates')
 const [subject,setSubject]=useState<string>(EMAIL_CATEGORIES.updates.subject)
 const [heading,setHeading]=useState<string>(EMAIL_CATEGORIES.updates.heading)
 const [body,setBody]=useState('')
 const [reason,setReason]=useState('')
 const [counts,setCounts]=useState<Record<string,number|null>>({})
 const [campaign,setCampaign]=useState<Campaign|null>(null)
 const [recent,setRecent]=useState<{id:string;category:string;subject:string;status:string;total:number}[]>([])
 const [working,setWorking]=useState(false)
 const [notice,setNotice]=useState('')
 const stopped=useRef(false)
 const createSendId=useRef(crypto.randomUUID())
 const [grants,setGrants]=useState<Grant[]>([])
 const [staffId,setStaffId]=useState('')
 const [rights,setRights]=useState({view:true,compose:false,send:false,globalUpdates:false})
 const [permissionsBusy,setPermissionsBusy]=useState(false)
 const call=useCallback(async <T,>(url:string,init:RequestInit={}):Promise<T>=>{
  if(!session?.token)throw Error('Sign in again.')
  const response=await fetch(`${apiUrl}${url}`,{...init,cache:'no-store',headers:{Authorization:`Bearer ${session.token}`,'Content-Type':'application/json',...init.headers}})
  const data=await response.json().catch(()=>({})) as T&{error?:string}
  if(!response.ok)throw Error(data.error||`Request failed (${response.status})`)
  return data
 },[apiUrl,session?.token])
 const loadRecent=useCallback(async()=>{
  try{const result=await call<{campaigns:typeof recent}>('/v1/staff/email/v924/campaigns');setRecent(result.campaigns)}catch{/* optional history */}
 },[call])
 const refresh=useCallback(async()=>{
  try{const data=await call<{audiences:{category:string;count:number|null}[]}>('/v1/staff/email/v924/global-preview');setCounts(Object.fromEntries(data.audiences.map(x=>[x.category,x.count])))}catch(e){setNotice(e instanceof Error?e.message:'Audience unavailable')}
 },[call])
 const refreshGrants=useCallback(async()=>{
  if(!cap.canManage)return
  try{const data=await call<{grants:Grant[]}>('/v1/staff/email/v924/grants');setGrants(data.grants)}catch(e){setNotice(e instanceof Error?e.message:'Permissions unavailable')}
 },[call,cap.canManage])
 useEffect(()=>{void refresh();void loadRecent()},[refresh,loadRecent])
 useEffect(()=>{if(page==='permissions')void refreshGrants()},[page,refreshGrants])
 const chooseCategory=(value:'updates'|'service'|'critical')=>{setCategory(value);setSubject(EMAIL_CATEGORIES[value].subject);setHeading(EMAIL_CATEGORIES[value].heading);setCampaign(null);setNotice('')}
 const updateStatus=async(id:string)=>{
  const data=await call<{campaign:Campaign}>(`/v1/staff/email/v924/campaigns/${id}`);setCampaign(data.campaign);return data.campaign
 }
 const create=async()=>{
  if(!subject.trim()||body.trim().length<3||reason.trim().length<15){setNotice('Add the subject, message, and reason for this announcement.');return}
  const count=counts[category];if(!count){setNotice('No eligible subscribers or verified accounts for this category.');return}
  setWorking(true);setNotice('Creating audited campaign…')
  try{
   const info=await call<{id:string}>('/v1/staff/email/v924/campaigns',{method:'POST',body:JSON.stringify({category,sender:EMAIL_CATEGORIES[category].sender,subject,heading,body,reason,sendId:createSendId.current,confirmedCount:count})})
   await updateStatus(info.id);await loadRecent()
   setNotice('Campaign created. Select Start sending to deliver recorded batches.')
  }catch(e){setNotice(e instanceof Error?e.message:'Could not create campaign')}finally{setWorking(false)}
 }
 const start=async()=>{
  if(!campaign||working)return
  stopped.current=false;setWorking(true);setNotice('Processing recipients…')
  try{
   let latest=campaign
   while(!stopped.current&&latest.queued>0){
    const next=await call<{campaign:Campaign}>(`/v1/staff/email/v924/campaigns/${latest.id}/process`,{method:'POST'})
    latest=next.campaign;setCampaign(latest)
    if(latest.status==='completed')break
   }
   setNotice(stopped.current?'Paused; you can resume later.':latest.queued===0?'Campaign processing completed. Review sent and failed counts.':'Campaign paused.')
  }catch(e){setNotice((e instanceof Error?e.message:'Batch failed')+' You can return to this campaign and resume after the limit resets.')}
  finally{setWorking(false)}
 }
 const resume=async()=>{
  if(!campaign)return
  try{await updateStatus(campaign.id)}catch(e){setNotice(e instanceof Error?e.message:'Refresh failed')}
 }
 const saveGrant=async()=>{
  setPermissionsBusy(true);setNotice('')
  try{await call('/v1/staff/email/v924/grants',{method:'PUT',body:JSON.stringify({userId:staffId,...rights})});setNotice('Permissions saved.');await refreshGrants()}
  catch(e){setNotice(e instanceof Error?e.message:'Could not save permissions')}
  finally{setPermissionsBusy(false)}
 }
 return <section className="v924-main">
  <div className="v924-switch">
   <button className={page==='global'?'active':''} onClick={()=>setPage('global')}>Global Email</button>
   {cap.canManage&&<button className={page==='permissions'?'active':''} onClick={()=>setPage('permissions')}>Founder Permissions</button>}
  </div>
  {page==='permissions'&&cap.canManage?<div className="v924-glass v924-permissions">
   <h3>Staff email permissions</h3>
   <p>Founder-controlled. These grants affect Email Operations, not Space membership or ticket moderation.</p>
   <label>Platform Staff account ID<input value={staffId} onChange={e=>setStaffId(e.target.value)} placeholder="Existing platform Staff user ID"/></label>
   <div className="v924-toggles">{([
    ['view','View Email'],['compose','Compose & preview'],['send','Send individual emails'],['globalUpdates','Send subscribed Updates']
   ] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={rights[key]} onChange={e=>setRights(current=>({...current,[key]:e.target.checked}))}/>{label}</label>)}</div>
   <button onClick={()=>void saveGrant()} disabled={permissionsBusy||!staffId.trim()}>Save permissions</button>
   <h4>Assigned permissions</h4>
   <div className="v924-grants">{grants.map(g=><button key={g.user_id} onClick={()=>{setStaffId(g.user_id);setRights({view:!!g.can_view,compose:!!g.can_compose,send:!!g.can_send,globalUpdates:!!g.can_global_updates})}}><strong>{g.display_name}</strong><span>{g.user_id}</span><small>{[g.can_view&&'View',g.can_compose&&'Compose',g.can_send&&'Send',g.can_global_updates&&'Updates'].filter(Boolean).join(' · ')||'No access'}</small></button>)}</div>
  </div>:<div className="v924-grid">
   <div className="v924-glass v924-editor">
    <h3>Global announcements</h3>
    <label>Category<select value={category} onChange={e=>chooseCategory(e.target.value as 'updates'|'service'|'critical')}>
     <option value="updates">Spaces — Updates (subscribers only)</option>
     {cap.founder&&<option value="service">Service / Global notice (Founder)</option>}
     {cap.canGlobalCritical&&<option value="critical">Critical service notice (Founder)</option>}
    </select></label>
    <div className="v924-stats"><strong>{counts[category]===undefined?'—':counts[category]?.toLocaleString()??'—'}</strong><span>{category==='updates'?'subscribed verified recipients':'verified account recipients'}</span><button onClick={()=>void refresh()}>Refresh count</button></div>
    <label>From<input readOnly value={`${EMAIL_CATEGORIES[category].sender}@yourspaces.net`}/></label>
    <label>Subject<input value={subject} onChange={e=>setSubject(e.target.value)} maxLength={180}/></label>
    <label>Heading<input value={heading} onChange={e=>setHeading(e.target.value)} maxLength={120}/></label>
    <label>Message<textarea rows={10} value={body} onChange={e=>setBody(e.target.value)} maxLength={8000}/></label>
    <label>Reason for sending<textarea rows={3} value={reason} onChange={e=>setReason(e.target.value)} maxLength={600}/></label>
    {!campaign&&<button className="v924-primary" onClick={()=>void create()} disabled={working||!counts[category]}>Create campaign</button>}
   </div>
   <div className="v924-glass v924-progress">
    <h3>Delivery</h3>
    <p>{category==='updates'?'Updates have an unsubscribe link and reach opted-in accounts.':category==='service'?'Service notices are for material operational updates, not promotions.':'Critical is for necessary security, safety, or account-impacting information.'}</p>
    {campaign?<>
     <strong>{campaign.sent} / {campaign.total} accepted</strong>
     <progress value={campaign.sent+campaign.failed+campaign.skipped} max={Math.max(1,campaign.total)}/>
     <div className="v924-totals"><span>Queued: {campaign.queued}</span><span>Sent: {campaign.sent}</span><span>Failed: {campaign.failed}</span><span>Skipped: {campaign.skipped}</span><span>Unknown: {campaign.sending}</span></div>
     <div className="v924-actions"><button className="v924-primary" disabled={working||campaign.queued===0} onClick={()=>void start()}>{working?'Processing…':'Start / Resume sending'}</button>{working&&<button onClick={()=>{stopped.current=true}}>Pause</button>}<button onClick={()=>void resume()}>Refresh status</button></div>
     <small>Campaign ID: {campaign.id}</small>
    </>:<p>Review the eligible count and create the campaign first. Delivery happens in small server-checked batches and can be resumed.</p>}
    <h4>Recent campaigns</h4><div className="v924-grants">{recent.map(item=><button key={item.id} onClick={()=>{void updateStatus(item.id);setNotice('Resumed campaign status.')}}><strong>{item.subject}</strong><span>{item.category} · {item.status} · {item.total} recipients</span></button>)}</div>
   </div>
  </div>}
  {notice&&<p className="v924-notice" role="status">{notice}</p>}
 </section>
}

export function PersonalEmailPreferencesV924(){
 const {apiUrl,session}=useSpaces();const [opted,setOpted]=useState(false),[saving,setSaving]=useState(false),[ready,setReady]=useState(false),[status,setStatus]=useState('')
 useEffect(()=>{
  if(!session?.token)return
  let active=true
  void fetch(`${apiUrl}/v1/email/v924/preferences`,{headers:{Authorization:`Bearer ${session.token}`},cache:'no-store'})
   .then(async r=>{if(!r.ok)throw Error('Email preferences unavailable');return r.json()})
   .then(data=>{if(active){setOpted(data.updates===true);setReady(true)}})
   .catch(()=>{if(active)setStatus('Email preferences unavailable.')})
  return()=>{active=false}
 },[apiUrl,session?.token])
 async function update(value:boolean){if(!session?.token)return;setSaving(true);setStatus('');try{
  const r=await fetch(`${apiUrl}/v1/email/v924/preferences`,{method:'PATCH',headers:{Authorization:`Bearer ${session.token}`,'Content-Type':'application/json'},body:JSON.stringify({updates:value})});if(!r.ok)throw Error('Could not save.');setOpted(value);setStatus('Saved.')
 }catch(e){setStatus(e instanceof Error?e.message:'Could not save preferences.')}finally{setSaving(false)}}
 return <section className="v924-personal-preferences"><h3>Email preferences</h3><label><input type="checkbox" checked={opted} disabled={!ready||saving} onChange={e=>void update(e.target.checked)}/><span>Receive Spaces product updates</span></label><small>Necessary account and security messages are separate.</small>{status&&<small role="status">{status}</small>}</section>
}
