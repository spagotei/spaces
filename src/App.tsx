import { useState } from 'react'
import { DesktopTitlebar, isTauriDesktopRuntime } from './components/DesktopTitlebar'
import { CustomCursor } from './components/CustomCursor'
import { WelcomeToSpaces } from './components/WelcomeToSpaces'
import { AppDialogProvider } from './components/AppDialog'
import { LoginScreen } from './features/auth/LoginScreen'
import { BetaProfileSetup } from './features/auth/BetaProfileSetup'
import { AppShell } from './features/shell/AppShell'
import { PreferencesProvider } from './state/PreferencesContext'
import { SpacesProvider, useSpaces } from './state/SpacesContext'
import './styles/tokens.css'
import './styles/app.css'
import './styles/standalone-v2.css'
import './styles/standalone-v3.css'
import './styles/standalone-v4.css'
import './styles/standalone-v5.css'
import './styles/standalone-v6.css'
import './styles/standalone-v7.css'
import './styles/standalone-v8.css'
import './styles/standalone-v9.css'
import './styles/standalone-v10.css'
import './styles/standalone-v11.css'
import './styles/standalone-v12.css'
import './styles/standalone-v13.css'
import './styles/standalone-v14.css'
import './styles/standalone-v15.css'
import './styles/standalone-v16.css'
import './styles/standalone-v17.css'
import './styles/standalone-v18.css'
import './styles/standalone-v19.css'
import './styles/standalone-v20.css'
import './styles/standalone-v21.css'
import './styles/standalone-v23.css'
import './styles/standalone-v25.css'
import './styles/standalone-v28.css'
import './styles/standalone-v29.css'
import './styles/standalone-v30.css'
import './styles/standalone-v31.css'
import './styles/standalone-v32.css'
import './styles/standalone-v33.css'
import './styles/standalone-v34.css'
import './styles/standalone-v35.css'
import './styles/standalone-v36.css'
import './styles/standalone-v37.css'
import './styles/standalone-v38.css'
import './styles/standalone-v39.css'
import './styles/standalone-v40.css'
import './styles/standalone-v41.css'
import './styles/standalone-v42.css'
import './styles/mobile-overhaul.css'
import './styles/mobile-v4.css'
import './styles/standalone-v43.css'
import './styles/standalone-v44.css'
import './styles/standalone-v45.css'

import './styles/standalone-v47.css'
import './styles/standalone-v48.css'
import './styles/standalone-v49.css'
import './styles/standalone-v50.css'
import './styles/standalone-v59.css'
function StartupLoadingScreen() {
  return (
    <div className="startup-loading-screen" aria-label="Opening Spaces">
      <div className="spaces-loader" aria-hidden="true"><i /><i /><i /></div>
      <span>Opening Spaces…</span>
    </div>
  )
}

function SpacesRoot() {
  const { session, loading } = useSpaces()
  const [welcomeDone, setWelcomeDone] = useState(() => localStorage.getItem('spaces.welcome.v1') === '1')

  // Do not unmount LoginScreen while a login/2FA request is in flight.
  // Unmounting it reset the local two-factor challenge state and made the page appear to refresh.
  if (loading && !session && !welcomeDone) return <StartupLoadingScreen />
  if (!welcomeDone) return <WelcomeToSpaces onContinue={() => { localStorage.setItem('spaces.welcome.v1', '1'); setWelcomeDone(true) }} />
  if (!session) return <LoginScreen />
  if (session.profileSetupRequired) return <BetaProfileSetup />
  return <AppShell />
}

export default function App() {
  const desktopRuntime = isTauriDesktopRuntime()

  return (
    <>
      <DesktopTitlebar />
      <div className={desktopRuntime ? 'tauri-desktop-content' : undefined}>
        <PreferencesProvider>
          <SpacesProvider>
            <AppDialogProvider>
              <CustomCursor />
              <SpacesRoot />
            </AppDialogProvider>
          </SpacesProvider>
        </PreferencesProvider>
      </div>
    </>
  )
}

