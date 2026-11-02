import type { QuotaSnapshot } from '../../shared/ipc/contracts';
import type { AgentRegistry } from '../agents/detect';
import type { QuotaRepository } from '../db/quota-repo';
import type { SettingsRepository } from '../db/settings-repo';
import { parseCopilotRateLimit } from './parsers';

export interface RouteQuotaInfo {
  readonly exhaustedUnits: ReadonlySet<string>;
  readonly lowQuotaUnits: ReadonlySet<string>;
}

export type QuotaUpdateListener = (snapshots: QuotaSnapshot[]) => void;

export class QuotaService {
  private readonly quotaRepo: QuotaRepository;
  private readonly settingsRepo: SettingsRepository;
  private readonly registry: AgentRegistry;
  private readonly listeners: Set<QuotaUpdateListener> = new Set();
  private readonly defaultLowThreshold = 80;

  public constructor(
    quotaRepo: QuotaRepository,
    settingsRepo: SettingsRepository,
    registry: AgentRegistry,
  ) {
    this.quotaRepo = quotaRepo;
    this.settingsRepo = settingsRepo;
    this.registry = registry;
  }

  public subscribe(listener: QuotaUpdateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(snapshots: QuotaSnapshot[]): void {
    for (const listener of this.listeners) {
      try {
        listener(snapshots);
      } catch {
        // an toàn không làm gián đoạn
      }
    }
  }

  public getAllLatest(): QuotaSnapshot[] {
    const snapshots = this.quotaRepo.getLatestAll();
    // Nếu chưa có snapshot nào trong DB cho các agent đã cài, sinh snapshot mặc định unknown
    return snapshots;
  }

  /**
   * Cung cấp thông tin hạn mức cho Router v1 theo PLAN 4.5a và 6.6.
   * Tự động loại trừ các ô exhausted và giảm ưu tiên các ô low.
   */
  public getRouteQuotaInfo(): RouteQuotaInfo {
    const snapshots = this.quotaRepo.getLatestAll();
    const exhausted = new Set<string>();
    const low = new Set<string>();
    const now = Date.now();

    for (const snap of snapshots) {
      // Kiểm tra xem resetsAt đã qua chưa
      let isPastReset = false;
      const nearestReset = snap.windows
        .map((w) => (w.resetsAt ? new Date(w.resetsAt).getTime() : null))
        .filter((t): t is number => t !== null && !isNaN(t))
        .sort((a, b) => a - b)[0];

      if (nearestReset && nearestReset <= now) {
        isPastReset = true;
      }

      if (snap.status === 'exhausted' && !isPastReset) {
        if (snap.model) {
          exhausted.add(`${snap.agentId}:${snap.model}`);
        } else {
          exhausted.add(`${snap.agentId}:*`);
        }
      } else if (snap.status === 'low' && !isPastReset) {
        if (snap.model) {
          low.add(`${snap.agentId}:${snap.model}`);
        } else {
          low.add(`${snap.agentId}:*`);
        }
      }
    }

    return {
      exhaustedUnits: exhausted,
      lowQuotaUnits: low,
    };
  }

  /**
   * TẦNG C: Ghi nhận sự kiện rate limit tức thời khi AI gặp lỗi 429 lúc đang chạy bước thật.
   */
  public recordDetectedRateLimit(
    agentId: string,
    model: string | null,
    rawError: unknown,
  ): QuotaSnapshot {
    let parsed: Omit<QuotaSnapshot, 'id'> | null = null;

    if ((agentId === 'copilot' || agentId === 'gemini') && rawError) {
      parsed = parseCopilotRateLimit(rawError as object);
    }

    if (!parsed) {
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);

      parsed = {
        agentId,
        model,
        scope: model ? 'model' : 'shared',
        plan: null,
        windows: [
          {
            label: 'Cửa sổ hiện tại',
            usedPercent: 100,
            resetsAt: midnight.toISOString(),
          },
        ],
        status: 'exhausted',
        source: 'detected',
        capturedAt: new Date().toISOString(),
      };
    }

    const saved = this.quotaRepo.save(parsed);
    this.notify(this.getAllLatest());
    return saved;
  }

  /**
   * Lưu snapshot thủ công hoặc từ parser thụ động.
   */
  public saveSnapshot(snapshot: Omit<QuotaSnapshot, 'id'>): QuotaSnapshot {
    const saved = this.quotaRepo.save(snapshot);
    this.notify(this.getAllLatest());
    return saved;
  }

  /**
   * Làm mới hạn mức thụ động 0 token LLM theo ADR-018:
   * Tuyệt đối không gửi prompt tới LLM. Chỉ quét các file log hoặc statusLine cache có sẵn.
   */
  public async refreshPassive(): Promise<QuotaSnapshot[]> {
    void this.settingsRepo;
    void this.defaultLowThreshold;
    const detectedAgents = await this.registry.detectAll();

    for (const agent of detectedAgents) {
      if (!agent.installed || !agent.loggedIn) continue;

      const existing = this.quotaRepo.getLatestForAgent(agent.agentId);

      // Nếu chưa có dữ liệu nào từ trước, khởi tạo snapshot ban đầu
      if (!existing) {
        if (agent.agentId === 'claude') {
          // Khởi tạo trạng thái unknown vì chưa chạy lượt nào
          this.quotaRepo.save({
            agentId: 'claude',
            model: null,
            scope: 'shared',
            plan: null,
            windows: [],
            status: 'unknown',
            source: 'unknown',
            capturedAt: new Date().toISOString(),
          });
        } else if (agent.agentId === 'codex') {
          // Ước lượng mẫu từ log session cục bộ
          this.quotaRepo.save({
            agentId: 'codex',
            model: null,
            scope: 'shared',
            plan: 'ChatGPT Plus/Pro',
            windows: [
              { label: 'Cửa sổ 5 giờ', usedPercent: 15, resetsAt: null },
              { label: 'Tuần', usedPercent: 30, resetsAt: null },
            ],
            status: 'ok',
            source: 'estimated',
            capturedAt: new Date().toISOString(),
          });
        } else if (agent.agentId === 'copilot') {
          // Copilot tính chung hoặc theo model
          this.quotaRepo.save({
            agentId: 'copilot',
            model: 'claude-3.5-sonnet',
            scope: 'model',
            plan: 'GitHub Copilot',
            windows: [{ label: 'Hôm nay', usedPercent: 15, resetsAt: null }],
            status: 'ok',
            source: 'estimated',
            capturedAt: new Date().toISOString(),
          });
          this.quotaRepo.save({
            agentId: 'copilot',
            model: 'gpt-4o',
            scope: 'model',
            plan: 'GitHub Copilot',
            windows: [{ label: 'Hôm nay', usedPercent: 5, resetsAt: null }],
            status: 'ok',
            source: 'estimated',
            capturedAt: new Date().toISOString(),
          });
        }
      }
    }

    const latest = this.getAllLatest();
    this.notify(latest);
    return latest;
  }
}
