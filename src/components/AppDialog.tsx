import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

type ConfirmOptions = {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

type PromptOptions = ConfirmOptions & {
  label?: string
  placeholder?: string
  initialValue?: string
  requiredText?: string
  maxLength?: number
}

type DialogRequest =
  | ({ kind: 'confirm'; id: number } & ConfirmOptions)
  | ({ kind: 'prompt'; id: number } & PromptOptions)

type DialogResult = boolean | string | null

type DialogApi = {
  confirm: (options: ConfirmOptions) => Promise<boolean>
  prompt: (options: PromptOptions) => Promise<string | null>
}

const AppDialogContext = createContext<DialogApi | null>(null)

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null)
  const [value, setValue] = useState('')
  const nextId = useRef(1)
  const resolver = useRef<((value: DialogResult) => void) | null>(null)

  const close = useCallback((result: DialogResult) => {
    const resolve = resolver.current
    resolver.current = null
    setRequest(null)
    setValue('')
    resolve?.(result)
  }, [])

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>(resolve => {
    resolver.current?.(false)
    resolver.current = result => resolve(Boolean(result))
    setValue('')
    setRequest({ kind: 'confirm', id: nextId.current++, ...options })
  }), [])

  const prompt = useCallback((options: PromptOptions) => new Promise<string | null>(resolve => {
    resolver.current?.(null)
    resolver.current = result => resolve(typeof result === 'string' ? result : null)
    setValue(options.initialValue ?? '')
    setRequest({ kind: 'prompt', id: nextId.current++, ...options })
  }), [])

  const api = useMemo(() => ({ confirm, prompt }), [confirm, prompt])
  const promptReady = request?.kind !== 'prompt' || (
    request.requiredText ? value === request.requiredText : Boolean(value.trim()) || !request.label
  )

  return <AppDialogContext.Provider value={api}>
    {children}
    {request && <div className="app-dialog-backdrop" onPointerDown={event => event.target === event.currentTarget && close(request.kind === 'confirm' ? false : null)}>
      <section className={`app-dialog ${request.danger ? 'danger' : ''}`} role="alertdialog" aria-modal="true" aria-labelledby={`app-dialog-title-${request.id}`}>
        <header>
          <span className="app-dialog-icon"><Icon name={request.danger ? 'trash' : 'sparkle'} size={17}/></span>
          <div><span className="eyebrow">SPACES</span><h2 id={`app-dialog-title-${request.id}`}>{request.title}</h2></div>
        </header>
        <p>{request.message}</p>
        {request.kind === 'prompt' && <label className="field-label app-dialog-field">
          {request.label ?? 'Details'}
          <input
            className="text-input"
            autoFocus
            value={value}
            maxLength={request.maxLength ?? 500}
            placeholder={request.placeholder}
            onChange={event => setValue(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Escape') close(null)
              if (event.key === 'Enter' && promptReady) close(value.trim())
            }}
          />
          {request.requiredText && <small>Type <strong>{request.requiredText}</strong> exactly to continue.</small>}
        </label>}
        <footer>
          <button className="secondary-button" onClick={() => close(request.kind === 'confirm' ? false : null)}>{request.cancelText ?? 'Cancel'}</button>
          <button className={request.danger ? 'danger-button' : 'primary-button'} disabled={!promptReady} onClick={() => close(request.kind === 'confirm' ? true : value.trim())}>{request.confirmText ?? 'Continue'}</button>
        </footer>
      </section>
    </div>}
  </AppDialogContext.Provider>
}

export function useAppDialog(): DialogApi {
  const value = useContext(AppDialogContext)
  if (!value) throw new Error('useAppDialog must be used inside AppDialogProvider.')
  return value
}
