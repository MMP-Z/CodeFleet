import { PassThrough } from 'node:stream';
import type { ReadStream } from 'node:tty';
import { expect, it, vi } from 'vitest';
import { createTerminalInput } from './terminal-input';

it('routes split mouse reports to scrolling while preserving keyboard arrows and UTF-8 input', async () => {
  const source = Object.assign(new PassThrough(), { setRawMode: vi.fn() });
  const scroll = vi.fn();
  const input = createTerminalInput(source as unknown as ReadStream, scroll);
  const text = (async () => {
    const chunks: Buffer[] = [];
    for await (const chunk of input) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
  })();
  source.write('\x1b');
  source.write('[<64;20;');
  source.write('15M\x1b[A\x1b[<0;5;3M');
  source.write('\x1b[<65;20;15M');
  const vietnamese = Buffer.from('chào');
  source.write(vietnamese.subarray(0, 3));
  source.end(vietnamese.subarray(3));

  expect(await text).toBe('\x1b[Achào');
  expect(scroll.mock.calls).toEqual([[1], [-1]]);
});
