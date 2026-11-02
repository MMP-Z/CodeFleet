import type { z } from 'zod';
import type { IpcContract, IpcResult } from '@shared/ipc';
import type { Logger } from '../logger/logger';
import { redactSensitiveText } from '../logger/redactor';

export interface IpcRegistrar {
  handle(
    channel: string,
    listener: (_event: unknown, rawInput: unknown) => Promise<unknown>,
  ): void;
}

/**
 * Đăng ký handler IPC có kiểm tra Zod cả đầu vào lẫn đầu ra (Luật P3).
 */
export function registerTypedHandler<I extends z.ZodTypeAny, O extends z.ZodTypeAny>(
  registrar: IpcRegistrar,
  contract: IpcContract<I, O>,
  handler: (input: z.infer<I>) => Promise<z.infer<O>> | z.infer<O>,
  logger?: Logger,
): void {
  registrar.handle(contract.channel, async (_event, rawInput): Promise<IpcResult<z.infer<O>>> => {
    const parsedInput = contract.input.safeParse(rawInput);
    if (!parsedInput.success) {
      const reason = parsedInput.error.issues
        .map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
        .join('; ');
      logger?.warn(`IPC input validation failed on ${contract.channel}`, { reason });
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: redactSensitiveText(reason),
        },
      };
    }

    try {
      const rawOutput = await handler(parsedInput.data);
      const validatedOutput = contract.output.parse(rawOutput);
      return {
        ok: true,
        data: validatedOutput,
      };
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : String(err);
      const safeMessage = redactSensitiveText(rawMessage);
      logger?.error(`IPC handler error on ${contract.channel}`, { err });
      return {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: safeMessage,
        },
      };
    }
  });
}

