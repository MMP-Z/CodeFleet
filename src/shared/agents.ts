import { z } from 'zod';

/**
 * Định danh của một AI CLI adapter (đọc từ cấu hình/registry, không ghi cứng tên CLI ở tầng shared/renderer theo Luật P10).
 */
export const AgentIdSchema = z.string().min(1);
export type AgentId = z.infer<typeof AgentIdSchema>;

export const ModelTierSchema = z.enum(['strong', 'balanced', 'fast', 'unknown']);
export type ModelTier = z.infer<typeof ModelTierSchema>;

export const EditableModelTierSchema = z.enum(['strong', 'balanced', 'fast']);
export type EditableModelTier = z.infer<typeof EditableModelTierSchema>;

export const TierSourceSchema = z.enum(['default', 'user', 'unmapped']);
export type TierSource = z.infer<typeof TierSourceSchema>;

export const ModelRefSchema = z.object({
  agentId: AgentIdSchema,
  model: z.string().nullable(),
});
export type ModelRef = z.infer<typeof ModelRefSchema>;

export const ModelInfoSchema = z.object({
  id: z.string().min(1),
  agentId: AgentIdSchema,
  agentDisplayName: z.string().min(1),
  label: z.string().min(1),
  tier: ModelTierSchema,
  tierSource: TierSourceSchema,
});
export type ModelInfo = z.infer<typeof ModelInfoSchema>;

export const CliStatusSchema = z.enum([
  'checking',
  'ready',
  'not_logged_in',
  'not_installed',
  'error',
]);
export type CliStatus = z.infer<typeof CliStatusSchema>;

export const DetectResultSchema = z.object({
  agentId: AgentIdSchema,
  displayName: z.string().min(1),
  shortName: z.string().min(1),
  logoLetter: z.string().min(1),
  color: z.string().min(1),
  darkColor: z.string().min(1),
  docsUrl: z.string().url(),
  installCommand: z.string().min(1),
  loginCommand: z.string().min(1),
  installed: z.boolean(),
  version: z.string().nullable(),
  loggedIn: z.boolean(),
  status: CliStatusSchema,
  errorDetail: z.string().nullable(),
  modelsCount: z.number().int().nonnegative(),
});
export type DetectResult = z.infer<typeof DetectResultSchema>;

export const QuotaWindowSchema = z.object({
  label: z.string(),
  usedPercent: z.number().nullable(),
  resetsAt: z.string().nullable(),
});
export type QuotaWindow = z.infer<typeof QuotaWindowSchema>;

export const QuotaSnapshotSchema = z.object({
  agentId: AgentIdSchema,
  model: z.string().nullable(),
  scope: z.enum(['shared', 'model', 'unknown']),
  windows: z.array(QuotaWindowSchema),
  status: z.enum(['ok', 'low', 'exhausted', 'unknown']),
  source: z.enum(['official', 'estimated', 'detected', 'unknown']),
  updatedAt: z.string(),
});
export type QuotaSnapshot = z.infer<typeof QuotaSnapshotSchema>;
