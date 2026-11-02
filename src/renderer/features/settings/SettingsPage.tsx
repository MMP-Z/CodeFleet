import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, type AppSettingsMap, type CodeLevel } from '@shared/settings';
import { Button } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { Segmented } from '../../components/Segmented';
import { useToast } from '../../components/Toast';
import { Toggle } from '../../components/Toggle';
import { t } from '../../i18n';
import { getBridge } from '../../lib/bridge';

type Phase1SettingsTab = 'general' | 'data';

/**
 * MH-11 · Cài đặt (khung Phase 1: mục Chung và Dữ liệu theo UI_SPEC mục 5 & mục 9).
 * Đối chiếu trực quan với Document/UI_Mockups/11-cai-dat.html.
 */
export function SettingsPage(): React.JSX.Element {
  const bridge = getBridge();
  const { pushToast } = useToast();

  const [activeTab, setActiveTab] = useState<Phase1SettingsTab>('general');
  const [settings, setSettings] = useState<AppSettingsMap>(DEFAULT_SETTINGS);
  const [userDataDir, setUserDataDir] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState<boolean>(false);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [settingsRes, dataInfoRes] = await Promise.all([
      bridge.settings.getAll(),
      bridge.system.getDataInfo(),
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
    setLoading(false);
  }, [bridge]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

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

  const navItems: { id: Phase1SettingsTab; label: string }[] = [
    { id: 'general', label: t('mh11.tabs.general') },
    { id: 'data', label: t('mh11.tabs.data') },
  ];

  const codeLevelOptions: { value: CodeLevel; label: string }[] = [
    { value: 'summary', label: t('mh11.general.codeLevelSummary') },
    { value: 'diff', label: t('mh11.general.codeLevelDiff') },
    { value: 'full', label: t('mh11.general.codeLevelFull') },
  ];

  return (
    <div className="w-full max-w-[1120px] mx-auto px-6 pt-7 pb-12 flex flex-col gap-5">
      <h1>{t('mh11.title')}</h1>

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
                className={`text-left px-3 py-[9px] border-0 rounded-btn text-base transition-all ${
                  isActive
                    ? 'bg-surface text-primary font-semibold shadow-tab'
                    : 'bg-transparent text-text hover:bg-surface/60'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 basis-[480px] min-w-0 flex flex-col gap-4">
          {loading ? (
            <div className="bg-surface border border-border rounded-card px-4 py-3.5 text-muted">
              {t('common.loading')}
            </div>
          ) : null}

          {!loading && activeTab === 'general' ? (
            <section className="flex flex-col gap-3">
              <div className="bg-surface border border-border rounded-card">
                {/* Ngôn ngữ */}
                <div className="flex gap-4 items-center justify-between px-4 py-3.5 flex-wrap">
                  <div className="flex-1 basis-[300px] min-w-0">
                    <strong>{t('mh11.general.localeLabel')}</strong>
                  </div>
                  <select
                    aria-label={t('mh11.general.localeAria')}
                    value={settings['ui.locale']}
                    onChange={() => {
                      // MVP chỉ hỗ trợ tiếng Việt (UI_SPEC MH-11)
                    }}
                    className="px-3.5 py-2 border border-border rounded-input bg-surface-2 text-text text-base w-auto"
                  >
                    <option value="vi">{t('mh11.general.localeVi')}</option>
                    <option value="en" disabled>
                      {t('mh11.general.localeEnSoon')}
                    </option>
                  </select>
                </div>

                {/* Mức xem code mặc định */}
                <div className="flex gap-4 items-center justify-between px-4 py-3.5 border-t border-line flex-wrap">
                  <div className="flex-1 basis-[300px] min-w-0">
                    <strong>{t('mh11.general.codeLevelLabel')}</strong>
                    <div className="text-small text-muted">{t('mh11.general.codeLevelHint')}</div>
                  </div>
                  <Segmented
                    ariaLabel={t('mh11.general.codeLevelLabel')}
                    options={codeLevelOptions}
                    value={settings['ui.codeLevel']}
                    onChange={(next) => {
                      void handleUpdateCodeLevel(next);
                    }}
                    className="w-[300px] max-w-full"
                  />
                </div>

                {/* Hiện thuật ngữ kỹ thuật */}
                <div className="flex gap-4 items-center justify-between px-4 py-3.5 border-t border-line flex-wrap">
                  <div className="flex-1 basis-[300px] min-w-0">
                    <strong>{t('mh11.general.showJargonLabel')}</strong>
                    <div className="text-small text-muted">{t('mh11.general.showJargonHint')}</div>
                  </div>
                  <Toggle
                    checked={settings['ui.showJargon']}
                    ariaLabel={t('mh11.general.showJargonLabel')}
                    onChange={(next) => {
                      void handleUpdateBoolean('ui.showJargon', next);
                    }}
                  />
                </div>

                {/* Tự mở Xem trước */}
                <div className="flex gap-4 items-center justify-between px-4 py-3.5 border-t border-line flex-wrap">
                  <div className="flex-1 basis-[300px] min-w-0">
                    <strong>{t('mh11.general.autoPreviewLabel')}</strong>
                  </div>
                  <Toggle
                    checked={settings['ui.autoPreview']}
                    ariaLabel={t('mh11.general.autoPreviewLabel')}
                    onChange={(next) => {
                      void handleUpdateBoolean('ui.autoPreview', next);
                    }}
                  />
                </div>
              </div>
            </section>
          ) : null}

          {!loading && activeTab === 'data' ? (
            <section className="flex flex-col gap-3">
              <div className="bg-surface border border-border rounded-card">
                {/* Vị trí userData */}
                <div className="flex gap-4 items-center justify-between px-4 py-3.5 flex-wrap">
                  <div className="flex-1 basis-[300px] min-w-0">
                    <strong>{t('mh11.data.userDataLabel')}</strong>
                    <div className="text-small text-muted font-mono break-all">{userDataDir}</div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      void handleOpenDataDir();
                    }}
                  >
                    {t('mh11.data.openFolder')}
                  </Button>
                </div>

                {/* Sao lưu ngay */}
                <div className="flex gap-4 items-center justify-between px-4 py-3.5 border-t border-line flex-wrap">
                  <div className="flex-1 basis-[300px] min-w-0">
                    <strong>{t('mh11.data.backupLabel')}</strong>
                    <div className="text-small text-muted">{t('mh11.data.backupHint')}</div>
                  </div>
                  <Button
                    size="sm"
                    disabled={backingUp}
                    onClick={() => {
                      void handleBackupNow();
                    }}
                  >
                    {backingUp ? t('mh11.data.backupRunning') : t('mh11.data.backupNow')}
                  </Button>
                </div>

                {/* Số liệu ẩn danh — ẩn sau feature flag vì [CHƯA CHỐT] (Luật P6) */}
                {bridge.featureFlags.telemetrySetting ? (
                  <div className="flex gap-4 items-center justify-between px-4 py-3.5 border-t border-line flex-wrap">
                    <div className="flex-1 basis-[300px] min-w-0">
                      <strong>{t('mh11.data.telemetryLabel')}</strong>
                      <div className="text-small text-muted">{t('mh11.data.telemetryHint')}</div>
                    </div>
                    <Toggle
                      checked={false}
                      ariaLabel={t('mh11.data.telemetryLabel')}
                      onChange={() => undefined}
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
