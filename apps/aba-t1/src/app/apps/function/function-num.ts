import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { formatReal } from '@aba/math/value/format';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import { SettingsStore } from '../../features/settings/settings-store';
import { AppStore } from '../app-store';
import { injectAppScope } from '../shared/app-scope';
import { type FunctionState, plottables, table } from './function-logic';

const ROWS = 9;

/**
 * Numeric view of the function app (prompt 033): X and every enabled function. ↑↓ scroll by the
 * step, + and − halve or double the step (zoom in the table).
 */
@Component({
  selector: 'app-function-num',
  host: { tabindex: '0', role: 'region', '[attr.aria-label]': 'title()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <table class="num">
      <thead>
        <tr>
          <th scope="col">X</th>
          @for (f of fns(); track f.name) {
            <th scope="col" [style.border-bottom-color]="f.color">{{ f.name }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (r of rows(); track r.x) {
          <tr>
            <th scope="row">{{ r.x }}</th>
            @for (y of r.ys; track $index) {
              <td>{{ y }}</td>
            }
          </tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      overflow: auto;
    }
    .num {
      width: 100%;
      border-collapse: collapse;
      font-size: 3.8cqw;
      font-variant-numeric: tabular-nums;
    }
    th,
    td {
      padding: 0.1em 0.3em;
      border-bottom: 1px solid var(--lcd-line);
      text-align: right;
      white-space: nowrap;
    }
    thead th {
      background: var(--lcd-head);
      position: sticky;
      top: 0;
      border-bottom: 3px solid transparent;
    }
    tbody th {
      background: var(--lcd-head);
    }
  `,
})
export class FunctionNum implements OnInit, OnDestroy {
  private readonly i18n = inject(I18n);
  private readonly apps = inject(AppStore);
  private readonly device = inject(DeviceStore);
  private readonly settings = inject(SettingsStore);
  private readonly scope = injectAppScope();
  protected readonly title = () => this.i18n.t('app.functionNum');
  private readonly state = computed(() => this.apps.current().state as FunctionState);
  protected readonly fns = computed(() => plottables(this.state().fns, this.scope()));
  protected readonly rows = computed(() => {
    const f = this.settings.settings().format;
    const fmt = (y: number) => (Number.isFinite(y) ? formatReal(y, f) : '—');
    const s = this.state();
    return table(this.fns(), s.numStart, s.numStep, ROWS).map((r) => ({
      x: fmt(r.x),
      ys: r.ys.map(fmt),
    }));
  });
  private pop: (() => void) | null = null;

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'function-num',
      title: () => this.i18n.t('app.functionNum'),
      menu: () => [
        { label: 'Zoom +' },
        { label: 'Zoom −' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
      ],
      key: (p) => this.key(p),
      menuPress: (i) => this.zoomStep(i === 0 ? 0.5 : 2),
      rocker: (d) => this.rocker(d),
      help: 'function',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  private zoomStep(f: number): void {
    this.apps.update<FunctionState>((s) => ({ ...s, numStep: s.numStep * f }));
  }

  private key(p: KeyPress): boolean {
    if (p.id === 'add') this.zoomStep(0.5);
    else if (p.id === 'sub') this.zoomStep(2);
    else return false;
    return true;
  }

  private rocker(d: RockerDir): boolean {
    const k = d === 'up' ? -1 : d === 'down' ? 1 : 0;
    if (k)
      this.apps.update<FunctionState>((s) => ({
        ...s,
        numStart: Number((s.numStart + k * s.numStep).toPrecision(12)),
      }));
    return true;
  }
}
