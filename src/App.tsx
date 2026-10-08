import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { DesktopTitlebar, isTauriDesktopRuntime } from './components/DesktopTitlebar'
import { CustomCursor } from './components/CustomCursor'
import { WelcomeToSpaces } from './components/WelcomeToSpaces'
import { AppDialogProvider } from './components/AppDialog'
import { LoginScreen } from './features/auth/LoginScreen'
import { BetaProfileSetup } from './features/auth/BetaProfileSetup'
import { StartupLauncher } from './components/StartupLauncher'
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
import './styles/standalone-v62.css'
import './styles/standalone-v63.css'
import './styles/standalone-v70.css'
import './styles/standalone-v71.css'
import './styles/standalone-v72.css'
import './styles/standalone-v73.css'
import './styles/standalone-v72-6.css'
import './styles/standalone-v64.css'
import './styles/standalone-v65.css'
import './styles/standalone-v66.css'
import './styles/standalone-v67.css'
import './styles/standalone-v68.css'
import './styles/standalone-v69.css'
import './styles/standalone-v72-8.css'
import './styles/standalone-v72-9.css'
import './styles/standalone-v74.css'
import './styles/standalone-v75-4.css'
import './styles/standalone-v75-5.css'
import './styles/standalone-v75-7.css'
import './styles/standalone-v76.css'
import './styles/standalone-v77.css'
import './styles/standalone-v78.css'
import './styles/standalone-v79.css'
import './styles/legal-v80.css'
function StartupLoadingScreen() {
  return <div className="startup-loading-screen startup-loading-v77" aria-label="Opening Spaces"><video autoPlay muted loop playsInline preload="auto" src="/Spaces-Bootloading-V77-transparent.webm" /></div>
}

const launcherModeV70 = new URLSearchParams(window.location.search).get('launcher') === '1'

function SpacesRoot() {
  const { session, loading } = useSpaces()
  const [welcomeDone, setWelcomeDone] = useState(() => localStorage.getItem('spaces.welcome.v1') === '1')
  useEffect(() => { if (!loading && isTauriDesktopRuntime()) void invoke('finish_startup').catch(() => undefined) }, [loading])

  // Do not unmount LoginScreen while a login/2FA request is in flight.
  // Unmounting it reset the local two-factor challenge state and made the page appear to refresh.
  if (loading && !session && !welcomeDone && !isTauriDesktopRuntime()) return <StartupLoadingScreen />
  if (!welcomeDone) return <WelcomeToSpaces onContinue={() => { localStorage.setItem('spaces.welcome.v1', '1'); setWelcomeDone(true) }} />
  if (!session) return <LoginScreen />
  if (session.profileSetupRequired) return <BetaProfileSetup />
  return <AppShell />
}

export default function App() {
  if (launcherModeV70) return <StartupLauncher />
  const desktopRuntime = isTauriDesktopRuntime()

  return (
    <>
      <DesktopTitlebar />
      <div className={desktopRuntime ? 'tauri-desktop-content' : 'spaces-web-runtime-v78'}>
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

