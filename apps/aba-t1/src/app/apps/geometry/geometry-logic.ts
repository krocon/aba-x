/**
 * Geometry app of ABA-T1 (prompt 042), pure wiring: the app state (construction script + display
 * options), rebuilding a construction from its script, the drawing tools of the Plot view, hit
 * testing, snapping, and the measurements of the Num view. All geometry maths lives in
 * `@aba/math/geometry`; this file only maps names, picks and texts onto it.
 */
import { COMMANDS, type GeoCommand, allowedAt } from '@aba/math/geometry/commands';
import { intersectionCandidates, tangentLine } from '@aba/math/geometry/constructions';
import {
  type Equation,
  angle,
  angleBetween,
  area,
  arcLength,
  collinear,
  concyclic,
  coordinates,
  distance,
  equation,
  equilateral,
  isosceles,
  length,
  onObject,
  parallel,
  perpendicular,
  radius,
  slope,
} from '@aba/math/geometry/measure';
import { Construction, type GeoObject } from '@aba/math/geometry/model';
import {
  LINEAR_KINDS,
  type Shape,
  type ShapeKind,
  type Vec,
  characteristicPoints,
  dist,
} from '@aba/math/geometry/shapes';
import type { Viewport } from '@aba/math/graph/viewport';
import { niceStep } from '@aba/math/graph/viewport';
import type { AngleMode } from '@aba/math/numeric/evaluate';
import { type MathResult, fail, ok } from '@aba/math/result';
import { type NumberFormat, formatReal } from '@aba/math/value/format';

export interface GeometryState {
  /** the construction as commands, one `name = command(args)` per line */
  script: string;
  hidden: string[];
  /** user colours by object name */
  colors: Record<string, string>;
  /** points that leave a trace while dragging */
  trace: string[];
  /** measurement expressions of the Num view, e.g. `distance(GA, GB)` */
  measures: string[];
  view: Viewport;
  /** equal units on both axes (circles stay round) */
  equal: boolean;
  /** grid and axes */
  axes: boolean;
}

export const GEOMETRY_VIEW: Viewport = { xmin: -10, xmax: 10, ymin: -7.5, ymax: 7.5 };

export const initGeometryState = (): GeometryState => ({
  script: '',
  hidden: [],
  colors: {},
  trace: [],
  measures: [],
  view: GEOMETRY_VIEW,
  equal: true,
  axes: true,
});

// --- construction ---------------------------------------------------------------------------

export interface Built {
  c: Construction;
  /** lines of the script that could not be replayed (e.g. edited by hand) */
  errors: { line: string; message: string }[];
}

export const scriptLines = (script: string): string[] =>
  script
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/** Replays a script; hidden objects are marked. */
export function build(script: string, hidden: readonly string[] = []): Built {
  const c = new Construction();
  const errors: Built['errors'] = [];
  for (const line of scriptLines(script)) {
    const r = c.run(line);
    if (!r.ok) errors.push({ line, message: r.error.message });
  }
  for (const n of hidden) if (c.get(n)) c.setHidden(n, true);
  return { c, errors };
}

/**
 * Replaces the definition of object `name` (the line keeps its place) and replays the script.
 * Definitions can only use objects defined above them; on any error nothing changes.
 */
export function redefine(script: string, name: string, definition: string): MathResult<string> {
  const lines = scriptLines(script);
  const i = lines.findIndex((l) => l.split('=')[0].trim() === name);
  if (i < 0) return fail('unknown-symbol', `unknown object ${name}`);
  const def = definition.includes('=') ? definition.slice(definition.indexOf('=') + 1) : definition;
  lines[i] = `${name} = ${def.trim()}`;
  const b = build(lines.join('\n'));
  if (b.errors.length) return fail('syntax', b.errors[0].message);
  return ok(b.c.script());
}

const word = (name: string) => new RegExp(`\\b${name}\\b`, 'g');

/** The state after renaming an object: hidden, colours, traces and measurements follow. */
export function renamed(s: GeometryState, from: string, to: string, script: string): GeometryState {
  const map = (n: string) => (n === from ? to : n);
  const colors: Record<string, string> = {};
  for (const [k, v] of Object.entries(s.colors)) colors[map(k)] = v;
  return {
    ...s,
    script,
    hidden: s.hidden.map(map),
    colors,
    trace: s.trace.map(map),
    measures: s.measures.map((m) => m.replace(word(from), to)),
  };
}

/** The state after deleting objects: references to them disappear. */
export function withoutObjects(
  s: GeometryState,
  gone: readonly string[],
  script: string,
): GeometryState {
  const g = new Set(gone);
  const colors: Record<string, string> = {};
  for (const [k, v] of Object.entries(s.colors)) if (!g.has(k)) colors[k] = v;
  return {
    ...s,
    script,
    hidden: s.hidden.filter((n) => !g.has(n)),
    colors,
    trace: s.trace.filter((n) => !g.has(n)),
    measures: s.measures.filter((m) => !gone.some((n) => word(n).test(m))),
  };
}

// --- view -----------------------------------------------------------------------------------

/** The window with equal units on both axes: the x range stays, y is fitted around its centre. */
export function equalView(v: Viewport, size: { width: number; height: number }): Viewport {
  if (!(size.width > 0) || !(size.height > 0)) return v;
  const h = ((v.xmax - v.xmin) * size.height) / size.width;
  const cy = (v.ymin + v.ymax) / 2;
  return { xmin: v.xmin, xmax: v.xmax, ymin: cy - h / 2, ymax: cy + h / 2 };
}

/** Grid for new and dragged points: a nice step of about two pixels. */
export function snapStep(v: Viewport, width: number): number {
  return niceStep(v.xmax - v.xmin, Math.max(1, width / 2));
}

export function snap(x: number, step: number): number {
  return Number((Math.round(x / step) * step).toPrecision(12));
}

/** A window showing every visible figure (with a margin), or `null` for an empty scene. */
export function fitView(c: Construction): Viewport | null {
  let xmin = Infinity;
  let xmax = -Infinity;
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const o of c.objects()) {
    if (o.hidden) continue;
    for (const p of characteristicPoints(o.value)) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      xmin = Math.min(xmin, p.x);
      xmax = Math.max(xmax, p.x);
      ymin = Math.min(ymin, p.y);
      ymax = Math.max(ymax, p.y);
    }
  }
  if (!Number.isFinite(xmin)) return null;
  const w = Math.max(xmax - xmin, ymax - ymin, 1) * 0.6;
  const cx = (xmin + xmax) / 2;
  const cy = (ymin + ymax) / 2;
  return { xmin: cx - w, xmax: cx + w, ymin: cy - w, ymax: cy + w };
}

// --- hit testing ----------------------------------------------------------------------------

/**
 * The visible object nearest to `at` within `tol` (world units) whose kinds meet `accept`;
 * points win over other figures so that vertices can be picked on top of their segments.
 */
export function hitTest(
  c: Construction,
  at: Vec,
  tol: number,
  accept: (o: GeoObject) => boolean = () => true,
): GeoObject | undefined {
  let bestPoint: { o: GeoObject; d: number } | undefined;
  let best: { o: GeoObject; d: number } | undefined;
  const probe: Shape = { kind: 'point', p: at };
  for (const o of c.objects()) {
    if (o.hidden || o.value.kind === 'number' || o.value.kind === 'undefined' || !accept(o))
      continue;
    const r = distance(probe, o.value);
    if (!r.ok || !(r.value <= tol)) continue;
    if (o.value.kind === 'point') {
      if (!bestPoint || r.value < bestPoint.d) bestPoint = { o, d: r.value };
    } else if (!best || r.value < best.d) best = { o, d: r.value };
  }
  return (bestPoint ?? best)?.o;
}

// --- tools ----------------------------------------------------------------------------------

export type ToolGroup = 'lines' | 'polygons' | 'curves' | 'transform' | 'measure';

export interface Tool {
  /** also the text key `geo.t.<id>` */
  id: string;
  group: ToolGroup;
  /** construction command, or a measurement (`measure`) */
  cmd?: GeoCommand;
  measure?: string;
  /** kinds of the objects to pick, one entry per tap */
  steps: readonly (readonly ShapeKind[])[];
  /** any number of points (polygon): tapping the first one again closes */
  many?: boolean;
  /** a number asked after the picks (radius, n, angle, factor, slider value) */
  num?: { label: string; def: string; angle?: boolean };
}

const P: readonly ShapeKind[] = ['point'];
const LIN = LINEAR_KINDS;
const C: readonly ShapeKind[] = ['circle'];
const FIG: readonly ShapeKind[] = [
  'point',
  'line',
  'ray',
  'segment',
  'circle',
  'polygon',
  'conic',
  'polyline',
];
const CARRIERS: readonly ShapeKind[] = ['line', 'ray', 'segment', 'circle', 'polygon', 'conic'];

/** Steps of a command: its required, non-number arguments. */
const stepsOf = (cmd: GeoCommand, n = COMMANDS[cmd].min): (readonly ShapeKind[])[] =>
  Array.from({ length: n }, (_, i) => allowedAt(cmd, i)!.filter((k) => k !== 'number'));

const t = (id: string, group: ToolGroup, cmd: GeoCommand, extra: Partial<Tool> = {}): Tool => ({
  id,
  group,
  cmd,
  steps: stepsOf(cmd),
  ...extra,
});
const m = (id: string, steps: (readonly ShapeKind[])[]): Tool => ({
  id,
  group: 'measure',
  measure: id,
  steps,
});

export const TOOLS: readonly Tool[] = [
  { id: 'point', group: 'lines', cmd: 'point', steps: [[...P, ...CARRIERS]] },
  t('midpoint', 'lines', 'midpoint', { steps: [['point', 'segment'], P] }),
  t('intersect', 'lines', 'intersect'),
  t('segment', 'lines', 'segment'),
  t('ray', 'lines', 'ray'),
  t('line', 'lines', 'line'),
  t('parallel', 'lines', 'parallel'),
  t('perpendicular', 'lines', 'perpendicular'),
  t('perpBisector', 'lines', 'perpBisector', { steps: [['point', 'segment'], P] }),
  t('angleBisector', 'lines', 'angleBisector'),
  t('tangent', 'lines', 'tangent'),
  t('altitude', 'lines', 'altitude'),
  t('median', 'lines', 'median'),
  t('locus', 'lines', 'locus'),
  t('slider', 'lines', 'slider', { steps: [], num: { label: 'value', def: '1' } }),
  t('triangle', 'polygons', 'triangle'),
  t('polygon', 'polygons', 'polygon', { many: true }),
  t('equilateral', 'polygons', 'equilateral'),
  t('square', 'polygons', 'square'),
  t('parallelogram', 'polygons', 'parallelogram'),
  t('regularPolygon', 'polygons', 'regularPolygon', {
    steps: [P, P],
    num: { label: 'n', def: '6' },
  }),
  t('circle', 'curves', 'circle'),
  t('circleR', 'curves', 'circle', { steps: [P], num: { label: 'r', def: '2' } }),
  t('circle3', 'curves', 'circle', { steps: [P, P, P] }),
  t('circumcircle', 'curves', 'circumcircle'),
  t('incircle', 'curves', 'incircle'),
  t('excircle', 'curves', 'excircle'),
  t('ellipse', 'curves', 'ellipse'),
  t('hyperbola', 'curves', 'hyperbola'),
  t('parabola', 'curves', 'parabola'),
  t('conic', 'curves', 'conic'),
  t('translate', 'transform', 'translate', { steps: [FIG, P, P] }),
  t('rotate', 'transform', 'rotate', {
    steps: [FIG, P],
    num: { label: 'α', def: '90', angle: true },
  }),
  t('reflect', 'transform', 'reflect'),
  t('dilate', 'transform', 'dilate', { steps: [FIG, P], num: { label: 'k', def: '2' } }),
  t('project', 'transform', 'project'),
  t('invert', 'transform', 'invert'),
  m('coordinates', [P]),
  m('distance', [P, [...P, ...CARRIERS]]),
  m('length', [['segment', 'circle', 'polygon', 'conic', 'polyline']]),
  m('area', [['polygon', 'circle', 'conic']]),
  m('slope', [LIN]),
  m('angle', [P, P, P]),
  m('radius', [C]),
  m('equation', [[...LIN, 'circle', 'conic']]),
  m('isCollinear', [P, P, P]),
  m('isParallel', [LIN, LIN]),
  m('isPerpendicular', [LIN, LIN]),
  m('isOn', [P, [...CARRIERS, 'polyline']]),
];

export const toolById = (id: string): Tool | undefined => TOOLS.find((x) => x.id === id);

/** Whether a tap on empty space at this step creates a free point. */
export const createsPoint = (step: readonly ShapeKind[] | undefined, tool: Tool): boolean =>
  !!step && step.includes('point') && !tool.measure && !step.includes('circle');

/** Whether the tool is complete with these picks (a segment can replace two points). */
export function toolComplete(tool: Tool, picks: readonly GeoObject[]): boolean {
  if (tool.many) return false;
  if ((tool.id === 'midpoint' || tool.id === 'perpBisector') && picks[0]?.kinds.includes('segment'))
    return picks.length === 1;
  return picks.length >= tool.steps.length;
}

/** Kinds accepted at the next step. */
export function nextStep(tool: Tool, picks: readonly GeoObject[]): readonly ShapeKind[] {
  if (tool.many) return P;
  return tool.steps[picks.length] ?? [];
}

/**
 * Index of an ambiguous construction (intersection, tangent) that lies nearest to the tap point,
 * so the user gets the solution they pointed at.
 */
export function chooseIndex(
  cmd: GeoCommand,
  shapes: readonly Shape[],
  at: Vec,
  eps: number,
): number {
  if (cmd === 'intersect') {
    const cand = intersectionCandidates(shapes[0], shapes[1], eps);
    if (!cand.ok || cand.pts.length < 2) return 1;
    return dist(cand.pts[0].p, at) <= dist(cand.pts[1].p, at) ? 1 : 2;
  }
  if (cmd === 'tangent' && shapes[0].kind === 'point' && shapes[1].kind === 'circle') {
    const probe: Shape = { kind: 'point', p: at };
    const d = [1, 2].map((i) => {
      const l = tangentLine(
        (shapes[0] as { p: Vec }).p,
        (shapes[1] as { c: Vec }).c,
        (shapes[1] as { r: number }).r,
        i,
        eps,
      );
      const r = distance(probe, l);
      return r.ok ? r.value : Infinity;
    });
    return d[1] < d[0] ? 2 : 1;
  }
  return 1;
}

// --- measurements ---------------------------------------------------------------------------

export type Measured =
  | { kind: 'number'; v: number; angle?: boolean }
  | { kind: 'point'; p: Vec }
  | { kind: 'bool'; v: boolean }
  | { kind: 'equation'; eq: Equation };

type Run = (s: Shape[], scale: number) => MathResult<Measured>;
const num =
  (f: (...s: Shape[]) => MathResult<number>, isAngle = false): Run =>
  (s) => {
    const r = f(...s);
    return r.ok ? ok({ kind: 'number', v: r.value, ...(isAngle ? { angle: true } : {}) }) : r;
  };
const test =
  (f: (s: Shape[], scale: number) => MathResult<boolean>): Run =>
  (s, scale) => {
    const r = f(s, scale);
    return r.ok ? ok({ kind: 'bool', v: r.value }) : r;
  };

export const MEASURES: Record<string, { usage: string; min: number; max: number; run: Run }> = {
  coordinates: {
    usage: 'coordinates(P)',
    min: 1,
    max: 1,
    run: (s) => {
      const r = coordinates(s[0]);
      return r.ok ? ok({ kind: 'point', p: r.value }) : r;
    },
  },
  distance: { usage: 'distance(A, B)', min: 2, max: 2, run: num(distance) },
  length: { usage: 'length(object)', min: 1, max: 1, run: num(length) },
  area: { usage: 'area(object)', min: 1, max: 1, run: num(area) },
  slope: { usage: 'slope(line)', min: 1, max: 1, run: num(slope) },
  angle: {
    usage: 'angle(A, B, C) | angle(line1, line2)',
    min: 2,
    max: 3,
    run: (s) => (s.length === 3 ? num(angle, true)(s, 1) : num(angleBetween, true)(s, 1)),
  },
  radius: { usage: 'radius(circle)', min: 1, max: 1, run: num(radius) },
  arcLength: { usage: 'arcLength(circle, A, B)', min: 3, max: 3, run: num(arcLength) },
  equation: {
    usage: 'equation(object)',
    min: 1,
    max: 1,
    run: (s) => {
      const r = equation(s[0]);
      return r.ok ? ok({ kind: 'equation', eq: r.value }) : r;
    },
  },
  isCollinear: {
    usage: 'isCollinear(A, B, C)',
    min: 3,
    max: 3,
    run: test((s, scale) => collinear(s[0], s[1], s[2], { scale })),
  },
  isConcyclic: {
    usage: 'isConcyclic(A, B, C, D)',
    min: 4,
    max: 4,
    run: test((s, scale) => concyclic(s[0], s[1], s[2], s[3], { scale })),
  },
  isParallel: {
    usage: 'isParallel(line1, line2)',
    min: 2,
    max: 2,
    run: test((s) => parallel(s[0], s[1])),
  },
  isPerpendicular: {
    usage: 'isPerpendicular(line1, line2)',
    min: 2,
    max: 2,
    run: test((s) => perpendicular(s[0], s[1])),
  },
  isEquilateral: {
    usage: 'isEquilateral(polygon) | isEquilateral(A, B, C)',
    min: 1,
    max: 3,
    run: test((s, scale) => equilateral({ scale }, ...s)),
  },
  isIsosceles: {
    usage: 'isIsosceles(triangle) | isIsosceles(A, B, C)',
    min: 1,
    max: 3,
    run: test((s, scale) => isosceles({ scale }, ...s)),
  },
  isOn: {
    usage: 'isOn(P, object)',
    min: 2,
    max: 2,
    run: test((s, scale) => onObject(s[0], s[1], { scale })),
  },
};

/** Evaluates `fn(name, …)` or a single object name (its value) against the construction. */
export function measure(c: Construction, text: string): MathResult<Measured> {
  const m = /^\s*([A-Za-z]\w*)\s*(?:\(([^()]*)\))?\s*$/.exec(text);
  if (!m) return fail('syntax', 'expected  measurement(object, …)');
  if (m[2] === undefined) {
    const o = c.get(m[1]);
    if (!o) return fail('unknown-symbol', `unknown object ${m[1]}`);
    return valueOf(o.value);
  }
  const spec = MEASURES[m[1]];
  if (!spec) return fail('unknown-function', `unknown measurement ${m[1]}`);
  const names = m[2]
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  if (names.length < spec.min || names.length > spec.max)
    return fail('syntax', `usage: ${spec.usage}`);
  const shapes: Shape[] = [];
  for (const n of names) {
    const o = c.get(n);
    if (!o) return fail('unknown-symbol', `unknown object ${n}`);
    shapes.push(o.value);
  }
  return spec.run(shapes, c.scale());
}

function valueOf(s: Shape): MathResult<Measured> {
  switch (s.kind) {
    case 'point':
      return ok({ kind: 'point', p: s.p });
    case 'number':
      return ok({ kind: 'number', v: s.value });
    case 'undefined':
      return fail('not-evaluable', `undefined object: ${s.reason}`);
    default: {
      const e = equation(s);
      return e.ok ? ok({ kind: 'equation', eq: e.value }) : fail('domain', `a ${s.kind}`);
    }
  }
}

/** Measurements that make sense for an object (Plot → Measure on a selection). */
export function defaultMeasures(o: GeoObject): string[] {
  const n = o.name;
  switch (o.value.kind) {
    case 'point':
      return [`coordinates(${n})`];
    case 'segment':
      return [`length(${n})`, `slope(${n})`];
    case 'line':
    case 'ray':
      return [`equation(${n})`, `slope(${n})`];
    case 'circle':
      return [`radius(${n})`, `area(${n})`, `equation(${n})`];
    case 'polygon':
      return [`area(${n})`, `length(${n})`];
    case 'conic':
      return [`equation(${n})`];
    case 'number':
      return [n];
    default:
      return [`length(${n})`];
  }
}

// --- formatting -----------------------------------------------------------------------------

export interface FormatOptions {
  format: NumberFormat;
  angle: AngleMode;
  yes: string;
  no: string;
}

export function fmtNumber(x: number, f: NumberFormat): string {
  if (!Number.isFinite(x)) return '—';
  return formatReal(Math.abs(x) < 1e-12 ? 0 : x, f);
}

const fmtPoint = (p: Vec, f: NumberFormat): string =>
  `(${fmtNumber(p.x, f)}, ${fmtNumber(p.y, f)})`;

/** `+ 2x` / `− 2x` terms with a leading sign; zero terms vanish. */
function terms(parts: [number, string][], f: NumberFormat): string {
  let out = '';
  for (const [k, sym] of parts) {
    if (Math.abs(k) < 1e-12) continue;
    const a = Math.abs(k);
    const body = sym && Math.abs(a - 1) < 1e-12 ? sym : `${fmtNumber(a, f)}${sym}`;
    out += out ? ` ${k < 0 ? '−' : '+'} ${body}` : `${k < 0 ? '−' : ''}${body}`;
  }
  return out || '0';
}

export function fmtEquation(eq: Equation, f: NumberFormat): string {
  if (eq.kind === 'line') {
    if (Math.abs(eq.b) > 1e-12) {
      // y = m x + q
      return `y = ${terms(
        [
          [-eq.a / eq.b, 'x'],
          [-eq.c / eq.b, ''],
        ],
        f,
      )}`;
    }
    return `x = ${fmtNumber(-eq.c / eq.a, f)}`;
  }
  if (eq.kind === 'circle') {
    const shift = (v: string, c: number) =>
      Math.abs(c) < 1e-12 ? `${v}²` : `(${v} ${c < 0 ? '+' : '−'} ${fmtNumber(Math.abs(c), f)})²`;
    return `${shift('x', eq.center.x)} + ${shift('y', eq.center.y)} = ${fmtNumber(eq.r * eq.r, f)}`;
  }
  const q = eq.coefficients;
  return `${terms(
    [
      [q.A, 'x²'],
      [q.B, 'xy'],
      [q.C, 'y²'],
      [q.D, 'x'],
      [q.E, 'y'],
      [q.F, ''],
    ],
    f,
  )} = 0`;
}

export function fmtMeasured(v: Measured, o: FormatOptions): string {
  switch (v.kind) {
    case 'number':
      if (v.angle && o.angle === 'deg') return `${fmtNumber((v.v * 180) / Math.PI, o.format)}°`;
      return fmtNumber(v.v, o.format);
    case 'point':
      return fmtPoint(v.p, o.format);
    case 'bool':
      return v.v ? o.yes : o.no;
    case 'equation':
      return fmtEquation(v.eq, o.format);
  }
}

/** Short description of an object's current value (Symb list, Plot status bar). */
export function fmtValue(s: Shape, f: NumberFormat): string {
  switch (s.kind) {
    case 'point':
      return fmtPoint(s.p, f);
    case 'number':
      return fmtNumber(s.value, f);
    case 'segment':
      return `${fmtPoint(s.a, f)} – ${fmtPoint(s.b, f)}`;
    case 'circle':
      return `${fmtPoint(s.c, f)}, r = ${fmtNumber(s.r, f)}`;
    case 'polygon':
      return s.pts.map((p) => fmtPoint(p, f)).join(' ');
    case 'polyline':
      return '…';
    case 'undefined':
      return s.reason;
    default: {
      const e = equation(s);
      return e.ok ? fmtEquation(e.value, f) : s.kind;
    }
  }
}

// --- colours --------------------------------------------------------------------------------

export const PALETTE = ['#ff6b6b', '#5aa0f0', '#4fd1a5', '#c792ea', '#f28c28', '#e6e6e6'];

export function colorOf(o: GeoObject, colors: Record<string, string>): string {
  const own = colors[o.name];
  if (own) return own;
  switch (o.kinds[0]) {
    case 'point':
      return PALETTE[0];
    case 'line':
    case 'ray':
    case 'segment':
      return PALETTE[1];
    case 'circle':
    case 'conic':
      return PALETTE[2];
    case 'polygon':
      return PALETTE[3];
    default:
      return PALETTE[4];
  }
}

export const nextColor = (current: string): string =>
  PALETTE[(PALETTE.indexOf(current) + 1) % PALETTE.length];
