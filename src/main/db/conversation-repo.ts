import crypto from 'node:crypto';
import type Database from 'better-sqlite3';

export type StepUiStatus =
  | 'pending'
  | 'running'
  | 'done'
  | 'failed'
  | 'undone'
  | 'waiting_permission'
  | 'conflict'
  | 'paused';

export interface ConversationRecord {
  readonly id: string;
  readonly projectId: string;
  readonly title: string | null;
  readonly createdAt: string;
}

export interface MessageRecord {
  readonly id: string;
  readonly conversationId: string;
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
  readonly createdAt: string;
}

export interface StepRecord {
  readonly id: string;
  readonly conversationId: string;
  readonly seq: number;
  readonly agentId: string;
  readonly model: string | null;
  readonly status: StepUiStatus;
  readonly summary: string | null;
  readonly riskLevel: 'low' | 'medium' | 'high' | null;
  readonly checkpointBefore: string | null;
  readonly checkpointAfter: string | null;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
}

export interface StepFileRecord {
  readonly id: string;
  readonly stepId: string;
  readonly path: string;
  readonly change: 'added' | 'modified' | 'deleted';
  readonly riskTags: string[];
}

export interface CreateStepInput {
  readonly seq: number;
  readonly agentId: string;
  readonly model?: string | null;
  readonly status?: StepUiStatus;
  readonly summary?: string | null;
  readonly riskLevel?: 'low' | 'medium' | 'high' | null;
  readonly checkpointBefore?: string | null;
}

interface RawConversationRow {
  id: string;
  project_id: string;
  title: string | null;
  created_at: string;
}

interface RawMessageRow {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

interface RawStepRow {
  id: string;
  conversation_id: string;
  seq: number;
  agent_id: string;
  model: string | null;
  status: string;
  summary: string | null;
  risk_level: string | null;
  checkpoint_before: string | null;
  checkpoint_after: string | null;
  started_at: string | null;
  finished_at: string | null;
}

interface RawStepFileRow {
  id: string;
  step_id: string;
  path: string;
  change: 'added' | 'modified' | 'deleted';
  risk_tags: string | null;
}

export class ConversationRepository {
  private readonly db: Database.Database;

  public constructor(db: Database.Database) {
    this.db = db;
  }

  // === CONVERSATIONS ===

  public listByProject(projectId: string): ConversationRecord[] {
    const stmt = this.db.prepare<[string], RawConversationRow>(`
      SELECT id, project_id, title, created_at
      FROM conversations
      WHERE project_id = ?
      ORDER BY created_at DESC
    `);
    return stmt.all(projectId).map((r) => ({
      id: r.id,
      projectId: r.project_id,
      title: r.title,
      createdAt: r.created_at,
    }));
  }

  public getById(id: string): ConversationRecord | null {
    const stmt = this.db.prepare<[string], RawConversationRow>(`
      SELECT id, project_id, title, created_at
      FROM conversations
      WHERE id = ?
    `);
    const row = stmt.get(id);
    return row
      ? {
          id: row.id,
          projectId: row.project_id,
          title: row.title,
          createdAt: row.created_at,
        }
      : null;
  }

  public create(projectId: string, title?: string | null): ConversationRecord {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const stmt = this.db.prepare<[string, string, string | null, string]>(`
      INSERT INTO conversations (id, project_id, title, created_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, projectId, title ?? null, createdAt);

    return {
      id,
      projectId,
      title: title ?? null,
      createdAt,
    };
  }

  public updateTitle(id: string, title: string): void {
    const stmt = this.db.prepare<[string, string]>(`
      UPDATE conversations
      SET title = ?
      WHERE id = ?
    `);
    stmt.run(title, id);
  }

  public delete(id: string): void {
    const stmt = this.db.prepare<[string]>(`
      DELETE FROM conversations
      WHERE id = ?
    `);
    stmt.run(id);
  }

  // === MESSAGES ===

  public addMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
  ): MessageRecord {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const stmt = this.db.prepare<[string, string, string, string, string]>(`
      INSERT INTO messages (id, conversation_id, role, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, conversationId, role, content, createdAt);

    return {
      id,
      conversationId,
      role,
      content,
      createdAt,
    };
  }

  public listMessages(conversationId: string): MessageRecord[] {
    const stmt = this.db.prepare<[string], RawMessageRow>(`
      SELECT id, conversation_id, role, content, created_at
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `);
    return stmt.all(conversationId).map((r) => ({
      id: r.id,
      conversationId: r.conversation_id,
      role: r.role,
      content: r.content,
      createdAt: r.created_at,
    }));
  }

  // === STEPS ===

  public createSteps(conversationId: string, steps: readonly CreateStepInput[]): StepRecord[] {
    const insertStmt = this.db.prepare<
      [
        string,
        string,
        number,
        string,
        string | null,
        string,
        string | null,
        string | null,
        string | null,
      ]
    >(`
      INSERT INTO steps (id, conversation_id, seq, agent_id, model, status, summary, risk_level, checkpoint_before)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result: StepRecord[] = [];
    const insertTx = this.db.transaction((items: readonly CreateStepInput[]) => {
      for (const item of items) {
        const id = crypto.randomUUID();
        const status = item.status ?? 'pending';
        insertStmt.run(
          id,
          conversationId,
          item.seq,
          item.agentId,
          item.model ?? null,
          status,
          item.summary ?? null,
          item.riskLevel ?? null,
          item.checkpointBefore ?? null,
        );
        result.push({
          id,
          conversationId,
          seq: item.seq,
          agentId: item.agentId,
          model: item.model ?? null,
          status,
          summary: item.summary ?? null,
          riskLevel: item.riskLevel ?? null,
          checkpointBefore: item.checkpointBefore ?? null,
          checkpointAfter: null,
          startedAt: null,
          finishedAt: null,
        });
      }
    });

    insertTx(steps);
    return result;
  }

  public listSteps(conversationId: string): StepRecord[] {
    const stmt = this.db.prepare<[string], RawStepRow>(`
      SELECT id, conversation_id, seq, agent_id, model, status, summary,
             risk_level, checkpoint_before, checkpoint_after, started_at, finished_at
      FROM steps
      WHERE conversation_id = ?
      ORDER BY seq ASC
    `);
    return stmt.all(conversationId).map((r) => this.mapStepRow(r));
  }

  public getStepById(id: string): StepRecord | null {
    const stmt = this.db.prepare<[string], RawStepRow>(`
      SELECT id, conversation_id, seq, agent_id, model, status, summary,
             risk_level, checkpoint_before, checkpoint_after, started_at, finished_at
      FROM steps
      WHERE id = ?
    `);
    const row = stmt.get(id);
    return row ? this.mapStepRow(row) : null;
  }

  public updateStepStatus(
    id: string,
    status: StepUiStatus,
    extras?: {
      readonly summary?: string | null;
      readonly agentId?: string;
      readonly model?: string | null;
      readonly checkpointAfter?: string | null;
      readonly finishedAt?: string | null;
    },
  ): void {
    const fields: string[] = ['status = ?'];
    const values: (string | null)[] = [status];

    if (extras?.summary !== undefined) {
      fields.push('summary = ?');
      values.push(extras.summary);
    }
    if (extras?.agentId !== undefined) {
      fields.push('agent_id = ?');
      values.push(extras.agentId);
    }
    if (extras?.model !== undefined) {
      fields.push('model = ?');
      values.push(extras.model);
    }
    if (extras?.checkpointAfter !== undefined) {
      fields.push('checkpoint_after = ?');
      values.push(extras.checkpointAfter);
    }
    if (extras?.finishedAt !== undefined) {
      fields.push('finished_at = ?');
      values.push(extras.finishedAt);
    }

    values.push(id);

    const sql = `UPDATE steps SET ${fields.join(', ')} WHERE id = ?`;
    this.db.prepare(sql).run(...values);
  }

  public setStepStarted(id: string, startedAt?: string): void {
    const time = startedAt ?? new Date().toISOString();
    const stmt = this.db.prepare<[string, string, string]>(`
      UPDATE steps
      SET status = ?, started_at = ?
      WHERE id = ?
    `);
    stmt.run('running', time, id);
  }

  // === STEP FILES ===

  public addStepFiles(
    stepId: string,
    files: ReadonlyArray<{
      readonly path: string;
      readonly change: 'added' | 'modified' | 'deleted';
      readonly riskTags?: readonly string[];
    }>,
  ): void {
    const stmt = this.db.prepare<[string, string, string, string, string | null]>(`
      INSERT INTO step_files (id, step_id, path, change, risk_tags)
      VALUES (?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction(
      (
        items: ReadonlyArray<{
          readonly path: string;
          readonly change: 'added' | 'modified' | 'deleted';
          readonly riskTags?: readonly string[];
        }>,
      ) => {
        for (const f of items) {
          const id = crypto.randomUUID();
          const tagsStr = f.riskTags && f.riskTags.length > 0 ? JSON.stringify(f.riskTags) : null;
          stmt.run(id, stepId, f.path, f.change, tagsStr);
        }
      },
    );

    tx(files);
  }

  public listStepFiles(stepId: string): StepFileRecord[] {
    const stmt = this.db.prepare<[string], RawStepFileRow>(`
      SELECT id, step_id, path, change, risk_tags
      FROM step_files
      WHERE step_id = ?
      ORDER BY path ASC
    `);
    return stmt.all(stepId).map((r) => ({
      id: r.id,
      stepId: r.step_id,
      path: r.path,
      change: r.change,
      riskTags: r.risk_tags ? (JSON.parse(r.risk_tags) as string[]) : [],
    }));
  }

  private mapStepRow(row: RawStepRow): StepRecord {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      seq: row.seq,
      agentId: row.agent_id,
      model: row.model,
      status: row.status as StepUiStatus,
      summary: row.summary,
      riskLevel: (row.risk_level as 'low' | 'medium' | 'high' | null) ?? null,
      checkpointBefore: row.checkpoint_before,
      checkpointAfter: row.checkpoint_after,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
    };
  }
}
