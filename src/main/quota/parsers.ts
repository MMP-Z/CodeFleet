import type { QuotaSnapshot, QuotaStatus, QuotaWindow } from '../../shared/ipc/contracts';

/**
 * Tính trạng thái hạn mức dựa trên các cửa sổ thời gian và ngưỡng lowThreshold (mặc định 80%).
 * Tuân thủ UI_SPEC 3.2.
 */
export function calculateStatus(windows: readonly QuotaWindow[], lowThreshold = 80): QuotaStatus {
  if (!windows || windows.length === 0) {
    return 'unknown';
  }

  let hasValidValue = false;
  let maxPercent = -1;

  for (const win of windows) {
    if (win.usedPercent !== null && win.usedPercent !== undefined) {
      hasValidValue = true;
      if (win.usedPercent >= 100) {
        return 'exhausted';
      }
      if (win.usedPercent > maxPercent) {
        maxPercent = win.usedPercent;
      }
    }
  }

  if (!hasValidValue) {
    return 'unknown';
  }

  if (maxPercent >= lowThreshold) {
    return 'low';
  }

  return 'ok';
}

/**
 * TẦNG A: Parser cho Claude Code statusLine JSON.
 * Đọc thụ động sau mỗi lượt chạy (ADR-018).
 */
export function parseClaudeStatusLine(
  rawJson: string,
  lowThreshold = 80,
): Omit<QuotaSnapshot, 'id'> | null {
  try {
    const data = JSON.parse(rawJson);
    if (!data || typeof data !== 'object') return null;

    const rateLimits = data.rate_limits;
    if (!rateLimits || typeof rateLimits !== 'object') {
      // Khi mới cài hoặc chưa chạy lượt nào, rate_limits có thể là null
      return {
        agentId: 'claude',
        model: null,
        scope: 'shared',
        plan: null,
        windows: [],
        status: 'unknown',
        source: 'unknown',
        capturedAt: new Date().toISOString(),
      };
    }

    const windows: QuotaWindow[] = [];

    if (rateLimits.five_hour && typeof rateLimits.five_hour.used_percentage === 'number') {
      const resetEpoch = rateLimits.five_hour.resets_at;
      const resetsAt =
        typeof resetEpoch === 'number'
          ? new Date(resetEpoch > 1e11 ? resetEpoch : resetEpoch * 1000).toISOString()
          : null;

      windows.push({
        label: 'Cửa sổ 5 giờ',
        usedPercent: Math.round(rateLimits.five_hour.used_percentage),
        resetsAt,
      });
    }

    if (rateLimits.seven_day && typeof rateLimits.seven_day.used_percentage === 'number') {
      const resetEpoch = rateLimits.seven_day.resets_at;
      const resetsAt =
        typeof resetEpoch === 'number'
          ? new Date(resetEpoch > 1e11 ? resetEpoch : resetEpoch * 1000).toISOString()
          : null;

      windows.push({
        label: 'Tuần',
        usedPercent: Math.round(rateLimits.seven_day.used_percentage),
        resetsAt,
      });
    }

    const status = calculateStatus(windows, lowThreshold);

    return {
      agentId: 'claude',
      model: null, // Claude hạn mức dùng chung cho mọi model
      scope: 'shared',
      plan: data.plan_type ?? null,
      windows,
      status,
      source: 'official',
      capturedAt: new Date().toISOString(),
    };
  } catch {
    // Parser lỗi hạ về unknown kèm log, không sập app (Luật PLAN 6.6)
    return {
      agentId: 'claude',
      model: null,
      scope: 'shared',
      plan: null,
      windows: [],
      status: 'unknown',
      source: 'unknown',
      capturedAt: new Date().toISOString(),
    };
  }
}

/**
 * TẦNG B: Parser ước lượng cho Codex CLI từ nhật ký session trên đĩa.
 * Đọc thụ động từ các file jsonl log trong ~/.codex/sessions hoặc turn usage (ADR-018).
 */
export function parseCodexUsageLog(
  lines: readonly string[],
  configLimits = { fiveHourTokens: 500_000, weeklyTokens: 2_000_000 },
  lowThreshold = 80,
): Omit<QuotaSnapshot, 'id'> | null {
  try {
    let fiveHourUsed = 0;
    let weeklyUsed = 0;
    const now = Date.now();
    const fiveHoursAgo = now - 5 * 3600 * 1000;
    const oneWeekAgo = now - 7 * 24 * 3600 * 1000;

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const item = JSON.parse(line);
        const itemTime = item.timestamp ? new Date(item.timestamp).getTime() : now;
        const totalTokens = (item.usage?.input_tokens ?? 0) + (item.usage?.output_tokens ?? 0);

        if (itemTime >= fiveHoursAgo) {
          fiveHourUsed += totalTokens;
        }
        if (itemTime >= oneWeekAgo) {
          weeklyUsed += totalTokens;
        }
      } catch {
        // bỏ qua dòng log hỏng
      }
    }

    const fiveHourPercent = Math.min(
      100,
      Math.round((fiveHourUsed / configLimits.fiveHourTokens) * 100),
    );
    const weeklyPercent = Math.min(100, Math.round((weeklyUsed / configLimits.weeklyTokens) * 100));

    // Reset lúc đầu tuần (Thứ Hai 00:00) và 5 giờ tính từ lượt cũ nhất
    const nextMonday = new Date();
    nextMonday.setDate(nextMonday.getDate() + ((1 + 7 - nextMonday.getDay()) % 7 || 7));
    nextMonday.setHours(0, 0, 0, 0);

    const fiveHourReset = new Date(now + 2 * 3600 * 1000).toISOString();

    const windows: QuotaWindow[] = [
      {
        label: 'Cửa sổ 5 giờ',
        usedPercent: fiveHourPercent,
        resetsAt: fiveHourReset,
      },
      {
        label: 'Tuần',
        usedPercent: weeklyPercent,
        resetsAt: nextMonday.toISOString(),
      },
    ];

    const status = calculateStatus(windows, lowThreshold);

    return {
      agentId: 'codex',
      model: null,
      scope: 'shared',
      plan: 'ChatGPT Plus/Pro',
      windows,
      status,
      source: 'estimated',
      capturedAt: new Date().toISOString(),
    };
  } catch {
    return {
      agentId: 'codex',
      model: null,
      scope: 'shared',
      plan: null,
      windows: [],
      status: 'unknown',
      source: 'unknown',
      capturedAt: new Date().toISOString(),
    };
  }
}

/**
 * TẦNG C: Parser phát hiện lỗi rate limit 429 cho Copilot CLI hoặc các CLI khác.
 */
export function parseCopilotRateLimit(rawInput: string | object): Omit<QuotaSnapshot, 'id'> | null {
  try {
    const data = typeof rawInput === 'string' ? JSON.parse(rawInput) : rawInput;
    const msg: string = data.error?.message ?? data.message ?? '';
    const statusStr: string = data.error?.data?.status ?? data.status ?? '';

    const isExhausted =
      statusStr === 'RESOURCE_EXHAUSTED' ||
      msg.includes('429') ||
      msg.includes('RESOURCE_EXHAUSTED') ||
      msg.includes('Quota exceeded') ||
      msg.toLowerCase().includes('rate limit');

    if (!isExhausted) return null;

    // Trích xuất model nếu có
    const model =
      data.error?.data?.model ?? msg.match(/model '([^']+)'/)?.[1] ?? 'claude-3.5-sonnet';

    // Giờ reset mặc định: nửa đêm 00:00 ngày hôm sau
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);

    return {
      agentId: 'copilot',
      model,
      scope: 'model',
      plan: 'GitHub Copilot',
      windows: [
        {
          label: 'Hôm nay',
          usedPercent: 100,
          resetsAt: midnight.toISOString(),
        },
      ],
      status: 'exhausted',
      source: 'detected',
      capturedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Tương thích ngược với các test / code cũ */
export const parseGeminiRateLimit = parseCopilotRateLimit;
