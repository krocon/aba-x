import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MenuService } from './menu-service';

/**
 * HTML menu of the web build (prompt 045): one button per menu, a list with the actions. It sits below the device,
 * so the lists open upwards.
 */
@Component({
  selector: 'app-web-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="bar" aria-label="Menu">
      @for (m of menu.web; track m.label; let i = $index) {
        <div class="m">
          <button type="button" class="top" [attr.aria-expanded]="open() === i" (click)="toggle(i)">
            {{ menu.label('menu.' + m.label) }}
          </button>
          @if (open() === i) {
            <ul role="menu">
              @for (it of m.items; track $index) {
                @if (it.kind === 'action') {
                  <li role="none">
                    <button type="button" role="menuitem" (click)="pick(it.id)">
                      {{ menu.label('menuItem.' + it.id) }}
                    </button>
                  </li>
                } @else {
                  <li role="separator" class="sep"></li>
                }
              }
            </ul>
          }
        </div>
      }
    </nav>
  `,
  styles: `
    .bar {
      display: flex;
      gap: 0.25rem;
      justify-content: center;
      padding: 0;
    }
    .m {
      position: relative;
    }
    .top {
      border: 0;
      background: transparent;
      color: var(--page-text);
      font: inherit;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      cursor: pointer;
    }
    .top:hover,
    .top[aria-expanded='true'] {
      background: rgb(255 255 255 / 0.1);
    }
    ul {
      position: absolute;
      z-index: 20;
      left: 0;
      bottom: calc(100% + 4px);
      min-width: 13rem;
      margin: 0;
      padding: 0.25rem 0;
      list-style: none;
      background: var(--color-surface);
      color: var(--color-text);
      border: 1px solid var(--color-border);
      border-radius: 6px;
      box-shadow: 0 6px 18px var(--color-shadow);
    }
    li button {
      width: 100%;
      text-align: left;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      padding: 0.3rem 0.8rem;
      cursor: pointer;
    }
    li button:hover,
    li button:focus-visible {
      background: var(--color-surface-2);
    }
    .sep {
      height: 1px;
      margin: 0.25rem 0;
      background: var(--color-border);
    }
  `,
  host: { '(document:keydown.escape)': 'open.set(null)' },
})
export class WebMenu {
  protected readonly menu = inject(MenuService);
  protected readonly open = signal<number | null>(null);

  protected toggle(i: number): void {
    this.open.update((o) => (o === i ? null : i));
  }

  protected pick(id: string): void {
    this.open.set(null);
    this.menu.run(id);
  }
}
