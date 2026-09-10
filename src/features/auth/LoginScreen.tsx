import { useState, type FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { useSpaces } from '../../state/SpacesContext'

export function LoginScreen() {
  const { login, loading, error } = useSpaces()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false)
  const [localError, setLocalError] = useState('')
  const cleanIdentifier = username.trim().toLowerCase()
  const isEmailIdentifier = cleanIdentifier.includes('@')
  const firstEmailSignIn = isEmailIdentifier && localStorage.getItem(`spaces.known-login.${cleanIdentifier}`) !== '1'

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLocalError('')
    if (!username.trim() || !password) {
      setLocalError('Enter your username or email and password.')
      return
    }
    if (needsTwoFactor && !twoFactorCode.trim()) {
      setLocalError('Enter your authenticator or recovery code.')
      return
    }
    try {
      const result = await login(username, password, needsTwoFactor ? twoFactorCode.trim() : undefined)
      if (result === 'two-factor') {
        setNeedsTwoFactor(true)
        setTwoFactorCode('')
      } else if (isEmailIdentifier) {
        localStorage.setItem(`spaces.known-login.${cleanIdentifier}`, '1')
      }
    } catch {
      // Context provides the server message.
    }
  }

  return (
    <main className="login-stage">
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

      <form className={`login-card ${needsTwoFactor ? 'login-card-2fa' : ''}`} onSubmit={submit}>
        <header>
          <div className="mini-lock"><Icon name="lock" /></div>
          <div>
            <span className="eyebrow">{needsTwoFactor ? 'TWO-FACTOR CHECK' : firstEmailSignIn ? 'INVITED ACCESS' : 'AUTHORIZED ACCESS'}</span>
            <h2>{needsTwoFactor ? 'One more step' : firstEmailSignIn ? 'Your invite is ready' : 'Welcome back'}</h2>
          </div>
        </header>

        {!needsTwoFactor ? <>
          {firstEmailSignIn && <div className="invite-login-note-v34"><span className="spaces-purple-lock-v34"><Icon name="lock" size={14}/></span><p>Sign in with the email address your Spaces invite was sent to.</p></div>}
          <label className="field-label">
            Username or email
            <div className="input-shell"><Icon name="user" size={15}/><input autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="username or email" /></div>
          </label>

          <label className="field-label">
            Password
            <div className="input-shell"><Icon name="lock" size={15} /><input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••••••" /></div>
          </label>
        </> : <>
          <div className="two-factor-login-copy"><span className="security-orb"><Icon name="shield" size={18}/></span><p>Two-factor authentication is enabled for <strong>{username.includes('@') ? username : `@${username}`}</strong>. Enter the 6-digit code from your authenticator, or one unused recovery code.</p></div>
          <label className="field-label">
            Authentication code
            <div className="input-shell two-factor-code-shell"><Icon name="lock" size={15}/><input autoFocus autoComplete="one-time-code" inputMode="text" value={twoFactorCode} onChange={e => setTwoFactorCode(e.target.value.toUpperCase())} placeholder="000000 or XXXX-XXXX" /></div>
          </label>
          <button type="button" className="login-back-button" onClick={() => { setNeedsTwoFactor(false); setTwoFactorCode(''); setLocalError('') }}>← Use another account</button>
        </>}

        {(localError || error) && <div className="form-error">{localError || error}</div>}

        <button className="primary-button primary-button-wide" disabled={loading}>
          {loading ? <span className="spinner" /> : <Icon name={needsTwoFactor ? 'shield' : 'sparkle'} size={16} />}
          {loading ? 'Checking…' : needsTwoFactor ? 'Verify & enter' : 'Enter Spaces'}
        </button>
      </form>
    </main>
  )
}
