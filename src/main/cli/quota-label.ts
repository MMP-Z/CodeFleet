import type { QuotaSnapshot } from '../agents/types';

export function quotaLabel(
  agentId: string,
  model: string | undefined,
  snapshots: QuotaSnapshot[],
): string {
  const snapshot =
    (model ? snapshots.find((item) => item.model === model) : undefined) ??
    snapshots.find((item) => item.model === null);
  const remaining = (pattern: RegExp): string | null => {
    const window = snapshot?.windows.find((item) => pattern.test(item.label));
    if (!window) return null;
    if (window.usedPercent === null || !Number.isFinite(window.usedPercent)) return '—';
    if (window.resetsAt && Date.parse(window.resetsAt) <= Date.now()) return '—';
    const percent = Math.round(100 - Math.max(0, Math.min(100, window.usedPercent)));
    return (snapshot?.source === 'estimated' ? '≈' : '') + percent + '%';
  };
  // Copilot tính theo lượt premium hằng tháng thay vì cửa sổ 5 giờ / tuần.
  const month = remaining(/^(tháng|month)/i);
  if (month !== null) {
    const count = snapshot?.windows
      .find((item) => /^(tháng|month)/i.test(item.label))
      ?.label.match(/\((\d+)\/(\d+)\)/);
    return (
      'Còn tháng ' +
      month +
      (count ? ` (${Math.max(0, Number(count[2]) - Number(count[1]))}/${count[2]} lượt)` : '')
    );
  }
  const short = remaining(/^(5\s*(h|giờ)|five hour)/i) ?? '—';
  const week = remaining(/^(tuần|7\s*(d|ngày)|week)/i) ?? '—';
  const minimum = agentId === 'agy' && snapshot?.source === 'official' && snapshot.model === null;
  return 'Còn 5h ' + short + ' · Tuần ' + week + (minimum ? ' (thấp nhất)' : '');
}
