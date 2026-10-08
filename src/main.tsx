import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { BetaUXV79 } from './features/beta/v79/BetaUXV79' // SPACES_V79_BETA_ROOT
import { LegalCenterV80 } from './features/legal/v80/LegalCenterV80' // SPACES_V80_ROOT
import { SupportEmailCenterV80 } from './features/support/v80/SupportEmailCenterV80' // SPACES_V80_ROOT
import { PartnerAdminV80 } from './features/support/v80/PartnerAdminV80' // SPACES_V80_ROOT

// SPACES_STARTUP_LOADING_CONTROLLER
function armSpacesStartupLoading() {
  const overlay = document.getElementById('spaces-preboot')
  const root = document.getElementById('root')
  if (!overlay || !root) return

  const startedAt = performance.now()
  const minimumVisibleMs = 720
  const quietWindowMs = 300
  const hardTimeoutMs = 5200

  let finished = false
  let quietTimer = 0
  let hardTimer = 0

  const finish = () => {
    if (finished) return
    finished = true
    window.clearTimeout(quietTimer)
    window.clearTimeout(hardTimer)
    observer.disconnect()

    const wait = Math.max(0, minimumVisibleMs - (performance.now() - startedAt))
    window.setTimeout(() => {
      document.documentElement.classList.add('spaces-app-ready')
      window.setTimeout(() => overlay.remove(), 520)
    }, wait)
  }

  const scheduleQuietFinish = () => {
    if (finished) return
    window.clearTimeout(quietTimer)
    quietTimer = window.setTimeout(async () => {
      try {
        if ('fonts' in document) await document.fonts.ready
      } catch {}
      requestAnimationFrame(() => requestAnimationFrame(finish))
    }, quietWindowMs)
  }

  const observer = new MutationObserver(scheduleQuietFinish)
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  })

  window.addEventListener('load', scheduleQuietFinish, { once: true })
  window.addEventListener('spaces:app-ready', finish, { once: true })
  requestAnimationFrame(() => requestAnimationFrame(scheduleQuietFinish))
  hardTimer = window.setTimeout(finish, hardTimeoutMs)
}

armSpacesStartupLoading()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BetaUXV79><LegalCenterV80><App /><SupportEmailCenterV80 /><PartnerAdminV80 /></LegalCenterV80></BetaUXV79>
  </StrictMode>,
)
