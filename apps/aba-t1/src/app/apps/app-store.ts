import { Injectable, computed, inject, signal } from '@angular/core';
import { StorageApi } from '@aba/core/storage/storage-api';
import { I18n } from '../core/i18n/i18n';
import type { AppInstance, AppView } from './app-contract';
import * as L from './app-logic';
import { APP_DEFS } from './app-registry';

const DOC_VERSION = 1;

interface AppsDoc {
  version: number;
  instances: AppInstance[];
  current: string;
  sort: L.SortMode;
}

/** The app library and the running app (prompt 033). States are saved after each change. */
@Injectable({ providedIn: 'root' })
export class AppStore {
  private readonly storage = inject(StorageApi);
  private readonly i18n = inject(I18n);
  readonly defs = APP_DEFS;
  readonly instances = signal<AppInstance[]>(L.restore([], APP_DEFS, this.i18n.lang()));
  readonly currentId = signal(APP_DEFS[0].id);
  readonly view = signal<AppView>(APP_DEFS[0].start);
  readonly sort = signal<L.SortMode>('used');
  readonly current = computed(
    () => this.instances().find((i) => i.id === this.currentId()) ?? this.instances()[0],
  );
  readonly currentDef = computed(() => APP_DEFS.find((d) => d.id === this.current().app)!);
  readonly library = computed(() => L.sorted(this.instances(), this.sort(), APP_DEFS));

  async load(): Promise<void> {
    try {
      const d = (await this.storage.load<AppsDoc>('apps')).value;
      if (d?.version === DOC_VERSION) {
        this.instances.set(L.restore(d.instances, APP_DEFS, this.i18n.lang()));
        if (this.instances().some((i) => i.id === d.current)) this.currentId.set(d.current);
        this.sort.set(d.sort === 'alpha' ? 'alpha' : 'used');
      }
    } catch (e) {
      console.error(e);
    }
  }

  /** Starts an app in its start view. */
  start(id: string): void {
    this.currentId.set(id);
    this.instances.update((l) => l.map((i) => (i.id === id ? { ...i, used: Date.now() } : i)));
    this.view.set(this.currentDef().start);
    this.save();
  }

  show(view: AppView): boolean {
    if (view !== 'info' && !this.currentDef().views[view]) return false;
    this.view.set(view);
    return true;
  }

  /** Changes the state of the current app. */
  update<S>(f: (state: S) => S): void {
    const id = this.currentId();
    this.instances.update((l) =>
      l.map((i) => (i.id === id ? { ...i, state: f(i.state as S) } : i)),
    );
    this.save();
  }

  state<S>(): S {
    return this.current().state as S;
  }

  setInfo(text: string): void {
    const id = this.currentId();
    this.instances.update((l) => l.map((i) => (i.id === id ? { ...i, info: text } : i)));
    this.save();
  }

  saveCopy(id: string, name: string): string | null {
    const r = L.saveCopy(this.instances(), id, name);
    if (typeof r === 'string') return r;
    this.instances.set(r);
    this.save();
    return null;
  }

  reset(id: string): void {
    this.instances.set(L.reset(this.instances(), id, APP_DEFS));
    this.save();
  }

  remove(id: string): void {
    this.instances.set(L.remove(this.instances(), id));
    if (!this.instances().some((i) => i.id === this.currentId()))
      this.currentId.set(APP_DEFS[0].id);
    this.save();
  }

  toggleSort(): void {
    this.sort.update((s) => (s === 'alpha' ? 'used' : 'alpha'));
    this.save();
  }

  private save(): void {
    const doc: AppsDoc = {
      version: DOC_VERSION,
      instances: this.instances(),
      current: this.currentId(),
      sort: this.sort(),
    };
    void this.storage.save('apps', doc).catch((e) => console.error(e));
  }
}
