import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  type Type,
  effect,
  inject,
  signal,
} from '@angular/core';
import { isLazy } from './app-contract';
import { AppStore } from './app-store';
import { InfoView } from './info-view';

/** Shows the current view of the running app (prompt 033). */
@Component({
  selector: 'app-app-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgComponentOutlet, InfoView],
  template: `
    @if (apps.view() === 'info') {
      <app-info-view />
    } @else if (component(); as c) {
      <ng-container *ngComponentOutlet="c" />
    }
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
  `,
})
export class AppHost {
  protected readonly apps = inject(AppStore);
  protected readonly component = signal<Type<unknown> | null>(null);
  private static readonly loaded = new Map<unknown, Type<unknown>>();

  constructor() {
    // lazy views come as their own chunk; the last request wins
    effect(() => {
      const v = this.apps.view();
      const entry = v === 'info' ? null : (this.apps.currentDef().views[v] ?? null);
      if (!entry || !isLazy(entry)) {
        this.component.set(entry);
        return;
      }
      const known = AppHost.loaded.get(entry.load);
      if (known) {
        this.component.set(known);
        return;
      }
      void entry.load().then((t) => {
        AppHost.loaded.set(entry.load, t);
        const now = this.apps.view();
        if (now !== 'info' && this.apps.currentDef().views[now] === entry) this.component.set(t);
      });
    });
  }
}
