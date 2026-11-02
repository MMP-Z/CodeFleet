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
}

/**
 * Thanh đầu ứng dụng bản Phase 1 theo UI_SPEC mục 4 & Prompt 1:
 * Logo + hằng số APP_NAME + điều hướng. CHƯA có chip hạn mức (làm ở Phase 5).
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
      route: 'settings',
      label: t('app.header.settings'),
      visible: true,
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

      {showQuota && quotaSnapshots && quotaSnapshots.length > 0 ? (
        <QuotaBar
          snapshots={quotaSnapshots}
          agents={detectedAgents}
          onViewDetails={() => onNavigate('quota')}
        />
      ) : null}
    </header>
  );
}
