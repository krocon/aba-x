/** Settings document (prompt 018): defaults, sanitizing, newer schema = read-only. */
import type { AngleMode } from '@aba/math/numeric/evaluate';
import type { Lang } from '../../core/i18n/i18n';

export const SETTINGS_SCHEMA = 1;
export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  angle: AngleMode;
  approx: boolean;
  digits: number;
  timeoutSec: number;
  theme: Theme;
  lang: Lang;
  /** Full-size mode: the device fills the whole window (display and keypad). */
  fullSize: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  angle: 'rad',
  approx: false,
  digits: 12,
  timeoutSec: 8,
  theme: 'system',
  lang: 'en',
  fullSize: false,
};

const clampInt = (v: unknown, min: number, max: number, def: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : def;
const oneOf = <T extends string>(v: unknown, values: readonly T[], def: T): T =>
  values.includes(v as T) ? (v as T) : def;

export function sanitizeSettings(
  raw: unknown,
  defaults: Settings = DEFAULT_SETTINGS,
): { settings: Settings; readOnly: boolean } {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    settings: {
      angle: oneOf(r['angle'], ['rad', 'deg'] as const, defaults.angle),
      approx: typeof r['approx'] === 'boolean' ? r['approx'] : defaults.approx,
      digits: clampInt(r['digits'], 6, 15, defaults.digits),
      timeoutSec: clampInt(r['timeoutSec'], 1, 60, defaults.timeoutSec),
      theme: oneOf(r['theme'], ['system', 'light', 'dark'] as const, defaults.theme),
      lang: oneOf(r['lang'], ['en', 'de'] as const, defaults.lang),
      fullSize: typeof r['fullSize'] === 'boolean' ? r['fullSize'] : defaults.fullSize,
    },
    readOnly: typeof r['schemaVersion'] === 'number' && r['schemaVersion'] > SETTINGS_SCHEMA,
  };
}

export function settingsDoc(s: Settings) {
  return { schemaVersion: SETTINGS_SCHEMA, ...s };
}
