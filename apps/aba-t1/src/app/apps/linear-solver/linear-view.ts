import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { parseText } from '@aba/math/parser/text-parser';
import { evaluateValue } from '@aba/math/value/evaluate-value';
import { formatReal } from '@aba/math/value/format';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import type { MenuButton } from '../../features/device/t1-device';
import { editFor } from '../../features/home/home-keys';
import { HomeStore } from '../../features/home/home-store';
import { AppStore } from '../app-store';
import { type LinearState, MAX_N, describe, initLinear, solveState } from './linear-logic';

const fmt = (x: number) => formatReal(x, { mode: 'standard', digits: 0, decimal: '.' });

/**
 * Linear solver (prompt 039): the coefficients of an n×n system and its right side as a grid;
 * the solution below updates with every stored value – unique, infinitely many (with parameters
 * t1, t2 …) or none. Rocker/arrows move, typing replaces a cell, Enter stores and moves right.
 */
@Component({
  selector: 'app-linear-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lin">
      <div class="grid" role="region" [attr.aria-label]="i18n.t('lin.title')">
        <table>
          <thead>
            <tr>
              @for (j of cols(); track j) {
                <th scope="col">x{{ j + 1 }}</th>
              }
              <th scope="col">=</th>
            </tr>
          </thead>
          <tbody>
            @for (i of cols(); track i) {
              <tr>
                @for (j of cellCols(); track j) {
                  <td [class.cur]="cur()[0] === i && cur()[1] === j" [class.rhs]="j === n()">
                    <input
                      type="text"
                      spellcheck="false"
                      autocomplete="off"
                      [attr.data-cell]="i + '-' + j"
                      [attr.aria-label]="cellLabel(i, j)"
                      [value]="cell(i, j)"
                      (focus)="cur.set([i, j])"
                      (keydown.enter)="commit(i, j, $any($event.target), $event)"
                      (keydown.arrowup)="go('up', $event)"
                      (keydown.arrowdown)="go('down', $event)"
                    />
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="sol" role="status" tabindex="0" [attr.aria-label]="i18n.t('lin.solution')">
        <p class="kind">{{ kind() }}</p>
        @for (l of lines(); track $index) {
          <p>{{ l }}</p>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .lin {
      display: grid;
      grid-template-rows: auto 1fr;
      height: 100%;
      font-size: 3.6cqw;
    }
    .grid {
      overflow: auto;
      padding: 0.2em 0.3em;
    }
    table {
      border-collapse: collapse;
      margin: 0 auto;
    }
    th {
      font-weight: normal;
      color: var(--lcd-muted);
      padding: 0 0.2em;
    }
    td {
      padding: 0.1em;
      border-radius: 0.2em;
    }
    td.cur {
      background: var(--lcd-cur);
    }
    td.rhs {
      border-left: 2px solid var(--lcd-line-strong);
      padding-left: 0.3em;
    }
    input {
      width: 4.2em;
      font: inherit;
      text-align: right;
      border: 1px solid var(--lcd-line);
      border-radius: 0.2em;
      background: var(--lcd-bg);
      color: var(--lcd-text);
    }
    .sol {
      overflow-y: auto;
      min-height: 0;
      padding: 0.1em 0.6em;
      border-top: 1px solid var(--lcd-line);
      background: var(--lcd-bg);
      color: var(--lcd-text);
    }
    .sol p {
      margin: 0.05em 0;
      font-variant-numeric: tabular-nums;
    }
    .kind {
      font-weight: 600;
    }
  `,
})
export class LinearView implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  private readonly apps = inject(AppStore);
  private readonly device = inject(DeviceStore);
  private readonly home = inject(HomeStore);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly state = computed(() => {
    const s = this.apps.current().state as LinearState;
    return s?.a ? s : initLinear();
  });
  protected readonly n = computed(() => this.state().n);
  protected readonly cols = computed(() => Array.from({ length: this.n() }, (_, i) => i));
  protected readonly cellCols = computed(() => Array.from({ length: this.n() + 1 }, (_, i) => i));
  protected readonly cur = signal<[number, number]>([0, 0]);
  private readonly message = signal<string | null>(null);
  private readonly result = computed(() => solveState(this.state()));
  protected readonly kind = computed(() => {
    if (this.message()) return this.message();
    const r = this.result();
    if (!r.ok) return r.error.message;
    return this.i18n.t(
      r.value.kind === 'unique'
        ? 'lin.unique'
        : r.value.kind === 'none'
          ? 'lin.none'
          : 'lin.infinite',
    );
  });
  protected readonly lines = computed(() => {
    const r = this.result();
    return r.ok ? describe(r.value, this.n()) : [];
  });
  private pop: (() => void) | null = null;

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'linear',
      title: () => this.i18n.t('lin.title'),
      menu: () => this.menu(),
      key: (p) => this.key(p),
      menuPress: (i) => this.press(i),
      rocker: (d) => this.go(d),
      insert: (_l, text) => this.typeText(text),
      help: 'linear',
    });
    queueMicrotask(() => this.focus());
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  protected cell(i: number, j: number): string {
    const s = this.state();
    return fmt(j === s.n ? s.b[i] : s.a[i][j]);
  }

  protected cellLabel(i: number, j: number): string {
    return j === this.n()
      ? this.i18n.t('lin.rhs', { r: i + 1 })
      : this.i18n.t('lin.coef', { r: i + 1, c: j + 1 });
  }

  private menu(): MenuButton[] {
    const n = this.n();
    return [
      { label: '2×2', active: n === 2 },
      { label: '3×3', active: n === 3 },
      { label: 'n −' },
      { label: 'n +' },
      { label: this.i18n.t('lin.clear') },
      { label: '' },
    ];
  }

  private setN(n: number): void {
    if (n < 2 || n > MAX_N) return;
    this.apps.update<LinearState>((s) => ({ ...(s?.a ? s : initLinear()), n }));
    const [i, j] = this.cur();
    this.cur.set([Math.min(i, n - 1), Math.min(j, n)]);
  }

  private press(i: number): void {
    this.message.set(null);
    if (i === 0) this.setN(2);
    if (i === 1) this.setN(3);
    if (i === 2) this.setN(this.n() - 1);
    if (i === 3) this.setN(this.n() + 1);
    if (i === 4) {
      const n = this.n();
      this.apps.update<LinearState>(() => ({ ...initLinear(), n }));
    }
    queueMicrotask(() => this.focus());
  }

  private input(): HTMLInputElement | null {
    const [i, j] = this.cur();
    return (this.host.nativeElement as HTMLElement).querySelector(`input[data-cell="${i}-${j}"]`);
  }

  private focus(): void {
    const el = this.input();
    el?.focus();
    el?.select();
  }

  protected commit(i: number, j: number, el: HTMLInputElement, e?: Event): void {
    e?.preventDefault();
    const src = el.value.trim();
    let v = 0;
    if (src) {
      const p = parseText(src);
      const r = p.ok ? evaluateValue(p.value, this.home.scope()) : p;
      if (!r.ok || r.value.kind !== 'real') {
        this.message.set(r.ok ? 'a real number is needed' : r.error.message);
        return;
      }
      v = r.value.v;
    }
    this.message.set(null);
    this.apps.update<LinearState>((s0) => {
      const s = s0?.a ? s0 : initLinear();
      if (j === s.n) return { ...s, b: s.b.map((x, k) => (k === i ? v : x)) };
      return {
        ...s,
        a: s.a.map((row, r) => (r === i ? row.map((x, c) => (c === j ? v : x)) : row)),
      };
    });
    queueMicrotask(() => (el.value = this.cell(i, j)));
    this.go('right');
  }

  private typeText(text: string): void {
    const el = this.input();
    if (!el) return;
    el.setRangeText(
      text,
      el.selectionStart ?? el.value.length,
      el.selectionEnd ?? el.value.length,
      'end',
    );
    el.focus();
  }

  protected go(d: RockerDir, e?: Event): boolean {
    e?.preventDefault();
    const n = this.n();
    let [i, j] = this.cur();
    if (d === 'up') i = (i + n - 1) % n;
    if (d === 'down') i = (i + 1) % n;
    if (d === 'left') j = j > 0 ? j - 1 : n;
    if (d === 'right') {
      if (j < n) j++;
      else {
        j = 0;
        i = (i + 1) % n;
      }
    }
    this.cur.set([i, j]);
    this.focus();
    return true;
  }

  private key(p: KeyPress): boolean {
    if (p.id === 'enter') {
      const el = this.input();
      const [i, j] = this.cur();
      if (el) this.commit(i, j, el);
      return true;
    }
    if (p.id === 'bksp' && p.layer === 'main') {
      const el = this.input();
      if (el) {
        const s = el.selectionStart ?? el.value.length;
        const e = el.selectionEnd ?? el.value.length;
        if (s !== e) el.setRangeText('', s, e, 'end');
        else if (s > 0) el.setRangeText('', s - 1, s, 'end');
      }
      return true;
    }
    const a = editFor(p);
    if (a?.kind === 'insert') {
      this.typeText(a.text);
      return true;
    }
    return false;
  }
}
