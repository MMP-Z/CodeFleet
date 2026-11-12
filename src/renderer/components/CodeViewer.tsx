import { useState, useMemo } from 'react';
import { t } from '../i18n';

export interface CodeViewerProps {
  readonly filePath: string;
  readonly content: string;
  readonly language?: string;
  readonly onAskSnippet?: (snippet: string) => void;
  readonly onCloseTab?: () => void;
  readonly activeTab?: 'file' | 'diff' | 'preview' | 'log';
  readonly onTabChange?: (tab: 'file' | 'diff' | 'preview' | 'log') => void;
  readonly hasDiff?: boolean;
}

// Tokenizer đơn giản, nhanh và an toàn cho Syntax Highlighting phong cách Zed
function highlightLine(line: string, language: string = 'javascript'): React.JSX.Element {
  if (language === 'markdown' || language === 'plaintext') {
    return <span>{line}</span>;
  }

  // Regex tokens cho JS/TS/JSON
  // Matches: Comments, Strings, Keywords, Booleans/null, Numbers, Function calls, Identifiers
  const tokenRegex =
    /(\/\/.*$|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'])*'|"(?:\\.|[^"])*"|`(?:\\.|[^`])*`)|(\b(?:import|from|export|default|const|let|var|function|return|if|else|switch|case|for|while|do|break|continue|try|catch|finally|throw|class|extends|new|this|typeof|instanceof|async|await|yield|type|interface|as|readonly|enum|namespace)\b)|(\b(?:true|false|null|undefined|NaN|Infinity)\b)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_$][A-Za-z0-9_$]*(?=\s*\())|([{}()[\].,;:?+\-*/%&|^~!=<>])/g;

  const elements: React.JSX.Element[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      elements.push(
        <span key={lastIndex} className="text-text">
          {line.slice(lastIndex, match.index)}
        </span>,
      );
    }

    const [full, comment, str, keyword, boolNull, number, fnCall, punct] = match;

    if (comment) {
      elements.push(
        <span key={match.index} className="syntax-comment">
          {comment}
        </span>,
      );
    } else if (str) {
      elements.push(
        <span key={match.index} className="syntax-string">
          {str}
        </span>,
      );
    } else if (keyword) {
      elements.push(
        <span key={match.index} className="syntax-keyword">
          {keyword}
        </span>,
      );
    } else if (boolNull) {
      elements.push(
        <span key={match.index} className="syntax-boolean">
          {boolNull}
        </span>,
      );
    } else if (number) {
      elements.push(
        <span key={match.index} className="syntax-number">
          {number}
        </span>,
      );
    } else if (fnCall) {
      elements.push(
        <span key={match.index} className="syntax-function">
          {fnCall}
        </span>,
      );
    } else if (punct) {
      elements.push(
        <span key={match.index} className="syntax-punctuation">
          {punct}
        </span>,
      );
    } else {
      elements.push(
        <span key={match.index} className="text-text">
          {full}
        </span>,
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    elements.push(
      <span key={lastIndex} className="text-text">
        {line.slice(lastIndex)}
      </span>,
    );
  }

  return <>{elements}</>;
}

export function CodeViewer({
  filePath,
  content,
  language = 'javascript',
  onAskSnippet,
  onCloseTab,
  activeTab = 'file',
  onTabChange,
  hasDiff = false,
}: CodeViewerProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const [selectedSnippet, setSelectedSnippet] = useState<string | null>(null);

  const lines = useMemo(() => content.split('\n'), [content]);
  const fileName = filePath.split('/').pop() || filePath;

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

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
    <div className="flex-1 flex flex-col bg-surface overflow-hidden min-w-0 font-mono select-none">
      {/* Top Tabs Bar phong cách Zed */}
      <div className="flex items-center justify-between border-b border-border bg-surface-2/40 px-2 pt-1.5 select-none">
        <div className="flex items-center gap-1 overflow-x-auto">
          {/* File Tab */}
          <button
            type="button"
            onClick={() => onTabChange?.('file')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-t-md border-t border-x transition-colors cursor-pointer ${
              activeTab === 'file'
                ? 'bg-surface border-border text-text font-semibold shadow-sm'
                : 'bg-transparent border-transparent text-muted hover:text-text hover:bg-surface-2/50'
            }`}
          >
            <span className="text-sm">📄</span>
            <span className="truncate max-w-[200px]">{fileName}</span>
            {onCloseTab && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab();
                }}
                className="ml-1 text-muted hover:text-text hover:bg-surface-2 p-0.5 rounded text-[10px]"
              >
                ✕
              </span>
            )}
          </button>

          {/* Diff Tab nếu có */}
          {hasDiff && (
            <button
              type="button"
              onClick={() => onTabChange?.('diff')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t-md border-t border-x transition-colors cursor-pointer ${
                activeTab === 'diff'
                  ? 'bg-surface border-border text-text font-semibold shadow-sm'
                  : 'bg-transparent border-transparent text-muted hover:text-text hover:bg-surface-2/50'
              }`}
            >
              <span className="text-xs">⚡</span>
              <span>{t('mh03.tabs.code')} (Diff)</span>
            </button>
          )}

          {/* Preview Tab */}
          <button
            type="button"
            onClick={() => onTabChange?.('preview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t-md border-t border-x transition-colors cursor-pointer ${
              activeTab === 'preview'
                ? 'bg-surface border-border text-text font-semibold shadow-sm'
                : 'bg-transparent border-transparent text-muted hover:text-text hover:bg-surface-2/50'
            }`}
          >
            <span className="text-xs">🌐</span>
            <span>{t('mh03.tabs.preview')}</span>
          </button>

          {/* Log Tab */}
          <button
            type="button"
            onClick={() => onTabChange?.('log')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t-md border-t border-x transition-colors cursor-pointer ${
              activeTab === 'log'
                ? 'bg-surface border-border text-text font-semibold shadow-sm'
                : 'bg-transparent border-transparent text-muted hover:text-text hover:bg-surface-2/50'
            }`}
          >
            <span className="text-xs">📜</span>
            <span>{t('mh03.tabs.detail')}</span>
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pb-1.5 pr-2">
          <button
            type="button"
            onClick={() => void handleCopy()}
            title="Sao chép toàn bộ code"
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-border bg-surface hover:bg-surface-2 text-muted hover:text-text cursor-pointer transition-colors"
          >
            <span>{copied ? '✓ Đã chép' : '📋 Chép code'}</span>
          </button>
        </div>
      </div>

      {/* Breadcrumb Bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-line bg-surface text-[12px] text-muted">
        <div className="flex items-center gap-1.5 truncate">
          <span className="text-muted/70">📁</span>
          <span className="font-mono text-text/90 truncate">{filePath}</span>
        </div>
        <div className="flex items-center gap-3 text-xs flex-none">
          <span>{`${lines.length} dòng`}</span>
          <span className="uppercase text-[11px] px-1.5 py-0.5 rounded bg-surface-2 border border-border">
            {language}
          </span>
        </div>
      </div>

      {/* Code Display Area */}
      <div
        className="flex-1 overflow-auto p-2 bg-surface text-[13px] leading-relaxed relative select-text"
        onMouseUp={handleMouseUp}
      >
        {selectedSnippet && onAskSnippet && (
          <div className="fixed z-50 shadow-pop">
            <button
              type="button"
              className="px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-md hover:opacity-90 transition-opacity shadow cursor-pointer flex items-center gap-1.5 animate-fade-in"
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

        <div className="table w-full border-collapse">
          {lines.map((line, idx) => {
            const lineNum = idx + 1;
            return (
              <div key={idx} className="table-row hover:bg-surface-2/70 transition-colors group">
                {/* Số dòng Line Number */}
                <span className="table-cell select-none text-right pr-4 pl-2 text-muted/50 group-hover:text-muted w-12 font-mono text-[12px] border-r border-line/40 align-top">
                  {lineNum}
                </span>

                {/* Nội dung dòng code */}
                <span className="table-cell pl-4 pr-4 whitespace-pre font-mono text-[13px] align-top text-text selection:bg-primary-soft selection:text-primary-ink">
                  {highlightLine(line, language)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status Bar phong cách Zed */}
      <footer className="flex items-center justify-between px-3 py-1 bg-surface-2 border-t border-border text-[11px] text-muted select-none">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span>CodeFleet Editor</span>
          </span>
          <span>Ln 1, Col 1</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="capitalize">{language}</span>
          <span>UTF-8</span>
        </div>
      </footer>
    </div>
  );
}
