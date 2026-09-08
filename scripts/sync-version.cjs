const fs = require('fs');
const path = require('path');
const app = process.argv[2];
const version = process.argv[3] || '0.0.21';
if (!app) throw new Error('Missing app path');
function read(rel) { return fs.readFileSync(path.join(app, rel), 'utf8'); }
function write(rel, txt) { fs.writeFileSync(path.join(app, rel), txt); }
const packagePath = path.join(app, 'package.json');
if (!fs.existsSync(packagePath)) throw new Error(`Missing ${packagePath}`);
const pkg = JSON.parse(read('package.json'));
pkg.version = version;
write('package.json', JSON.stringify(pkg, null, 2) + '\n');
if (fs.existsSync(path.join(app, 'package-lock.json'))) {
  const lock = JSON.parse(read('package-lock.json'));
  lock.version = version;
  if (lock.packages && lock.packages['']) lock.packages[''].version = version;
  write('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
}
const tauriRel = path.join('src-tauri', 'tauri.conf.json');
if (fs.existsSync(path.join(app, tauriRel))) {
  const tauri = JSON.parse(read(tauriRel));
  tauri.version = version;
  write(tauriRel, JSON.stringify(tauri, null, 2) + '\n');
}
const cargoTomlRel = path.join('src-tauri', 'Cargo.toml');
if (fs.existsSync(path.join(app, cargoTomlRel))) {
  let c = read(cargoTomlRel);
  const lines = c.split(/\r?\n/);
  let inPackage = false, changed = false;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (/^\[.*\]$/.test(t)) inPackage = t === '[package]';
    else if (inPackage && /^version\s*=/.test(t)) {
      const indent = (lines[i].match(/^\s*/) || [''])[0];
      lines[i] = `${indent}version = "${version}"`;
      changed = true; break;
    }
  }
  if (!changed) throw new Error('Could not locate [package] version in Cargo.toml');
  write(cargoTomlRel, lines.join(c.includes('\r\n') ? '\r\n' : '\n'));
}
const cargoLockRel = path.join('src-tauri', 'Cargo.lock');
if (fs.existsSync(path.join(app, cargoLockRel))) {
  let c = read(cargoLockRel);
  const lines = c.split(/\r?\n/);
  let inPackage = false, isSpaces = false, changed = false;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === '[[package]]') { inPackage = true; isSpaces = false; continue; }
    if (inPackage && /^name\s*=\s*"spaces-app"\s*$/.test(t)) { isSpaces = true; continue; }
    if (inPackage && isSpaces && /^version\s*=/.test(t)) {
      const indent = (lines[i].match(/^\s*/) || [''])[0];
      lines[i] = `${indent}version = "${version}"`;
      changed = true; break;
    }
  }
  if (changed) write(cargoLockRel, lines.join(c.includes('\r\n') ? '\r\n' : '\n'));
  else console.warn('[WARN] spaces-app package entry was not found in Cargo.lock');
}
console.log(`[OK] Synchronized package/Tauri/Rust version metadata to ${version}`);
