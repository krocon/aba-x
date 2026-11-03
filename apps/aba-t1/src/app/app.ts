import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import type { Gesture } from '@aba/core/actions/gestures';
import { T1Keyboard } from './core/actions/t1-keyboard';
import { DeviceStore } from './core/device/device-store';
import { T1Device } from './features/device/t1-device';
import { ShortcutsDialog } from './features/help/shortcuts-dialog';

/**
 * Page frame of ABA-T1: the device centred on a dark page, wired to the device store (prompt 026).
 * Views push their context onto the store; until the home view exists (027) a demo context echoes
 * the input.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [T1Device, ShortcutsDialog],
  template: `
    <main>
      <h1 class="visually-hidden">ABA-T1</h1>
      <app-t1-device
        [title]="device.title()"
        [annunciators]="device.annunciators()"
        [menu]="device.menu()"
        [shift]="device.mods().shift"
        [alpha]="device.mods().alpha !== 'off'"
        [lit]="device.lit()"
        [off]="device.off()"
        (key)="device.pressKey($event)"
        (menuPress)="device.menuPress($event)"
        (rocker)="device.rocker($event)"
        (gesture)="device.gesture($event.g, $event)"
      >
        <div class="demo" aria-live="polite">{{ echo() }}</div>
      </app-t1-device>
      <p class="foot">
        <button type="button" class="link" (click)="keyboard.helpOpen.set(true)">Keyboard</button>
      </p>
    </main>
    @if (keyboard.helpOpen()) {
      <app-shortcuts-dialog (closed)="keyboard.helpOpen.set(false)" />
    }
  `,
  styles: `
    main {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px 0 24px;
    }
    .demo {
      display: grid;
      place-items: center;
      height: 100%;
      color: #5a6c67;
      white-space: pre;
      text-align: center;
    }
    .foot {
      margin: 10px 0 0;
      font-size: 0.85rem;
    }
    .link {
      border: 0;
      background: none;
      color: var(--page-muted);
      font: inherit;
      text-decoration: underline;
      cursor: pointer;
    }
    @media (max-width: 400px) {
      main {
        padding: 0;
      }
    }
  `,
})
export class App {
  protected readonly device = inject(DeviceStore);
  protected readonly keyboard = inject(T1Keyboard);
  protected readonly echo = signal('ABA-T1');

  constructor() {
    this.device.push({
      id: 'demo',
      title: () => 'ABA-T1',
      menu: () => [{ label: 'Demo' }],
      key: (p) => {
        this.echo.set(`${p.id} · ${p.layer}${p.char ? ` · ${p.char}` : ''}`);
        return true;
      },
      menuPress: (i, s) => this.echo.set(`menu ${i + 1}${s ? ' · shift' : ''}`),
      rocker: (d, s) => {
        this.echo.set(`rocker ${d}${s ? ' · shift' : ''}`);
        return true;
      },
      gesture: (g: Gesture) => {
        if (g.kind !== 'drag' || g.phase !== 'move') this.echo.set(describe(g));
      },
    });
  }
}

function describe(g: Gesture): string {
  switch (g.kind) {
    case 'drag':
    case 'pinch':
      return `${g.kind} ${g.phase}`;
    case 'swipe':
      return `swipe ${g.dir}`;
    default:
      return g.kind;
  }
}
