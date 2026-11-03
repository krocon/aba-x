/**
 * Parametric, polar and sequence apps (prompt 035), pure: one state shape for the three kinds,
 * their definitions (X/Y in T, R in θ, U in N with start terms), compilation to curves and tables.
 */
import type { Expr } from '@aba/math/ast/nodes';
import { type Param2, polar } from '@aba/math/graph/parametric';
import { type SequenceDef, SequenceSystem, cobwebMap } from '@aba/math/graph/sequence';
import type { Viewport } from '@aba/math/graph/viewport';
import { type AngleMode, compile, evaluateNumeric } from '@aba/math/numeric/evaluate';
import { LOGIC_FUNCTIONS, compileRelation } from '@aba/math/interval/eval';
import { parseLatex } from '@aba/math/parser/latex-parser';
import { equationSides } from '@aba/math/numeric/equations';
import { catalogNames, markCommands, markSlots } from '../../core/latex/typed-names';
import { FN_COLORS, type PlotOptions, DEFAULT_PLOT } from '../function/function-logic';

export type CurveKind = 'parametric' | 'polar' | 'sequence' | 'graph3d' | 'relation' | 'solve';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export interface KindConfig {
  /** the variable (as typed and as AST name) */
  variable: { latex: string; name: string; label: string };
  /** field labels of one row, by row digit */
  fields: (d: string) => string[];
  /** curve name in tables and the trace */
  name: (d: string) => string;
}

export const KINDS: Record<CurveKind, KindConfig> = {
  parametric: {
    variable: { latex: 'T', name: 'T', label: 'T' },
    fields: (d) => [`X${d}(T)`, `Y${d}(T)`],
    name: (d) => `X${d}/Y${d}`,
  },
  polar: {
    variable: { latex: '\\theta', name: 'theta', label: 'θ' },
    fields: (d) => [`R${d}(θ)`],
    name: (d) => `R${d}`,
  },
  sequence: {
    variable: { latex: 'N', name: 'N', label: 'N' },
    fields: (d) => [`U${d}(N)`, `U${d}(1)`, `U${d}(2)`],
    name: (d) => `U${d}`,
  },
  // 3D surfaces (prompt 046) share the symbolic view; plot and table are their own
  graph3d: {
    variable: { latex: 'X', name: 'X', label: 'X' },
    fields: (d) => [`FZ${d}(X,Y)`],
    name: (d) => `FZ${d}`,
  },
  // advanced graphing (prompt 036): relations in X and Y
  relation: {
    variable: { latex: 'X', name: 'X', label: 'X' },
    fields: (d) => [`V${d}`],
    name: (d) => `V${d}`,
  },
  // solve app (prompt 039): equations in any variables
  solve: {
    variable: { latex: 'X', name: 'X', label: 'X' },
    fields: (d) => [`E${d}`],
    name: (d) => `E${d}`,
  },
};

export interface CurveRow {
  fields: string[];
  on: boolean;
}

export type SeqMode = 'stairs' | 'cobweb';

export interface CurveState {
  rows: CurveRow[];
  view: Viewport;
  /** parameter range (T, θ or N) */
  tmin: number;
  tmax: number;
  tstep: number;
  numStart: number;
  numStep: number;
  plot: PlotOptions;
  seqMode: SeqMode;
  /** 3D app: box ranges, camera and grid size (prompt 046) */
  range3?: { xmin: number; xmax: number; ymin: number; ymax: number; zmin: number; zmax: number };
  camera?: { azimuth: number; elevation: number; zoom: number };
  gridN?: number;
  box?: boolean;
  /** solve app (prompt 039): values of the variables, marked unknowns, last message */
  values?: Record<string, number>;
  unknowns?: string[];
  selected?: string;
}

export function initCurveState(kind: CurveKind): CurveState {
  const rows = DIGITS.map((d) => ({ fields: KINDS[kind].fields(d).map(() => ''), on: true }));
  const base = {
    rows,
    numStart: kind === 'sequence' ? 1 : 0,
    plot: DEFAULT_PLOT,
    seqMode: 'stairs' as SeqMode,
  };
  switch (kind) {
    case 'parametric':
      return {
        ...base,
        view: { xmin: -10, xmax: 10, ymin: -6.5, ymax: 6.5 },
        tmin: 0,
        tmax: 2 * Math.PI,
        tstep: 0.1,
        numStep: 0.1,
      };
    case 'polar':
      return {
        ...base,
        view: { xmin: -4, xmax: 4, ymin: -2.6, ymax: 2.6 },
        tmin: 0,
        tmax: 2 * Math.PI,
        tstep: 0.05,
        numStep: 0.1,
      };
    case 'sequence':
      return {
        ...base,
        view: { xmin: 0, xmax: 20, ymin: -2, ymax: 10 },
        tmin: 1,
        tmax: 20,
        tstep: 1,
        numStep: 1,
      };
    case 'solve':
      return {
        ...base,
        rows: rows.map((r) => ({ ...r, on: true })),
        view: { xmin: -10, xmax: 10, ymin: -6.5, ymax: 6.5 },
        tmin: 0,
        tmax: 1,
        tstep: 1,
        numStep: 1,
        values: {},
        unknowns: [],
      };
    case 'relation':
      return {
        ...base,
        view: { xmin: -10, xmax: 10, ymin: -6.5, ymax: 6.5 },
        tmin: 0,
        tmax: 1,
        tstep: 1,
        numStart: -5,
        numStep: 1,
      };
    case 'graph3d':
      return {
        ...base,
        view: { xmin: -5, xmax: 5, ymin: -5, ymax: 5 },
        tmin: 0,
        tmax: 1,
        tstep: 1,
        numStep: 1,
        range3: { xmin: -5, xmax: 5, ymin: -5, ymax: 5, zmin: -5, zmax: 5 },
        camera: { azimuth: -Math.PI / 4, elevation: Math.PI / 6, zoom: 1 },
        gridN: 30,
        box: true,
      };
  }
}

export const curveNames = (kind: CurveKind) => DIGITS.map((d) => KINDS[kind].name(d));
export const fieldLabels = (kind: CurveKind, row: number) => KINDS[kind].fields(DIGITS[row]);
export const rowColor = (row: number) => FN_COLORS[row];

/** Logical connectives typed as words in a relation (`and(X<1, Y>0)`). */
export const LOGIC_NAMES = [...LOGIC_FUNCTIONS];

/**
 * A relation of the advanced graphing app (prompt 036): parsed with the connectives as functions
 * and checked by compiling it (it must contain at least one relation). Null when empty.
 */
export function parseRelation(src: string): Expr | string | null {
  if (!src.trim()) return null;
  const p = parseLatex(markSlots(markCommands(src, [...catalogNames(), ...LOGIC_NAMES])), {
    functions: LOGIC_FUNCTIONS,
  });
  if (!p.ok) return p.error.message;
  const c = compileRelation(p.value);
  return c.ok ? p.value : c.error.message;
}

export interface Relation {
  row: number;
  name: string;
  color: string;
  expr: Expr;
}

/** The enabled, valid relations. */
export function relations(rows: readonly CurveRow[]): Relation[] {
  const out: Relation[] = [];
  rows.forEach((r, i) => {
    if (!r.on) return;
    const e = parseRelation(r.fields[0]);
    if (e && typeof e !== 'string')
      out.push({ row: i, name: `V${DIGITS[i]}`, color: rowColor(i), expr: e });
  });
  return out;
}

/** Error of an equation of the solve app (null = fine or empty). */
export function equationError(src: string): string | null {
  const e = parseEquation(src);
  return typeof e === 'string' ? e : null;
}

/** An equation of the solve app (prompt 039): `left = right` or an expression (= 0). */
export function parseEquation(src: string): Expr | string | null {
  if (!src.trim()) return null;
  const p = parseLatex(markSlots(markCommands(src, catalogNames())));
  if (!p.ok) return p.error.message;
  const s = equationSides(p.value);
  return s.ok ? p.value : s.error.message;
}

/** Home variables without X and Y (those are the plot variables of a relation). */
export function relationScope(scope: CurveScope): CurveScope {
  const variables = new Map(scope.variables);
  for (const k of ['X', 'Y', 'x', 'y']) variables.delete(k);
  return { angle: scope.angle, variables };
}

function parse(src: string, seqNames: Set<string>): Expr | string | null {
  if (!src.trim()) return null;
  const p = parseLatex(markSlots(markCommands(src, [...catalogNames(), ...seqNames])), {
    functions: seqNames,
  });
  return p.ok ? p.value : p.error.message;
}

export interface CurveScope {
  angle: AngleMode;
  variables: ReadonlyMap<string, number>;
}

export interface Curve {
  row: number;
  name: string;
  color: string;
  /** parametric/polar: the point at parameter t */
  point?: Param2;
  /** polar: r(θ) */
  radius?: (t: number) => number;
  /** sequence: U(n) or NaN */
  term?: (n: number) => number;
  /** sequence: first-order map for the cobweb plot */
  cobweb?: (x: number) => number;
}

/** Errors per row and field (null = fine or empty). */
export function rowErrors(kind: CurveKind, rows: readonly CurveRow[]): (string | null)[][] {
  if (kind === 'solve') return rows.map((r) => [equationError(r.fields[0])]);
  if (kind === 'relation') {
    return rows.map((r) => {
      const p = parseRelation(r.fields[0]);
      return [typeof p === 'string' ? p : null];
    });
  }
  const names = new Set(DIGITS.map((d) => `U${d}`));
  return rows.map((r) =>
    r.fields.map((f, k) => {
      if (kind === 'sequence' && k > 0) {
        if (!f.trim()) return null;
        const p = parse(f, names);
        if (typeof p === 'string') return p;
        return p && evaluateNumeric(p).ok ? null : 'a number is needed';
      }
      const p = parse(f, names);
      return typeof p === 'string' ? p : null;
    }),
  );
}

export function curves(kind: CurveKind, rows: readonly CurveRow[], scope: CurveScope): Curve[] {
  const v = KINDS[kind].variable.name;
  const out: Curve[] = [];
  if (kind === 'sequence') {
    const names = new Set(DIGITS.map((d) => `U${d}`));
    const defs: SequenceDef[] = rows.map((r, i) => {
      const e = parse(r.fields[0], names);
      const start = r.fields.slice(1).map((f) => {
        const p = parse(f, names);
        const n = p && typeof p !== 'string' ? evaluateNumeric(p) : null;
        return n?.ok ? n.value : undefined;
      });
      while (start.length && start.at(-1) === undefined) start.pop();
      return { name: `U${DIGITS[i]}`, expr: e && typeof e !== 'string' ? e : null, start };
    });
    const sys = new SequenceSystem(defs, scope);
    rows.forEach((r, i) => {
      if (!r.on || !defs[i].expr) return;
      const name = defs[i].name;
      const term = (n: number) => {
        const x = sys.value(name, n);
        return x.ok ? x.value : NaN;
      };
      out.push({ row: i, name, color: rowColor(i), term, cobweb: cobwebFn(defs[i], scope) });
    });
    return out;
  }
  rows.forEach((r, i) => {
    if (!r.on) return;
    const es = r.fields.map((f) => parse(f, new Set()));
    if (es.some((e) => e === null || typeof e === 'string')) return;
    const fs = (es as Expr[]).map((e) => compile(e, v, scope));
    const toRad = (t: number) => (scope.angle === 'deg' ? (t * Math.PI) / 180 : t);
    const point: Param2 =
      kind === 'parametric' ? (t) => [fs[0](t), fs[1](t)] : (t) => polar(() => fs[0](t))(toRad(t));
    out.push({
      row: i,
      name: KINDS[kind].name(DIGITS[i]),
      color: rowColor(i),
      point,
      ...(kind === 'polar' ? { radius: fs[0] } : {}),
    });
  });
  return out;
}

function cobwebFn(def: SequenceDef, scope: CurveScope): ((x: number) => number) | undefined {
  const g = cobwebMap(def);
  return g ? compile(g, 'X', scope) : undefined;
}

/** Table rows: parameter and the values of each curve (x and y for parametric). */
export function curveTable(
  kind: CurveKind,
  cs: readonly Curve[],
  start: number,
  step: number,
  rows: number,
) {
  return Array.from({ length: rows }, (_, k) => {
    const t = Number((start + k * step).toPrecision(12));
    const values = cs.flatMap((c) => {
      if (kind === 'sequence') return [c.term!(t)];
      if (kind === 'polar') return [c.radius!(t)];
      const [x, y] = c.point!(t);
      return [x, y];
    });
    return { t, values };
  });
}

export function tableHeads(
  kind: CurveKind,
  cs: readonly Curve[],
): { label: string; color: string }[] {
  return cs.flatMap((c) =>
    kind === 'parametric'
      ? [
          { label: `X${c.name[1]}`, color: c.color },
          { label: `Y${c.name[1]}`, color: c.color },
        ]
      : [{ label: c.name, color: c.color }],
  );
}
