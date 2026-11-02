import fs from 'node:fs';
import path from 'node:path';
import { redactSensitiveText, redactUnknown } from './redactor';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LogEntry {
  readonly at: string;
  readonly level: LogLevel;
  readonly scope: string;
  readonly message: string;
  readonly meta?: unknown;
}

export interface Logger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
  child(subScope: string): Logger;
  getLogFilePath(): string;
}

export interface LoggerOptions {
  readonly logDir: string;
  readonly fileName?: string;
  readonly minLevel?: LogLevel;
  readonly scope?: string;
  readonly mirrorToConsole?: boolean;
}

export function createLogger(options: LoggerOptions): Logger {
  const fileName = options.fileName ?? 'codefleet.log';
  const minLevel = options.minLevel ?? 'info';
  const scope = options.scope ?? 'app';
  const mirrorToConsole = options.mirrorToConsole ?? false;
  const logFilePath = path.join(options.logDir, fileName);

  function write(level: LogLevel, currentScope: string, message: string, meta?: unknown): void {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[minLevel]) {
      return;
    }

    const entry: LogEntry = {
      at: new Date().toISOString(),
      level,
      scope: currentScope,
      message: redactSensitiveText(message),
      ...(meta !== undefined ? { meta: redactUnknown(meta) } : {}),
    };

    try {
      fs.mkdirSync(options.logDir, { recursive: true });
      fs.appendFileSync(logFilePath, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch {
      // Không làm sập ứng dụng nếu ổ đĩa không ghi được log
    }

    if (mirrorToConsole) {
      const formatted = `[${entry.at}] [${entry.level.toUpperCase()}] [${entry.scope}] ${entry.message}`;
      if (level === 'error') {
        console.error(formatted);
      } else if (level === 'warn') {
        console.warn(formatted);
      } else {
        console.log(formatted);
      }
    }
  }

  function makeScoped(currentScope: string): Logger {
    return {
      debug: (msg, meta) => write('debug', currentScope, msg, meta),
      info: (msg, meta) => write('info', currentScope, msg, meta),
      warn: (msg, meta) => write('warn', currentScope, msg, meta),
      error: (msg, meta) => write('error', currentScope, msg, meta),
      child: (subScope) => makeScoped(`${currentScope}:${subScope}`),
      getLogFilePath: () => logFilePath,
    };
  }

  return makeScoped(scope);
}

