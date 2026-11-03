/**
 * Home settings of ABA-T1 (prompt 027, shift + Home): angle mode, number format, complex results,
 * entry mode, language, font size. Pure: defaults, validation of a loaded document, cycling.
 */
import type { AngleMode } from '@aba/math/numeric/evaluate';
import type { ComplexForm, FormatMode, NumberFormat } from '@aba/math/value/format';

export type ComplexSetting = 'off' | ComplexForm;
export type EntryMode = 'textbook' | 'algebraic' | 'rpn';
export type Language = 'en' | 'de';
export type FontSize = 'small' | 'medium' | 'large';

export type CasMode = 'exact' | 'approx';

export interface T1Settings {
  angle: AngleMode;
  /** CAS view: exact results, or decimal approximations of them (prompt 029) */
  casMode: CasMode;
  format: NumberFormat;
  complex: ComplexSetting;
  entry: EntryMode;
  language: Language;
  fontSize: FontSize;
}

export const SETTINGS_VERSION = 1;

export function defaultSettings(lang: Language): T1Settings {
  return {
    angle: 'rad',
    casMode: 'exact',
    format: { mode: 'standard', digits: 4, decimal: '.' },
    complex: 'off',
    entry: 'textbook',
    language: lang,
    fontSize: 'medium',
  };
}

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

/** A stored document → valid settings (unknown or broken fields fall back to defaults). */
export function readSettings(doc: unknown, lang: Language): T1Settings {
  const d = defaultSettings(lang);
  if (!doc || typeof doc !== 'object') return d;
  const s = doc as Partial<T1Settings> & { format?: Partial<NumberFormat> };
  const digits = Number(s.format?.digits);
  return {
    angle: pick(s.angle, ['rad', 'deg'] as const, d.angle),
    casMode: pick(s.casMode, ['exact', 'approx'] as const, d.casMode),
    format: {
      mode: pick<FormatMode>(s.format?.mode, ['standard', 'fixed', 'sci', 'eng'], 'standard'),
      digits: Number.isInteger(digits) && digits >= 0 && digits <= 11 ? digits : d.format.digits,
      decimal: pick(s.format?.decimal, ['.', ','] as const, '.'),
    },
    complex: pick(s.complex, ['off', 'rect', 'polar'] as const, d.complex),
    entry: pick(s.entry, ['textbook', 'algebraic', 'rpn'] as const, d.entry),
    language: pick(s.language, ['en', 'de'] as const, d.language),
    fontSize: pick(s.fontSize, ['small', 'medium', 'large'] as const, d.fontSize),
  };
}

/** One row of the settings view: label key, current choice, choices. */
export interface SettingRow {
  id:
    | 'angle'
    | 'mode'
    | 'digits'
    | 'decimal'
    | 'complex'
    | 'entry'
    | 'language'
    | 'fontSize'
    | 'casMode';
  options: readonly string[];
}

export const SETTING_ROWS: readonly SettingRow[] = [
  { id: 'angle', options: ['rad', 'deg'] },
  { id: 'mode', options: ['standard', 'fixed', 'sci', 'eng'] },
  { id: 'digits', options: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'] },
  { id: 'decimal', options: ['.', ','] },
  { id: 'complex', options: ['off', 'rect', 'polar'] },
  { id: 'entry', options: ['textbook', 'algebraic', 'rpn'] },
  { id: 'language', options: ['en', 'de'] },
  { id: 'fontSize', options: ['small', 'medium', 'large'] },
];

/** CAS settings (⇧CAS): the CAS view shares angle and number format with home. */
export const CAS_SETTING_ROWS: readonly SettingRow[] = [
  { id: 'casMode', options: ['exact', 'approx'] },
  { id: 'mode', options: ['standard', 'fixed', 'sci', 'eng'] },
  { id: 'digits', options: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'] },
];

export function valueOf(s: T1Settings, id: SettingRow['id']): string {
  switch (id) {
    case 'angle':
      return s.angle;
    case 'mode':
      return s.format.mode;
    case 'digits':
      return String(s.format.digits);
    case 'decimal':
      return s.format.decimal;
    case 'complex':
      return s.complex;
    case 'entry':
      return s.entry;
    case 'language':
      return s.language;
    case 'fontSize':
      return s.fontSize;
    case 'casMode':
      return s.casMode;
  }
}

/** Sets one row to a value (validated through `readSettings`). */
export function withValue(s: T1Settings, id: SettingRow['id'], v: string): T1Settings {
  const next: Record<string, unknown> = { ...s, format: { ...s.format } };
  const f = next['format'] as Record<string, unknown>;
  if (id === 'mode') f['mode'] = v;
  else if (id === 'digits') f['digits'] = Number(v);
  else if (id === 'decimal') f['decimal'] = v;
  else next[id] = v;
  return readSettings(next, s.language);
}

/** Next (step 1) or previous (step −1) choice of a row, wrapping around. */
export function cycle(s: T1Settings, id: SettingRow['id'], step: 1 | -1): T1Settings {
  const row = [...SETTING_ROWS, ...CAS_SETTING_ROWS].find((r) => r.id === id)!;
  const i = row.options.indexOf(valueOf(s, id));
  const n = row.options.length;
  return withValue(s, id, row.options[(i + step + n) % n]);
}
