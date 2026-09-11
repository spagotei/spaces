import { useState, type FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { saveWorkspaceSession } from '../../api/session'
import {
  claimBetaAccount,
  getBetaClaimStatus,
  startBetaClaim,
  verifyBetaClaim,
} from '../../api/beta-claim'
import { useSpaces } from '../../state/SpacesContext'

type AuthStage = 'identify' | 'password' | 'two-factor' | 'beta-code' | 'beta-create'

export function LoginScreen() {
  const { login, loading, error } = useSpaces()
  const [stage, setStage] = useState<AuthStage>('identify')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [betaCode, setBetaCode] = useState('')
  const [claimToken, setClaimToken] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [betaBusy, setBetaBusy] = useState(false)
  const [localError, setLocalError] = useState('')
  const [notice, setNotice] = useState('')

  const cleanIdentifier = identifier.trim().toLowerCase()
  const isEmail = cleanIdentifier.includes('@')
  const busy = loading || betaBusy

  function resetForAnotherAccount() {
    setStage('identify')
    setPassword('')
    setTwoFactorCode('')
    setBetaCode('')
    setClaimToken('')
    setNewUsername('')
    setNewPassword('')
    setConfirmPassword('')
    setLocalError('')
    setNotice('')
  }

  async function continueIdentifier() {
    if (!cleanIdentifier) {
      setLocalError('Enter your username or email.')
      return
    }

    if (!isEmail) {
      setStage('password')
      return
    }

    setBetaBusy(true)
    try {
      const status = await getBetaClaimStatus(cleanIdentifier)
      if (status.mode === 'login') {
        setStage('password')
        return
      }
      if (status.mode === 'unavailable') {
        setLocalError('This email does not currently have access to Spaces.')
        return
      }

      const started = await startBetaClaim(cleanIdentifier)
      setNotice(`We sent a 6-digit code to ${started.email}.`)
      setBetaCode('')
      setStage('beta-code')
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Could not check beta access.')
    } finally {
      setBetaBusy(false)
    }
  }

  async function submitPassword() {
    if (!password) {
      setLocalError('Enter your password.')
      return
    }
    try {
      const result = await login(
        cleanIdentifier,
        password,
        stage === 'two-factor' ? twoFactorCode.trim() : undefined,
      )
      if (result === 'two-factor') {
        setStage('two-factor')
        setTwoFactorCode('')
      } else if (isEmail) {
        localStorage.setItem(`spaces.known-login.${cleanIdentifier}`, '1')
      }
    } catch {
      // SpacesContext provides the server error.
    }
  }

  async function verifyCode() {
    const code = betaCode.replace(/\D/g, '').slice(0, 6)
    if (code.length !== 6) {
      setLocalError('Enter the 6-digit code from your email.')
      return
    }
    setBetaBusy(true)
    try {
      const verified = await verifyBetaClaim(cleanIdentifier, code)
      setClaimToken(verified.claimToken)
      setNotice('Email verified. Choose your Spaces username and password.')
      setStage('beta-create')
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'That verification code could not be confirmed.')
    } finally {
      setBetaBusy(false)
    }
  }

  async function createBetaAccount() {
    const username = newUsername.trim().toLowerCase()
    if (!/^[a-z0-9_]{4,24}$/.test(username)) {
      setLocalError('Username must be 4-24 characters using lowercase letters, numbers, or underscore.')
      return
    }
    if (newPassword.length < 8) {
      setLocalError('Use at least 8 characters for your password.')
      return
    }
    if (newPassword !== confirmPassword) {
      setLocalError('Those passwords do not match.')
      return
    }
    if (!claimToken) {
      setLocalError('Your email verification expired. Start again.')
      return
    }

    setBetaBusy(true)
    try {
      const session = await claimBetaAccount({
        email: cleanIdentifier,
        claimToken,
        username,
        displayName: username,
        password: newPassword,
      })
      const nextSession = { ...session, loginIdentifier: cleanIdentifier, profileSetupRequired: false }
      saveWorkspaceSession(nextSession)
      localStorage.setItem(`spaces.known-login.${cleanIdentifier}`, '1')
      window.location.reload()
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Could not create your Spaces account.')
    } finally {
      setBetaBusy(false)
    }
  }

  async function resendCode() {
    setBetaBusy(true)
    setLocalError('')
    try {
      const started = await startBetaClaim(cleanIdentifier)
      setNotice(`A new code was sent to ${started.email}.`)
      setBetaCode('')
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Could not resend the code.')
    } finally {
      setBetaBusy(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLocalError('')
    if (stage === 'identify') return continueIdentifier()
    if (stage === 'password' || stage === 'two-factor') return submitPassword()
    if (stage === 'beta-code') return verifyCode()
    return createBetaAccount()
  }

  const eyebrow =
    stage === 'beta-code' ? 'VERIFY YOUR INVITE'
      : stage === 'beta-create' ? 'CREATE YOUR ACCOUNT'
        : stage === 'two-factor' ? 'TWO-FACTOR CHECK'
          : 'PRIVATE BETA'

  const title =
    stage === 'beta-code' ? 'Check your email'
      : stage === 'beta-create' ? 'You’re verified'
        : stage === 'two-factor' ? 'One more step'
          : stage === 'password' ? 'Welcome back'
            : 'Enter Spaces'

  return (
    <main className="login-stage login-stage-v59">
      <div className="login-network login-network-a" aria-hidden="true" />
      <div className="login-network login-network-b" aria-hidden="true" />
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <section className="login-brand">
        <div className="brand-mark brand-mark-large">S</div>
        <span className="eyebrow">PRIVATE BETA</span>
        <h1>Spaces</h1>
        <div className="login-slogan">Your Space, Your Needs.</div>
        <p>A place for your communities, projects, conversations, and shared work.</p>
      </section>

      <form className={`login-card login-card-v59 stage-${stage}`} onSubmit={submit}>
        <header>
          <div className="mini-lock"><Icon name={stage.startsWith('beta-') ? 'check' : 'lock'} /></div>
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
          </div>
        </header>

        {stage === 'identify' && (
          <>
            <p className="auth-step-copy-v59">
              Enter your email or username. Invited beta emails are verified before account creation.
            </p>
            <label className="field-label">
              Email or username
              <div className="input-shell">
                <Icon name="user" size={15} />
                <input
                  autoFocus
                  autoComplete="username"
                  value={identifier}
                  onChange={event => setIdentifier(event.target.value)}
                  placeholder="you@example.com or username"
                />
              </div>
            </label>
          </>
        )}

        {stage === 'password' && (
          <>
            <div className="auth-identity-pill-v59">
              <Icon name="user" size={14} />
              <span>{cleanIdentifier}</span>
            </div>
            <label className="field-label">
              Password
              <div className="input-shell">
                <Icon name="lock" size={15} />
                <input
                  autoFocus
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  placeholder="••••••••••••"
                />
              </div>
            </label>
            <button type="button" className="login-back-button" onClick={resetForAnotherAccount}>
              ← Use another account
            </button>
          </>
        )}

        {stage === 'two-factor' && (
          <>
            <div className="two-factor-login-copy">
              <span className="security-orb"><Icon name="shield" size={18} /></span>
              <p>Enter your authenticator code or an unused recovery code for <strong>{cleanIdentifier}</strong>.</p>
            </div>
            <label className="field-label">
              Authentication code
              <div className="input-shell two-factor-code-shell">
                <Icon name="lock" size={15} />
                <input
                  autoFocus
                  autoComplete="one-time-code"
                  inputMode="text"
                  value={twoFactorCode}
                  onChange={event => setTwoFactorCode(event.target.value.toUpperCase())}
                  placeholder="000000 or XXXX-XXXX"
                />
              </div>
            </label>
            <button type="button" className="login-back-button" onClick={resetForAnotherAccount}>
              ← Use another account
            </button>
          </>
        )}

        {stage === 'beta-code' && (
          <>
            <div className="beta-verified-email-v59">
              <Icon name="message" size={17} />
              <div>
                <strong>{cleanIdentifier}</strong>
                <span>Invitation found · verification required</span>
              </div>
            </div>
            <label className="field-label">
              6-digit verification code
              <div className="input-shell beta-code-shell-v59">
                <Icon name="lock" size={15} />
                <input
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={betaCode}
                  onChange={event => setBetaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                />
              </div>
            </label>
            <div className="beta-code-actions-v59">
              <button type="button" className="login-back-button" onClick={resetForAnotherAccount}>
                ← Different email
              </button>
              <button type="button" className="login-back-button" disabled={betaBusy} onClick={() => void resendCode()}>
                Resend code
              </button>
            </div>
          </>
        )}

        {stage === 'beta-create' && (
          <>
            <div className="beta-verified-email-v59 verified">
              <Icon name="check" size={17} />
              <div>
                <strong>{cleanIdentifier}</strong>
                <span>Verified email</span>
              </div>
            </div>
            <label className="field-label">
              Username
              <div className="input-shell">
                <span>@</span>
                <input
                  autoFocus
                  autoComplete="username"
                  value={newUsername}
                  onChange={event => setNewUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="yourname"
                  maxLength={24}
                />
              </div>
            </label>
            <label className="field-label">
              Password
              <div className="input-shell">
                <Icon name="lock" size={15} />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={event => setNewPassword(event.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>
            </label>
            <label className="field-label">
              Confirm password
              <div className="input-shell">
                <Icon name="check" size={15} />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={event => setConfirmPassword(event.target.value)}
                  placeholder="Repeat your password"
                />
              </div>
            </label>
          </>
        )}

        {notice && <div className="auth-notice-v59">{notice}</div>}
        {(localError || error) && <div className="form-error">{localError || error}</div>}

        <button className="primary-button primary-button-wide" disabled={busy}>
          {busy ? <span className="spinner" /> : (
            <Icon
              name={
                stage === 'beta-code' || stage === 'two-factor'
                  ? 'shield'
                  : stage === 'beta-create'
                    ? 'check'
                    : 'chevron'
              }
              size={16}
            />
          )}
          {busy
            ? 'Checking…'
            : stage === 'identify'
              ? 'Continue'
              : stage === 'password'
                ? 'Enter Spaces'
                : stage === 'two-factor'
                  ? 'Verify & enter'
                  : stage === 'beta-code'
                    ? 'Verify email'
                    : 'Create account'}
        </button>
      </form>
    </main>
  )
}
