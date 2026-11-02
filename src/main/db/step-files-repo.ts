import crypto from 'node:crypto';
import type Database from 'better-sqlite3';

export type FileChangeType = 'added' | 'modified' | 'deleted';

export interface StepFileRecord {
  readonly id: string;
  readonly stepId: string;
  readonly path: string;
  readonly change: FileChangeType;
  readonly riskTags: readonly string[] | null;
  readonly diffSummary: string | null;
  readonly fullDiff: string | null;
}

interface RawStepFileRow {
  id: string;
  step_id: string;
  path: string;
  change: string;
  risk_tags: string | null;
  diff_summary: string | null;
  full_diff: string | null;
}

export class StepFilesRepository {
  private readonly db: Database.Database;

  public constructor(db: Database.Database) {
    this.db = db;
  }

  public upsert(input: {
    readonly id?: string;
    readonly stepId: string;
    readonly path: string;
    readonly change: FileChangeType;
    readonly riskTags?: readonly string[] | null;
    readonly diffSummary?: string | null;
    readonly fullDiff?: string | null;
  }): StepFileRecord {
    const existing = this.getByPath(input.stepId, input.path);
    const id = existing?.id ?? input.id ?? crypto.randomUUID();
    const riskTagsJson = input.riskTags ? JSON.stringify(input.riskTags) : null;

    if (existing) {
      const stmt = this.db.prepare<
        [string, string | null, string | null, string | null, string, string]
      >(`
        UPDATE step_files
        SET change = ?, risk_tags = ?, diff_summary = ?, full_diff = ?
        WHERE step_id = ? AND path = ?
      `);
      stmt.run(
        input.change,
        riskTagsJson,
        input.diffSummary ?? null,
        input.fullDiff ?? null,
        input.stepId,
        input.path,
      );
    } else {
      const stmt = this.db.prepare<
        [string, string, string, string, string | null, string | null, string | null]
      >(`
        INSERT INTO step_files (id, step_id, path, change, risk_tags, diff_summary, full_diff)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        id,
        input.stepId,
        input.path,
        input.change,
        riskTagsJson,
        input.diffSummary ?? null,
        input.fullDiff ?? null,
      );
    }

    return {
      id,
      stepId: input.stepId,
      path: input.path,
      change: input.change,
      riskTags: input.riskTags ?? null,
      diffSummary: input.diffSummary ?? null,
      fullDiff: input.fullDiff ?? null,
    };
  }

  public listByStep(stepId: string): StepFileRecord[] {
    const stmt = this.db.prepare<[string], RawStepFileRow>(`
      SELECT id, step_id, path, change, risk_tags, diff_summary, full_diff
      FROM step_files
      WHERE step_id = ?
      ORDER BY path ASC
    `);
    const rows = stmt.all(stepId);
    return rows.map((r) => this.mapRow(r));
  }

  public getByPath(stepId: string, filePath: string): StepFileRecord | null {
    const stmt = this.db.prepare<[string, string], RawStepFileRow>(`
      SELECT id, step_id, path, change, risk_tags, diff_summary, full_diff
      FROM step_files
      WHERE step_id = ? AND path = ?
      LIMIT 1
    `);
    const row = stmt.get(stepId, filePath);
    return row ? this.mapRow(row) : null;
  }

  private mapRow(row: RawStepFileRow): StepFileRecord {
    let parsedTags: string[] | null = null;
    if (row.risk_tags) {
      try {
        parsedTags = JSON.parse(row.risk_tags) as string[];
      } catch {
        parsedTags = null;
      }
    }
    return {
      id: row.id,
      stepId: row.step_id,
      path: row.path,
      change: row.change as FileChangeType,
      riskTags: parsedTags,
      diffSummary: row.diff_summary,
      fullDiff: row.full_diff,
    };
  }
}
