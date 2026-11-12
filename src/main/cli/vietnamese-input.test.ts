import { expect, it } from 'vitest';
import { composeVietnamese } from './vietnamese-input';

function type(text: string, mode: 'telex' | 'vni'): string {
  let line = '';
  for (const key of text) {
    line += key;
    line = composeVietnamese(line, line.length, key, mode)?.line ?? line;
  }
  return line;
}

it('composes common Telex and VNI words with case, horns and tone marks', () => {
  expect(type('Tooi gox tieengs Vieetj treen dduowngf.', 'telex')).toBe(
    'Tôi gõ tiếng Việt trên đường.',
  );
  expect(type('To6i go4 tie6ng1 Vie6t5 tre6n d9uo7ng2.', 'vni')).toBe(
    'Tôi gõ tiếng Việt trên đường.',
  );
  expect(type('qua3, gia1, hoa2, vuon72', 'vni')).toBe('quả, giá, hoà, vườn');
});

it('preserves slash commands and allows a repeated mark to be entered literally', () => {
  expect(type('/model gpt-5.6-sol', 'telex')).toBe('/model gpt-5.6-sol');
  expect(type('ass', 'telex')).toBe('as');
  expect(type('a11', 'vni')).toBe('a1');
});
