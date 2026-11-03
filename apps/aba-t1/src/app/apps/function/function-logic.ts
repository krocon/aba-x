/**
 * Function app (prompts 033/034), pure: ten definitions F1…F9, F0 in X, their compilation to
 * plottable functions (definitions may use each other and home variables), the table of values.
 */
import type { Expr } from '@aba/math/ast/nodes';
import { STANDARD_VIEW, type Viewport } from '@aba/math/graph/viewport';
import { type UserFunction, compile } from '@aba/math/numeric/evaluate';
import { parseLatex } from '@aba/math/parser/latex-parser';
import { catalogNames, markCommands, markSlots } from '../../core/latex/typed-names';

export const FN_NAMES = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F0'];

/** Curve colours (distinct in light and dark, colour-blind friendly order). */
export const FN_COLORS = [
  '#ff6b6b',
  '#36c5d6',
  '#f2c14e',
  '#7aa2ff',
  '#c792ea',
  '#4fd1a5',
  '#ff9f6b',
  '#d7a98c',
  '#8fb3d9',
  '#6ee7b7',
];

export interface FunctionDef {
  latex: string;
  on: boolean;
}

export type PlotMethod = 'adaptive' | 'segments' | 'dots';

/** Plot setup options (prompt 034). */
export interface PlotOptions {
  grid: boolean;
  axes: boolean;
  labels: boolean;
  method: PlotMethod;
}

export interface FunctionState {
  fns: FunctionDef[];
  view: Viewport;
  numStart: number;
  numStep: number;
  plot: PlotOptions;
}

export const DEFAULT_PLOT: PlotOptions = {
  grid: true,
  axes: true,
  labels: true,
  method: 'adaptive',
};

export function initFunctionState(): FunctionState {
  return {
    fns: FN_NAMES.map(() => ({ latex: '', on: true })),
    view: STANDARD_VIEW,
    numStart: 0,
    numStep: 1,
    plot: DEFAULT_PLOT,
  };
}

/** The definitions as user functions F1(X) … (empty and broken ones are left out). */
export function definitions(fns: readonly FunctionDef[]): {
  functions: Map<string, UserFunction>;
  errors: (string | null)[];
} {
  const functions = new Map<string, UserFunction>();
  const errors: (string | null)[] = [];
  const names = new Set(FN_NAMES);
  fns.forEach((f, i) => {
    if (!f.latex.trim()) {
      errors.push(null);
      return;
    }
    const src = markSlots(markCommands(f.latex, [...catalogNames(), ...FN_NAMES]));
    const p = parseLatex(src, { functions: names });
    if (!p.ok) {
      errors.push(p.error.message);
      return;
    }
    errors.push(null);
    functions.set(FN_NAMES[i], { params: ['X'], body: p.value });
  });
  return { functions, errors };
}

export interface Plottable {
  index: number;
  name: string;
  color: string;
  f: (x: number) => number;
}

/** The enabled, valid definitions as real functions of X. */
export function plottables(
  fns: readonly FunctionDef[],
  scope: { angle: 'rad' | 'deg'; variables: ReadonlyMap<string, number> },
): Plottable[] {
  const { functions } = definitions(fns);
  const out: Plottable[] = [];
  fns.forEach((d, i) => {
    const name = FN_NAMES[i];
    if (!d.on || !functions.has(name)) return;
    const call: Expr = { type: 'call', name, args: [{ type: 'sym', name: 'X' }] };
    out.push({
      index: i,
      name,
      color: FN_COLORS[i],
      f: compile(call, 'X', { ...scope, functions }),
    });
  });
  return out;
}

/** Rows of the numeric view: X and the value of each function (NaN = undefined). */
export function table(
  fs: readonly Plottable[],
  start: number,
  step: number,
  rows: number,
): { x: number; ys: number[] }[] {
  return Array.from({ length: rows }, (_, k) => {
    const x = Number((start + k * step).toPrecision(12));
    return { x, ys: fs.map((p) => p.f(x)) };
  });
}
