import type Database from 'better-sqlite3';
import {
  DEFAULT_SETTINGS,
  SettingKeySchema,
  SettingSchemas,
  type AppSettingsMap,
  type SettingKey,
} from '@shared/settings';

/**
 * Luật B2: Tuyệt đối không cho phép lưu token, khoá, mật khẩu trong bảng settings.
 */
const FORBIDDEN_SECRET_KEY_REGEX =
  /(?:token|secret|password|passwd|api[-_]?key|credential|oauth|private[-_]?key)/i;

export class SettingsRepository {
  private readonly db: Database.Database;

  public constructor(db: Database.Database) {
    this.db = db;
  }

  public assertNotSecretKey(rawKey: string): void {
    if (FORBIDDEN_SECRET_KEY_REGEX.test(rawKey)) {
      throw new Error(
        `Vi phạm Luật B2: Không được lưu khoá nhạy cảm "${rawKey}" trong bảng settings. Hãy dùng safeStorage.`,
      );
    }
  }

  public get<K extends SettingKey>(key: K): AppSettingsMap[K] {
    SettingKeySchema.parse(key);
    const row = this.db
      .prepare<[string], { value: string }>('SELECT value FROM settings WHERE key = ?')
      .get(key);

    if (!row) {
      return DEFAULT_SETTINGS[key];
    }

    try {
      const parsedJson: unknown = JSON.parse(row.value);
      const schema = SettingSchemas[key];
      const validated = schema.safeParse(parsedJson);
      if (validated.success) {
        return validated.data as AppSettingsMap[K];
      }
      return DEFAULT_SETTINGS[key];
    } catch {
      return DEFAULT_SETTINGS[key];
    }
  }

  public getAll(): AppSettingsMap {
    return {
      'ui.locale': this.get('ui.locale'),
      'ui.codeLevel': this.get('ui.codeLevel'),
      'ui.showJargon': this.get('ui.showJargon'),
      'ui.autoPreview': this.get('ui.autoPreview'),
      'agents.enabled': this.get('agents.enabled'),
      'onboarding.completed': this.get('onboarding.completed'),
      'update.channel': this.get('update.channel'),
      'update.autoDownload': this.get('update.autoDownload'),
    };
  }

  public set<K extends SettingKey>(key: K, value: AppSettingsMap[K]): AppSettingsMap[K] {
    this.assertNotSecretKey(key);
    SettingKeySchema.parse(key);
    const validated = SettingSchemas[key].parse(value) as AppSettingsMap[K];

    this.db
      .prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(key, JSON.stringify(validated));

    return validated;
  }
}
