import crypto from 'node:crypto';
import type Database from 'better-sqlite3';

export interface CheckpointRecord {
  readonly id: string;
  readonly projectId: string;
  readonly stepId: string | null;
  readonly gitHash: string;
  readonly createdAt: string;
  readonly description: string | null;
}

interface RawCheckpointRow {
  id: string;
  project_id: string;
  step_id: string | null;
  git_hash: string;
  created_at: string;
  description: string | null;
}

export class CheckpointRepository {
  private readonly db: Database.Database;

  public constructor(db: Database.Database) {
    this.db = db;
  }

  public create(input: {
    readonly projectId: string;
    readonly stepId?: string | null;
    readonly gitHash: string;
    readonly createdAt?: string;
    readonly description?: string | null;
  }): CheckpointRecord {
    const id = crypto.randomUUID();
    const createdAt = input.createdAt ?? new Date().toISOString();

    const stmt = this.db.prepare<[string, string, string | null, string, string, string | null]>(`
      INSERT INTO checkpoints (id, project_id, step_id, git_hash, created_at, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      input.projectId,
      input.stepId ?? null,
      input.gitHash,
      createdAt,
      input.description ?? null,
    );

    return {
      id,
      projectId: input.projectId,
      stepId: input.stepId ?? null,
      gitHash: input.gitHash,
      createdAt,
      description: input.description ?? null,
    };
  }

  public listByProject(projectId: string): CheckpointRecord[] {
    const stmt = this.db.prepare<[string], RawCheckpointRow>(`
      SELECT id, project_id, step_id, git_hash, created_at, description
      FROM checkpoints
      WHERE project_id = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(projectId);
    return rows.map((r) => this.mapRow(r));
  }

  public getById(id: string): CheckpointRecord | null {
    const stmt = this.db.prepare<[string], RawCheckpointRow>(`
      SELECT id, project_id, step_id, git_hash, created_at, description
      FROM checkpoints
      WHERE id = ?
      LIMIT 1
    `);
    const row = stmt.get(id);
    return row ? this.mapRow(row) : null;
  }

  public getLatestForProject(projectId: string): CheckpointRecord | null {
    const stmt = this.db.prepare<[string], RawCheckpointRow>(`
      SELECT id, project_id, step_id, git_hash, created_at, description
      FROM checkpoints
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const row = stmt.get(projectId);
    return row ? this.mapRow(row) : null;
  }

  private mapRow(row: RawCheckpointRow): CheckpointRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      stepId: row.step_id,
      gitHash: row.git_hash,
      createdAt: row.created_at,
      description: row.description,
    };
  }
}
