import crypto from 'node:crypto';
import type Database from 'better-sqlite3';

export interface UserEditRecord {
  readonly id: string;
  readonly projectId: string;
  readonly path: string;
  readonly contentHash: string;
  readonly editedAt: string;
}

interface RawUserEditRow {
  id: string;
  project_id: string;
  path: string;
  content_hash: string;
  edited_at: string;
}

export class UserEditsRepository {
  private readonly db: Database.Database;

  public constructor(db: Database.Database) {
    this.db = db;
  }

  public recordEdit(input: {
    readonly projectId: string;
    readonly path: string;
    readonly contentHash: string;
    readonly editedAt?: string;
  }): UserEditRecord {
    const id = crypto.randomUUID();
    const editedAt = input.editedAt ?? new Date().toISOString();

    const stmt = this.db.prepare<[string, string, string, string, string]>(`
      INSERT INTO user_edits (id, project_id, path, content_hash, edited_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, input.projectId, input.path, input.contentHash, editedAt);

    return {
      id,
      projectId: input.projectId,
      path: input.path,
      contentHash: input.contentHash,
      editedAt,
    };
  }

  public listByProject(projectId: string): UserEditRecord[] {
    const stmt = this.db.prepare<[string], RawUserEditRow>(`
      SELECT id, project_id, path, content_hash, edited_at
      FROM user_edits
      WHERE project_id = ?
      ORDER BY edited_at DESC
    `);
    const rows = stmt.all(projectId);
    return rows.map((r) => this.mapRow(r));
  }

  public getLatestForFile(projectId: string, filePath: string): UserEditRecord | null {
    const stmt = this.db.prepare<[string, string], RawUserEditRow>(`
      SELECT id, project_id, path, content_hash, edited_at
      FROM user_edits
      WHERE project_id = ? AND path = ?
      ORDER BY edited_at DESC
      LIMIT 1
    `);
    const row = stmt.get(projectId, filePath);
    return row ? this.mapRow(row) : null;
  }

  private mapRow(row: RawUserEditRow): UserEditRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      path: row.path,
      contentHash: row.content_hash,
      editedAt: row.edited_at,
    };
  }
}
