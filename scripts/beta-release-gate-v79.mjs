import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const failures=[];const warnings=[]
const read=p=>fs.readFileSync(path.join(root,p),'utf8')
const exists=p=>fs.existsSync(path.join(root,p))
function walk(dir,out=[]){const absolute=path.join(root,dir);if(!fs.existsSync(absolute))return out;for(const entry of fs.readdirSync(absolute,{withFileTypes:true})){const rel=path.join(dir,entry.name);if(entry.isDirectory()){if(!['node_modules','.git','dist','dist-web','target','gen'].includes(entry.name))walk(rel,out)}else if(/\.(?:ts|tsx|js|jsx|json|html|css|mjs|cjs)$/i.test(entry.name))out.push(rel)}return out}
function fail(msg){failures.push(msg)}function warn(msg){warnings.push(msg)}
const files=walk('src')
for(const rel of files){const text=read(rel)
  if(/\beval\s*\(/.test(text))fail(rel+': eval() is blocked for beta')
  if(/new\s+Function\s*\(/.test(text))fail(rel+': new Function() is blocked for beta')
  if(/javascript\s*:/i.test(text)&&!rel.endsWith('BetaUXV79.tsx'))fail(rel+': javascript: URL found')
  if(/dangerouslySetInnerHTML/.test(text))warn(rel+': dangerouslySetInnerHTML requires manual review')
  if(/http:\/\/(?!localhost|127\.0\.0\.1)/i.test(text))warn(rel+': insecure http:// reference')
}
const secretFiles=[...walk('public'),...walk('src')]
const secretPatterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bghp_[A-Za-z0-9]{20,}\b/,/\bsk-[A-Za-z0-9_-]{20,}\b/,/\bAIza[0-9A-Za-z_-]{25,}\b/]
for(const rel of secretFiles){const text=read(rel);for(const pattern of secretPatterns)if(pattern.test(text))fail(rel+': possible secret/private key embedded in client assets')}
if(!exists('src/styles/standalone-v78.css')||!read('src/styles/standalone-v78.css').includes('SPACES_V78_WEB_MOBILE_RC'))fail('V78 marker missing')
if(!exists('src/styles/standalone-v79.css')||!read('src/styles/standalone-v79.css').includes('SPACES_V79_DISCORD_PLUS_BETA'))fail('V79 CSS marker missing')
if(!read('src/App.tsx').includes("./styles/standalone-v79.css"))fail('V79 CSS is not imported by App.tsx')
if(!read('src/main.tsx').includes('BetaUXV79'))fail('BetaUXV79 is not mounted at the app root')
if(!read('src/features/home/HomeView.tsx').includes('SpaceIdentityBadgesV79'))fail('Space trust badges are not mounted on Home cards')
try{const trust=JSON.parse(read('public/spaces-trust.json'));if(!trust||typeof trust.spaces!=='object'||Array.isArray(trust.spaces))fail('spaces-trust.json must contain a spaces object')}catch{fail('spaces-trust.json is invalid JSON')}
try{const pkg=JSON.parse(read('package.json'));const tauri=JSON.parse(read('src-tauri/tauri.conf.json'));const shared=JSON.parse(read('spaces.version.json'));if(pkg.version!==tauri.version||pkg.version!==shared.version)fail('desktop/web/mobile version mismatch: '+pkg.version+' / '+tauri.version+' / '+shared.version)}catch(error){fail('Version parity check failed: '+error.message)}
const manifest='src-tauri/gen/android/app/src/main/AndroidManifest.xml'
if(exists(manifest)){const text=read(manifest);for(const permission of ['READ_SMS','RECEIVE_SMS','SEND_SMS','READ_CONTACTS','WRITE_CONTACTS','READ_CALL_LOG','WRITE_CALL_LOG','REQUEST_INSTALL_PACKAGES','MANAGE_EXTERNAL_STORAGE'])if(text.includes('android.permission.'+permission))fail('Android high-risk permission present: '+permission);for(const permission of ['CAMERA','RECORD_AUDIO','ACCESS_FINE_LOCATION','ACCESS_COARSE_LOCATION'])if(text.includes('android.permission.'+permission))warn('Android sensitive permission present; verify it is required: '+permission)}
console.log('\nSpaces V79 Beta Safety Gate')
for(const item of warnings)console.warn('WARN  '+item)
for(const item of failures)console.error('FAIL  '+item)
if(failures.length){console.error('\nBeta gate blocked: '+failures.length+' failure(s).');process.exit(1)}
console.log('PASS  No blocking beta-safety findings.')
