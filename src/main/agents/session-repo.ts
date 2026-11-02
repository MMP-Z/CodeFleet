import crypto from 'node:crypto';
import path from 'node:path';
import type Database from 'better-sqlite3';
import type { AgentId } from './types';

export interface AgentSessionRecord {
  id: string;
  projectId: string;
  agentId: AgentId;
  model: string | null;
  externalId: string | null;
  createdAt: string;
}

interface AgentSessionRow {
  id: string;
  project_id: string;
  agent_id: string;
  model: string | null;
  external_id: string | null;
  created_at: string;
}

/**
 * Kho lưu trữ phiên làm việc của từng AI CLI trong bảng `agent_sessions`
 * để khôi phục hội thoại (`--resume` / `session/load`) theo mục 5 & 6 Phase 2.
 */
export class AgentSessionRepository {
  public constructor(private readonly db: Database.Database) {}

  public ensureProjectForCwd(cwd: string, explicitProjectId?: string): string {
    const normalizedPath = path.resolve(cwd);
    const existingByPath = this.db
      .prepare('SELECT id FROM projects WHERE path = ?')
      .get(normalizedPath) as { id: string } | undefined;
    if (existingByPath) {
      return existingByPath.id;
    }

    if (explicitProjectId) {
      const existingById = this.db
        .prepare('SELECT id FROM projects WHERE id = ?')
        .get(explicitProjectId) as { id: string } | undefined;
      if (existingById) {
        return existingById.id;
      }
    }

    const id = explicitProjectId ?? `proj_${crypto.randomUUID()}`;
    const name = path.basename(normalizedPath) || 'project';
    const now = new Date().toISOString();
    this.db
      .prepare(
        'INSERT INTO projects (id, name, path, created_at, last_opened) VALUES (?, ?, ?, ?, ?)',
      )
      .run(id, name, normalizedPath, now, now);
    return id;
  }

  public createSession(params: {
    id?: string;
    cwd: string;
    projectId?: string;
    agentId: AgentId;
    model: string | null;
    externalId?: string | null;
  }): AgentSessionRecord {
    const id = params.id ?? `asess_${crypto.randomUUID()}`;
    const projectId = this.ensureProjectForCwd(params.cwd, params.projectId);
    const createdAt = new Date().toISOString();
    const externalId = params.externalId ?? null;

    this.db
      .prepare(
        `
        INSERT INTO agent_sessions (id, project_id, agent_id, model, external_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      )
      .run(id, projectId, params.agentId, params.model, externalId, createdAt);

    return {
      id,
      projectId,
      agentId: params.agentId,
      model: params.model,
      externalId,
      createdAt,
    };
  }

  public updateExternalId(sessionId: string, externalId: string): void {
    this.db
      .prepare('UPDATE agent_sessions SET external_id = ? WHERE id = ?')
      .run(externalId, sessionId);
  }

  public getById(sessionId: string): AgentSessionRecord | null {
    const row = this.db
      .prepare(
        'SELECT id, project_id, agent_id, model, external_id, created_at FROM agent_sessions WHERE id = ?',
      )
      .get(sessionId) as AgentSessionRow | undefined;
    if (!row) {
      return null;
    }
    return this.mapRow(row);
  }

  public getLatestForProjectAndAgent(
    cwdOrProjectId: string,
    agentId: AgentId,
  ): AgentSessionRecord | null {
    const row = this.db
      .prepare(
        `
        SELECT s.id, s.project_id, s.agent_id, s.model, s.external_id, s.created_at
        FROM agent_sessions s
        LEFT JOIN projects p ON p.id = s.project_id
        WHERE (s.project_id = @key OR p.path = @resolvedPath)
          AND s.agent_id = @agentId
        ORDER BY s.created_at DESC, s.rowid DESC
        LIMIT 1
      `,
      )
      .get({
        key: cwdOrProjectId,
        resolvedPath: path.resolve(cwdOrProjectId),
        agentId,
      }) as AgentSessionRow | undefined;

    if (!row) {
      return null;
    }
    return this.mapRow(row);
  }

  private mapRow(row: AgentSessionRow): AgentSessionRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      agentId: row.agent_id,
      model: row.model,
      externalId: row.external_id,
      createdAt: row.created_at,
    };
  }
}
