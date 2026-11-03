import { Injectable, computed, signal } from '@angular/core';
import type { Gesture } from '@aba/core/actions/gestures';
import type { MenuButton } from '../../features/device/t1-device';
import { keyById } from '../../features/device/keypad-model';
import {
  IDLE,
  type KeyPress,
  type Layer,
  type ModState,
  annunciators,
  step,
} from '../actions/shift-alpha';

export type RockerDir = 'up' | 'down' | 'left' | 'right';

/** Size of the display content in CSS pixels when a gesture happened (views scale themselves). */
export interface Area {
  width: number;
  height: number;
}

/**
 * What the active view of the device offers (prompt 026): title, the six touch menu buttons and
 * handlers. Handlers return true when they consumed the input; otherwise app-level actions run.
 */
export interface ViewContext {
  id: string;
  title(): string;
  menu(): MenuButton[];
  key?(p: KeyPress): boolean;
  menuPress?(index: number, shift: boolean): void;
  rocker?(dir: RockerDir, shift: boolean): boolean;
  gesture?(g: Gesture, area: Area): void;
  /** Inserts into the entry line of the view (toolbox, vars, characters – prompt 030). */
  insert?(latex: string, text: string): void;
  /** Help topic of the view (Help key). */
  help?: string;
}

/**
 * State of the ABA-T1 device: shift/alpha, on/off, the stack of view contexts (the top one gets
 * the input) and app-level actions (`apps`, `home`, `cas.shift`, …) as fallback.
 */
@Injectable({ providedIn: 'root' })
export class DeviceStore {
  readonly mods = signal<ModState>(IDLE);
  readonly off = signal(false);
  /** key that lights up briefly (hardware keyboard feedback) */
  readonly lit = signal<string | null>(null);
  /** extra annunciators of the views (angle mode, …) */
  readonly status = signal<string[]>([]);
  private readonly stack = signal<ViewContext[]>([]);
  private readonly globals = new Map<string, () => void>();
  /** sees every key first (a running program – prompt 043); true = consumed */
  private interceptor: ((p: KeyPress) => boolean) | null = null;
  private litTimer: ReturnType<typeof setTimeout> | undefined;

  readonly top = computed(() => this.stack().at(-1) ?? null);
  /** the topmost view that has an entry line (target of the toolbox) */
  readonly insertTarget = computed(() => [...this.stack()].reverse().find((c) => c.insert) ?? null);
  readonly title = computed(() => this.top()?.title() ?? 'ABA-T1');
  readonly menu = computed(() => this.top()?.menu() ?? []);
  readonly annunciators = computed(() => [...annunciators(this.mods()), ...this.status()]);

  /** Shows a view on top; the returned function removes it again. */
  push(ctx: ViewContext): () => void {
    this.stack.update((s) => [...s.filter((c) => c !== ctx), ctx]);
    return () => this.stack.update((s) => s.filter((c) => c !== ctx));
  }

  /** App-level action for `<key id>` or `<key id>.shift`; returns its removal. */
  onGlobal(action: string, run: () => void): () => void {
    this.globals.set(action, run);
    return () => {
      if (this.globals.get(action) === run) this.globals.delete(action);
    };
  }

  /** Lets one handler see every key first (a running program); returns its removal. */
  intercept(f: (p: KeyPress) => boolean): () => void {
    this.interceptor = f;
    return () => {
      if (this.interceptor === f) this.interceptor = null;
    };
  }

  /** A device key (virtual keyboard or its chord): shift/alpha apply. */
  pressKey(id: string): void {
    const key = keyById(id);
    if (!key) return;
    const r = step(this.mods(), key);
    this.mods.set(r.state);
    if (r.press) this.dispatch(r.press);
  }

  /** A key whose layer is already known (hardware keyboard): the pending shift is used up. */
  pressLayer(id: string, layer: Layer, char?: string): void {
    this.flash(id);
    if (layer === 'main' && this.mods().shift && keyById(id)?.shift) {
      this.pressKey(id);
      return;
    }
    if (layer !== 'alpha') this.mods.update((m) => ({ ...m, shift: false }));
    this.dispatch({ id, layer, ...(char ? { char } : {}) });
  }

  menuPress(index: number, shift = false): void {
    if (this.off()) return;
    const s = shift || this.mods().shift;
    this.mods.update((m) => ({ ...m, shift: false }));
    this.top()?.menuPress?.(index, s);
  }

  rocker(dir: RockerDir, shift = false): void {
    if (this.off()) return;
    const s = shift || this.mods().shift;
    this.mods.update((m) => ({ ...m, shift: false }));
    this.top()?.rocker?.(dir, s);
  }

  gesture(g: Gesture, area: Area): void {
    if (this.off()) return;
    this.top()?.gesture?.(g, area);
  }

  private dispatch(p: KeyPress): void {
    if (!this.off() && this.interceptor?.(p)) return;
    if (p.id === 'on') {
      if (p.layer === 'shift') this.off.set(true);
      else if (this.off()) this.off.set(false);
      else this.top()?.key?.(p);
      return;
    }
    if (this.off()) return;
    if (this.top()?.key?.(p)) return;
    this.globals.get(p.layer === 'shift' ? `${p.id}.shift` : p.id)?.();
  }

  private flash(id: string): void {
    this.lit.set(id);
    clearTimeout(this.litTimer);
    this.litTimer = setTimeout(() => this.lit.set(null), 160);
  }
}
