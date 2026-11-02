import { useEffect, useState } from 'react';
import { AppHeader, type NavRoute } from './components/AppHeader';
import { ToastProvider } from './components/Toast';
import { DevComponentsPage } from './features/dev/DevComponentsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { getBridge } from './lib/bridge';

function readInitialRoute(allowDevComponents: boolean): NavRoute {
  if (
    allowDevComponents &&
    typeof window !== 'undefined' &&
    (window.location.pathname === '/dev/components' ||
      window.location.hash === '#/dev/components')
  ) {
    return 'dev-components';
  }
  return 'settings';
}

export function App(): React.JSX.Element {
  const bridge = getBridge();
  const [route, setRoute] = useState<NavRoute>(() =>
    readInitialRoute(bridge.featureFlags.devComponents),
  );

  useEffect(() => {
    function handleHashChange(): void {
      if (
        bridge.featureFlags.devComponents &&
        window.location.hash === '#/dev/components'
      ) {
        setRoute('dev-components');
      } else if (window.location.hash === '#/settings') {
        setRoute('settings');
      }
    }
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [bridge.featureFlags.devComponents]);

  const handleNavigate = (nextRoute: NavRoute): void => {
    setRoute(nextRoute);
    if (typeof window !== 'undefined') {
      window.location.hash = nextRoute === 'dev-components' ? '#/dev/components' : '#/settings';
    }
  };

  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col bg-bg text-text">
        <AppHeader
          activeNav={route}
          onNavigate={handleNavigate}
          featureFlags={bridge.featureFlags}
        />
        <main className="flex-1 flex flex-col">
          {route === 'dev-components' && bridge.featureFlags.devComponents ? (
            <DevComponentsPage />
          ) : (
            <SettingsPage />
          )}
        </main>
      </div>
    </ToastProvider>
  );
}
