import { useEffect, useRef, useState } from 'react'
import { useSpaces } from '../../../state/SpacesContext'
import { usePreferences } from '../../../state/PreferencesContext'
import { SupportEmailStudioV84 } from './SupportEmailStudioV84'
import './staff-center-v84-2.css'

type Mail = { id: string; from: string; fromName: string; to: string; subject: string; receivedAt: number; attachmentCount: number; truncated: boolean }
type Detail = Mail & { text: string; headerFrom: string; matchedAccount: { username: string; email: string } | null }
type Delivery = { id: string; from: string; to: string; subject: string; status: string; createdAt: number; recipientUsername: string; staffUsername: string }
type Account = { id: string; publicUserId: string; username: string; displayName: string; email: string | null; verified: boolean; platformRole: string | null }
type Section = 'inbox' | 'sent' | 'members' | 'compose'
type Inbox = { messages: Mail[]; nextCursor: string | null; lastReceivedAt: number | null }

// SPACES_V84_3_STAFF_CENTER_UI: a new session gets an empty private subtree.
export function StaffSupportCenterV84_2() {
  const { apiUrl, session, profile } = useSpaces()
  const { preferences } = usePreferences()
  const [deniedToken,setDeniedToken] = useState<string | null>(null)
  const authorized = Boolean(session?.token && ['founder','staff'].includes(profile?.platformRole ?? ''))
  if (!authorized || !preferences.developerMode) return <main className="spaces-v842-staff-shell"><a href="?">← Back to Spaces</a><h1>{authorized ? 'Enable Developer Mode' : 'Staff access required'}</h1><p>{authorized ? 'Open Settings and enable Developer Mode to use the Support Center.' : 'Sign in with a Spaces Founder or platform Staff account.'}</p></main>
  if(session?.token===deniedToken)return <main className="spaces-v842-staff-shell"><a href="?">← Back to Spaces</a><h1>Access unavailable</h1><p>Your session or staff permissions no longer allow mailbox access. Sign in again or ask the Founder to review your permissions.</p></main>
  return <StaffMailbox onAccessDenied={()=>setDeniedToken(session!.token)} key={`${session!.token}:${profile?.platformRole}:${apiUrl}`} apiUrl={apiUrl} token={session!.token} />
}
function StaffMailbox({ apiUrl, token, onAccessDenied }: { apiUrl: string; token: string; onAccessDenied: () => void }) {
  const [section,setSection] = useState<Section>('inbox')
  const [search,setSearch] = useState('')
  const [query,setQuery] = useState('')
  const [revision,setRevision] = useState(0)
  const [cursor,setCursor] = useState<string | null>(null)
  const [pages,setPages] = useState<(string | null)[]>([])
  const [inbox,setInbox] = useState<Inbox>({messages:[],nextCursor:null,lastReceivedAt:null})
  const [deliveries,setDeliveries] = useState<Delivery[]>([])
  const [accounts,setAccounts] = useState<Account[]>([])
  const [selected,setSelected] = useState<string | null>(null)
  const [detail,setDetail] = useState<Detail | null>(null)
  const [loading,setLoading] = useState(false)
  const [reading,setReading] = useState(false)
  const [error,setError] = useState('')
  const [readError,setReadError] = useState('')
  const mounted = useRef(true)
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
  async function request<T>(route: string, signal: AbortSignal): Promise<T> {
    const response = await fetch(`${apiUrl}/v1/staff/center${route}`, {headers:{Authorization:`Bearer ${token}`,'X-Spaces-Developer-Mode':'1'},signal,cache:'no-store'})
    const body: unknown = await response.json().catch(()=>null)
    if ((response.status===401 || response.status===403) && mounted.current && !signal.aborted) onAccessDenied()
    if (!response.ok) throw new Error(body && typeof body==='object' && 'error' in body ? String(body.error) : `Unable to load (${response.status}).`)
    return body as T
  }
  useEffect(()=>{
    const controller=new AbortController()
    const check=()=>{if(document.visibilityState==='visible')void request<{accounts:Account[]}>('/accounts?q=',controller.signal).catch(()=>undefined)}
    window.addEventListener('focus',check);document.addEventListener('visibilitychange',check)
    const timer=setInterval(check,60000)
    return()=>{controller.abort();clearInterval(timer);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check)}
  // Credentials and denial callback belong to this session subtree.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])
  useEffect(()=>{
    if (section==='compose') return
    const controller=new AbortController()
    setError('');setLoading(true);setDetail(null);setSelected(null)
    setInbox({messages:[],nextCursor:null,lastReceivedAt:null});setDeliveries([]);setAccounts([])
    async function load() {
      try {
        const params=new URLSearchParams({q:query});if(cursor)params.set('cursor',cursor)
        if(section==='inbox'){const data=await request<Inbox>(`/inbox?${params}`,controller.signal);if(!controller.signal.aborted)setInbox(data)}
        if(section==='sent'){const data=await request<{deliveries:Delivery[]}>(`/sent?${params}`,controller.signal);if(!controller.signal.aborted)setDeliveries(data.deliveries)}
        if(section==='members'&&query.length>=2){const data=await request<{accounts:Account[]}>(`/accounts?${params}`,controller.signal);if(!controller.signal.aborted)setAccounts(data.accounts)}
      } catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Unable to load this view.')}
      finally{if(!controller.signal.aborted)setLoading(false)}
    }
    void load();return()=>controller.abort()
  // Credentials are fixed for this keyed subtree.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[section,query,cursor,revision])
  useEffect(()=>{
    setDetail(null);setReadError('');if(!selected)return
    const controller=new AbortController();setReading(true)
    void request<{message:Detail}>(`/inbox/${encodeURIComponent(selected)}`,controller.signal)
      .then(data=>{if(!controller.signal.aborted)setDetail(data.message)})
      .catch(e=>{if(!controller.signal.aborted)setReadError(e instanceof Error?e.message:'Unable to open message.')})
      .finally(()=>{if(!controller.signal.aborted)setReading(false)})
    return()=>controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[selected])
  function changeSection(next:Section){setSection(next);setSearch('');setQuery('');setCursor(null);setPages([]);setSelected(null);setDetail(null);setError('')}
  return <main className="spaces-v842-staff-shell">
    <header className="spaces-v842-staff-header"><div><a className="spaces-v843-back" href="?">← Back to Spaces</a><p className="spaces-v842-overline">SPACES STAFF</p><h1>Support Center</h1><p>Email, people, and the context you need to help.</p></div><span className="spaces-v842-tag">Staff only</span></header>
    <nav className="spaces-v842-staff-tabs" aria-label="Support Center sections">{(['inbox','sent','members','compose'] as const).map(item=><button key={item} type="button" aria-current={section===item?'page':undefined} className={section===item?'active':''} onClick={()=>changeSection(item)}>{({inbox:'Inbox',sent:'Sent emails',members:'Member lookup',compose:'Email Studio'})[item]}</button>)}</nav>
    {section==='compose' ? <SupportEmailStudioV84 /> : <>
      <form className="spaces-v842-search" onSubmit={e=>{e.preventDefault();setCursor(null);setPages([]);setQuery(search.trim());setRevision(v=>v+1)}}><input aria-label={section==='members'?'Search members':'Search emails'} value={search} onChange={e=>setSearch(e.target.value)} maxLength={80} placeholder={section==='members'?'Username, Spaces ID or verified email':'Search subject or email address'} /><button className="spaces-v842-action" disabled={loading||(section==='members'&&search.trim().length<2)}>Search</button><button className="spaces-v842-action secondary" type="button" disabled={loading} onClick={()=>setRevision(v=>v+1)}>Refresh</button></form>
      {error&&<p className="spaces-v842-error" role="alert">{error}</p>}
      {loading&&<p className="spaces-v842-empty" role="status">Loading…</p>}
      {section==='inbox'&&<>
        {!loading&&!error&&!inbox.lastReceivedAt&&<div className="spaces-v843-setup"><strong>Waiting for the first incoming email</strong><p>Connect support@yourspaces.net and hello@yourspaces.net to the Spaces email Worker, then send a test message. Previous mailbox messages are not imported.</p></div>}
        <div className={`spaces-v843-mail-layout ${selected?'has-selection':''}`}>
          <section className="spaces-v843-mail-list" aria-label="Incoming messages">{inbox.messages.map(item=><button className={selected===item.id?'selected':''} key={item.id} onClick={()=>{if(selected!==item.id){setDetail(null);setSelected(item.id)}}}><span className="spaces-v843-mail-meta"><strong>{item.fromName||item.from}</strong><time>{new Date(item.receivedAt).toLocaleDateString()}</time></span><span className="spaces-v843-address">{item.from}</span><strong className="spaces-v843-subject">{item.subject}</strong><span className="spaces-v843-address">To {item.to}{item.attachmentCount?` · ${item.attachmentCount} attachment(s)`:''}</span></button>)}{!loading&&!error&&!inbox.messages.length&&<p className="spaces-v842-empty">{query?'No messages match your search.':'No incoming messages yet.'}</p>}</section>
          <section className="spaces-v843-reader" aria-label="Message details">{selected&&<button className="spaces-v842-action secondary" onClick={()=>{setSelected(null);setDetail(null)}}>Close message</button>}{reading&&selected&&<p role="status">Opening message…</p>}{readError&&<p className="spaces-v842-error" role="alert">{readError}</p>}{detail&&<><h2>{detail.subject}</h2><dl><dt>From</dt><dd>{detail.fromName&&`${detail.fromName} · `}{detail.from}</dd>{detail.headerFrom!==detail.from&&<><dt>Header From</dt><dd>{detail.headerFrom}</dd></>}<dt>To</dt><dd>{detail.to}</dd><dt>Received</dt><dd>{new Date(detail.receivedAt).toLocaleString()}</dd></dl>{detail.matchedAccount&&<div className="spaces-v843-account-match"><strong>@{detail.matchedAccount.username}</strong><span>{detail.matchedAccount.email}</span><small>Address matches an account. Verify identity separately before account changes.</small></div>}{detail.attachmentCount>0&&<p className="spaces-v843-note">{detail.attachmentCount} attachment(s) were present. Attachments are not saved or available in this inbox.</p>}{detail.truncated&&<p className="spaces-v843-note">This message exceeds the text limit. The first 100,000 characters are shown.</p>}<div className="spaces-v843-message-body">{detail.text}</div></>}{!selected&&<div className="spaces-v843-reader-empty"><span aria-hidden="true">✉</span><h2>Select an email</h2><p>Open a message to read its contents and sender details.</p></div>}</section>
        </div><div className="spaces-v843-pagination"><button className="spaces-v842-action secondary" disabled={!pages.length||loading} onClick={()=>{setCursor(pages[pages.length-1]);setPages(pages.slice(0,-1))}}>Previous</button><span>Page {pages.length+1}</span><button className="spaces-v842-action secondary" disabled={!inbox.nextCursor||loading} onClick={()=>{setPages([...pages,cursor]);setCursor(inbox.nextCursor)}}>Next</button></div>
      </>}
      {section==='sent'&&<section className="spaces-v842-panel"><h2>Outgoing email history</h2><p className="spaces-v843-note">Up to 100 recent matches sent through Spaces Email Studio. Message bodies are not retained.</p><div className="spaces-v842-table-wrap"><table><thead><tr><th>Subject</th><th>Recipient</th><th>From</th><th>Sent by</th><th>Status</th><th>Date</th></tr></thead><tbody>{deliveries.map(item=><tr key={item.id}><td><strong>{item.subject}</strong></td><td><strong>{item.recipientUsername?'@'+item.recipientUsername:''}</strong><span>{item.to}</span></td><td>{item.from}</td><td>{item.staffUsername?'@'+item.staffUsername:'Staff'}</td><td><span className="spaces-v842-status">{item.status}</span></td><td>{new Date(item.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div>{!loading&&!error&&!deliveries.length&&<p className="spaces-v842-empty">No outgoing emails found.</p>}</section>}
      {section==='members'&&<section className="spaces-v842-panel"><h2>Member lookup</h2><div className="spaces-v842-member-list">{accounts.map(item=><article key={item.id}><div><strong>{item.displayName||item.username}</strong><span>@{item.username} · {item.publicUserId}</span><a href={item.email?'mailto:'+item.email:undefined}>{item.email||'Signup email is not verified'}</a></div><span className="spaces-v842-tag">{item.platformRole==='founder'?'Founder':item.platformRole==='staff'?'Staff':'Member'}</span></article>)}</div>{!loading&&!error&&!accounts.length&&<p className="spaces-v842-empty">{query.length<2?'Enter at least two characters to find an account.':'No matching members.'}</p>}</section>}
    </>}
  </main>
}
