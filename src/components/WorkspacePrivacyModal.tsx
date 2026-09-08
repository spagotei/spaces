import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { useSpaces } from '../state/SpacesContext'

export function WorkspacePrivacyModal({ workspaceId, workspaceName, onClose }: { workspaceId: string; workspaceName: string; onClose: () => void }) {
  const { getWorkspaceDmPreference, updateWorkspaceDmPreference, pushToast } = useSpaces()
  const [allowDms, setAllowDms] = useState(true)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void getWorkspaceDmPreference(workspaceId)
      .then(value => { if (!cancelled) setAllowDms(value.allowDms) })
      .catch(error => { if (!cancelled) pushToast(error instanceof Error ? error.message : 'Could not load privacy settings.', 'danger') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [getWorkspaceDmPreference, pushToast, workspaceId])

  async function toggle() {
    if (busy) return
    const next = !allowDms
    setBusy(true)
    setAllowDms(next)
    try {
      const saved = await updateWorkspaceDmPreference(workspaceId, next)
      setAllowDms(saved.allowDms)
      pushToast(saved.allowDms ? `Message requests enabled for ${workspaceName}.` : `Message requests disabled for ${workspaceName}.`, 'success')
    } catch (error) {
      setAllowDms(!next)
      pushToast(error instanceof Error ? error.message : 'Could not update privacy settings.', 'danger')
    } finally { setBusy(false) }
  }

  return <Modal title="Privacy & DMs" subtitle={`Control how people from ${workspaceName} can reach you.`} onClose={onClose}>
    <div className="workspace-privacy-v23">
      <div className="workspace-privacy-icon-v23"><Icon name="message" size={22}/></div>
      <div><span className="eyebrow">SPACE PRIVACY</span><h3>Message requests</h3><p>When enabled, members of this Space can send you a connection request from your profile. They cannot direct-message you until you accept.</p></div>
      <div className="setting-row workspace-privacy-row-v23"><div><strong>Allow message requests</strong><span>{loading ? 'Loading…' : allowDms ? 'Members in this Space can request to message you.' : 'New requests from this Space are blocked.'}</span></div><button type="button" className={`switch ${allowDms ? 'on' : ''}`} disabled={loading || busy} onClick={() => void toggle()} aria-pressed={allowDms}><i/></button></div>
      <small className="workspace-privacy-foot-v23">Existing accepted conversations are not removed when you turn this off.</small>
    </div>
  </Modal>
}
