import { useEffect,useState } from 'react'
import { useSpaces } from '../../../state/SpacesContext'
import { Icon } from '../../../components/Icon'

type Item={id:string;spaceId:string;spaceName:string;ownerName:string;ownerUsername:string;ownerId:string;program:'verified'|'partner';statement:string;publicLink:string;status:string;reviewerNote:string;contactEmail:string|null;createdAt:number}
type Data={applications:Item[];canViewVerifiedEmails:boolean}
export function ProgramReviewsV90(){
 const {apiUrl,session,pushToast}=useSpaces()
 const [data,setData]=useState<Data>({applications:[],canViewVerifiedEmails:false})
 const [filter,setFilter]=useState<'pending'|'all'>('pending')
 const [loading,setLoading]=useState(false)
 const [busy,setBusy]=useState('')
 const [notes,setNotes]=useState<Record<string,string>>({})
 async function api<T>(path:string,init?:RequestInit):Promise<T>{
   const res=await fetch(`${apiUrl}/v1/support/program-applications${path}`,{
      ...init,cache:'no-store',headers:{Authorization:`Bearer ${session?.token||''}`,...(init?.body?{'Content-Type':'application/json'}:{})}
   })
   const value=await res.json().catch(()=>({})) as T & {error?:string};if(!res.ok)throw Error(value.error||`Review request failed (${res.status})`);return value
 }
 async function load(){setLoading(true);try{setData(await api<Data>(`?status=${filter}`))}catch(e){pushToast(e instanceof Error?e.message:'Could not load applications.','danger')}finally{setLoading(false)}}
 useEffect(()=>{if(session?.token)void load()
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[session?.token,filter,apiUrl])
 async function decision(item:Item,status:'approved'|'rejected'){
   setBusy(item.id)
   try{await api(`/${encodeURIComponent(item.id)}`,{method:'PATCH',body:JSON.stringify({status,note:notes[item.id]||''})});await load();pushToast(`${item.spaceName}: ${status}.`,'success')}
   catch(e){pushToast(e instanceof Error?e.message:'Could not save decision.','danger')}
   finally{setBusy('')}
 }
 return <section className="program-reviews-v90" aria-label="Verification and partner applications">
  <header><div><span className="eyebrow">RECOGNITION REVIEW</span><h2>Verified & Partner Applications</h2><p>Only Founder and authorized Staff can review. Owner contact emails are restricted to Partner applications with verified-email permission.</p></div>
   <label>Show <select value={filter} onChange={e=>setFilter(e.target.value as 'pending'|'all')}><option value="pending">Pending</option><option value="all">All applications</option></select></label>
   <button className="secondary-button compact" onClick={()=>void load()}><Icon name="refresh" size={14}/> Refresh</button></header>
  {loading&&<p>Loading applications…</p>}
  <div className="program-review-list-v90">{!data.applications.length&&!loading&&<div className="mini-empty"><Icon name="check"/><strong>Queue is clear</strong></div>}
   {data.applications.map(item=><article key={item.id}>
     <div className="program-review-head-v90"><strong>{item.spaceName}</strong><span>{item.program==='partner'?'Partner':'Verified'} · {item.status}</span></div>
     <small>Owner: {item.ownerName} (@{item.ownerUsername}) · {new Date(item.createdAt).toLocaleDateString()}</small>
     <p className="program-review-statement-v90">{item.statement}</p>
     {item.publicLink&&<a href={item.publicLink} target="_blank" rel="noopener noreferrer">View applicant's reference <Icon name="globe" size={12}/></a>}
     {item.program==='partner'&&<div className="program-review-email-v90"><Icon name="lock" size={13}/>{item.contactEmail?<a href={`mailto:${item.contactEmail}`}>{item.contactEmail}</a>:<span>{data.canViewVerifiedEmails?'No verified signup email available':'Verified email permission required'}</span>}</div>}
     {item.status==='pending'&&<><label className="field-label">Decision note (shared with applicant)<textarea maxLength={750} rows={2} value={notes[item.id]||''} onChange={e=>setNotes(n=>({...n,[item.id]:e.target.value}))}/></label>
      <div className="program-review-actions-v90"><button className="primary-button compact" disabled={Boolean(busy)} onClick={()=>void decision(item,'approved')}>Approve</button><button className="secondary-button compact" disabled={Boolean(busy)} onClick={()=>void decision(item,'rejected')}>Reject</button></div></>}
     {item.status!=='pending'&&item.reviewerNote&&<p>Decision note: {item.reviewerNote}</p>}
   </article>)}
  </div>
 </section>
}
