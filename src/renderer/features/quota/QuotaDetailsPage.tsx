import React, { useEffect, useState } from 'react';
import type { DetectResult, ModelInfo, QuotaSnapshot } from '@shared/ipc';
import { Button } from '../../components/Button';
import { Pill } from '../../components/Pill';
import { Progress } from '../../components/Progress';
import { t } from '../../i18n';
import { getBridge } from '../../lib/bridge';

export interface QuotaDetailsPageProps {
  readonly onNavigateToSettings?: () => void;
}

/**
 * MH-08: Chi tiết hạn mức các AI (UI_SPEC 5.8, PLAN 6.6, ADR-018).
 * Toàn bộ số liệu đọc thụ động 0 token LLM từ log/statusLine cục bộ.
 */
export function QuotaDetailsPage({
  onNavigateToSettings,
}: QuotaDetailsPageProps): React.JSX.Element {
  const bridge = getBridge();
  const [snapshots, setSnapshots] = useState<readonly QuotaSnapshot[]>([]);
  const [agents, setAgents] = useState<readonly DetectResult[]>([]);
  const [agentModels, setAgentModels] = useState<Record<string, readonly ModelInfo[]>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('--:--');

  useEffect(() => {
    let isMounted = true;

    async function loadData(): Promise<void> {
      try {
        const [quotaRes, agentsRes] = await Promise.all([
          bridge.quota.getAll(),
          bridge.agents.detectAll(),
        ]);

        if (!isMounted) return;

        if (quotaRes.ok) {
          setSnapshots(quotaRes.data);
          if (quotaRes.data.length > 0) {
            const firstDate = new Date(quotaRes.data[0]!.capturedAt);
            if (!isNaN(firstDate.getTime())) {
              setLastUpdatedTime(
                firstDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
              );
            }
          }
        }

        if (agentsRes.ok) {
          setAgents(agentsRes.data);
          const modelsMap: Record<string, readonly ModelInfo[]> = {};
          for (const agent of agentsRes.data) {
            const mRes = await bridge.models.list(agent.agentId);
            if (mRes.ok) {
              modelsMap[agent.agentId] = mRes.data;
            }
          }
          if (isMounted) {
            setAgentModels(modelsMap);
          }
        }
      } catch (err) {
        console.error('Lỗi nạp dữ liệu hạn mức MH-08:', err);
      }
    }

    void loadData();

    // Lắng nghe cập nhật quota từ backend main process
    const unsubscribe = bridge.quota.onUpdate((updatedSnapshots) => {
      if (!isMounted) return;
      setSnapshots(updatedSnapshots);
      const now = new Date();
      setLastUpdatedTime(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [bridge]);

  async function handleRefresh(): Promise<void> {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const res = await bridge.quota.refresh();
      if (res.ok) {
        setSnapshots(res.data);
        const now = new Date();
        setLastUpdatedTime(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
      }
    } finally {
      setIsRefreshing(false);
    }
  }

  // Danh sách các agent cần hiển thị (ưu tiên các agent đã detect hoặc có snapshot)
  const allAgentIds = Array.from(
    new Set([
      ...agents.filter((a) => a.installed).map((a) => a.agentId),
      ...snapshots.map((s) => s.agentId),
    ]),
  );

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
      {/* Tiêu đề & Nút làm mới */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-text">{t('mh08.title')}</h1>
          <p className="text-sm text-muted">{t('mh08.description')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">
            {t('mh08.updatedAt', { time: lastUpdatedTime })}
          </span>
          <Button
            type="button"
            variant="default"
            size="md"
            disabled={isRefreshing}
            onClick={() => void handleRefresh()}
          >
            {isRefreshing ? t('mh08.refreshing') : t('mh08.refresh')}
          </Button>
        </div>
      </div>

      {/* Chú giải độ tin cậy */}
      <div className="flex items-start gap-3 p-3.5 bg-surface-2/60 border border-border rounded-card text-xs text-text">
        <span
          aria-hidden="true"
          className="w-5 h-5 rounded-full bg-border flex items-center justify-center font-bold text-muted shrink-0 text-[11px]"
        >
          i
        </span>
        <div className="leading-relaxed">
          <strong className="text-text mr-1.5">{t('mh08.noticeTitle')}</strong>
          <Pill tone="ok" className="mx-1 py-0 text-[11px]">
            {t('mh08.official')}
          </Pill>{' '}
          {t('mh08.officialDesc')} ·
          <Pill tone="warn" className="mx-1 py-0 text-[11px]">
            {t('mh08.estimated')}
          </Pill>{' '}
          {t('mh08.estimatedDesc')} ·
          <Pill tone="danger" className="mx-1 py-0 text-[11px]">
            {t('mh08.detected')}
          </Pill>{' '}
          {t('mh08.detectedDesc')} ·
          <Pill tone="wait" className="mx-1 py-0 text-[11px]">
            {t('mh08.unknown')}
          </Pill>{' '}
          {t('mh08.unknownDesc')}.
        </div>
      </div>

      {/* Danh sách các thẻ CLI */}
      <div className="flex flex-col gap-5">
        {allAgentIds.map((agentId) => {
          const agentMeta = agents.find((a) => a.agentId === agentId);
          const agentSnaps = snapshots.filter((s) => s.agentId === agentId);
          const models = agentModels[agentId] ?? [];
          const primarySnap = agentSnaps[0];

          const displayName = agentMeta?.displayName ?? agentId;
          const color = agentMeta?.color ?? '#10A37F';
          const scope = primarySnap?.scope ?? 'shared';
          const source = primarySnap?.source ?? 'unknown';
          const plan = primarySnap?.plan ?? null;

          // Xác định pill nguồn
          let sourceTone: 'ok' | 'warn' | 'danger' | 'wait' = 'wait';
          let sourceLabel = t('mh08.unknown');
          if (source === 'official') {
            sourceTone = 'ok';
            sourceLabel = t('mh08.official');
          } else if (source === 'estimated') {
            sourceTone = 'warn';
            sourceLabel = t('mh08.estimated');
          } else if (source === 'detected') {
            sourceTone = 'danger';
            sourceLabel = t('mh08.detected');
          }

          // Xác định tổng trạng thái
          const isAnyExhausted = agentSnaps.some((s) => s.status === 'exhausted');
          const isAnyLow = agentSnaps.some((s) => s.status === 'low');
          let statusTone: 'ok' | 'warn' | 'danger' | 'wait' = 'ok';
          let statusLabel = t('mh08.status.ok');
          if (isAnyExhausted) {
            statusTone = 'danger';
            statusLabel = t('mh08.status.exhausted');
          } else if (isAnyLow) {
            statusTone = 'warn';
            statusLabel = t('mh08.status.low');
          } else if (source === 'unknown' || agentSnaps.length === 0) {
            statusTone = 'wait';
            statusLabel = t('mh08.status.unknown');
          }

          return (
            <section
              key={agentId}
              className="bg-surface border border-border rounded-card overflow-hidden shadow-xs"
            >
              {/* Đầu thẻ */}
              <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 border-b border-border bg-surface">
                <span
                  aria-hidden="true"
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <h2 className="text-base font-bold text-text">{displayName}</h2>

                <Pill tone={sourceTone}>{sourceLabel}</Pill>

                {scope === 'shared' ? (
                  <Pill tone="brand">{t('mh03.quota.scopeShared')}</Pill>
                ) : scope === 'model' ? (
                  <Pill tone="brand">{t('mh03.quota.scopeModel')}</Pill>
                ) : (
                  <Pill tone="wait">{t('mh03.quota.scopeUnknown')}</Pill>
                )}

                <div className="grow" />

                {plan ? (
                  <span className="text-xs text-muted mr-2">{t('mh08.planLabel', { plan })}</span>
                ) : null}

                <Pill tone={statusTone}>{statusLabel}</Pill>
              </div>

              {/* Nội dung theo scope */}
              {source === 'unknown' && agentSnaps.length === 0 ? (
                <div className="p-4 text-xs text-muted leading-relaxed">
                  {t('mh08.unknownCardText')}
                </div>
              ) : scope === 'shared' ? (
                <div>
                  {/* Các thanh cửa sổ */}
                  {primarySnap && primarySnap.windows.length > 0 ? (
                    <div className="flex flex-col gap-3 p-4 bg-surface-2/20">
                      {primarySnap.windows.map((win, wIdx) => {
                        const usedPercent = win.usedPercent ?? 0;
                        let winTone: 'ok' | 'low' | 'out' = 'ok';
                        if (usedPercent >= 100) winTone = 'out';
                        else if (usedPercent >= 80) winTone = 'low';

                        const resetsStr = win.resetsAt
                          ? new Date(win.resetsAt).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : null;

                        return (
                          <div key={wIdx} className="flex flex-col gap-1">
                            <div className="grid grid-cols-[130px_1fr_60px] items-center gap-3 text-xs">
                              <span className="font-medium text-text">{win.label}</span>
                              <Progress value={usedPercent} tone={winTone} />
                              <strong className="text-right text-text">{usedPercent}%</strong>
                            </div>
                            {resetsStr ? (
                              <div className="text-[11px] text-muted ml-[142px]">
                                Làm mới lúc {resetsStr}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {/* Bảng model */}
                  {models.length > 0 ? (
                    <div className="border-t border-border">
                      <div className="grid grid-cols-[1.5fr_100px_1.2fr_1.5fr] gap-3 px-4 py-2 bg-surface-2 text-xs font-semibold text-muted">
                        <span>{t('mh08.modelTable.model')}</span>
                        <span>{t('mh08.modelTable.tier')}</span>
                        <span>{t('mh08.modelTable.status')}</span>
                        <span>{t('mh08.modelTable.notes')}</span>
                      </div>
                      {models.map((m) => {
                        const tierLabel =
                          m.tier === 'strong'
                            ? 'Mạnh'
                            : m.tier === 'balanced'
                              ? 'Cân bằng'
                              : m.tier === 'fast'
                                ? 'Nhanh'
                                : 'Chưa xếp';
                        const tierTone = m.tier === 'strong' ? 'brand' : 'wait';

                        return (
                          <div
                            key={m.id}
                            className="grid grid-cols-[1.5fr_100px_1.2fr_1.5fr] gap-3 px-4 py-2.5 border-t border-border text-xs items-center"
                          >
                            <span className="font-medium text-text">{m.label}</span>
                            <div>
                              <Pill tone={tierTone} className="py-0 text-[11px]">
                                {tierLabel}
                              </Pill>
                            </div>
                            <div>
                              <Pill tone={statusTone} className="py-0 text-[11px]">
                                {statusLabel}
                              </Pill>
                            </div>
                            <span className="text-muted text-[11px]">
                              {t('mh08.modelTable.sharedNotice')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : scope === 'model' ? (
                /* Scope = model: mỗi model một dòng kèm thanh tiến độ riêng */
                <div className="border-t border-border">
                  <div className="grid grid-cols-[1.3fr_90px_1.8fr_1.2fr] gap-3 px-4 py-2 bg-surface-2 text-xs font-semibold text-muted">
                    <span>{t('mh08.modelTable.model')}</span>
                    <span>{t('mh08.modelTable.tier')}</span>
                    <span>{t('mh08.modelTable.usedToday')}</span>
                    <span>{t('mh08.modelTable.sourceAndReset')}</span>
                  </div>
                  {models.map((m) => {
                    const modelSnap = agentSnaps.find(
                      (s) =>
                        s.model === m.id || s.model?.includes(m.id) || m.id.includes(s.model ?? ''),
                    );
                    const maxUsed = modelSnap
                      ? Math.max(0, ...modelSnap.windows.map((w) => w.usedPercent ?? 0))
                      : 0;
                    let modelTone: 'ok' | 'low' | 'out' = 'ok';
                    if (modelSnap?.status === 'exhausted' || maxUsed >= 100) modelTone = 'out';
                    else if (modelSnap?.status === 'low' || maxUsed >= 80) modelTone = 'low';

                    const tierLabel =
                      m.tier === 'strong'
                        ? 'Mạnh'
                        : m.tier === 'balanced'
                          ? 'Cân bằng'
                          : m.tier === 'fast'
                            ? 'Nhanh'
                            : 'Chưa xếp';
                    const tierTone = m.tier === 'strong' ? 'brand' : 'wait';

                    return (
                      <div
                        key={m.id}
                        className="grid grid-cols-[1.3fr_90px_1.8fr_1.2fr] gap-3 px-4 py-2.5 border-t border-border text-xs items-center"
                      >
                        <span className="font-medium text-text">{m.label}</span>
                        <div>
                          <Pill tone={tierTone} className="py-0 text-[11px]">
                            {tierLabel}
                          </Pill>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="grow">
                            <Progress value={maxUsed} tone={modelTone} thin />
                          </div>
                          <strong className="w-10 text-right">{maxUsed}%</strong>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <Pill
                            tone={
                              modelSnap?.source === 'detected'
                                ? 'danger'
                                : modelSnap?.source === 'estimated'
                                  ? 'warn'
                                  : 'wait'
                            }
                            className="py-0 text-[10px]"
                          >
                            {modelSnap?.source === 'detected'
                              ? t('mh08.detected')
                              : modelSnap?.source === 'estimated'
                                ? t('mh08.estimated')
                                : t('mh08.unknown')}
                          </Pill>
                          <span className="text-muted">00:00</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      {/* Thẻ nguyên tắc chọn AI */}
      <div className="bg-surface border border-border rounded-card p-5 flex flex-col gap-3 text-xs">
        <h3 className="text-sm font-bold text-text">{t('mh08.rulesCard.title')}</h3>
        <ul className="flex flex-col gap-1.5 text-muted pl-4 list-disc leading-relaxed">
          <li>
            <strong className="text-text font-semibold">{t('mh08.rulesCard.rule1Label')}</strong>{' '}
            {t('mh08.rulesCard.rule1')}
          </li>
          <li>
            <strong className="text-text font-semibold">{t('mh08.rulesCard.rule2Label')}</strong>{' '}
            {t('mh08.rulesCard.rule2')}
          </li>
          <li>
            <strong className="text-text font-semibold">{t('mh08.rulesCard.rule3Label')}</strong>{' '}
            {t('mh08.rulesCard.rule3')}
          </li>
          <li className="text-primary-ink font-semibold">{t('mh08.rulesCard.rule4')}</li>
        </ul>

        {onNavigateToSettings ? (
          <div className="pt-2 border-t border-border">
            <button
              type="button"
              onClick={onNavigateToSettings}
              className="text-primary hover:underline font-medium cursor-pointer"
            >
              {t('mh08.rulesCard.linkSettings')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
