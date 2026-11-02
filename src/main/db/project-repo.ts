import crypto from 'node:crypto';
import type Database from 'better-sqlite3';

export interface ProjectRecord {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly createdAt: string;
  readonly lastOpened: string | null;
}

interface RawProjectRow {
  id: string;
  name: string;
  path: string;
  created_at: string;
  last_opened: string | null;
}

export class ProjectRepository {
  private readonly db: Database.Database;

  public constructor(db: Database.Database) {
    this.db = db;
  }

  public list(): ProjectRecord[] {
    const stmt = this.db.prepare<[], RawProjectRow>(`
      SELECT id, name, path, created_at, last_opened
      FROM projects
      ORDER BY 
        CASE WHEN last_opened IS NULL THEN 0 ELSE 1 END DESC,
        last_opened DESC,
        created_at DESC
    `);
    const rows = stmt.all();
    return rows.map((r) => this.mapRow(r));
  }

  public getById(id: string): ProjectRecord | null {
    const stmt = this.db.prepare<[string], RawProjectRow>(`
      SELECT id, name, path, created_at, last_opened
      FROM projects
      WHERE id = ?
    `);
    const row = stmt.get(id);
    return row ? this.mapRow(row) : null;
  }

  public getByPath(projectPath: string): ProjectRecord | null {
    const stmt = this.db.prepare<[string], RawProjectRow>(`
      SELECT id, name, path, created_at, last_opened
      FROM projects
      WHERE path = ?
    `);
    const row = stmt.get(projectPath);
    return row ? this.mapRow(row) : null;
  }

  public create(input: { id?: string; name: string; path: string }): ProjectRecord {
    const id = input.id ?? crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const lastOpened = createdAt;

    const stmt = this.db.prepare<[string, string, string, string, string]>(`
      INSERT INTO projects (id, name, path, created_at, last_opened)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, input.name, input.path, createdAt, lastOpened);

    return {
      id,
      name: input.name,
      path: input.path,
      createdAt,
      lastOpened,
    };
  }

  public touchLastOpened(id: string): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare<[string, string]>(`
      UPDATE projects
      SET last_opened = ?
      WHERE id = ?
    `);
    stmt.run(now, id);
  }

  public updateName(id: string, name: string): void {
    const stmt = this.db.prepare<[string, string]>(`
      UPDATE projects
      SET name = ?
      WHERE id = ?
    `);
    stmt.run(name, id);
  }

  public delete(id: string): void {
    const stmt = this.db.prepare<[string]>(`
      DELETE FROM projects
      WHERE id = ?
    `);
    stmt.run(id);
  }

  private mapRow(row: RawProjectRow): ProjectRecord {
    return {
      id: row.id,
      name: row.name,
      path: row.path,
      createdAt: row.created_at,
      lastOpened: row.last_opened,
    };
  }
}
