/**
 * Depreciation (prompt 039): straight line (SL), declining balance (DB, with factor and optional
 * switch to straight line) and sum-of-the-years'-digits (SYD). Whole years, the asset is put into
 * service at the start of year 1 (no partial first year).
 */
import { type MathResult, fail, ok } from '../result';

export type DepreciationMethod = 'sl' | 'db' | 'syd';

export interface DepreciationInput {
  readonly method: DepreciationMethod;
  readonly cost: number;
  readonly salvage: number;
  /** Useful life in years (whole years for DB and SYD). */
  readonly life: number;
  /** DB factor: 2 = double declining balance (default 2). Rate = factor / life. */
  readonly factor?: number;
  /** DB only: switch to straight line when that gives more (default false). */
  readonly switchToSl?: boolean;
}

export interface DepreciationYear {
  readonly year: number;
  /** Depreciation of this year. */
  readonly depreciation: number;
  /** Accumulated depreciation up to and including this year. */
  readonly accumulated: number;
  /** Book value at the end of the year (cost − accumulated). */
  readonly bookValue: number;
  /** Still depreciable amount (book value − salvage). */
  readonly remaining: number;
}

function validate(p: DepreciationInput): MathResult<null> {
  const { cost, salvage, life } = p;
  if (![cost, salvage, life].every(Number.isFinite)) return fail('domain', 'invalid values');
  if (!(cost > 0)) return fail('domain', 'the cost must be positive');
  if (salvage < 0 || salvage > cost) return fail('domain', 'the salvage value must be 0 … cost');
  if (!(life > 0)) return fail('domain', 'the life must be positive');
  if (p.method !== 'sl' && !Number.isInteger(life)) {
    return fail('domain', 'DB and SYD need a whole number of years');
  }
  if (life > 1000) return fail('domain', 'the life is limited to 1000 years');
  const factor = p.factor ?? 2;
  if (p.method === 'db' && !(factor > 0 && Number.isFinite(factor))) {
    return fail('domain', 'the DB factor must be positive');
  }
  return ok(null);
}

/** The full schedule, years 1 … ⌈life⌉. */
export function depreciationSchedule(p: DepreciationInput): MathResult<DepreciationYear[]> {
  const v = validate(p);
  if (!v.ok) return v;
  const { cost, salvage, life } = p;
  const base = cost - salvage;
  const years = Math.ceil(life);
  const rows: DepreciationYear[] = [];
  let book = cost;
  for (let y = 1; y <= years; y++) {
    let dep: number;
    switch (p.method) {
      case 'sl':
        // the last, partial year of a fractional life gets the rest
        dep = Math.min(base / life, book - salvage);
        break;
      case 'syd':
        dep = (base * (life - y + 1)) / ((life * (life + 1)) / 2);
        break;
      case 'db': {
        const rate = Math.min(1, (p.factor ?? 2) / life);
        dep = book * rate;
        if (p.switchToSl) dep = Math.max(dep, (book - salvage) / (life - y + 1));
        dep = Math.max(0, Math.min(dep, book - salvage));
        break;
      }
    }
    book -= dep;
    rows.push({
      year: y,
      depreciation: dep,
      accumulated: cost - book,
      bookValue: book,
      remaining: book - salvage,
    });
  }
  return ok(rows);
}

/** Depreciation, accumulated depreciation and book value of one year. */
export function depreciation(p: DepreciationInput, year: number): MathResult<DepreciationYear> {
  const s = depreciationSchedule(p);
  if (!s.ok) return s;
  if (!Number.isInteger(year) || year < 1 || year > s.value.length) {
    return fail('domain', `the year must be a whole number 1 … ${s.value.length}`);
  }
  return ok(s.value[year - 1]);
}
