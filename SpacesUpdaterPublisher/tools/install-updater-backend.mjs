import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundleRoot = resolve(here, '..')
const targetRoot = process.env.SPACES_BACKEND_DIR || join(homedir(), 'OneDrive', 'Documents', 'spaces')
const workerTemplate = join(bundleRoot, 'templates', 'worker.js')
const publisherTemplate = join(bundleRoot, 'tools', 'publish-desktop-update.mjs')
const notesTemplate = join(bundleRoot, 'release-notes', '0.0.12.txt')

function fail(message) {
  console.error(`\n[ERROR] ${message}`)
  process.exit(1)
}

if (!existsSync(targetRoot)) fail(`Spaces backend folder not found: ${targetRoot}`)
if (!existsSync(workerTemplate)) fail('Updater Worker template is missing from this package.')

const configCandidates = [
  join(targetRoot, 'wrangler.jsonc'),
  join(targetRoot, 'wrangler.json'),
  join(targetRoot, 'wrangler.toml'),
]
const configPath = configCandidates.find(existsSync)
if (!configPath) fail('Could not find wrangler.jsonc, wrangler.json, or wrangler.toml in the Spaces backend.')

const originalConfig = readFileSync(configPath, 'utf8')
let mainPath = ''

if (configPath.endsWith('.toml')) {
  mainPath = originalConfig.match(/^\s*main\s*=\s*["']([^"']+)["']/m)?.[1] ?? ''
} else {
  mainPath = originalConfig.match(/["']main["']\s*:\s*["']([^"']+)["']/)?.[1] ?? ''
}

if (!mainPath) fail(`Could not determine the Worker main path from ${basename(configPath)}.`)
const workerPath = resolve(targetRoot, mainPath)
if (!existsSync(workerPath)) fail(`Configured Worker file does not exist: ${workerPath}`)

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupRoot = join(targetRoot, '.spaces-updater-backups', stamp)
mkdirSync(backupRoot, { recursive: true })
copyFileSync(workerPath, join(backupRoot, basename(workerPath)))
copyFileSync(configPath, join(backupRoot, basename(configPath)))

function addJsoncR2Binding(text) {
  if (/"binding"\s*:\s*"DESKTOP_RELEASES"/u.test(text)) return text

  const propertyMatch = /"r2_buckets"\s*:\s*\[/u.exec(text)
  if (propertyMatch) {
    const arrayStart = propertyMatch.index + propertyMatch[0].lastIndexOf('[')
    let depth = 0
    let inString = false
    let escaped = false
    let arrayEnd = -1

    for (let index = arrayStart; index < text.length; index += 1) {
      const ch = text[index]
      if (inString) {
        if (escaped) escaped = false
        else if (ch === '\\') escaped = true
        else if (ch === '"') inString = false
        continue
      }
      if (ch === '"') { inString = true; continue }
      if (ch === '[') depth += 1
      if (ch === ']') {
        depth -= 1
        if (depth === 0) { arrayEnd = index; break }
      }
    }

    if (arrayEnd < 0) fail('Could not safely edit the existing r2_buckets array.')
    const before = text.slice(0, arrayEnd)
    const after = text.slice(arrayEnd)
    const needsComma = before.trimEnd().endsWith('[') ? '' : ','
    return `${before}${needsComma}\n    {\n      "binding": "DESKTOP_RELEASES",\n      "bucket_name": "spaces-desktop-releases"\n    }\n  ${after}`
  }

  const lastBrace = text.lastIndexOf('}')
  if (lastBrace < 0) fail('Could not safely edit Wrangler JSON configuration.')
  const before = text.slice(0, lastBrace).trimEnd()
  const comma = before.endsWith('{') || before.endsWith(',') ? '' : ','
  return `${before}${comma}\n  "r2_buckets": [\n    {\n      "binding": "DESKTOP_RELEASES",\n      "bucket_name": "spaces-desktop-releases"\n    }\n  ]\n}\n`
}

function addTomlR2Binding(text) {
  if (/binding\s*=\s*["']DESKTOP_RELEASES["']/u.test(text)) return text
  return `${text.trimEnd()}\n\n[[r2_buckets]]\nbinding = "DESKTOP_RELEASES"\nbucket_name = "spaces-desktop-releases"\n`
}

const nextConfig = configPath.endsWith('.toml')
  ? addTomlR2Binding(originalConfig)
  : addJsoncR2Binding(originalConfig)

writeFileSync(configPath, nextConfig)
copyFileSync(workerTemplate, workerPath)

const scriptsDir = join(targetRoot, 'scripts')
const notesDir = join(targetRoot, 'release-notes')
mkdirSync(scriptsDir, { recursive: true })
mkdirSync(notesDir, { recursive: true })
copyFileSync(publisherTemplate, join(scriptsDir, 'publish-desktop-update.mjs'))
copyFileSync(notesTemplate, join(notesDir, '0.0.12.txt'))

console.log('\n[OK] Desktop updater backend files installed.')
console.log(`[OK] Worker: ${workerPath}`)
console.log(`[OK] Wrangler config: ${configPath}`)
console.log(`[OK] Backup: ${backupRoot}`)
console.log('[OK] R2 binding: DESKTOP_RELEASES -> spaces-desktop-releases')
console.log('[OK] Publisher: scripts/publish-desktop-update.mjs')
