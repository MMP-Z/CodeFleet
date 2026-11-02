import { useEffect, useState } from 'react';
import { AppHeader, type NavRoute } from './components/AppHeader';
import { ToastProvider } from './components/Toast';
import { DevComponentsPage } from './features/dev/DevComponentsPage';
import { OnboardingPage } from './features/onboarding/OnboardingPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { getBridge } from './lib/bridge';

export type AppRoute = NavRoute | 'onboarding';

function readInitialRoute(allowDevComponents: boolean): AppRoute {
  if (
    allowDevComponents &&
    typeof window !== 'undefined' &&
    (window.location.pathname === '/dev/components' || window.location.hash === '#/dev/components')
  ) {
    return 'dev-components';
  }
  if (typeof window !== 'undefined' && window.location.hash === '#/settings') {
    return 'settings';
  }
  return 'onboarding';
}

export function App(): React.JSX.Element {
  const bridge = getBridge();
  const [route, setRoute] = useState<AppRoute>(() =>
    readInitialRoute(bridge.featureFlags.devComponents),
  );
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    void bridge.settings.get('onboarding.completed').then((res) => {
      if (res.ok) {
        setOnboardingCompleted(res.data);
        if (res.data && route === 'onboarding') {
          setRoute('settings');
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
            : '#/onboarding';
    }
  };

  const handleOnboardingCompleted = (): void => {
    setOnboardingCompleted(true);
    setRoute('settings');
    if (typeof window !== 'undefined') {
      window.location.hash = '#/settings';
    }
  };

  const showOnboarding =
    route === 'onboarding' ||
    (!onboardingCompleted && route !== 'dev-components' && route !== 'settings');

  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col bg-cf-bg text-cf-text font-sans">
        <AppHeader
          activeNav={route === 'onboarding' ? 'chat' : route}
          onNavigate={handleNavigate}
          featureFlags={bridge.featureFlags}
        />
        <main className="flex-1 flex flex-col">
          {route === 'dev-components' && bridge.featureFlags.devComponents ? (
            <DevComponentsPage />
          ) : showOnboarding ? (
            <OnboardingPage onCompleted={handleOnboardingCompleted} />
          ) : (
            <SettingsPage />
          )}
        </main>
      </div>
    </ToastProvider>
  );
}
