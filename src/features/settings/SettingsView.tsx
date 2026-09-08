import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import { Avatar } from '../../components/Avatar'
import { AnimatedBackdrop } from '../../components/AnimatedImage'
import { Icon } from '../../components/Icon'
import { ImageCropper } from '../../components/ImageCropper'
import { useAppDialog } from '../../components/AppDialog'
import { ChannelPermissionsEditor } from '../../components/ChannelPermissionsEditor'
import { EmojiView } from '../emoji/EmojiView'
import { useSpaces } from '../../state/SpacesContext'
import { usePreferences } from '../../state/PreferencesContext'
import { hasWorkspacePermission } from '../../utils/permissions'
import { gifFileToDataUrl, imageFileToRawDataUrl, isGifDataUrl, isGifFile } from '../../utils/image'
import { getWorkspaceNumber } from '../../utils/workspace-local-meta'
import type { WorkspaceBackgroundPreset, WorkspaceChannel, WorkspaceIconDecoration } from '../../types/spaces'

type SpaceSettingsTab = 'profile' | 'appearance' | 'notifications' | 'channels' | 'access' | 'advanced'

const iconDecorations: { id: WorkspaceIconDecoration; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'ring', label: 'Ring' },
  { id: 'double', label: 'Double' },
  { id: 'halo', label: 'Halo' },
]

const backgrounds: { id: WorkspaceBackgroundPreset; label: string }[] = [
  { id: 'graphite', label: 'Graphite' }, { id: 'midnight', label: 'Midnight' },
  { id: 'slate', label: 'Slate' }, { id: 'black', label: 'Black' },
  { id: 'carbon', label: 'Carbon' }, { id: 'deep-space', label: 'Deep Space' },
  { id: 'glassline', label: 'Glassline' }, { id: 'violet-grid', label: 'Aurora' },
  { id: 'velvet', label: 'Velvet' }, { id: 'blue-hour', label: 'Blue Hour' },
  { id: 'noir-bloom', label: 'Noir Bloom' }, { id: 'smoke', label: 'Smoke' },
  { id: 'ember', label: 'Ember' }, { id: 'forest', label: 'Forest' },
  { id: 'ocean', label: 'Ocean' }, { id: 'rose-noir', label: 'Rose Noir' },
]

export function SettingsView({ initialTab }: { initialTab?: SpaceSettingsTab }) {
  const dialog = useAppDialog()
  const { preferences, setPreference } = usePreferences()
  const {
    data,
    profile,
    workspaces,
    setView,
    updateWorkspace,
    leaveWorkspace,
    deleteWorkspace,
    pushToast,
  } = useSpaces()

  const workspace = data?.workspace
  const isOwner = workspace?.role === 'owner'
  const isHub = workspace?.id === 'spaces-hub'
  const isHubFounder = isHub && profile?.platformRole === 'founder'
  const canUseAnimatedSpaceMedia = profile?.platformRole === 'founder' && Boolean(isHub || (workspace?.ownerId && workspace.ownerId === profile.id))
  const spaceImageAccept = canUseAnimatedSpaceMedia ? 'image/png,image/jpeg,image/webp,image/gif' : 'image/png,image/jpeg,image/webp'
  const canManageSpace = isHubFounder || hasWorkspacePermission(data, profile?.id, 'manage_space')
  const canManageChannels = isHubFounder || hasWorkspacePermission(data, profile?.id, 'manage_channels')
  const canManageRoles = isHubFounder || hasWorkspacePermission(data, profile?.id, 'manage_roles')
  const canManageMembers = isHubFounder || hasWorkspacePermission(data, profile?.id, 'manage_members')
  const canManageEmojis = isHubFounder || hasWorkspacePermission(data, profile?.id, 'manage_emojis')
  const canInvite = isHubFounder || hasWorkspacePermission(data, profile?.id, 'create_invites')
  const canViewActivity = isHubFounder || hasWorkspacePermission(data, profile?.id, 'view_audit_log')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [accent, setAccent] = useState('#8b6ca8')
  const [accentTwo, setAccentTwo] = useState('#342044')
  const [background, setBackground] = useState<WorkspaceBackgroundPreset>('graphite')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const [iconDecoration, setIconDecoration] = useState<WorkspaceIconDecoration>('ring')
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<SpaceSettingsTab>(() => initialTab ?? (canManageSpace ? 'profile' : canManageEmojis ? 'appearance' : 'notifications'))
  const [cropTarget, setCropTarget] = useState<{ kind: 'avatar' | 'banner'; source: string } | null>(null)
  const [permissionChannel, setPermissionChannel] = useState<WorkspaceChannel | null>(null)
  const avatarInput = useRef<HTMLInputElement>(null)
  const bannerInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!workspace) return
    setName(currentWorkspace.name)
    setDescription(currentWorkspace.description)
    setAccent(currentWorkspace.accentColor)
    setAccentTwo(localStorage.getItem(`spaces.theme2.${workspace.id}`) || '#342044')
    setBackground(currentWorkspace.background)
    setAvatarUrl(currentWorkspace.avatarUrl)
    setBannerUrl(currentWorkspace.bannerUrl)
    setIconDecoration(currentWorkspace.iconDecoration === 'badge' ? 'ring' : (currentWorkspace.iconDecoration ?? 'ring'))
  }, [workspace])

  useEffect(() => {
    if (!canManageSpace && tab === 'profile') setTab(canManageEmojis ? 'appearance' : 'notifications')
    if (!canManageSpace && !canManageEmojis && tab === 'appearance') setTab('notifications')
    if (!canManageChannels && tab === 'channels') setTab('notifications')
  }, [canManageChannels, canManageSpace, tab])

  if (!workspace) return null
  const currentWorkspace = workspace

  const workspaceNumber = getWorkspaceNumber(workspace, workspaces)
  const storedAccentTwo = localStorage.getItem(`spaces.theme2.${workspace.id}`) || '#342044'
  const dirty = canManageSpace && (
    name !== workspace.name ||
    description !== workspace.description ||
    accent !== workspace.accentColor ||
    accentTwo !== storedAccentTwo ||
    background !== workspace.background ||
    avatarUrl !== workspace.avatarUrl ||
    bannerUrl !== workspace.bannerUrl ||
    iconDecoration !== (workspace.iconDecoration ?? 'ring')
  )

  function resetChanges() {
    setName(currentWorkspace.name)
    setDescription(currentWorkspace.description)
    setAccent(currentWorkspace.accentColor)
    setAccentTwo(storedAccentTwo)
    setBackground(currentWorkspace.background)
    setAvatarUrl(currentWorkspace.avatarUrl)
    setBannerUrl(currentWorkspace.bannerUrl)
    setIconDecoration(currentWorkspace.iconDecoration === 'badge' ? 'ring' : (currentWorkspace.iconDecoration ?? 'ring'))
    window.dispatchEvent(new CustomEvent('spaces-background-preview', { detail: currentWorkspace.background }))
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>, kind: 'avatar' | 'banner') {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !canManageSpace) return
    try {
      if (isGifFile(file)) {
        if (!canUseAnimatedSpaceMedia) {
          pushToast('GIF Space artwork is only available for Spaces Hub and Spaces owned by the Founder.', 'info')
          return
        }
        const source = await gifFileToDataUrl(file)
        if (kind === 'avatar') setAvatarUrl(source)
        else setBannerUrl(source)
        return
      }
      const source = await imageFileToRawDataUrl(file)
      setCropTarget({ kind, source })
    } catch (cause) {
      pushToast(cause instanceof Error ? cause.message : 'Could not prepare that image.', 'danger')
    }
  }

  function chooseImage(kind: 'avatar' | 'banner') {
    if (!canManageSpace) return
    if (kind === 'avatar') avatarInput.current?.click()
    else bannerInput.current?.click()
  }

  function adjustCurrentImage(kind: 'avatar' | 'banner') {
    if (!canManageSpace) return
    const current = kind === 'avatar' ? avatarUrl : bannerUrl
    if (current?.startsWith('data:image/')) setCropTarget({ kind, source: current })
    else chooseImage(kind)
  }

  async function save() {
    if (!name.trim() || !canManageSpace) return
    setBusy(true)
    try {
      localStorage.setItem(`spaces.theme2.${currentWorkspace.id}`, accentTwo)
      window.dispatchEvent(new CustomEvent('spaces-theme-updated'))
      await updateWorkspace({
        name: name.trim(),
        description: description.trim(),
        accentColor: accent,
        background,
        avatarUrl,
        bannerUrl,
        iconDecoration,
      })
      pushToast('Space settings saved.', 'success')
    } catch (cause) {
      pushToast(cause instanceof Error ? cause.message : 'Could not update Space.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  async function leave() {
    if (isHub) {
      pushToast('Spaces - Hub is permanent and cannot be left.', 'info')
      return
    }
    if (isOwner) {
      pushToast('Owners must transfer ownership or delete the Space.', 'danger')
      return
    }
    if (!await dialog.confirm({
      title: `Leave ${currentWorkspace.name}?`,
      message: 'You will need a valid invite to rejoin later.',
      confirmText: 'Leave Space',
      danger: true,
    })) return
    try {
      await leaveWorkspace()
    } catch (cause) {
      pushToast(cause instanceof Error ? cause.message : 'Could not leave Space.', 'danger')
    }
  }

  async function removeSpace() {
    if (isHub) {
      pushToast('Spaces - Hub is permanent and cannot be deleted.', 'info')
      return
    }
    if (!isOwner) return
    const confirmation = await dialog.prompt({
      title: `Delete ${workspace.name}?`,
      message: 'This permanently removes the Space, channels, messages, notes, roles and member data. This cannot be undone.',
      label: 'Type the Space name',
      requiredText: workspace.name,
      placeholder: workspace.name,
      confirmText: 'Delete permanently',
      danger: true,
    })
    if (confirmation !== workspace.name) return
    try {
      await deleteWorkspace()
    } catch (cause) {
      pushToast(cause instanceof Error ? cause.message : 'Could not delete Space.', 'danger')
    }
  }


  const managementShortcuts = [
    canManageMembers && { view: 'members' as const, icon: 'members' as const, title: 'People', note: 'Member access and moderation' },
    canManageRoles && { view: 'roles' as const, icon: 'roles' as const, title: 'Roles & Permissions', note: 'Roles, hierarchy and permissions' },
    canInvite && { view: 'invites' as const, icon: 'plus' as const, title: 'Invites', note: 'Create and manage invites' },
    canViewActivity && { view: 'activity' as const, icon: 'activity' as const, title: 'Activity', note: 'Review the audit log' },
  ].filter(Boolean) as { view: 'members'|'roles'|'invites'|'activity'; icon: 'members'|'roles'|'plus'|'activity'; title: string; note: string }[]

  const spaceMuted = preferences.mutedWorkspaceIds.includes(workspace.id)
  const mutedChannelCount = (data?.channels ?? []).filter(channel => preferences.mutedChannelIds.includes(channel.id)).length
  const tabs: { id: SpaceSettingsTab; label: string; icon: 'user'|'sparkle'|'bell'|'hash'|'shield'|'settings'; hidden?: boolean }[] = [
    { id: 'profile', label: 'Profile', icon: 'user', hidden: !canManageSpace },
    { id: 'appearance', label: 'Decorate', icon: 'sparkle', hidden: !(canManageSpace || canManageEmojis) },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
    { id: 'channels', label: 'Channels', icon: 'hash', hidden: !canManageChannels },
    { id: 'access', label: 'Access', icon: 'shield', hidden: !(canManageSpace || canManageMembers || canManageRoles || canInvite || canViewActivity) },
    { id: 'advanced', label: 'Advanced', icon: 'settings' },
  ]

  return (
    <div className="view-scroll space-settings-v32 space-settings-v36 page-enter">
      <header className="space-settings-v32-heading space-settings-heading-v36">
        <div>
          <span className="eyebrow">SPACE SETTINGS</span>
          <h1>Settings</h1>
          <p>{canManageSpace ? 'Profile, decoration, notifications and access.' : 'Notifications, channel preferences and membership.'}</p>
        </div>
        <button
          type="button"
          className="space-settings-v32-id"
          title="Copy permanent Space ID"
          onClick={() => { void navigator.clipboard.writeText(String(workspaceNumber)); pushToast(`Copied Space ID #${workspaceNumber}.`, 'success') }}
        >
          <Icon name="copy" size={12}/> Space #{workspaceNumber}
        </button>
      </header>

      <nav className="space-settings-tabs-v36" aria-label="Space settings sections">
        {tabs.filter(item => !item.hidden).map(item => (
          <button type="button" key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>
            <Icon name={item.icon} size={14}/><span>{item.label}</span>
            {item.id === 'notifications' && (spaceMuted || mutedChannelCount > 0) && <small>{spaceMuted ? 'Muted' : mutedChannelCount}</small>}
          </button>
        ))}
      </nav>

      <input ref={avatarInput} hidden type="file" accept={spaceImageAccept} onChange={event => void uploadImage(event, 'avatar')}/>
      <input ref={bannerInput} hidden type="file" accept={spaceImageAccept} onChange={event => void uploadImage(event, 'banner')}/>
      {cropTarget && (
        <ImageCropper
          source={cropTarget.source}
          preset={cropTarget.kind}
          title={cropTarget.kind === 'avatar' ? 'Edit Space picture' : 'Adjust Space banner'}
          onCancel={() => setCropTarget(null)}
          onSave={dataUrl => {
            if (cropTarget.kind === 'avatar') setAvatarUrl(dataUrl)
            else setBannerUrl(dataUrl)
            setCropTarget(null)
          }}
        />
      )}
      {permissionChannel && <ChannelPermissionsEditor channel={permissionChannel} onClose={() => setPermissionChannel(null)}/>} 

      {tab === 'profile' && <>
        <section className="space-settings-v32-card">
          <div className="space-settings-v32-card-head"><div><span className="eyebrow">SPACE PROFILE</span><h2>Picture & banner</h2><p>Identity used in the rail, invites and Space header.</p></div></div>
          <div className="space-settings-v32-profile-grid space-settings-v32-media-grid">
            <div className="space-settings-v32-avatar-block">
              <button type="button" className="space-settings-v32-avatar" onClick={() => chooseImage('avatar')}>
                <span className={`space-icon-decor icon-decor-${iconDecoration}`} style={{ '--decor-accent': accent, '--decor-accent-2': accentTwo } as CSSProperties}>
                  <Avatar name={name || workspace.name} initials={workspace.initials} src={avatarUrl} size={82} accent={accent}/>
                </span>
                <i><Icon name="edit" size={14}/></i>
              </button>
              <div className="space-settings-v32-copy">
                <strong>{avatarUrl ? 'Space picture' : 'Add a Space picture'}</strong>
                <span>Square images are cropped once and used throughout Spaces.</span>
                <div className="space-settings-v32-actions">
                  <button type="button" className="primary-button compact" onClick={() => chooseImage('avatar')}><Icon name="upload" size={13}/>{avatarUrl ? 'Choose new' : 'Choose picture'}</button>
                  {avatarUrl?.startsWith('data:image/') && !isGifDataUrl(avatarUrl) && <button type="button" className="secondary-button compact" onClick={() => adjustCurrentImage('avatar')}><Icon name="edit" size={13}/>Adjust</button>}
                  <button type="button" className="secondary-button compact" disabled={!avatarUrl} onClick={() => setAvatarUrl(null)}>Reset</button>
                </div>
              </div>
            </div>
            <div className="space-settings-v32-banner-block">
              <button type="button" className="space-settings-v32-banner" onClick={() => chooseImage('banner')}>
                {bannerUrl && <AnimatedBackdrop src={bannerUrl} className="space-settings-banner-media-v41" mode="always"/>}
                <span>{bannerUrl ? 'Change banner' : 'Add Space banner'}</span>
              </button>
              <div className="space-settings-v32-actions">
                <button type="button" className="secondary-button compact" onClick={() => chooseImage('banner')}><Icon name="upload" size={13}/>{bannerUrl ? 'Choose new' : 'Add banner'}</button>
                {bannerUrl?.startsWith('data:image/') && !isGifDataUrl(bannerUrl) && <button type="button" className="secondary-button compact" onClick={() => adjustCurrentImage('banner')}><Icon name="edit" size={13}/>Adjust</button>}
                <button type="button" className="secondary-button compact" disabled={!bannerUrl} onClick={() => setBannerUrl(null)}>Clear</button>
              </div>
            </div>
          </div>
          <div className="space-settings-v32-frame-row">
            <div className="space-settings-v32-copy"><strong>Icon frame</strong><span>Choose how the Space picture appears in the rail.</span></div>
            <div className="space-settings-v32-frame-picker">{iconDecorations.map(item => <button type="button" key={item.id} className={iconDecoration === item.id ? 'active' : ''} onClick={() => setIconDecoration(item.id)}><span className={`space-icon-decor icon-decor-${item.id}`} style={{ '--decor-accent': accent, '--decor-accent-2': accentTwo } as CSSProperties}><Avatar name={name || workspace.name} initials={workspace.initials} src={avatarUrl} size={34} accent={accent}/></span><small>{item.label}</small></button>)}</div>
          </div>
        </section>
        <section className="space-settings-v32-card">
          <div className="space-settings-v32-card-head"><div><span className="eyebrow">DETAILS</span><h2>Space details</h2><p>Name and description members see.</p></div></div>
          <div className="space-settings-v32-row"><div className="space-settings-v32-copy"><strong>Space name</strong><span>The name used everywhere in Spaces.</span></div><input className="text-input" value={name} maxLength={48} onChange={event => setName(event.target.value)}/></div>
          <div className="space-settings-v32-row space-settings-v32-row-top"><div className="space-settings-v32-copy"><strong>Description</strong><span>Short context for what this Space is for.</span></div><textarea className="text-area" value={description} maxLength={220} onChange={event => setDescription(event.target.value)} rows={4}/></div>
        </section>
      </>}

      {tab === 'appearance' && <>
        {canManageSpace && <>
          <section className="space-settings-v32-card">
            <div className="space-settings-v32-card-head"><div><span className="eyebrow">COLORS</span><h2>Space colors</h2><p>Shared accents used in frames and Space surfaces.</p></div></div>
            <div className="space-settings-v32-colors space-settings-colors-v36">
              <label><span>Primary</span><input type="color" value={accent} onChange={event => setAccent(event.target.value)}/><code>{accent}</code></label>
              <label><span>Secondary</span><input type="color" value={accentTwo} onChange={event => setAccentTwo(event.target.value)}/><code>{accentTwo}</code></label>
              <div className="space-settings-v32-color-preview" style={{ background: `linear-gradient(135deg,${accent},${accentTwo})` }}/>
            </div>
          </section>
          <section className="space-settings-v32-card">
            <div className="space-settings-v32-card-head"><div><span className="eyebrow">BACKGROUND</span><h2>Space background</h2><p>Choose the shared background members see throughout this Space.</p></div></div>
            <div className="space-settings-v32-backgrounds">{backgrounds.map(item => <button type="button" key={item.id} className={`background-card bg-${item.id} ${background === item.id ? 'active' : ''}`} onClick={() => { setBackground(item.id); window.dispatchEvent(new CustomEvent('spaces-background-preview', { detail: item.id })) }}><span>{item.label}</span>{background === item.id && <i><Icon name="check" size={13}/></i>}</button>)}</div>
          </section>
        </>}
        {canManageEmojis && <section className="space-settings-v32-card space-settings-emoji-v40"><EmojiView embedded /></section>}
      </>}

      {tab === 'notifications' && <>
        <section className="space-settings-v32-card space-notification-settings-v36">
          <div className="space-settings-v32-card-head"><div><span className="eyebrow">THIS SPACE</span><h2>Notifications</h2><p>Personal notification controls for {workspace.name}. These settings affect only your account on this device.</p></div></div>
          <div className="space-settings-toggle-row-v36">
            <div><strong>Mute this Space</strong><span>Stop message and mention alerts from every channel in this Space.</span></div>
            <button type="button" className={`permission-toggle ${spaceMuted ? 'on' : ''}`} onClick={() => setPreference('mutedWorkspaceIds', spaceMuted ? preferences.mutedWorkspaceIds.filter(id => id !== workspace.id) : [...preferences.mutedWorkspaceIds, workspace.id])}><i/></button>
          </div>
          <div className="space-settings-toggle-row-v36">
            <div><strong>Notification sounds</strong><span>Use your global Spaces notification sound setting.</span></div>
            <span className="settings-status-v36">{preferences.desktopSounds ? 'ON' : 'OFF'}</span>
          </div>
          <div className="space-settings-toggle-row-v36">
            <div><strong>Show all channel threads</strong><span>Keep every thread visible in the channel list. When off, threads appear after you participate in them.</span></div>
            <button type="button" className={`permission-toggle ${preferences.showAllChannelThreads ? 'on' : ''}`} onClick={() => setPreference('showAllChannelThreads', !preferences.showAllChannelThreads)}><i/></button>
          </div>
        </section>
        <section className="space-settings-v32-card">
          <div className="space-settings-v32-card-head"><div><span className="eyebrow">CHANNELS</span><h2>Channel mutes</h2><p>Mute individual channels without muting the rest of the Space.</p></div></div>
          <div className="space-settings-v32-channels">{(data?.channels ?? []).map(channel => {
            const muted = preferences.mutedChannelIds.includes(channel.id)
            return <button type="button" className={muted ? 'muted-v36' : ''} key={channel.id} onClick={() => setPreference('mutedChannelIds', muted ? preferences.mutedChannelIds.filter(id => id !== channel.id) : [...preferences.mutedChannelIds, channel.id])}><span className="space-settings-v32-channel-icon"><Icon name={channel.kind === 'notes' ? 'notes' : channel.kind === 'announcement' ? 'bell' : 'hash'} size={16}/></span><span><strong>{channel.name}</strong><small>{muted ? 'Muted' : 'Notifications allowed'}</small></span><span>{muted ? 'Unmute' : 'Mute'} <Icon name="bell" size={13}/></span></button>
          })}</div>
        </section>
      </>}

      {tab === 'channels' && canManageChannels && <section className="space-settings-v32-card">
        <div className="space-settings-v32-card-head"><div><span className="eyebrow">CHANNEL ACCESS</span><h2>Channel permissions</h2><p>Set overrides for @everyone, roles and individual members.</p></div></div>
        <div className="space-settings-v32-channels">{data?.channels.map(channel => <button type="button" key={channel.id} onClick={() => setPermissionChannel(channel)}><span className="space-settings-v32-channel-icon"><Icon name={channel.kind === 'notes' ? 'notes' : channel.kind === 'announcement' ? 'bell' : 'hash'} size={16}/></span><span><strong>{channel.name}</strong><small>{channel.kind} · base post: {channel.postMinRole} · base notes: {channel.noteMinRole}</small></span><span>Edit permissions <Icon name="chevron" size={13}/></span></button>)}</div>
      </section>}

      {tab === 'access' && <>
        {managementShortcuts.length > 0 && <section className="space-settings-v32-card"><div className="space-settings-v32-card-head"><div><span className="eyebrow">MANAGEMENT</span><h2>Space tools</h2><p>Only tools your role can manage are shown here.</p></div></div><div className="space-settings-v32-tools">{managementShortcuts.map(item => <button type="button" key={item.view} onClick={() => setView(item.view)}><Icon name={item.icon} size={18}/><span><strong>{item.title}</strong><small>{item.note}</small></span><Icon name="chevron" size={13}/></button>)}</div></section>}
        <section className="space-settings-v32-card"><div className="space-settings-v32-card-head"><div><span className="eyebrow">HIERARCHY</span><h2>Access model</h2><p>Owner stays highest. Administrators, Staff and custom roles can only manage members and roles beneath their own position.</p></div></div><div className="space-access-summary-v36"><article><Icon name="shield" size={16}/><div><strong>Owner</strong><span>Permanent highest Space authority</span></div></article><article><Icon name="roles" size={16}/><div><strong>Administrator</strong><span>Full Space administration below Owner</span></div></article><article><Icon name="members" size={16}/><div><strong>Staff & custom roles</strong><span>Permissions and hierarchy determine what each role can manage</span></div></article></div></section>
      </>}

      {tab === 'advanced' && <section className={`space-settings-v32-card space-settings-v32-danger ${isHub ? 'protected' : ''}`}>
        <div className="space-settings-v32-card-head"><div><span className="eyebrow">MEMBERSHIP</span><h2>{isHub ? 'Permanent Space' : 'Danger zone'}</h2><p>Actions here affect membership or permanently remove this Space.</p></div></div>
        {isHub ? <div className="space-settings-v32-protected"><Icon name="shield" size={20}/><div className="space-settings-v32-copy"><strong>Spaces - Hub is protected</strong><span>Every Spaces account belongs to the Hub. It can be hidden or muted, but not left or deleted.</span></div><span className="private-chip"><Icon name="lock" size={12}/>Permanent</span></div> : <div className="space-settings-v32-danger-list">{!isOwner && <div><div className="space-settings-v32-copy"><strong>Leave Space</strong><span>You can rejoin later with a valid invite.</span></div><button type="button" className="danger-button" onClick={() => void leave()}>Leave Space</button></div>}{isOwner && <div><div className="space-settings-v32-copy"><strong>Delete Space</strong><span>Permanently removes channels, messages, notes, roles and members.</span></div><button type="button" className="danger-button" onClick={() => void removeSpace()}>Delete Space</button></div>}</div>}
      </section>}

      {dirty && (
        <div className="space-settings-v32-savebar">
          <span>You have unsaved Space changes.</span>
          <div><button type="button" className="secondary-button" disabled={busy} onClick={resetChanges}>Reset</button><button type="button" className="primary-button" disabled={busy || !name.trim()} onClick={() => void save()}>{busy ? 'Saving…' : 'Save changes'}</button></div>
        </div>
      )}
    </div>
  )
}
