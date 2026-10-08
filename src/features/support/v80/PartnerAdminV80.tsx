import { useEffect, useState } from 'react'
type Application={spaceId:string;spaceName?:string;ownerId?:string;status?:string}
export function PartnerAdminV80(){
  const [visible,setVisible]=useState(false)
  const [canReview,setCanReview]=useState(false)
  const [open,setOpen]=useState(false)
  const [spaceId,setSpaceId]=useState('')
  const [ownerId,setOwnerId]=useState('')
  const [note,setNote]=useState('')
  const [pending,setPending]=useState<Application[]>([])
  const [status,setStatus]=useState('')
  useEffect(()=>{const refresh=()=>setVisible(Boolean(document.querySelector('.support-console-v77,[data-support-console],.support-console')));refresh();const observer=new MutationObserver(refresh);observer.observe(document.documentElement,{subtree:true,childList:true});return()=>observer.disconnect()},[])
  useEffect(()=>{
    if(!visible){setCanReview(false);return}
    let cancelled=false
    fetch('/v1/support/partners?status=pending',{credentials:'include',cache:'no-store',headers:{accept:'application/json'}})
      .then(async r=>{if(!r.ok||!(r.headers.get('content-type')||'').includes('application/json'))throw new Error('Unavailable');return r.json()})
      .then(v=>{if(cancelled)return;setCanReview(v?.canReview===true);setPending(v?.canReview===true&&Array.isArray(v?.applications)?v.applications:[])})
      .catch(()=>{if(!cancelled){setCanReview(false);setPending([])}})
    return()=>{cancelled=true}
  },[visible,open])
  if(!visible||!canReview)return null
  const approve=async()=>{
    if(!spaceId.trim()){setStatus('Enter a Space ID.');return}
    setStatus('Requesting approval…')
    try{
      const response=await fetch('/v1/support/partners',{method:'POST',credentials:'include',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({spaceId:spaceId.trim(),ownerId:ownerId.trim()||undefined,action:'approve',note:note.trim()||undefined})})
      if(!response.ok||!(response.headers.get('content-type')||'').includes('application/json'))throw new Error('Worker rejected the request')
      const result=await response.json()
      if(result?.approved!==true||result?.spaceId!==spaceId.trim())throw new Error(result?.error||'Worker did not confirm Partner approval')
      setStatus('Partner status confirmed by the Worker and queued for public badge projection.')
      setSpaceId('');setOwnerId('');setNote('')
      setOpen(false)
    }catch(e){setStatus(e instanceof Error?e.message:'Partner approval failed')}
  }
  return <>
    <button className='v80-partner-fab' onClick={()=>setOpen(v=>!v)}>◇ Partners</button>
    {open&&<section className='v80-partner-panel' role='dialog' aria-label='Partner Program admin'>
      <header><strong>Partner Program</strong><button onClick={()=>setOpen(false)} aria-label='Close'>×</button></header>
      <p className='v80-email-note'>The Worker checks your staff role, Space ownership and eligibility, writes authoritative Partner status, and audits approvals. The public badge is never a permission.</p>
      {pending.length>0&&<div className='v80-partner-pending'><b>Pending applications</b>{pending.slice(0,8).map((item,i)=><button key={item.spaceId||i} onClick={()=>{setSpaceId(item.spaceId);setOwnerId(item.ownerId||'')}}><span>{item.spaceName||item.spaceId}</span><small>{item.status||'pending'}</small></button>)}</div>}
      <label>Space ID<input value={spaceId} onChange={e=>setSpaceId(e.target.value)}/></label>
      <label>Owner ID (optional)<input value={ownerId} onChange={e=>setOwnerId(e.target.value)}/></label>
      <label>Review note<textarea value={note} onChange={e=>setNote(e.target.value)}/></label>
      <div className='v80-email-actions'><button className='primary' onClick={approve}>Approve Partner</button><a href='/partner/' target='_blank' rel='noreferrer'>Partner policy</a></div>
      <p className='v80-email-note' role='status'>{status}</p>
    </section>}
  </>
}
