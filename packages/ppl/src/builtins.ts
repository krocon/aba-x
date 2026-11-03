/**
 * Builtin commands of the language (I/O, graphics, strings, lists). Names are case-insensitive; they
 * take precedence over the math catalogue (SIZE and CONCAT also handle strings). Every builtin gets
 * its evaluated arguments plus the screens written as G0–G9 and returns a value; those marked
 * `async` may wait for the host. The math functions (sin, mod, det, …) come from the math core.
 */
import { PplFault } from './errors';
import type { Coords, GfxCommand, Host } from './host';
import type { VarRef } from './ast';
import { FALSE, MAX_LIST, type PplList, type PplValue, TRUE, str, typeName } from './values';
import { real } from './math-bridge';

export interface BuiltinContext {
  readonly name: string;
  readonly host: Host;
  readonly args: readonly PplValue[];
  /** screen number per argument written as G0–G9 (else undefined) */
  readonly screens: readonly (number | undefined)[];
  /** variables of INPUT/CHOOSE */
  readonly refs: readonly VarRef[];
  read(ref: VarRef): PplValue;
  write(ref: VarRef, v: PplValue): void;
  format(v: PplValue): string;
  random(): number;
  now(): number;
  /** a math catalogue function on core values */
  math(name: string, args: readonly PplValue[]): PplValue;
  /** EXPR: compiles and evaluates an expression in the running function */
  evalString(source: string): Promise<PplValue>;
  /** throws when the run was cancelled meanwhile */
  checkCancel(): void;
}

export interface BuiltinSpec {
  readonly min: number;
  readonly max: number;
  /** may wait for the host or run user code */
  readonly async?: boolean;
  /** the first argument is a variable (or a list of variables) that receives the result */
  readonly ref?: boolean;
  readonly fn: (ctx: BuiltinContext) => PplValue | Promise<PplValue>;
}

const fault = (message: string) => new PplFault('type', message);

function num(ctx: BuiltinContext, k: number, what = 'argument'): number {
  const v = ctx.args[k];
  if (v?.kind === 'real') return v.v;
  if (v?.kind === 'int') return Number(v.v);
  throw fault(`${ctx.name}: ${what} ${k + 1} must be a number, not ${v ? typeName(v) : 'missing'}`);
}

function int(ctx: BuiltinContext, k: number, what?: string): number {
  const n = num(ctx, k, what);
  if (!Number.isInteger(n)) throw fault(`${ctx.name}: argument ${k + 1} must be an integer`);
  return n;
}

function text(ctx: BuiltinContext, k: number): string {
  const v = ctx.args[k];
  if (v?.kind === 'string') return v.s;
  throw fault(
    `${ctx.name}: argument ${k + 1} must be a string, not ${v ? typeName(v) : 'missing'}`,
  );
}

/** Optional screen as argument `at`: { screen, rest } with the remaining arguments. */
function screenArgs(ctx: BuiltinContext, at = 0): { screen: number; rest: BuiltinContext } {
  ctx.screens.forEach((s, k) => {
    if (s !== undefined && k !== at) {
      throw fault(`${ctx.name}: a screen (G0–G9) is only allowed as argument ${at + 1}`);
    }
  });
  if (ctx.screens[at] === undefined) return { screen: 0, rest: ctx };
  const args = ctx.args.filter((_, k) => k !== at);
  return {
    screen: ctx.screens[at] ?? 0,
    rest: { ...ctx, args, screens: args.map(() => undefined) },
  };
}

const optNum = (ctx: BuiltinContext, k: number) => (k < ctx.args.length ? num(ctx, k) : undefined);

function gfx(ctx: BuiltinContext, cmd: GfxCommand): PplValue {
  ctx.host.gfx(cmd);
  return TRUE;
}

const coordsOf = (name: string): Coords => (name.endsWith('_P') ? 'pixel' : 'cartesian');

function rect(ctx: BuiltinContext): PplValue {
  const { screen, rest } = screenArgs(ctx);
  const coords = coordsOf(ctx.name);
  const n = rest.args.length;
  if (n === 0) return gfx(ctx, { op: 'rect', screen, coords, fill: 0xffffff, edge: 0xffffff });
  if (n === 1) {
    const c = num(rest, 0);
    return gfx(ctx, { op: 'rect', screen, coords, fill: c, edge: c });
  }
  if (n < 4) throw fault(`${ctx.name}: needs x1, y1, x2, y2 (and colours)`);
  const edge = optNum(rest, 4);
  const fill = optNum(rest, 5) ?? edge;
  return gfx(ctx, {
    op: 'rect',
    screen,
    coords,
    x1: num(rest, 0),
    y1: num(rest, 1),
    x2: num(rest, 2),
    y2: num(rest, 3),
    ...(edge !== undefined ? { edge } : {}),
    ...(fill !== undefined ? { fill } : {}),
  });
}

function line(ctx: BuiltinContext): PplValue {
  const { screen, rest } = screenArgs(ctx);
  if (rest.args.length < 4) throw fault(`${ctx.name}: needs x1, y1, x2, y2`);
  const color = optNum(rest, 4);
  return gfx(ctx, {
    op: 'line',
    screen,
    coords: coordsOf(ctx.name),
    x1: num(rest, 0),
    y1: num(rest, 1),
    x2: num(rest, 2),
    y2: num(rest, 3),
    ...(color !== undefined ? { color } : {}),
  });
}

function pixon(ctx: BuiltinContext): PplValue {
  const { screen, rest } = screenArgs(ctx);
  if (rest.args.length < 2) throw fault(`${ctx.name}: needs x, y`);
  const color = optNum(rest, 2);
  return gfx(ctx, {
    op: 'pixon',
    screen,
    coords: coordsOf(ctx.name),
    x: num(rest, 0),
    y: num(rest, 1),
    ...(color !== undefined ? { color } : {}),
  });
}

function textout(ctx: BuiltinContext): PplValue {
  const t = ctx.args[0];
  const shown = t?.kind === 'string' ? t.s : t ? ctx.format(t) : '';
  const { screen, rest } = screenArgs(ctx, 1);
  if (rest.args.length < 3) throw fault(`${ctx.name}: needs text, x, y`);
  const [font, color, width, background] = [3, 4, 5, 6].map((k) => optNum(rest, k));
  return gfx(ctx, {
    op: 'textout',
    screen,
    coords: coordsOf(ctx.name),
    text: shown,
    x: num(rest, 1),
    y: num(rest, 2),
    ...(font !== undefined ? { font } : {}),
    ...(color !== undefined ? { color } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(background !== undefined ? { background } : {}),
  });
}

function fillpoly(ctx: BuiltinContext): PplValue {
  const { screen, rest } = screenArgs(ctx);
  const pts = rest.args[0];
  let points: [number, number][];
  if (pts?.kind === 'matrix' && pts.rows.every((r) => r.length === 2)) {
    points = pts.rows.map((r) => [r[0], r[1]]);
  } else if (pts?.kind === 'list') {
    points = pts.items.map((p) => {
      if (p.kind === 'list' && p.items.length === 2 && p.items.every((x) => x.kind === 'real')) {
        return [(p.items[0] as { v: number }).v, (p.items[1] as { v: number }).v];
      }
      if (p.kind === 'complex') return [p.re, p.im];
      throw fault(`${ctx.name}: points are {x, y} pairs`);
    });
  } else {
    throw fault(`${ctx.name}: needs a list of points {{x1, y1}, {x2, y2}, …}`);
  }
  const color = optNum(rest, 1);
  return gfx(ctx, {
    op: 'fillpoly',
    screen,
    coords: coordsOf(ctx.name),
    points,
    ...(color !== undefined ? { color } : {}),
  });
}

/** BLIT_P([trgt], [dx1, dy1[, dx2, dy2]], src, [sx1, sy1, sx2, sy2], [transparent]) */
function blit(ctx: BuiltinContext): PplValue {
  const at = ctx.screens.map((s, k) => (s === undefined ? -1 : k)).filter((k) => k >= 0);
  if (!at.length) throw fault(`${ctx.name}: needs a source screen G0–G9`);
  const hasTarget = at[0] === 0 && at.length > 1;
  const src = hasTarget ? at[1] : at[0];
  const target = hasTarget ? (ctx.screens[0] ?? 0) : 0;
  const first = hasTarget ? 1 : 0;
  const dest = src - first;
  if (dest !== 0 && dest !== 2 && dest !== 4) {
    throw fault(`${ctx.name}: the target corner needs x and y (or two corners)`);
  }
  const after = ctx.args.length - src - 1;
  if (after !== 0 && after !== 1 && after !== 4 && after !== 5) {
    throw fault(`${ctx.name}: the source rectangle needs x1, y1, x2, y2`);
  }
  const d = (k: number) => num(ctx, first + k);
  const s = (k: number) => num(ctx, src + 1 + k);
  const transparent = after === 1 || after === 5 ? num(ctx, ctx.args.length - 1) : undefined;
  return gfx(ctx, {
    op: 'blit',
    coords: coordsOf(ctx.name),
    target,
    ...(dest >= 2 ? { dx1: d(0), dy1: d(1) } : {}),
    ...(dest === 4 ? { dx2: d(2), dy2: d(3) } : {}),
    source: ctx.screens[src] ?? 0,
    ...(after >= 4 ? { sx1: s(0), sy1: s(1), sx2: s(2), sy2: s(3) } : {}),
    ...(transparent !== undefined ? { transparent } : {}),
  });
}

function size(ctx: BuiltinContext): PplValue {
  const v = ctx.args[0];
  if (v.kind === 'string') return real(v.s.length);
  if (v.kind === 'list') return real(v.items.length);
  return ctx.math('size', [v]);
}

function concat(ctx: BuiltinContext): PplValue {
  const [a, b] = ctx.args;
  if (a.kind === 'string' || b.kind === 'string') return str(ctx.format(a) + ctx.format(b));
  const items = (v: PplValue): readonly PplValue[] => (v.kind === 'list' ? v.items : [v]);
  const out = [...items(a), ...items(b)];
  if (out.length > MAX_LIST) throw new PplFault('size-limit', `list longer than ${MAX_LIST} items`);
  return { kind: 'list', items: out } satisfies PplList;
}

/** Characters of a code point list or a single code point. */
function char(ctx: BuiltinContext): PplValue {
  const v = ctx.args[0];
  const codes = v.kind === 'list' ? v.items : [v];
  return str(
    codes
      .map((c) => {
        if (c.kind !== 'real' || !Number.isInteger(c.v) || c.v < 0 || c.v > 0x10ffff) {
          throw fault('CHAR: needs character codes');
        }
        return String.fromCodePoint(c.v);
      })
      .join(''),
  );
}

async function input(ctx: BuiltinContext): Promise<PplValue> {
  const refs = ctx.refs;
  const list = (k: number): string[] => {
    const v = ctx.args[k];
    if (v === undefined) return [];
    if (v.kind === 'string') return [v.s];
    if (v.kind === 'list') return v.items.map((x) => (x.kind === 'string' ? x.s : ctx.format(x)));
    return [ctx.format(v)];
  };
  const title = ctx.args[1]?.kind === 'string' ? ctx.args[1].s : '';
  const labels = list(2);
  const helps = list(3);
  const resets = ctx.args[4];
  const resetValues = resets?.kind === 'list' ? resets.items : resets ? [resets] : [];
  const fields = refs.map((r, k) => {
    let value: PplValue;
    try {
      value = resetValues[k] ?? ctx.read(r);
    } catch {
      value = real(0);
    }
    return { name: r.name, label: labels[k] ?? `${r.name}=`, help: helps[k] ?? '', value };
  });
  const answer = await ctx.host.input(title, fields);
  ctx.checkCancel();
  if (!answer) return FALSE;
  refs.forEach((r, k) => {
    const v = answer[k];
    if (v !== undefined) ctx.write(r, v);
  });
  return TRUE;
}

async function choose(ctx: BuiltinContext): Promise<PplValue> {
  const title = ctx.args[1]?.kind === 'string' ? ctx.args[1].s : ctx.format(ctx.args[1]);
  const rest = ctx.args.slice(2);
  const items =
    rest.length === 1 && rest[0].kind === 'list'
      ? rest[0].items.map((x) => (x.kind === 'string' ? x.s : ctx.format(x)))
      : rest.map((x) => (x.kind === 'string' ? x.s : ctx.format(x)));
  if (!items.length) throw fault('CHOOSE: needs at least one item');
  const k = await ctx.host.choose(title, items);
  ctx.checkCancel();
  const chosen = Number.isInteger(k) && k >= 1 && k <= items.length ? k : 0;
  ctx.write(ctx.refs[0], real(chosen));
  return chosen ? TRUE : FALSE;
}

function random(ctx: BuiltinContext): PplValue {
  const r = ctx.random();
  if (ctx.args.length === 0) return real(r);
  if (ctx.args.length === 1) return real(r * num(ctx, 0));
  const a = num(ctx, 0);
  const b = num(ctx, 1);
  return real(a + r * (b - a));
}

function randint(ctx: BuiltinContext): PplValue {
  const a = int(ctx, 0);
  const b = ctx.args.length > 1 ? int(ctx, 1) : a;
  const [lo, hi] = ctx.args.length > 1 ? [Math.min(a, b), Math.max(a, b)] : [1, a];
  return real(lo + Math.floor(ctx.random() * (hi - lo + 1)));
}

function sub(ctx: BuiltinContext, from: (s: string) => [number, number]): PplValue {
  const s = text(ctx, 0);
  const [a, b] = from(s);
  return str(s.slice(Math.max(0, a), Math.max(0, b)));
}

const B: Record<string, BuiltinSpec> = {
  PRINT: {
    min: 0,
    max: 1,
    fn: (ctx) => {
      if (!ctx.args.length) ctx.host.clearTerminal?.();
      else ctx.host.print(ctx.format(ctx.args[0]));
      return TRUE;
    },
  },
  MSGBOX: {
    min: 1,
    max: 1,
    async: true,
    fn: async (ctx) => {
      await ctx.host.msgbox(ctx.format(ctx.args[0]));
      ctx.checkCancel();
      return TRUE;
    },
  },
  INPUT: { min: 1, max: 5, async: true, ref: true, fn: input },
  CHOOSE: { min: 3, max: 64, async: true, ref: true, fn: choose },
  WAIT: {
    min: 0,
    max: 1,
    async: true,
    fn: async (ctx) => {
      const s = ctx.args.length ? num(ctx, 0) : 0;
      await ctx.host.wait(s);
      ctx.checkCancel();
      return TRUE;
    },
  },
  GETKEY: { min: 0, max: 0, fn: (ctx) => real(ctx.host.getKey() ?? -1) },
  ISKEYDOWN: { min: 1, max: 1, fn: (ctx) => (ctx.host.isKeyDown(num(ctx, 0)) ? TRUE : FALSE) },
  RECT: { min: 0, max: 7, fn: rect },
  RECT_P: { min: 0, max: 7, fn: rect },
  LINE: { min: 4, max: 6, fn: line },
  LINE_P: { min: 4, max: 6, fn: line },
  PIXON: { min: 2, max: 4, fn: pixon },
  PIXON_P: { min: 2, max: 4, fn: pixon },
  TEXTOUT: { min: 3, max: 8, fn: textout },
  TEXTOUT_P: { min: 3, max: 8, fn: textout },
  FILLPOLY: { min: 1, max: 3, fn: fillpoly },
  FILLPOLY_P: { min: 1, max: 3, fn: fillpoly },
  BLIT: { min: 1, max: 12, fn: blit },
  BLIT_P: { min: 1, max: 12, fn: blit },
  RGB: {
    min: 3,
    max: 4,
    fn: (ctx) => {
      const c = (k: number) => Math.max(0, Math.min(255, Math.round(num(ctx, k))));
      return real(c(0) * 65536 + c(1) * 256 + c(2));
    },
  },
  DIM: { min: 1, max: 1, fn: size },
  SIZE: { min: 1, max: 1, fn: size },
  CONCAT: { min: 2, max: 2, fn: concat },
  STRING: { min: 1, max: 1, fn: (ctx) => str(ctx.format(ctx.args[0])) },
  EXPR: { min: 1, max: 1, async: true, fn: (ctx) => ctx.evalString(text(ctx, 0)) },
  RANDOM: { min: 0, max: 2, fn: random },
  RANDINT: { min: 1, max: 2, fn: randint },
  TICKS: { min: 0, max: 0, fn: (ctx) => real(Math.round(ctx.now())) },
  IP: { min: 1, max: 1, fn: (ctx) => real(Math.trunc(num(ctx, 0))) },
  FP: {
    min: 1,
    max: 1,
    fn: (ctx) => {
      const x = num(ctx, 0);
      return real(x - Math.trunc(x));
    },
  },
  LEFT: { min: 2, max: 2, fn: (ctx) => sub(ctx, () => [0, int(ctx, 1)]) },
  RIGHT: { min: 2, max: 2, fn: (ctx) => sub(ctx, (s) => [s.length - int(ctx, 1), s.length]) },
  MID: {
    min: 2,
    max: 3,
    fn: (ctx) =>
      sub(ctx, (s) => {
        const a = int(ctx, 1) - 1;
        return [a, ctx.args.length > 2 ? a + int(ctx, 2) : s.length];
      }),
  },
  INSTRING: { min: 2, max: 2, fn: (ctx) => real(text(ctx, 0).indexOf(text(ctx, 1)) + 1) },
  UPPER: { min: 1, max: 1, fn: (ctx) => str(text(ctx, 0).toUpperCase()) },
  LOWER: { min: 1, max: 1, fn: (ctx) => str(text(ctx, 0).toLowerCase()) },
  CHAR: { min: 1, max: 1, fn: char },
  ASC: {
    min: 1,
    max: 1,
    fn: (ctx) => ({
      kind: 'list',
      items: [...text(ctx, 0)].map((c) => real(c.codePointAt(0) ?? 0)),
    }),
  },
  TYPE: {
    min: 1,
    max: 1,
    fn: (ctx) => {
      const order = ['real', 'int', 'string', 'complex', 'matrix', 'unit', 'list'];
      return real(order.indexOf(ctx.args[0].kind));
    },
  },
};

/** Builtin by name (any case). */
export function lookupBuiltin(name: string): BuiltinSpec | undefined {
  return B[name.toUpperCase()];
}

/** All builtin names (upper case), for help and highlighting. */
export const BUILTIN_NAMES: readonly string[] = Object.keys(B);

/** Graphics builtins accept G0–G9 as arguments. */
export const isGraphicsBuiltin = (upper: string) =>
  /^(RECT|LINE|PIXON|TEXTOUT|FILLPOLY|BLIT)(_P)?$/.test(upper);
