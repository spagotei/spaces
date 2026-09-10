import fs from 'node:fs/promises'
import path from 'node:path'
import { build } from 'vite'

const root = process.cwd()
const outRoot = path.join(root, 'dist-web')
const appOut = path.join(outRoot, 'app')

await fs.rm(outRoot, { recursive: true, force: true })

await build({
  base: '/app/',
  build: {
    outDir: appOut,
    emptyOutDir: true,
  },
})

await fs.writeFile(
  path.join(outRoot, '_redirects'),
  ['/app /app/ 301', '/app/* /app/index.html 200', ''].join('\n'),
  'utf8',
)

await fs.writeFile(
  path.join(outRoot, '_headers'),
  [
    '/app/index.html',
    '  Cache-Control: no-cache, no-store, must-revalidate',
    '',
    '/app/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
  ].join('\n'),
  'utf8',
)

console.log('')
console.log('Spaces web app built successfully.')
console.log('Web app root: dist-web/app')
console.log('Public route:  /app/')
console.log('Host root:     dist-web')
