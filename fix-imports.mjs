import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const srcDir = path.join(root, 'src')

if (!fs.existsSync(srcDir)) {
  console.error('ERROR: Run this from the SpacesApp project root (the folder containing src/).')
  process.exit(1)
}

const featureDir = path.join(srcDir, 'features')
let changedFiles = 0
let replacements = 0

function patchFile(file, transforms) {
  if (!fs.existsSync(file)) return
  const before = fs.readFileSync(file, 'utf8')
  let after = before
  for (const [from, to] of transforms) {
    const count = after.split(from).length - 1
    if (count > 0) {
      after = after.split(from).join(to)
      replacements += count
    }
  }
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8')
    changedFiles += 1
    console.log(`fixed: ${path.relative(root, file)}`)
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (/\.(ts|tsx)$/.test(entry.name)) {
      patchFile(full, [
        ["from '../state/", "from '../../state/"],
        ["from \"../state/", "from \"../../state/"],
        ["from '../types/", "from '../../types/"],
        ["from \"../types/", "from \"../../types/"],
        ["from '../utils/", "from '../../utils/"],
        ["from \"../utils/", "from \"../../utils/"],
        ["from '../components/", "from '../../components/"],
        ["from \"../components/", "from \"../../components/"],
        ["from '../api/", "from '../../api/"],
        ["from \"../api/", "from \"../../api/"],
      ])
    }
  }
}

walk(featureDir)

patchFile(path.join(srcDir, 'state', 'SpacesContext.tsx'), [
  ["from '../../api/", "from '../api/"],
  ["from \"../../api/", "from \"../api/"],
  ["from '../../types/", "from '../types/"],
  ["from \"../../types/", "from \"../types/"],
  ["from '../../utils/", "from '../utils/"],
  ["from \"../../utils/", "from \"../utils/"],
  ["from '../../components/", "from '../components/"],
  ["from \"../../components/", "from \"../components/"],
])

console.log(`\nDone. ${changedFiles} file(s) changed, ${replacements} import(s) repaired.`)
console.log('Now running TypeScript check...\n')
