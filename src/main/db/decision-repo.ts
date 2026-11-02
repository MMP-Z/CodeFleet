import crypto from 'node:crypto';
import type Database from 'better-sqlite3';

export type DecisionKind = 'approach' | 'pick' | 'switch';

export interface DecisionRecord {
  readonly id: string;
  readonly stepId: string | null;
  readonly projectId: string;
  readonly kind: DecisionKind;
  readonly text: string;
  readonly createdAt: string;
}

interface RawDecisionRow {
  id: string;
  step_id: string | null;
  project_id: string;
  kind: string;
  text: string;
  created_at: string;
}

export class DecisionRepository {
  private readonly db: Database.Database;

  public constructor(db: Database.Database) {
    this.db = db;
  }

  public add(input: {
    readonly stepId?: string | null;
    readonly projectId: string;
    readonly kind: DecisionKind;
    readonly text: string;
    readonly createdAt?: string;
  }): DecisionRecord {
    const id = crypto.randomUUID();
    const createdAt = input.createdAt ?? new Date().toISOString();
    const stmt = this.db.prepare<[string, string | null, string, string, string, string]>(`
      INSERT INTO decisions (id, step_id, project_id, kind, text, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, input.stepId ?? null, input.projectId, input.kind, input.text, createdAt);

    return {
      id,
      stepId: input.stepId ?? null,
      projectId: input.projectId,
      kind: input.kind,
      text: input.text,
      createdAt,
    };
  }

  public listByProject(projectId: string, kind?: DecisionKind): DecisionRecord[] {
    if (kind) {
      const stmt = this.db.prepare<[string, string], RawDecisionRow>(`
        SELECT id, step_id, project_id, kind, text, created_at
        FROM decisions
        WHERE project_id = ? AND kind = ?
        ORDER BY created_at DESC
      `);
      return stmt.all(projectId, kind).map((r) => this.mapRow(r));
    }

    const stmt = this.db.prepare<[string], RawDecisionRow>(`
      SELECT id, step_id, project_id, kind, text, created_at
      FROM decisions
      WHERE project_id = ?
      ORDER BY created_at DESC
    `);
    return stmt.all(projectId).map((r) => this.mapRow(r));
  }

  public listByStep(stepId: string): DecisionRecord[] {
    const stmt = this.db.prepare<[string], RawDecisionRow>(`
      SELECT id, step_id, project_id, kind, text, created_at
      FROM decisions
      WHERE step_id = ?
      ORDER BY created_at ASC
    `);
    return stmt.all(stepId).map((r) => this.mapRow(r));
  }

  public getLatestForStep(stepId: string, kind?: DecisionKind): DecisionRecord | null {
    if (kind) {
      const stmt = this.db.prepare<[string, string], RawDecisionRow>(`
        SELECT id, step_id, project_id, kind, text, created_at
        FROM decisions
        WHERE step_id = ? AND kind = ?
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const row = stmt.get(stepId, kind);
      return row ? this.mapRow(row) : null;
    }

    const stmt = this.db.prepare<[string], RawDecisionRow>(`
      SELECT id, step_id, project_id, kind, text, created_at
      FROM decisions
      WHERE step_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const row = stmt.get(stepId);
    return row ? this.mapRow(row) : null;
  }

  private mapRow(row: RawDecisionRow): DecisionRecord {
    return {
      id: row.id,
      stepId: row.step_id,
      projectId: row.project_id,
      kind: row.kind as DecisionKind,
      text: row.text,
      createdAt: row.created_at,
    };
  }
}
