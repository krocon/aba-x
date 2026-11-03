import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface PlotMenuItem {
  label: string;
  run: () => void;
}

/** A small menu over a plot (zoom, Fcn, views – prompt 034); the owner moves the cursor. */
@Component({
  selector: 'app-plot-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="menu" role="menu" [attr.aria-label]="title()">
      @for (it of items(); track it.label; let i = $index) {
        <li
          role="menuitem"
          tabindex="-1"
          [class.cur]="cursor() === i"
          (pointerdown)="$event.preventDefault()"
          (click)="pick.emit(i)"
          (keydown.enter)="pick.emit(i)"
        >
          {{ it.label }}
        </li>
      }
    </ul>
  `,
  styles: `
    .menu {
      position: absolute;
      left: 1cqw;
      bottom: 1cqw;
      z-index: 3;
      margin: 0;
      padding: 0.2em 0;
      list-style: none;
      max-height: calc(100% - 2cqw);
      overflow-y: auto;
      min-width: 40%;
      background: var(--lcd-bg);
      border: 1px solid var(--lcd-line-strong);
      border-radius: 0.3em;
      box-shadow: 0 2px 8px rgb(0 0 0 / 0.25);
      font-size: 3.8cqw;
    }
    li {
      padding: 0.15em 0.7em;
      cursor: pointer;
    }
    li.cur {
      background: var(--lcd-cur);
    }
  `,
})
export class PlotMenu {
  readonly title = input('Menu');
  readonly items = input<PlotMenuItem[]>([]);
  readonly cursor = input(0);
  readonly pick = output<number>();
}
