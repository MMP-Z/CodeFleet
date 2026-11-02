import { useState } from 'react';
import { t } from '../i18n';
import { AiPicker } from './AiPicker';
import { Button } from './Button';

export interface ComposerProps {
  readonly running: boolean;
  readonly aiPick: string;
  readonly onAiPickChange: (ai: string) => void;
  readonly onSend: (content: string) => void;
  readonly onStop: () => void;
  readonly placeholder?: string;
}

export function Composer({
  running,
  aiPick,
  onAiPickChange,
  onSend,
  onStop,
  placeholder,
}: ComposerProps): React.JSX.Element {
  const [text, setText] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (text.trim() && !running) {
        onSend(text.trim());
        setText('');
      }
    }
  };

  const handleSend = (): void => {
    if (text.trim() && !running) {
      onSend(text.trim());
      setText('');
    }
  };

  return (
    <div className="p-4 bg-surface border-t border-border flex flex-col gap-2.5">
      <div className="flex gap-2 items-end">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder={placeholder ?? t('mh03.composer.placeholder')}
          aria-label={t('mh03.composer.ariaLabel')}
          className="flex-1 p-2.5 border border-border rounded-lg text-small bg-bg text-cf-text focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        />

        <div className="flex gap-2">
          {running && (
            <Button type="button" variant="danger" size="lg" onClick={onStop}>
              {t('mh03.composer.stop')}
            </Button>
          )}

          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={!text.trim() || running}
            onClick={handleSend}
          >
            {t('mh03.composer.send')}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-small text-muted">
        <AiPicker value={aiPick} onChange={onAiPickChange} disabled={running} />
        <span className="text-[12px]">{t('mh03.composer.undoableGuarantee')}</span>
      </div>
    </div>
  );
}
