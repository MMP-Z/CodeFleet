import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rebuild } from '@electron/rebuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

async function main() {
  console.log('=== SPIKE 02: better-sqlite3 + Electron + electron-builder on Windows ===');

  const electronPkgPath = require.resolve('electron/package.json');
  const electronPkg = JSON.parse(fs.readFileSync(electronPkgPath, 'utf8'));
  const electronBin = require('electron');
  const electronBuilderPkg = JSON.parse(
    fs.readFileSync(require.resolve('electron-builder/package.json'), 'utf8'),
  );

  console.log(`Detected Electron ${electronPkg.version}, electron-builder ${electronBuilderPkg.version}`);
  console.log('Rebuilding better-sqlite3 for Electron ABI via @electron/rebuild...');

  await rebuild({
    buildPath: __dirname,
    electronVersion: electronPkg.version,
    onlyModules: ['better-sqlite3'],
    force: true,
  });

  console.log('[PASS] @electron/rebuild compiled better-sqlite3 for Electron ABI.');

  // Launch headless Electron main process to run SQLite WAL + Migration 001 + Backup test
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;

  const res = spawnSync(electronBin, [path.join(__dirname, '02-sqlite-electron-main.cjs')], {
    cwd: __dirname,
    env,
    encoding: 'utf8',
  });

  if (res.status !== 0) {
    console.error('Electron stdout:', res.stdout);
    console.error('Electron stderr:', res.stderr);
    throw new Error(`Electron exited with non-zero code: ${res.status}`);
  }

  const lines = res.stdout.trim().split(/\r?\n/);
  const resultJson = JSON.parse(lines[lines.length - 1]);
  console.log('[PASS] Electron main process SQLite WAL + Migration 001 + P8 backup verified:', resultJson);

  // Restore Node ABI build for normal Node scripts if needed
  execFileSync('pnpm', ['rebuild', 'better-sqlite3'], {
    cwd: __dirname,
    shell: true,
    stdio: 'ignore',
  });
  console.log('[PASS] Restored Node ABI build via pnpm rebuild.');
  console.log('=== ALL SQLITE + ELECTRON SPIKE TESTS PASSED ===');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

