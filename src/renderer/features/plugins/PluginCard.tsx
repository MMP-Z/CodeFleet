import React from 'react';
import type { PluginKind, PluginPermission, PluginVM } from '@shared/ipc';
import { Button } from '../../components/Button';
import { Pill } from '../../components/Pill';
import { t } from '../../i18n';

export interface PluginCardProps {
  readonly plugin: PluginVM;
  readonly onInstall: (plugin: PluginVM) => void;
  readonly onUpdate: (plugin: PluginVM) => void;
  readonly onUninstall: (plugin: PluginVM) => void;
  readonly onReinstall: (plugin: PluginVM) => void;
}

export function getKindLabel(kind: PluginKind): string {
  switch (kind) {
    case 'agent-adapter':
      return t('mh10.kinds.agentAdapter');
    case 'skill-pack':
      return t('mh10.kinds.skillPack');
    case 'template':
      return t('mh10.kinds.template');
    case 'mcp-server':
      return t('mh10.kinds.mcpServer');
    default:
      return kind;
  }
}

export function getPermissionLabel(perm: PluginPermission): string {
  switch (perm) {
    case 'project:read':
      return t('mh10.permissions.projectRead');
    case 'project:write':
      return t('mh10.permissions.projectWrite');
    case 'process:run':
      return t('mh10.permissions.processRun');
    case 'network':
      return t('mh10.permissions.network');
    case 'mcp:connect':
      return t('mh10.permissions.mcpConnect');
    default:
      return perm;
  }
}

export function PluginCard({
  plugin,
  onInstall,
  onUpdate,
  onUninstall,
  onReinstall,
}: PluginCardProps): React.JSX.Element {
  const isCorrupted = plugin.status === 'corrupted';

  return (
    <div
      className={`bg-surface border rounded-card p-4 flex flex-col justify-between gap-3 transition-shadow hover:shadow-sm ${
        isCorrupted
          ? 'border-danger-border opacity-90'
          : plugin.status === 'installed'
            ? 'border-border'
            : 'border-border'
      }`}
    >
      <div className="flex flex-col gap-2.5">
        {/* Header row: Icon + Title + Version */}
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-[10px] flex items-center justify-center font-bold text-base shrink-0 select-none"
            style={{
              backgroundColor: isCorrupted ? '#FEE2E2' : `${plugin.color}18`,
              color: isCorrupted ? '#DC2626' : plugin.color,
            }}
            aria-hidden="true"
          >
            {plugin.icon}
          </div>
          <div className="grow min-w-0">
            <h3 className="font-bold text-cf-text text-[15px] truncate" title={plugin.name}>
              {plugin.name}
            </h3>
            <div className="text-small text-muted">
              {getKindLabel(plugin.kind)} · v{plugin.installedVersion ?? plugin.version}
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-small text-muted leading-relaxed line-clamp-2">
          {plugin.errorDetail ?? plugin.description}
        </p>

        {/* Badges: Curated + Permissions */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {plugin.isCurated && <Pill tone="brand">{t('mh10.status.curated')}</Pill>}
          {plugin.permissions.map((perm) => (
            <Pill key={perm} tone={perm === 'process:run' || perm === 'network' ? 'warn' : 'wait'}>
              {getPermissionLabel(perm)}
            </Pill>
          ))}
        </div>
      </div>

      {/* Bottom actions row */}
      <div className="flex items-center justify-between pt-2 border-t border-line/50 mt-1">
        {isCorrupted ? (
          <>
            <Pill tone="danger">{t('mh10.status.corrupted')}</Pill>
            <div className="flex gap-1.5">
              <Button size="sm" variant="default" onClick={() => onReinstall(plugin)}>
                {t('mh10.actions.reinstall')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onUninstall(plugin)}>
                {t('mh10.actions.uninstall')}
              </Button>
            </div>
          </>
        ) : plugin.status === 'update_available' ? (
          <>
            <Pill tone="warn">
              {t('mh10.status.updateAvailable', { version: plugin.availableVersion ?? '' })}
            </Pill>
            <Button size="sm" variant="primary" onClick={() => onUpdate(plugin)}>
              {t('mh10.actions.update')}
            </Button>
          </>
        ) : plugin.status === 'installed' ? (
          <>
            <Pill tone="ok">{t('mh10.status.installed')}</Pill>
            <Button size="sm" variant="ghost" onClick={() => onUninstall(plugin)}>
              {t('mh10.actions.uninstall')}
            </Button>
          </>
        ) : plugin.status === 'disabled' ? (
          <>
            <Pill tone="wait">{t('mh10.status.disabled')}</Pill>
            <Button size="sm" variant="ghost" onClick={() => onUninstall(plugin)}>
              {t('mh10.actions.uninstall')}
            </Button>
          </>
        ) : (
          <div className="w-full flex justify-end">
            <Button size="sm" variant="primary" onClick={() => onInstall(plugin)}>
              {t('mh10.actions.install')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
