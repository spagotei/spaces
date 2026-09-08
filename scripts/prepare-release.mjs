import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const confPath = path.join(root, 'src-tauri', 'tauri.conf.json')
const conf = JSON.parse(fs.readFileSync(confPath, 'utf8'))

conf.version = pkg.version
conf.bundle ??= {}
conf.bundle.createUpdaterArtifacts = true

fs.writeFileSync(confPath, `${JSON.stringify(conf, null, 2)}\n`)
console.log(`Spaces desktop release prepared as ${pkg.version}.`)
console.log('Updater public key/endpoints were preserved exactly as they already existed.')
console.log('createUpdaterArtifacts = true')
