#!/usr/bin/env node
'use strict'
// SPACES_V81_4_OPTIMIZED: strictly Android-dist only; never prune public/ or web/desktop outputs.
const fs=require('node:fs'),path=require('node:path')
const out=path.resolve(__dirname,'..','dist')
if(!fs.existsSync(path.join(out,'index.html')))throw new Error('Android dist/index.html missing. Refusing to prune.')
const files=[
 'Spaces-Bootloading-V76-transparent.webm',
 'Spaces-Bootloading-V77-transparent.webm',
 'Spaces-Buildings-Boot-V75-alpha.webm',
 'Spaces-Buildings-Boot-V75.mp4',
 'spaces-build-and-pour-desktop.mp4'
]
let bytes=0
for(const file of files){
 const target=path.join(out,file)
 if(!fs.existsSync(target))continue
 bytes+=fs.statSync(target).size
 fs.rmSync(target)
 console.log('Android-only removed obsolete/desktop startup media: '+file)
}
console.log('Android media pruning saved '+(bytes/1048576).toFixed(2)+' MiB of uncompressed bundled assets.')
