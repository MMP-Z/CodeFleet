// Register a Windows command without running npm lifecycle scripts or modifying PATH.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

if (process.platform !== 'win32') throw new Error('Use npm link on macOS/Linux.');
const npmCli = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const prefix = execFileSync(process.execPath, [npmCli, 'prefix', '-g'], {
  encoding: 'utf8',
}).trim();
const target = path.join(prefix, 'codefleet.cmd');
const entry = path.resolve(__dirname, 'codefleet.cjs');
const content = `@echo off\r\n@rem CodeFleet local CLI launcher\r\n"${process.execPath}" "${entry}" %*\r\n`;
if (
  fs.existsSync(target) &&
  !fs.readFileSync(target, 'utf8').includes('CodeFleet local CLI launcher')
) {
  throw new Error(`Command already exists: ${target}. Refusing to overwrite it.`);
}
fs.mkdirSync(prefix, { recursive: true });
fs.writeFileSync(target, content);
console.log(`Registered codefleet: ${target}`);
