const fs = require('fs');
const path = require('path');
const app = process.argv[2];
const wanted = process.argv[3] || '0.0.21';
function read(rel){ return fs.readFileSync(path.join(app,rel),'utf8'); }
let bad = false;
const pkg = JSON.parse(read('package.json'));
const tauri = JSON.parse(read(path.join('src-tauri','tauri.conf.json')));
const toml = read(path.join('src-tauri','Cargo.toml'));
const lock = read(path.join('src-tauri','Cargo.lock'));
const tomlMatch = toml.match(/\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/);
const lockMatch = lock.match(/\[\[package\]\][\s\S]*?name\s*=\s*"spaces-app"[\s\S]*?version\s*=\s*"([^"]+)"/);
const vals = { package: pkg.version, tauri: tauri.version, cargo: tomlMatch?.[1], lock: lockMatch?.[1] };
console.log(vals);
for (const [k,v] of Object.entries(vals)) if (v !== wanted) { console.error(`[FAIL] ${k}=${v} expected ${wanted}`); bad = true; }
if (bad) process.exit(1);
console.log('[OK] All version metadata matches ' + wanted);
