import { describe, expect, it } from 'vitest';
import type { QuotaSnapshot } from '@shared/ipc';
import { formatQuotaChipSummary } from './quota-format';

describe('formatQuotaChipSummary (UI_SPEC 3.2, PLAN 6.6)', () => {
  it('returns "Không rõ" (tone unknown) when agent has no snapshots or empty windows', () => {
    expect(formatQuotaChipSummary('unknown-agent', [])).toEqual({
      text: 'Không rõ',
      tone: 'unknown',
    });

    const emptySnap: QuotaSnapshot = {
      id: '1',
      agentId: 'claude',
      model: null,
      scope: 'shared',
      plan: null,
      windows: [],
      status: 'unknown',
      source: 'unknown',
      capturedAt: '2026-11-02T10:00:00Z',
    };
    expect(formatQuotaChipSummary('claude', [emptySnap])).toEqual({
      text: 'Không rõ',
      tone: 'unknown',
    });
  });

  it('formats shared official quota accurately', () => {
    const snapOk: QuotaSnapshot = {
      id: '1',
      agentId: 'claude',
      model: null,
      scope: 'shared',
      plan: 'Claude Pro',
      windows: [
        { label: '5 giờ', usedPercent: 62, resetsAt: null },
        { label: 'Tuần', usedPercent: 38, resetsAt: null },
      ],
      status: 'ok',
      source: 'official',
      capturedAt: '2026-11-02T10:00:00Z',
    };
    expect(formatQuotaChipSummary('claude', [snapOk])).toEqual({
      text: '62%',
      tone: 'ok',
    });

    const snapLow: QuotaSnapshot = {
      ...snapOk,
      windows: [{ label: '5 giờ', usedPercent: 85, resetsAt: null }],
      status: 'low',
    };
    expect(formatQuotaChipSummary('claude', [snapLow])).toEqual({
      text: '85%',
      tone: 'low',
    });

    const snapExhausted: QuotaSnapshot = {
      ...snapOk,
      windows: [{ label: '5 giờ', usedPercent: 100, resetsAt: null }],
      status: 'exhausted',
    };
    expect(formatQuotaChipSummary('claude', [snapExhausted])).toEqual({
      text: 'Đã hết',
      tone: 'exhausted',
    });
  });

  it('appends " · ước lượng" when source is estimated', () => {
    const snapEstimated: QuotaSnapshot = {
      id: '1',
      agentId: 'codex',
      model: null,
      scope: 'shared',
      plan: 'ChatGPT Plus',
      windows: [
        { label: '5 giờ', usedPercent: 81, resetsAt: null },
        { label: 'Tuần', usedPercent: 54, resetsAt: null },
      ],
      status: 'low',
      source: 'estimated',
      capturedAt: '2026-11-02T10:00:00Z',
    };
    expect(formatQuotaChipSummary('codex', [snapEstimated])).toEqual({
      text: '81% · ước lượng',
      tone: 'low',
    });
  });

  it('formats model-scope summaries (Copilot: Sonnet hết · GPT-4o 23%)', () => {
    const snapPro: QuotaSnapshot = {
      id: '1',
      agentId: 'copilot',
      model: 'claude-3.5-sonnet',
      scope: 'model',
      plan: null,
      windows: [{ label: 'Hôm nay', usedPercent: 100, resetsAt: null }],
      status: 'exhausted',
      source: 'detected',
      capturedAt: '2026-11-02T10:00:00Z',
    };
    const snapFlash: QuotaSnapshot = {
      id: '2',
      agentId: 'copilot',
      model: 'gpt-4o',
      scope: 'model',
      plan: null,
      windows: [{ label: 'Hôm nay', usedPercent: 23, resetsAt: null }],
      status: 'ok',
      source: 'estimated',
      capturedAt: '2026-11-02T10:00:00Z',
    };

    expect(formatQuotaChipSummary('copilot', [snapPro, snapFlash])).toEqual({
      text: '3.5-sonnet hết · 4o 23%',
      tone: 'low',
    });
  });

  it('returns "Đã hết" (tone exhausted) when all models in model-scope are exhausted', () => {
    const snapPro: QuotaSnapshot = {
      id: '1',
      agentId: 'copilot',
      model: 'claude-3.5-sonnet',
      scope: 'model',
      plan: null,
      windows: [{ label: 'Hôm nay', usedPercent: 100, resetsAt: null }],
      status: 'exhausted',
      source: 'detected',
      capturedAt: '2026-11-02T10:00:00Z',
    };
    const snapFlash: QuotaSnapshot = {
      ...snapPro,
      id: '2',
      model: 'gpt-4o',
    };

    expect(formatQuotaChipSummary('copilot', [snapPro, snapFlash])).toEqual({
      text: 'Đã hết',
      tone: 'exhausted',
    });
  });
});
