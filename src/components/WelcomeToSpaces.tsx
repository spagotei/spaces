import { Icon } from './Icon'
import { SpacesLogo } from './SpacesLogo'

export function WelcomeToSpaces({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="welcome-spaces-stage page-enter" role="dialog" aria-modal="true" aria-labelledby="welcome-spaces-title">
      <section className="welcome-spaces-card">
        <SpacesLogo className="welcome-spaces-logo" />
        <span className="eyebrow">WELCOME</span>
        <h1 id="welcome-spaces-title">Welcome to Spaces</h1>
        <p>A place for your communities, projects, conversations, and shared work.</p>
        <div className="welcome-spaces-points">
          <div><Icon name="members" size={16}/><span><strong>Your people</strong><small>Keep members, roles, and conversations together.</small></span></div>
          <div><Icon name="chat" size={16}/><span><strong>Channels and notes</strong><small>Set up chat, announcements, notes, media, and more.</small></span></div>
          <div><Icon name="settings" size={16}/><span><strong>Your Space</strong><small>Choose the structure, permissions, and appearance that fit your group.</small></span></div>
        </div>
        <button className="primary-button welcome-spaces-continue" onClick={onContinue}>Enter Spaces <Icon name="chevron" size={14}/></button>
        <small className="welcome-once-copy">Shown once on this device.</small>
      </section>
    </div>
  )
}
