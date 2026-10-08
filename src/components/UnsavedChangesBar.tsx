import { useEffect } from 'react'

export function UnsavedChangesBar({
  dirty,
  busy = false,
  onReset,
  onSave,
}: {
  dirty: boolean
  busy?: boolean
  onReset: () => void
  onSave: () => void | Promise<void>
}) {
  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])

  if (!dirty) return null
  return (
    <div className="unsaved-changes-v70" role="status" aria-live="polite">
      <strong>You have unsaved changes</strong>
      <div>
        <button type="button" className="secondary-button" disabled={busy} onClick={onReset}>Reset</button>
        <button type="button" className="primary-button" disabled={busy} onClick={() => void onSave()}>{busy ? 'Saving...' : 'Save Changes'}</button>
      </div>
    </div>
  )
}
