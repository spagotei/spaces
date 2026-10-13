import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSpaces } from '../../../state/SpacesContext'
import './staff-email-v913.css'
import './staff-email-v9231.css' // SPACES_V9231_RECIPIENT_CHIPS
import './staff-email-colors-v9243.css' // SPACES_V9243_EMAIL_COLORS
import { EmailGovernanceV924 } from './EmailGovernanceV924' // SPACES_V924_EMAIL_GOVERNANCE
// SPACES_V9232_LIVE_PREVIEW_INLINE_STATUS

// V91.3: one Staff email workspace. Never trusts a sender, ticket or address without server verification.
type Mode = 'within' | 'outgoing'
type RecipientKind = 'user' | 'ticket' | 'email'
type Sender = 'support' | 'hello' | 'noreply' | 'security'
type Capabilities = { canSend: boolean; senders: Sender[]; maxRecipients: number }
type Audience = { count: number; excluded: number; recipients: { name: string; email: string }[] }
type TemplateKey = 'general' | 'support' | 'account' | 'partner' | 'verified'
const templates: Record<TemplateKey, { label: string; subject: string; title: string; body: string; sender: Sender }> = {
  general: { label: 'General message', subject: 'A message from Spaces', title: 'Hello from Spaces', body: 'Hello,\n\nWe wanted to get in touch about your request.\n\nThank you,\nSpaces', sender: 'hello' },
  support: { label: 'Support response', subject: 'Spaces Support — An update', title: 'Support update', body: 'Hi,\n\nWe have an update regarding your support request.\n\nThank you,\nSpaces Support', sender: 'support' },
  account: { label: 'Account notification', subject: 'Spaces — Your account', title: 'Account update', body: 'Hi,\n\nThere is an update about your Spaces account.\n\nSpaces Team', sender: 'noreply' },
  partner: { label: 'Partner Program', subject: 'Spaces Partners — Application update', title: 'Partner Program', body: 'Hi,\n\nWe have reviewed your Partner Program application.\n\nSpaces Partnerships', sender: 'support' },
  verified: { label: 'Verification', subject: 'Spaces — Verification update', title: 'Space verification', body: 'Hi,\n\nWe have an update about your Space verification request.\n\nSpaces Team', sender: 'support' },
}
const emailLooksValid = (value: string) => /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(value.trim()) && value.length <= 254
// V91.3 Worker intentionally limits external email to three sends per staff account per hour.
// The UI must not imply an unrestricted distribution list or silently bypass that limit.
const MAX_OUTGOING_PER_BATCH_V9231 = 3
function collectOutgoingEmailsV9231(current: string[], draft: string, limit=MAX_OUTGOING_PER_BATCH_V9231) {
  const parts = draft.split(/[,;\r\n]+/).map(value => value.trim().toLowerCase()).filter(Boolean)
  const merged = [...current]
  for (const value of parts) {
    if (!emailLooksValid(value)) throw Error(`Invalid email address: ${value.slice(0, 80)}`)
    if (!merged.includes(value)) merged.push(value)
    if (merged.length > limit) throw Error(`You can add up to ${limit} recipients per batch. Your hourly sending limit is enforced by Spaces.`)
  }
  return merged
}
function darkSimulation(html: string) {
  const css = `<style>html,body{color-scheme:dark!important;background:#0d0f14!important;color:#f0edf5!important}table{background:#181a22!important}td{background:#181a22!important;color:#e8e5ed!important}div,p,h1,h2,h3,li,code{color:#e8e5ed!important}span[style*="background-color:"]{color:#1c1d26!important}a{color:#b5a6f9!important}img{max-width:100%}</style>`
  return html.includes('</head>') ? html.replace('</head>', css + '</head>') : css + html
}
const v9243TextColors = [
  {label:'Spaces violet',hex:'#A78BFA'}, {label:'Alert red',hex:'#DC2626'},
  {label:'Orange',hex:'#C2410C'}, {label:'Approved green',hex:'#15803D'},
  {label:'Blue',hex:'#2563EB'}, {label:'Teal',hex:'#0F766E'},
] as const
const v9243Highlights = [
  {label:'Yellow',hex:'#FEF08A'}, {label:'Lavender',hex:'#DDD6FE'},
  {label:'Mint',hex:'#BBF7D0'}, {label:'Blue',hex:'#BAE6FD'},
] as const
export function StaffEmailHubV913() {
  const { apiUrl, session } = useSpaces()
  const [cap, setCap] = useState<Capabilities | null>(null)
  const [mode, setMode] = useState<Mode>('within')
  const [workspaceTab, setWorkspaceTab] = useState<'compose'|'governance'>('compose')
  const [governanceCap,setGovernanceCap] = useState<{founder:boolean;canView:boolean;canCompose:boolean;canSend:boolean;canGlobalUpdates:boolean;canGlobalCritical:boolean;canManage:boolean;externalBatchLimit:number}|null>(null)
  const [recipientKind, setRecipientKind] = useState<RecipientKind>('user')
  const [recipient, setRecipient] = useState('')
  const [recipientEmails, setRecipientEmails] = useState<string[]>([])
  const [sender, setSender] = useState<Sender>('support')
  const [template, setTemplate] = useState<TemplateKey>('support')
  const [subject, setSubject] = useState(templates.support.subject)
  const [heading, setHeading] = useState(templates.support.title)
  const [body, setBody] = useState(templates.support.body)
  const messageFieldV9243 = useRef<HTMLTextAreaElement>(null)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewSignature, setPreviewSignature] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [reviewed, setReviewed] = useState<Audience | null>(null)
  const [reviewSignature, setReviewSignature] = useState('')
  const [resolvedRecipient, setResolvedRecipient] = useState('')
  const [theme, setTheme] = useState<'dark' | 'original'>('dark')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [history, setHistory] = useState<{ id: string; recipientEmail: string; subject: string; status: string; createdAt: number }[]>([])
  const [viewHistory, setViewHistory] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const api = useCallback(async <T,>(route: string, init: RequestInit = {}): Promise<T> => {
    if (!session?.token) throw Error('Sign in to use Staff email.')
    const res = await fetch(`${apiUrl}${route}`, { ...init, cache: 'no-store', headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json', ...init.headers } })
    const json = await res.json().catch(() => ({})) as T & { error?: string }
    if (!res.ok) throw Error(json.error || `Email API error ${res.status}`)
    return json
  }, [apiUrl, session?.token])
  useEffect(() => {
    let active = true
    void api<Capabilities>('/v1/staff/email/capabilities').then(value => { if (active) setCap(value) }).catch(() => { if (active) setCap({canSend:false,senders:[],maxRecipients:0}) })
    return () => { active = false }
  }, [api])
  useEffect(() => {
    let active = true
    void api<typeof governanceCap>('/v1/staff/email/v924/capabilities').then(info => {if(active)setGovernanceCap(info)}).catch(()=>{if(active)setGovernanceCap(null)})
    return()=>{active=false}
  },[api])
  const externalLimit=governanceCap?.externalBatchLimit??MAX_OUTGOING_PER_BATCH_V9231
  const permitted=Boolean(governanceCap?.canSend&&cap?.canSend)
  const payload = useMemo(() => ({ subject, heading, body, sender, bannerId:'' }), [subject,heading,body,sender])
  // Server preview depends on message content, not recipient selection.
  const previewRequestSignature = JSON.stringify(payload)
  // Reviewing a recipient should remain valid while the author edits the message body.
  const reviewRequestSignature = JSON.stringify({ mode, recipientKind, sender,
    recipient: mode === 'outgoing' ? [...recipientEmails, ...(recipient.trim() ? [recipient.trim()] : [])].join('|') : recipient.trim() })
  const previewCurrent = Boolean(previewHtml) && previewSignature === previewRequestSignature
  const reviewedCurrent = Boolean(reviewed) && reviewSignature === reviewRequestSignature
  useEffect(() => {
    if (!subject.trim() || !body.trim() || !session?.token) {
      setPreviewHtml(''); setPreviewSignature(''); setPreviewError('')
      return
    }
    const controller = new AbortController()
    // Debounce to avoid a network request for every keystroke; ignore superseded requests.
    const timer = window.setTimeout(() => {
      void api<{html:string}>('/v1/staff/email/preview', {
        method: 'POST', body: JSON.stringify(payload), signal: controller.signal,
      }).then(result => {
        if (controller.signal.aborted) return
        setPreviewHtml(result.html)
        setPreviewSignature(previewRequestSignature)
        setPreviewError('')
      }).catch(error => {
        if (controller.signal.aborted) return
        setPreviewError(error instanceof Error ? error.message : 'Preview unavailable.')
      })
    }, 420)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [api, previewRequestSignature, session?.token])
  const senderChoices = cap?.senders || ['support']
  function chooseTemplate(next: TemplateKey) {
    const preset = templates[next]
    setTemplate(next); setSubject(preset.subject); setHeading(preset.title); setBody(preset.body)
    if (senderChoices.includes(preset.sender)) setSender(preset.sender)
    setMessage('')
  }
  function changeMode(next: Mode) {
    setMode(next);setRecipient('');setRecipientEmails([]);setReviewed(null);setResolvedRecipient('');setMessage('')
    if (next === 'outgoing') { chooseTemplate('general'); setRecipientKind('email') }
    else { chooseTemplate('support'); setRecipientKind('user') }
  }
  const recordError = (error: unknown) => { setMessage(error instanceof Error ? error.message : 'Email operation failed.') }
  function addOutgoingChipsV9231(value: string) {
    if (busy || !value.trim()) return
    try {
      setRecipientEmails(collectOutgoingEmailsV9231(recipientEmails, value, externalLimit))
      setRecipient('')
      setReviewed(null)
      setMessage('')
    } catch (e) { recordError(e) }
  }
  async function reviewRecipient() {
    if (mode === 'outgoing' ? !recipientEmails.length && !recipient.trim() : !recipient.trim()) {setMessage('Enter a recipient first.');return}
    setBusy(true);setMessage('')
    try {
      if (mode === 'outgoing') {
        const selected = collectOutgoingEmailsV9231(recipientEmails, recipient, externalLimit)
        if (!selected.length) throw Error('Add at least one email address.')
        // One authenticated validation per unique recipient; no CC/BCC lists sent to the Worker.
        const checked: {name:string;email:string}[] = []
        for (const email of selected) {
          const result = await api<{email:string}>('/v1/staff/email/v913/external-check', {method:'POST',body:JSON.stringify({recipientEmail:email,sender})})
          checked.push({name:'Outside Spaces',email:result.email})
        }
        setRecipientEmails(checked.map(item=>item.email))
        setRecipient('')
        setReviewed({count:checked.length,excluded:0,recipients:checked})
        setResolvedRecipient('')
        setReviewSignature(JSON.stringify({mode,recipientKind,sender,recipient:checked.map(item=>item.email).join('|')}))
      } else {
        let selection = recipient.trim()
        if (recipientKind === 'ticket') {
          const result = await api<{userId:string}>('/v1/staff/email/v913/resolve-ticket', {method:'POST',body:JSON.stringify({ticketId:selection})})
          selection = result.userId
        }
        const result = await api<Audience>('/v1/staff/email/audience-preview', {method:'POST',body:JSON.stringify({audience:'selected',recipient:selection})})
        setReviewed(result);setResolvedRecipient(selection)
        setReviewSignature(reviewRequestSignature)
      }
      setMessage('')
    } catch (e) {setReviewed(null);recordError(e)} finally {setBusy(false)}
  }
  async function send() {
    if (!permitted || !previewCurrent || !reviewedCurrent || !reviewed?.count) return
    const destinations = reviewed.recipients.map(item=>item.email)
    if (!destinations.length) return
    setBusy(true);setMessage('Sending email…')
    try {
      if (mode === 'outgoing') {
        const succeeded: string[] = []
        let failure = ''
        for (const email of destinations) {
          try {
            // Every address is sent separately through the existing audited, rate-limited endpoint.
            const result = await api<{sent:number;failed:number}>('/v1/staff/email/v913/external-send', {
              method:'POST',body:JSON.stringify({...payload,recipientEmail:email,confirmedEmail:email,sendId:crypto.randomUUID()}),
            })
            if (result.sent !== 1) throw Error('Provider did not confirm this email.')
            succeeded.push(email)
          } catch (e) {
            failure = e instanceof Error ? e.message : 'Email sending failed.'
            break // Never continue blasting addresses after a provider/rate-limit failure.
          }
        }
        // Keep the unprocessed emails as chips. Never re-send the confirmed ones by accident.
        if (succeeded.length) setRecipientEmails(current=>current.filter(email=>!succeeded.includes(email)))
        setReviewed(null);setReviewSignature('')
        setMessage(failure
          ? `${succeeded.length}/${destinations.length} accepted. Remaining addresses were kept. ${failure} Check sent history before retrying if delivery is uncertain.`
          : `${succeeded.length} separate emails accepted by Spaces. Check sent history and recipient inboxes.`)
      } else {
        const result = await api<{sent:number;failed:number}>('/v1/staff/email/send', {method:'POST',body:JSON.stringify({...payload,audience:'selected',recipient:resolvedRecipient,confirmedCount:reviewed.count,sendId:crypto.randomUUID()})})
        setMessage(result.sent ? 'Email accepted by Spaces for delivery. Check the sent history for status.' : 'Email could not be sent; check history.')
        setReviewed(null);setReviewSignature('')
      }
    } catch (e) {recordError(e)} finally {setBusy(false)}
  }
  async function openHistory() {
    if (!viewHistory) {
      try {
        const existing = await api<{deliveries:typeof history}>('/v1/staff/email/history')
        const external = await api<{deliveries:typeof history}>('/v1/staff/email/v913/history')
        setHistory([...(existing.deliveries||[]),...(external.deliveries||[])].sort((a,b)=>b.createdAt-a.createdAt).slice(0,100))
      } catch (e) {recordError(e)}
    }
    setViewHistory(!viewHistory)
  }
  // Insert only the Worker's already-supported and escaped email color tags.
  function insertEmailColorV9243(kind: 'color' | 'bg', hex: string) {
    const palette = kind === 'color' ? v9243TextColors : v9243Highlights
    if (!palette.some(item => item.hex === hex)) return
    const input = messageFieldV9243.current
    const start = input?.selectionStart ?? body.length
    const end = input?.selectionEnd ?? start
    const selected = body.slice(start,end) || (kind === 'color' ? 'colored text' : 'highlighted text')
    const opening = '[' + kind + '=' + hex + ']'
    const closing = '[/' + kind + ']'
    const next = body.slice(0,start) + opening + selected + closing + body.slice(end)
    if (next.length > 8000) return
    setBody(next)
    requestAnimationFrame(() => {
      input?.focus()
      input?.setSelectionRange(start+opening.length,start+opening.length+selected.length)
    })
  }
  return <div className="spaces-v913-email">
    <header className="v913-email-header"><div><span className="eyebrow">STAFF OPERATIONS / EMAIL</span><h2>Email</h2><p>Compose and send messages from Spaces.</p></div><div><button type="button" onClick={() => {setWorkspaceTab('compose');void openHistory()}}>{viewHistory?'Compose email':'Sent history'}</button>{governanceCap?.canGlobalUpdates&&<button type="button" onClick={()=>{setViewHistory(false);setWorkspaceTab(current=>current==='governance'?'compose':'governance')}}>{workspaceTab==='governance'?'Compose':'Global & permissions'}</button>}</div></header>
    {workspaceTab==='governance'&&governanceCap?.canGlobalUpdates ? <EmailGovernanceV924 cap={governanceCap}/> : viewHistory ? <section className="v913-glass v913-history"><h3>Recorded deliveries</h3>{history.length ? history.map(item=><article key={item.id}><strong>{item.subject}</strong><span>{item.recipientEmail}</span><small>{item.status} · {new Date(item.createdAt).toLocaleString()}</small></article>) : <p>No recent deliveries.</p>}</section> : <>
      <section className="v913-email-mode"><label htmlFor="v913-mode">Email type</label><select id="v913-mode" value={mode} onChange={e=>changeMode(e.target.value as Mode)}><option value="within">Within Spaces</option><option value="outgoing">Outgoing Email</option></select></section>
      <div className="v913-email-grid"><section className="v913-glass v913-composer"><h3>Compose message</h3>
        <div className="v913-fields-two"><label>From<select value={sender} onChange={e=>setSender(e.target.value as Sender)}>{senderChoices.map(value=><option key={value} value={value}>{value}@yourspaces.net</option>)}</select></label><label>Purpose<select value={template} onChange={e=>chooseTemplate(e.target.value as TemplateKey)}>{Object.entries(templates).map(([id,t])=><option key={id} value={id}>{t.label}</option>)}</select></label></div>
        {mode==='within' ? <div className="v913-fields-two"><label>Find recipient by<select value={recipientKind} onChange={e=>{setRecipientKind(e.target.value as RecipientKind);setRecipient('')}}><option value="user">Spaces user ID</option><option value="ticket">Ticket or case ID</option><option value="email">Verified account email</option></select></label><label>{recipientKind==='user'?'Spaces user ID':recipientKind==='ticket'?'Ticket / case ID':'Verified email address'}<input value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder={recipientKind==='email'?'user@example.com':recipientKind==='ticket'?'Ticket ID or case number':'Account ID'} /></label></div>
          : <label>Recipient email addresses
              <div className="v9231-recipient-box" role="group" aria-label="Recipients">
                {recipientEmails.map(email=><span className="v9231-recipient-chip" key={email}>
                  <span>{email}</span><button type="button" aria-label={`Remove ${email}`} title={`Remove ${email}`} disabled={busy} onClick={()=>{setRecipientEmails(current=>current.filter(item=>item!==email));setReviewed(null)}}>×</button>
                </span>)}
                <input aria-label="Add recipient email" type="text" inputMode="email" autoComplete="off" disabled={busy}
                  value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder={recipientEmails.length?'Add another email…':'name@example.com'}
                  onKeyDown={e=>{
                    if (e.key==='Enter' || e.key==='Tab' || e.key===',') { if(recipient.trim()){e.preventDefault();addOutgoingChipsV9231(recipient)} }
                    if(e.key==='Backspace' && !recipient && recipientEmails.length){setRecipientEmails(current=>current.slice(0,-1));setReviewed(null)}
                  }}
                  onPaste={e=>{const text=e.clipboardData.getData('text');if(/[,;\r\n]/.test(text)){e.preventDefault();addOutgoingChipsV9231((recipient?recipient+',':'')+text)}}}
                />
              </div>

            </label>}
        <label>Subject<input value={subject} onChange={e=>setSubject(e.target.value)} maxLength={180} /></label>
        <label>Heading<input value={heading} onChange={e=>setHeading(e.target.value)} maxLength={120} /></label>
        <label>Message<textarea ref={messageFieldV9243} rows={10} value={body} onChange={e=>setBody(e.target.value)} maxLength={8000} spellCheck /></label>
        <div className="v9243-color-toolbar" role="group" aria-label="Email formatting colors">
          <label>Text color<select aria-label="Text color" defaultValue="" onChange={event=>{if(event.target.value)insertEmailColorV9243('color',event.target.value);event.target.value=''}}><option value="">Choose color</option>{v9243TextColors.map(item=><option key={item.hex} value={item.hex}>{item.label}</option>)}</select></label>
          <label>Highlight<select aria-label="Highlight" defaultValue="" onChange={event=>{if(event.target.value)insertEmailColorV9243('bg',event.target.value);event.target.value=''}}><option value="">Choose highlight</option>{v9243Highlights.map(item=><option key={item.hex} value={item.hex}>{item.label}</option>)}</select></label>
        </div>
        <details open={showAdvanced} onToggle={event=>setShowAdvanced(event.currentTarget.open)}><summary>Formatting tips</summary><p>**bold** · *italic* · ## heading · - list · [link](https://example.com) · [color=#A78BFA]colored text[/color] · [bg=#FEF08A]highlight[/bg]</p></details>
        <div className="v913-email-actions"><button onClick={() => void reviewRecipient()} disabled={busy||(mode==='outgoing' ? !recipientEmails.length&&!recipient.trim() : !recipient.trim())}>Review recipients</button><button className="v913-send" onClick={() => void send()} disabled={busy||!permitted||!previewCurrent||!reviewedCurrent||!reviewed?.count}>Send email</button></div>
        {reviewedCurrent && reviewed && <div className="v913-email-reviewed"><strong>{reviewed.count} verified destination</strong>{reviewed.recipients.map(p=><span key={p.email}>{p.name} · {p.email}</span>)}</div>}
        {message && <p className="v913-email-message" role="status">{message}</p>}
      </section><section className="v913-glass v913-preview"><div className="v913-preview-head"><div><h3>Live email preview</h3>{!previewCurrent && !previewError && <small>Updating…</small>}{previewError && <small role="status">{previewError}</small>}</div><div role="group" aria-label="Preview appearance"><button className={theme==='dark'?'selected':''} onClick={()=>setTheme('dark')}>Dark</button><button className={theme==='original'?'selected':''} onClick={()=>setTheme('original')}>Original</button></div></div>
      {previewHtml ? <iframe title="Preview of Spaces email" sandbox="" referrerPolicy="no-referrer" srcDoc={theme==='dark'?darkSimulation(previewHtml):previewHtml}/> : <div className="v913-preview-empty"><span>✉</span><strong>Email preview</strong></div>}

      </section></div>
    </>}
  </div>
}
