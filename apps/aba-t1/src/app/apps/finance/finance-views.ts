import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { PlotCanvas, type PlotPainter } from '@aba/core/graph/plot-canvas';
import { drawAxes, drawLines, drawPoint, DARK_PLOT } from '@aba/core/graph/plot-draw';
import type { BlackScholesResult } from '@aba/math/finance/misc';
import type { Viewport } from '@aba/math/graph/viewport';
import type { MathResult } from '@aba/math/result';
import { formatReal } from '@aba/math/value/format';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import type { TextKey } from '../../core/i18n/texts';
import type { MenuButton } from '../../features/device/t1-device';
import { AppStore } from '../app-store';
import { FieldForm, type FormItem } from '../shared/field-form';
import {
  BREAK_KEYS,
  type FinanceState,
  type MarginKey,
  type PctKey,
  SHEETS,
  type Sheet,
  TVM_KEYS,
  amortGroups,
  amortTable,
  bondFromYield,
  bsResult,
  cashResults,
  dateError,
  dateResults,
  deprResult,
  initFinance,
  npvProfile,
  solveBond,
  solveBreak,
  solveConv,
  solveMarginField,
  solvePct,
  solveTvmField,
} from './finance-logic';

const fmt = (x: number) => formatReal(x, { mode: 'standard', digits: 0, decimal: '.' });
const show = (r: MathResult<number>) => (r.ok ? fmt(r.value) : r.error.message);
/** money: rounded to cents for tables */
const money = (x: number) => (Math.round(x * 100) / 100).toFixed(2);

function financeApp() {
  const apps = inject(AppStore);
  const i18n = inject(I18n);
  const state = computed(() => {
    const s = apps.current().state as FinanceState;
    return s?.tvm ? s : initFinance();
  });
  const update = (f: (s: FinanceState) => FinanceState) =>
    apps.update<FinanceState>((s) => f(s?.tvm ? s : initFinance()));
  const t = (k: TextKey, p: Record<string, string | number> = {}) => i18n.t(k, p);
  return { apps, i18n, state, update, t };
}

const SHEET_TITLES: Record<Sheet, TextKey> = {
  tvm: 'fin.sheet.tvm',
  cash: 'fin.sheet.cash',
  conv: 'fin.sheet.conv',
  date: 'fin.sheet.date',
  depr: 'fin.sheet.depr',
  break: 'fin.sheet.break',
  pct: 'fin.sheet.pct',
  margin: 'fin.sheet.margin',
  bond: 'fin.sheet.bond',
  bs: 'fin.sheet.bs',
};

/** Symbolic view of the finance app: the list of worksheets; Enter or a tap opens one. */
@Component({
  selector: 'app-finance-symb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="sheets" [attr.aria-label]="app.t('fin.symb')">
      @for (s of sheets; track s; let i = $index) {
        <li>
          <button
            type="button"
            [class.cur]="cursor() === i"
            [attr.aria-current]="app.state().sheet === s ? 'true' : null"
            (click)="open(i)"
          >
            <span class="no">{{ i + 1 }}</span> {{ app.t(titles[s]) }}
          </button>
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      overflow-y: auto;
    }
    .sheets {
      margin: 0;
      padding: 0.2em 0.4em;
      list-style: none;
      font-size: 3.9cqw;
    }
    button {
      display: block;
      width: 100%;
      text-align: left;
      font: inherit;
      color: var(--lcd-text);
      background: transparent;
      border: 0;
      border-radius: 0.2em;
      padding: 0.08em 0.3em;
      cursor: pointer;
    }
    button.cur {
      background: var(--lcd-cur);
    }
    button[aria-current='true'] {
      font-weight: 600;
    }
    .no {
      display: inline-block;
      width: 1.4em;
      color: var(--lcd-muted);
    }
  `,
})
export class FinanceSymb implements OnInit, OnDestroy {
  protected readonly app = financeApp();
  private readonly device = inject(DeviceStore);
  protected readonly sheets = SHEETS;
  protected readonly titles = SHEET_TITLES;
  protected readonly cursor = signal(Math.max(0, SHEETS.indexOf(this.app.state().sheet)));
  private pop: (() => void) | null = null;

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'finance-symb',
      title: () => this.app.t('fin.symb'),
      menu: () => [
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: this.app.t('fin.open') },
      ],
      menuPress: (i) => i === 5 && this.open(this.cursor()),
      key: (p) => this.key(p),
      rocker: (d) => this.rocker(d),
      help: 'finance',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  protected open(i: number): void {
    const sheet = SHEETS[i];
    if (!sheet) return;
    this.app.update((s) => ({ ...s, sheet }));
    this.app.apps.show('num');
  }

  private key(p: KeyPress): boolean {
    if (p.id === 'enter') {
      this.open(this.cursor());
      return true;
    }
    const d = /^d(\d)$/.exec(p.id);
    if (d && p.layer === 'main') {
      this.open((Number(d[1]) + 9) % 10);
      return true;
    }
    return false;
  }

  private rocker(d: RockerDir): boolean {
    const n = SHEETS.length;
    if (d === 'up') this.cursor.update((c) => (c + n - 1) % n);
    if (d === 'down') this.cursor.update((c) => (c + 1) % n);
    return true;
  }
}

/** Amortization table: per payment or per year (P/YR payments), totals at the end. */
@Component({
  selector: 'app-amort-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { tabindex: '0', role: 'region', '[attr.aria-label]': 'app.t("fin.amortTitle")' },
  template: `
    @if (rows(); as r) {
      @if (r.ok) {
        <table class="amort">
          <thead>
            <tr>
              <th scope="col">{{ byYear() ? app.t('fin.yearCol') : '#' }}</th>
              <th scope="col">{{ app.t('fin.interest') }}</th>
              <th scope="col">{{ app.t('fin.principal') }}</th>
              <th scope="col">{{ app.t('fin.balance') }}</th>
            </tr>
          </thead>
          <tbody>
            @for (x of r.value; track x.k) {
              <tr>
                <th scope="row">{{ x.k }}</th>
                <td>{{ x.interest }}</td>
                <td>{{ x.principal }}</td>
                <td>{{ x.balance }}</td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Σ</th>
              <td>{{ totals().interest }}</td>
              <td>{{ totals().principal }}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      } @else {
        <p class="msg" role="alert">{{ r.error.message }}</p>
      }
    }
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      overflow: auto;
    }
    .amort {
      width: 100%;
      border-collapse: collapse;
      font-size: 3.5cqw;
      font-variant-numeric: tabular-nums;
    }
    th,
    td {
      padding: 0.05em 0.3em;
      border-bottom: 1px solid var(--lcd-line);
      text-align: right;
      color: var(--lcd-text);
    }
    thead th {
      background: var(--lcd-head);
      position: sticky;
      top: 0;
    }
    tfoot th,
    tfoot td {
      font-weight: 600;
      background: var(--lcd-head);
      position: sticky;
      bottom: 0;
    }
    .msg {
      color: var(--lcd-error);
      padding: 0.4em;
      font-size: 3.6cqw;
    }
  `,
})
export class AmortTable implements OnInit, OnDestroy {
  readonly close = input<() => void>(() => undefined);
  protected readonly app = financeApp();
  private readonly device = inject(DeviceStore);
  private readonly host = inject(ElementRef<HTMLElement>);
  protected readonly byYear = signal(false);
  private readonly raw = computed(() => amortTable(this.app.state().tvm));
  protected readonly rows = computed(() => {
    const r = this.raw();
    if (!r.ok) return r;
    const list = this.byYear()
      ? amortGroups(r.value, this.app.state().tvm.py).map((g) => ({ ...g, k: g.year }))
      : r.value.map((x) => ({ ...x, k: x.period }));
    return {
      ok: true as const,
      value: list.map((x) => ({
        k: x.k,
        interest: money(x.interest),
        principal: money(x.principal),
        balance: money(x.balance),
      })),
    };
  });
  protected readonly totals = computed(() => {
    const r = this.raw();
    if (!r.ok) return { interest: '', principal: '' };
    return {
      interest: money(r.value.reduce((s, x) => s + x.interest, 0)),
      principal: money(r.value.reduce((s, x) => s + x.principal, 0)),
    };
  });
  private pop: (() => void) | null = null;

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'amort',
      title: () => this.app.t('fin.amortTitle'),
      menu: () => [
        { label: this.app.t('fin.byPayment'), active: !this.byYear() },
        { label: this.app.t('fin.byYear'), active: this.byYear() },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: 'OK' },
      ],
      menuPress: (i) => {
        if (i === 0) this.byYear.set(false);
        if (i === 1) this.byYear.set(true);
        if (i === 5) this.close()();
      },
      key: (p) => {
        if (p.id === 'esc' || p.id === 'enter') {
          this.close()();
          return true;
        }
        return false;
      },
      rocker: (d) => {
        const el = this.host.nativeElement as HTMLElement;
        const h = el.clientHeight * 0.8;
        if (d === 'up') el.scrollTop -= h / 4;
        if (d === 'down') el.scrollTop += h / 4;
        return true;
      },
      help: 'finance',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }
}

type Num = (label: string, get: () => number, set: (v: number) => void) => FormItem;

/**
 * Numeric view of the finance app: the form of the chosen worksheet. Solve computes the field
 * under the cursor (TVM: N, I%YR, PV, PMT or FV); other worksheets show their results live.
 * TVM: Amort opens the amortization table.
 */
@Component({
  selector: 'app-finance-num',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldForm, AmortTable],
  template: `
    @if (amort()) {
      <app-amort-table [close]="closeAmort" />
    } @else {
      <app-field-form
        [title]="app.t(titles[app.state().sheet])"
        help="finance"
        [items]="items()"
        [menu]="menu"
        [menuPress]="press"
        [status]="status()"
      />
    }
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
  `,
})
export class FinanceNum {
  protected readonly app = financeApp();
  protected readonly titles = SHEET_TITLES;
  private readonly form = viewChild(FieldForm);
  protected readonly amort = signal(false);
  protected readonly status = signal<string | null>(null);
  protected readonly closeAmort = () => this.amort.set(false);
  // results of the worksheets, computed once per change
  private readonly cashRes = computed(() => cashResults(this.app.state().cash));
  private readonly dateRes = computed(() => dateResults(this.app.state().date));
  private readonly deprRes = computed(() => deprResult(this.app.state().depr));
  private readonly bondRes = computed(() => bondFromYield(this.app.state().bond));
  private readonly bsRes = computed(() => bsResult(this.app.state().bs));

  private readonly num: Num = (label, get, set) => ({
    label,
    value: get,
    set: (v) => {
      if (v === null) return this.app.t('fin.needNumber');
      set(v);
      this.status.set(null);
      return null;
    },
  });

  private patch<K extends keyof FinanceState>(k: K, p: Partial<FinanceState[K]>): void {
    this.app.update((s) => ({ ...s, [k]: { ...(s[k] as object), ...p } }));
  }

  private out(label: string, get: () => string): FormItem {
    return { kind: 'output', label, output: get };
  }

  /** The keys that Solve can compute, by row (null = not solvable). */
  private solvable(): (string | null)[] {
    switch (this.app.state().sheet) {
      case 'tvm':
        return [...TVM_KEYS];
      case 'conv':
        return ['nominal', 'effective'];
      case 'break':
        return [...BREAK_KEYS];
      case 'pct':
        return ['old', 'new', 'percent', 'periods'];
      case 'margin':
        return [null, 'cost', 'price', 'percent'];
      case 'bond':
        return [null, null, null, null, null, null, 'yld', 'price'];
      default:
        return [];
    }
  }

  protected readonly items = computed<FormItem[]>(() => {
    const s = () => this.app.state();
    const t = this.app.t;
    const num = this.num;
    switch (s().sheet) {
      case 'tvm': {
        const f = (k: keyof FinanceState['tvm'], label: string) =>
          num(
            label,
            () => s().tvm[k] as number,
            (v) => this.patch('tvm', { [k]: v }),
          );
        return [
          f('n', 'N'),
          f('iyr', 'I%YR'),
          f('pv', 'PV'),
          f('pmt', 'PMT'),
          f('fv', 'FV'),
          f('py', 'P/YR'),
          f('cy', 'C/YR'),
          {
            kind: 'choice',
            label: t('fin.timing'),
            choices: [
              { value: 'end', label: t('fin.end') },
              { value: 'begin', label: t('fin.begin') },
            ],
            value: () => s().tvm.timing,
            set: (v: string) => this.patch('tvm', { timing: v === 'begin' ? 'begin' : 'end' }),
          },
        ];
      }
      case 'cash': {
        const c = () => s().cash;
        const res = this.cashRes;
        const r = <K extends 'npv' | 'nfv' | 'mirr' | 'payback' | 'discountedPayback'>(k: K) => {
          const x = res();
          return x.ok ? show(x.value[k]) : x.error.message;
        };
        const groups: FormItem[] = c().flows.flatMap((_, k) => [
          num(
            `CF${k + 1}`,
            () => c().flows[k]?.amount ?? 0,
            (v) =>
              this.patch('cash', {
                flows: c().flows.map((g, j) => (j === k ? { ...g, amount: v } : g)),
              }),
          ),
          num(
            `F${k + 1}`,
            () => c().flows[k]?.count ?? 1,
            (v) =>
              this.patch('cash', {
                flows: c().flows.map((g, j) => (j === k ? { ...g, count: v } : g)),
              }),
          ),
        ]);
        return [
          num(
            'CF0',
            () => c().cf0,
            (v) => this.patch('cash', { cf0: v }),
          ),
          ...groups,
          num(
            t('fin.rate'),
            () => c().rate,
            (v) => this.patch('cash', { rate: v }),
          ),
          num(
            t('fin.finRate'),
            () => c().finRate,
            (v) => this.patch('cash', { finRate: v }),
          ),
          num(
            t('fin.reinvRate'),
            () => c().reinvRate,
            (v) => this.patch('cash', { reinvRate: v }),
          ),
          this.out('NPV', () => r('npv')),
          this.out('NFV', () => r('nfv')),
          this.out('IRR %', () => {
            const x = res();
            if (!x.ok) return x.error.message;
            if (!x.value.irr.ok) return x.value.irr.error.message;
            const v = x.value.irr.value;
            return v.irr !== null
              ? fmt(v.irr) + (v.warning ? ' (!)' : '')
              : t('fin.irrMany', { r: v.rates.map(fmt).join('; ') });
          }),
          this.out('MIRR %', () => r('mirr')),
          this.out(t('fin.payback'), () => r('payback')),
          this.out(t('fin.dpayback'), () => r('discountedPayback')),
        ];
      }
      case 'conv':
        return [
          num(
            t('fin.nominal'),
            () => s().conv.nominal,
            (v) => this.patch('conv', { nominal: v }),
          ),
          num(
            t('fin.effective'),
            () => s().conv.effective,
            (v) => this.patch('conv', { effective: v }),
          ),
          num(
            t('fin.cy0'),
            () => s().conv.c,
            (v) => this.patch('conv', { c: v }),
          ),
        ];
      case 'date': {
        const d = () => s().date;
        const r = this.dateRes;
        const text = (k: 'd1' | 'd2', label: string): FormItem => ({
          kind: 'text',
          label,
          text: () => d()[k],
          setText: (x: string) => {
            const e = dateError(x);
            if (e) return e;
            this.patch('date', { [k]: x });
            return null;
          },
        });
        const str = (x: MathResult<string>) => (x.ok ? x.value : x.error.message);
        return [
          text('d1', t('fin.d1')),
          text('d2', t('fin.d2')),
          {
            kind: 'choice',
            label: t('fin.basis'),
            choices: [
              { value: 'actual', label: t('fin.actual') },
              { value: '30/360', label: '30/360' },
            ],
            value: () => d().basis,
            set: (v: string) => this.patch('date', { basis: v === '30/360' ? '30/360' : 'actual' }),
          },
          this.out(t('fin.days'), () => show(r().days)),
          this.out(t('fin.dow1'), () => str(r().dow1)),
          this.out(t('fin.dow2'), () => str(r().dow2)),
          num(
            t('fin.add'),
            () => d().add,
            (v) => this.patch('date', { add: v }),
          ),
          this.out(t('fin.plus'), () => str(r().plus)),
        ];
      }
      case 'depr': {
        const d = () => s().depr;
        const r = this.deprRes;
        const o = (k: 'depreciation' | 'accumulated' | 'bookValue' | 'remaining') => {
          const x = r();
          return x.ok ? fmt(x.value[k]) : x.error.message;
        };
        const f = (k: 'cost' | 'salvage' | 'life' | 'factor' | 'year', label: string) =>
          num(
            label,
            () => d()[k],
            (v) => this.patch('depr', { [k]: v }),
          );
        return [
          {
            kind: 'choice',
            label: t('fin.method'),
            choices: [
              { value: 'sl', label: t('fin.sl') },
              { value: 'db', label: t('fin.db') },
              { value: 'syd', label: t('fin.syd') },
            ],
            value: () => d().method,
            set: (v: string) =>
              this.patch('depr', { method: v === 'db' ? 'db' : v === 'syd' ? 'syd' : 'sl' }),
          },
          f('cost', t('fin.cost')),
          f('salvage', t('fin.salvage')),
          f('life', t('fin.life')),
          f('factor', t('fin.factor')),
          f('year', t('fin.year')),
          this.out(t('fin.dep'), () => o('depreciation')),
          this.out(t('fin.acc'), () => o('accumulated')),
          this.out(t('fin.book'), () => o('bookValue')),
          this.out(t('fin.remaining'), () => o('remaining')),
        ];
      }
      case 'break': {
        const labels: Record<string, TextKey> = {
          fixedCost: 'fin.fixed',
          variableCost: 'fin.varCost',
          price: 'fin.price',
          profit: 'fin.profit',
          quantity: 'fin.qty',
        };
        return BREAK_KEYS.map((k) =>
          num(
            t(labels[k]),
            () => s().brk[k],
            (v) => this.patch('brk', { [k]: v }),
          ),
        );
      }
      case 'pct': {
        const labels: Record<PctKey, TextKey> = {
          old: 'fin.old',
          new: 'fin.new',
          percent: 'fin.pctCh',
          periods: 'fin.periods',
        };
        return (['old', 'new', 'percent', 'periods'] as PctKey[]).map((k) =>
          num(
            t(labels[k]),
            () => s().pct[k],
            (v) => this.patch('pct', { [k]: v }),
          ),
        );
      }
      case 'margin': {
        const labels: Record<MarginKey, TextKey> = {
          cost: 'fin.cost',
          price: 'fin.price',
          percent: 'fin.percent',
        };
        return [
          {
            kind: 'choice',
            label: t('fin.kind'),
            choices: [
              { value: 'margin', label: t('fin.margin') },
              { value: 'markup', label: t('fin.markup') },
            ],
            value: () => (s().margin.markup ? 'markup' : 'margin'),
            set: (v: string) => this.patch('margin', { markup: v === 'markup' }),
          },
          ...(['cost', 'price', 'percent'] as MarginKey[]).map((k) =>
            num(
              t(labels[k]),
              () => s().margin[k],
              (v) => this.patch('margin', { [k]: v }),
            ),
          ),
        ];
      }
      case 'bond': {
        const b = () => s().bond;
        const r = this.bondRes;
        const text = (k: 'settlement' | 'maturity', label: string): FormItem => ({
          kind: 'text',
          label,
          text: () => b()[k],
          setText: (x: string) => {
            const e = dateError(x);
            if (e) return e;
            this.patch('bond', { [k]: x });
            return null;
          },
        });
        return [
          text('settlement', t('fin.settle')),
          text('maturity', t('fin.maturity')),
          num(
            t('fin.coupon'),
            () => b().coupon,
            (v) => this.patch('bond', { coupon: v }),
          ),
          num(
            t('fin.redemption'),
            () => b().redemption,
            (v) => this.patch('bond', { redemption: v }),
          ),
          {
            kind: 'choice',
            label: t('fin.freq'),
            choices: [
              { value: '1', label: t('fin.annual') },
              { value: '2', label: t('fin.semi') },
            ],
            value: () => String(b().frequency),
            set: (v: string) => this.patch('bond', { frequency: v === '1' ? 1 : 2 }),
          },
          {
            kind: 'choice',
            label: t('fin.basis'),
            choices: [
              { value: '30/360', label: '30/360' },
              { value: 'actual', label: t('fin.actual') },
            ],
            value: () => b().basis,
            set: (v: string) => this.patch('bond', { basis: v === 'actual' ? 'actual' : '30/360' }),
          },
          num(
            t('fin.yield'),
            () => b().yld,
            (v) => this.patch('bond', { yld: v }),
          ),
          num(
            t('fin.price'),
            () => b().price,
            (v) => this.patch('bond', { price: v }),
          ),
          this.out(t('fin.accrued'), () => {
            const x = r();
            return x.ok ? fmt(x.value.accruedInterest) : x.error.message;
          }),
          this.out(t('fin.dirty'), () => {
            const x = r();
            return x.ok ? fmt(x.value.dirtyPrice) : x.error.message;
          }),
        ];
      }
      case 'bs': {
        const o = () => s().bs;
        const r = this.bsRes;
        const f = (k: keyof FinanceState['bs'], label: string) =>
          num(
            label,
            () => o()[k],
            (v) => this.patch('bs', { [k]: v }),
          );
        const res = (g: (x: BlackScholesResult) => number) => () => {
          const x = r();
          return x.ok ? fmt(g(x.value)) : x.error.message;
        };
        return [
          f('spot', t('fin.spot')),
          f('strike', t('fin.strike')),
          f('rate', t('fin.rfRate')),
          f('volatility', t('fin.vol')),
          f('time', t('fin.time')),
          f('dividend', t('fin.div')),
          this.out(
            t('fin.call'),
            res((x) => x.call),
          ),
          this.out(
            t('fin.put'),
            res((x) => x.put),
          ),
          this.out(
            'Δ call',
            res((x) => x.callGreeks.delta),
          ),
          this.out(
            'Δ put',
            res((x) => x.putGreeks.delta),
          ),
          this.out(
            'Γ',
            res((x) => x.callGreeks.gamma),
          ),
          this.out(
            'Vega',
            res((x) => x.callGreeks.vega),
          ),
        ];
      }
    }
  });

  protected readonly menu = (): MenuButton[] => {
    const t = this.app.t;
    const sheet = this.app.state().sheet;
    const solve = this.solvable().length > 0;
    const b: MenuButton[] = [
      { label: t('fin.sheets') },
      { label: solve ? t('solve.solve') : '' },
      { label: '' },
      { label: '' },
      { label: '' },
      { label: '' },
    ];
    if (sheet === 'tvm') b[2] = { label: t('fin.amort') };
    if (sheet === 'cash') {
      b[2] = { label: t('fin.addCf') };
      b[3] = { label: t('fin.delCf') };
    }
    return b;
  };

  protected readonly press = (i: number, cursor: number): void => {
    const sheet = this.app.state().sheet;
    if (i === 0) {
      this.app.apps.show('symb');
      return;
    }
    if (i === 1) this.solve(cursor);
    if (i === 2 && sheet === 'tvm') this.amort.set(true);
    if (sheet === 'cash' && i === 2)
      this.patch('cash', { flows: [...this.app.state().cash.flows, { amount: 0, count: 1 }] });
    if (sheet === 'cash' && i === 3 && this.app.state().cash.flows.length > 0)
      this.patch('cash', { flows: this.app.state().cash.flows.slice(0, -1) });
  };

  private solve(cursor: number): void {
    const key = this.solvable()[cursor];
    if (!key) {
      this.status.set(this.app.t('fin.solveHint'));
      return;
    }
    const s = this.app.state();
    let r: MathResult<unknown>;
    let warning: string | undefined;
    switch (s.sheet) {
      case 'tvm': {
        const x = solveTvmField(s.tvm, key as (typeof TVM_KEYS)[number]);
        r = x;
        if (x.ok) {
          warning = x.value.warning;
          this.app.update((st) => ({ ...st, tvm: x.value.tvm }));
        }
        break;
      }
      case 'conv': {
        const x = solveConv(s.conv, key as 'nominal' | 'effective');
        r = x;
        if (x.ok) this.app.update((st) => ({ ...st, conv: x.value }));
        break;
      }
      case 'break': {
        const x = solveBreak(s.brk, key as (typeof BREAK_KEYS)[number]);
        r = x;
        if (x.ok) this.app.update((st) => ({ ...st, brk: x.value }));
        break;
      }
      case 'pct': {
        const x = solvePct(s.pct, key as PctKey);
        r = x;
        if (x.ok) this.app.update((st) => ({ ...st, pct: x.value }));
        break;
      }
      case 'margin': {
        const x = solveMarginField(s.margin, key as MarginKey);
        r = x;
        if (x.ok) this.app.update((st) => ({ ...st, margin: x.value }));
        break;
      }
      case 'bond': {
        const x = solveBond(s.bond, key as 'price' | 'yld');
        r = x;
        if (x.ok) this.app.update((st) => ({ ...st, bond: x.value }));
        break;
      }
      default:
        return;
    }
    const label = this.items()[cursor]?.label ?? key;
    this.status.set(
      r.ok
        ? this.app.t('fin.solved', { k: label }) + (warning ? ` – ${warning}` : '')
        : r.error.message,
    );
    this.form()?.focus();
  }
}

/**
 * Plot view of the finance app: TVM – balance and paid interest over the payments; cash flow –
 * the NPV profile over the rate with the IRR marked. Other worksheets have no plot.
 */
@Component({
  selector: 'app-finance-plot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlotCanvas],
  template: `
    <div class="plot">
      <app-plot-canvas [view]="view()" [painter]="painter()" [label]="label()" />
      <p class="bar" role="status">{{ bar() }}</p>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .plot {
      display: grid;
      grid-template-rows: 1fr auto;
      height: 100%;
    }
    .bar {
      margin: 0;
      padding: 0.05em 0.4em;
      font-size: 3.4cqw;
      background: var(--lcd-bg);
      border-top: 1px solid var(--lcd-line);
      color: var(--lcd-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
})
export class FinancePlot implements OnInit, OnDestroy {
  private readonly app = financeApp();
  private readonly device = inject(DeviceStore);
  private readonly amort = computed(() => {
    const s = this.app.state();
    return s.sheet === 'tvm' ? amortTable(s.tvm) : null;
  });
  private readonly npv = computed(() => {
    const s = this.app.state();
    return s.sheet === 'cash' ? npvProfile(s.cash) : null;
  });
  private readonly irrs = computed(() => {
    const s = this.app.state();
    if (s.sheet !== 'cash') return [];
    const r = cashResults(s.cash);
    return !r.ok || !r.value.irr.ok ? [] : r.value.irr.value.rates;
  });
  protected readonly view = computed<Viewport>(() => {
    const a = this.amort();
    if (a?.ok) {
      const pv = this.app.state().tvm.pv;
      const vals = [pv, 0, ...a.value.map((r) => r.balance)];
      let cum = 0;
      for (const r of a.value) vals.push((cum += r.interest));
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      const pad = (hi - lo) * 0.08 || 1;
      return {
        xmin: -a.value.length * 0.04,
        xmax: a.value.length * 1.04,
        ymin: lo - pad,
        ymax: hi + pad,
      };
    }
    const f = this.npv();
    if (f) {
      const top = Math.max(50, ...this.irrs().map((r) => r * 1.5));
      const xs = Array.from({ length: 101 }, (_, k) => -50 + ((top + 50) * k) / 100);
      const ys = xs.map(f).filter(Number.isFinite);
      const lo = Math.min(0, ...ys);
      const hi = Math.max(0, ...ys);
      const pad = (hi - lo) * 0.08 || 1;
      return { xmin: -50, xmax: top, ymin: lo - pad, ymax: hi + pad };
    }
    return { xmin: -10, xmax: 10, ymin: -6.5, ymax: 6.5 };
  });
  protected readonly label = computed(() => this.bar());
  protected readonly bar = computed(() => {
    const s = this.app.state();
    const t = this.app.t;
    const a = this.amort();
    if (a) {
      if (!a.ok) return a.error.message;
      const total = a.value.reduce((x, r) => x + r.interest, 0);
      return `${t('fin.balance')} (—) · ${t('fin.interest')} Σ (- - -) ${money(total)}`;
    }
    if (s.sheet === 'cash') {
      const r = this.irrs();
      return `NPV(I%) · IRR: ${r.length ? r.map(fmt).join('; ') : '—'}`;
    }
    return t('fin.noPlot');
  });
  protected readonly painter = computed<PlotPainter>(() => {
    const a = this.amort();
    const f = this.npv();
    const irrs = this.irrs();
    return (frame) => {
      drawAxes(frame, DARK_PLOT);
      if (a?.ok) {
        const pv = this.app.state().tvm.pv;
        const bal: [number, number][] = [
          [0, pv],
          ...a.value.map((r): [number, number] => [r.period, r.balance]),
        ];
        let cum = 0;
        const int: [number, number][] = [
          [0, 0],
          ...a.value.map((r): [number, number] => [r.period, (cum += r.interest)]),
        ];
        drawLines(frame, [bal], '#5cb8ea', 2);
        drawLines(frame, [int], '#d1495b', 2, [5, 4]);
      }
      if (f) {
        const v = frame.view;
        const pts: [number, number][] = [];
        for (let k = 0; k <= 300; k++) {
          const x = v.xmin + ((v.xmax - v.xmin) * k) / 300;
          const y = f(x);
          if (Number.isFinite(y)) pts.push([x, y]);
        }
        drawLines(frame, [pts], '#5cb8ea', 2);
        for (const r of irrs)
          drawPoint(frame, r, 0, '#d1495b', `IRR ${fmt(Number(r.toPrecision(6)))} %`);
      }
    };
  });
  private pop: (() => void) | null = null;

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'finance-plot',
      title: () => this.app.t('fin.plot'),
      menu: () => [
        { label: this.app.t('fin.sheets') },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
      ],
      menuPress: (i) => i === 0 && this.app.apps.show('symb'),
      help: 'finance',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }
}
