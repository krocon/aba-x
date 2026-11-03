import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  dayNumber,
  dayOfWeek,
  days360,
  daysBetween,
  formatDate,
  fromDayNumber,
  isLeapYear,
  parseDate,
  validateDate,
} from './dates';

const val = <T>(r: { ok: boolean; value?: T; error?: { message: string } }) => {
  if (!r.ok) throw new Error(`not ok: ${r.error?.message}`);
  return r.value as T;
};
const d = (year: number, month: number, day: number) => ({ year, month, day });

describe('dates', () => {
  it('counts actual days including leap years', () => {
    expect(val(daysBetween(d(2024, 1, 1), d(2025, 1, 1)))).toBe(366);
    expect(val(daysBetween(d(2023, 1, 1), d(2024, 1, 1)))).toBe(365);
    expect(val(daysBetween(d(2024, 2, 28), d(2024, 3, 1)))).toBe(2);
    expect(val(daysBetween(d(2023, 2, 28), d(2023, 3, 1)))).toBe(1);
    expect(val(daysBetween(d(2025, 1, 1), d(2024, 1, 1)))).toBe(-366);
    expect(val(daysBetween(d(1900, 1, 1), d(2000, 1, 1)))).toBe(36524);
  });

  it('counts 30/360 US days', () => {
    expect(val(daysBetween(d(2024, 1, 31), d(2024, 3, 31), '30/360'))).toBe(60);
    expect(val(daysBetween(d(2024, 1, 15), d(2024, 3, 31), '30/360'))).toBe(76);
    expect(val(daysBetween(d(2024, 2, 29), d(2024, 3, 31), '30/360'))).toBe(32);
    expect(val(daysBetween(d(2024, 1, 1), d(2025, 1, 1), '30/360'))).toBe(360);
    expect(days360(d(2008, 11, 15), d(2009, 2, 15))).toBe(90);
  });

  it('adds days across months, years and leap days', () => {
    expect(val(addDays(d(2024, 2, 28), 1))).toEqual(d(2024, 2, 29));
    expect(val(addDays(d(2023, 2, 28), 1))).toEqual(d(2023, 3, 1));
    expect(val(addDays(d(2024, 12, 31), 1))).toEqual(d(2025, 1, 1));
    expect(val(addDays(d(2025, 1, 1), -366))).toEqual(d(2024, 1, 1));
    expect(val(addDays(d(2000, 1, 1), 100000))).toEqual(d(2273, 10, 16));
  });

  it('uses the proleptic Gregorian calendar', () => {
    expect(val(addDays(d(1582, 10, 4), 1))).toEqual(d(1582, 10, 5));
    expect(isLeapYear(1600)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
  });

  it('gives the day of the week', () => {
    expect(val(dayOfWeek(d(2026, 11, 3)))).toEqual({ iso: 2, name: 'Tuesday' });
    expect(val(dayOfWeek(d(2000, 1, 1))).name).toBe('Saturday');
    expect(val(dayOfWeek(d(1970, 1, 1))).iso).toBe(4);
    expect(val(dayOfWeek(d(1, 1, 1))).name).toBe('Monday');
  });

  it('round-trips day numbers', () => {
    expect(dayNumber(d(1970, 1, 1))).toBe(0);
    for (let z = -719162; z < 2932897; z += 9973) {
      expect(dayNumber(fromDayNumber(z))).toBe(z);
    }
    expect(fromDayNumber(dayNumber(d(9999, 12, 31)))).toEqual(d(9999, 12, 31));
  });

  it('validates dates', () => {
    expect(validateDate(d(2023, 2, 29)).ok).toBe(false);
    expect(validateDate(d(1900, 2, 29)).ok).toBe(false);
    expect(validateDate(d(2000, 2, 29)).ok).toBe(true);
    expect(validateDate(d(2024, 13, 1)).ok).toBe(false);
    expect(validateDate(d(2024, 4, 31)).ok).toBe(false);
    expect(validateDate(d(0, 1, 1)).ok).toBe(false);
    expect(validateDate(d(2024, 1, 1.5)).ok).toBe(false);
    expect(daysBetween(d(2024, 2, 30), d(2024, 3, 1)).ok).toBe(false);
    expect(addDays(d(9999, 12, 31), 1).ok).toBe(false);
    expect(addDays(d(2024, 1, 1), 0.5).ok).toBe(false);
  });

  it('parses, formats and adds months', () => {
    expect(val(parseDate('2024-02-29'))).toEqual(d(2024, 2, 29));
    expect(parseDate('2023-02-29').ok).toBe(false);
    expect(parseDate('29.02.2024').ok).toBe(false);
    expect(formatDate(d(812, 3, 7))).toBe('0812-03-07');
    expect(addMonths(d(2024, 1, 31), 1)).toEqual(d(2024, 2, 29));
    expect(addMonths(d(2024, 2, 29), -12)).toEqual(d(2023, 2, 28));
    expect(addMonths(d(2024, 4, 30), 1, true)).toEqual(d(2024, 5, 31));
  });
});
