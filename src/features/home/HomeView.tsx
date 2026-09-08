import { useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import { Avatar } from '../../components/Avatar'
import { AnimatedBackdrop } from '../../components/AnimatedImage'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { ImageCropper } from '../../components/ImageCropper'
import { useSpaces } from '../../state/SpacesContext'
import { usePreferences } from '../../state/PreferencesContext'
import { timeAgo } from '../../utils/format'
import { gifFileToDataUrl, imageFileToRawDataUrl, isGifFile } from '../../utils/image'

function nextHomeGreeting() {
  const hour = new Date().getHours()
  const bucket = hour >= 20 || hour < 8 ? 'night' : hour >= 12 ? 'afternoon' : 'morning'
  const sessionKey = 'spaces.homeGreeting.bucket.v41'
  const fallbackKey = 'spaces.homeGreeting.fallback.v41'
  const seenBucket = sessionStorage.getItem(sessionKey)

  if (seenBucket !== bucket) {
    sessionStorage.setItem(sessionKey, bucket)
    sessionStorage.setItem(fallbackKey, '0')
    return bucket === 'morning' ? 'GOOD MORNING' : bucket === 'afternoon' ? 'GOOD AFTERNOON' : 'GOOD NIGHT'
  }

  const fallback = Number(sessionStorage.getItem(fallbackKey) || 0)
  sessionStorage.setItem(fallbackKey, String(fallback + 1))
  return fallback % 2 === 0 ? 'GOOD TO SEE YOU' : 'WELCOME BACK'
}

export function HomeView() {
  const { profile, workspaces, notifications, clearNotifications, chooseWorkspace, createWorkspace, joinWorkspace, pushToast } = useSpaces()
  const { preferences, setPreference } = usePreferences()
  const [dialog, setDialog] = useState<'create' | 'join' | null>(null)
  const [greeting] = useState(nextHomeGreeting)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [spaceDescription, setSpaceDescription] = useState('')
  const [spaceAvatarUrl, setSpaceAvatarUrl] = useState<string | null>(null)
  const [spaceAccent, setSpaceAccent] = useState('#8b6ca8')
  const [spaceCropSource, setSpaceCropSource] = useState<string | null>(null)
  const spaceAvatarInput = useRef<HTMLInputElement>(null)
  const canUseAnimatedCreatedSpace = profile?.platformRole === 'founder'
  const createdSpaceImageAccept = canUseAnimatedCreatedSpace ? 'image/png,image/jpeg,image/webp,image/gif' : 'image/png,image/jpeg,image/webp'
  const visibleWorkspaces = workspaces.filter(space => !preferences.hiddenWorkspaceIds.includes(space.id))
  const hiddenWorkspaces = workspaces.filter(space => preferences.hiddenWorkspaceIds.includes(space.id))
  const visibleNotifications = notifications.filter(item => !preferences.mutedWorkspaceIds.includes(item.workspaceId) && !preferences.mutedChannelIds.includes(item.channelId))
  const firstNotification = visibleNotifications[0]

  function openNotifications() {
    window.dispatchEvent(new CustomEvent('spaces-open-notifications'))
  }

  async function submit() {
    if (!value.trim()) return
    setBusy(true)
    try {
      if (dialog === 'create') await createWorkspace(value.trim(), { description: spaceDescription.trim(), avatarUrl: spaceAvatarUrl, accentColor: spaceAccent })
      if (dialog === 'join') await joinWorkspace(value.trim())
      setDialog(null)
      setValue('')
      setSpaceDescription('')
      setSpaceAvatarUrl(null)
      setSpaceAccent('#8b6ca8')
    } finally {
      setBusy(false)
    }
  }

  async function chooseSpaceAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      if (isGifFile(file)) {
        if (!canUseAnimatedCreatedSpace) {
          pushToast('GIF Space pictures are reserved for Founder-owned Spaces.', 'info')
          return
        }
        setSpaceAvatarUrl(await gifFileToDataUrl(file))
        return
      }
      setSpaceCropSource(await imageFileToRawDataUrl(file))
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Could not prepare that image.', 'danger')
    }
  }

  return (
    <div className="view-scroll home-view page-enter">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow hero-greeting-v41">{greeting}</span>
          <h1 className="hero-name-v41"><span>{profile?.displayName ?? 'Welcome'}</span><span className="hero-dot">.</span></h1>
          <p>Pick up where your team left off, jump into a conversation, or build a new Space around the next thing.</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => setDialog('create')}><Icon name="plus" size={16} /> New Space</button>
            <button className="secondary-button" onClick={() => setDialog('join')}><Icon name="grid" size={16} /> Join with code</button>
          </div>
        </div>
        <aside className={`hero-missed ${visibleNotifications.length ? 'has-items' : ''}`} onClick={visibleNotifications.length ? openNotifications : undefined}>
          <div className="hero-missed-head"><span><Icon name="bell" size={15}/> SEE WHAT YOU MISSED</span><strong>{visibleNotifications.length ? `${visibleNotifications.length} update${visibleNotifications.length === 1 ? '' : 's'}` : 'All clear'}</strong></div>
          {firstNotification ? <>
            <p><b>{firstNotification.authorName}</b> mentioned you in {firstNotification.workspaceName}: “{firstNotification.preview}”</p>
            <div className="hero-missed-actions">
              <button onClick={event => { event.stopPropagation(); openNotifications() }}>View notifications <Icon name="chevron" size={14}/></button>
              <button onClick={event => { event.stopPropagation(); clearNotifications() }}>Clear</button>
            </div>
          </> : <>
            <p>No unread mentions yet. Replies, @mentions and important activity can surface here.</p>
            <button onClick={() => visibleWorkspaces[0] && void chooseWorkspace(visibleWorkspaces[0].id)} disabled={!visibleWorkspaces.length}>Jump back in <Icon name="chevron" size={14}/></button>
          </>}
        </aside>
      </section>


      <section className="home-people-v23">
        <div className="home-people-copy-v23"><span className="eyebrow">PEOPLE</span><h2>Connections & message requests</h2><p>Add someone by username, review requests, and jump back into direct conversations.</p></div>
        <div className="home-people-actions-v23">
          <button className="primary-button" onClick={() => { window.dispatchEvent(new CustomEvent('spaces-open-direct-center')); window.setTimeout(() => window.dispatchEvent(new CustomEvent('spaces-direct-tab', { detail: 'add' })), 0) }}><Icon name="plus" size={14}/> Add a Person</button>
          <button className="secondary-button" onClick={() => { window.dispatchEvent(new CustomEvent('spaces-open-direct-center')); window.setTimeout(() => window.dispatchEvent(new CustomEvent('spaces-direct-tab', { detail: 'requests' })), 0) }}><Icon name="message" size={14}/> Message Requests</button>
          <button className="secondary-button" onClick={() => window.dispatchEvent(new CustomEvent('spaces-open-direct-center'))}><Icon name="members" size={14}/> Your People</button>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading"><div><span className="eyebrow">JUMP BACK IN</span><h2>Your Spaces</h2></div><span className="section-count">{visibleWorkspaces.length}</span></div>
        {visibleWorkspaces.length ? (
          <div className="space-card-grid">
            {visibleWorkspaces.map((space, index) => (
              <button className="space-card" key={space.id} onClick={() => void chooseWorkspace(space.id)} style={{ '--delay': `${index * 45}ms`, '--space-accent': space.accentColor } as CSSProperties}>
                <div className="space-card-banner">{space.bannerUrl && <AnimatedBackdrop src={space.bannerUrl} className="space-card-banner-media-v41" mode="still"/>}</div>
                <div className="space-card-body">
                  <span className={`space-icon-decor icon-decor-${space.iconDecoration ?? 'ring'}`} style={{ '--decor-accent': space.accentColor } as CSSProperties}><Avatar name={space.name} initials={space.initials} src={space.avatarUrl} size={46} accent={space.accentColor} /></span>
                  <div><strong>{space.name}</strong><span>{space.description || 'Shared Space'}</span></div>
                  <Icon name="chevron" size={17} className="card-chevron" />
                </div>
                <div className="space-card-meta"><span>{space.role}</span><span>Created {timeAgo(space.createdAt)}</span></div>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state"><div className="empty-icon"><Icon name="grid" /></div><h3>No Spaces yet</h3><p>Create your first Space or join one with an invite code.</p></div>
        )}
      </section>

      {hiddenWorkspaces.length > 0 && <section className="hidden-spaces-strip">
        <div><Icon name="lock" size={14}/><span>{hiddenWorkspaces.length} hidden Space{hiddenWorkspaces.length === 1 ? '' : 's'}</span></div>
        <div>{hiddenWorkspaces.map(space => <button key={space.id} onClick={() => setPreference('hiddenWorkspaceIds', preferences.hiddenWorkspaceIds.filter(id => id !== space.id))}>Show {space.name}</button>)}</div>
      </section>}

      <section className="dashboard-strip">
        <article><Icon name="chat" /><div><strong>Conversations</strong><span>Chat, custom emoji and files in one place.</span></div></article>
        <article><Icon name="notes" /><div><strong>Shared notes</strong><span>Collaborate without turning every thought into a message.</span></div></article>
        <article><Icon name="roles" /><div><strong>Real permissions</strong><span>Stackable roles and fine-grained moderation controls.</span></div></article>
      </section>

      {dialog && (
        <Modal title={dialog === 'create' ? 'Create a Space' : 'Join a Space'} subtitle={dialog === 'create' ? 'Give your group a name, picture and starting look.' : 'Paste a Space code or invite code.'} onClose={() => setDialog(null)}>
          {dialog === 'create' && <div className="create-space-profile-v28"><button className="create-space-avatar-v28" onClick={() => spaceAvatarInput.current?.click()}><Avatar name={value || 'New Space'} initials={(value || 'NS').slice(0,2).toUpperCase()} src={spaceAvatarUrl} size={70} accent={spaceAccent}/><span><Icon name="edit" size={13}/></span></button><div><strong>Space picture</strong><small>Optional. You can change this later.</small><button className="secondary-button compact" onClick={() => spaceAvatarInput.current?.click()}><Icon name="upload" size={13}/>Choose picture</button></div><input ref={spaceAvatarInput} hidden type="file" accept={createdSpaceImageAccept} onChange={event => void chooseSpaceAvatar(event)}/></div>}
          <label className="field-label">{dialog === 'create' ? 'Space name' : 'Invite code'}<input className="text-input" autoFocus value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && void submit()} placeholder={dialog === 'create' ? 'Midnight Studio' : 'ABC123'} /></label>
          {dialog === 'create' && <><label className="field-label">Description<textarea className="text-area" value={spaceDescription} onChange={e => setSpaceDescription(e.target.value)} maxLength={220} rows={3} placeholder="What is this Space for?"/></label><label className="field-label create-space-color-v28">Accent<input type="color" value={spaceAccent} onChange={e => setSpaceAccent(e.target.value)}/><code>{spaceAccent}</code></label></>}
          <div className="modal-actions"><button className="secondary-button" onClick={() => setDialog(null)}>Cancel</button><button className="primary-button" disabled={busy || !value.trim()} onClick={() => void submit()}>{busy ? 'Working…' : dialog === 'create' ? 'Create Space' : 'Join Space'}</button></div>
        </Modal>
      )}
      {spaceCropSource && <ImageCropper source={spaceCropSource} preset="avatar" title="Edit Space picture" onCancel={() => setSpaceCropSource(null)} onSave={dataUrl => { setSpaceAvatarUrl(dataUrl); setSpaceCropSource(null) }}/>}
    </div>
  )
}
