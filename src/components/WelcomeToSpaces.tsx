import { Icon } from './Icon'
import { SpacesLogo } from './SpacesLogo'

export function WelcomeToSpaces({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="welcome-spaces-stage page-enter" role="dialog" aria-modal="true" aria-labelledby="welcome-spaces-title">
      <section className="welcome-spaces-card welcome-spaces-card-v44">
        <SpacesLogo className="welcome-spaces-logo" />
        <h1 id="welcome-spaces-title">Welcome to Spaces</h1>
        <div className="welcome-spaces-points">
          <div><Icon name="members" size={17}/><strong>Friends & communities</strong></div>
          <div><Icon name="chat" size={17}/><strong>Channels & notes</strong></div>
          <div><Icon name="settings" size={17}/><strong>Make it yours</strong></div>
        </div>
        <button className="primary-button welcome-spaces-continue" onClick={onContinue}>Enter Spaces <Icon name="chevron" size={14}/></button>
      </section>
    </div>
  )
}
