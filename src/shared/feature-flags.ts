/**
 * Feature flags theo Luật P6:
 * Tính năng dở dang hoặc thuộc phase sau đặt sau feature flag, không để lộ ra người dùng.
 */
export interface FeatureFlags {
  /** Trang thử nội bộ /dev/components (Prompt 1, UI_SPEC mục 4) */
  readonly devComponents: boolean;
  /** Mục gửi số liệu ẩn danh [CHƯA CHỐT] (PROJECT_PLAN mục 12) */
  readonly telemetrySetting: boolean;
  /** Các mục thuộc phase tiếp theo */
  readonly phase2Agents: boolean;
  readonly phase3Workspace: boolean;
  readonly phase5Quota: boolean;
  readonly phase6Plugins: boolean;
  readonly phase7Updater: boolean;
  readonly phase8Feedback: boolean;
}

export function resolveFeatureFlags(isDev: boolean): FeatureFlags {
  return {
    devComponents: isDev,
    telemetrySetting: false,
    phase2Agents: false,
    phase3Workspace: false,
    phase5Quota: false,
    phase6Plugins: false,
    phase7Updater: false,
    phase8Feedback: false,
  };
}
