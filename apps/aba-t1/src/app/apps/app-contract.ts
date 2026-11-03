/**
 * The app concept of ABA-T1 (prompt 033): an app has up to six views – Symbolic, Plot, Numeric and
 * their setups – and a serialisable state. The library holds one instance per built-in app plus
 * copies the user saved under a new name. App views get their instance from the `AppStore`.
 */
import type { Type } from '@angular/core';

export type AppView = 'symb' | 'plot' | 'num' | 'symbSetup' | 'plotSetup' | 'numSetup' | 'info';

/** A view loaded on first use (its own chunk – prompt 048). */
export interface LazyView {
  load: () => Promise<Type<unknown>>;
}

export const lazy = (load: () => Promise<Type<unknown>>): LazyView => ({ load });

export const isLazy = (v: Type<unknown> | LazyView): v is LazyView =>
  typeof (v as LazyView).load === 'function' && !('ɵcmp' in v);

export interface AppDef<S = unknown> {
  id: string;
  title: { en: string; de: string };
  /** SVG path data on a 24×24 grid (own icons) */
  icon: string;
  /** state of a fresh or reset instance (JSON) */
  init(): S;
  /** version of the state shape; older states are reset */
  version: number;
  /** the view that opens when the app starts */
  start: AppView;
  views: Partial<Record<Exclude<AppView, 'info'>, Type<unknown> | LazyView>>;
}

export interface AppInstance<S = unknown> {
  /** unique id (built-in instances use the app id) */
  id: string;
  app: string;
  name: string;
  /** a saved copy (can be deleted) */
  copy: boolean;
  /** last start, for sorting by use */
  used: number;
  version: number;
  state: S;
  /** notes of the app (Info, ⇧Apps) */
  info: string;
}
