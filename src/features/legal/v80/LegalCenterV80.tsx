import { useEffect, useMemo, useState, type ReactNode } from 'react'

type Doc={slug:string;title:string;path:string}
const docs:Doc[]=[
  {slug:'terms',title:'Terms of Service',path:'/tos/'},
  {slug:'privacy',title:'Privacy Policy',path:'/tos/privacy/'},
  {slug:'community-guidelines',title:'Community Guidelines',path:'/tos/community-guidelines/'},
  {slug:'safety-and-enforcement',title:'Safety & Enforcement',path:'/tos/safety/'},
  {slug:'partner-program',title:'Partner Program',path:'/partner/'},
  {slug:'partner-code-of-conduct',title:'Partner Code of Conduct',path:'/partner/code-of-conduct/'},
  {slug:'copyright-and-ip',title:'Copyright & IP',path:'/tos/copyright/'},
  {slug:'cookie-policy',title:'Cookie Policy',path:'/tos/cookies/'},
  {slug:'beta-program',title:'Beta Program Terms',path:'/tos/beta/'},
  {slug:'contact',title:'Contact & Legal Requests',path:'/tos/contact/'}
]
const fallback:Record<string,string>=Object.fromEntries(docs.map(d=>[d.slug,'# '+d.title]))
function slugFromPath(){
  const current=window.location.pathname.replace(/\/+$/,'')+'/'
  return docs.find(d=>d.path===current)?.slug||'terms'
}
function inlineMarkdown(raw:string):ReactNode[]{
  return raw.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part,i)=>part.startsWith('**')&&part.endsWith('**')?<strong key={i}>{part.slice(2,-2)}</strong>:part)
}
function renderMarkdown(raw:string){
  return raw.split(/\n{2,}/).map((block,i)=>{
    const b=block.trim();if(!b)return null
    if(/^# /.test(b))return <h1 key={i}>{inlineMarkdown(b.slice(2))}</h1>
    if(/^## /.test(b))return <h2 key={i}>{inlineMarkdown(b.slice(3))}</h2>
    if(/^> /.test(b))return <blockquote key={i}>{inlineMarkdown(b.replace(/^> /gm,''))}</blockquote>
    if(/^[-*] /m.test(b))return <ul key={i}>{b.split('\n').filter(Boolean).map((line,j)=><li key={j}>{inlineMarkdown(line.replace(/^[-*] /,''))}</li>)}</ul>
    return <p key={i}>{inlineMarkdown(b)}</p>
  })
}
export function LegalCenterV80({children}:{children:ReactNode}){
  const [open,setOpen]=useState(false)
  const [slug,setSlug]=useState('terms')
  const [docsText,setDocsText]=useState('# Terms of Service')
  const active=useMemo(()=>docs.find(d=>d.slug===slug)||docs[0],[slug])
  useEffect(()=>{
    const handler=(e:Event)=>{const detail=(e as CustomEvent<{slug?:string}>).detail;setSlug(docs.some(d=>d.slug===detail?.slug)?detail.slug! :slugFromPath());setOpen(true)}
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)}
    window.addEventListener('spaces:open-legal',handler)
    window.addEventListener('keydown',onKey)
    if(/^\/(tos|partner)(\/|$)/.test(window.location.pathname)){setSlug(slugFromPath());setOpen(true)}
    return()=>{window.removeEventListener('spaces:open-legal',handler);window.removeEventListener('keydown',onKey)}
  },[])
  useEffect(()=>{
    if(!open)return
    let cancelled=false
    fetch('/legal/'+active.slug+'.md',{cache:'no-cache'})
      .then(r=>r.ok?r.text():Promise.reject())
      .then(text=>{if(!cancelled)setDocsText(text)})
      .catch(()=>{if(!cancelled)setDocsText(fallback[active.slug]||'# Legal Center')})
    return()=>{cancelled=true}
  },[open,active.slug])
  return <>{children}{open&&<div className='v80-legal-overlay' role='dialog' aria-modal='true' aria-label='Spaces Legal Center'>
    <div className='v80-legal-shell'>
      <nav className='v80-legal-nav' aria-label='Legal sections'><h2>Spaces Legal</h2><small>Policies & terms</small>
        {docs.map(d=><button key={d.slug} className={d.slug===active.slug?'active':''} aria-current={d.slug===active.slug?'page':undefined} onClick={()=>setSlug(d.slug)}>{d.title}</button>)}
      </nav>
      <main className='v80-legal-main'>
        <header className='v80-legal-head'><div><strong>{active.title}</strong><div style={{fontSize:10,color:'#77717f'}}>Draft for legal review · October 7, 2026</div></div><button onClick={()=>setOpen(false)} aria-label='Close Legal Center'>×</button></header>
        <article className='v80-legal-doc'>{renderMarkdown(docsText)}</article>
      </main>
    </div>
  </div>}</>
}
