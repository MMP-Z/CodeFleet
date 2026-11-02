import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, 'fixtures');

const ClaudeStatuslineSchema = z.object({
  rate_limits: z
    .object({
      five_hour: z
        .object({
          used_percentage: z.number(),
          resets_at: z.number(),
        })
        .optional(),
      seven_day: z
        .object({
          used_percentage: z.number(),
          resets_at: z.number(),
        })
        .optional(),
    })
    .nullable()
    .optional(),
});

function parseClaudeQuotaTierA(rawJson, lowThreshold = 80) {
  try {
    const parsed = ClaudeStatuslineSchema.parse(JSON.parse(rawJson));
    if (!parsed.rate_limits) {
      return {
        agentId: 'claude',
        model: null,
        scope: 'shared',
        windows: [],
        status: 'unknown',
        source: 'unknown',
      };
    }
    const windows = [];
    if (parsed.rate_limits.five_hour) {
      windows.push({
        label: '5 giờ',
        usedPercent: parsed.rate_limits.five_hour.used_percentage,
        resetsAt: new Date(parsed.rate_limits.five_hour.resets_at * 1000).toISOString(),
      });
    }
    if (parsed.rate_limits.seven_day) {
      windows.push({
        label: 'Tuần',
        usedPercent: parsed.rate_limits.seven_day.used_percentage,
        resetsAt: new Date(parsed.rate_limits.seven_day.resets_at * 1000).toISOString(),
      });
    }
    const maxPct = Math.max(...windows.map((w) => w.usedPercent ?? 0), 0);
    const status = maxPct >= 100 ? 'exhausted' : maxPct >= lowThreshold ? 'low' : 'ok';
    return {
      agentId: 'claude',
      model: null,
      scope: 'shared',
      windows,
      status,
      source: 'official',
    };
  } catch {
    // Luật 6.6 Độ bền: parse lỗi -> hạ về unknown, không làm app lỗi
    return {
      agentId: 'claude',
      model: null,
      scope: 'unknown',
      windows: [],
      status: 'unknown',
      source: 'unknown',
    };
  }
}

function estimateCodexQuotaTierB(jsonlText, fiveHourTokenCap = 140000, lowThreshold = 80) {
  try {
    let totalTokens = 0;
    for (const line of jsonlText.trim().split(/\r?\n/)) {
      if (!line) continue;
      const evt = JSON.parse(line);
      if (evt.type === 'turn.completed' && evt.usage) {
        totalTokens += (evt.usage.input_tokens || 0) + (evt.usage.output_tokens || 0);
      }
    }
    const usedPercent = Math.min(100, Math.round((totalTokens / fiveHourTokenCap) * 100));
    const status = usedPercent >= 100 ? 'exhausted' : usedPercent >= lowThreshold ? 'low' : 'ok';
    return {
      agentId: 'codex',
      model: null,
      scope: 'unknown',
      windows: [{ label: '5 giờ', usedPercent, resetsAt: null }],
      status,
      source: 'estimated',
    };
  } catch {
    return {
      agentId: 'codex',
      model: null,
      scope: 'unknown',
      windows: [],
      status: 'unknown',
      source: 'unknown',
    };
  }
}

function parseGeminiRateLimitTierC(rawJson) {
  const obj = JSON.parse(rawJson);
  const msg = obj?.error?.message || '';
  const modelMatch = msg.match(/model '([^']+)'/) || [null, obj?.error?.data?.model ?? null];
  return {
    agentId: 'gemini',
    model: modelMatch[1],
    scope: 'model',
    status: 'exhausted',
    source: 'detected',
  };
}

function main() {
  console.log('=== SPIKE 04: CLI Fixture Parsers & Quota Fallback ===');

  // 1. Claude Tier A statusline quota
  const claudeQuotaRaw = fs.readFileSync(path.join(FIXTURES, 'claude', 'statusline-quota.json'), 'utf8');
  const claudeSnap = parseClaudeQuotaTierA(claudeQuotaRaw);
  assert.equal(claudeSnap.source, 'official');
  assert.equal(claudeSnap.status, 'ok');
  assert.equal(claudeSnap.windows[0].usedPercent, 62);
  console.log('[PASS] Claude Tier A statusline quota fixture parsed:', claudeSnap.status, claudeSnap.windows[0]);

  // 2. Malformed Claude output -> graceful fallback to unknown (no crash)
  const brokenSnap = parseClaudeQuotaTierA('<<<NOT VALID JSON>>>');
  assert.equal(brokenSnap.status, 'unknown');
  assert.equal(brokenSnap.source, 'unknown');
  console.log('[PASS] Malformed quota payload gracefully degrades to status=unknown.');

  // 3. Codex Tier B token estimation from JSONL session log
  const codexLogRaw = fs.readFileSync(path.join(FIXTURES, 'codex', 'session-log-usage.jsonl'), 'utf8');
  const codexSnap = estimateCodexQuotaTierB(codexLogRaw, 140000, 80);
  assert.equal(codexSnap.source, 'estimated');
  assert.equal(codexSnap.status, 'low'); // (48000+6200+52000+8100)/140000 = 82%
  console.log('[PASS] Codex Tier B local JSONL quota estimation parsed:', codexSnap.windows[0].usedPercent + '%', codexSnap.status);

  // 4. Gemini Tier C per-model 429 detection
  const gemini429Raw = fs.readFileSync(path.join(FIXTURES, 'gemini', 'rate-limit-429.json'), 'utf8');
  const geminiSnap = parseGeminiRateLimitTierC(gemini429Raw);
  assert.equal(geminiSnap.scope, 'model');
  assert.equal(geminiSnap.model, 'gemini-2.5-pro');
  assert.equal(geminiSnap.status, 'exhausted');
  assert.equal(geminiSnap.source, 'detected');
  console.log('[PASS] Gemini Tier C per-model 429 rate_limit detected:', geminiSnap.model);

  // 5. Stream turn NDJSON validation across all 3 CLIs
  for (const rel of [
    ['claude', 'stream-turn.ndjson'],
    ['codex', 'exec-stream.ndjson'],
    ['gemini', 'stream-turn.ndjson'],
    ['gemini', 'acp-session-updates.ndjson'],
  ]) {
    const raw = fs.readFileSync(path.join(FIXTURES, ...rel), 'utf8').trim();
    const events = raw.split(/\r?\n/).map((l) => JSON.parse(l));
    assert.ok(events.length >= 3, `Expected >=3 events in ${rel.join('/')}`);
  }
  console.log('[PASS] All stream/ACP NDJSON fixtures validated for Claude, Codex, and Gemini.');
  console.log('=== ALL FIXTURE PARSER SPIKE TESTS PASSED ===');
}

main();
