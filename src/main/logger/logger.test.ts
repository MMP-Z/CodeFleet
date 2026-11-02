import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createLogger } from './logger';
import { REDACTED_PLACEHOLDER, redactSensitiveText } from './redactor';

describe('Logger & Sensitive Redactor (Luật P9, B2)', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('redacts API keys, Bearer tokens, GitHub tokens, and .env secrets in text', () => {
    const raw = [
      'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secretpayload',
      'ProviderA key sk-ant-api03-abcdef1234567890XYZ',
      'ProviderB key sk-proj-1234567890abcdefghijklmnop',
      'ProviderC key AIzaSyA1234567890abcdefghijklmnopqrstu',
      'GitHub ghp_1234567890abcdefghijklmnopqrstuv',
      'PROVIDER_API_KEY=super-secret-value',
      'password=myPlainPassword123',
    ].join('\n');

    const cleaned = redactSensitiveText(raw);
    expect(cleaned).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(cleaned).not.toContain('sk-ant-api03');
    expect(cleaned).not.toContain('sk-proj-1234567890');
    expect(cleaned).not.toContain('AIzaSyA1234567890');
    expect(cleaned).not.toContain('ghp_1234567890');
    expect(cleaned).not.toContain('super-secret-value');
    expect(cleaned).not.toContain('myPlainPassword123');
    expect(cleaned).toContain(REDACTED_PLACEHOLDER);
  });

  it('writes JSONL logs with nested object & Error redaction without leaking secrets', () => {
    const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codefleet-log-test-'));
    tempDirs.push(logDir);

    const logger = createLogger({ logDir, scope: 'test' });
    const dbLogger = logger.child('db');

    dbLogger.warn('Failed auth with api_key=mySecret999', {
      accessToken: 'oauth-raw-token-abc',
      nested: {
        clientSecret: 'top-secret',
        safeField: 'hello-vietnam',
      },
      err: new Error('Request failed with Bearer secretJwtToken123456'),
    });

    const content = fs.readFileSync(logger.getLogFilePath(), 'utf8').trim();
    expect(content).not.toContain('mySecret999');
    expect(content).not.toContain('oauth-raw-token-abc');
    expect(content).not.toContain('top-secret');
    expect(content).not.toContain('secretJwtToken123456');

    const parsed = JSON.parse(content) as {
      scope: string;
      level: string;
      message: string;
      meta: {
        accessToken: string;
        nested: { clientSecret: string; safeField: string };
        err: { message: string };
      };
    };

    expect(parsed.scope).toBe('test:db');
    expect(parsed.level).toBe('warn');
    expect(parsed.meta.accessToken).toBe(REDACTED_PLACEHOLDER);
    expect(parsed.meta.nested.clientSecret).toBe(REDACTED_PLACEHOLDER);
    expect(parsed.meta.nested.safeField).toBe('hello-vietnam');
    expect(parsed.meta.err.message).toContain(REDACTED_PLACEHOLDER);
  });
});
