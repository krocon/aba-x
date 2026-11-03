import { Injectable, computed, inject } from '@angular/core';
import type { Construction } from '@aba/math/geometry/model';
import { type MathResult, fail, ok } from '@aba/math/result';
import { AppStore } from '../app-store';
import {
  type Built,
  type GeometryState,
  build,
  redefine,
  renamed,
  withoutObjects,
} from './geometry-logic';

/**
 * The live construction of the running geometry app (prompt 042). The app state holds only the
 * script; this session keeps the `Construction` built from it so that dragging continues from the
 * previous positions (ambiguous intersections keep their branch). It is rebuilt only when the
 * script changed elsewhere (other instance, Symb edit, import, reset).
 */
@Injectable({ providedIn: 'root' })
export class GeometrySession {
  readonly apps = inject(AppStore);
  readonly state = computed(() => this.apps.current().state as GeometryState);
  private cache: { id: string; script: string; built: Built } | null = null;

  /** A fresh snapshot after every change of the state (the construction object is shared). */
  readonly scene = computed(() => {
    const s = this.state();
    const b = this.built(s);
    for (const o of b.c.objects()) b.c.setHidden(o.id, s.hidden.includes(o.name));
    return { c: b.c, objects: b.c.objects(), errors: b.errors, state: s };
  });

  private built(s: GeometryState): Built {
    const id = this.apps.current().id;
    if (this.cache?.id !== id || this.cache.script !== s.script)
      this.cache = { id, script: s.script, built: build(s.script, s.hidden) };
    return this.cache.built;
  }

  private get c(): Construction {
    return this.built(this.state()).c;
  }

  /** Stores the script of the live construction (no rebuild) plus other state changes. */
  private commit(
    f: (s: GeometryState, script: string) => GeometryState = (s, script) => ({ ...s, script }),
  ): void {
    const script = this.c.script();
    this.cache = this.cache && { ...this.cache, script };
    this.apps.update<GeometryState>((s) => f(s, script));
  }

  /** Runs a command line (`name = command(args)`); returns the new object's name. */
  run(line: string): MathResult<string> {
    const r = this.c.run(line);
    if (!r.ok) return r;
    this.commit();
    return ok(r.value.name);
  }

  add(cmd: string, args: (string | number)[]): MathResult<string> {
    const r = this.c.add(cmd, args);
    if (!r.ok) return r;
    this.commit();
    return ok(r.value.name);
  }

  move(name: string, x: number, y: number): MathResult<readonly string[]> {
    const r = this.c.movePoint(name, x, y);
    if (r.ok) this.commit();
    return r;
  }

  setSlider(name: string, v: number): MathResult<readonly string[]> {
    const r = this.c.setSlider(name, v);
    if (r.ok) this.commit();
    return r;
  }

  delete(name: string): MathResult<readonly string[]> {
    const r = this.c.delete(name);
    if (r.ok) this.commit((s, script) => withoutObjects(s, r.value, script));
    return r;
  }

  rename(from: string, to: string): MathResult<string> {
    const r = this.c.rename(from, to);
    if (!r.ok) return r;
    this.commit((s, script) => renamed(s, from, to, script));
    return ok(to);
  }

  /** New definition for an object; replays the script (rebuild). */
  redefine(name: string, definition: string): MathResult<string> {
    const r = redefine(this.state().script, name, definition);
    if (!r.ok) return r;
    this.apps.update<GeometryState>((s) => ({ ...s, script: r.value }));
    return ok(name);
  }

  update(f: (s: GeometryState) => GeometryState): void {
    this.apps.update<GeometryState>(f);
  }

  toggleHidden(name: string): void {
    if (!this.c.get(name)) return;
    this.update((s) => ({
      ...s,
      hidden: s.hidden.includes(name) ? s.hidden.filter((n) => n !== name) : [...s.hidden, name],
    }));
  }

  /** Removes everything (fresh construction, view kept). */
  clear(): MathResult<true> {
    if (!this.state().script) return fail('domain', 'empty');
    this.update((s) => ({ ...s, script: '', hidden: [], colors: {}, trace: [], measures: [] }));
    return ok(true);
  }
}
