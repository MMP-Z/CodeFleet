import React, { useCallback, useEffect, useState } from 'react';
import type { DetectResult, EditableModelTier, ModelInfo } from '@shared/agents';
import { DEFAULT_SETTINGS, type AppSettingsMap, type CodeLevel } from '@shared/settings';
import { Button } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { Pill } from '../../components/Pill';
import { Segmented } from '../../components/Segmented';
import { useToast } from '../../components/Toast';
import { Toggle } from '../../components/Toggle';
import { t } from '../../i18n';
import { getBridge } from '../../lib/bridge';

export type SettingsTab = 'ai' | 'general' | 'data';

/**
 * MH-11 · Cài đặt (hỗ trợ mục "AI và model", "Chung" và "Dữ liệu").
 * Khớp đặc tả Document/UI_Mockups/11-cai-dat.html và UI_SPEC.md.
 */
export function SettingsPage(): React.JSX.Element {
  const bridge = getBridge();
  const { pushToast } = useToast();

  const [activeTab, setActiveTab] = useState<SettingsTab>('ai');
  const [settings, setSettings] = useState<AppSettingsMap>(DEFAULT_SETTINGS);
  const [userDataDir, setUserDataDir] = useState<string>('');
  const [agents, setAgents] = useState<DetectResult[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [detectingAgents, setDetectingAgents] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState<boolean>(false);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [settingsRes, dataInfoRes, agentsRes, modelsRes] = await Promise.all([
      bridge.settings.getAll(),
      bridge.system.getDataInfo(),
      bridge.agents.detectAll(),
      bridge.models.list(),
    ]);

    if (!settingsRes.ok) {
      setLoadError(settingsRes.error.message);
      setLoading(false);
      return;
    }

    setSettings(settingsRes.data);
    if (dataInfoRes.ok) {
      setUserDataDir(dataInfoRes.data.userDataDir);
    }
    if (agentsRes.ok) {
      setAgents(agentsRes.data);
    }
    if (modelsRes.ok) {
      setModels(modelsRes.data);
    }
    setLoading(false);
  }, [bridge]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const handleRecheckAgents = async () => {
    setDetectingAgents(true);
    try {
      const [agentsRes, modelsRes] = await Promise.all([
        bridge.agents.detectAll(),
        bridge.models.list(),
      ]);
      if (agentsRes.ok) {
        setAgents(agentsRes.data);
      }
      if (modelsRes.ok) {
        setModels(modelsRes.data);
      }
    } finally {
      setDetectingAgents(false);
    }
  };

  const handleToggleAgent = async (agentId: string, enabled: boolean) => {
    const currentMap = settings['agents.enabled'] ?? {};
    const updatedMap = { ...currentMap, [agentId]: enabled };
    setSettings((cur) => ({ ...cur, 'agents.enabled': updatedMap }));
    const res = await bridge.settings.set({ key: 'agents.enabled', value: updatedMap });
    if (res.ok) {
      setSettings(res.data);
    }
  };

  const handleChangeModelTier = async (
    agentId: string,
    modelId: string,
    tier: EditableModelTier,
  ) => {
    const res = await bridge.models.setTier(agentId, modelId, tier);
    if (res.ok) {
      setModels((prev) =>
        prev.map((m) => (m.agentId === agentId && m.id === modelId ? res.data : m)),
      );
    }
  };

  const handleUpdateCodeLevel = async (value: CodeLevel): Promise<void> => {
    const previous = settings;
    setSettings((cur) => ({ ...cur, 'ui.codeLevel': value }));
    const res = await bridge.settings.set({ key: 'ui.codeLevel', value });
    if (res.ok) {
      setSettings(res.data);
    } else {
      setSettings(previous);
      pushToast({
        tone: 'danger',
        title: t('mh11.errors.saveFailed', { message: res.error.message }),
      });
    }
  };

  const handleUpdateBoolean = async (
    key: 'ui.showJargon' | 'ui.autoPreview',
    value: boolean,
  ): Promise<void> => {
    const previous = settings;
    setSettings((cur) => ({ ...cur, [key]: value }));
    const res = await bridge.settings.set({ key, value });
    if (res.ok) {
      setSettings(res.data);
    } else {
      setSettings(previous);
      pushToast({
        tone: 'danger',
        title: t('mh11.errors.saveFailed', { message: res.error.message }),
      });
    }
  };

  const handleOpenDataDir = async (): Promise<void> => {
    const res = await bridge.system.openDataDir();
    if (!res.ok || !res.data.opened) {
      const errDetail = !res.ok ? res.error.message : (res.data.error ?? '');
      pushToast({
        tone: 'danger',
        title: t('mh11.data.openFolderErrorTitle'),
        body: errDetail,
      });
    }
  };

  const handleBackupNow = async (): Promise<void> => {
    setBackingUp(true);
    const res = await bridge.system.backupNow();
    setBackingUp(false);

    if (res.ok) {
      pushToast({
        tone: 'ok',
        title: t('mh11.data.backupSuccessTitle'),
        body: t('mh11.data.backupSuccessBody', { path: res.data.backupPath }),
      });
    } else {
      pushToast({
        tone: 'danger',
        title: t('mh11.data.backupErrorTitle'),
        body: res.error.message,
      });
    }
  };

  const navItems: { id: SettingsTab; label: string }[] = [
    { id: 'ai', label: t('mh11.tabs.ai') },
    { id: 'general', label: t('mh11.tabs.general') },
    { id: 'data', label: t('mh11.tabs.data') },
  ];

  const codeLevelOptions: { value: CodeLevel; label: string }[] = [
    { value: 'summary', label: t('mh11.general.codeLevelSummary') },
    { value: 'diff', label: t('mh11.general.codeLevelDiff') },
    { value: 'full', label: t('mh11.general.codeLevelFull') },
  ];

  return (
    <div className="w-full max-w-[1120px] mx-auto px-6 pt-7 pb-12 flex flex-col gap-5 font-sans text-cf-text">
      <h1 className="text-2xl font-bold">{t('mh11.title')}</h1>

      {loadError ? (
        <Notice
          tone="danger"
          actions={[
            {
              label: t('common.retry'),
              onClick: () => {
                void loadInitialData();
              },
            },
          ]}
        >
          {t('mh11.errors.loadFailed')}
        </Notice>
      ) : null}

      <div className="flex gap-6 items-start flex-wrap">
        <nav
          aria-label={t('mh11.navAria')}
          className="basis-[220px] shrink-0 flex flex-col gap-0.5 sticky top-4"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'true' : undefined}
                onClick={() => setActiveTab(item.id)}
                className={`text-left px-3 py-[9px] border-0 rounded-cf text-sm transition-all ${
                  isActive
                    ? 'bg-cf-surface text-cf-primary font-semibold shadow-sm'
                    : 'bg-transparent text-cf-text hover:bg-cf-surface/60'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 basis-[480px] min-w-0 flex flex-col gap-4">
          {loading ? (
            <div className="bg-cf-surface border border-cf-line rounded-cf-card px-4 py-3.5 text-cf-muted text-sm">
              {t('common.loading')}
            </div>
          ) : null}

          {/* TAB 1: AI VÀ MODEL */}
          {!loading && activeTab === 'ai' ? (
            <section className="flex flex-col gap-4">
              <div className="bg-cf-surface border border-cf-line rounded-cf-card shadow-cf-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-cf-line">
                  <span className="text-xs uppercase tracking-wider text-cf-muted font-bold font-mono">
                    {t('mh11.ai.cardTitle')}
                  </span>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => void handleRecheckAgents()}
                    disabled={detectingAgents}
                  >
                    {detectingAgents ? t('common.loading') : t('mh11.ai.recheck')}
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-cf-line text-xs text-cf-muted bg-cf-bg/50">
                        <th className="py-2.5 px-4 font-semibold">{t('mh11.ai.colAgent')}</th>
                        <th className="py-2.5 px-4 font-semibold">{t('mh11.ai.colVersion')}</th>
                        <th className="py-2.5 px-4 font-semibold">{t('mh11.ai.colStatus')}</th>
                        <th className="py-2.5 px-4 font-semibold">{t('mh11.ai.colModels')}</th>
                        <th className="py-2.5 px-4 font-semibold w-[110px] text-center">
                          {t('mh11.ai.colUse')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cf-line">
                      {agents.map((agent) => {
                        const pillTone =
                          agent.status === 'ready'
                            ? 'ok'
                            : agent.status === 'not_logged_in'
                              ? 'warn'
                              : agent.status === 'error'
                                ? 'danger'
                                : 'wait';

                        const pillLabel =
                          agent.status === 'ready'
                            ? t('mh01.status.ready')
                            : agent.status === 'not_logged_in'
                              ? t('mh01.status.notLoggedIn')
                              : agent.status === 'error'
                                ? t('mh01.status.error')
                                : t('mh01.status.notInstalled');

                        const isEnabled = settings['agents.enabled']?.[agent.agentId] !== false;

                        return (
                          <tr key={agent.agentId} className="hover:bg-cf-bg/30">
                            <td className="py-3 px-4 flex items-center gap-2">
                              <span
                                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: agent.color }}
                              />
                              <strong className="font-semibold text-cf-text">
                                {agent.displayName}
                              </strong>
                            </td>
                            <td className="py-3 px-4 font-mono text-xs text-cf-muted">
                              {agent.version ?? '—'}
                            </td>
                            <td className="py-3 px-4">
                              <Pill tone={pillTone}>{pillLabel}</Pill>
                            </td>
                            <td className="py-3 px-4 text-cf-muted">{agent.modelsCount}</td>
                            <td className="py-3 px-4 text-center">
                              <Toggle
                                checked={isEnabled}
                                onChange={(checked) =>
                                  void handleToggleAgent(agent.agentId, checked)
                                }
                                ariaLabel={t('mh11.ai.toggleUseAria', { name: agent.displayName })}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Accordion Nâng cao: Bậc model */}
              <details className="bg-cf-surface border border-cf-line rounded-cf-card shadow-cf-card overflow-hidden group">
                <summary className="p-4 cursor-pointer font-semibold flex items-center justify-between hover:bg-cf-bg/30 select-none">
                  <div>
                    <strong>{t('mh11.ai.advancedTitle')}</strong>{' '}
                    <span className="text-xs text-cf-muted font-normal">
                      {t('mh11.ai.advancedHint')}
                    </span>
                  </div>
                </summary>
                <div className="px-4 pb-4 pt-1 flex flex-col gap-3 border-t border-cf-line">
                  <p className="text-xs text-cf-muted leading-relaxed">
                    {t('mh11.ai.advancedDesc')}
                  </p>

                  <div className="border border-cf-line rounded-cf overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-cf-line bg-cf-bg/60 text-cf-muted font-semibold">
                          <th className="py-2 px-3">{t('mh11.ai.colAgent')}</th>
                          <th className="py-2 px-3">{t('mh11.ai.colModelId')}</th>
                          <th className="py-2 px-3">{t('mh11.ai.colTier')}</th>
                          <th className="py-2 px-3">{t('mh11.ai.colTierSource')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cf-line">
                        {models.map((m) => (
                          <tr key={`${m.agentId}-${m.id}`}>
                            <td className="py-2 px-3 font-medium">{m.agentDisplayName}</td>
                            <td className="py-2 px-3 font-mono text-cf-muted">{m.id}</td>
                            <td className="py-2 px-3">
                              <select
                                value={m.tier}
                                onChange={(e) =>
                                  void handleChangeModelTier(
                                    m.agentId,
                                    m.id,
                                    e.target.value as EditableModelTier,
                                  )
                                }
                                className="px-2 py-1 text-xs border border-cf-border rounded bg-cf-surface text-cf-text"
                              >
                                <option value="strong">{t('mh11.ai.tierStrong')}</option>
                                <option value="balanced">{t('mh11.ai.tierBalanced')}</option>
                                <option value="fast">{t('mh11.ai.tierFast')}</option>
                                {m.tier === 'unknown' ? (
                                  <option value="unknown" disabled>
                                    {t('mh11.ai.tierUnknown')}
                                  </option>
                                ) : null}
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              {m.tierSource === 'unmapped' ? (
                                <Pill tone="warn">{t('mh11.ai.unmappedWarning')}</Pill>
                              ) : (
                                <span className="text-cf-muted">
                                  {m.tierSource === 'user'
                                    ? t('mh11.ai.sourceUser')
                                    : t('mh11.ai.sourceDefault')}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            </section>
          ) : null}

          {/* TAB 2: CHUNG */}
          {!loading && activeTab === 'general' ? (
            <section className="flex flex-col gap-3">
              <div className="bg-cf-surface border border-cf-line rounded-cf-card shadow-cf-card">
                {/* Ngôn ngữ */}
                <div className="flex gap-4 items-center justify-between px-4 py-3.5 flex-wrap">
                  <div className="flex-1 basis-[300px] min-w-0">
                    <strong className="text-sm font-semibold">
                      {t('mh11.general.localeLabel')}
                    </strong>
                  </div>
                  <select
                    aria-label={t('mh11.general.localeAria')}
                    value={settings['ui.locale']}
                    onChange={() => {
                      // MVP chỉ hỗ trợ tiếng Việt (UI_SPEC MH-11)
                    }}
                    className="px-3.5 py-1.5 border border-cf-border rounded-cf bg-cf-bg text-cf-text text-sm w-auto"
                  >
                    <option value="vi">{t('mh11.general.localeVi')}</option>
                    <option value="en" disabled>
                      {t('mh11.general.localeEnSoon')}
                    </option>
                  </select>
                </div>

                {/* Mức xem code mặc định */}
                <div className="flex gap-4 items-center justify-between px-4 py-3.5 border-t border-cf-line flex-wrap">
                  <div className="flex-1 basis-[300px] min-w-0">
                    <strong className="text-sm font-semibold">
                      {t('mh11.general.codeLevelLabel')}
                    </strong>
                    <div className="text-xs text-cf-muted mt-0.5">
                      {t('mh11.general.codeLevelHint')}
                    </div>
                  </div>
                  <div className="w-[300px]">
                    <Segmented<CodeLevel>
                      value={settings['ui.codeLevel']}
                      onChange={(val) => {
                        void handleUpdateCodeLevel(val);
                      }}
                      options={codeLevelOptions}
                    />
                  </div>
                </div>

                {/* Hiện thuật ngữ kỹ thuật */}
                <div className="flex gap-4 items-center justify-between px-4 py-3.5 border-t border-cf-line flex-wrap">
                  <div className="flex-1 basis-[300px] min-w-0">
                    <strong className="text-sm font-semibold">
                      {t('mh11.general.showJargonLabel')}
                    </strong>
                    <div className="text-xs text-cf-muted mt-0.5">
                      {t('mh11.general.showJargonHint')}
                    </div>
                  </div>
                  <Toggle
                    checked={settings['ui.showJargon']}
                    onChange={(checked) => {
                      void handleUpdateBoolean('ui.showJargon', checked);
                    }}
                    ariaLabel={t('mh11.general.showJargonLabel')}
                  />
                </div>

                {/* Tự mở Xem trước */}
                <div className="flex gap-4 items-center justify-between px-4 py-3.5 border-t border-cf-line flex-wrap">
                  <div className="flex-1 basis-[300px] min-w-0">
                    <strong className="text-sm font-semibold">
                      {t('mh11.general.autoPreviewLabel')}
                    </strong>
                  </div>
                  <Toggle
                    checked={settings['ui.autoPreview']}
                    onChange={(checked) => {
                      void handleUpdateBoolean('ui.autoPreview', checked);
                    }}
                    ariaLabel={t('mh11.general.autoPreviewLabel')}
                  />
                </div>
              </div>
            </section>
          ) : null}

          {/* TAB 3: DỮ LIỆU */}
          {!loading && activeTab === 'data' ? (
            <section className="flex flex-col gap-3">
              <div className="bg-cf-surface border border-cf-line rounded-cf-card shadow-cf-card">
                {/* Thư mục dữ liệu */}
                <div className="flex gap-4 items-center justify-between px-4 py-3.5 flex-wrap">
                  <div className="flex-1 basis-[300px] min-w-0">
                    <strong className="text-sm font-semibold">
                      {t('mh11.data.userDataLabel')}
                    </strong>
                    <div className="text-xs text-cf-muted font-mono mt-0.5 break-all select-all">
                      {userDataDir || '—'}
                    </div>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      void handleOpenDataDir();
                    }}
                  >
                    {t('mh11.data.openFolder')}
                  </Button>
                </div>

                {/* Sao lưu */}
                <div className="flex gap-4 items-center justify-between px-4 py-3.5 border-t border-cf-line flex-wrap">
                  <div className="flex-1 basis-[300px] min-w-0">
                    <strong className="text-sm font-semibold">{t('mh11.data.backupLabel')}</strong>
                    <div className="text-xs text-cf-muted mt-0.5 leading-relaxed">
                      {t('mh11.data.backupHint')}
                    </div>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    disabled={backingUp}
                    onClick={() => {
                      void handleBackupNow();
                    }}
                  >
                    {backingUp ? t('mh11.data.backupRunning') : t('mh11.data.backupNow')}
                  </Button>
                </div>

                {/* Số liệu ẩn danh */}
                {bridge.featureFlags.telemetrySetting ? (
                  <div className="flex gap-4 items-center justify-between px-4 py-3.5 border-t border-cf-line flex-wrap">
                    <div className="flex-1 basis-[300px] min-w-0">
                      <strong className="text-sm font-semibold">
                        {t('mh11.data.telemetryLabel')}
                      </strong>
                      <div className="text-xs text-cf-muted mt-0.5">
                        {t('mh11.data.telemetryHint')}
                      </div>
                    </div>
                    <Toggle
                      checked={false}
                      onChange={() => {}}
                      ariaLabel={t('mh11.data.telemetryLabel')}
                    />
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
