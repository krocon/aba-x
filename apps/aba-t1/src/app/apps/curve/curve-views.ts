import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import type { Gesture } from '@aba/core/actions/gestures';
import { FilesApi } from '@aba/core/files/files-api';
import { PlotCanvas, type PlotPainter } from '@aba/core/graph/plot-canvas';
import {
  type PlotFrame,
  drawAxes,
  drawLines,
  drawPoint,
  DARK_PLOT,
} from '@aba/core/graph/plot-draw';
import { MathField } from '@aba/core/shared/math-field';
import { MathStatic } from '@aba/core/shared/math-static';
import { sampleParametric } from '@aba/math/graph/parametric';
import type { Polyline } from '@aba/math/graph/sampler';
import { type Viewport, pan, toWorldX, toWorldY } from '@aba/math/graph/viewport';
import { parseText } from '@aba/math/parser/text-parser';
import { evaluateValue } from '@aba/math/value/evaluate-value';
import { formatReal } from '@aba/math/value/format';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { type Area, DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import type { TextKey } from '../../core/i18n/texts';
import { catalogShortcuts } from '../../core/latex/typed-names';
import type { MenuButton } from '../../features/device/t1-device';
import { editFor } from '../../features/home/home-keys';
import { HomeStore } from '../../features/home/home-store';
import { SettingsStore } from '../../features/settings/settings-store';
import { AppStore } from '../app-store';
import { injectAppScope } from '../shared/app-scope';
import { PlotMenu, type PlotMenuItem } from '../shared/plot-menu';
import { ZOOM_OPS, type ZoomOp, zoomView } from '../shared/plot-logic';
import { SetupForm, type SetupItem } from '../shared/setup-form';
import {
  type Curve,
  type CurveKind,
  type CurveState,
  KINDS,
  LOGIC_NAMES,
  curveTable,
  curves,
  fieldLabels,
  rowColor,
  rowErrors,
  tableHeads,
} from './curve-logic';

const fmt = (x: number) =>
  Number.isFinite(x) ? formatReal(x, { mode: 'standard', digits: 0, decimal: '.' }) : '—';

/** Kind and state of the running curve app. */
function curveApp() {
  const apps = inject(AppStore);
  const kind = computed(() => apps.currentDef().id as CurveKind);
  const state = computed(() => apps.current().state as CurveState);
  return { apps, kind, state };
}

const TITLES: Record<CurveKind, { symb: TextKey; plot: TextKey; num: TextKey }> = {
  parametric: { symb: 'curve.paramSymb', plot: 'curve.paramPlot', num: 'curve.paramNum' },
  polar: { symb: 'curve.polarSymb', plot: 'curve.polarPlot', num: 'curve.polarNum' },
  sequence: { symb: 'curve.seqSymb', plot: 'curve.seqPlot', num: 'curve.seqNum' },
  graph3d: { symb: 'curve.surfSymb', plot: 'surface.plot', num: 'surface.num' },
  relation: { symb: 'rel.symb', plot: 'rel.plot', num: 'rel.num' },
  solve: { symb: 'solve.symb', plot: 'solve.plot', num: 'solve.num' },
};

const SYMB_HELP: Partial<Record<CurveKind, string>> = { relation: 'relation', solve: 'solve' };

/** Symbolic view (prompt 035): ten rows with one to three fields; ←→ choose the field. */
@Component({
  selector: 'app-curve-symb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MathField, MathStatic],
  template: `
    <div class="symb">
      <ul class="defs" [attr.aria-label]="i18n.t(titles().symb)">
        @for (r of rows(); track $index; let i = $index) {
          <li
            tabindex="-1"
            [class.cur]="row() === i"
            [attr.aria-current]="row() === i ? 'true' : null"
            (keydown.enter)="edit()"
          >
            <button
              type="button"
              class="check"
              [attr.aria-pressed]="r.on"
              [attr.aria-label]="r.labels[0] + (r.on ? ' on' : ' off')"
              (click)="toggle(i)"
            >
              {{ r.on ? '✓' : '' }}
            </button>
            <span class="swatch" [style.background]="r.color"></span>
            @for (f of r.fields; track $index; let k = $index) {
              <span
                class="field"
                tabindex="-1"
                [class.cur]="row() === i && field() === k"
                [class.err]="r.errors[k]"
                (click)="pick(i, k)"
                (keydown.enter)="pick(i, k)"
              >
                <span class="lbl">{{ r.labels[k] }}=</span>
                @if (f) {
                  <app-math [latex]="f" />
                }
              </span>
            }
          </li>
        }
      </ul>
      @if (editing()) {
        <div class="entry">
          <span class="lbl">{{ rows()[row()].labels[field()] }}=</span>
          <app-math-field
            [ariaLabel]="rows()[row()].labels[field()]"
            [keyHook]="keyHook"
            [shortcuts]="shortcuts"
            [replaceShortcuts]="true"
            (ready)="fill()"
          />
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .symb {
      display: grid;
      grid-template-rows: 1fr auto;
      height: 100%;
      font-size: 3.9cqw;
    }
    .defs {
      margin: 0;
      padding: 0;
      list-style: none;
      overflow-y: auto;
      min-height: 0;
    }
    li {
      display: flex;
      align-items: center;
      gap: 0.35em;
      padding: 0.1em 0.4em;
      border-bottom: 1px solid var(--lcd-line);
      min-height: 1.6em;
    }
    li.cur {
      background: var(--lcd-cur-soft);
    }
    .check {
      width: 1.1em;
      height: 1.1em;
      padding: 0;
      border: 1px solid var(--lcd-line-strong);
      border-radius: 0.15em;
      background: var(--lcd-bg);
      font: inherit;
      font-size: 0.8em;
      line-height: 1;
      cursor: pointer;
    }
    .swatch {
      width: 0.6em;
      height: 0.6em;
      border-radius: 50%;
      flex: none;
    }
    .field {
      display: flex;
      align-items: center;
      gap: 0.2em;
      overflow: hidden;
      white-space: nowrap;
      padding: 0 0.2em;
      border-radius: 0.2em;
      cursor: pointer;
      min-width: 3em;
    }
    .field.cur {
      background: var(--lcd-cur);
    }
    .field.err {
      outline: 1px dashed var(--lcd-error);
    }
    .lbl {
      color: var(--lcd-muted);
    }
    .entry {
      display: flex;
      align-items: center;
      gap: 0.3em;
      border-top: 2px solid var(--lcd-line-strong);
      padding: 0.1em 0.4em;
      background: var(--lcd-bg);
    }
    .entry app-math-field {
      flex: 1;
    }
  `,
})
export class CurveSymb implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  private readonly app = curveApp();
  private readonly device = inject(DeviceStore);
  private readonly fieldEl = viewChild(MathField);
  protected readonly shortcuts = catalogShortcuts([
    'U1',
    'U2',
    'U3',
    'U4',
    'U5',
    'U6',
    'U7',
    'U8',
    'U9',
    'U0',
    ...LOGIC_NAMES,
  ]);
  protected readonly titles = computed(() => TITLES[this.app.kind()]);
  protected readonly row = signal(0);
  protected readonly field = signal(0);
  protected readonly editing = signal(false);
  private logic = -1;
  protected readonly rows = computed(() => {
    const kind = this.app.kind();
    const s = this.app.state();
    const errors = rowErrors(kind, s.rows);
    return s.rows.map((r, i) => ({
      ...r,
      labels: fieldLabels(kind, i),
      color: rowColor(i),
      errors: errors[i],
    }));
  });
  private pop: (() => void) | null = null;

  protected readonly keyHook = (e: KeyboardEvent): boolean => {
    if (e.altKey || e.metaKey || e.ctrlKey) return false;
    if (e.key === 'Enter') {
      this.store();
      return true;
    }
    if (e.key === 'Escape') {
      this.editing.set(false);
      return true;
    }
    return false;
  };

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'curve-symb',
      title: () => this.i18n.t(this.titles().symb),
      menu: () => this.menu(),
      key: (p) => this.key(p),
      menuPress: (i) => this.menuPress(i),
      rocker: (d) => this.rocker(d),
      insert: (latex) => {
        if (!this.editing()) this.edit();
        queueMicrotask(() => this.fieldEl()?.insert(latex));
      },
      help: SYMB_HELP[this.app.kind()] ?? 'curve',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  private menu(): MenuButton[] {
    const b = (label: string): MenuButton => ({ label });
    const v = KINDS[this.app.kind()].variable.label;
    if (this.editing() && this.app.kind() === 'relation')
      return [b('X'), b('Y'), b('≤'), b('≥'), b(this.i18n.t('rel.logic')), b('OK')];
    if (this.editing() && this.app.kind() === 'solve')
      return [b('='), b(''), b(v), b(''), b(this.i18n.t('home.no')), b('OK')];
    if (this.editing()) return [b(''), b(''), b(v), b(''), b(this.i18n.t('home.no')), b('OK')];
    return [
      b(this.i18n.t('data.edit')),
      b('✓'),
      b(''),
      b(''),
      b(this.i18n.t('data.delete')),
      b(''),
    ];
  }

  private menuPress(i: number): void {
    if (this.editing() && this.app.kind() === 'relation') {
      const el = this.fieldEl();
      if (i < 4) el?.insert(['X', 'Y', '\\le', '\\ge'][i]);
      if (i === 4) {
        // cycles through the connectives: and → or → not → xor
        const k = (this.logic = (this.logic + 1) % LOGIC_NAMES.length);
        el?.insert(`\\operatorname{${LOGIC_NAMES[k]}}\\left(#0\\right)`);
      }
      if (i === 5) this.store();
      return;
    }
    if (this.editing()) {
      if (i === 0 && this.app.kind() === 'solve') this.fieldEl()?.insert('=');
      if (i === 2) this.fieldEl()?.insert(KINDS[this.app.kind()].variable.latex);
      if (i === 4) this.editing.set(false);
      if (i === 5) this.store();
      return;
    }
    if (i === 0) this.edit();
    if (i === 1) this.toggle(this.row());
    if (i === 4) this.set('');
  }

  protected pick(i: number, k: number): void {
    if (this.row() === i && this.field() === k) this.edit();
    this.row.set(i);
    this.field.set(k);
  }

  protected edit(): void {
    this.editing.set(true);
  }

  protected fill(): void {
    this.fieldEl()?.setLatex(this.app.state().rows[this.row()].fields[this.field()]);
  }

  protected toggle(i: number): void {
    this.app.apps.update<CurveState>((s) => ({
      ...s,
      rows: s.rows.map((r, k) => (k === i ? { ...r, on: !r.on } : r)),
    }));
  }

  private set(latex: string): void {
    const i = this.row();
    const f = this.field();
    this.app.apps.update<CurveState>((s) => ({
      ...s,
      rows: s.rows.map((r, k) =>
        k === i ? { ...r, on: true, fields: r.fields.map((x, j) => (j === f ? latex : x)) } : r,
      ),
    }));
  }

  private store(): void {
    this.set(this.fieldEl()?.latex() ?? '');
    this.editing.set(false);
    const n = this.rows()[0].fields.length;
    if (this.field() + 1 < n) this.field.update((f) => f + 1);
    else {
      this.field.set(0);
      this.row.update((r) => Math.min(9, r + 1));
    }
  }

  private key(p: KeyPress): boolean {
    const variable = KINDS[this.app.kind()].variable.latex;
    if (this.editing()) {
      if (p.id === 'enter') this.store();
      else if (p.id === 'esc') this.editing.set(false);
      else if (p.id === 'xtn' && p.layer === 'main') this.fieldEl()?.insert(variable);
      else {
        const a = editFor(p);
        if (a?.kind === 'insert') this.fieldEl()?.insert(a.latex);
        else if (a?.kind === 'command') this.fieldEl()?.command(a.command);
        else return false;
      }
      return true;
    }
    if (p.id === 'enter') {
      this.edit();
      return true;
    }
    if (p.id === 'bksp') {
      this.set('');
      return true;
    }
    const a = editFor(p);
    if (a?.kind === 'insert' || (p.id === 'xtn' && p.layer === 'main')) {
      this.edit();
      const latex = a?.kind === 'insert' ? a.latex : variable;
      setTimeout(() => this.fieldEl()?.insert(latex), 50);
      return true;
    }
    return false;
  }

  private rocker(d: RockerDir): boolean {
    if (this.editing()) {
      if (d === 'left' || d === 'right')
        this.fieldEl()?.command(d === 'left' ? 'moveToPreviousChar' : 'moveToNextChar');
      return true;
    }
    const n = this.rows()[0].fields.length;
    if (d === 'up') this.row.update((c) => (c + 9) % 10);
    if (d === 'down') this.row.update((c) => (c + 1) % 10);
    if (d === 'left') this.field.update((f) => (f + n - 1) % n);
    if (d === 'right') this.field.update((f) => (f + 1) % n);
    return true;
  }
}

/** Plot view (prompt 035): curves over the parameter, trace over T/θ/N, stairs or cobweb. */
@Component({
  selector: 'app-curve-plot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlotCanvas, PlotMenu],
  template: `
    <div class="plot">
      <app-plot-canvas [view]="view()" [painter]="painter()" [label]="label()" />
      @if (menu(); as m) {
        <app-plot-menu title="Zoom" [items]="items()" [cursor]="m" (pick)="pickMenu($event)" />
      }
      <div class="bar" aria-live="polite">
        @if (goTo()) {
          <label>
            {{ variable() }} =
            <input
              #goto
              type="text"
              spellcheck="false"
              (keydown.enter)="doGoTo()"
              (keydown.escape)="goTo.set(false)"
            />
          </label>
        } @else {
          {{ bar() }}
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .plot {
      position: relative;
      height: 100%;
    }
    .bar {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 0.05em 0.4em;
      background: var(--lcd-overlay);
      font-size: 3.3cqw;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bar input {
      width: 40%;
      font: inherit;
    }
  `,
})
export class CurvePlot implements OnInit, OnDestroy {
  private readonly i18n = inject(I18n);
  private readonly app = curveApp();
  private readonly device = inject(DeviceStore);
  private readonly home = inject(HomeStore);
  private readonly files = inject(FilesApi);
  private readonly scope = injectAppScope();
  private readonly canvas = viewChild(PlotCanvas);
  private readonly gotoEl = viewChild<ElementRef<HTMLInputElement>>('goto');
  protected readonly view = computed(() => this.app.state().view);
  private readonly cs = computed(() =>
    curves(this.app.kind(), this.app.state().rows, this.scope()),
  );
  protected readonly variable = computed(() => KINDS[this.app.kind()].variable.label);
  private readonly traceIdx = signal(0);
  private readonly t = signal<number | null>(null);
  protected readonly menu = signal<number | null>(null);
  protected readonly goTo = signal(false);
  private readonly defn = signal(false);
  private pop: (() => void) | null = null;

  private readonly traced = computed<Curve | null>(() => {
    const c = this.cs();
    return c.length ? c[Math.min(this.traceIdx(), c.length - 1)] : null;
  });

  private readonly cursor = computed(() => {
    const s = this.app.state();
    const t = this.t() ?? s.tmin;
    const c = this.traced();
    if (!c) return { t, x: NaN, y: NaN };
    if (c.term) return { t, x: t, y: c.term(t) };
    const [x, y] = c.point!(t);
    return { t, x, y };
  });

  protected readonly bar = computed(() => {
    const c = this.traced();
    if (!c) return this.i18n.t('app.noFunction');
    if (this.defn()) {
      const row = this.app.state().rows[c.row];
      return row.fields.map((f) => f.replace(/\\left|\\right|\\/g, '')).join(' ; ');
    }
    const p = this.cursor();
    return `${c.name}  ${this.variable()}: ${fmt(p.t)}  X: ${fmt(p.x)}  Y: ${fmt(p.y)}`;
  });

  protected readonly label = computed(
    () => `${this.i18n.t(TITLES[this.app.kind()].plot)}. ${this.bar()}`,
  );

  protected readonly painter = computed<PlotPainter>(() => {
    const kind = this.app.kind();
    const s = this.app.state();
    const cs = this.cs();
    const cur = this.cursor();
    const tc = this.traced();
    return (frame) => this.paint(frame, kind, s, cs, cur, tc);
  });

  private paint(
    frame: PlotFrame,
    kind: CurveKind,
    s: CurveState,
    cs: Curve[],
    cur: { x: number; y: number },
    tc: Curve | null,
  ): void {
    drawAxes(frame, DARK_PLOT, s.plot);
    if (kind === 'sequence') {
      if (s.seqMode === 'cobweb') this.cobweb(frame, s, cs);
      else for (const c of cs) this.stairs(frame, s, c);
    } else {
      for (const c of cs) {
        const lines = sampleParametric(c.point!, frame.view, {
          tmin: s.tmin,
          tmax: s.tmax,
          tstep: s.tstep,
          width: frame.width,
          height: frame.height,
        });
        drawLines(frame, lines, c.color, 2);
      }
    }
    if (tc && Number.isFinite(cur.x) && Number.isFinite(cur.y))
      drawPoint(frame, cur.x, cur.y, tc.color);
  }

  private stairs(frame: PlotFrame, s: CurveState, c: Curve): void {
    const lines: Polyline[] = [];
    const from = Math.max(1, Math.ceil(Math.max(s.tmin, frame.view.xmin)));
    const to = Math.min(s.tmax, Math.floor(frame.view.xmax));
    for (let n = from; n <= to; n++) {
      const y = c.term!(n);
      if (!Number.isFinite(y)) continue;
      lines.push([[n, y]]);
      lines.push([
        [n, y],
        [n + 1, y],
      ]);
    }
    drawLines(frame, lines, c.color, 2);
  }

  private cobweb(frame: PlotFrame, s: CurveState, cs: Curve[]): void {
    const c = cs.find((x) => x.cobweb);
    if (!c) return;
    const v = frame.view;
    const g = c.cobweb!;
    drawLines(
      frame,
      [
        [
          [v.xmin, v.xmin],
          [v.xmax, v.xmax],
        ],
      ],
      '#9aa0a6',
      1,
    );
    const curve: [number, number][] = [];
    for (let i = 0; i <= 200; i++) {
      const x = v.xmin + ((v.xmax - v.xmin) * i) / 200;
      const y = g(x);
      if (Number.isFinite(y)) curve.push([x, y]);
    }
    drawLines(frame, [curve], c.color, 2);
    const web: [number, number][] = [];
    let x = c.term!(1);
    web.push([x, 0]);
    for (let k = 0; k < Math.min(200, s.tmax) && Number.isFinite(x); k++) {
      const y = g(x);
      if (!Number.isFinite(y)) break;
      web.push([x, y], [y, y]);
      x = y;
    }
    drawLines(frame, [web], '#f28c28', 1);
  }

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'curve-plot',
      title: () => this.i18n.t(TITLES[this.app.kind()].plot),
      menu: () => [
        { label: 'Zoom' },
        { label: 'Trace', active: true },
        { label: this.i18n.t('app.goTo') },
        { label: '' },
        { label: this.i18n.t('app.defn'), active: this.defn() },
        { label: 'PNG' },
      ],
      key: (p) => this.key(p),
      menuPress: (i) => {
        if (i === 0) this.menu.set(0);
        if (i === 2) {
          this.goTo.set(true);
          queueMicrotask(() => this.gotoEl()?.nativeElement.focus());
        }
        if (i === 4) this.defn.update((d) => !d);
        if (i === 5) void this.exportPng();
      },
      rocker: (d, shift) => this.rocker(d, shift),
      gesture: (g, area) => this.gesture(g, area),
      help: 'curve',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  protected readonly items = computed<PlotMenuItem[]>(() =>
    ZOOM_OPS.filter((op) => op !== 'auto').map((op) => ({
      label: this.i18n.t(`zoom.${op}` as TextKey),
      run: () => this.zoom(op),
    })),
  );

  protected pickMenu(i: number): void {
    this.menu.set(null);
    this.items()[i]?.run();
  }

  private setView(v: Viewport): void {
    this.app.apps.update<CurveState>((s) => ({ ...s, view: v }));
  }

  private size() {
    const a = this.canvas()?.area();
    return a?.width ? a : { width: 320, height: 200 };
  }

  private zoom(op: ZoomOp): void {
    const c = this.cursor();
    const ok = Number.isFinite(c.x) && Number.isFinite(c.y);
    this.setView(
      zoomView(this.view(), op, this.size(), ok ? c.x : undefined, ok ? c.y : undefined),
    );
  }

  protected doGoTo(): void {
    const p = parseText(this.gotoEl()?.nativeElement.value ?? '');
    const r = p.ok ? evaluateValue(p.value, this.home.scope()) : p;
    this.goTo.set(false);
    if (r.ok && r.value.kind === 'real') this.t.set(r.value.v);
  }

  private async exportPng(): Promise<void> {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    this.painter()({ ctx, width: 640, height: 480, view: this.view() });
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    if (blob) {
      await this.files.saveBytes(
        `${this.app.kind()}-plot.png`,
        new Uint8Array(await blob.arrayBuffer()),
        { name: 'PNG', extensions: ['png'] },
      );
    }
  }

  private key(p: KeyPress): boolean {
    const m = this.menu();
    if (this.goTo()) {
      const el = this.gotoEl()?.nativeElement;
      if (p.id === 'enter') this.doGoTo();
      else if (p.id === 'esc') this.goTo.set(false);
      else if (p.id === 'bksp' && el) el.value = el.value.slice(0, -1);
      else {
        const a = editFor(p);
        if (a?.kind === 'insert' && el) el.value += a.text;
      }
      return true;
    }
    if (m !== null) {
      if (p.id === 'enter') this.pickMenu(m);
      else if (p.id === 'esc') this.menu.set(null);
      return true;
    }
    if (p.id === 'add') this.zoom('in');
    else if (p.id === 'sub') this.zoom('out');
    else if (p.id === 'esc') this.defn.set(false);
    else return false;
    return true;
  }

  private rocker(d: RockerDir, shift: boolean): boolean {
    const m = this.menu();
    if (m !== null) {
      const n = this.items().length;
      if (d === 'up' || d === 'down') this.menu.set((m + (d === 'down' ? 1 : n - 1)) % n);
      if (d === 'left') this.menu.set(null);
      return true;
    }
    const s = this.app.state();
    const cs = this.cs();
    if ((d === 'up' || d === 'down') && cs.length) {
      this.traceIdx.update(
        (i) => (Math.min(i, cs.length - 1) + (d === 'up' ? 1 : cs.length - 1)) % cs.length,
      );
      return true;
    }
    const step = (this.app.kind() === 'sequence' ? 1 : s.tstep) * (shift ? 10 : 1);
    const t = Math.min(
      s.tmax,
      Math.max(s.tmin, (this.t() ?? s.tmin) + (d === 'right' ? step : -step)),
    );
    this.t.set(Number(t.toPrecision(12)));
    const c = this.cursor();
    const v = this.view();
    if (
      Number.isFinite(c.x) &&
      Number.isFinite(c.y) &&
      (c.x < v.xmin || c.x > v.xmax || c.y < v.ymin || c.y > v.ymax)
    ) {
      const w = (v.xmax - v.xmin) / 2;
      const h = (v.ymax - v.ymin) / 2;
      this.setView({ xmin: c.x - w, xmax: c.x + w, ymin: c.y - h, ymax: c.y + h });
    }
    return true;
  }

  private gesture(g: Gesture, area: Area): void {
    const v = this.view();
    const scr = this.canvas()?.area() ?? area;
    if (g.kind === 'drag' && g.phase === 'move') {
      this.setView(
        pan(v, (-g.dx * (v.xmax - v.xmin)) / scr.width, (g.dy * (v.ymax - v.ymin)) / scr.height),
      );
    } else if (g.kind === 'pinch' && g.phase === 'move' && g.scale > 0) {
      const f = 1 / g.scale;
      const cx = toWorldX(v, scr, g.cx);
      const cy = toWorldY(v, scr, g.cy);
      this.setView({
        xmin: cx - (cx - v.xmin) * f,
        xmax: cx + (v.xmax - cx) * f,
        ymin: cy - (cy - v.ymin) * f,
        ymax: cy + (v.ymax - cy) * f,
      });
    } else if (g.kind === 'doubleTap') {
      this.setView(zoomView(v, 'in', scr, toWorldX(v, scr, g.x), toWorldY(v, scr, g.y)));
    }
  }
}

/** Numeric view (prompt 035): the parameter and the values of each curve. */
@Component({
  selector: 'app-curve-num',
  host: { tabindex: '0', role: 'region', '[attr.aria-label]': 'title()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <table class="num">
      <thead>
        <tr>
          <th scope="col">{{ variable() }}</th>
          @for (h of heads(); track $index) {
            <th scope="col" [style.border-bottom-color]="h.color">{{ h.label }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (r of rows(); track $index) {
          <tr>
            <th scope="row">{{ r.t }}</th>
            @for (y of r.values; track $index) {
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
export class CurveNum implements OnInit, OnDestroy {
  private readonly i18n = inject(I18n);
  private readonly app = curveApp();
  private readonly device = inject(DeviceStore);
  private readonly settings = inject(SettingsStore);
  private readonly scope = injectAppScope();
  private readonly cs = computed(() =>
    curves(this.app.kind(), this.app.state().rows, this.scope()),
  );
  protected readonly title = () => this.i18n.t(TITLES[this.app.kind()].num);
  protected readonly variable = computed(() => KINDS[this.app.kind()].variable.label);
  protected readonly heads = computed(() => tableHeads(this.app.kind(), this.cs()));
  protected readonly rows = computed(() => {
    const f = this.settings.settings().format;
    const show = (y: number) => (Number.isFinite(y) ? formatReal(y, f) : '—');
    const s = this.app.state();
    return curveTable(this.app.kind(), this.cs(), s.numStart, s.numStep, 9).map((r) => ({
      t: show(r.t),
      values: r.values.map(show),
    }));
  });
  private pop: (() => void) | null = null;

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'curve-num',
      title: () => this.i18n.t(TITLES[this.app.kind()].num),
      menu: () => [
        { label: 'Zoom +' },
        { label: 'Zoom −' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
      ],
      key: (p) => {
        if (p.id === 'add') this.zoomStep(0.5);
        else if (p.id === 'sub') this.zoomStep(2);
        else return false;
        return true;
      },
      menuPress: (i) => this.zoomStep(i === 0 ? 0.5 : 2),
      rocker: (d) => {
        const k = d === 'up' ? -1 : d === 'down' ? 1 : 0;
        if (k) {
          this.app.apps.update<CurveState>((s) => ({
            ...s,
            numStart: Number((s.numStart + k * s.numStep).toPrecision(12)),
          }));
        }
        return true;
      },
      help: 'curve',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  private zoomStep(f: number): void {
    if (this.app.kind() === 'sequence') return;
    this.app.apps.update<CurveState>((s) => ({ ...s, numStep: s.numStep * f }));
  }
}

/** Plot setup: X/Y range, parameter range, sequence plot type, grid/axes/labels. */
@Component({
  selector: 'app-curve-plot-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SetupForm],
  template: `<app-setup-form
    [title]="i18n.t('app.plotSetup')"
    [fields]="fields()"
    [close]="close"
  />`,
})
export class CurvePlotSetup {
  protected readonly i18n = inject(I18n);
  private readonly app = curveApp();
  protected readonly close = () => this.app.apps.show('plot');
  protected readonly fields = computed<SetupItem[]>(() => {
    const kind = this.app.kind();
    const s = () => this.app.state();
    const v = KINDS[kind].variable.label;
    const upd = (f: (x: CurveState) => CurveState) => this.app.apps.update<CurveState>(f);
    const view = (k: keyof Viewport) => ({
      label: { xmin: 'X min', xmax: 'X max', ymin: 'Y min', ymax: 'Y max' }[k],
      value: () => s().view[k],
      set: (x: number) => {
        const next = { ...s().view, [k]: x };
        if (next.xmin >= next.xmax || next.ymin >= next.ymax) return 'min must be smaller than max';
        upd((t) => ({ ...t, view: next }));
        return null;
      },
    });
    const range = (k: 'tmin' | 'tmax' | 'tstep', label: string) => ({
      label,
      value: () => s()[k],
      set: (x: number) => {
        const next = { ...s(), [k]: x };
        if (next.tmin >= next.tmax) return 'min must be smaller than max';
        if (next.tstep <= 0) return 'the step must be positive';
        if (kind === 'sequence' && (!Number.isInteger(next.tmin) || next.tmin < 1))
          return 'N starts at an integer ≥ 1';
        upd(() => next);
        return null;
      },
    });
    const t = (k: TextKey) => this.i18n.t(k);
    const onOff = [
      { value: 'on', label: t('app.on') },
      { value: 'off', label: t('app.off') },
    ];
    const items: SetupItem[] = [view('xmin'), view('xmax'), view('ymin'), view('ymax')];
    if (kind !== 'relation') items.push(range('tmin', `${v} min`), range('tmax', `${v} max`));
    if (kind === 'relation') {
      // no parameter range – a relation is plotted on the pixel grid of the view
    } else if (kind !== 'sequence') items.push(range('tstep', `${v} step`));
    else {
      items.push({
        label: t('curve.seqMode'),
        choices: [
          { value: 'stairs', label: t('curve.stairs') },
          { value: 'cobweb', label: t('curve.cobweb') },
        ],
        value: () => s().seqMode,
        set: (x: string) => upd((st) => ({ ...st, seqMode: x as CurveState['seqMode'] })),
      });
    }
    items.push({
      label: t('app.grid'),
      choices: onOff,
      value: () => (s().plot.grid ? 'on' : 'off'),
      set: (x: string) => upd((st) => ({ ...st, plot: { ...st.plot, grid: x === 'on' } })),
    });
    items.push({
      label: t('app.axes'),
      choices: onOff,
      value: () => (s().plot.axes ? 'on' : 'off'),
      set: (x: string) => upd((st) => ({ ...st, plot: { ...st.plot, axes: x === 'on' } })),
    });
    return items;
  });
}

/** Numeric setup: start and step of the table. */
@Component({
  selector: 'app-curve-num-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SetupForm],
  template: `<app-setup-form
    [title]="i18n.t('app.numSetup')"
    [fields]="fields()"
    [close]="close"
  />`,
})
export class CurveNumSetup {
  protected readonly i18n = inject(I18n);
  private readonly app = curveApp();
  protected readonly close = () => this.app.apps.show('num');
  protected readonly fields = computed<SetupItem[]>(() => {
    const s = () => this.app.state();
    const seq = this.app.kind() === 'sequence';
    return [
      {
        label: this.i18n.t('app.numStart'),
        value: () => s().numStart,
        set: (x: number) => {
          if (seq && (!Number.isInteger(x) || x < 1)) return 'N starts at an integer ≥ 1';
          this.app.apps.update<CurveState>((t) => ({ ...t, numStart: x }));
          return null;
        },
      },
      {
        label: this.i18n.t('app.numStep'),
        value: () => s().numStep,
        set: (x: number) => {
          if (x <= 0 || (seq && !Number.isInteger(x)))
            return 'the step must be positive (whole for N)';
          this.app.apps.update<CurveState>((t) => ({ ...t, numStep: x }));
          return null;
        },
      },
    ];
  });
}
