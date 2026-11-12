import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { quotaLabel } from '../cli/quota-label';
import { migration001Initial } from '../db/migrations/001-initial';
import * as binaryResolver from './binary-resolver';
import { ClaudeAdapter } from './claude';
import { CodexAdapter } from './codex';
import { CopilotAdapter } from './copilot';
import { ModelTierService } from './models';
import { AgentSessionRepository } from './session-repo';

describe('quota cho claude/codex/copilot', () => {
  let db: Database.Database;
  let tempDir: string;
  let modelsService: ModelTierService;
  let sessionRepo: AgentSessionRepository;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codefleet-quota-'));
    db = new Database(':memory:');
    db.exec(migration001Initial.sql);
    modelsService = new ModelTierService({ db, userDataDir: tempDir });
    sessionRepo = new AgentSessionRepository(db);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('Claude đọc hạn mức 5 giờ / tuần từ usage chính thức', async () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    const adapter = new ClaudeAdapter(modelsService, sessionRepo, undefined, undefined, async () => ({
      five_hour: { utilization: 25, resets_at: future },
      seven_day: { utilization: 60, resets_at: future },
    }));
    const quota = await adapter.getQuota();
    expect(quota[0]).toMatchObject({ source: 'official', status: 'ok' });
    expect(quotaLabel('claude', undefined, quota)).toBe('Còn 5h 75% · Tuần 40%');
  });

  it('Claude hạ về unknown khi không đọc được usage', async () => {
    const adapter = new ClaudeAdapter(modelsService, sessionRepo, undefined, undefined, async () => {
      throw new Error('no credentials');
    });
    const quota = await adapter.getQuota();
    expect(quota[0].status).toBe('unknown');
    expect(quotaLabel('claude', undefined, quota)).toBe('Còn 5h — · Tuần —');
  });

  it('Codex đọc rate_limits mới nhất từ rollout log', () => {
    const resetsAt = Math.floor(Date.now() / 1000) + 3600;
    const day = path.join(tempDir, '2026', '11', '11');
    fs.mkdirSync(day, { recursive: true });
    const line = (primary: number) =>
      JSON.stringify({
        timestamp: new Date().toISOString(),
        type: 'event_msg',
        payload: {
          type: 'token_count',
          rate_limits: {
            primary: { used_percent: primary, window_minutes: 300, resets_at: resetsAt },
            secondary: { used_percent: 17, window_minutes: 10080, resets_at: resetsAt + 86400 },
          },
        },
      });
    fs.writeFileSync(path.join(day, 'rollout-a.jsonl'), [line(10), line(98), '{"broken'].join('\n'));
    const adapter = new CodexAdapter(modelsService, sessionRepo);
    const snapshot = adapter.readSessionRateLimits(tempDir);
    expect(snapshot).toMatchObject({ source: 'official', status: 'low' });
    expect(quotaLabel('codex', undefined, snapshot ? [snapshot] : [])).toBe(
      'Còn 5h 2% · Tuần 83%',
    );
  });

  it('Codex coi cửa sổ đã reset là chưa dùng', () => {
    const adapter = new CodexAdapter(modelsService, sessionRepo);
    const snapshot = adapter.parseRateLimitsFromLog(
      JSON.stringify({
        payload: {
          rate_limits: {
            primary: { used_percent: 90, window_minutes: 300, resets_at: 1 },
          },
        },
      }),
    );
    expect(snapshot?.windows[0]).toMatchObject({ label: '5 giờ', usedPercent: 0, resetsAt: null });
  });

  it('Copilot đọc lượt premium hằng tháng từ account.getQuota', async () => {
    vi.spyOn(binaryResolver, 'resolveAgentBinary').mockReturnValue('copilot');
    const adapter = new CopilotAdapter(
      modelsService,
      sessionRepo,
      undefined,
      undefined,
      async () => ({
        quotaSnapshots: {
          premium_interactions: {
            isUnlimitedEntitlement: false,
            entitlementRequests: 200,
            usedRequests: 81,
            remainingPercentage: 59.6,
            resetDate: new Date(Date.now() - 1000).toISOString(),
          },
        },
      }),
    );
    const quota = await adapter.getQuota();
    expect(quota[0]).toMatchObject({ source: 'official', status: 'ok' });
    expect(quota[0].windows[0].resetsAt).toBeNull();
    expect(quotaLabel('copilot', undefined, quota)).toBe('Còn tháng 60% (119/200 lượt)');
  });
});
