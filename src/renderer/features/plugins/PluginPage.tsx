import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { PluginKind, PluginManifest, PluginVM } from '@shared/ipc';
import { Button } from '../../components/Button';
import { Segmented } from '../../components/Segmented';
import { t } from '../../i18n';
import { getBridge } from '../../lib/bridge';
import { InstallFromLinkDialog } from './InstallFromLinkDialog';
import { InstallPluginDialog } from './InstallPluginDialog';
import { PluginCard } from './PluginCard';

export type PluginTab = 'catalog' | 'installed' | 'updates';

export function PluginPage(): React.JSX.Element {
  const bridge = getBridge();

  const [plugins, setPlugins] = useState<PluginVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PluginTab>('catalog');
  const [selectedKind, setSelectedKind] = useState<PluginKind | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [installingPlugin, setInstallingPlugin] = useState<PluginVM | null>(null);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [externalManifestToInstall, setExternalManifestToInstall] = useState<PluginManifest | null>(
    null,
  );

  const loadPlugins = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const res = await bridge.plugins.list();
      if (res.ok) {
        setPlugins(res.data);
      }
    } catch (err) {
      console.error('Failed to load plugins:', err);
    } finally {
      setLoading(false);
    }
  }, [bridge]);

  useEffect(() => {
    void loadPlugins();
  }, [loadPlugins]);

  const installedCount = useMemo(
    () =>
      plugins.filter(
        (p) =>
          p.status === 'installed' ||
          p.status === 'update_available' ||
          p.status === 'disabled' ||
          p.status === 'corrupted',
      ).length,
    [plugins],
  );

  const updatesCount = useMemo(
    () => plugins.filter((p) => p.status === 'update_available').length,
    [plugins],
  );

  const filteredPlugins = useMemo(() => {
    return plugins.filter((p) => {
      // Tab filter
      if (activeTab === 'installed') {
        const isInstalled =
          p.status === 'installed' ||
          p.status === 'update_available' ||
          p.status === 'disabled' ||
          p.status === 'corrupted';
        if (!isInstalled) return false;
      } else if (activeTab === 'updates') {
        if (p.status !== 'update_available') return false;
      }

      // Kind filter
      if (selectedKind !== 'all' && p.kind !== selectedKind) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchDesc = p.description.toLowerCase().includes(q);
        const matchId = p.id.toLowerCase().includes(q);
        const matchAuthor = p.author?.toLowerCase().includes(q) ?? false;
        if (!matchName && !matchDesc && !matchId && !matchAuthor) return false;
      }

      return true;
    });
  }, [plugins, activeTab, selectedKind, searchQuery]);

  // Actions
  const handleInstallConfirm = async (plugin: PluginVM): Promise<void> => {
    try {
      const res = await bridge.plugins.install({
        pluginId: plugin.id,
        grantedPermissions: [...plugin.permissions],
        externalManifest: externalManifestToInstall ?? undefined,
      });
      if (res.ok) {
        setInstallingPlugin(null);
        setExternalManifestToInstall(null);
        await loadPlugins();
      }
    } catch (err) {
      console.error('Install plugin failed:', err);
    }
  };

  const handleUninstall = async (plugin: PluginVM): Promise<void> => {
    try {
      const res = await bridge.plugins.uninstall({ pluginId: plugin.id });
      if (res.ok) {
        await loadPlugins();
      }
    } catch (err) {
      console.error('Uninstall plugin failed:', err);
    }
  };

  const handleLinkSubmit = async (url: string): Promise<void> => {
    try {
      setIsLinkDialogOpen(false);
      const res = await bridge.plugins.inspectFromUrl({ url });
      if (res.ok) {
        const manifest = res.data;
        setExternalManifestToInstall(manifest);
        setInstallingPlugin({
          id: manifest.id,
          name: manifest.name,
          version: manifest.version,
          kind: manifest.kind,
          description: manifest.description,
          permissions: manifest.permissions,
          isCurated: false,
          icon: manifest.icon ?? '🔗',
          color: manifest.color ?? '#55625D',
          status: 'not_installed',
          checksum: manifest.checksum ?? 'mock',
        });
      }
    } catch (err) {
      console.error('Inspect plugin url failed:', err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-cf-bg px-6 py-7">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        {/* Header row */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold text-cf-text">{t('mh10.title')}</h1>
            <p className="text-small text-muted max-w-2xl leading-relaxed">{t('mh10.subtitle')}</p>
          </div>
          <Button variant="default" onClick={() => setIsLinkDialogOpen(true)}>
            {t('mh10.installFromLink')}
          </Button>
        </div>

        {/* Controls row: Segmented tabs + Kind select + Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Segmented<PluginTab>
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: 'catalog', label: t('mh10.tabs.catalog') },
              {
                value: 'installed',
                label: t('mh10.tabs.installed', { count: installedCount.toString() }),
              },
              {
                value: 'updates',
                label: t('mh10.tabs.updates', { count: updatesCount.toString() }),
              },
            ]}
          />

          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label={t('mh10.actions.filterAria')}
              value={selectedKind}
              onChange={(e) => setSelectedKind(e.target.value as PluginKind | 'all')}
              className="px-3 py-1.5 border border-border rounded-btn bg-surface text-small text-cf-text focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            >
              <option value="all">{t('mh10.kinds.all')}</option>
              <option value="agent-adapter">{t('mh10.kinds.agentAdapter')}</option>
              <option value="skill-pack">{t('mh10.kinds.skillPack')}</option>
              <option value="template">{t('mh10.kinds.template')}</option>
              <option value="mcp-server">{t('mh10.kinds.mcpServer')}</option>
            </select>

            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('mh10.actions.searchPlaceholder')}
              className="w-56 px-3 py-1.5 border border-border rounded-btn text-small bg-surface text-cf-text focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            />
          </div>
        </div>

        {/* Grid of plugin cards */}
        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : filteredPlugins.length === 0 ? (
          <div className="bg-surface border border-border rounded-card p-12 text-center text-muted">
            <p className="text-small">{t('mh10.actions.emptyList')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlugins.map((plugin) => (
              <PluginCard
                key={plugin.id}
                plugin={plugin}
                onInstall={(p) => setInstallingPlugin(p)}
                onUpdate={(p) => setInstallingPlugin(p)}
                onReinstall={(p) => setInstallingPlugin(p)}
                onUninstall={(p) => void handleUninstall(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <InstallPluginDialog
        open={installingPlugin !== null}
        plugin={installingPlugin}
        onClose={() => {
          setInstallingPlugin(null);
          setExternalManifestToInstall(null);
        }}
        onConfirm={(p) => void handleInstallConfirm(p)}
      />

      <InstallFromLinkDialog
        open={isLinkDialogOpen}
        onClose={() => setIsLinkDialogOpen(false)}
        onSubmit={(url) => void handleLinkSubmit(url)}
      />
    </div>
  );
}
