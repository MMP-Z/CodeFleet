import { z } from 'zod';

/**
 * Các khoá cài đặt ở Phase 1 theo UI_SPEC.md MH-11 (mục Chung).
 * Tuyệt đối không lưu token/khoá trong bảng settings (Luật B2).
 */
export const LocaleSchema = z.enum(['vi']);
export type AppLocale = z.infer<typeof LocaleSchema>;

export const CodeLevelSchema = z.enum(['summary', 'diff', 'full']);
export type CodeLevel = z.infer<typeof CodeLevelSchema>;

export const SettingKeySchema = z.enum([
  'ui.locale',
  'ui.codeLevel',
  'ui.showJargon',
  'ui.autoPreview',
]);
export type SettingKey = z.infer<typeof SettingKeySchema>;

export const SettingSchemas = {
  'ui.locale': LocaleSchema,
  'ui.codeLevel': CodeLevelSchema,
  'ui.showJargon': z.boolean(),
  'ui.autoPreview': z.boolean(),
} as const;

export interface AppSettingsMap {
  'ui.locale': AppLocale;
  'ui.codeLevel': CodeLevel;
  'ui.showJargon': boolean;
  'ui.autoPreview': boolean;
}

export const DEFAULT_SETTINGS: AppSettingsMap = {
  'ui.locale': 'vi',
  'ui.codeLevel': 'summary',
  'ui.showJargon': false,
  'ui.autoPreview': true,
};

export const AppSettingsMapSchema = z.object({
  'ui.locale': LocaleSchema,
  'ui.codeLevel': CodeLevelSchema,
  'ui.showJargon': z.boolean(),
  'ui.autoPreview': z.boolean(),
});

