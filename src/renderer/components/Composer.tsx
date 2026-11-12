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
    <div className="p-3 bg-surface border-t border-border flex flex-col gap-2 font-mono">
      <div className="flex gap-2 items-end">
        <div className="flex-1 flex items-start gap-2 px-2.5 py-2 border border-border rounded-input bg-bg focus-within:border-primary transition-colors">
          <span
            aria-hidden="true"
            className="select-none text-primary-ink font-bold text-small leading-[1.45] pt-0.5"
          >
            $
          </span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder={placeholder ?? t('mh03.composer.placeholder')}
            aria-label={t('mh03.composer.ariaLabel')}
            className="flex-1 bg-transparent text-small font-mono text-cf-text placeholder:text-muted/70 focus:outline-none resize-none"
          />
        </div>

        <div className="flex gap-1.5">
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
        <span className="text-[11px] font-mono text-muted">
          {t('mh03.composer.undoableGuarantee')}
        </span>
      </div>
    </div>
  );
}
