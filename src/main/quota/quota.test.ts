import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migration001Initial } from '../db/migrations/001-initial';
import { QuotaRepository } from '../db/quota-repo';
import { SettingsRepository } from '../db/settings-repo';
import { AgentRegistry } from '../agents/detect';
import { ModelTierService } from '../agents/models';
import { AgentSessionRepository } from '../agents/session-repo';
import {
  calculateStatus,
  parseClaudeStatusLine,
  parseCodexUsageLog,
  parseGeminiRateLimit,
} from './parsers';
import { QuotaService } from './quota-service';

describe('Phase 5 Quota: Parsers, Repository, and Service (PLAN 6.6, ADR-018)', () => {
  let db: Database.Database;
  let tempDir: string;
  let quotaRepo: QuotaRepository;
  let settingsRepo: SettingsRepository;
  let registry: AgentRegistry;
  let quotaService: QuotaService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codefleet-quota-test-'));
    db = new Database(':memory:');
    db.exec(migration001Initial.sql);
    quotaRepo = new QuotaRepository(db);
    settingsRepo = new SettingsRepository(db);
    const modelsService = new ModelTierService({
      db,
      userDataDir: tempDir,
    });
    const sessionRepo = new AgentSessionRepository(db);
    registry = new AgentRegistry({
      modelsService,
      sessionRepo,
      customAdapters: [],
    });
    quotaService = new QuotaService(quotaRepo, settingsRepo, registry);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('calculateStatus', () => {
    it('returns unknown for empty windows', () => {
      expect(calculateStatus([])).toBe('unknown');
    });

    it('returns exhausted if any window >= 100', () => {
      const windows = [
        { label: '5 giờ', usedPercent: 60, resetsAt: null },
        { label: 'Tuần', usedPercent: 100, resetsAt: null },
      ];
      expect(calculateStatus(windows, 80)).toBe('exhausted');
    });

    it('returns low if max window >= lowThreshold (80%)', () => {
      const windows = [
        { label: '5 giờ', usedPercent: 82, resetsAt: null },
        { label: 'Tuần', usedPercent: 40, resetsAt: null },
      ];
      expect(calculateStatus(windows, 80)).toBe('low');
    });

    it('returns ok if all valid windows < lowThreshold', () => {
      const windows = [
        { label: '5 giờ', usedPercent: 55, resetsAt: null },
        { label: 'Tuần', usedPercent: 30, resetsAt: null },
      ];
      expect(calculateStatus(windows, 80)).toBe('ok');
    });
  });

  describe('parseClaudeStatusLine (Tier A)', () => {
    it('parses official statusline fixture accurately', () => {
      const fixturePath = path.resolve(
        __dirname,
        '../../../spikes/fixtures/claude/statusline-quota.json',
      );
      const rawJson = fs.readFileSync(fixturePath, 'utf8');

      const parsed = parseClaudeStatusLine(rawJson, 80);
      expect(parsed).not.toBeNull();
      expect(parsed?.agentId).toBe('claude');
      expect(parsed?.source).toBe('official');
      expect(parsed?.scope).toBe('shared');
      expect(parsed?.windows).toHaveLength(2);
      expect(parsed?.windows[0].label).toBe('Cửa sổ 5 giờ');
      expect(parsed?.windows[0].usedPercent).toBe(62);
      expect(parsed?.windows[1].label).toBe('Tuần');
      expect(parsed?.windows[1].usedPercent).toBe(38);
      expect(parsed?.status).toBe('ok');
    });

    it('handles null rate_limits without failing (before first turn)', () => {
      const raw = JSON.stringify({ rate_limits: null });
      const parsed = parseClaudeStatusLine(raw);
      expect(parsed).not.toBeNull();
      expect(parsed?.status).toBe('unknown');
      expect(parsed?.source).toBe('unknown');
    });

    it('returns unknown gracefully when json is corrupt', () => {
      const parsed = parseClaudeStatusLine('{ invalid json');
      expect(parsed).not.toBeNull();
      expect(parsed?.status).toBe('unknown');
    });
  });

  describe('parseCodexUsageLog (Tier B)', () => {
    it('estimates 5-hour and weekly tokens from session logs', () => {
      const fixturePath = path.resolve(
        __dirname,
        '../../../spikes/fixtures/codex/session-log-usage.jsonl',
      );
      const lines = fs.readFileSync(fixturePath, 'utf8').trim().split('\n');

      const parsed = parseCodexUsageLog(
        lines,
        { fiveHourTokens: 130_000, weeklyTokens: 500_000 },
        80,
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.agentId).toBe('codex');
      expect(parsed?.source).toBe('estimated');
      expect(parsed?.scope).toBe('shared');
      expect(parsed?.windows).toHaveLength(2);
      expect(parsed?.status).toBe('low'); // 114.3k / 130k = ~88% (> 80% threshold)
    });
  });

  describe('parseGeminiRateLimit (Tier C)', () => {
    it('detects 429 RESOURCE_EXHAUSTED and extracts affected model', () => {
      const fixturePath = path.resolve(
        __dirname,
        '../../../spikes/fixtures/gemini/rate-limit-429.json',
      );
      const rawJson = fs.readFileSync(fixturePath, 'utf8');

      const parsed = parseGeminiRateLimit(rawJson);
      expect(parsed).not.toBeNull();
      expect(parsed?.agentId).toBe('gemini');
      expect(parsed?.model).toBe('gemini-2.5-pro');
      expect(parsed?.scope).toBe('model');
      expect(parsed?.status).toBe('exhausted');
      expect(parsed?.source).toBe('detected');
      expect(parsed?.windows[0].usedPercent).toBe(100);
    });
  });

  describe('QuotaRepository & QuotaService', () => {
    it('persists snapshots and retrieves latest snapshot per agent/model', () => {
      quotaService.saveSnapshot({
        agentId: 'claude',
        model: null,
        scope: 'shared',
        plan: 'Claude Pro',
        windows: [{ label: '5 giờ', usedPercent: 62, resetsAt: null }],
        status: 'ok',
        source: 'official',
        capturedAt: '2026-11-02T10:00:00.000Z',
      });

      quotaService.saveSnapshot({
        agentId: 'gemini',
        model: 'gemini-2.5-pro',
        scope: 'model',
        plan: null,
        windows: [{ label: 'Hôm nay', usedPercent: 100, resetsAt: '2026-11-02T17:00:00.000Z' }],
        status: 'exhausted',
        source: 'detected',
        capturedAt: '2026-11-02T10:05:00.000Z',
      });

      const all = quotaService.getAllLatest();
      expect(all).toHaveLength(2);

      const routeInfo = quotaService.getRouteQuotaInfo();
      expect(routeInfo.exhaustedUnits.has('gemini:gemini-2.5-pro')).toBe(true);
      expect(routeInfo.exhaustedUnits.has('claude:*')).toBe(false);
    });

    it('records detected rate limit and notifies subscribers', () => {
      let notified = false;
      quotaService.subscribe(() => {
        notified = true;
      });

      quotaService.recordDetectedRateLimit('claude', null, new Error('Rate limit reached'));
      expect(notified).toBe(true);

      const routeInfo = quotaService.getRouteQuotaInfo();
      expect(routeInfo.exhaustedUnits.has('claude:*')).toBe(true);
    });
  });
});
