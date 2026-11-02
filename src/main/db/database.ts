import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { Logger } from '../logger/logger';
import { ALL_MIGRATIONS, type MigrationDefinition } from './migrations';

export interface BackupResult {
  readonly backupPath: string;
  readonly createdAt: string;
  readonly sizeBytes: number;
}

export interface DatabaseServiceOptions {
  readonly userDataDir: string;
  readonly dbFileName?: string;
  readonly migrations?: readonly MigrationDefinition[];
  readonly logger?: Logger;
}

/**
 * Quản lý SQLite local theo ADR-002 và Luật P2, P8:
 * - Chỉ main process truy cập.
 * - Bật journal_mode = WAL và foreign_keys = ON.
 * - Mọi migration đánh số, tự sao lưu DB trước khi chạy migration (Luật P8).
 */
export class DatabaseService {
  private readonly dbPath: string;
  private readonly backupDir: string;
  private readonly migrations: readonly MigrationDefinition[];
  private readonly logger?: Logger;
  private db: Database.Database | null = null;

  public constructor(options: DatabaseServiceOptions) {
    const fileName = options.dbFileName ?? 'codefleet.sqlite';
    this.dbPath = path.join(options.userDataDir, fileName);
    this.backupDir = path.join(options.userDataDir, 'backups');
    this.migrations = options.migrations ?? ALL_MIGRATIONS;
    this.logger = options.logger;
  }

  public getDbPath(): string {
    return this.dbPath;
  }

  public getBackupDir(): string {
    return this.backupDir;
  }

  public openAndMigrate(): Database.Database {
    if (this.db) {
      return this.db;
    }

    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    const hadExistingDbFile = fs.existsSync(this.dbPath) && fs.statSync(this.dbPath).size > 0;

    const conn = new Database(this.dbPath);
    conn.pragma('journal_mode = WAL');
    conn.pragma('foreign_keys = ON');
    conn.pragma('busy_timeout = 5000');

    conn.exec(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        version    INTEGER PRIMARY KEY,
        name       TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);

    const appliedRows = conn
      .prepare<[], { version: number }>(
        'SELECT version FROM _schema_migrations ORDER BY version ASC',
      )
      .all();
    const appliedSet = new Set(appliedRows.map((r) => r.version));

    const sortedMigrations = [...this.migrations].sort((a, b) => a.version - b.version);
    const pending = sortedMigrations.filter((m) => !appliedSet.has(m.version));

    if (pending.length > 0) {
      // Luật P8: nếu đã có DB của người dùng từ trước, tự động sao lưu trước khi chạy migration
      if (hadExistingDbFile) {
        const nextVersion = pending[0].version;
        const backup = this.createSnapshotBackup(conn, `pre-migration-v${nextVersion}`);
        this.logger?.info('Created pre-migration SQLite backup', {
          backupPath: backup.backupPath,
          nextVersion,
        });
      }

      for (const migration of pending) {
        const applyTx = conn.transaction((mig: MigrationDefinition) => {
          conn.exec(mig.sql);
          conn
            .prepare('INSERT INTO _schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
            .run(mig.version, mig.name, new Date().toISOString());
        });

        applyTx(migration);
        this.logger?.info('Applied SQLite migration', {
          version: migration.version,
          name: migration.name,
        });
      }
    }

    this.db = conn;
    return conn;
  }

  public getConnection(): Database.Database {
    if (!this.db) {
      throw new Error('Database has not been opened. Call openAndMigrate() first.');
    }
    return this.db;
  }

  /**
   * Sao lưu thủ công hoặc tự động (MH-11 "Sao lưu ngay" & Luật P8).
   */
  public backupNow(label = 'manual'): BackupResult {
    const conn = this.getConnection();
    const backup = this.createSnapshotBackup(conn, label);
    this.logger?.info('Created manual SQLite backup', {
      backupPath: backup.backupPath,
      sizeBytes: backup.sizeBytes,
    });
    return backup;
  }

  private createSnapshotBackup(conn: Database.Database, label: string): BackupResult {
    fs.mkdirSync(this.backupDir, { recursive: true });
    // Đẩy dữ liệu từ WAL vào file chính để bản sao lưu nhất quán trọn vẹn
    conn.pragma('wal_checkpoint(TRUNCATE)');

    const createdAt = new Date().toISOString();
    const safeTimestamp = createdAt.replace(/[:.]/g, '-');
    const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '-');
    const backupPath = path.join(
      this.backupDir,
      `codefleet-${safeLabel}-${safeTimestamp}.sqlite.bak`,
    );

    fs.copyFileSync(this.dbPath, backupPath);
    const sizeBytes = fs.statSync(backupPath).size;

    return { backupPath, createdAt, sizeBytes };
  }

  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
