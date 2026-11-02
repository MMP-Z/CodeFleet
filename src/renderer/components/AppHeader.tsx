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
    <header className="relative z-10 flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3 bg-surface border-b border-border">
      <div className="flex items-center gap-2.5">
        <div
          aria-hidden="true"
          className="w-7 h-7 rounded-btn bg-primary flex items-center justify-center"
        >
          <span className="w-2.5 h-2.5 border-2 border-surface rounded-pill block" />
        </div>
        <strong className="text-sub-title font-bold text-text">{APP_NAME}</strong>
      </div>

      {project ? (
        <ProjectPill name={project.name} path={project.path} onClick={onProjectClick} />
      ) : null}

      <nav aria-label={t('app.header.navAria')} className="flex flex-wrap gap-1.5">
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
                className={`min-h-[34px] px-2.5 py-[5px] border rounded-btn text-[13px] transition-colors ${
                  isCurrent
                    ? 'bg-primary-soft border-primary/30 text-primary-ink font-semibold'
                    : 'bg-surface border-border text-text hover:bg-surface-2'
                }`}
              >
                {item.label}
              </button>
            );
          })}
      </nav>

      <div className="grow" />

      <div className="flex items-center gap-2.5">
        {showQuota && quotaSnapshots && quotaSnapshots.length > 0 ? (
          <QuotaBar
            snapshots={quotaSnapshots}
            agents={detectedAgents}
            onViewDetails={() => onNavigate('quota')}
          />
        ) : null}

        <button
          type="button"
          aria-label={t('app.header.settings')}
          title={t('app.header.settings')}
          aria-current={isSettingsOpen || activeNav === 'settings' ? 'page' : undefined}
          onClick={onOpenSettings ?? (() => onNavigate('settings'))}
          className={`min-h-[34px] min-w-[34px] p-2 border rounded-btn flex items-center justify-center transition-all cursor-pointer group ${
            isSettingsOpen || activeNav === 'settings'
              ? 'bg-primary-soft border-primary/40 text-primary-ink shadow-sm'
              : 'bg-surface border-border text-cf-muted hover:text-text hover:bg-surface-2'
          }`}
        >
          <svg
            className="w-4 h-4 transition-transform duration-200 group-hover:rotate-45"
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
