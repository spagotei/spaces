import { SpacesNativeCallPopoutV91 } from './features/voice/v91/SpacesNativeCallPopoutV91' // SPACES_V91_NATIVE_CALLOUT
import { useEffect as useEffectV89WindowFrame } from 'react'; // SPACES_V89_WINDOW_FRAME
import { installSpacesWindowFrameV89 } from './utils/window-frame-v89';
import './styles/workspace-v89.css';
import { StaffSupportCenterV84_2 } from './features/support/v77/StaffSupportCenterV84_2'
import { lazy, Suspense, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { DesktopTitlebar, isTauriDesktopRuntime } from './components/DesktopTitlebar'
import { CustomCursor } from './components/CustomCursor'
import { WelcomeToSpaces } from './components/WelcomeToSpaces'
import { AppDialogProvider } from './components/AppDialog'
import { LoginScreen } from './features/auth/LoginScreen'
import { BetaProfileSetup } from './features/auth/BetaProfileSetup'
import { StartupLauncher } from './components/StartupLauncher'
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
import './styles/layout-v90-3.css'
import './styles/layout-v90-4.css'
import './styles/call-v91.css'
import './styles/glass-v86.css' // SPACES_V86_GLASS
import './styles/polish-v87.css' // SPACES_V87_POLISH
import './styles/popout-v88.css' // SPACES_V88_OVERLAY
import './styles/recent-dm-rail-v88-1.css' // SPACES_V88_1_DM_AVATARS
import './styles/mobile-v82.css'
import './styles/web-fullscreen-v82-6.css'
import './styles/polish-v921.css' // SPACES_V92_1_UI_POLISH
import './styles/v922-repair.css' // SPACES_V92_2_VISUAL_REPAIR
import './styles/v923-finish.css' // SPACES_V923_STYLE
// SPACES_V81_4_LAZY_SPLITS — load the signed-in application only when needed.
const AppShell = lazy(() => import('./features/shell/AppShell').then(m => ({ default: m.AppShell })))

function StartupLoadingScreen() {
  // SPACES_V90_3_RETURNING_STARTUP: browser boot movie plays at most once per origin.
  const [watchedBootV903] = useState(() => { try { return localStorage.getItem('spaces:web-boot-seen:v77') === '1' } catch { return false } })
  useEffect(() => { if (!watchedBootV903) { try { localStorage.setItem('spaces:web-boot-seen:v77', '1') } catch { /* private browsing */ } } }, [watchedBootV903])
  if (watchedBootV903 && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return <div className="spaces-returning-boot-v903" aria-label="Loading Spaces"><img src="/icon-256.png" alt="Spaces" /></div>
  // SPACES_ANDROID_STATIC_SPLASH_V25: native mobile splash is only the Spaces logo, no animated movie.
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return <div className="startup-loading-screen spaces-mobile-static-splash" aria-label="Opening Spaces"><img src="/icon-256.png" alt="Spaces" /></div>
  }
  return <div className="startup-loading-screen startup-loading-v77" aria-label="Opening Spaces"><video autoPlay muted loop playsInline preload="auto" src="/Spaces-Bootloading-V77-transparent.webm" /></div>
}

const launcherModeV70 = new URLSearchParams(window.location.search).get('launcher') === '1'

function SpacesRoot() {
  const { session, loading } = useSpaces()
  const [welcomeDone, setWelcomeDone] = useState(() => localStorage.getItem('spaces.welcome.v1') === '1')
  // Notify the independent Android watchdog after React has a usable screen.
  useEffect(() => {
    if (!loading && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      window.dispatchEvent(new Event('spaces:mobile-ui-ready'))
    }
  }, [loading])
  useEffect(() => { if (!loading && isTauriDesktopRuntime()) void invoke('finish_startup').catch(() => undefined) }, [loading])

  // Do not unmount LoginScreen while a login/2FA request is in flight.
  // Unmounting it reset the local two-factor challenge state and made the page appear to refresh.
  if (loading && !session && !welcomeDone && !isTauriDesktopRuntime()) return <StartupLoadingScreen />
  if (!welcomeDone) return <WelcomeToSpaces onContinue={() => { localStorage.setItem('spaces.welcome.v1', '1'); setWelcomeDone(true) }} />
  if (!session) return <LoginScreen />
  if (session.profileSetupRequired) return <BetaProfileSetup />
  // SPACES_V84_2_STAFF_PORTAL_ROUTE: auth and developer-mode are rechecked inside this view.
  if (new URLSearchParams(window.location.search).get('staff-support') === '1') return <StaffSupportCenterV84_2 />
  return <Suspense fallback={<div className="startup-loading-screen" role="status" aria-label="Opening Spaces">Opening Spaces…</div>}><AppShell /></Suspense>
}

export default function App() {
  if (isTauriDesktopRuntime() && new URLSearchParams(window.location.search).get('spaces-popout') === 'v91') return <SpacesNativeCallPopoutV91 />
  useEffectV89WindowFrame(()=>{let clean:(()=>void)|undefined;let cancelled=false;void installSpacesWindowFrameV89().then(fn=>{if(cancelled)fn();else clean=fn});return()=>{cancelled=true;clean?.()}},[])

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
