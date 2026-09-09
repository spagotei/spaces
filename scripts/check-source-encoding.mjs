import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const src = path.join(root, 'src')
const suspicious = [
  'Â·', 'Â©', 'Â®',
  'â€¦', 'â€”', 'â€“', 'â€™', 'â€œ', 'â€',
  'â†µ', 'â†‘', 'â†“',
  'ï»¿', '\uFFFD',
]

const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.html'])
const problems = []

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full)
      continue
    }
    if (!extensions.has(path.extname(entry.name).toLowerCase())) continue

    const text = fs.readFileSync(full, 'utf8')
    for (const token of suspicious) {
      if (text.includes(token)) {
        problems.push(`${path.relative(root, full)} contains ${JSON.stringify(token)}`)
      }
    }
    if (text.charCodeAt(0) === 0xFEFF) {
      problems.push(`${path.relative(root, full)} starts with a UTF-8 BOM`)
    }
  }
}

walk(src)

if (problems.length) {
  console.error('\nSource encoding check failed:')
  for (const problem of problems) console.error(`  - ${problem}`)
  console.error('\nFix the source as UTF-8 before building.')
  process.exit(1)
}

console.log('Source encoding check passed.')
