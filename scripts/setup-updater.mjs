import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const projectRoot = resolve(process.cwd())
const configPath = join(projectRoot, 'src-tauri', 'tauri.conf.json')
const keyDir = join(homedir(), '.tauri')
const privateKey = join(keyDir, 'spaces.key')
const publicCandidates = [
  `${privateKey}.pub`,
  join(keyDir, 'spaces.pub'),
  join(keyDir, 'spaces.key.pub'),
]

mkdirSync(dirname(privateKey), { recursive: true })

if (!existsSync(privateKey)) {
  console.log('\nSpaces updater signing key does not exist yet.')
  console.log('Tauri will create it now. Keep the PRIVATE key safe and never upload/share it.\n')
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  const result = spawnSync(command, ['tauri', 'signer', 'generate', '-w', privateKey], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const publicKeyPath = publicCandidates.find(existsSync)
if (!publicKeyPath) {
  console.error(`\nPrivate key exists at ${privateKey}, but the public key file was not found.`)
  console.error('Do NOT overwrite the private key. Run `npx.cmd tauri signer generate --help` and recover/export its matching public key.')
  process.exit(1)
}

const publicKey = readFileSync(publicKeyPath, 'utf8').trim()
if (!publicKey) {
  console.error('The updater public key file is empty.')
  process.exit(1)
}

const config = JSON.parse(readFileSync(configPath, 'utf8'))
config.bundle ??= {}
config.bundle.createUpdaterArtifacts = true
config.plugins ??= {}
config.plugins.updater ??= {}
config.plugins.updater.pubkey = publicKey
config.plugins.updater.endpoints = ['https://scrounge-spaces-api.spagotei.workers.dev/v1/desktop/update/{{target}}/{{arch}}/{{current_version}}']
config.plugins.updater.windows = { installMode: 'passive' }
writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)

console.log('\n✓ Spaces updater public key embedded in src-tauri/tauri.conf.json')
console.log('✓ Updater artifacts enabled')
console.log(`✓ Private signing key remains outside the project: ${privateKey}`)
console.log('\nBefore EACH release build in PowerShell, set:')
console.log(`  $env:TAURI_SIGNING_PRIVATE_KEY="$env:USERPROFILE\\.tauri\\spaces.key"`)
console.log('  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD="YOUR_KEY_PASSWORD"')
console.log('  npm.cmd run desktop:build')
console.log('\nNever commit, upload, or send spaces.key to anyone. Back it up securely.')
