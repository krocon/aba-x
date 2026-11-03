/**
 * Python app (prompt 047), pure: messages between the app and the Python worker, the exchange of
 * calculator variables as JSON (numbers, complex numbers as {re, im}, lists, matrices) and the
 * Python modules of the bridge (`calc`, `graphic`).
 */
import type { Value } from '@aba/math/value/value';
import type { GfxCommand } from '@aba/ppl';

export interface ToWorker {
  op: 'run';
  id: number;
  code: string;
  /** a shell line echoes the value of an expression */
  mode: 'shell' | 'script';
  vars: Record<string, unknown>;
}

export type FromWorker =
  | { type: 'out'; text: string; err?: boolean }
  | { type: 'gfx'; cmd: GfxCommand }
  | {
      type: 'done';
      id: number;
      ok: boolean;
      error?: string;
      line?: number;
      /** variables the program set with calc.set */
      vars: Record<string, unknown>;
      ms: number;
    };

/** A calculator value for Python (null = not representable). */
export function toJson(v: Value): unknown {
  switch (v.kind) {
    case 'real':
      return v.v;
    case 'complex':
      return { re: v.re, im: v.im };
    case 'list':
      return v.items.map((x) => (x.kind === 'real' ? x.v : toJson(x)));
    case 'matrix':
      return v.rows.map((r) => [...r]);
    default:
      return null;
  }
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** A value from Python for the calculator; null = refused (strings, dicts …). */
export function fromJson(x: unknown): Value | null {
  if (typeof x === 'boolean') return { kind: 'real', v: x ? 1 : 0 };
  if (isNum(x)) return { kind: 'real', v: x };
  if (x && typeof x === 'object' && !Array.isArray(x)) {
    const o = x as Record<string, unknown>;
    if (isNum(o['re']) && isNum(o['im'])) return { kind: 'complex', re: o['re'], im: o['im'] };
    return null;
  }
  if (!Array.isArray(x)) return null;
  if (x.length && x.every((r) => Array.isArray(r))) {
    const w = (x[0] as unknown[]).length;
    if (w && x.every((r) => (r as unknown[]).length === w && (r as unknown[]).every(isNum)))
      return { kind: 'matrix', rows: x.map((r) => [...(r as number[])]) };
    return null;
  }
  const items: Value[] = [];
  for (const y of x) {
    const v = fromJson(y);
    if (!v || v.kind === 'list' || v.kind === 'matrix') return null;
    items.push(v);
  }
  return { kind: 'list', items };
}

/** The line of the innermost frame of a MicroPython traceback, and its last line. */
export function parseTraceback(text: string): { line?: number; message: string } {
  const lines = text.trim().split('\n');
  const frames = [...text.matchAll(/line (\d+)/g)];
  const line = frames.length ? Number(frames.at(-1)![1]) : undefined;
  return { ...(line !== undefined ? { line } : {}), message: lines.at(-1) ?? text };
}

/** `calc`: the calculator's variables (A–Z, lists L0–L9, matrices M0–M9, own names). */
export const CALC_MODULE = `import js_calc, json
def get(name):
    return json.loads(js_calc.get(name))
def set(name, value):
    if not js_calc.set(name, json.dumps(value)):
        raise ValueError('cannot store this value in ' + name)
`;

/** `graphic`: drawing on the screen G0 (320 × 240 pixels, origin top left). */
export const GRAPHIC_MODULE = `import js_gfx, json
WIDTH = 320
HEIGHT = 240
def rgb(r, g, b):
    return (int(r) << 16) | (int(g) << 8) | int(b)
def _c(color):
    if isinstance(color, tuple):
        return rgb(*color)
    return int(color)
def _send(d):
    js_gfx.draw(json.dumps(d))
def clear(color=0xFFFFFF):
    _send({'op': 'rect', 'screen': 0, 'coords': 'pixel', 'fill': _c(color)})
def pixel(x, y, color=0):
    _send({'op': 'pixon', 'screen': 0, 'coords': 'pixel', 'x': x, 'y': y, 'color': _c(color)})
def line(x1, y1, x2, y2, color=0):
    _send({'op': 'line', 'screen': 0, 'coords': 'pixel', 'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2, 'color': _c(color)})
def rect(x1, y1, x2, y2, color=0, fill=None):
    d = {'op': 'rect', 'screen': 0, 'coords': 'pixel', 'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2, 'edge': _c(color)}
    if fill is not None:
        d['fill'] = _c(fill)
    _send(d)
def text(s, x, y, color=0, size=0):
    _send({'op': 'textout', 'screen': 0, 'coords': 'pixel', 'text': str(s), 'x': x, 'y': y, 'color': _c(color), 'font': size})
def fill_poly(points, color=0):
    _send({'op': 'fillpoly', 'screen': 0, 'coords': 'pixel', 'points': [list(p) for p in points], 'color': _c(color)})
`;

/** Runs one shell line: the value of an expression is printed (like a REPL). */
export const SHELL_HELPER = `def __aba_shell(src):
    try:
        c = compile(src, '<shell>', 'eval')
    except SyntaxError:
        exec(compile(src, '<shell>', 'exec'), globals())
        return
    v = eval(c, globals())
    if v is not None:
        print(repr(v))
`;
