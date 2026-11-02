/**
 * Pure part of the variable store (prompt 008): documents `variables` / `functions` ⇄ maps.
 * Stored as text (our own syntax, parsed again on load) so files stay readable and survive AST
 * changes; broken items are skipped, a newer schema is read but never overwritten.
 */
import type { Expr } from '../../../math/ast/nodes';
import type { UserFunction } from '../../../math/numeric/evaluate';
import { parseText } from '../../../math/parser/text-parser';
import { isFreeName } from '../../../math/parser/statement';
import { toText } from '../../../math/serializer';

export const VARS_SCHEMA = 1;

export interface VariablesDoc {
  schemaVersion: number;
  items: { name: string; value: string }[];
}

export interface FunctionsDoc {
  schemaVersion: number;
  items: { name: string; params: string[]; body: string }[];
}

export interface Loaded<T> {
  map: Map<string, T>;
  readOnly: boolean;
  skipped: number;
}

const items = (raw: unknown): unknown[] =>
  typeof raw === 'object' && raw !== null && Array.isArray((raw as { items?: unknown }).items)
    ? (raw as { items: unknown[] }).items
    : [];
const newer = (raw: unknown) =>
  typeof (raw as { schemaVersion?: unknown } | null)?.schemaVersion === 'number' &&
  (raw as { schemaVersion: number }).schemaVersion > VARS_SCHEMA;

export function loadFunctions(raw: unknown): Loaded<UserFunction> {
  const map = new Map<string, UserFunction>();
  let skipped = 0;
  const list = items(raw).filter(
    (i): i is { name: string; params: string[]; body: string } =>
      typeof (i as { name?: unknown }).name === 'string' &&
      Array.isArray((i as { params?: unknown }).params) &&
      typeof (i as { body?: unknown }).body === 'string',
  );
  skipped += items(raw).length - list.length;
  const names = new Set(list.map((i) => i.name));
  for (const i of list) {
    const body = parseText(i.body, { functions: names });
    if (
      !isFreeName(i.name) ||
      !body.ok ||
      !i.params.every((p) => typeof p === 'string' && isFreeName(p))
    ) {
      skipped++;
      continue;
    }
    map.set(i.name, { params: i.params, body: body.value });
  }
  return { map, readOnly: newer(raw), skipped };
}

export function loadVariables(
  raw: unknown,
  functions: ReadonlySet<string> = new Set(),
): Loaded<Expr> {
  const map = new Map<string, Expr>();
  let skipped = 0;
  for (const i of items(raw)) {
    const { name, value } = (i ?? {}) as { name?: unknown; value?: unknown };
    const parsed = typeof value === 'string' ? parseText(value, { functions }) : null;
    if (typeof name !== 'string' || !isFreeName(name) || !parsed?.ok) {
      skipped++;
      continue;
    }
    map.set(name, parsed.value);
  }
  return { map, readOnly: newer(raw), skipped };
}

export function variablesDoc(map: ReadonlyMap<string, Expr>): VariablesDoc {
  return {
    schemaVersion: VARS_SCHEMA,
    items: [...map].map(([name, e]) => ({ name, value: toText(e) })),
  };
}

export function functionsDoc(map: ReadonlyMap<string, UserFunction>): FunctionsDoc {
  return {
    schemaVersion: VARS_SCHEMA,
    items: [...map].map(([name, f]) => ({ name, params: [...f.params], body: toText(f.body) })),
  };
}

export type VarsMenuEntry =
  | { kind: 'var'; name: string }
  | { kind: 'fn'; name: string; arity: number }
  | { kind: 'next' }
  | { kind: 'exit' };

/** Softkeys of the VARS menu: names (variables, then functions), NXT for more pages, EXIT last. */
export function varsMenu(
  vars: readonly string[],
  fns: readonly { name: string; arity: number }[],
  page: number,
): VarsMenuEntry[] {
  const all: VarsMenuEntry[] = [
    ...[...vars].sort().map((name) => ({ kind: 'var' as const, name })),
    ...[...fns]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((f) => ({ kind: 'fn' as const, ...f })),
  ];
  if (all.length <= 5) return [...all, { kind: 'exit' }];
  const per = 4;
  const pages = Math.ceil(all.length / per);
  const p = ((page % pages) + pages) % pages;
  return [...all.slice(p * per, p * per + per), { kind: 'next' }, { kind: 'exit' }];
}
