import { useEffect, useMemo, useState } from 'react'

type Template = { id:string; name:string; from:string; subject:string; preheader:string; body:string }
type PresetImage = { id:string; name:string; url:string; placement?:'hero'|'footer'|'both' }
type Capabilities = { canSend?:boolean; senderNames?:Record<string,string> }
type Config = { sendEndpoint?:string; logoUrl?:string; defaultHeroImageUrl?:string; footerImageUrl?:string; presetImages?:PresetImage[]; replyTo?:string }
const escapeHtml = (value:string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as Record<string,string>)[c])
const allowedImage = (raw:string) => { try { if (!raw.trim()) return ''; const url = new URL(raw, window.location.origin); return url.protocol==='https:' || (url.protocol==='http:' && url.hostname==='localhost') ? url.href : '' } catch { return '' } }
const interpolate = (value:string, vars:Record<string,string>) => value.replace(/\{\{([^}]+)\}\}/g, (_,key:string) => vars[key.trim()] ?? '')
const previewHtml = (value:string, vars:Record<string,string>) => escapeHtml(interpolate(value,vars)).replace(/\n/g,'<br>')
const safeEndpoint = (value:string|undefined) => value?.startsWith('/') && !value.startsWith('//') ? value : '/v1/support/email'

export function SupportEmailCenterV80(){
  const [visible,setVisible] = useState(false)
  const [open,setOpen] = useState(false)
  const [templates,setTemplates] = useState<Template[]>([])
  const [config,setConfig] = useState<Config>({})
  const [caps,setCaps] = useState<Capabilities|null>(null)
  const [selected,setSelected] = useState('ticket-reply')
  const [userId,setUserId] = useState('')
  const [ticketId,setTicketId] = useState('')
  const [displayName,setDisplayName] = useState('User')
  const [reply,setReply] = useState('Thanks for reaching out. We reviewed your request and have an update for you.')
  const [reason,setReason] = useState('Resolved')
  const [spaceName,setSpaceName] = useState('Your Space')
  const [hero,setHero] = useState('')
  const [footer,setFooter] = useState('')
  const [status,setStatus] = useState('')
  useEffect(()=>{
    const refresh=()=>setVisible(Boolean(document.querySelector('.support-console-v77,[data-support-console],.support-console')))
    refresh()
    const observer=new MutationObserver(refresh)
    observer.observe(document.documentElement,{subtree:true,childList:true})
    return()=>observer.disconnect()
  },[])
  useEffect(()=>{
    if(!visible)return
    let cancelled=false
    Promise.all([
      fetch('/support-email-templates.json',{cache:'no-cache'}).then(r=>r.ok?r.json():Promise.reject()).catch(()=>({templates:[]})),
      fetch('/support-email-config.json',{cache:'no-cache'}).then(r=>r.ok?r.json():Promise.reject()).catch(()=>({}))
    ]).then(([t,c])=>{if(cancelled)return;setTemplates(Array.isArray(t.templates)?t.templates:[]);setConfig(c);setHero(c.defaultHeroImageUrl||'');setFooter(c.footerImageUrl||'')})
    return()=>{cancelled=true}
  },[visible])
  useEffect(()=>{
    if(!visible)return
    let cancelled=false
    const endpoint=safeEndpoint(config.sendEndpoint)
    fetch(endpoint+'/capabilities',{credentials:'include',cache:'no-store',headers:{accept:'application/json'}})
      .then(async r=>{if(!r.ok||!(r.headers.get('content-type')||'').includes('application/json'))throw new Error('Not connected');return r.json()})
      .then(v=>{if(!cancelled)setCaps(v?.canSend===true?{canSend:true,senderNames:v.senderNames}:{canSend:false})})
      .catch(()=>{if(!cancelled)setCaps({canSend:false})})
    return()=>{cancelled=true}
  },[visible,config.sendEndpoint])
  const tpl=templates.find(x=>x.id===selected)||templates[0]
  const vars=useMemo(()=>({
    'user.displayName':displayName,'ticket.id':ticketId||'TICKET-ID','ticket.reply':reply,
    'ticket.category':'Support','ticket.closeReason':reason,'space.name':spaceName,
    'case.id':ticketId||'CASE-ID','action.reason':reason,'action.type':'Account review',
    'action.duration':'See your account notice','event':'Security event','time':new Date().toLocaleString(),
    'context':'Spaces','security.context':'Spaces','security.event':'Security event','security.time':new Date().toLocaleString(),'support.url':'https://yourspaces.net/support','partner.issue':reason,'partner.action':'Review your Space','partner.deadline':'See program notice',
    'partner.reason':reason,'application.id':ticketId||'APPLICATION-ID',
    'security.url':'https://yourspaces.net/security','partner.codeUrl':'https://yourspaces.net/partner/code-of-conduct/',
    'partner.policyUrl':'https://yourspaces.net/partner/','beta.url':'https://yourspaces.net/beta',
    'beta.termsUrl':'https://yourspaces.net/tos/beta/'
  }),[displayName,ticketId,reply,reason,spaceName])
  const imageHero=allowedImage(hero),imageFooter=allowedImage(footer)
  const html=useMemo(()=>{
    if(!tpl)return ''
    const img=(src:string,alt:string)=>src?'<img src="'+escapeHtml(src)+'" alt="'+alt+'" style="display:block;max-width:100%;height:auto;margin:16px auto 22px;"/>':''
    return '<!doctype html><html><body style="margin:0;background:#f4f2f7;font:15px/1.65 Arial,sans-serif;color:#18151d"><div style="max-width:680px;margin:28px auto;background:white;border-radius:14px;overflow:hidden;border:1px solid #e6e1ea"><div style="padding:22px 24px;background:#15121c;color:white;font-size:20px;font-weight:800">SPACES</div><div style="padding:24px">'+img(imageHero,'Spaces announcement')+'<div>'+previewHtml(tpl.body,vars)+'</div>'+img(imageFooter,'')+'<div style="border-top:1px solid #eee;margin-top:26px;padding-top:16px;color:#777;font-size:12px">Spaces Support · '+escapeHtml(config.replyTo||'Contact us through in-app Support')+'</div></div></div></body></html>'
  },[tpl,vars,imageHero,imageFooter,config.replyTo])
  if(!visible||!templates.length)return null
  const send=async()=>{
    if(!caps?.canSend){setStatus('Sending is disabled until the Worker confirms your staff permissions and email capability.');return}
    if(!userId.trim()&&!ticketId.trim()){setStatus('Enter a ticket ID or a recipient user ID. The server resolves the email address.');return}
    if((hero.trim()&&!imageHero)||(footer.trim()&&!imageFooter)){setStatus('Image URLs must be HTTPS or localhost development URLs.');return}
    if(!tpl)return
    setStatus('Sending…')
    try{
      const response=await fetch(safeEndpoint(config.sendEndpoint),{
        method:'POST',credentials:'include',headers:{'content-type':'application/json',accept:'application/json'},
        body:JSON.stringify({templateId:tpl.id,userId:userId.trim()||undefined,ticketId:ticketId.trim()||undefined,variables:vars,image:{heroUrl:imageHero,footerUrl:imageFooter},source:'support-console-v80'})
      })
      if(!response.ok||!(response.headers.get('content-type')||'').includes('application/json'))throw new Error('The Worker did not confirm delivery.')
      const result=await response.json()
      if(result?.sent!==true)throw new Error(result?.error||'Delivery was not confirmed.')
      setStatus('Email accepted by the Worker. Delivery ID: '+String(result.deliveryId||'recorded'))
    }catch(e){setStatus(e instanceof Error?e.message:'Could not send email.')}
  }
  const presets=config.presetImages||[]
  return <>
    <button className='v80-email-fab' data-open-spaces-email-center onClick={()=>setOpen(v=>!v)}>✉ Email Center</button>
    {open&&<section className='v80-email-panel' role='dialog' aria-label='Support Email Center'>
      <header><strong>Support Email Center</strong><button onClick={()=>setOpen(false)} aria-label='Close'>×</button></header>
      <p className='v80-email-note'>Preview and copy templates. Sending requires the Worker to authorize staff, resolve the recipient, enforce sender identities, rate-limit, and audit every email.</p>
      <p className='v80-email-note' role='status'>{caps?.canSend?'Server-authorized sending available':'Preview only · email API or staff permission not verified'}</p>
      <label>Template<select value={selected} onChange={e=>setSelected(e.target.value)}>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <div className='v80-email-two'><label>Recipient user ID<input value={userId} onChange={e=>setUserId(e.target.value)} placeholder='Spaces user ID'/></label><label>Ticket ID<input value={ticketId} onChange={e=>setTicketId(e.target.value)} placeholder='Ticket or case ID'/></label></div>
      <label>Display name<input value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label>
      <label>Reply / message<textarea value={reply} onChange={e=>setReply(e.target.value)}/></label>
      <div className='v80-email-two'><label>Reason<input value={reason} onChange={e=>setReason(e.target.value)}/></label><label>Space name<input value={spaceName} onChange={e=>setSpaceName(e.target.value)}/></label></div>
      <label>Preset image<select defaultValue='' onChange={e=>{const p=presets.find(x=>x.id===e.target.value);if(p){if(p.placement==='footer')setFooter(p.url);else if(p.placement==='both'){setHero(p.url);setFooter(p.url)}else setHero(p.url)}}}><option value=''>Select an image</option>{presets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <div className='v80-email-two'><label>Hero image URL<input value={hero} onChange={e=>setHero(e.target.value)} placeholder='https://.../hero.png'/></label><label>Footer image URL<input value={footer} onChange={e=>setFooter(e.target.value)} placeholder='https://.../footer.png'/></label></div>
      <iframe className='v80-email-preview' title='Email preview' sandbox='' srcDoc={html}/>
      <div className='v80-email-actions'><button className='primary' disabled={!caps?.canSend} onClick={send}>Send via Spaces</button><button onClick={()=>navigator.clipboard?.writeText(html)}>Copy HTML</button><button onClick={()=>tpl&&navigator.clipboard?.writeText(interpolate(tpl.body,vars))}>Copy text</button></div>
      <p className='v80-email-note' role='status'>{status}</p>
    </section>}
  </>
}
