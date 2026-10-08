#!/usr/bin/env node
'use strict'
// SPACES_V81_4_OPTIMIZED - read-only report; no network, data wipe, or deploy.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib')
const root=path.resolve(__dirname,'..')
for(const rel of ['dist','dist-web/app']){
 const dir=path.join(root,rel);if(!fs.existsSync(dir))continue;
 const rows=[];function walk(d){for(const x of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,x.name);if(x.isDirectory())walk(p);else if(x.isFile()){const bytes=fs.readFileSync(p);rows.push({file:path.relative(dir,p).replace(/\\/g,'/'),bytes:bytes.length,gzip:/\.(js|css|html|json|svg)$/.test(x.name)?zlib.gzipSync(bytes).length:null})}}}
 walk(dir);rows.sort((a,b)=>b.bytes-a.bytes);const total=rows.reduce((s,x)=>s+x.bytes,0);
 console.log('\n'+rel+': '+rows.length+' files, '+(total/1048576).toFixed(2)+' MiB uncompressed');
 for(const x of rows.slice(0,15))console.log((x.bytes/1048576).toFixed(2)+' MiB '+x.file+(x.gzip===null?'':' (gzip '+(x.gzip/1048576).toFixed(2)+' MiB)'))
}
