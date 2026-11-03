import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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
  protected readonly component = computed(() => {
    const v = this.apps.view();
    return v === 'info' ? null : (this.apps.currentDef().views[v] ?? null);
  });
}
