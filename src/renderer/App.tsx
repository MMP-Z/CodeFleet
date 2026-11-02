import { APP_NAME } from '@shared/constants';
import { t } from './i18n';

export function App(): React.JSX.Element {
  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <header className="flex items-center gap-3 px-5 py-3 bg-surface border-b border-border">
        <strong className="text-sub-title">{APP_NAME}</strong>
      </header>
      <main className="w-full max-w-[1120px] mx-auto px-6 pt-7 pb-12">
        <h1>{t('mh11.title')}</h1>
      </main>
    </div>
  );
}
