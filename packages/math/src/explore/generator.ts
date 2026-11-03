/**
 * Explorer apps (prompt 040), pure: the families y = m·x + b, y = a·(x − h)² + v and
 * y = a·sin(b·x + c) + d, their evaluation and derived facts (vertex, roots, discriminant, period),
 * and a seeded task generator with "nice" parameters for the practice mode.
 */
export type ExplorerKind = 'linear' | 'quadratic' | 'trig';

export interface ParamDef {
  name: string;
  step: number;
  min: number;
  max: number;
}

export const PARAMS: Record<ExplorerKind, ParamDef[]> = {
  linear: [
    { name: 'm', step: 0.5, min: -5, max: 5 },
    { name: 'b', step: 1, min: -8, max: 8 },
  ],
  quadratic: [
    { name: 'a', step: 0.5, min: -3, max: 3 },
    { name: 'h', step: 1, min: -6, max: 6 },
    { name: 'v', step: 1, min: -6, max: 6 },
  ],
  trig: [
    { name: 'a', step: 0.5, min: -4, max: 4 },
    { name: 'b', step: 0.5, min: 0.5, max: 4 },
    { name: 'c', step: 0.5, min: -4, max: 4 },
    { name: 'd', step: 0.5, min: -3, max: 3 },
  ],
};

export const DEFAULTS: Record<ExplorerKind, number[]> = {
  linear: [1, 0],
  quadratic: [1, 0, 0],
  trig: [1, 1, 0, 0],
};

export function evaluate(kind: ExplorerKind, p: readonly number[], x: number): number {
  switch (kind) {
    case 'linear':
      return p[0] * x + p[1];
    case 'quadratic':
      return p[0] * (x - p[1]) ** 2 + p[2];
    case 'trig':
      return p[0] * Math.sin(p[1] * x + p[2]) + p[3];
  }
}

/** Keeps a parameter on its grid and in its range (a = 0 is not a parabola, b = 0 not a wave). */
export function clampParam(kind: ExplorerKind, i: number, v: number): number {
  const d = PARAMS[kind][i];
  let x = Math.round(v / d.step) * d.step;
  x = Math.min(d.max, Math.max(d.min, x));
  if (x === 0 && ((kind === 'quadratic' && i === 0) || (kind === 'trig' && i <= 1))) x = d.step;
  return Number(x.toFixed(6));
}

export interface Facts {
  /** normal form text pieces for the display (LaTeX) */
  latex: string;
  details: string[];
}

const n = (x: number) => (Number.isInteger(x) ? String(x) : String(Number(x.toFixed(6))));
const signed = (x: number) => (x < 0 ? `-${n(-x)}` : `+${n(x)}`);

export function facts(kind: ExplorerKind, p: readonly number[]): Facts {
  switch (kind) {
    case 'linear': {
      const [m, b] = p;
      const root = m !== 0 ? [`x₀ = ${n(-b / m)}`] : [];
      return { latex: `y=${n(m)}x${signed(b)}`, details: [`m = ${n(m)}`, `b = ${n(b)}`, ...root] };
    }
    case 'quadratic': {
      const [a, h, v] = p;
      // a(x−h)²+v = a·x² − 2ah·x + (ah² + v)
      const B = -2 * a * h;
      const Cc = a * h * h + v;
      const disc = B * B - 4 * a * Cc;
      const roots =
        disc < 0
          ? ['no real roots']
          : disc === 0
            ? [`x₀ = ${n(h)}`]
            : [`x₁ = ${n(h - Math.sqrt(-v / a))}`, `x₂ = ${n(h + Math.sqrt(-v / a))}`];
      return {
        latex: `y=${n(a)}\\left(x${signed(-h)}\\right)^{2}${signed(v)}`,
        details: [
          `y = ${n(a)}x²${signed(B)}x${signed(Cc)}`,
          `S(${n(h)} | ${n(v)})`,
          `D = ${n(disc)}`,
          ...roots,
        ],
      };
    }
    case 'trig': {
      const [a, b, c, d] = p;
      return {
        latex: `y=${n(a)}\\sin\\left(${n(b)}x${signed(c)}\\right)${signed(d)}`,
        details: [
          `amplitude ${n(Math.abs(a))}`,
          `period ${n((2 * Math.PI) / b)}`,
          `shift ${n(-c / b)}`,
          `centre ${n(d)}`,
        ],
      };
    }
  }
}

/** Small seeded generator (mulberry32) – the same seed gives the same tasks. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A practice task: nice parameters on the grid, different from the start graph. */
export function task(kind: ExplorerKind, random: () => number): number[] {
  for (;;) {
    const p = PARAMS[kind].map((d, i) => {
      const steps = Math.round((d.max - d.min) / d.step);
      // practice values stay moderate: integers where the step allows, halves otherwise
      const v = d.min + Math.floor(random() * (steps + 1)) * d.step;
      return clampParam(kind, i, Math.abs(v) > (d.max - d.min) / 3 ? v / 2 : v);
    });
    if (p.some((v, i) => v !== DEFAULTS[kind][i])) return p;
  }
}

/** Does the answer match the task (same graph)? */
export function matches(kind: ExplorerKind, a: readonly number[], b: readonly number[]): boolean {
  // compare graphs, not parameters (sin(x+2π) is the same wave)
  for (let x = -6; x <= 6; x += 0.37) {
    if (Math.abs(evaluate(kind, a, x) - evaluate(kind, b, x)) > 1e-9) return false;
  }
  return true;
}
