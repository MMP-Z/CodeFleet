#!/usr/bin/env node
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

async function main() {
  const root = path.resolve(__dirname, '..');
  const entry = path.join(root, 'out/cli/index.cjs');
  if (!fs.existsSync(entry)) await require('./build-cli.cjs').buildCli();
  const child = spawn(process.execPath, [entry, ...process.argv.slice(2)], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });
  // The child owns interactive Ctrl+C handling.
  process.on('SIGINT', () => {});
  child.on('error', (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.on('exit', (code) => {
    process.exitCode = code ?? 1;
  });
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
