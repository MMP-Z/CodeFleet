import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { EditableModelTierSchema, ModelTierSchema } from '@shared/agents';
import type {
  AgentId,
  DiscoveredModel,
  EditableModelTier,
  ModelInfo,
  ModelTier,
  TierSource,
} from './types';

const DefaultModelCatalogItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  tier: EditableModelTierSchema,
});

const PatternTierSchema = z.object({
  contains: z.string().min(1),
  tier: EditableModelTierSchema,
});

const InstallCommandSchema = z.union([z.string().min(1), z.record(z.string(), z.string())]);

const AgentCatalogEntrySchema = z.object({
  displayName: z.string().min(1),
  shortName: z.string().min(1).optional(),
  logoLetter: z.string().min(1),
  color: z.string().min(1),
  darkColor: z.string().min(1),
  docsUrl: z.string().url(),
  installCommand: InstallCommandSchema,
  loginCommand: z.string().min(1),
  models: z.array(DefaultModelCatalogItemSchema),
  patternTiers: z.array(PatternTierSchema).optional(),
});

export type AgentCatalogEntry = z.infer<typeof AgentCatalogEntrySchema>;

const DefaultCatalogFileSchema = z.object({
  schemaVersion: z.number().int().positive(),
  updatedAt: z.string(),
  agents: z.record(z.string(), AgentCatalogEntrySchema),
});

const UserOverridesFileSchema = z.object({
  schemaVersion: z.literal(1),
  overrides: z.record(z.string(), z.record(z.string(), EditableModelTierSchema)),
});

interface ModelRow {
  agent_id: string;
  model_id: string;
  label: string;
  tier: string;
  available: number;
  detected_at: string;
}

export interface ModelTierServiceOptions {
  db: Database.Database;
  userDataDir: string;
  defaultConfigPath?: string;
}

function resolveDefaultConfigPath(explicitPath?: string): string {
  if (explicitPath && fs.existsSync(explicitPath)) {
    return explicitPath;
  }
  const candidates = [
    path.resolve(process.cwd(), 'resources', 'model-tiers.default.json'),
    path.resolve(__dirname, '../../resources/model-tiers.default.json'),
    path.resolve(__dirname, '../../../resources/model-tiers.default.json'),
  ];
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  if (resourcesPath) {
    candidates.push(path.join(resourcesPath, 'resources', 'model-tiers.default.json'));
    candidates.push(path.join(resourcesPath, 'model-tiers.default.json'));
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error('Could not locate resources/model-tiers.default.json');
}

/**
 * Dịch vụ quản lý danh mục model và ánh xạ bậc (Mạnh / Cân bằng / Nhanh / Chưa xếp bậc)
 * theo Luật P10 và ADR-019.
 */
export class ModelTierService {
  private readonly db: Database.Database;
  private readonly userConfigPath: string;
  private readonly defaultCatalog: z.infer<typeof DefaultCatalogFileSchema>;

  public constructor(options: ModelTierServiceOptions) {
    this.db = options.db;
    this.userConfigPath = path.join(options.userDataDir, 'model-tiers.user.json');
    const defaultPath = resolveDefaultConfigPath(options.defaultConfigPath);
    const rawJson = fs.readFileSync(defaultPath, 'utf8');
    this.defaultCatalog = DefaultCatalogFileSchema.parse(JSON.parse(rawJson));
  }

  public getKnownAgentIds(): AgentId[] {
    return Object.keys(this.defaultCatalog.agents);
  }

  public getAgentCatalogConfig(agentId: AgentId): AgentCatalogEntry {
    const entry = this.defaultCatalog.agents[agentId];
    if (!entry) {
      throw new Error(`Unknown agentId in model-tiers.default.json: ${agentId}`);
    }
    return entry;
  }

  public getCatalogDefaultModels(agentId: AgentId): DiscoveredModel[] {
    const entry = this.defaultCatalog.agents[agentId];
    if (!entry) {
      return [];
    }
    return entry.models.map((m) => ({ id: m.id, label: m.label }));
  }

  private readUserOverrides(): Record<string, Record<string, EditableModelTier>> {
    if (!fs.existsSync(this.userConfigPath)) {
      return {};
    }
    try {
      const raw = fs.readFileSync(this.userConfigPath, 'utf8');
      const parsed = UserOverridesFileSchema.parse(JSON.parse(raw));
      return parsed.overrides;
    } catch {
      return {};
    }
  }

  private writeUserOverrides(overrides: Record<string, Record<string, EditableModelTier>>): void {
    fs.mkdirSync(path.dirname(this.userConfigPath), { recursive: true });
    const payload: z.infer<typeof UserOverridesFileSchema> = {
      schemaVersion: 1,
      overrides,
    };
    fs.writeFileSync(this.userConfigPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  public getInstallCommand(agentId: AgentId, platform: string = process.platform): string {
    const entry = this.getAgentCatalogConfig(agentId);
    if (typeof entry.installCommand === 'string') {
      return entry.installCommand;
    }
    return (
      entry.installCommand[platform] ??
      entry.installCommand['win32'] ??
      Object.values(entry.installCommand)[0] ??
      ''
    );
  }

  public getAgentShortName(agentId: AgentId): string {
    const entry = this.defaultCatalog.agents[agentId];
    return entry?.shortName ?? entry?.displayName?.split(' ')[0] ?? agentId;
  }

  public resolveModelInfo(agentId: AgentId, discovered: { id: string; label?: string }): ModelInfo {
    const agentEntry = this.defaultCatalog.agents[agentId];
    const agentDisplayName = agentEntry?.displayName ?? agentId;
    const defaultItem = agentEntry?.models.find((m) => m.id === discovered.id);
    const userOverrides = this.readUserOverrides();
    const userTier = userOverrides[agentId]?.[discovered.id];

    let tier: ModelTier = 'unknown';
    let tierSource: TierSource = 'unmapped';

    if (userTier) {
      tier = userTier;
      tierSource = 'user';
    } else if (defaultItem) {
      tier = defaultItem.tier;
      tierSource = 'default';
    } else if ('tier' in discovered && discovered.tier && discovered.tier !== 'unknown') {
      tier = discovered.tier as ModelTier;
      tierSource = 'default';
    } else if (agentEntry?.patternTiers) {
      const lowerId = discovered.id.toLowerCase();
      const matchedPattern = agentEntry.patternTiers.find((p) =>
        lowerId.includes(p.contains.toLowerCase()),
      );
      if (matchedPattern) {
        tier = matchedPattern.tier;
        tierSource = 'default';
      }
    }

    const label = discovered.label ?? defaultItem?.label ?? discovered.id;

    return {
      id: discovered.id,
      agentId,
      agentDisplayName,
      label,
      tier,
      tierSource,
    };
  }

  /**
   * Đồng bộ danh sách model do CLI báo vào bảng SQLite `models` và trả về `ModelInfo[]`.
   */
  public syncAgentModels(agentId: AgentId, discoveredModels: DiscoveredModel[]): ModelInfo[] {
    const now = new Date().toISOString();
    const resolved = discoveredModels.map((m) => this.resolveModelInfo(agentId, m));

    const upsertStmt = this.db.prepare(`
      INSERT INTO models (agent_id, model_id, label, tier, available, detected_at)
      VALUES (@agent_id, @model_id, @label, @tier, 1, @detected_at)
      ON CONFLICT(agent_id, model_id) DO UPDATE SET
        label = excluded.label,
        tier = excluded.tier,
        available = 1,
        detected_at = excluded.detected_at
    `);

    const tx = this.db.transaction((items: ModelInfo[]) => {
      if (items.length > 0) {
        const placeholders = items.map(() => '?').join(',');
        this.db
          .prepare(`DELETE FROM models WHERE agent_id = ? AND model_id NOT IN (${placeholders})`)
          .run(agentId, ...items.map((i) => i.id));
      }
      for (const item of items) {
        upsertStmt.run({
          agent_id: item.agentId,
          model_id: item.id,
          label: item.label,
          tier: item.tier,
          detected_at: now,
        });
      }
    });
    tx(resolved);

    return resolved;
  }

  /**
   * Đảm bảo các model mặc định trong cấu hình đã có mặt trong bảng `models` nếu chưa từng quét.
   */
  public ensureCatalogSeeded(): void {
    // Dọn dẹp triệt để các model giả cũ nếu còn tồn tại trong DB
    this.db
      .prepare(
        `
      DELETE FROM models 
      WHERE agent_id = 'codex' 
        AND model_id IN ('gpt-5-codex', 'codex-mini-latest')
    `,
      )
      .run();

    for (const agentId of this.getKnownAgentIds()) {
      const agentCount = this.db
        .prepare('SELECT COUNT(*) AS cnt FROM models WHERE agent_id = ?')
        .get(agentId) as {
        cnt: number;
      };
      if (agentCount.cnt === 0) {
        const defaults = this.getCatalogDefaultModels(agentId);
        this.syncAgentModels(agentId, defaults);
      }
    }
  }

  /**
   * Liệt kê toàn bộ model đã ghi nhận trong bảng `models` (hoặc của riêng một `agentId`),
   * kết hợp với cấu hình mặc định và ghi đè của người dùng.
   */
  public listModels(agentId?: AgentId): ModelInfo[] {
    this.ensureCatalogSeeded();
    const rows = (
      agentId
        ? this.db
            .prepare(
              'SELECT agent_id, model_id, label, tier, available, detected_at FROM models WHERE agent_id = ? AND available = 1 ORDER BY rowid ASC',
            )
            .all(agentId)
        : this.db
            .prepare(
              'SELECT agent_id, model_id, label, tier, available, detected_at FROM models WHERE available = 1 ORDER BY rowid ASC',
            )
            .all()
    ) as ModelRow[];

    return rows.map((row) => {
      const info = this.resolveModelInfo(row.agent_id, {
        id: row.model_id,
        label: row.label,
      });
      // Nếu trong DB có tier đã lưu khác và chưa có trong catalog, vẫn ưu tiên logic resolveModelInfo
      const parsedDbTier = ModelTierSchema.safeParse(row.tier);
      if (
        info.tierSource === 'unmapped' &&
        parsedDbTier.success &&
        parsedDbTier.data !== 'unknown'
      ) {
        return {
          ...info,
          tier: parsedDbTier.data,
          tierSource: 'user',
        };
      }
      return info;
    });
  }

  /**
   * Cho phép người dùng đổi bậc của một model ở MH-11 "Nâng cao: bậc model và ghim model".
   */
  public setModelTier(agentId: AgentId, modelId: string, tier: EditableModelTier): ModelInfo {
    const validTier = EditableModelTierSchema.parse(tier);
    const overrides = this.readUserOverrides();
    const agentOverrides = overrides[agentId] ?? {};
    agentOverrides[modelId] = validTier;
    overrides[agentId] = agentOverrides;
    this.writeUserOverrides(overrides);

    const existingRow = this.db
      .prepare('SELECT label FROM models WHERE agent_id = ? AND model_id = ?')
      .get(agentId, modelId) as { label: string } | undefined;

    const info = this.resolveModelInfo(agentId, {
      id: modelId,
      label: existingRow?.label,
    });

    this.db
      .prepare(
        `
        INSERT INTO models (agent_id, model_id, label, tier, available, detected_at)
        VALUES (@agent_id, @model_id, @label, @tier, 1, @detected_at)
        ON CONFLICT(agent_id, model_id) DO UPDATE SET
          tier = excluded.tier,
          detected_at = excluded.detected_at
      `,
      )
      .run({
        agent_id: agentId,
        model_id: modelId,
        label: info.label,
        tier: validTier,
        detected_at: new Date().toISOString(),
      });

    return info;
  }
}
