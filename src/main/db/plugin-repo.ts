import type Database from 'better-sqlite3';
import type { PluginKind, PluginPermission, PluginRecord } from '../../shared/plugins/manifest';

interface RawPluginRow {
  id: string;
  version: string;
  kind: string;
  enabled: number;
  granted_permissions: string;
  installed_at: string;
}

export class PluginRepository {
  private readonly db: Database.Database;

  public constructor(db: Database.Database) {
    this.db = db;
  }

  public list(): readonly PluginRecord[] {
    const stmt = this.db.prepare<[], RawPluginRow>(`
      SELECT id, version, kind, enabled, granted_permissions, installed_at
      FROM plugins
      ORDER BY installed_at DESC
    `);
    const rows = stmt.all();
    return rows.map((r) => this.mapRow(r));
  }

  public get(id: string): PluginRecord | null {
    const stmt = this.db.prepare<[string], RawPluginRow>(`
      SELECT id, version, kind, enabled, granted_permissions, installed_at
      FROM plugins
      WHERE id = ?
    `);
    const row = stmt.get(id);
    return row ? this.mapRow(row) : null;
  }

  public save(record: {
    readonly id: string;
    readonly version: string;
    readonly kind: PluginKind;
    readonly enabled?: boolean;
    readonly grantedPermissions: readonly PluginPermission[];
    readonly installedAt?: string;
  }): PluginRecord {
    const enabled = (record.enabled ?? true) ? 1 : 0;
    const installedAt = record.installedAt ?? new Date().toISOString();
    const permissionsJson = JSON.stringify(record.grantedPermissions);

    const stmt = this.db.prepare<[string, string, string, number, string, string]>(`
      INSERT INTO plugins (id, version, kind, enabled, granted_permissions, installed_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        version = excluded.version,
        kind = excluded.kind,
        enabled = excluded.enabled,
        granted_permissions = excluded.granted_permissions,
        installed_at = excluded.installed_at
    `);

    stmt.run(record.id, record.version, record.kind, enabled, permissionsJson, installedAt);

    return {
      id: record.id,
      version: record.version,
      kind: record.kind,
      enabled: enabled === 1,
      grantedPermissions: [...record.grantedPermissions],
      installedAt,
    };
  }

  public updateEnabled(id: string, enabled: boolean): boolean {
    const stmt = this.db.prepare<[number, string]>(`
      UPDATE plugins SET enabled = ? WHERE id = ?
    `);
    const res = stmt.run(enabled ? 1 : 0, id);
    return res.changes > 0;
  }

  public delete(id: string): boolean {
    const stmt = this.db.prepare<[string]>(`
      DELETE FROM plugins WHERE id = ?
    `);
    const res = stmt.run(id);
    return res.changes > 0;
  }

  private mapRow(row: RawPluginRow): PluginRecord {
    let permissions: PluginPermission[] = [];
    try {
      permissions = JSON.parse(row.granted_permissions) as PluginPermission[];
    } catch {
      permissions = [];
    }

    return {
      id: row.id,
      version: row.version,
      kind: row.kind as PluginKind,
      enabled: row.enabled === 1,
      grantedPermissions: permissions,
      installedAt: row.installed_at,
    };
  }
}
