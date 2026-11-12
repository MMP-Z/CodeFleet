import { spawnSync } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { Transform } from 'node:stream';
import type { ReadStream } from 'node:tty';

const mousePrefix = '\x1b[<';

function enableWindowsVtInput(): void {
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -Namespace CodeFleet -Name ConsoleInput -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("kernel32.dll")]
public static extern System.IntPtr GetStdHandle(int id);
[System.Runtime.InteropServices.DllImport("kernel32.dll")]
public static extern bool GetConsoleMode(System.IntPtr handle, out uint mode);
[System.Runtime.InteropServices.DllImport("kernel32.dll")]
public static extern bool SetConsoleMode(System.IntPtr handle, uint mode);
'@
$handle = [CodeFleet.ConsoleInput]::GetStdHandle(-10)
$mode = [uint32]0
if (-not [CodeFleet.ConsoleInput]::GetConsoleMode($handle, [ref]$mode)) { exit 1 }
if (-not [CodeFleet.ConsoleInput]::SetConsoleMode($handle, (($mode -bor 0x290) -band (-bnot 0x40)))) { exit 1 }
`;
  // Node's Windows raw mode clears the console flags needed for VT mouse reports.
  spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(script, 'utf16le').toString('base64'),
    ],
    { stdio: ['inherit', 'ignore', 'ignore'], windowsHide: true, timeout: 4000 },
  );
}

export function createTerminalInput(source: ReadStream, scroll: (direction: number) => void) {
  const decoder = new StringDecoder('utf8');
  let pending = '';
  let flushTimer: ReturnType<typeof setTimeout> | undefined;

  function consume(data: string): void {
    clearTimeout(flushTimer);
    let text = pending + data;
    pending = '';
    let start = text.indexOf(mousePrefix);
    while (start >= 0) {
      input.push(text.slice(0, start));
      text = text.slice(start);
      const body = text.slice(mousePrefix.length);
      const report = /^(\d{1,5});\d{1,5};\d{1,5}([Mm])/.exec(body);
      if (report) {
        const button = Number(report[1]);
        if (report[2] === 'M' && (button & 0b11100000) === 64 && (button & 3) < 2) {
          scroll((button & 1) === 0 ? 1 : -1);
        }
        text = body.slice(report[0].length);
      } else if (/^\d{0,5}(?:;\d{0,5}){0,2}$/.test(body)) {
        pending = text;
        text = '';
        break;
      } else {
        // A malformed report is consumed without swallowing the next key.
        text = body.replace(/^[\d;]{0,17}[Mm]?/, '');
      }
      start = text.indexOf(mousePrefix);
    }
    if (text.endsWith('\x1b[')) {
      pending = '\x1b[';
      text = text.slice(0, -2);
    } else if (text.endsWith('\x1b')) {
      pending = '\x1b';
      text = text.slice(0, -1);
    }
    input.push(text);
    if (pending) {
      flushTimer = setTimeout(() => {
        if (!pending.startsWith(mousePrefix)) input.push(pending);
        pending = '';
      }, 80);
      flushTimer.unref();
    }
  }

  const input = Object.assign(
    new Transform({
      transform(chunk: Buffer, _encoding, done) {
        consume(decoder.write(chunk));
        done();
      },
      flush(done) {
        consume(decoder.end());
        if (!pending.startsWith(mousePrefix)) this.push(pending);
        clearTimeout(flushTimer);
        done();
      },
      destroy(error, done) {
        clearTimeout(flushTimer);
        done(error);
      },
    }),
    {
      isTTY: true,
      setRawMode(mode: boolean): void {
        source.setRawMode(mode);
        if (mode && process.platform === 'win32' && source.isTTY) enableWindowsVtInput();
      },
    },
  );
  source.pipe(input);
  return input;
}
