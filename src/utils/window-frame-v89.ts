/** Window-only rounding. Native maximization uses Tauri window events. */
export async function installSpacesWindowFrameV89():Promise<()=>void>{
  const root=document.documentElement
  let disposed=false
  let unlisten:(()=>void)|undefined
  const syncBrowser=()=>{
   if(disposed)return
   if(document.fullscreenElement){root.dataset.spacesWindow='fullscreen';return}
   const w=window.screen?.availWidth||0,h=window.screen?.availHeight||0
   root.dataset.spacesWindow=w>0&&h>0&&window.outerWidth>=w-16&&window.outerHeight>=h-16?'maximized':'floating'
  }
  const isTauri=typeof window!=='undefined'&&Boolean((window as Window &{__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__)
  if(isTauri){
   try{
    const mod=await import('@tauri-apps/api/window');const native=mod.getCurrentWindow()
    const update=async()=>{try{const max=await native.isMaximized();if(!disposed)root.dataset.spacesWindow=max?'maximized':'floating'}catch{syncBrowser()}}
    await update();unlisten=await native.onResized(()=>{void update()})
   }catch{syncBrowser()}
  }else syncBrowser()
  if(!isTauri)window.addEventListener('resize',syncBrowser)
  document.addEventListener('fullscreenchange',syncBrowser)
  return()=>{disposed=true;unlisten?.();window.removeEventListener('resize',syncBrowser);document.removeEventListener('fullscreenchange',syncBrowser)}
}
