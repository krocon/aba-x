/// <reference lib="webworker" />
/**
 * Python worker (prompt 047): MicroPython (WebAssembly, MIT) loaded on the first run from the
 * bundle (python/micropython.wasm – works offline). The app terminates the worker to cancel.
 */
import type { MicroPython, loadMicroPython } from '@micropython/micropython-webassembly-pyscript';
import {
  CALC_MODULE,
  type FromWorker,
  GRAPHIC_MODULE,
  SHELL_HELPER,
  type ToWorker,
  parseTraceback,
} from './python-protocol';

let mp: MicroPython | null = null;
let vars: Record<string, unknown> = {};
let changed: Record<string, unknown> = {};

const post = (m: FromWorker) => postMessage(m);

async function runtime(): Promise<MicroPython> {
  if (mp) return mp;
  // loaded at run time from the assets: the module has Node fallbacks a browser bundle cannot hold
  const base = new URL('python/', self.location.href).href;
  const mod = (await import(/* @vite-ignore */ `${base}micropython.mjs`)) as {
    loadMicroPython: typeof loadMicroPython;
  };
  const m = await mod.loadMicroPython({
    url: `${base}micropython.wasm`,
    heapsize: 8 * 1024 * 1024,
    stdout: (text) => post({ type: 'out', text }),
    stderr: (text) => post({ type: 'out', text, err: true }),
  });
  try {
    m.FS.mkdir('/lib');
  } catch {
    // exists
  }
  m.FS.writeFile('/lib/calc.py', CALC_MODULE);
  m.FS.writeFile('/lib/graphic.py', GRAPHIC_MODULE);
  m.registerJsModule('js_calc', {
    get: (name: string) => JSON.stringify(vars[name] ?? null),
    set: (name: string, json: string) => {
      if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) return false;
      const v = JSON.parse(json);
      vars[name] = v;
      changed[name] = v;
      return true;
    },
  });
  m.registerJsModule('js_gfx', {
    draw: (json: string) => post({ type: 'gfx', cmd: JSON.parse(json) }),
  });
  m.runPython(SHELL_HELPER);
  mp = m;
  return m;
}

addEventListener('message', async ({ data }: MessageEvent<ToWorker>) => {
  const t0 = performance.now();
  vars = data.vars;
  changed = {};
  try {
    const m = await runtime();
    if (data.mode === 'shell') {
      m.globals.set('__aba_src', data.code);
      m.runPython('__aba_shell(__aba_src)');
    } else m.runPython(data.code);
    post({ type: 'done', id: data.id, ok: true, vars: changed, ms: performance.now() - t0 });
  } catch (e) {
    const text = e instanceof Error ? e.message : String(e);
    post({ type: 'out', text: text.trimEnd(), err: true });
    const tb = parseTraceback(text);
    post({
      type: 'done',
      id: data.id,
      ok: false,
      error: tb.message,
      ...(tb.line !== undefined ? { line: tb.line } : {}),
      vars: changed,
      ms: performance.now() - t0,
    });
  }
});
