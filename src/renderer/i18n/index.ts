import viMessages from './vi.json';

type NestedRecord = { [key: string]: string | NestedRecord };

/**
 * Tra cứu chuỗi tiếng Việt theo khoá phân cấp (vd: 'mh11.title').
 * Tuân thủ Luật U4 và UI_SPEC G4: mọi chuỗi giao diện tách riêng.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const segments = key.split('.');
  let current: string | NestedRecord | undefined = viMessages as NestedRecord;

  for (const segment of segments) {
    if (typeof current !== 'object' || current === null || !(segment in current)) {
      return key;
    }
    current = current[segment];
  }

  if (typeof current !== 'string') {
    return key;
  }

  if (!params) {
    return current;
  }

  return current.replace(/\{(\w+)\}/g, (_match, paramName: string) => {
    const val = params[paramName];
    return val === undefined ? `{${paramName}}` : String(val);
  });
}
