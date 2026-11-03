/**
 * Library operations (prompt 033), pure: built-in instances, copies, reset, sort, migration of a
 * stored library.
 */
import type { AppDef, AppInstance } from './app-contract';

export type SortMode = 'alpha' | 'used';

export function builtIn(def: AppDef, lang: 'en' | 'de'): AppInstance {
  return {
    id: def.id,
    app: def.id,
    name: def.title[lang],
    copy: false,
    used: 0,
    version: def.version,
    state: def.init(),
    info: '',
  };
}

/** Stored instances → valid library: every built-in app present, unknown apps dropped, old states reset. */
export function restore(
  stored: readonly AppInstance[] | undefined,
  defs: readonly AppDef[],
  lang: 'en' | 'de',
): AppInstance[] {
  const byId = new Map(defs.map((d) => [d.id, d]));
  const out: AppInstance[] = [];
  for (const i of stored ?? []) {
    const def = byId.get(i.app);
    if (!def || typeof i.id !== 'string') continue;
    out.push(i.version === def.version ? i : { ...i, version: def.version, state: def.init() });
  }
  for (const d of defs) if (!out.some((i) => i.id === d.id)) out.push(builtIn(d, lang));
  return out;
}

export function saveCopy(
  list: readonly AppInstance[],
  id: string,
  name: string,
): AppInstance[] | string {
  const src = list.find((i) => i.id === id);
  if (!src) return 'unknown app';
  const clean = name.trim();
  if (!clean) return 'a name is needed';
  if (list.some((i) => i.name.toLowerCase() === clean.toLowerCase()))
    return `"${clean}" exists already`;
  const copy: AppInstance = {
    ...structuredClone(src),
    id: `${src.app}-${Date.now().toString(36)}`,
    name: clean,
    copy: true,
    used: Date.now(),
  };
  return [...list, copy];
}

export function reset(
  list: readonly AppInstance[],
  id: string,
  defs: readonly AppDef[],
): AppInstance[] {
  return list.map((i) => {
    if (i.id !== id) return i;
    const def = defs.find((d) => d.id === i.app);
    return def ? { ...i, state: def.init(), version: def.version } : i;
  });
}

export function remove(list: readonly AppInstance[], id: string): AppInstance[] {
  return list.filter((i) => i.id !== id || !i.copy);
}

export function sorted(
  list: readonly AppInstance[],
  mode: SortMode,
  defs: readonly AppDef[],
): AppInstance[] {
  const order = new Map(defs.map((d, k) => [d.id, k]));
  return [...list].sort((a, b) =>
    mode === 'alpha'
      ? a.name.localeCompare(b.name)
      : b.used - a.used || (order.get(a.app) ?? 0) - (order.get(b.app) ?? 0),
  );
}
