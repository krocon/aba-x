import { Injectable, computed, inject, signal } from '@angular/core';
import { StorageApi } from '@aba/core/storage/storage-api';
import { type ExportInfo, type PplError, type Program, compile } from '@aba/ppl';

const DOC_VERSION = 1;

/** A program of the catalogue: a name and its source text. */
export interface ProgramDoc {
  name: string;
  source: string;
  updated: number;
}

export interface CompiledProgram {
  doc: ProgramDoc;
  program: Program | null;
  error: PplError | null;
}

export interface ExportedFunction extends ExportInfo {
  /** the program that exports it */
  program: string;
  compiled: Program;
}

/** A new program: one exported function with the program's name. */
export function templateSource(name: string): string {
  return `EXPORT ${name}()\nBEGIN\n  \nEND;\n`;
}

/** Program names: a letter, then letters, digits or _ (they become function names). */
export const isProgramName = (n: string) => /^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(n);

/**
 * The program catalogue (prompts 043/044): programs stored as one document, each compiled when it
 * changes. Exported functions of programs without errors can be called from the home view.
 */
@Injectable({ providedIn: 'root' })
export class ProgramStore {
  private readonly storage = inject(StorageApi);
  readonly programs = signal<ProgramDoc[]>([]);

  readonly compiled = computed<CompiledProgram[]>(() =>
    this.programs().map((doc) => {
      const r = compile(doc.source);
      return r.ok ? { doc, program: r.value, error: null } : { doc, program: null, error: r.error };
    }),
  );

  /** exported functions by lower-case name (names are case-insensitive) */
  readonly exports = computed(() => {
    const out = new Map<string, ExportedFunction>();
    for (const c of this.compiled()) {
      if (!c.program) continue;
      for (const e of c.program.exports) {
        const key = e.name.toLowerCase();
        if (!out.has(key)) out.set(key, { ...e, program: c.doc.name, compiled: c.program });
      }
    }
    return out;
  });

  async load(): Promise<void> {
    try {
      const d = (await this.storage.load<{ version: number; programs: ProgramDoc[] }>('programs'))
        .value;
      if (d?.version === DOC_VERSION && Array.isArray(d.programs)) this.programs.set(d.programs);
    } catch (e) {
      console.error(e);
    }
  }

  get(name: string): ProgramDoc | undefined {
    return this.programs().find((p) => p.name === name);
  }

  /** Creates or replaces a program. */
  put(name: string, source: string): void {
    const doc = { name, source, updated: Date.now() };
    this.programs.update((l) =>
      l.some((p) => p.name === name) ? l.map((p) => (p.name === name ? doc : p)) : [...l, doc],
    );
    this.save();
  }

  rename(from: string, to: string): boolean {
    if (!isProgramName(to) || this.get(to)) return false;
    this.programs.update((l) => l.map((p) => (p.name === from ? { ...p, name: to } : p)));
    this.save();
    return true;
  }

  remove(name: string): void {
    this.programs.update((l) => l.filter((p) => p.name !== name));
    this.save();
  }

  clear(): void {
    this.programs.set([]);
    this.save();
  }

  private save(): void {
    void this.storage
      .save('programs', { version: DOC_VERSION, programs: this.programs() })
      .catch((e) => console.error(e));
  }
}
