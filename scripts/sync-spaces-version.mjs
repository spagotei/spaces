// SPACES_V77_7_VERSION_SYNC
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here=path.dirname(fileURLToPath(import.meta.url))
const root=path.resolve(here,'..')
const canonicalPath=path.join(root,'spaces.version.json')
const canonical=JSON.parse(fs.readFileSync(canonicalPath,'utf8'))
const version=String(canonical.version??'').trim()
if(!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) throw new Error('spaces.version.json must contain a semantic version.')

const pkgPath=path.join(root,'package.json')
const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'))
pkg.version=version
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n')

const lockPath=path.join(root,'package-lock.json')
if(fs.existsSync(lockPath)){
  const lock=JSON.parse(fs.readFileSync(lockPath,'utf8'))
  lock.version=version
  if(lock.packages&&lock.packages['']) lock.packages[''].version=version
  fs.writeFileSync(lockPath,JSON.stringify(lock,null,2)+'\n')
}

const tauriPath=path.join(root,'src-tauri','tauri.conf.json')
const tauri=JSON.parse(fs.readFileSync(tauriPath,'utf8'))
tauri.version=version
fs.writeFileSync(tauriPath,JSON.stringify(tauri,null,2)+'\n')

const publicDir=path.join(root,'public')
fs.mkdirSync(publicDir,{recursive:true})
fs.writeFileSync(path.join(publicDir,'spaces-version.json'),JSON.stringify({name:'Spaces',version},null,2)+'\n')
console.log(`Spaces version synced across desktop, web, and mobile: ${version}`)
