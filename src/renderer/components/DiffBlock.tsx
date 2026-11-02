import { useState } from 'react';
import { t } from '../i18n';

export interface DiffBlockProps {
  readonly diffText: string;
  readonly maxLines?: number;
  readonly onAskSnippet?: (snippet: string) => void;
  readonly className?: string;
}

export function DiffBlock({
  diffText,
  maxLines,
  onAskSnippet,
  className = '',
}: DiffBlockProps): React.JSX.Element {
  const [selectedSnippet, setSelectedSnippet] = useState<string | null>(null);

  const lines = diffText.split('\n');
  const displayLines = maxLines ? lines.slice(0, maxLines) : lines;
  const isTruncated = maxLines && lines.length > maxLines;

  const handleMouseUp = (): void => {
    if (!onAskSnippet) return;
    const sel = window.getSelection()?.toString().trim();
    if (sel && sel.length >= 5) {
      setSelectedSnippet(sel);
    } else {
      setSelectedSnippet(null);
    }
  };

  return (
    <div
      className={`relative bg-surface border border-border rounded-lg overflow-hidden ${className}`}
    >
      {selectedSnippet && onAskSnippet && (
        <div className="absolute top-2 right-2 z-10 animate-fade-in shadow-md">
          <button
            type="button"
            className="px-3 py-1.5 bg-primary text-white text-tiny font-medium rounded-md hover:bg-primary/90 transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
            onClick={() => {
              onAskSnippet(selectedSnippet);
              setSelectedSnippet(null);
            }}
          >
            <span>💬</span>
            <span>{t('mh03.code.askSnippet')}</span>
          </button>
        </div>
      )}

      <div
        className="p-3 text-[13px] font-mono leading-relaxed overflow-x-auto select-text"
        onMouseUp={handleMouseUp}
      >
        {displayLines.map((line, idx) => {
          let lineBg = 'transparent';
          let textColor = 'text-cf-text';
          let signColor = 'text-muted';

          if (line.startsWith('+') && !line.startsWith('+++')) {
            lineBg = 'bg-ok-bg/70';
            textColor = 'text-ok-ink';
            signColor = 'text-ok-ink font-bold';
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            lineBg = 'bg-danger-bg/70';
            textColor = 'text-danger-ink';
            signColor = 'text-danger-ink font-bold';
          } else if (line.startsWith('@@')) {
            lineBg = 'bg-primary-soft/40';
            textColor = 'text-primary font-medium';
            signColor = 'text-primary';
          }

          return (
            <div
              key={idx}
              className={`flex items-start px-2 py-0.5 rounded-sm ${lineBg} transition-colors`}
            >
              <span className={`w-5 flex-none select-none ${signColor}`}>
                {line.charAt(0) === '+' || line.charAt(0) === '-' ? line.charAt(0) : ' '}
              </span>
              <span className={`flex-1 whitespace-pre ${textColor}`}>
                {line.startsWith('+') || line.startsWith('-') ? line.slice(1) : line}
              </span>
            </div>
          );
        })}

        {isTruncated && (
          <div className="text-center py-2 text-tiny text-muted italic">
            … còn {lines.length - maxLines} dòng thay đổi nữa (chuyển sang mức “Toàn bộ” để xem hết)
          </div>
        )}
      </div>
    </div>
  );
}
