import { z } from 'zod';

export type UpdateStatus =
  'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

export type UpdateChannel = 'stable' | 'beta';

export interface UpdateProgress {
  readonly percent: number;
  readonly bytesPerSecond: number;
  readonly transferred: number;
  readonly total: number;
}

export interface UpdateState {
  readonly status: UpdateStatus;
  readonly currentVersion: string;
  readonly channel: UpdateChannel;
  readonly autoDownload: boolean;
  readonly availableVersion: string | null;
  readonly releaseDate: string | null;
  readonly releaseNotes: string | null;
  readonly downloadProgress: UpdateProgress | null;
  readonly lastCheckedAt: string | null;
  readonly error: string | null;
}

export interface UpdateCheckResult {
  readonly hasUpdate: boolean;
  readonly version: string | null;
  readonly releaseNotes: string | null;
}

export const UpdateProgressSchema = z.object({
  percent: z.number().min(0).max(100),
  bytesPerSecond: z.number().nonnegative(),
  transferred: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

export const UpdateStateSchema = z.object({
  status: z.enum([
    'idle',
    'checking',
    'available',
    'not-available',
    'downloading',
    'downloaded',
    'error',
  ]),
  currentVersion: z.string(),
  channel: z.enum(['stable', 'beta']),
  autoDownload: z.boolean(),
  availableVersion: z.string().nullable(),
  releaseDate: z.string().nullable(),
  releaseNotes: z.string().nullable(),
  downloadProgress: UpdateProgressSchema.nullable(),
  lastCheckedAt: z.string().nullable(),
  error: z.string().nullable(),
});

export const UpdateCheckResultSchema = z.object({
  hasUpdate: z.boolean(),
  version: z.string().nullable(),
  releaseNotes: z.string().nullable(),
});
