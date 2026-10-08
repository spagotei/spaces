// SPACES_V80_ARCHIVE_READINESS
// Non-destructive source audit. This is not a substitute for integration testing with real accounts.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const home=os.homedir()
const workerCandidates=[process.env.SPACES_WORKER_ROOT,path.join(home,'OneDrive','Documents','spaces'),path.join(home,'Documents','spaces')]
const worker=workerCandidates.find(x=>x&&fs.existsSync(path.join(x,'package.json')))
function scan(root,folders){
  const files=[]
  for(const folder of folders){
    const base=path.join(root,folder)
    if(!fs.existsSync(base))continue
    const visit=(dir)=>{for(const item of fs.readdirSync(dir,{withFileTypes:true})){
      if(item.name.startsWith('.')||['node_modules','dist','dist-web','target','build','gen'].includes(item.name))continue
      const abs=path.join(dir,item.name)
      if(item.isDirectory())visit(abs)
      else if(/\.(?:ts|tsx|js|jsx|mjs|cjs|sql)$/i.test(item.name))files.push({path:path.relative(root,abs).replace(/\\/g,'/'),text:fs.readFileSync(abs,'utf8')})
    }}
    visit(base)
  }
  return files
}
const appFiles=scan(app,['src/features/support','src/features/direct','src/components','src/features/settings'])
const workerFiles=worker?scan(worker,['src','migrations','db','worker']):[]
const patterns=[
  ['Archive action',/\barchiv(?:e|ed|ing)\b/i],
  ['Unarchive / restore',/\bunarchiv(?:e|ed)?\b|\brestor(?:e|ed)\b/i],
  ['Reopen action',/\breopen(?:ed)?\b/i],
  ['Resolve action',/\bresolv(?:e|ed|ing)\b/i],
  ['Close action',/\bclos(?:e|ed|ing)\b/i],
  ['Permanent delete',/\bdelete.?forever\b|\bpermanent(?:ly)?[ _-]?delet/i],
  ['Role enforcement',/\bfounder\b|\bsupport_role\b|\bstaff_role\b|\bhaspermission\b/i],
  ['Audit / event log',/\baudit\b|\bevent_log\b/i],
  ['Retention cleanup',/\bretention\b|\bpurge\b|\bexpires_at\b/i],
  ['Touch / long press',/\bonContextMenu\b|\bonTouchStart\b|\blongPress\b|\bpointerdown\b/i],
]
console.log('\nSpaces V80 archive source readiness (non-destructive)')
console.log('App:',app)
console.log('Worker:',worker||'NOT FOUND — cannot verify server-side archive authorization')
console.log('')
for(const [name,pattern] of patterns){
  const frontend=appFiles.filter(f=>pattern.test(f.text)).map(f=>f.path)
  const backend=workerFiles.filter(f=>pattern.test(f.text)).map(f=>f.path)
  console.log(`${name.padEnd(23)} App ${String(frontend.length).padStart(2)} | Worker ${String(backend.length).padStart(2)}`)
  if(process.argv.includes('--verbose')){
    if(frontend.length)console.log('   app:',frontend.slice(0,6).join(', '))
    if(backend.length)console.log('   worker:',backend.slice(0,6).join(', '))
  }
}
console.log('\nThis only finds source references. It does NOT prove archive/reopen/delete behavior works.')
console.log('Run the staff + member QA scenarios in ARCHIVE_QA_V80.md using two real test accounts.')
if(!worker)process.exitCode=2
