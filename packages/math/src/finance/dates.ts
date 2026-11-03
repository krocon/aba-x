/**
 * Date arithmetic of the finance app (prompt 039): days between dates (actual calendar days or
 * 30/360 US like the TI/HP date worksheets), date + days, day of week.
 *
 * Calendar: proleptic Gregorian (Gregorian rules also before 1582), years 1 … 9999. Dates are
 * plain `{ year, month, day }` records (month and day 1-based) and are always validated.
 */
import { type MathResult, fail, ok } from '../result';

export interface CalendarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** 'actual': calendar days; '30/360': US (NASD) rule of financial calculators. */
export type DayCountBasis = 'actual' | '30/360';

export const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function daysInMonth(year: number, month: number): number {
  return month === 2 && isLeapYear(year) ? 29 : MONTH_DAYS[month - 1];
}

/** Checks a date: whole numbers, year 1 … 9999, existing month and day. */
export function validateDate(d: CalendarDate): MathResult<CalendarDate> {
  const { year, month, day } = d;
  if (![year, month, day].every(Number.isInteger)) {
    return fail('domain', 'year, month and day must be whole numbers');
  }
  if (year < 1 || year > 9999) return fail('domain', 'the year must be between 1 and 9999');
  if (month < 1 || month > 12) return fail('domain', 'the month must be between 1 and 12');
  if (day < 1 || day > daysInMonth(year, month)) {
    return fail('domain', `${year}-${month} has no day ${day}`);
  }
  return ok({ year, month, day });
}

/** Parses an ISO date "YYYY-MM-DD". */
export function parseDate(text: string): MathResult<CalendarDate> {
  const m = /^\s*(\d{1,4})-(\d{1,2})-(\d{1,2})\s*$/.exec(text);
  if (!m) return fail('syntax', 'expected a date as YYYY-MM-DD');
  return validateDate({ year: +m[1], month: +m[2], day: +m[3] });
}

/** Formats a date as ISO "YYYY-MM-DD". */
export function formatDate(d: CalendarDate): string {
  const p = (n: number, w: number) => String(n).padStart(w, '0');
  return `${p(d.year, 4)}-${p(d.month, 2)}-${p(d.day, 2)}`;
}

/** Day number (days since 1970-01-01) of a valid date – H. Hinnant's days_from_civil. */
export function dayNumber(d: CalendarDate): number {
  const y = d.month <= 2 ? d.year - 1 : d.year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (d.month + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + d.day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Inverse of `dayNumber` (civil_from_days). */
export function fromDayNumber(z: number): CalendarDate {
  const zz = z + 719468;
  const era = Math.floor(zz / 146097);
  const doe = zz - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return { year: yoe + era * 400 + (month <= 2 ? 1 : 0), month, day };
}

/**
 * 30/360 US day count of the TI/HP date worksheets: D1 = 31 → 30; D2 = 31 and D1 ≥ 30 → 30;
 * days = 360·ΔY + 30·ΔM + ΔD. (No end-of-February rule.)
 */
export function days360(a: CalendarDate, b: CalendarDate): number {
  const d1 = a.day === 31 ? 30 : a.day;
  const d2 = b.day === 31 && d1 >= 30 ? 30 : b.day;
  return 360 * (b.year - a.year) + 30 * (b.month - a.month) + (d2 - d1);
}

/** Days from `a` to `b` (negative when b is earlier) in the chosen basis. */
export function daysBetween(
  a: CalendarDate,
  b: CalendarDate,
  basis: DayCountBasis = 'actual',
): MathResult<number> {
  const va = validateDate(a);
  if (!va.ok) return va;
  const vb = validateDate(b);
  if (!vb.ok) return vb;
  return ok(basis === 'actual' ? dayNumber(b) - dayNumber(a) : days360(a, b));
}

/** The date `days` calendar days after `d` (negative: before). */
export function addDays(d: CalendarDate, days: number): MathResult<CalendarDate> {
  const v = validateDate(d);
  if (!v.ok) return v;
  if (!Number.isInteger(days)) return fail('domain', 'the number of days must be a whole number');
  const r = fromDayNumber(dayNumber(d) + days);
  if (r.year < 1 || r.year > 9999)
    return fail('domain', 'the result is outside the years 1 … 9999');
  return ok(r);
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** ISO day of week: 1 = Monday … 7 = Sunday, with its English name. */
export function dayOfWeek(d: CalendarDate): MathResult<{ iso: number; name: string }> {
  const v = validateDate(d);
  if (!v.ok) return v;
  // 1970-01-01 was a Thursday (ISO 4)
  const iso = ((((dayNumber(d) + 3) % 7) + 7) % 7) + 1;
  return ok({ iso, name: WEEKDAYS[iso - 1] });
}

/** Adds whole months, clamping the day to the month's length (end of month stays end of month when `eom`). */
export function addMonths(d: CalendarDate, months: number, eom = false): CalendarDate {
  const total = d.year * 12 + (d.month - 1) + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12 + 1;
  const last = daysInMonth(year, month);
  return { year, month, day: eom ? last : Math.min(d.day, last) };
}
