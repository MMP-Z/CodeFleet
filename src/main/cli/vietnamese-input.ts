export type InputMode = 'system' | 'telex' | 'vni';

const tones = ['\u0301', '\u0300', '\u0309', '\u0303', '\u0323'];
const toneMarks = /[\u0300\u0301\u0303\u0309\u0323]/g;
const shapeMarks = /[\u0302\u0306\u031b]/g;
const circumflex = '\u0302';
const breve = '\u0306';
const horn = '\u031b';

export function parseInputMode(value: string | undefined): InputMode {
  if (value === 'system' || value === 'telex' || value === 'vni') return value;
  throw new Error('Chọn kiểu nhập system, telex hoặc vni.');
}

function base(letter: string): string {
  return letter[0].toLowerCase();
}

function moveTone(letters: string[], tone: string): void {
  if (!tone) return;
  let vowels = letters
    .map((letter, index) => ('aeiouy'.includes(base(letter)) ? index : -1))
    .filter((index) => index >= 0);
  const onset = base(letters[0] ?? ' ') + base(letters[1] ?? ' ');
  if (vowels.length > 1 && (onset === 'qu' || onset === 'gi'))
    vowels = vowels.filter((i) => i !== 1);
  if (!vowels.length) return;
  const last = vowels.at(-1)!;
  const marked = vowels.filter((i) => /[\u0302\u0306\u031b]/.test(letters[i])).at(-1);
  const closed = last < letters.length - 1;
  const modern = /^(oa|oe|uy)$/.test(vowels.map((i) => base(letters[i])).join(''));
  const target = marked ?? (vowels.length >= 3 ? vowels[1] : closed || modern ? last : vowels[0]);
  letters[target] += tone;
}

function shape(letters: string[], targets: number[], mark: string): boolean {
  const repeated = targets.every((index) => letters[index].includes(mark));
  for (const index of targets) {
    letters[index] = letters[index].replace(shapeMarks, '') + (repeated ? '' : mark);
  }
  return !repeated;
}

function composeWord(stem: string, key: string, mode: Exclude<InputMode, 'system'>): string {
  const lower = key.toLowerCase();
  const decomposed = Array.from(stem.normalize('NFC'), (letter) => letter.normalize('NFD'));
  let tone = decomposed.join('').match(toneMarks)?.[0] ?? '';
  const letters = decomposed.map((letter) => letter.replace(toneMarks, ''));
  const last = letters.length - 1;
  const toneIndex = (mode === 'telex' ? 'sfrxj' : '12345').indexOf(lower);
  let consumed = false;
  if (toneIndex >= 0 && letters.some((letter) => 'aeiouy'.includes(base(letter)))) {
    consumed = tone !== tones[toneIndex];
    tone = consumed ? tones[toneIndex] : '';
  } else if (lower === (mode === 'telex' ? 'z' : '0')) {
    const plain = stem
      .normalize('NFD')
      .replace(toneMarks, '')
      .replace(shapeMarks, '')
      .replace(/[đĐ]/g, (letter) => (letter === 'đ' ? 'd' : 'D'));
    if (plain.normalize('NFC') !== stem.normalize('NFC')) return plain.normalize('NFC');
  } else if ((lower === 'd' && mode === 'telex') || (lower === '9' && mode === 'vni')) {
    const index =
      mode === 'telex' ? last : letters.map((letter) => /[dđ]/i.test(letter)).lastIndexOf(true);
    const letter = letters[index];
    if (letter && /[dđ]/i.test(letter)) {
      consumed = base(letter) === 'd';
      const upper = letter === letter.toUpperCase();
      letters[index] = consumed ? (upper ? 'Đ' : 'đ') : upper ? 'D' : 'd';
    }
  } else if (
    (mode === 'telex' && /^[aeo]$/.test(lower) && base(letters[last]) === lower) ||
    (mode === 'vni' && lower === '6')
  ) {
    const index =
      mode === 'telex'
        ? last
        : letters.map((letter) => 'aeo'.includes(base(letter))).lastIndexOf(true);
    if (index >= 0) consumed = shape(letters, [index], circumflex);
  } else if ((mode === 'telex' && lower === 'w') || (mode === 'vni' && /[78]/.test(lower))) {
    const allowed = mode === 'telex' ? 'aou' : lower === '7' ? 'ou' : 'a';
    const index = letters.map((letter) => allowed.includes(base(letter))).lastIndexOf(true);
    if (index >= 0) {
      const isA = base(letters[index]) === 'a';
      const pair =
        index > 0 &&
        base(letters[index]) === 'o' &&
        base(letters[index - 1]) === 'u' &&
        !(index === 2 && base(letters[0]) === 'q');
      consumed = shape(letters, pair ? [index - 1, index] : [index], isA ? breve : horn);
    }
  }
  if (!consumed) letters.push(key);
  moveTone(letters, tone);
  return letters.join('').normalize('NFC');
}

/** Transform only a typed key at the end of a word; commands and pasted text stay literal. */
export function composeVietnamese(
  line: string,
  cursor: number,
  key: string,
  mode: Exclude<InputMode, 'system'>,
): { line: string; cursor: number } | undefined {
  if (!/^[a-z0-9]$/i.test(key) || line.trimStart().startsWith('/')) return;
  if (line[cursor - 1] !== key || /^[\p{L}\p{M}\d]/u.test(line.slice(cursor))) return;
  const stem = /[\p{L}\p{M}]+$/u.exec(line.slice(0, cursor - 1))?.[0];
  if (!stem || !/^[a-zđ]+$/i.test(stem.normalize('NFD').replace(/\p{M}/gu, ''))) return;
  const rendered = composeWord(stem, key, mode);
  if (rendered === stem + key) return;
  const start = cursor - stem.length - 1;
  return {
    line: line.slice(0, start) + rendered + line.slice(cursor),
    cursor: start + rendered.length,
  };
}
