import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import { Avatar } from '../../components/Avatar'
import { AnimatedBackdrop } from '../../components/AnimatedImage'
import { Icon, type IconName } from '../../components/Icon'
import { TotpQrCode } from '../../components/TotpQrCode'
import { Modal } from '../../components/Modal'
import { useAppDialog } from '../../components/AppDialog'
import { ImageCropper } from '../../components/ImageCropper'
import { usePreferences, type ContentFilterLevel, type MessageDensity, type NotificationLevel, type AppTheme } from '../../state/PreferencesContext'
import { useSpaces } from '../../state/SpacesContext'
import type { WorkspaceAccountSecurity, WorkspaceSessionInfo, WorkspaceTwoFactorSetup } from '../../types/spaces'
import { contentFilterExample } from '../../utils/content-filter'
import { gifFileToDataUrl, imageFileToRawDataUrl, isGifDataUrl, isGifFile } from '../../utils/image'
import { formatTime } from '../../utils/format'
import { platformRoleLabel } from '../../utils/permissions'

export type PersonalSettingsTab = 'profile' | 'content' | 'appearance' | 'notifications' | 'security' | 'developer'
type Tab = PersonalSettingsTab

const tabs: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'profile', label: 'My Profile', icon: 'user' },
  { id: 'content', label: 'Content & Safety', icon: 'shield' },
  { id: 'appearance', label: 'Appearance', icon: 'sparkle' },
  { id: 'notifications', label: 'Notifications', icon: 'bell' },
  { id: 'security', label: 'Security', icon: 'lock' },
  { id: 'developer', label: 'Developer Mode', icon: 'command' },
]

export function PersonalSettings({ onClose, initialTab = 'profile' }: { onClose: () => void; initialTab?: PersonalSettingsTab }) {
  const dialog = useAppDialog()
  const {
    profile, workspaces, updateProfile, setAvatar, setBanner, listSessions, revokeSession,
    changePassword, logout, pushToast, getAccountSecurity, startEmailVerification, verifyEmail,
    beginTwoFactorSetup, enableTwoFactor, disableTwoFactor, regenerateRecoveryCodes, createSupportCase,
  } = useSpaces()
  const { preferences, setPreference, resetPreferences } = usePreferences()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [profileAccent, setProfileAccent] = useState(profile?.profileAccent ?? '#8b6ca8')
  const [busy, setBusy] = useState(false)
  const [sessions, setSessions] = useState<WorkspaceSessionInfo[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [security, setSecurity] = useState<WorkspaceAccountSecurity | null>(null)
  const [securityLoading, setSecurityLoading] = useState(false)
  const [emailDraft, setEmailDraft] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [emailPending, setEmailPending] = useState(false)
  const [twoFactorSetup, setTwoFactorSetup] = useState<WorkspaceTwoFactorSetup | null>(null)
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [cropTarget, setCropTarget] = useState<{ kind: 'avatar' | 'banner'; source: string } | null>(null)
  const avatarInput = useRef<HTMLInputElement>(null)
  const bannerInput = useRef<HTMLInputElement>(null)
  const canUseAnimatedProfileMedia = profile?.platformRole === 'founder'
  const profileImageAccept = canUseAnimatedProfileMedia ? 'image/png,image/jpeg,image/webp,image/gif' : 'image/png,image/jpeg,image/webp'

  useEffect(() => {
    if (!profile) return
    setDisplayName(profile.displayName)
    setBio(profile.bio)
    setProfileAccent(profile.profileAccent || '#8b6ca8')
  }, [profile])

  useEffect(() => {
    if (tab !== 'security') return
    setSessionsLoading(true)
    setSecurityLoading(true)
    void Promise.all([
      listSessions().then(setSessions),
      getAccountSecurity().then(value => { setSecurity(value); setEmailDraft(value.email ?? '') }),
    ])
      .catch(error => pushToast(error instanceof Error ? error.message : 'Could not load account security.', 'danger'))
      .finally(() => { setSessionsLoading(false); setSecurityLoading(false) })
  }, [getAccountSecurity, listSessions, pushToast, tab])

  const moderationLevels = useMemo(() => (['none', 'low', 'medium', 'high'] as ContentFilterLevel[]), [])
  const profileDirty = Boolean(profile && (
    displayName !== profile.displayName ||
    bio !== profile.bio ||
    profileAccent !== (profile.profileAccent || '#8b6ca8')
  ))
  function resetProfileDraft() {
    if (!profile) return
    setDisplayName(profile.displayName)
    setBio(profile.bio)
    setProfileAccent(profile.profileAccent || '#8b6ca8')
  }

  async function saveProfile() {
    if (!displayName.trim() || busy) return
    setBusy(true)
    try {
      await updateProfile({
        displayName: displayName.trim(),
        bio: bio.slice(0, 240),
        publicProfile: profile?.publicProfile ?? true,
        profileAccent,
      })
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not save profile.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>, kind: 'avatar' | 'banner') {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      if (isGifFile(file)) {
        if (!canUseAnimatedProfileMedia) {
          pushToast('GIF profile images are reserved for the Spaces Founder.', 'info')
          return
        }
        setBusy(true)
        const source = await gifFileToDataUrl(file)
        if (kind === 'avatar') await setAvatar(source)
        else await setBanner(source)
        return
      }
      const source = await imageFileToRawDataUrl(file)
      setCropTarget({ kind, source })
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not upload image.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  function chooseImage(kind: 'avatar' | 'banner') {
    if (kind === 'avatar') avatarInput.current?.click()
    else bannerInput.current?.click()
  }

  function adjustCurrentImage(kind: 'avatar' | 'banner') {
    const current = kind === 'avatar' ? profile?.avatarUrl : profile?.bannerUrl
    if (current?.startsWith('data:image/')) setCropTarget({ kind, source: current })
    else chooseImage(kind)
  }

  async function submitPassword() {
    if (!currentPassword || newPassword.length < 8) return
    setBusy(true)
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not change password.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  async function removeSession(id: string) {
    try {
      await revokeSession(id)
      setSessions(current => current.filter(item => item.id !== id))
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not revoke session.', 'danger')
    }
  }

  async function sendEmailCode() {
    if (!emailDraft.trim() || busy) return
    setBusy(true)
    try {
      const result = await startEmailVerification(emailDraft.trim())
      setEmailDraft(result.email)
      setEmailPending(true)
      setEmailCode('')
      pushToast('Verification code sent.', 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not send verification email.', 'danger')
    } finally { setBusy(false) }
  }

  async function confirmEmail() {
    if (!emailCode.trim() || busy) return
    setBusy(true)
    try {
      const next = await verifyEmail(emailCode.trim())
      setSecurity(next)
      setEmailDraft(next.email ?? '')
      setEmailCode('')
      setEmailPending(false)
      pushToast('Email verified.', 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not verify that code.', 'danger')
    } finally { setBusy(false) }
  }

  async function startTwoFactor() {
    if (busy) return
    setBusy(true)
    try {
      const setup = await beginTwoFactorSetup()
      setTwoFactorSetup(setup)
      setTwoFactorCode('')
      setRecoveryCodes([])
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not start 2FA setup.', 'danger')
    } finally { setBusy(false) }
  }

  async function finishTwoFactor() {
    if (!twoFactorCode.trim() || busy) return
    setBusy(true)
    try {
      const result = await enableTwoFactor(twoFactorCode.trim())
      setSecurity(result.security)
      setRecoveryCodes(result.recoveryCodes)
      setTwoFactorSetup(null)
      setTwoFactorCode('')
      pushToast('Two-factor authentication enabled.', 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not enable 2FA.', 'danger')
    } finally { setBusy(false) }
  }

  async function turnOffTwoFactor() {
    if (!twoFactorCode.trim() || busy) return
    setBusy(true)
    try {
      const next = await disableTwoFactor(twoFactorCode.trim())
      setSecurity(next)
      setTwoFactorCode('')
      setRecoveryCodes([])
      pushToast('Two-factor authentication disabled.', 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not disable 2FA.', 'danger')
    } finally { setBusy(false) }
  }

  async function refreshRecoveryCodes() {
    if (!twoFactorCode.trim() || busy) return
    setBusy(true)
    try {
      const result = await regenerateRecoveryCodes(twoFactorCode.trim())
      setSecurity(result.security)
      setRecoveryCodes(result.recoveryCodes)
      setTwoFactorCode('')
      pushToast('New recovery codes created.', 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not regenerate recovery codes.', 'danger')
    } finally { setBusy(false) }
  }

  async function reportBug() {
    const subject = await dialog.prompt({ title: 'Report a bug', message: 'Give Support a short summary of what went wrong.', label: 'Bug summary', maxLength: 120, confirmText: 'Next' })
    if (!subject) return
    const details = await dialog.prompt({ title: 'Add bug details', message: 'Include what you were doing, what you expected, and what happened instead.', label: 'Details', maxLength: 1600, confirmText: 'Send bug report' })
    if (!details) return
    try {
      await createSupportCase({ kind: 'bug', subject, details })
      pushToast('Bug report sent to Spaces Support.', 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not send bug report.', 'danger')
    }
  }

  return (
    <Modal title="Settings" subtitle="Your account, safety and Spaces experience." onClose={onClose} wide>
      <div className="personal-settings-shell">
        <nav className="personal-settings-nav">
          <div className="settings-profile-mini">
            <Avatar name={profile?.displayName} initials={profile?.initials} src={profile?.avatarUrl} size={40} accent={profileAccent} animation="always" />
            <div><strong>{profile?.displayName}</strong><span>@{profile?.username}</span></div>
          </div>
          {tabs.map(item => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><Icon name={item.icon} size={16} /><span>{item.label}</span></button>)}
          <div className="settings-nav-spacer" />
          <button className="settings-signout" onClick={() => void logout()}><Icon name="logout" size={16} /><span>Sign out</span></button>
        </nav>

        <section className="personal-settings-content">
          {tab === 'profile' && <>
            <div className="settings-page-heading"><span className="eyebrow">IDENTITY</span><h2>My Profile</h2><p>How you appear across Spaces.</p></div>
            <div className="profile-editor-preview" style={{ '--profile-accent': profileAccent } as CSSProperties}>
              <div className="profile-editor-banner">
                {profile?.bannerUrl && <AnimatedBackdrop src={profile.bannerUrl} className="profile-editor-banner-media-v41" mode="always"/>}
                <button className="image-upload-button" disabled={busy} onClick={() => chooseImage('banner')}><Icon name="edit" size={14} /> Change banner</button>
              </div>
              <div className="profile-editor-identity">
                <button className="profile-avatar-edit" disabled={busy} onClick={() => chooseImage('avatar')}>
                  <Avatar name={profile?.displayName} initials={profile?.initials} src={profile?.avatarUrl} size={76} accent={profileAccent} animation="always" />
                  <span><Icon name="edit" size={14} /></span>
                </button>
                <div><h3>{displayName || profile?.displayName}</h3><p>@{profile?.username}{preferences.developerMode && profile?.publicUserId ? ` · #${profile.publicUserId}` : ''}</p></div>
                {profile?.platformRole && <span className={`founder-badge platform-${profile.platformRole}`}><Icon name="shield" size={13} /> {platformRoleLabel(profile.platformRole)}</span>}
              </div>
            </div>
            <input ref={avatarInput} hidden type="file" accept={profileImageAccept} onChange={event => void uploadImage(event, 'avatar')} />
            <input ref={bannerInput} hidden type="file" accept={profileImageAccept} onChange={event => void uploadImage(event, 'banner')} />
            {cropTarget && <ImageCropper source={cropTarget.source} preset={cropTarget.kind} title={cropTarget.kind === 'avatar' ? 'Edit profile photo' : 'Adjust profile banner'} onCancel={() => setCropTarget(null)} onSave={async dataUrl => { setBusy(true); try { if (cropTarget.kind === 'avatar') await setAvatar(dataUrl); else await setBanner(dataUrl); setCropTarget(null) } finally { setBusy(false) } }} />}

            <div className="profile-media-manager-v20">
              <div className="profile-media-row-v20"><div><strong>Profile photo</strong><span>Upload a new image any time, recrop the current one, or reset to your initials.</span></div><div className="settings-inline-actions"><button className="primary-button compact" disabled={busy} onClick={() => chooseImage('avatar')}><Icon name="upload" size={13}/>{profile?.avatarUrl ? 'Choose new' : 'Upload photo'}</button>{profile?.avatarUrl?.startsWith('data:image/') && !isGifDataUrl(profile.avatarUrl) && <button className="secondary-button compact" disabled={busy} onClick={() => adjustCurrentImage('avatar')}><Icon name="edit" size={13}/>Adjust crop</button>}<button className="secondary-button compact" disabled={busy || !profile?.avatarUrl} onClick={() => void setAvatar(null)}>Reset photo</button></div></div>
              <div className="profile-media-row-v20"><div><strong>Profile banner</strong><span>Replace the banner, adjust its crop, or clear it completely.</span></div><div className="settings-inline-actions"><button className="primary-button compact" disabled={busy} onClick={() => chooseImage('banner')}><Icon name="upload" size={13}/>{profile?.bannerUrl ? 'Choose new' : 'Upload banner'}</button>{profile?.bannerUrl?.startsWith('data:image/') && !isGifDataUrl(profile.bannerUrl) && <button className="secondary-button compact" disabled={busy} onClick={() => adjustCurrentImage('banner')}><Icon name="edit" size={13}/>Adjust crop</button>}<button className="secondary-button compact" disabled={busy || !profile?.bannerUrl} onClick={() => void setBanner(null)}>Clear banner</button></div></div>
            </div>

            <div className="settings-form-grid">
              <label className="field-label">Display name<input className="text-input" value={displayName} maxLength={40} onChange={event => setDisplayName(event.target.value)} /></label>
              <label className="field-label">Profile accent<div className="accent-field account-accent"><input type="color" value={profileAccent} onChange={event => setProfileAccent(event.target.value)} /><code>{profileAccent}</code></div></label>
              <label className="field-label span-2">About me<textarea className="text-area" rows={4} maxLength={240} value={bio} onChange={event => setBio(event.target.value)} /><small>{bio.length}/240</small></label>
            </div>
            {profileDirty && <div className="profile-save-bar unsaved-bar"><span><strong>You have unsaved profile changes.</strong><small>Review them before leaving this page.</small></span><div><button className="secondary-button compact" disabled={busy} onClick={resetProfileDraft}>Reset</button><button className="primary-button" disabled={busy || !displayName.trim()} onClick={() => void saveProfile()}>{busy ? 'Saving…' : 'Save changes'}</button></div></div>}
          </>}

          {tab === 'content' && <>
            <div className="settings-page-heading"><span className="eyebrow">PERSONAL MODERATION</span><h2>Content & Safety</h2><p>Control how strong language is displayed to you. Messages themselves are never changed.</p></div>
            <section className="moderation-card">
              <div className="moderation-card-head"><div><strong>Strong language filter</strong><span>Applied locally to chat, notes and comments.</span></div><div className="moderation-live-example"><span>You see</span><strong>{contentFilterExample(preferences.contentFilter)}</strong></div></div>
              <div className="moderation-levels">
                {moderationLevels.map(level => <button key={level} className={preferences.contentFilter === level ? 'active' : ''} onClick={() => setPreference('contentFilter', level)}><span>{level}</span><strong>{contentFilterExample(level)}</strong>{preferences.contentFilter === level && <Icon name="check" size={14} />}</button>)}
              </div>
              <p className="settings-footnote">Choose how strongly recognized language is masked on this device. Original messages are never changed.</p>
            </section>
            <section className="settings-card settings-card-stack support-report-card-v17">
              <div className="security-feature-heading compact"><span className="security-orb"><Icon name="sparkle" size={16}/></span><div><strong>Report a Spaces bug</strong><span>Send a bug directly into the Support Console with your account attached as the reporter.</span></div></div>
              <div className="settings-action-row"><button className="secondary-button" onClick={() => void reportBug()}><Icon name="activity" size={14}/> Report a bug</button></div>
            </section>
          </>}

          {tab === 'appearance' && <>
            <div className="settings-page-heading"><span className="eyebrow">DISPLAY</span><h2>Appearance</h2><p>Tune Spaces for desktop or a smaller phone screen.</p></div>
            <ChoiceRow title="App theme" description="Choose your personal Spaces atmosphere." value={preferences.appTheme} options={[['obsidian', 'Obsidian'], ['midnight', 'Midnight'], ['slate', 'Slate'], ['soft', 'Soft Glass']] as [AppTheme, string][]} onChange={value => setPreference('appTheme', value as AppTheme)} />
            <div className="setting-row personal-setting-row accent-preference-row">
              <div><strong>Accent color</strong><span>Spaces stays black; this changes the personal accent used across buttons, focus states, highlights and motion.</span></div>
              <div className="personal-accent-picker">
                <input aria-label="Accent color" type="color" value={preferences.appAccent} onChange={event => setPreference('appAccent', event.target.value)} />
                <code>{preferences.appAccent}</code>
                <div className="accent-swatches">
                  {['#8b6ca8','#d57b45','#4f8d78','#5f79b6','#b95d76','#c19b52'].map(color => <button key={color} aria-label={`Use ${color}`} className={preferences.appAccent === color ? 'active' : ''} style={{ background: color }} onClick={() => setPreference('appAccent', color)} />)}
                </div>
              </div>
            </div>
            <ChoiceRow title="Message density" description="Comfortable gives conversations more breathing room." value={preferences.messageDensity} options={[['comfortable', 'Comfortable'], ['compact', 'Compact']]} onChange={value => setPreference('messageDensity', value as MessageDensity)} />
            <ToggleRow title="Glass effects" description="Blurred translucent surfaces and layered depth." checked={preferences.glassEffects} onChange={value => setPreference('glassEffects', value)} />
            <ToggleRow title="Reduced motion" description="Cuts boot, panel, hover and message movement." checked={preferences.reducedMotion} onChange={value => setPreference('reducedMotion', value)} />
            <ToggleRow title="Spaces cursor" description="Use the subtle Spaces crosshair cursor on desktop. Touch devices always use native input." checked={preferences.customCursor} onChange={value => setPreference('customCursor', value)} />
            <ToggleRow title="Enter to send" description="Press Enter to send, Shift+Enter for a new line." checked={preferences.enterToSend} onChange={value => setPreference('enterToSend', value)} />
            <button className="secondary-button settings-reset" onClick={resetPreferences}>Reset personal appearance</button>
          </>}

          {tab === 'notifications' && <>
            <div className="settings-page-heading"><span className="eyebrow">ATTENTION</span><h2>Notifications</h2><p>Spaces-drawn alerts and ping controls for this device. No browser hostname notifications.</p></div>
            <ChoiceRow title="Message notifications" description="Choose the base notification level for conversations." value={preferences.notificationLevel} options={[['all', 'All messages'], ['mentions', 'Mentions only'], ['none', 'Nothing']]} onChange={value => setPreference('notificationLevel', value as NotificationLevel)} />
            <section className="settings-card settings-card-stack notification-ping-grid-v36">
              <div className="section-heading"><div><span className="eyebrow">PING TYPES</span><h3>Choose what can interrupt you</h3><p>These controls apply after your message notification level and per-Space mutes.</p></div></div>
              <ToggleRow title="Direct mentions" description="Notify when someone mentions you directly." checked={preferences.mentionNotifications} onChange={value => setPreference('mentionNotifications', value)} />
              <ToggleRow title="@everyone and @here" description="Allow whole-Space and active-member pings." checked={preferences.everyoneNotifications} onChange={value => setPreference('everyoneNotifications', value)} />
              <ToggleRow title="Role mentions" description="Notify when a role assigned to you is mentioned." checked={preferences.roleNotifications} onChange={value => setPreference('roleNotifications', value)} />
              <ToggleRow title="Spaces Support" description="Allow official Support notices even when normal messages are limited." checked={preferences.supportNotifications} onChange={value => setPreference('supportNotifications', value)} />
              <ToggleRow title="In-app previews" description="Show the small notification card while you are using Spaces." checked={preferences.notificationPreviews} onChange={value => setPreference('notificationPreviews', value)} />
              <ToggleRow title="Notification sounds" description="Play the Spaces sound assigned to an incoming notification." checked={preferences.desktopSounds} onChange={value => setPreference('desktopSounds', value)} />
            </section>
            <section className="space-notification-controls">
              <div className="section-heading"><div><span className="eyebrow">SPACES</span><h3>Per-Space controls</h3><p>Mute noisy Spaces or hide them from your rails without leaving.</p></div></div>
              <div className="space-preference-list">
                {workspaces.map(space => {
                  const muted = preferences.mutedWorkspaceIds.includes(space.id)
                  const hidden = preferences.hiddenWorkspaceIds.includes(space.id)
                  const permanent = space.id === 'spaces-hub'
                  return <div className="space-preference-row" key={space.id}>
                    <Avatar name={space.name} initials={space.initials} src={space.avatarUrl} size={34} accent={space.accentColor} />
                    <div><strong>{space.name}</strong><span>{permanent ? 'Permanent platform Space' : 'Your Space'}</span></div>
                    <button className={`mini-toggle ${muted ? 'active' : ''}`} onClick={() => setPreference('mutedWorkspaceIds', muted ? preferences.mutedWorkspaceIds.filter(id => id !== space.id) : [...preferences.mutedWorkspaceIds, space.id])}><Icon name={muted ? 'bell' : 'bell'} size={13}/>{muted ? 'Muted' : 'Mute'}</button>
                    <button className={`mini-toggle ${hidden ? 'active' : ''}`} onClick={() => setPreference('hiddenWorkspaceIds', hidden ? preferences.hiddenWorkspaceIds.filter(id => id !== space.id) : [...preferences.hiddenWorkspaceIds, space.id])}>{hidden ? 'Unhide' : 'Hide'}</button>
                  </div>
                })}
              </div>
            </section>
          </>}

          {tab === 'security' && <>
            <div className="settings-page-heading"><span className="eyebrow">ACCOUNT SECURITY</span><h2>Email, 2FA & Sessions</h2><p>Secure your account without leaving Spaces. Codes and status stay inside the app UI.</p></div>

            {securityLoading ? <div className="settings-loading security-loading-v16">Loading security status…</div> : <>
              <section className="security-overview-v16">
                <article className={security?.emailVerified ? 'secure' : ''}><span><Icon name="user" size={17}/></span><div><strong>Email</strong><small>{security?.emailVerified ? security.email : 'Not verified'}</small></div><b>{security?.emailVerified ? 'VERIFIED' : 'SET UP'}</b></article>
                <article className={security?.twoFactorEnabled ? 'secure' : ''}><span><Icon name="shield" size={17}/></span><div><strong>Authenticator 2FA</strong><small>{security?.twoFactorEnabled ? 'Required at sign in' : 'Recommended'}</small></div><b>{security?.twoFactorEnabled ? 'ON' : 'OFF'}</b></article>
                <article><span><Icon name="monitor" size={17}/></span><div><strong>Sessions</strong><small>{sessions.length} active device{sessions.length === 1 ? '' : 's'}</small></div><b>LIVE</b></article>
              </section>

              <section className="settings-card settings-card-stack security-feature-card">
                <div className="security-feature-heading"><span className="security-orb"><Icon name="user" size={17}/></span><div><strong>Verified email</strong><span>Used for security notices and account verification. It is never shown on your public profile.</span></div>{security?.emailVerified && <span className="security-state-pill secure"><Icon name="check" size={11}/> Verified</span>}</div>
                <label className="field-label">Email address<input className="text-input" type="email" autoComplete="email" value={emailDraft} onChange={event => { setEmailDraft(event.target.value); setEmailPending(false) }} placeholder="you@example.com" /></label>
                <div className="settings-action-row security-inline-actions security-email-actions-v23">
                  <button className="primary-button" disabled={busy || !emailDraft.trim() || (!security?.emailServiceAvailable || !security?.emailSenderConfigured)} onClick={() => void sendEmailCode()}><Icon name="send" size={13}/>{security?.emailVerified && emailDraft === security.email ? 'Resend code' : 'Send verification code'}</button>
                </div>
                {(!security?.emailServiceAvailable || !security?.emailSenderConfigured) && <div className="security-service-card-v23"><Icon name="activity" size={14}/><div><strong>Email delivery is not connected yet.</strong><span>Your email field is ready; verification will unlock as soon as the Spaces Email binding is configured.</span></div></div>}
                {emailPending && <div className="security-code-panel"><label className="field-label">6-digit email code<input className="text-input security-code-input" inputMode="numeric" autoComplete="one-time-code" value={emailCode} maxLength={6} onChange={event => setEmailCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" /></label><button className="primary-button" disabled={busy || emailCode.length !== 6} onClick={() => void confirmEmail()}>Verify email</button></div>}
              </section>

              <section className="settings-card settings-card-stack security-feature-card two-factor-card-v16">
                <div className="security-feature-heading"><span className="security-orb"><Icon name="shield" size={17}/></span><div><strong>Authenticator two-factor authentication</strong><span>Live now with standard TOTP authenticator apps. Email is not required.</span></div><span className={`security-state-pill ${security?.twoFactorEnabled ? 'secure' : ''}`}>{security?.twoFactorEnabled ? 'Enabled' : 'Optional'}</span></div>

                {!security?.twoFactorEnabled && !twoFactorSetup && <button className="primary-button security-main-action" disabled={busy} onClick={() => void startTwoFactor()}><Icon name="shield" size={14}/> Set up authenticator</button>}

                {twoFactorSetup && <div className="two-factor-setup-v16">
                  <div className="two-factor-step"><b>1</b><div><strong>Add Spaces to your authenticator</strong><span>Tap the button on mobile or copy the secret into any TOTP app.</span></div></div>
                  <TotpQrCode uri={twoFactorSetup.otpauthUri} accountLabel={`Spaces @${profile?.username ?? 'account'}`} />
                  <div className="totp-secret-box"><code>{twoFactorSetup.secret}</code><div className="totp-secret-actions-v23"><button className="secondary-button compact" onClick={() => void navigator.clipboard.writeText(twoFactorSetup.secret)}><Icon name="copy" size={12}/>Copy setup key</button><button className="secondary-button compact" onClick={() => void navigator.clipboard.writeText(twoFactorSetup.otpauthUri)}><Icon name="copy" size={12}/>Copy authenticator link</button></div></div>
                  <a className="primary-button authenticator-link" href={twoFactorSetup.otpauthUri}><Icon name="shield" size={13}/>Open authenticator app</a>
                  <div className="two-factor-step"><b>2</b><div><strong>Confirm the 6-digit code</strong><span>Enter the current code to finish enabling 2FA.</span></div></div>
                  <div className="security-code-panel"><label className="field-label">Authenticator code<input className="text-input security-code-input" inputMode="numeric" autoComplete="one-time-code" value={twoFactorCode} maxLength={6} onChange={event => setTwoFactorCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" /></label><button className="primary-button" disabled={busy || twoFactorCode.length !== 6} onClick={() => void finishTwoFactor()}>Enable 2FA</button><button className="secondary-button" onClick={() => { setTwoFactorSetup(null); setTwoFactorCode('') }}>Cancel</button></div>
                </div>}

                {security?.twoFactorEnabled && <div className="two-factor-enabled-v16">
                  <div className="security-success-banner"><Icon name="check" size={15}/><div><strong>Two-factor is protecting this account.</strong><span>{security.recoveryCodesRemaining} unused recovery code{security.recoveryCodesRemaining === 1 ? '' : 's'} remain.</span></div></div>
                  <label className="field-label">Current authenticator code<input className="text-input security-code-input" inputMode="numeric" autoComplete="one-time-code" value={twoFactorCode} maxLength={6} onChange={event => setTwoFactorCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" /></label>
                  <div className="settings-action-row"><button className="secondary-button" disabled={busy || twoFactorCode.length !== 6} onClick={() => void refreshRecoveryCodes()}>Generate new recovery codes</button><button className="ghost-danger" disabled={busy || twoFactorCode.length !== 6} onClick={() => void turnOffTwoFactor()}>Disable 2FA</button></div>
                </div>}

                {recoveryCodes.length > 0 && <div className="recovery-code-panel-v16"><div><span className="eyebrow">SAVE THESE NOW</span><h3>Recovery codes</h3><p>Each code works once if you lose your authenticator. Spaces only shows this set once.</p></div><div className="recovery-code-grid">{recoveryCodes.map(code => <code key={code}>{code}</code>)}</div><button className="secondary-button" onClick={() => void navigator.clipboard.writeText(recoveryCodes.join('\n'))}><Icon name="copy" size={13}/> Copy all codes</button></div>}
              </section>
            </>}

            <section className="settings-card settings-card-stack security-card">
              <div className="security-feature-heading compact"><span className="security-orb"><Icon name="lock" size={16}/></span><div><strong>Password</strong><span>Changing it invalidates other sessions on the backend.</span></div></div>
              <label className="field-label">Current password<input className="text-input" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></label>
              <label className="field-label">New password<input className="text-input" type="password" autoComplete="new-password" value={newPassword} minLength={8} onChange={event => setNewPassword(event.target.value)} placeholder="8+ characters" /></label>
              <div className="settings-action-row"><button className="primary-button" disabled={busy || !currentPassword || newPassword.length < 8} onClick={() => void submitPassword()}>Change password</button></div>
            </section>
            <section className="sessions-section">
              <div className="section-heading"><div><span className="eyebrow">SIGNED IN</span><h3>Sessions</h3></div><button className="icon-button" title="Refresh" onClick={() => { setSessionsLoading(true); void listSessions().then(setSessions).finally(() => setSessionsLoading(false)) }}><Icon name="refresh" size={15} /></button></div>
              {sessionsLoading ? <div className="settings-loading">Loading sessions…</div> : <div className="session-list">{sessions.map(item => <div className="session-row" key={item.id}><span className={`session-pip ${item.current ? 'current' : ''}`} /><div><strong>{item.current ? 'This device' : 'Spaces session'}</strong><span>Last active {formatTime(item.lastSeenAt)}</span></div>{!item.current && <button className="ghost-danger" onClick={() => void removeSession(item.id)}>Revoke</button>}</div>)}{!sessions.length && <p className="settings-footnote">No sessions returned.</p>}</div>}
            </section>
          </>}

          {tab === 'developer' && <>
            <div className="settings-page-heading"><span className="eyebrow">DEVELOPER</span><h2>Developer Mode</h2><p>Expose stable Spaces IDs for support, testing, and internal tooling.</p></div>
            <section className="settings-card settings-card-stack developer-settings-card-v23">
              <div className="security-feature-heading"><span className="security-orb"><Icon name="command" size={17}/></span><div><strong>Developer mode</strong><span>Show generated Spaces IDs on member profiles and account surfaces. Internal UUIDs stay hidden.</span></div></div>
              <ToggleRow title="Show Spaces IDs" description="Adds copyable IDs such as #00001 and #00100 to profiles you can already view." checked={preferences.developerMode} onChange={value => setPreference('developerMode', value)} />
              {profile?.publicUserId && <div className="developer-own-id-v23"><div><span className="eyebrow">YOUR SPACES ID</span><strong>#{profile.publicUserId}</strong><small>This ID is safe to share with Spaces Support.</small></div><button className="secondary-button" onClick={() => { void navigator.clipboard.writeText(profile.publicUserId); pushToast(`Copied Spaces ID #${profile.publicUserId}.`, 'success') }}><Icon name="copy" size={13}/>Copy ID</button></div>}
            </section>
            <section className="settings-card developer-note-v23"><Icon name="shield" size={15}/><p>Developer Mode changes only what this device displays. It does not grant moderation, staff, or API permissions.</p></section>
          </>}
        </section>
      </div>
    </Modal>
  )
}

function ToggleRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <div className="setting-row personal-setting-row"><div><strong>{title}</strong><span>{description}</span></div><button type="button" className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)} aria-pressed={checked}><i /></button></div>
}

function ChoiceRow({ title, description, value, options, onChange }: { title: string; description: string; value: string; options: [string, string][]; onChange: (value: string) => void }) {
  return <div className="setting-row personal-setting-row align-start"><div><strong>{title}</strong><span>{description}</span></div><div className="choice-pills">{options.map(([id, label]) => <button key={id} className={value === id ? 'active' : ''} onClick={() => onChange(id)}>{label}</button>)}</div></div>
}
