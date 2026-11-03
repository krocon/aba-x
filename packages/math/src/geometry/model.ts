/**
 * Dynamic geometry model (prompt 042): a construction is a dependency graph of named objects
 * (GA, GB, … or user names). Free objects (free points, sliders, points on objects) can be moved;
 * every dependant is recomputed in topological order. Errors are `MathResult`s; degenerate
 * configurations give objects the state `undefined` (with a reason) instead of invented figures.
 *
 * Topological order: an object can only reference objects that already exist and definitions never
 * change after creation, so creation order (ascending id) is a topological order of the graph.
 *
 * Branch stability: an ambiguous intersection (line ∩ circle, circle ∩ circle, line ∩ conic) keeps
 * the solution nearest to its previous position while dragging; only when it had no previous
 * position (new, or undefined before) does its index pick the solution in canonical order.
 *
 * Text commands (`run`): `[name =] command(arg, …)` with the commands of `commands.ts`. An argument
 * is an object name or a constant expression (`2`, `-1.5`, `pi/3`, `sqrt(2)`).
 */
import { evaluateNumeric } from '../numeric/evaluate';
import { parseText } from '../parser/text-parser';
import { type MathResult, fail, ok } from '../result';
import {
  COMMANDS,
  type CommandContext,
  type GeoCommand,
  allowedAt,
  isCommand,
  maxArgs,
} from './commands';
import { classifyConic } from './conic';
import { nearestParameter, pointOn } from './constructions';
import { type Shape, type ShapeKind, type Vec, characteristicPoints, undef } from './shapes';

export type { GeoCommand } from './commands';

/** Argument of a definition: a reference to another object (by id) or a number literal. */
export type GeoArg = { readonly ref: number } | { readonly num: number };

/** Argument for `add`: an object name, an object, or a number literal. */
export type GeoArgInput = string | number | { readonly id: number };

export interface GeoObject {
  readonly id: number;
  readonly name: string;
  readonly cmd: GeoCommand;
  readonly args: readonly GeoArg[];
  /** Kinds the value can take (static, from the definition). */
  readonly kinds: readonly ShapeKind[];
  /** Current value; `kind: 'undefined'` in degenerate configurations. */
  readonly value: Shape;
  readonly hidden: boolean;
}

interface Rec {
  readonly id: number;
  name: string;
  readonly cmd: GeoCommand;
  args: GeoArg[];
  readonly kinds: readonly ShapeKind[];
  value: Shape;
  hidden: boolean;
}

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
/** Names that would shadow constants in arguments. */
const RESERVED = new Set(['pi']);
/** Samples of a locus. */
const LOCUS_SAMPLES = 240;

/** Shortest exact form, so `script()` replays bit-identically. */
const fmt = (n: number): string => String(n);
const isRef = (a: GeoArg): a is { readonly ref: number } => 'ref' in a;

export class Construction {
  private readonly recs = new Map<number, Rec>();
  private nextId = 1;

  /** All objects in creation (= topological) order. */
  objects(): readonly GeoObject[] {
    return [...this.recs.values()];
  }

  /** Object by name or id. */
  get(ref: string | number | { readonly id: number }): GeoObject | undefined {
    return this.find(ref);
  }

  /** Current value by name or id (`undefined` shape for unknown objects). */
  shape(ref: string | number): Shape {
    return this.find(ref)?.value ?? undef(`unknown object ${ref}`);
  }

  /** Scene size: largest coordinate magnitude of all figures (at least 1). */
  scale(): number {
    let m = 1;
    for (const r of this.recs.values()) {
      for (const p of characteristicPoints(r.value)) {
        const v = Math.max(Math.abs(p.x), Math.abs(p.y));
        if (Number.isFinite(v)) m = Math.max(m, v);
      }
    }
    return m;
  }

  /** Absolute length tolerance of degeneracy tests (relative to the scene size). */
  tolerance(): number {
    return 1e-9 * this.scale();
  }

  /** Creates an object; `name` defaults to the next free GA, GB, … */
  add(cmd: string, inputs: readonly GeoArgInput[], name?: string): MathResult<GeoObject> {
    if (!isCommand(cmd)) return fail('unknown-function', `unknown geometry command ${cmd}`);
    const spec = COMMANDS[cmd];
    if (inputs.length < spec.min || inputs.length > maxArgs(cmd))
      return fail('syntax', `usage: ${spec.usage}`);
    const args: GeoArg[] = [];
    for (const input of inputs) {
      if (typeof input === 'number') {
        if (!Number.isFinite(input)) return fail('domain', 'numbers must be finite');
        args.push({ num: input });
        continue;
      }
      const r = this.find(input);
      if (!r) return fail('unknown-symbol', `unknown object ${String(input)}`);
      args.push({ ref: r.id });
    }
    for (let i = args.length; i < spec.args.length; i++) {
      const d = spec.defaults?.[i];
      if (d === undefined) break;
      args.push({ num: d });
    }
    const kinds = args.map((a) => (isRef(a) ? this.recs.get(a.ref)!.kinds : (['number'] as const)));
    for (let i = 0; i < kinds.length; i++) {
      const allowed = allowedAt(cmd, i)!;
      if (!kinds[i].some((k) => allowed.includes(k)))
        return fail('domain', `argument ${i + 1} of ${cmd} must be: ${allowed.join(' or ')}`);
    }
    if (cmd === 'slider' && args.some(isRef))
      return fail('domain', 'slider takes number literals only');
    const out = spec.out(kinds);
    if (typeof out === 'string') return fail('unsupported', out);
    const finalName = name ?? this.nextName();
    const bad = this.checkName(finalName);
    if (bad) return fail('syntax', bad);
    const rec: Rec = {
      id: this.nextId++,
      name: finalName,
      cmd,
      args,
      kinds: out,
      value: undef('not computed'),
      hidden: false,
    };
    if (cmd === 'locus') {
      const q = this.recs.get((args[1] as { ref: number }).ref)!;
      if (q.cmd !== 'pointOn' || isRef(q.args[1]))
        return fail('domain', 'the second argument of locus must be a point on an object');
      if (!this.descendants(q.id).has((args[0] as { ref: number }).ref))
        return fail('domain', 'the point does not depend on the point on the object');
    }
    this.recs.set(rec.id, rec);
    rec.value = this.compute(rec, (id) => this.recs.get(id)!.value, this.context(undefined));
    return ok(rec);
  }

  /** Runs one text command: `[name =] command(args)`, e.g. `c = circle(GA, GB)`. */
  run(text: string): MathResult<GeoObject> {
    const m = /^\s*(?:([A-Za-z_]\w*)\s*:?=\s*)?([A-Za-z]\w*)\s*\(([\s\S]*)\)\s*$/.exec(text);
    if (!m) return fail('syntax', 'expected  name = command(arguments)');
    const parts = splitArgs(m[3]);
    if (!parts) return fail('syntax', 'unbalanced parentheses');
    const inputs: GeoArgInput[] = [];
    for (const part of parts) {
      if (NAME.test(part) && this.find(part)) {
        inputs.push(part);
        continue;
      }
      const e = parseText(part);
      if (!e.ok) return e;
      const v = evaluateNumeric(e.value);
      if (!v.ok) return NAME.test(part) ? fail('unknown-symbol', `unknown object ${part}`) : v;
      inputs.push(v.value);
    }
    return this.add(m[2], inputs, m[1]);
  }

  /** Definition as a command, e.g. `circle(GA, GB)`. */
  describe(ref: string | number): string | undefined {
    const r = this.find(ref);
    if (!r) return undefined;
    const args = r.args.map((a) => (isRef(a) ? this.recs.get(a.ref)!.name : fmt(a.num)));
    return `${r.cmd}(${args.join(', ')})`;
  }

  /** The whole construction as commands, one per line (replayable with `run`). */
  script(): string {
    return [...this.recs.values()].map((r) => `${r.name} = ${this.describe(r.id)}`).join('\n');
  }

  /** Whether the object can be dragged or set directly (free point, slider, point on object). */
  isFree(ref: string | number): boolean {
    const r = this.find(ref);
    if (!r) return false;
    if (r.cmd === 'slider') return true;
    if (r.cmd === 'point') return !r.args.some(isRef);
    if (r.cmd === 'pointOn') return !isRef(r.args[1]);
    return false;
  }

  /**
   * Drags a free point to (x, y), or a point on an object to the nearest position on its object.
   * Returns the names of all recomputed objects.
   */
  movePoint(ref: string | number, x: number, y: number): MathResult<readonly string[]> {
    const r = this.find(ref);
    if (!r) return fail('unknown-symbol', `unknown object ${ref}`);
    if (!this.isFree(r.id) || r.cmd === 'slider')
      return fail('unsupported', `${r.name} is not a free point`);
    if (!Number.isFinite(x) || !Number.isFinite(y))
      return fail('domain', 'coordinates must be finite');
    if (r.cmd === 'point') {
      r.args = [{ num: x }, { num: y }];
    } else {
      const carrier = this.recs.get((r.args[0] as { ref: number }).ref)!.value;
      const t = nearestParameter(carrier, { x, y });
      if (t === undefined) return fail('domain', `${r.name} cannot move: its object is undefined`);
      r.args = [r.args[0], { num: t }];
    }
    return ok(this.update(r.id));
  }

  /** Sets a slider (clamped to its range). */
  setSlider(ref: string | number, value: number): MathResult<readonly string[]> {
    const r = this.find(ref);
    if (!r || r.cmd !== 'slider') return fail('unsupported', `${ref} is not a slider`);
    if (!Number.isFinite(value)) return fail('domain', 'the value must be finite');
    r.args = [{ num: value }, ...r.args.slice(1)];
    return ok(this.update(r.id));
  }

  /** Sets the parameter of a point on an object (see `pointOn` in constructions.ts). */
  setParameter(ref: string | number, t: number): MathResult<readonly string[]> {
    const r = this.find(ref);
    if (!r || r.cmd !== 'pointOn' || !this.isFree(r.id))
      return fail('unsupported', `${ref} is not a point on an object`);
    if (!Number.isFinite(t)) return fail('domain', 'the parameter must be finite');
    r.args = [r.args[0], { num: t }];
    return ok(this.update(r.id));
  }

  /** Deletes an object and, in cascade, everything that depends on it; returns the deleted names. */
  delete(ref: string | number): MathResult<readonly string[]> {
    const r = this.find(ref);
    if (!r) return fail('unknown-symbol', `unknown object ${ref}`);
    const gone = [r.id, ...this.descendants(r.id)].sort((a, b) => a - b);
    const names = gone.map((id) => this.recs.get(id)!.name);
    for (const id of gone) this.recs.delete(id);
    return ok(names);
  }

  rename(ref: string | number, name: string): MathResult<GeoObject> {
    const r = this.find(ref);
    if (!r) return fail('unknown-symbol', `unknown object ${ref}`);
    if (name === r.name) return ok(r);
    const bad = this.checkName(name);
    if (bad) return fail('syntax', bad);
    r.name = name;
    return ok(r);
  }

  setHidden(ref: string | number, hidden: boolean): MathResult<GeoObject> {
    const r = this.find(ref);
    if (!r) return fail('unknown-symbol', `unknown object ${ref}`);
    r.hidden = hidden;
    return ok(r);
  }

  /** Names of all objects that depend (directly or indirectly) on the object. */
  dependants(ref: string | number): readonly string[] {
    const r = this.find(ref);
    if (!r) return [];
    return [...this.descendants(r.id)].sort((a, b) => a - b).map((id) => this.recs.get(id)!.name);
  }

  /** Recomputes everything (e.g. after loading). */
  recomputeAll(): void {
    const ctxBase = this.context(undefined);
    for (const r of this.recs.values())
      r.value = this.compute(r, (id) => this.recs.get(id)!.value, { ...ctxBase, prev: r.value });
  }

  // ---------------------------------------------------------------------------------------------

  private find(ref: string | number | { readonly id: number }): Rec | undefined {
    if (typeof ref === 'number') return this.recs.get(ref);
    if (typeof ref === 'object') return this.recs.get(ref.id);
    for (const r of this.recs.values()) if (r.name === ref) return r;
    return undefined;
  }

  private checkName(name: string): string | undefined {
    if (!NAME.test(name) || RESERVED.has(name)) return `invalid name ${name}`;
    if (isCommand(name)) return `${name} is a command`;
    if (this.find(name)) return `the name ${name} is taken`;
    return undefined;
  }

  /** GA … GZ, then GA1 … GZ1, GA2 … */
  private nextName(): string {
    for (let round = 0; ; round++) {
      for (let c = 65; c <= 90; c++) {
        const n = `G${String.fromCharCode(c)}${round ? round : ''}`;
        if (!this.find(n)) return n;
      }
    }
  }

  /** Ids depending on `id`, in one pass thanks to the topological id order. */
  private descendants(id: number): Set<number> {
    const out = new Set<number>();
    for (const r of this.recs.values()) {
      if (r.id <= id) continue;
      if (r.args.some((a) => isRef(a) && (a.ref === id || out.has(a.ref)))) out.add(r.id);
    }
    return out;
  }

  private ancestors(id: number): Set<number> {
    const out = new Set<number>();
    const visit = (x: number): void => {
      for (const a of this.recs.get(x)?.args ?? [])
        if (isRef(a) && !out.has(a.ref)) {
          out.add(a.ref);
          visit(a.ref);
        }
    };
    visit(id);
    return out;
  }

  private context(prev: Shape | undefined): CommandContext {
    const scale = this.scale();
    return { eps: 1e-9 * scale, scale, prev };
  }

  /** Recomputes `id` and its dependants in topological order; returns their names. */
  private update(id: number): string[] {
    const ids = [id, ...this.descendants(id)].sort((a, b) => a - b);
    const base = this.context(undefined);
    for (const x of ids) {
      const r = this.recs.get(x)!;
      r.value = this.compute(r, (i) => this.recs.get(i)!.value, { ...base, prev: r.value });
    }
    return ids.map((x) => this.recs.get(x)!.name);
  }

  private compute(r: Rec, get: (id: number) => Shape, ctx: CommandContext): Shape {
    const vals: Shape[] = [];
    for (let i = 0; i < r.args.length; i++) {
      const a = r.args[i];
      const v: Shape = isRef(a) ? get(a.ref) : { kind: 'number', value: a.num };
      if (v.kind === 'undefined')
        return undef(`${isRef(a) ? this.recs.get(a.ref)!.name : 'an argument'} is undefined`);
      if (!allowedAt(r.cmd, i)!.includes(v.kind)) return undef(`unsupported argument ${i + 1}`);
      vals.push(v);
    }
    if (r.cmd === 'locus') return this.locus(r, ctx);
    const prev = ctx.prev?.kind === 'undefined' ? undefined : ctx.prev;
    return COMMANDS[r.cmd].compute(vals, { ...ctx, prev });
  }

  /**
   * Locus of P (args[0]) while the point on object Q (args[1]) runs along its object: the chain
   * between Q and P is re-evaluated for each sample of Q's parameter, the rest of the scene is fixed.
   */
  private locus(r: Rec, ctx: CommandContext): Shape {
    const pid = (r.args[0] as { ref: number }).ref;
    const q = this.recs.get((r.args[1] as { ref: number }).ref)!;
    const carrier = this.recs.get((q.args[0] as { ref: number }).ref)!.value;
    const anc = this.ancestors(pid);
    const chain = [...this.descendants(q.id)]
      .filter((id) => id === pid || anc.has(id))
      .sort((a, b) => a - b);
    const range = paramRange(carrier, ctx.scale);
    if (!range) return undef('the object of the point cannot be traversed');
    const overlay = new Map<number, Shape>();
    const get = (id: number): Shape => overlay.get(id) ?? this.recs.get(id)!.value;
    const paths: Vec[][] = [];
    let cur: Vec[] = [];
    const n = range.closed ? LOCUS_SAMPLES : LOCUS_SAMPLES + 1;
    for (let i = 0; i < n; i++) {
      const t = range.lo + ((range.hi - range.lo) * i) / LOCUS_SAMPLES;
      overlay.set(q.id, pointOn(carrier, t));
      for (const id of chain) {
        const c = this.recs.get(id)!;
        overlay.set(id, this.compute(c, get, { ...ctx, prev: overlay.get(id) ?? c.value }));
      }
      const v = get(pid);
      if (v.kind === 'point') cur.push(v.p);
      else if (cur.length) {
        paths.push(cur);
        cur = [];
      }
    }
    if (cur.length) paths.push(cur);
    if (!paths.length) return undef('the locus is empty');
    return { kind: 'polyline', paths, closed: range.closed && paths.length === 1 };
  }
}

/** Parameter range traversed by a locus. */
function paramRange(
  carrier: Shape,
  scale: number,
): { lo: number; hi: number; closed: boolean } | undefined {
  switch (carrier.kind) {
    case 'segment':
      return { lo: 0, hi: 1, closed: false };
    case 'polygon':
      return { lo: 0, hi: 1, closed: true };
    case 'circle':
      return { lo: 0, hi: 2 * Math.PI, closed: true };
    case 'line':
      return { lo: -4 * scale, hi: 4 * scale, closed: false };
    case 'ray':
      return { lo: 0, hi: 4 * scale, closed: false };
    case 'conic': {
      const form = classifyConic(carrier.q);
      if (form.type === 'ellipse') return { lo: 0, hi: 2 * Math.PI, closed: true };
      if (form.type === 'hyperbola') return { lo: -3, hi: 3, closed: false };
      if (form.type === 'parabola') return { lo: -2 * scale, hi: 2 * scale, closed: false };
      return undefined;
    }
    default:
      return undefined;
  }
}

/** Splits at top-level commas; `undefined` for unbalanced parentheses. */
function splitArgs(s: string): string[] | undefined {
  if (!s.trim()) return [];
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) {
      out.push(s.slice(start, i).trim());
      start = i + 1;
    }
    if (depth < 0) return undefined;
  }
  if (depth !== 0) return undefined;
  out.push(s.slice(start).trim());
  return out;
}
