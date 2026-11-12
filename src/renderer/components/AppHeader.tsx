import { APP_NAME } from '@shared/constants';
import type { FeatureFlags } from '@shared/feature-flags';
import type { DetectResult, QuotaSnapshot } from '@shared/ipc';
import { t } from '../i18n';
import { ProjectPill } from './ProjectPill';
import { QuotaBar } from './QuotaBar';

export type NavRoute = 'chat' | 'history' | 'quota' | 'plugins' | 'settings' | 'dev-components';

export interface HeaderProjectSummary {
  readonly name: string;
  readonly path: string;
}

export interface AppHeaderProps {
  readonly activeNav: NavRoute;
  readonly onNavigate: (route: NavRoute) => void;
  readonly project?: HeaderProjectSummary;
  readonly onProjectClick?: () => void;
  readonly featureFlags: FeatureFlags;
  readonly quotaSnapshots?: readonly QuotaSnapshot[];
  readonly detectedAgents?: readonly DetectResult[];
  readonly showQuota?: boolean;
  readonly onOpenSettings?: () => void;
  readonly isSettingsOpen?: boolean;
  readonly currentTheme?: 'zed-dark' | 'sage';
  readonly onToggleTheme?: () => void;
}

/**
 * Thanh đầu ứng dụng bản Phase 1 theo UI_SPEC mục 4 & Prompt 1:
 * Logo + hằng số APP_NAME + điều hướng + QuotaBar + Icon Cài đặt (mở hộp thoại).
 */
export function AppHeader({
  activeNav,
  onNavigate,
  project,
  onProjectClick,
  featureFlags,
  quotaSnapshots,
  detectedAgents,
  showQuota = true,
  onOpenSettings,
  isSettingsOpen = false,
  currentTheme = 'zed-dark',
  onToggleTheme,
}: AppHeaderProps): React.JSX.Element {
  const navItems: { route: NavRoute; label: string; visible: boolean }[] = [
    {
      route: 'chat',
      label: t('app.header.chat'),
      visible: featureFlags.phase3Workspace,
    },
    {
      route: 'history',
      label: t('app.header.history'),
      visible: featureFlags.phase3Workspace,
    },
    {
      route: 'quota',
      label: t('app.header.quota'),
      visible: true,
    },
    {
      route: 'plugins',
      label: t('app.header.plugins'),
      visible: featureFlags.phase6Plugins,
    },
    {
      route: 'dev-components',
      label: t('app.header.devComponents'),
      visible: featureFlags.devComponents,
    },
  ];

  return (
    <header className="relative z-10 flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2 bg-surface border-b border-border font-mono">
      <div className="flex items-center gap-2">
        <div
          aria-hidden="true"
          className="h-6 px-1.5 rounded-btn bg-primary-soft border border-primary/50 text-primary-ink flex items-center justify-center text-[11px] font-bold tracking-tight select-none"
        >
          &gt;_
        </div>
        <strong className="text-[13px] font-bold tracking-tight text-text">{APP_NAME}</strong>
        <span aria-hidden="true" className="text-[11px] text-muted hidden sm:inline">
          ::cmd
        </span>
      </div>

      {project ? (
        <ProjectPill name={project.name} path={project.path} onClick={onProjectClick} />
      ) : null}

      <nav aria-label={t('app.header.navAria')} className="flex flex-wrap gap-1">
        {navItems
          .filter((item) => item.visible)
          .map((item) => {
            const isCurrent = activeNav === item.route;
            return (
              <button
                key={item.route}
                type="button"
                aria-current={isCurrent ? 'page' : undefined}
                onClick={() => onNavigate(item.route)}
                className={`min-h-[28px] px-2.5 py-1 border rounded-btn text-[12px] font-mono transition-colors ${
                  isCurrent
                    ? 'bg-primary-soft border-primary/60 text-primary-ink font-semibold'
                    : 'bg-bg/60 border-border text-muted hover:text-text hover:bg-surface-2'
                }`}
              >
                {item.label}
              </button>
            );
          })}
      </nav>

      <div className="grow" />

      <div className="flex items-center gap-2">
        {showQuota && quotaSnapshots && quotaSnapshots.length > 0 ? (
          <QuotaBar
            snapshots={quotaSnapshots}
            agents={detectedAgents}
            onViewDetails={() => onNavigate('quota')}
          />
        ) : null}

        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            title={
              currentTheme === 'zed-dark'
                ? 'Đổi sang theme Sáng'
                : 'Đổi sang theme Zed Tối (Huyền bí)'
            }
            aria-label="Đổi giao diện Sáng / Tối"
            className="min-h-[28px] min-w-[28px] px-2 border rounded-btn flex items-center justify-center transition-colors cursor-pointer bg-bg/60 border-border text-muted hover:text-text hover:bg-surface-2 text-xs font-mono"
          >
            {currentTheme === 'zed-dark' ? '🌙' : '☀️'}
          </button>
        )}

        <button
          type="button"
          aria-label={t('app.header.settings')}
          title={t('app.header.settings')}
          aria-current={isSettingsOpen || activeNav === 'settings' ? 'page' : undefined}
          onClick={onOpenSettings ?? (() => onNavigate('settings'))}
          className={`min-h-[28px] min-w-[28px] p-1.5 border rounded-btn flex items-center justify-center transition-colors cursor-pointer group ${
            isSettingsOpen || activeNav === 'settings'
              ? 'bg-primary-soft border-primary/60 text-primary-ink'
              : 'bg-bg/60 border-border text-cf-muted hover:text-text hover:bg-surface-2'
          }`}
        >
          <svg
            className="w-3.5 h-3.5 transition-transform duration-200 group-hover:rotate-45"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    </header>
  );
}
