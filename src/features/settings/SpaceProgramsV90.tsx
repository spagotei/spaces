import { useEffect, useState } from 'react'
import { useSpaces } from '../../state/SpacesContext'
import { Icon } from '../../components/Icon'

type Program = 'verified' | 'partner'
type Application = { id: string; program: Program; status: string; reviewerNote: string; createdAt: number }
type Result = { applications: Application[]; badges: {program:Program}[] }

/** Owner-only UX; Worker always verifies actual Space ownership. */
export function SpaceProgramsV90({spaceId,isOwner}:{spaceId:string;isOwner:boolean}){
 const {session,apiUrl,pushToast}=useSpaces()
 const [data,setData]=useState<Result>({applications:[],badges:[]})
 const [loading,setLoading]=useState(false)
 const [busy,setBusy]=useState(false)
 const [program,setProgram]=useState<Program>('verified')
 const [statement,setStatement]=useState('')
 const [publicLink,setPublicLink]=useState('')
 const [consent,setConsent]=useState(false)
 async function api<T>(init?:RequestInit):Promise<T>{
   const response=await fetch(`${apiUrl}/v1/workspaces/${encodeURIComponent(spaceId)}/program-applications`,{
     ...init,cache:'no-store',headers:{Authorization:`Bearer ${session?.token||''}`,...(init?.body?{'Content-Type':'application/json'}:{})}
   })
   const body=await response.json().catch(()=>({})) as T & {error?:string}
   if(!response.ok)throw Error(body.error||`Application request failed (${response.status})`)
   return body
 }
 useEffect(()=>{
   if(!isOwner||!session?.token)return
   let live=true;setLoading(true)
   void api<Result>().then(next=>{if(live)setData(next)}).catch(error=>{if(live)pushToast(error instanceof Error?error.message:'Could not load program status.','danger')}).finally(()=>{if(live)setLoading(false)})
   return()=>{live=false}
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[spaceId,isOwner,session?.token,apiUrl])
 async function submit(){
  if(!isOwner||busy||!consent)return;setBusy(true)
  try{
   await api({method:'POST',body:JSON.stringify({program,statement,publicLink,contactConsent:consent})})
   setStatement('');setPublicLink('');setConsent(false);setData(await api<Result>());pushToast(`${program==='partner'?'Partner':'Verification'} application sent for review.`,'success')
  }catch(error){pushToast(error instanceof Error?error.message:'Application could not be submitted.','danger')}
  finally{setBusy(false)}
 }
 if(!isOwner)return <section className="space-settings-v32-card programs-v90"><h2>Verification & Partners</h2><p>Only the owner of this Space can submit an application.</p></section>
 const pending=data.applications.some(item=>item.program===program&&item.status==='pending')
 return <section className="space-settings-v32-card programs-v90" aria-label="Space verification and partner applications">
  <header><span className="eyebrow">SPACES RECOGNITION</span><h2>Verification & Partner Program</h2><p>Applications are reviewed by Spaces Staff. Neither badge grants moderation powers, account permissions, or guaranteed acceptance.</p></header>
  <div className="programs-v90-choice" role="group" aria-label="Application type">
   <button type="button" className={program==='verified'?'active':''} onClick={()=>setProgram('verified')}><Icon name="check" size={15}/> Verified Space</button>
   <button type="button" className={program==='partner'?'active':''} onClick={()=>setProgram('partner')}><Icon name="sparkle" size={15}/> Partner Program</button>
  </div>
  {loading&&<p>Checking applications…</p>}
  {data.badges.some(x=>x.program===program)&&<p className="program-v90-status">Approved: this Space has the {program} recognition record.</p>}
  {pending&&<p className="program-v90-status">An application is pending review. You'll see a decision here once Staff reviews it.</p>}
  <label className="field-label">Why should this Space qualify?
   <textarea value={statement} maxLength={2500} rows={5} onChange={e=>setStatement(e.target.value)} placeholder="Describe your community, moderation team, activity, and original contributions." disabled={pending||busy}/>
  </label>
  <label className="field-label">Community website or reference (optional, HTTPS)
   <input value={publicLink} maxLength={350} onChange={e=>setPublicLink(e.target.value)} placeholder="https://example.com" disabled={pending||busy}/>
  </label>
  <label className="program-v90-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} disabled={pending||busy}/>
   <span>I understand Spaces Staff will review this application. For Partner applications, authorized reviewers may view my verified signup email to contact me about a decision. This email is not displayed publicly.</span>
  </label>
  <button type="button" className="primary-button" onClick={()=>void submit()} disabled={pending||busy||!consent||statement.trim().length<20}>{busy?'Submitting…':'Submit application'}</button>
  <div className="program-v90-history"><strong>Previous applications</strong>{data.applications.length===0?<p>None yet.</p>:data.applications.map(item=><article key={item.id}><b>{item.program==='partner'?'Partner':'Verified'}</b><span>{item.status}</span><small>{new Date(item.createdAt).toLocaleDateString()}</small>{item.reviewerNote&&<p>{item.reviewerNote}</p>}</article>)}</div>
 </section>
}
