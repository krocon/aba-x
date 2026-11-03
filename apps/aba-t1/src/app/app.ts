import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { T1Device } from './features/device/t1-device';

/** Page frame of ABA-T1: the device centred on a dark page (prompt 025). */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [T1Device],
  template: `
    <main>
      <h1 class="visually-hidden">ABA-T1</h1>
      <app-t1-device title="ABA-T1" [menu]="menu" [lit]="lit()" (key)="press($event)">
        <p class="empty">ABA-T1</p>
      </app-t1-device>
    </main>
  `,
  styles: `
    main {
      display: flex;
      justify-content: center;
      padding: 16px 0 24px;
    }
    .empty {
      display: grid;
      place-items: center;
      height: 100%;
      margin: 0;
      color: #5a6c67;
    }
    @media (max-width: 400px) {
      main {
        padding: 0;
      }
    }
  `,
})
export class App {
  protected readonly menu = [];
  protected readonly lit = signal<string | null>(null);

  protected press(id: string): void {
    this.lit.set(id);
  }
}
