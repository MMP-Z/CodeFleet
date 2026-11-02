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
  const [isInitializing, setIsInitializing] = useState(true);
  const [quotaSnapshots, setQuotaSnapshots] = useState<readonly QuotaSnapshot[]>([]);
  const [detectedAgents, setDetectedAgents] = useState<readonly DetectResult[]>([]);

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
        setRoute('settings');
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
    setRoute(nextRoute);
    if (typeof window !== 'undefined') {
      window.location.hash =
        nextRoute === 'dev-components'
          ? '#/dev/components'
          : nextRoute === 'settings'
            ? '#/settings'
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
      route !== 'projects' &&
      route !== 'history' &&
      route !== 'direct-edit');

  const headerProject = currentProject
    ? { name: currentProject.name, path: currentProject.path }
    : undefined;

  if (isInitializing && route !== 'dev-components') {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-cf-bg"
        aria-busy="true"
        aria-label="Loading"
      >
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col bg-cf-bg text-cf-text font-sans">
        <AppHeader
          activeNav={
            route === 'onboarding' || route === 'projects' || route === 'direct-edit'
              ? 'chat'
              : route
          }
          onNavigate={handleNavigate}
          project={headerProject}
          onProjectClick={() => setIsSwitchModalOpen(true)}
          featureFlags={bridge.featureFlags}
          quotaSnapshots={quotaSnapshots}
          detectedAgents={detectedAgents}
        />
        <main className="flex-1 flex flex-col">
          {route === 'dev-components' && bridge.featureFlags.devComponents ? (
            <DevComponentsPage />
          ) : showOnboarding ? (
            <OnboardingPage onCompleted={handleOnboardingCompleted} />
          ) : route === 'settings' ? (
            <SettingsPage />
          ) : route === 'quota' ? (
            <QuotaDetailsPage onNavigateToSettings={() => handleNavigate('settings')} />
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
      </div>
    </ToastProvider>
  );
}
