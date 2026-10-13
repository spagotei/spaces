import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useSpaces } from '../../../state/SpacesContext'
import './support-email-v84.css'

type MailSender = 'support' | 'hello' | 'security'
type Banner = { id: string; url: string; createdAt: number }
type Delivery = { id: string; recipientEmail: string; sender: string; subject: string; status: string; createdAt: number }
type Capabilities = { canSend: boolean; senders: MailSender[]; requiresVerifiedMember: boolean; maxRecipients: number }
type Audience = 'selected' | 'platform_staff' | 'beta_members'
type AudienceResult = { audience: string; count: number; excluded: number; recipients: { name: string; email: string }[] }
const presets = {
  custom: { name: 'Custom email', subject: '', heading: '', body: '' },
  reply: { name: 'Support follow-up', subject: 'Spaces Support — Your request', heading: 'We have an update for you', body: 'Hi,\n\nWe wanted to follow up on your support request.\n\n**Your update goes here.**\n\nThank you,\nSpaces Support' },
  notice: { name: 'Account notice', subject: 'An update from Spaces', heading: 'Account update', body: 'Hi,\n\nWe have an update regarding your Spaces account.\n\n**Details:**\n- Your update here\n\nSpaces Support' },
  partner: { name: 'Partner update', subject: 'Spaces Partners — Update', heading: 'Spaces Partners', body: 'Hi,\n\nWe have an update about your Spaces partnership.\n\n**What changed**\nDescribe the update here.\n\nSpaces Team' },
} as const

type PresetKey = keyof typeof presets
export function SupportEmailStudioV84() {
  const { apiUrl, session, pushToast } = useSpaces()
  const [cap, setCap] = useState<Capabilities | null>(null)
  const [recipient, setRecipient] = useState('')
  const [audience, setAudience] = useState<Audience>('selected')
  const [audienceResult, setAudienceResult] = useState<AudienceResult | null>(null)
  const [audienceSignature, setAudienceSignature] = useState('')
  const [sender, setSender] = useState<MailSender>('support')
  const [preset, setPreset] = useState<PresetKey>('custom')
  const [subject, setSubject] = useState('')
  const [heading, setHeading] = useState('')
  const [body, setBody] = useState('')
  const [bannerId, setBannerId] = useState('')
  const [banners, setBanners] = useState<Banner[]>([])
  const [history, setHistory] = useState<Delivery[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewSignature, setPreviewSignature] = useState('')
  const [busy, setBusy] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)
  const api = useCallback(async <T,>(route: string, init: RequestInit = {}): Promise<T> => {
    const result = await fetch(`${apiUrl}${route}`, { ...init, headers: { Authorization: `Bearer ${session?.token || ''}`, ...(init.body instanceof Blob ? {} : { 'Content-Type': 'application/json' }), ...init.headers }, cache: 'no-store' })
    const data = await result.json().catch(() => ({})) as T & { error?: string }
    if (!result.ok) throw Error(data.error || `HTTP ${result.status}`)
    return data
  }, [apiUrl, session?.token])
  const refreshBanners = useCallback(async () => {
    try { setBanners((await api<{banners: Banner[]}>('/v1/staff/email/banners')).banners ?? []) }
    catch (error) { pushToast(error instanceof Error ? error.message : 'Could not load email banners.', 'danger') }
  }, [api, pushToast])
  const refreshHistory = useCallback(async () => {
    try { setHistory((await api<{deliveries: Delivery[]}>('/v1/staff/email/history')).deliveries ?? []) }
    catch (error) { pushToast(error instanceof Error ? error.message : 'Could not load email history.', 'danger') }
  }, [api, pushToast])
  useEffect(() => {
    let alive = true
    void api<Capabilities>('/v1/staff/email/capabilities').then(value => { if (alive) setCap(value) }).catch(error => pushToast(error instanceof Error ? error.message : 'Email access unavailable.', 'danger'))
    void refreshBanners()
    return () => { alive = false }
  }, [api, pushToast, refreshBanners])

  const payload = { recipient: recipient.trim(), audience, sender, subject, heading, body, bannerId }
  const signature = JSON.stringify(payload)
  const previewCurrent = Boolean(previewHtml) && signature === previewSignature
  const audienceCurrent = Boolean(audienceResult) && audienceSignature === signature

  function applyPreset(value: PresetKey) {
    setPreset(value)
    const next = presets[value]
    setSubject(next.subject); setHeading(next.heading); setBody(next.body)
  }
  function insertFormat(before: string, after = before, example = 'text') {
    const element = bodyRef.current
    const start = element?.selectionStart ?? body.length
    const end = element?.selectionEnd ?? body.length
    const chosen = body.slice(start,end) || example
    setBody(body.slice(0,start) + before + chosen + after + body.slice(end))
    requestAnimationFrame(() => {
      element?.focus()
      element?.setSelectionRange(start + before.length,start + before.length + chosen.length)
    })
  }
  async function uploadBanner(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 1536*1024) {
      pushToast('Choose PNG, JPEG or WebP, at most 1.5 MB.', 'danger'); return
    }
    setBusy(true)
    try {
      const result = await api<{banner: Banner}>('/v1/staff/email/banners', { method: 'POST', headers: { 'Content-Type': file.type }, body: file })
      setBanners(current => [result.banner, ...current])
      setBannerId(result.banner.id)
      pushToast('Email banner uploaded.', 'success')
    } catch (error) { pushToast(error instanceof Error ? error.message : 'Banner upload failed.', 'danger') }
    finally { setBusy(false) }
  }
  async function preview() {
    setBusy(true)
    try {
      const result = await api<{html: string}>('/v1/staff/email/preview', {method:'POST',body:JSON.stringify(payload)})
      setPreviewHtml(result.html)
      setPreviewSignature(signature)
    } catch(error) { pushToast(error instanceof Error ? error.message : 'Preview unavailable.', 'danger') }
    finally { setBusy(false) }
  }
  async function reviewAudience() {
    setBusy(true)
    try {
      const result = await api<AudienceResult>('/v1/staff/email/audience-preview', {method:'POST',body:JSON.stringify({audience,recipient})})
      setAudienceResult(result)
      setAudienceSignature(signature)
    } catch(error) { setAudienceResult(null); pushToast(error instanceof Error ? error.message : 'Could not review recipients.', 'danger') }
    finally { setBusy(false) }
  }
  async function send(testOnly = false) {
    if (busy || !cap?.canSend || !previewCurrent) return
    if (!testOnly && (!audienceCurrent || !audienceResult?.count)) {
      pushToast('Review your eligible recipients before sending.', 'danger'); return
    }
    const count = testOnly ? 1 : audienceResult?.count || 0
    if (!window.confirm(testOnly
      ? `Send a preview email to your own verified Spaces address from ${sender}@yourspaces.net?`
      : `Send from ${sender}@yourspaces.net to ${count} verified Spaces members?\n\nEmails cannot be recalled. Review your recipients carefully.`)) return
    setBusy(true)
    try {
      const result = await api<{ sent: number; failed: number; total: number }>('/v1/staff/email/send', {method:'POST',body:JSON.stringify({...payload,testOnly,confirmedCount:count,sendId:crypto.randomUUID()})})
      pushToast(`Accepted ${result.sent} of ${result.total} email${result.total === 1 ? '' : 's'}.${result.failed ? ` ${result.failed} failed. Check history.` : ''}`, result.failed ? 'danger' : 'success')
      if (!testOnly) { setAudienceResult(null); setAudienceSignature('') }
      await refreshHistory()
    } catch(error) { pushToast(error instanceof Error ? error.message : 'Email could not be sent.', 'danger') }
    finally { setBusy(false) }
  }

  return <div className="spaces-v84-email">
    <header className="spaces-v84-email-header"><div><span className="eyebrow">SPACES OFFICIAL COMMUNICATIONS</span><h2>Email Studio</h2><p>Compose branded notices for selected members or verified Spaces audiences. Nothing sends without confirmation.</p></div>
      <div><button className="secondary-button" onClick={() => setGuideOpen(true)}>Formatting guide</button><button className="secondary-button" onClick={() => { setHistoryOpen(!historyOpen); if (!historyOpen) void refreshHistory() }}>{historyOpen ? 'Back to composer' : 'Sent history'}</button></div>
    </header>
    {historyOpen ? <section className="spaces-v84-email-history"><h3>Recently sent by you</h3>{!history.length && <p>No email deliveries recorded yet.</p>}{history.map(item => <article key={item.id}><div><b>{item.subject}</b><span>{item.recipientEmail} · {item.sender}</span></div><small>{item.status.toUpperCase()} · {new Date(item.createdAt).toLocaleString()}</small></article>)}</section> : <div className="spaces-v84-email-grid">
      <section className="spaces-v84-email-panel spaces-v84-email-compose">
        <div className="spaces-v84-email-panel-title"><h3>Compose email</h3><span>{cap?.canSend ? 'Mail service connected' : 'Preview-only / email service unavailable'}</span></div>
        <div className="spaces-v84-email-row"><label>From<select value={sender} onChange={e => setSender(e.target.value as MailSender)}>{(cap?.senders ?? ['support']).map(value => <option key={value} value={value}>{value}@yourspaces.net</option>)}</select></label>
          <label>Recipients<select value={audience} onChange={e => setAudience(e.target.value as Audience)}><option value="selected">Selected members</option><option value="platform_staff">Platform Staff & Support</option><option value="beta_members">Claimed beta members</option></select></label></div>
        {audience === 'selected' && <label>Spaces member emails or user IDs (up to 20)<textarea rows={3} value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="Separate addresses or user IDs with commas or new lines" /></label>}
        <div className="spaces-v84-email-audience"><div><strong>Review recipients</strong><small>Verified accounts only · Opt-outs excluded · Maximum 20 per send</small></div><button className="secondary-button compact" onClick={() => void reviewAudience()} disabled={busy}>Review group</button></div>
        {audienceCurrent && audienceResult && <div className="spaces-v84-email-recipient-list"><strong>{audienceResult.count} eligible member{audienceResult.count === 1 ? '' : 's'}</strong>{audienceResult.excluded > 0 && <small>{audienceResult.excluded} opted out</small>}<div>{audienceResult.recipients.map(item => <span key={item.email}>{item.name} · {item.email}</span>)}</div></div>}
        <label>Template<select value={preset} onChange={e => applyPreset(e.target.value as PresetKey)}>{Object.entries(presets).map(([key,value]) => <option key={key} value={key}>{value.name}</option>)}</select></label>
        <label>Email subject<input maxLength={180} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Your update from Spaces" /></label>
        <label>Large title inside email<input maxLength={120} value={heading} onChange={e => setHeading(e.target.value)} placeholder="We're here to help" /></label>
        <div className="spaces-v84-email-art"><div><b>Email banner</b><span>Pick an existing banner or upload your own artwork (PNG/JPEG/WebP).</span></div><label className="spaces-v84-email-upload">Upload banner<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => void uploadBanner(e)} disabled={busy} /></label></div>
        <div className="spaces-v84-banner-gallery"><button className={!bannerId ? 'selected' : ''} onClick={() => setBannerId('')}>Spaces default</button>{banners.map(item => <button key={item.id} className={bannerId === item.id ? 'selected' : ''} onClick={() => setBannerId(item.id)} title={`Banner uploaded ${new Date(item.createdAt).toLocaleDateString()}`}><img src={item.url} alt="Available email banner" loading="lazy"/></button>)}</div>
        <div className="spaces-v84-email-format-header"><strong>Message</strong><button onClick={() => setGuideOpen(true)}>How to format text?</button></div>
        <div className="spaces-v84-email-toolbar" aria-label="Text formatting">
          <button title="Bold" onClick={() => insertFormat('**','**')}>B</button><button title="Italic" onClick={() => insertFormat('*','*')}><i>I</i></button><button title="Underline" onClick={() => insertFormat('__','__')}><u>U</u></button><button title="Strikethrough" onClick={() => insertFormat('~~','~~')}><s>S</s></button>
          <button title="Header" onClick={() => insertFormat('## ','','Heading')}>H2</button><button title="Bullet" onClick={() => insertFormat('- ','','List item')}>• List</button><button title="Link" onClick={() => insertFormat('[','](https://yourspaces.net/)', 'Link title')}>Link</button>
          <button title="Purple text" onClick={() => insertFormat('[color=#9765C9]','[/color]')}>Purple</button><button title="Red text" onClick={() => insertFormat('[color=#D84B56]','[/color]')}>Red</button><button title="Highlight" onClick={() => insertFormat('[bg=#F5E0FF]','[/bg]')}>Highlight</button>
        </div>
        <textarea className="spaces-v84-email-body" ref={bodyRef} rows={12} value={body} maxLength={8000} placeholder={'Hi,\n\n## Hello from Spaces\n\nUse **bold**, ~~strikeout~~, or [color=#9765C9]purple text[/color].'} onChange={e => setBody(e.target.value)} />
        <div className="spaces-v84-email-buttons"><button className="secondary-button" disabled={busy || !subject.trim() || !body.trim()} onClick={() => void preview()}>{busy ? 'Working...' : 'Generate preview'}</button>
          <button className="secondary-button" disabled={busy || !cap?.canSend || !previewCurrent} onClick={() => void send(true)}>Send test to myself</button>
          <button className="primary-button" disabled={busy || !cap?.canSend || !previewCurrent || !audienceCurrent || !audienceResult?.count} onClick={() => void send()}>Send to {audienceCurrent ? audienceResult?.count : 'reviewed'} members</button></div>
      </section>
      <section className="spaces-v84-email-panel spaces-v84-email-preview"><div className="spaces-v84-email-panel-title"><h3>Email preview</h3><span>{previewCurrent ? 'Exact server-rendered HTML' : 'Generate preview after editing'}</span></div>
        {previewHtml && previewCurrent ? <iframe title="Preview of the email as HTML" sandbox="" referrerPolicy="no-referrer" srcDoc={previewHtml} /> : <div className="spaces-v84-email-preview-empty"><span>✉</span><strong>Your email will appear here</strong><p>Choose a template, write your message, and click Generate preview to see the finished HTML email.</p></div>}
        <p className="spaces-v84-email-preview-note">Emails are sent only when you select <b>Send email</b> and confirm. Previews never send.</p>
      </section>
    </div>}
    {guideOpen && <div className="spaces-v84-email-guide-backdrop" role="dialog" aria-modal="true" aria-label="Email formatting guide" onMouseDown={e => { if (e.target === e.currentTarget) setGuideOpen(false) }}><section className="spaces-v84-email-guide"><header><h3>Spaces email formatting</h3><button aria-label="Close guide" onClick={() => setGuideOpen(false)}>×</button></header><p>Write using safe Markdown-style formatting. Spaces converts it to email-compatible HTML for you.</p>
      <table><tbody>{[
        ['Big header','# Heading'],['Medium header','## Heading'],['Small header','### Heading'],['Bold','**bold**'],['Italic','*italic*'],['Underline','__underline__'],['Strikethrough','~~struck out~~'],['Purple text','[color=#9765C9]purple[/color]'],['Any HEX color','[color=#FF6600]orange[/color]'],['Highlight','[bg=#FFF0A3]important[/bg]'],['Link','[Open Spaces](https://yourspaces.net/)'],['Bullet list','- First item'],['Numbered list','1. First item'],['Quote','> Quoted text'],['Separator','---'],['Inline code','`example`'],
      ].map(([label,markup]) => <tr key={label}><th>{label}</th><td><code>{markup}</code></td></tr>)}</tbody></table><p>Raw HTML, scripts, and CSS are treated as text, not executed. This protects recipients and keeps layouts reliable in email clients.</p></section></div>}
  </div>
}
