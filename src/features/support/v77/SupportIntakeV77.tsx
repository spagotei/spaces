import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../../components/Icon'
import { Modal } from '../../../components/Modal'
import { useSpaces } from '../../../state/SpacesContext'
import {
  dispatchSupportIntakeV77,
  supportCaseTypeLabelV77,
  supportV77Request,
  type SupportIntakeV77Detail,
  type SupportV77Case,
  type SupportV77CaseType,
} from './support-v77-api'

const caseTypes: { id: SupportV77CaseType; label: string; note: string; icon: 'message' | 'user' | 'grid' | 'activity' | 'shield' | 'more' }[] = [
  { id: 'request', label: 'General Request', note: 'Account help, questions, or general Support', icon: 'message' },
  { id: 'user_report', label: 'Report a User', note: 'Harassment, spam, impersonation, scams, or unsafe behavior', icon: 'user' },
  { id: 'space_report', label: 'Report a Space', note: 'Report a server/Space or a specific channel', icon: 'grid' },
  { id: 'bug_report', label: 'Report a Bug', note: 'Broken behavior, crashes, visual issues, or unexpected results', icon: 'activity' },
  { id: 'appeal', label: 'Appeal / Moderation Question', note: 'Ask about a restriction, warning, or moderation action', icon: 'shield' },
  { id: 'other', label: 'Other', note: 'Anything that does not fit the categories above', icon: 'more' },
]

const categoryOptions: Record<SupportV77CaseType, string[]> = {
  request: ['Account help', 'Feature question', 'Privacy / safety question', 'Billing / access', 'Other request'],
  user_report: ['Harassment', 'Spam', 'Unsafe content', 'Impersonation', 'Scam / fraud', 'Threats', 'Repeated rule violations', 'Other'],
  space_report: ['Harassment / unsafe community', 'Scam / fraud', 'Unsafe content', 'Impersonation', 'Moderation concern', 'Repeated rule violations', 'Other'],
  bug_report: ['Messaging', 'Spaces / channels', 'Friends / DMs', 'Support', 'Account / security', 'Mobile', 'Desktop', 'Website', 'Other'],
  appeal: ['Platform restriction', 'Messaging restriction', 'Space restriction', 'Channel restriction', 'Ban appeal', 'Other moderation question'],
  other: ['Other'],
}

export function SupportIntakeHostV77() {
  const [open, setOpen] = useState(false)
  const [initial, setInitial] = useState<SupportIntakeV77Detail>({})

  useEffect(() => {
    const onOpen = (event: Event) => {
      setInitial((event as CustomEvent<SupportIntakeV77Detail>).detail ?? {})
      setOpen(true)
    }
    window.addEventListener('spaces-support-intake-v77', onOpen)
    return () => window.removeEventListener('spaces-support-intake-v77', onOpen)
  }, [])

  if (!open) return null
  return <SupportIntakeV77 initial={initial} onClose={() => setOpen(false)} />
}

export function SupportIntakeV77({ initial, onClose }: { initial: SupportIntakeV77Detail; onClose: () => void }) {
  const { apiUrl, session, workspaces, pushToast } = useSpaces()
  const [type, setType] = useState<SupportV77CaseType | ''>(initial.type ?? '')
  const [category, setCategory] = useState('')
  const [targetUsername, setTargetUsername] = useState(initial.targetUsername ?? '')
  const [targetSpaceId, setTargetSpaceId] = useState(initial.targetSpaceId ?? '')
  const [targetChannelId, setTargetChannelId] = useState(initial.targetChannelId ?? '')
  const [severity, setSeverity] = useState('normal')
  const [reproducibility, setReproducibility] = useState('sometimes')
  const [details, setDetails] = useState('')
  const [expected, setExpected] = useState('')
  const [actual, setActual] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setType(initial.type ?? '')
    setTargetUsername(initial.targetUsername ?? '')
    setTargetSpaceId(initial.targetSpaceId ?? '')
    setTargetChannelId(initial.targetChannelId ?? '')
    setCategory('')
    setDetails('')
    setExpected('')
    setActual('')
  }, [initial])

  const selectedSpace = useMemo(() => workspaces.find(space => space.id === targetSpaceId) ?? null, [targetSpaceId, workspaces])
  const categories = type ? categoryOptions[type] : []
  const canSubmit = Boolean(type && category && (type !== 'user_report' || initial.targetUserId || targetUsername.trim()))

  function resetType(next: SupportV77CaseType) {
    setType(next)
    setCategory('')
    setDetails('')
    setExpected('')
    setActual('')
  }

  async function submit() {
    if (!type || !category || busy) return
    setBusy(true)
    try {
      const subject =
        type === 'user_report'
          ? `${category}: ${initial.targetDisplayName || targetUsername.trim().replace(/^@/u, '') || 'user'}`
          : type === 'space_report'
            ? `${category}: ${initial.targetSpaceName || selectedSpace?.name || 'Space'}`
            : `${supportCaseTypeLabelV77(type)}: ${category}`
      const answers: Record<string, string> = { category }
      if (type === 'bug_report') {
        answers.severity = severity
        answers.reproducibility = reproducibility
        if (expected.trim()) answers.expected = expected.trim()
        if (actual.trim()) answers.actual = actual.trim()
        answers.environment = `${navigator.userAgent} · ${window.innerWidth}x${window.innerHeight}`
      }
      if (targetChannelId) answers.channelId = targetChannelId

      const created = await supportV77Request<SupportV77Case>(apiUrl, session?.token, '/v1/support/v77/cases', {
        method: 'POST',
        body: JSON.stringify({
          caseType: type,
          subtype: category,
          subject,
          details: details.trim(),
          answers,
          priority: type === 'bug_report' && severity === 'critical' ? 'urgent' : type === 'bug_report' && severity === 'high' ? 'high' : 'normal',
          targetUserId: initial.targetUserId ?? null,
          targetUsername: initial.targetUserId ? null : targetUsername.trim().replace(/^@/u, ''),
          targetSpaceId: (initial.targetSpaceId ?? targetSpaceId) || null,
          targetChannelId: (initial.targetChannelId ?? targetChannelId) || null,
          source: initial.source ?? 'support_bot',
        }),
      })
      window.dispatchEvent(new Event('spaces-support-v77-changed'))
      pushToast(`${created.caseNumber} sent to Spaces Support.`, 'success')
      onClose()
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not create that Support case.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Start a new Support case" subtitle="Choose what you need help with. Spaces routes it to the right Support queue." onClose={onClose} wide>
      <div className="support-intake-v77">
        {!type ? (
          <div className="support-intake-types-v77">
            {caseTypes.map(item => (
              <button key={item.id} onClick={() => resetType(item.id)}>
                <span><Icon name={item.icon} size={18}/></span>
                <div><strong>{item.label}</strong><small>{item.note}</small></div>
                <Icon name="chevron" size={13}/>
              </button>
            ))}
          </div>
        ) : (
          <div className="support-intake-form-v77">
            <header>
              <button className="secondary-button compact" onClick={() => setType('')}><Icon name="chevron" size={12}/> Back</button>
              <div><span className="eyebrow">{supportCaseTypeLabelV77(type).toUpperCase()}</span><h2>{caseTypes.find(item => item.id === type)?.label}</h2></div>
            </header>

            {type === 'user_report' && (
              <label className="field-label">User
                <input className="text-input" value={initial.targetDisplayName ? `@${initial.targetUsername ?? initial.targetDisplayName}` : targetUsername} onChange={event => setTargetUsername(event.target.value)} disabled={Boolean(initial.targetUserId)} placeholder="@username" />
              </label>
            )}

            {type === 'space_report' && (
              <label className="field-label">Space
                <select className="text-input" value={initial.targetSpaceId ?? targetSpaceId} onChange={event => setTargetSpaceId(event.target.value)} disabled={Boolean(initial.targetSpaceId)}>
                  <option value="">Choose a Space</option>
                  {initial.targetSpaceId && <option value={initial.targetSpaceId}>{initial.targetSpaceName ?? 'Selected Space'}</option>}
                  {workspaces.filter(space => space.id !== initial.targetSpaceId).map(space => <option key={space.id} value={space.id}>{space.name}</option>)}
                </select>
              </label>
            )}

            <label className="field-label">Category
              <select className="text-input" value={category} onChange={event => setCategory(event.target.value)}>
                <option value="">Choose a category</option>
                {categories.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>

            {type === 'bug_report' && <div className="support-intake-grid-v77">
              <label className="field-label">Severity
                <select className="text-input" value={severity} onChange={event => setSeverity(event.target.value)}>
                  <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical / blocking</option>
                </select>
              </label>
              <label className="field-label">Reproducibility
                <select className="text-input" value={reproducibility} onChange={event => setReproducibility(event.target.value)}>
                  <option value="once">Happened once</option><option value="sometimes">Sometimes</option><option value="often">Often</option><option value="always">Every time</option>
                </select>
              </label>
            </div>}

            {type === 'bug_report' && <div className="support-intake-grid-v77">
              <label className="field-label">Expected result<textarea className="text-area" rows={3} value={expected} onChange={event => setExpected(event.target.value)} placeholder="What should have happened?" /></label>
              <label className="field-label">Actual result<textarea className="text-area" rows={3} value={actual} onChange={event => setActual(event.target.value)} placeholder="What happened instead?" /></label>
            </div>}

            <label className="field-label">Details <small>Optional but helpful</small>
              <textarea className="text-area" rows={5} maxLength={2400} value={details} onChange={event => setDetails(event.target.value)} placeholder={type === 'appeal' ? 'Tell us what you want reviewed…' : 'Anything the Support team should know…'} />
            </label>

            <div className="support-intake-actions-v77">
              <button className="secondary-button" onClick={onClose}>Cancel</button>
              <button className="primary-button" disabled={!canSubmit || busy} onClick={() => void submit()}><Icon name="send" size={14}/>{busy ? 'Sending…' : 'Send to Support'}</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export function openSupportIntakeV77(detail: SupportIntakeV77Detail = {}) {
  dispatchSupportIntakeV77(detail)
}
