import { useEffect, useState } from 'react';
import type { DetectResult, ProjectRecord, QuotaSnapshot } from '@shared/ipc';
import { AppHeader, type NavRoute } from './components/AppHeader';
import { ToastProvider } from './components/Toast';
import { ChatPage } from './features/chat/ChatPage';
import { DevComponentsPage } from './features/dev/DevComponentsPage';
import { DirectEditPage } from './features/direct-edit/DirectEditPage';
import { ProjectHistoryPage } from './features/history/ProjectHistoryPage';
import { OnboardingPage } from './features/onboarding/OnboardingPage';
import { ProjectSelectModal } from './features/projects/ProjectSelectModal';
import { ProjectSelectPage } from './features/projects/ProjectSelectPage';
import { PluginPage } from './features/plugins/PluginPage';
import { QuotaDetailsPage } from './features/quota/QuotaDetailsPage';
import { SettingsModal } from './features/settings/SettingsModal';
import { SettingsPage } from './features/settings/SettingsPage';
import { getBridge } from './lib/bridge';

export type AppRoute = NavRoute | 'onboarding' | 'projects' | 'direct-edit';

function readInitialRoute(allowDevComponents: boolean): AppRoute {
  if (
    allowDevComponents &&
    typeof window !== 'undefined' &&
    (window.location.pathname === '/dev/components' || window.location.hash === '#/dev/components')
  ) {
    return 'dev-components';
  }
  if (typeof window !== 'undefined') {
    if (window.location.hash === '#/settings') return 'settings';
    if (window.location.hash === '#/quota') return 'quota';
    if (window.location.hash === '#/plugins') return 'plugins';
    if (window.location.hash === '#/projects') return 'projects';
    if (window.location.hash === '#/history') return 'history';
    if (window.location.hash === '#/direct-edit') return 'direct-edit';
    if (window.location.hash === '#/chat') return 'chat';
  }
  return 'onboarding';
}

export function App(): React.JSX.Element {
  const bridge = getBridge();
  const [route, setRoute] = useState<AppRoute>(() =>
    readInitialRoute(bridge.featureFlags.devComponents),
  );
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [currentProject, setCurrentProject] = useState<ProjectRecord | null>(null);
  const [chatInitialStepId, setChatInitialStepId] = useState<string | null>(null);
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [quotaSnapshots, setQuotaSnapshots] = useState<readonly QuotaSnapshot[]>([]);
  const [detectedAgents, setDetectedAgents] = useState<readonly DetectResult[]>([]);
  const [theme, setTheme] = useState<'zed-dark' | 'sage'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('codefleet_theme');
      if (saved === 'sage' || saved === 'zed-dark') return saved;
    }
    return 'zed-dark'; // Mặc định là Zed Dark huyền bí
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('codefleet_theme', theme);
    }
  }, [theme]);

  const toggleTheme = (): void => {
    setTheme((prev) => (prev === 'zed-dark' ? 'sage' : 'zed-dark'));
  };

  useEffect(() => {
    let mounted = true;
    async function init(): Promise<void> {
      try {
        const [onboardingRes, quotaRes, agentsRes] = await Promise.all([
          bridge.settings.get('onboarding.completed'),
          bridge.quota.getAll(),
          bridge.agents.detectAll(),
        ]);
        if (!mounted) return;

        if (quotaRes.ok) {
          setQuotaSnapshots(quotaRes.data);
        }
        if (agentsRes.ok) {
          setDetectedAgents(agentsRes.data);
        }

        if (onboardingRes.ok && onboardingRes.data) {
          setOnboardingCompleted(true);
          const projRes = await bridge.projects.list();
          if (!mounted) return;
          if (projRes.ok && projRes.data.length > 0) {
            const latest = projRes.data[0];
            setCurrentProject((prev) => prev ?? latest);
            if (route === 'onboarding') {
              setRoute('chat');
            }
          } else if (route === 'onboarding') {
            setRoute('projects');
          }
        } else {
          setOnboardingCompleted(false);
        }
      } catch (err) {
        console.error('Failed to initialize app state:', err);
      } finally {
        if (mounted) {
          setIsInitializing(false);
        }
      }
    }
    void init();

    const unsubscribeQuota = bridge.quota.onUpdate((updated) => {
      if (mounted) {
        setQuotaSnapshots(updated);
      }
    });

    return () => {
      mounted = false;
      unsubscribeQuota();
    };
  }, [bridge, route]);

  useEffect(() => {
    function handleHashChange(): void {
      if (bridge.featureFlags.devComponents && window.location.hash === '#/dev/components') {
        setRoute('dev-components');
      } else if (window.location.hash === '#/settings') {
        setIsSettingsOpen(true);
      } else if (window.location.hash === '#/quota') {
        setRoute('quota');
      } else if (window.location.hash === '#/plugins') {
        setRoute('plugins');
      } else if (window.location.hash === '#/projects') {
        setRoute('projects');
      } else if (window.location.hash === '#/history') {
        setRoute('history');
        void bridge.projects.list().then((projRes) => {
          if (projRes.ok && projRes.data.length > 0) {
            setCurrentProject((prev) => prev ?? projRes.data[0]);
          }
        });
      } else if (window.location.hash === '#/direct-edit') {
        setRoute('direct-edit');
        void bridge.projects.list().then((projRes) => {
          if (projRes.ok && projRes.data.length > 0) {
            setCurrentProject((prev) => prev ?? projRes.data[0]);
          }
        });
      } else if (window.location.hash === '#/chat') {
        setRoute('chat');
        void bridge.projects.list().then((projRes) => {
          if (projRes.ok && projRes.data.length > 0) {
            setCurrentProject((prev) => prev ?? projRes.data[0]);
          }
        });
      } else if (window.location.hash === '#/onboarding') {
        setRoute('onboarding');
      }
    }
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [bridge]);

  const handleNavigate = (nextRoute: NavRoute): void => {
    if (nextRoute === 'settings') {
      setIsSettingsOpen(true);
      return;
    }
    setRoute(nextRoute);
    if (typeof window !== 'undefined') {
      window.location.hash =
        nextRoute === 'dev-components'
          ? '#/dev/components'
          : nextRoute === 'quota'
            ? '#/quota'
            : nextRoute === 'plugins'
              ? '#/plugins'
              : nextRoute === 'history'
                ? '#/history'
                : nextRoute === 'chat'
                  ? '#/chat'
                  : '#/onboarding';
    }
  };

  const handleCloseSettings = (): void => {
    setIsSettingsOpen(false);
    if (typeof window !== 'undefined' && window.location.hash === '#/settings') {
      window.location.hash = `#/${route === 'settings' ? 'chat' : route}`;
    }
  };

  const handleOnboardingCompleted = (): void => {
    setOnboardingCompleted(true);
    void bridge.projects.list().then((projRes) => {
      if (projRes.ok && projRes.data.length > 0) {
        setCurrentProject(projRes.data[0]);
        setRoute('chat');
        if (typeof window !== 'undefined') window.location.hash = '#/chat';
      } else {
        setRoute('projects');
        if (typeof window !== 'undefined') window.location.hash = '#/projects';
      }
    });
  };

  const handleProjectSelected = (project: ProjectRecord): void => {
    setCurrentProject(project);
    setRoute('chat');
    if (typeof window !== 'undefined') window.location.hash = '#/chat';
  };

  const showOnboarding =
    route === 'onboarding' ||
    (!onboardingCompleted &&
      route !== 'dev-components' &&
      route !== 'settings' &&
      route !== 'quota' &&
      route !== 'plugins' &&
      route !== 'projects' &&
      route !== 'history' &&
      route !== 'direct-edit');

  const headerProject = currentProject
    ? { name: currentProject.name, path: currentProject.path }
    : undefined;

  if (isInitializing && route !== 'dev-components') {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-cf-bg font-mono"
        aria-busy="true"
        aria-label="Loading"
      >
        <div className="w-6 h-6 rounded-btn border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <div
        className={`min-h-screen flex flex-col bg-cf-bg text-cf-text font-mono ${theme === 'zed-dark' ? 'theme-zed dark' : ''}`}
        data-theme={theme}
      >
        <AppHeader
          activeNav={
            route === 'onboarding' ||
            route === 'projects' ||
            route === 'direct-edit' ||
            route === 'settings'
              ? 'chat'
              : route
          }
          onNavigate={handleNavigate}
          project={headerProject}
          onProjectClick={() => setIsSwitchModalOpen(true)}
          featureFlags={bridge.featureFlags}
          quotaSnapshots={quotaSnapshots}
          detectedAgents={detectedAgents}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isSettingsOpen={isSettingsOpen}
          currentTheme={theme}
          onToggleTheme={toggleTheme}
        />
        <main className="flex-1 flex flex-col">
          {route === 'dev-components' && bridge.featureFlags.devComponents ? (
            <DevComponentsPage />
          ) : showOnboarding ? (
            <OnboardingPage onCompleted={handleOnboardingCompleted} />
          ) : route === 'settings' ? (
            <SettingsPage />
          ) : route === 'quota' ? (
            <QuotaDetailsPage onNavigateToSettings={() => setIsSettingsOpen(true)} />
          ) : route === 'plugins' ? (
            <PluginPage />
          ) : route === 'projects' || !currentProject ? (
            <ProjectSelectPage onProjectSelected={handleProjectSelected} />
          ) : route === 'history' ? (
            <ProjectHistoryPage
              project={currentProject}
              onBack={() => handleNavigate('chat')}
              onViewCode={(stepId) => {
                setChatInitialStepId(stepId);
                handleNavigate('chat');
              }}
            />
          ) : route === 'direct-edit' ? (
            <DirectEditPage project={currentProject} onBack={() => handleNavigate('chat')} />
          ) : (
            <ChatPage
              project={currentProject}
              onOpenDirectEdit={() => {
                setRoute('direct-edit');
                if (typeof window !== 'undefined') window.location.hash = '#/direct-edit';
              }}
              onNavigateToQuota={() => handleNavigate('quota')}
              initialActiveStepId={chatInitialStepId}
            />
          )}
        </main>

        <ProjectSelectModal
          open={isSwitchModalOpen}
          onClose={() => setIsSwitchModalOpen(false)}
          onProjectSelected={handleProjectSelected}
        />

        <SettingsModal open={isSettingsOpen} onClose={handleCloseSettings} />
      </div>
    </ToastProvider>
  );
}
