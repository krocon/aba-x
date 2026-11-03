/**
 * Export/import bundle (prompt 017): one JSON file with variables, functions, history and settings –
 * the same on desktop and web, so data can move between them.
 */
import type { FunctionsDoc, VariablesDoc } from '../vars/vars-logic';
import type { HistoryDoc } from '../history/history-logic';

export const BUNDLE_FORMAT = 'aba-x-backup';
export const BUNDLE_VERSION = 1;

export interface Bundle {
  format: typeof BUNDLE_FORMAT;
  version: number;
  exportedAt: string;
  data: {
    variables?: VariablesDoc;
    functions?: FunctionsDoc;
    history?: HistoryDoc;
    settings?: unknown;
  };
}

export function buildBundle(data: Bundle['data'], now = new Date()): Bundle {
  return { format: BUNDLE_FORMAT, version: BUNDLE_VERSION, exportedAt: now.toISOString(), data };
}

export function bundleFileName(now = new Date()): string {
  return `aba-x-backup-${now.toISOString().slice(0, 10)}.json`;
}

export interface ImportSummary {
  variables: number;
  functions: number;
  history: number;
  settings: boolean;
}

export type ParsedBundle =
  { ok: true; bundle: Bundle; summary: ImportSummary } | { ok: false; message: string };

const count = (d: unknown) =>
  Array.isArray((d as { items?: unknown } | undefined)?.items)
    ? (d as { items: unknown[] }).items.length
    : 0;

/** Checks format and version; a newer version is refused (never half-imported). */
export function parseBundle(text: string): ParsedBundle {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, message: 'the file is not valid JSON' };
  }
  const b = raw as Partial<Bundle> | null;
  if (
    b?.format !== BUNDLE_FORMAT ||
    typeof b.version !== 'number' ||
    typeof b.data !== 'object' ||
    !b.data
  ) {
    return { ok: false, message: 'this is not an ABA-X1 backup file' };
  }
  if (b.version > BUNDLE_VERSION) {
    return { ok: false, message: 'the backup was made by a newer ABA-X1 version' };
  }
  const bundle = b as Bundle;
  return {
    ok: true,
    bundle,
    summary: {
      variables: count(bundle.data.variables),
      functions: count(bundle.data.functions),
      history: count(bundle.data.history),
      settings: bundle.data.settings !== undefined,
    },
  };
}
