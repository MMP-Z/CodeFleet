import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import type {
  QuotaScope,
  QuotaSnapshot,
  QuotaSource,
  QuotaStatus,
  QuotaWindow,
} from '../../shared/ipc/contracts';

interface RawQuotaRow {
  id: string;
  agent_id: string;
  model: string | null;
  plan: string | null;
  scope: string;
  windows: string;
  status: string;
  source: string;
  captured_at: string;
}

export class QuotaRepository {
  private readonly db: Database.Database;

  public constructor(db: Database.Database) {
    this.db = db;
  }

  public save(snapshot: Omit<QuotaSnapshot, 'id'> & { id?: string }): QuotaSnapshot {
    const id = snapshot.id ?? crypto.randomUUID();
    const capturedAt = snapshot.capturedAt ?? new Date().toISOString();
    const windowsJson = JSON.stringify(snapshot.windows);

    const stmt = this.db.prepare<
      [string, string, string | null, string | null, string, string, string, string, string]
    >(`
      INSERT INTO quota_snapshots (id, agent_id, model, plan, scope, windows, status, source, captured_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      snapshot.agentId,
      snapshot.model ?? null,
      snapshot.plan ?? null,
      snapshot.scope,
      windowsJson,
      snapshot.status,
      snapshot.source,
      capturedAt,
    );

    return {
      id,
      agentId: snapshot.agentId,
      model: snapshot.model ?? null,
      plan: snapshot.plan ?? null,
      scope: snapshot.scope,
      windows: snapshot.windows,
      status: snapshot.status,
      source: snapshot.source,
      capturedAt,
    };
  }

  public getLatestForAgent(agentId: string, model: string | null = null): QuotaSnapshot | null {
    if (model) {
      const stmt = this.db.prepare<[string, string], RawQuotaRow>(`
        SELECT * FROM quota_snapshots
        WHERE agent_id = ? AND model = ?
        ORDER BY captured_at DESC
        LIMIT 1
      `);
      const row = stmt.get(agentId, model);
      return row ? this.mapRow(row) : null;
    }

    const stmt = this.db.prepare<[string], RawQuotaRow>(`
      SELECT * FROM quota_snapshots
      WHERE agent_id = ?
      ORDER BY captured_at DESC
      LIMIT 1
    `);
    const row = stmt.get(agentId);
    return row ? this.mapRow(row) : null;
  }

  public getLatestAll(): QuotaSnapshot[] {
    // Lấy bản ghi có captured_at mới nhất cho mỗi cặp (agent_id, ifnull(model, ''))
    const stmt = this.db.prepare<[], RawQuotaRow>(`
      SELECT q.* FROM quota_snapshots q
      INNER JOIN (
        SELECT agent_id, ifnull(model, '') as m, MAX(captured_at) as max_cap
        FROM quota_snapshots
        GROUP BY agent_id, ifnull(model, '')
      ) latest
      ON q.agent_id = latest.agent_id 
        AND ifnull(q.model, '') = latest.m 
        AND q.captured_at = latest.max_cap
      ORDER BY q.agent_id ASC, q.model ASC
    `);

    const rows = stmt.all();
    return rows.map((r) => this.mapRow(r));
  }

  public listHistory(agentId: string, limit = 50): QuotaSnapshot[] {
    const stmt = this.db.prepare<[string, number], RawQuotaRow>(`
      SELECT * FROM quota_snapshots
      WHERE agent_id = ?
      ORDER BY captured_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(agentId, limit);
    return rows.map((r) => this.mapRow(r));
  }

  private mapRow(row: RawQuotaRow): QuotaSnapshot {
    let windows: QuotaWindow[] = [];
    try {
      windows = JSON.parse(row.windows) as QuotaWindow[];
    } catch {
      windows = [];
    }

    return {
      id: row.id,
      agentId: row.agent_id,
      model: row.model,
      plan: row.plan,
      scope: row.scope as QuotaScope,
      windows,
      status: row.status as QuotaStatus,
      source: row.source as QuotaSource,
      capturedAt: row.captured_at,
    };
  }
}
