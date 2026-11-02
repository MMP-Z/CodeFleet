import React from 'react';
import { PLUGIN_PERMISSIONS, type PluginPermission, type PluginVM } from '@shared/ipc';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Notice } from '../../components/Notice';
import { Pill } from '../../components/Pill';
import { t } from '../../i18n';
import { getPermissionLabel } from './PluginCard';

export interface InstallPluginDialogProps {
  readonly open: boolean;
  readonly plugin: PluginVM | null;
  readonly onClose: () => void;
  readonly onConfirm: (plugin: PluginVM) => void;
}

function getPermissionDesc(perm: PluginPermission): string {
  switch (perm) {
    case 'project:read':
      return t('mh10.permissions.descriptions.projectRead');
    case 'project:write':
      return t('mh10.permissions.descriptions.projectWrite');
    case 'process:run':
      return t('mh10.permissions.descriptions.processRun');
    case 'network':
      return t('mh10.permissions.descriptions.network');
    case 'mcp:connect':
      return t('mh10.permissions.descriptions.mcpConnect');
    default:
      return '';
  }
}

export function InstallPluginDialog({
  open,
  plugin,
  onClose,
  onConfirm,
}: InstallPluginDialogProps): React.JSX.Element | null {
  if (!open || !plugin) return null;

  const requestedSet = new Set(plugin.permissions);
  const unrequested = PLUGIN_PERMISSIONS.filter((p) => !requestedSet.has(p));
  const unrequestedText = unrequested.map((p) => getPermissionLabel(p)).join(', ');

  const sourceText = plugin.isCurated
    ? t('mh10.dialogInstall.officialSource')
    : t('mh10.dialogInstall.externalSource');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('mh10.dialogInstall.title', { name: plugin.name })}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="ghost" onClick={onClose}>
            {t('mh10.dialogInstall.cancel')}
          </Button>
          <Button variant="primary" onClick={() => onConfirm(plugin)}>
            {t('mh10.dialogInstall.confirm')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 text-cf-text text-small">
        {/* Head metadata */}
        <div className="flex items-center gap-3 pb-2 border-b border-line">
          <div
            className="w-11 h-11 rounded-[10px] flex items-center justify-center font-bold text-lg shrink-0 select-none"
            style={{
              backgroundColor: `${plugin.color}18`,
              color: plugin.color,
            }}
            aria-hidden="true"
          >
            {plugin.icon}
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              {plugin.isCurated && <Pill tone="brand">{t('mh10.status.curated')}</Pill>}
              <span className="text-muted text-[13px]">
                {t('mh10.dialogInstall.meta', {
                  version: plugin.version,
                  source: sourceText,
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Intro */}
        <p className="leading-relaxed font-medium">{t('mh10.dialogInstall.intro')}</p>

        {/* Permissions list */}
        <div className="flex flex-col gap-2">
          {plugin.permissions.map((perm) => (
            <div
              key={perm}
              className="flex items-start gap-3 p-3 rounded-lg bg-surface-2/60 border border-border/60"
            >
              <Pill tone="warn">{t('mh10.permissions.needGrant')}</Pill>
              <div className="grow min-w-0">
                <strong className="block text-[13px] text-cf-text">
                  {getPermissionLabel(perm)}
                </strong>
                <span className="text-xs text-muted block leading-snug">
                  {getPermissionDesc(perm)}
                </span>
              </div>
              <span className="font-mono text-xs text-muted shrink-0 bg-surface px-1.5 py-0.5 rounded border border-border/40">
                {perm}
              </span>
            </div>
          ))}

          {unrequested.length > 0 && (
            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-2/30 border border-border/30 opacity-70">
              <Pill tone="wait">—</Pill>
              <div className="text-xs text-muted">
                {t('mh10.permissions.notRequested', { perms: unrequestedText })}
              </div>
            </div>
          )}
        </div>

        {/* Safe notice */}
        <Notice tone="neutral">{t('mh10.dialogInstall.safeNotice')}</Notice>
      </div>
    </Dialog>
  );
}
