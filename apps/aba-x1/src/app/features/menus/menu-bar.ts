import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { KeyboardDispatcher } from '../../core/actions/keyboard-dispatcher';
import { formatChord } from '../../core/actions/keymap';
import { I18n } from '../../core/i18n/i18n';
import { translateMenu } from '../../core/menu/menu-api';
import { type MenuEntry, webMenu } from '../../core/menu/menu-model';

/**
 * HTML menu for the web version (prompt 002/019) – the same model as the native desktop menu.
 * Disclosure pattern: a button opens a panel of grouped buttons; Esc closes and returns focus.
 */
@Component({
  selector: 'app-menu-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      #toggle
      type="button"
      class="toggle"
      [attr.aria-expanded]="open()"
      aria-controls="app-menu"
      (click)="open.set(!open())"
    >
      {{ i18n.t('menu.toggle') }}
    </button>
    @if (open()) {
      <div id="app-menu" class="panel" tabindex="-1" (keydown.escape)="close()">
        @for (sub of menus(); track $index) {
          <section [attr.aria-label]="sub.label">
            <h3>{{ sub.label }}</h3>
            @for (item of sub.items; track $index) {
              @if (item.kind === 'action') {
                <button type="button" class="item" (click)="run(item)">
                  <span>{{ item.label }}</span>
                  <kbd>{{ shortcut(item) }}</kbd>
                </button>
              } @else {
                <hr />
              }
            }
          </section>
        }
      </div>
    }
  `,
  styles: `
    :host {
      position: fixed;
      top: 0.5rem;
      left: 0.5rem;
      z-index: 5;
    }
    .toggle {
      font: inherit;
      font-size: 0.8125rem;
      padding: 0.3rem 0.7rem;
      border: 1px solid var(--color-border);
      border-radius: 6px;
      background: var(--color-surface);
      color: var(--color-text);
      cursor: pointer;
    }
    .toggle:focus-visible,
    .item:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 1px;
    }
    .panel {
      margin-top: 0.25rem;
      display: grid;
      grid-template-columns: repeat(2, minmax(11rem, 1fr));
      gap: 0.5rem 1rem;
      padding: 0.75rem;
      max-width: calc(100vw - 2rem);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      background: var(--color-surface);
      box-shadow: 0 8px 24px var(--color-shadow);
    }
    h3 {
      margin: 0 0 0.25rem;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-text-muted);
    }
    .item {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      width: 100%;
      font: inherit;
      font-size: 0.875rem;
      padding: 0.25rem 0.4rem;
      border: 0;
      border-radius: 4px;
      background: none;
      color: var(--color-text);
      text-align: left;
      cursor: pointer;
    }
    .item:hover {
      background: var(--color-surface-2);
    }
    kbd {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--color-text-muted);
    }
    hr {
      border: 0;
      border-top: 1px solid var(--color-border);
      margin: 0.25rem 0;
    }
    @media (max-width: 480px) {
      .panel {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class MenuBar {
  private readonly keys = inject(KeyboardDispatcher);
  private readonly toggle = viewChild.required<ElementRef<HTMLButtonElement>>('toggle');
  protected readonly i18n = inject(I18n);
  protected readonly menus = computed(() => {
    this.i18n.lang();
    return translateMenu(webMenu(), this.i18n);
  });
  protected readonly open = signal(false);

  protected shortcut(item: Extract<MenuEntry, { kind: 'action' }>): string {
    const chord = this.keys.keymap.find((b) => b.action === item.id)?.chord;
    return chord ? formatChord(chord, this.keys.os) : '';
  }

  protected run(item: Extract<MenuEntry, { kind: 'action' }>): void {
    this.open.set(false);
    this.keys.run(item.id);
  }

  protected close(): void {
    this.open.set(false);
    this.toggle().nativeElement.focus();
  }
}
