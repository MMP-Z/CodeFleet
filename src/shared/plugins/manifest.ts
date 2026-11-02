import { z } from 'zod';

export const PLUGIN_KINDS = ['agent-adapter', 'skill-pack', 'template', 'mcp-server'] as const;
export type PluginKind = (typeof PLUGIN_KINDS)[number];

export const PLUGIN_PERMISSIONS = [
  'project:read',
  'project:write',
  'process:run',
  'network',
  'mcp:connect',
] as const;
export type PluginPermission = (typeof PLUGIN_PERMISSIONS)[number];

export const PluginPermissionSchema = z.enum(PLUGIN_PERMISSIONS);

export const PluginManifestSchema = z.object({
  id: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)*$/, {
      message: 'Plugin ID must be lowercase alphanumeric with dots/hyphens',
    }),
  name: z.string().min(1).max(100),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/, { message: 'Version must follow SemVer format' }),
  kind: z.enum(PLUGIN_KINDS),
  description: z.string().min(1).max(500),
  author: z.string().max(100).optional(),
  minAppVersion: z.string().optional(),
  permissions: z.array(PluginPermissionSchema).default([]),
  entry: z.string().min(1),
  checksum: z.string().min(1).optional(),
  icon: z.string().max(10).optional().default('🧩'),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  isCurated: z.boolean().optional().default(false),
  homepage: z.string().url().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

export type PluginStatus =
  | 'not_installed'
  | 'installed'
  | 'update_available'
  | 'corrupted'
  | 'disabled';

export interface PluginRecord {
  readonly id: string;
  readonly version: string;
  readonly kind: PluginKind;
  readonly enabled: boolean;
  readonly grantedPermissions: readonly PluginPermission[];
  readonly installedAt: string;
}

export interface PluginVM {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly installedVersion?: string;
  readonly kind: PluginKind;
  readonly description: string;
  readonly author?: string;
  readonly permissions: readonly PluginPermission[];
  readonly grantedPermissions?: readonly PluginPermission[];
  readonly isCurated: boolean;
  readonly icon: string;
  readonly color: string;
  readonly status: PluginStatus;
  readonly availableVersion?: string;
  readonly checksum: string;
  readonly errorDetail?: string | null;
}
