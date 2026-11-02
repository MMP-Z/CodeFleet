/**
 * Bộ lọc dữ liệu nhạy cảm cho hệ thống log theo Luật P9, B2, B3:
 * Log không bao giờ được chứa token, khoá API, mật khẩu, hoặc credential của CLI.
 */

const SENSITIVE_KEY_NAME =
  /^(?:api[-_]?key|access[-_]?token|refresh[-_]?token|id[-_]?token|oauth[-_]?token|client[-_]?secret|secret|password|passwd|authorization|cookie|session[-_]?token|private[-_]?key)$/i;

const TOKEN_PATTERNS: readonly RegExp[] = [
  // Header Authorization: Bearer ...
  /\b(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi,
  // Anthropic API / OAuth keys
  /\bsk-ant-[A-Za-z0-9_-]{8,}/g,
  // OpenAI API keys
  /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{16,}/g,
  // Google / Gemini API keys
  /\bAIza[0-9A-Za-z_-]{20,}/g,
  // GitHub tokens
  /\b(?:gh[pousr]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{16,})/g,
  // Cặp key=value hoặc "key": "value" nhạy cảm trong chuỗi
  /\b((?:api[-_]?key|access[-_]?token|refresh[-_]?token|id[-_]?token|secret|password|authorization)\s*[:=]\s*["']?)([^\s"',;}\]]+)/gi,
  // Biến môi trường kiểu .env (OPENAI_API_KEY=..., ANTHROPIC_AUTH_TOKEN=...)
  /\b([A-Z0-9_]*(?:API_KEY|AUTH_TOKEN|ACCESS_TOKEN|REFRESH_TOKEN|SECRET|PASSWORD)[A-Z0-9_]*\s*=\s*)([^\r\n]+)/g,
];

export const REDACTED_PLACEHOLDER = '[REDACTED]' as const;

export function redactSensitiveText(input: string): string {
  let result = input;

  result = result.replace(TOKEN_PATTERNS[0], `$1${REDACTED_PLACEHOLDER}`);
  result = result.replace(TOKEN_PATTERNS[1], REDACTED_PLACEHOLDER);
  result = result.replace(TOKEN_PATTERNS[2], REDACTED_PLACEHOLDER);
  result = result.replace(TOKEN_PATTERNS[3], REDACTED_PLACEHOLDER);
  result = result.replace(TOKEN_PATTERNS[4], REDACTED_PLACEHOLDER);
  result = result.replace(TOKEN_PATTERNS[5], `$1${REDACTED_PLACEHOLDER}`);
  result = result.replace(TOKEN_PATTERNS[6], `$1${REDACTED_PLACEHOLDER}`);

  return result;
}

export function redactUnknown(value: unknown, depth = 0): unknown {
  if (depth > 6) {
    return '[MAX_DEPTH]';
  }

  if (typeof value === 'string') {
    return redactSensitiveText(value);
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSensitiveText(value.message),
      stack: value.stack ? redactSensitiveText(value.stack) : undefined,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactUnknown(item, depth + 1));
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_NAME.test(k)) {
        out[k] = REDACTED_PLACEHOLDER;
      } else {
        out[k] = redactUnknown(v, depth + 1);
      }
    }
    return out;
  }

  return String(value);
}

