import crypto from 'node:crypto';
import type Database from 'better-sqlite3';

export interface ProjectMapRecord {
  readonly id: string;
  readonly projectId: string;
  readonly feature: string;
  readonly description: string | null;
  readonly files: readonly string[];
  readonly isSensitive?: boolean;
  readonly updatedAt: string;
}

interface RawProjectMapRow {
  id: string;
  project_id: string;
  feature: string;
  description: string | null;
  files: string;
  updated_at: string;
}

export class ProjectMapRepository {
  private readonly db: Database.Database;

  public constructor(db: Database.Database) {
    this.db = db;
  }

  public upsertFeature(input: {
    readonly projectId: string;
    readonly feature: string;
    readonly description?: string | null;
    readonly files: readonly string[];
    readonly isSensitive?: boolean;
    readonly updatedAt?: string;
  }): ProjectMapRecord {
    const existing = this.getByFeature(input.projectId, input.feature);
    const id = existing?.id ?? crypto.randomUUID();
    const updatedAt = input.updatedAt ?? new Date().toISOString();
    const filesJson = JSON.stringify(input.files);

    if (existing) {
      const stmt = this.db.prepare<[string | null, string, string, string]>(`
        UPDATE project_map
        SET description = ?, files = ?, updated_at = ?
        WHERE id = ?
      `);
      stmt.run(input.description ?? null, filesJson, updatedAt, id);
    } else {
      const stmt = this.db.prepare<[string, string, string, string | null, string, string]>(`
        INSERT INTO project_map (id, project_id, feature, description, files, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(id, input.projectId, input.feature, input.description ?? null, filesJson, updatedAt);
    }

    return {
      id,
      projectId: input.projectId,
      feature: input.feature,
      description: input.description ?? null,
      files: input.files,
      isSensitive: input.isSensitive ?? false,
      updatedAt,
    };
  }

  public listByProject(projectId: string): ProjectMapRecord[] {
    const stmt = this.db.prepare<[string], RawProjectMapRow>(`
      SELECT id, project_id, feature, description, files, updated_at
      FROM project_map
      WHERE project_id = ?
      ORDER BY updated_at DESC
    `);
    const rows = stmt.all(projectId);
    return rows.map((r) => this.mapRow(r));
  }

  public getByFeature(projectId: string, feature: string): ProjectMapRecord | null {
    const stmt = this.db.prepare<[string, string], RawProjectMapRow>(`
      SELECT id, project_id, feature, description, files, updated_at
      FROM project_map
      WHERE project_id = ? AND feature = ?
      LIMIT 1
    `);
    const row = stmt.get(projectId, feature);
    return row ? this.mapRow(row) : null;
  }

  private mapRow(row: RawProjectMapRow): ProjectMapRecord {
    let files: string[] = [];
    try {
      files = JSON.parse(row.files) as string[];
    } catch {
      files = [];
    }
    return {
      id: row.id,
      projectId: row.project_id,
      feature: row.feature,
      description: row.description,
      files,
      updatedAt: row.updated_at,
    };
  }
}
