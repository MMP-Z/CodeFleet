import { useEffect, useState } from 'react';
import type { ProjectRecord } from '@shared/ipc';
import { AppHeader, type NavRoute } from './components/AppHeader';
import { ToastProvider } from './components/Toast';
import { ChatPage } from './features/chat/ChatPage';
import { DevComponentsPage } from './features/dev/DevComponentsPage';
import { OnboardingPage } from './features/onboarding/OnboardingPage';
import { ProjectSelectModal } from './features/projects/ProjectSelectModal';
import { ProjectSelectPage } from './features/projects/ProjectSelectPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { getBridge } from './lib/bridge';

export type AppRoute = NavRoute | 'onboarding' | 'projects';

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
    if (window.location.hash === '#/projects') return 'projects';
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
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);

  useEffect(() => {
    void bridge.settings.get('onboarding.completed').then((res) => {
      if (res.ok) {
        setOnboardingCompleted(res.data);
        if (res.data && route === 'onboarding') {
          // Kiểm tra xem đã có dự án nào chưa
          void bridge.projects.list().then((projRes) => {
            if (projRes.ok && projRes.data.length > 0) {
              const latest = projRes.data[0];
              setCurrentProject(latest);
              setRoute('chat');
            } else {
              setRoute('projects');
            }
          });
        }
      } else {
        setOnboardingCompleted(false);
      }
    });
  }, [bridge, route]);

  useEffect(() => {
    function handleHashChange(): void {
      if (bridge.featureFlags.devComponents && window.location.hash === '#/dev/components') {
        setRoute('dev-components');
      } else if (window.location.hash === '#/settings') {
        setRoute('settings');
      } else if (window.location.hash === '#/projects') {
        setRoute('projects');
      } else if (window.location.hash === '#/chat') {
        setRoute('chat');
      } else if (window.location.hash === '#/onboarding') {
        setRoute('onboarding');
      }
    }
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [bridge.featureFlags.devComponents]);

  const handleNavigate = (nextRoute: NavRoute): void => {
    setRoute(nextRoute);
    if (typeof window !== 'undefined') {
      window.location.hash =
        nextRoute === 'dev-components'
          ? '#/dev/components'
          : nextRoute === 'settings'
            ? '#/settings'
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
      route !== 'projects');

  const headerProject = currentProject
    ? { name: currentProject.name, path: currentProject.path }
    : undefined;

  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col bg-cf-bg text-cf-text font-sans">
        <AppHeader
          activeNav={route === 'onboarding' || route === 'projects' ? 'chat' : route}
          onNavigate={handleNavigate}
          project={headerProject}
          onProjectClick={() => setIsSwitchModalOpen(true)}
          featureFlags={bridge.featureFlags}
        />
        <main className="flex-1 flex flex-col">
          {route === 'dev-components' && bridge.featureFlags.devComponents ? (
            <DevComponentsPage />
          ) : showOnboarding ? (
            <OnboardingPage onCompleted={handleOnboardingCompleted} />
          ) : route === 'settings' ? (
            <SettingsPage />
          ) : route === 'projects' || !currentProject ? (
            <ProjectSelectPage onProjectSelected={handleProjectSelected} />
          ) : (
            <ChatPage project={currentProject} />
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
