import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { ImageCropper } from '../../components/ImageCropper'
import { useSpaces } from '../../state/SpacesContext'
import { gifFileToDataUrl, imageFileToRawDataUrl, isGifFile } from '../../utils/image'
import { validateUsername } from '../../utils/content-filter'

export function BetaProfileSetup() {
  const { session, completeBetaProfile, pushToast } = useSpaces()
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [cropSource, setCropSource] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const validation = useMemo(() => validateUsername(username), [username])
  const email = session?.loginIdentifier?.includes('@') ? session.loginIdentifier : null
  const canUseAnimatedProfileMedia = session?.profile.platformRole === 'founder'
  const profileImageAccept = canUseAnimatedProfileMedia ? 'image/png,image/jpeg,image/webp,image/gif' : 'image/png,image/jpeg,image/webp'

  async function pickAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      if (isGifFile(file)) {
        if (!canUseAnimatedProfileMedia) {
          pushToast('GIF profile images are reserved for the Spaces Founder.', 'info')
          return
        }
        setAvatarUrl(await gifFileToDataUrl(file))
        return
      }
      setCropSource(await imageFileToRawDataUrl(file))
    } catch (error) { pushToast(error instanceof Error ? error.message : 'Could not open that image.', 'danger') }
  }

  async function continueSetup() {
    if (!validation.ok || busy) return
    setBusy(true)
    try {
      await completeBetaProfile({
        username: validation.username,
        displayName: validation.username,
        avatarUrl,
      })
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not finish account setup.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  return <main className="beta-profile-stage-v33">
    <section className="beta-profile-card-v33">
      <div className="beta-profile-mark-v33"><Icon name="check" size={20}/></div>
      <span className="eyebrow">WELCOME TO SPACES</span>
      <h1>Finish your profile</h1>
      <p>{email ? <>Signed in as <strong>{email}</strong>. Choose how you’ll appear in Spaces.</> : <>Choose how you’ll appear in Spaces.</>}</p>

      <div className="beta-profile-avatar-v33">
        <button type="button" onClick={() => inputRef.current?.click()} aria-label="Choose profile picture">
          <Avatar name={username || 'Spaces'} initials={(username || 'S').slice(0, 2).toUpperCase()} src={avatarUrl} size={82}/>
          <span><Icon name="edit" size={13}/></span>
        </button>
        <div><strong>Profile picture</strong><span>Add a photo if you want. You can change it later.</span><button type="button" className="secondary-button compact" onClick={() => inputRef.current?.click()}>Choose picture</button></div>
        <input ref={inputRef} hidden type="file" accept={profileImageAccept} onChange={event => void pickAvatar(event)}/>
      </div>

      <label className="field-label beta-username-field-v33">
        Username
        <div className={`input-shell ${username && !validation.ok ? 'invalid-v33' : ''}`}><span>@</span><input autoFocus value={username} minLength={3} maxLength={24} autoComplete="username" spellCheck={false} onChange={event => setUsername(event.target.value)} placeholder="yourname"/></div>
        <small>{username && !validation.ok ? validation.message : 'Usernames must be at least 3 characters. Letters, numbers, periods, and underscores are allowed.'}</small>
      </label>

      <button className="primary-button primary-button-wide" disabled={!validation.ok || busy} onClick={() => void continueSetup()}>
        {busy ? <span className="spinner"/> : <Icon name="chevron" size={15}/>} {busy ? 'Saving…' : 'Continue to Spaces'}
      </button>
      <small className="beta-profile-lock-note-v33"><span className="spaces-purple-lock-v34"><Icon name="lock" size={11}/></span> Profile setup is required before continuing.</small>
    </section>
    {cropSource && <ImageCropper source={cropSource} preset="avatar" title="Profile picture" onCancel={() => setCropSource(null)} onSave={dataUrl => { setAvatarUrl(dataUrl); setCropSource(null) }}/>} 
  </main>
}
