#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const root = process.cwd();
const source = path.join(root, 'src/features/voice/v81');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spaces-v81-test-'));
try {
  const ts = require('typescript');
  for (const name of ['SpacesCallSoundsV81.ts','SpacesPeerCallV81.ts']) {
    const input = fs.readFileSync(path.join(source,name),'utf8');
    const output = ts.transpileModule(input, { fileName:name, compilerOptions:{ target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.CommonJS, esModuleInterop:true, resolveJsonModule:true }});
    fs.writeFileSync(path.join(tmp,name.replace(/\.ts$/,'.cjs')),output.outputText);
  }
  fs.copyFileSync(path.join(source,'sound-manifest-v81.json'),path.join(tmp,'sound-manifest-v81.json'));
  // Explicit .cjs output avoids inheriting type=module from a parent package.json.
  const contract = fs.readFileSync(path.join(source,'SpacesVoiceUiContractV81.ts'),'utf8');
  const compiledContract = ts.transpileModule(contract, {fileName:'SpacesVoiceUiContractV81.ts',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
  fs.writeFileSync(path.join(tmp,'SpacesVoiceUiContractV81.cjs'),compiledContract.outputText);
  const icons = fs.readFileSync(path.join(source,'SpacesVoiceIconV81.tsx'),'utf8');
  const compiledIcons = ts.transpileModule(icons,{fileName:'SpacesVoiceIconV81.tsx',reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}});
  if (compiledIcons.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error)) throw new Error('Voice icon TSX transpile failed');
  const result = cp.spawnSync(process.execPath,[path.join(root,'scripts/v81-foundation.test.cjs'),root],{
    cwd:root, env:{...process.env,SPACES_V81_TEST_BUILD_DIR:tmp},stdio:'inherit',windowsHide:true
  });
  if (result.error) throw result.error;
  if (result.status!==0) process.exitCode=result.status || 1;
} catch (error) {
  console.error('V81 foundation check failed:',error?.stack || error);
  process.exitCode=1;
} finally { fs.rmSync(tmp,{recursive:true,force:true}); }
