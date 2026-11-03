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
import type { KeyPress } from '../../core/actions/shift-alpha';
import { DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import type { MenuButton } from '../../features/device/t1-device';
import { editFor } from '../../features/home/home-keys';
import { SettingsStore } from '../../features/settings/settings-store';
import { PlotMenu, type PlotMenuItem } from '../shared/plot-menu';
import { SetupForm, type SetupItem } from '../shared/setup-form';
import { MEASURES, colorOf, fmtMeasured, fmtValue, measure, snap } from './geometry-logic';
import { GeometrySession } from './geometry-session';

type EntryMode = 'new' | 'edit' | 'rename';

/** Shared entry line of Symb and Num: device keys type into a plain text input. */
function typeInto(el: HTMLInputElement | undefined, p: KeyPress): boolean {
  if (!el) return false;
  if (p.id === 'bksp') {
    el.value = el.value.slice(0, -1);
    return true;
  }
  const a = editFor(p);
  if (a?.kind !== 'insert') return false;
  el.value += a.text;
  return true;
}

const ENTRY_STYLES = `
  .entry {
    display: flex;
    align-items: center;
    gap: 0.3em;
    border-top: 2px solid #1b3533;
    padding: 0.1em 0.4em;
    background: #fff;
  }
  .entry input {
    flex: 1;
    min-width: 0;
    font: inherit;
  }
  .msg {
    margin: 0;
    padding: 0.05em 0.4em;
    color: #b42318;
    font-size: 0.85em;
  }
`;

/**
 * Symbolic view of the geometry app (prompt 042): the construction as commands GA = point(1, 2) …
 * Edit changes a definition (the script is replayed), ✓ shows/hides, New adds a command, Rename,
 * Delete (with everything that depends on it). ←→ on a slider changes its value.
 */
@Component({
  selector: 'app-geometry-symb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="symb">
      <ul class="defs" [attr.aria-label]="i18n.t('geo.symb')">
        @for (r of rows(); track r.name; let i = $index) {
          <li
            [class.cur]="row() === i"
            [class.off]="r.hidden"
            [attr.aria-current]="row() === i ? 'true' : null"
            tabindex="-1"
            (click)="row.set(i)"
            (keydown.enter)="row.set(i)"
          >
            <button
              type="button"
              class="check"
              [attr.aria-pressed]="!r.hidden"
              [attr.aria-label]="r.name + (r.hidden ? ' hidden' : ' shown')"
              (click)="session.toggleHidden(r.name)"
            >
              {{ r.hidden ? '' : '✓' }}
            </button>
            <span class="swatch" [style.background]="r.color"></span>
            <span class="name">{{ r.name }}</span>
            <span class="def">= {{ r.def }}</span>
            <span class="val" [class.undef]="r.undef">{{ r.value }}</span>
          </li>
        } @empty {
          <li class="empty">{{ i18n.t('geo.empty') }}</li>
        }
      </ul>
      @for (e of session.scene().errors; track $index) {
        <p class="msg" role="alert">{{ e.line }}: {{ e.message }}</p>
      }
      @if (message()) {
        <p class="msg" role="alert">{{ message() }}</p>
      }
      @if (mode(); as m) {
        <div class="entry">
          <label for="geo-symb-entry">{{ entryLabel() }}</label>
          <input
            id="geo-symb-entry"
            #entry
            type="text"
            spellcheck="false"
            autocomplete="off"
            (keydown.enter)="commit()"
            (keydown.escape)="mode.set(null)"
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
      display: flex;
      flex-direction: column;
      height: 100%;
      font-size: 3.6cqw;
    }
    .defs {
      flex: 1;
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
      border-bottom: 1px solid #dde4df;
      min-height: 1.5em;
      white-space: nowrap;
      cursor: pointer;
    }
    li.cur {
      background: #fff1ec;
    }
    li.off .def,
    li.off .name {
      color: #6b7c77;
    }
    li.empty {
      color: #3d514c;
      white-space: normal;
      cursor: default;
    }
    .check {
      width: 1.1em;
      height: 1.1em;
      padding: 0;
      border: 1px solid #5a6c67;
      border-radius: 0.15em;
      background: #fff;
      font: inherit;
      font-size: 0.8em;
      line-height: 1;
      cursor: pointer;
      flex: none;
    }
    .swatch {
      width: 0.6em;
      height: 0.6em;
      border-radius: 50%;
      flex: none;
    }
    .name {
      font-weight: 600;
    }
    .def {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .val {
      margin-left: auto;
      color: #3d514c;
      font-size: 0.85em;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 45%;
    }
    .val.undef {
      color: #b42318;
    }
    ${ENTRY_STYLES}
  `,
})
export class GeometrySymb implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  protected readonly session = inject(GeometrySession);
  private readonly device = inject(DeviceStore);
  private readonly settings = inject(SettingsStore);
  private readonly entry = viewChild<ElementRef<HTMLInputElement>>('entry');
  protected readonly row = signal(0);
  protected readonly mode = signal<EntryMode | null>(null);
  protected readonly message = signal<string | null>(null);
  private pop: (() => void) | null = null;

  protected readonly rows = computed(() => {
    const { c, objects, state } = this.session.scene();
    const f = this.settings.settings().format;
    return objects.map((o) => ({
      name: o.name,
      def: c.describe(o.id) ?? '',
      value: fmtValue(o.value, f),
      undef: o.value.kind === 'undefined',
      hidden: o.hidden,
      color: colorOf(o, state.colors),
    }));
  });

  private readonly current = computed(() => {
    const r = this.rows();
    return r.length ? r[Math.min(this.row(), r.length - 1)] : null;
  });

  protected readonly entryLabel = computed(() => {
    const m = this.mode();
    const cur = this.current();
    if (m === 'edit' && cur) return `${cur.name} =`;
    if (m === 'rename' && cur) return `${cur.name} →`;
    return this.i18n.t('geo.new');
  });

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'geometry-symb',
      title: () => this.i18n.t('geo.symb'),
      menu: () => this.menu(),
      key: (p) => this.key(p),
      menuPress: (i) => this.menuPress(i),
      rocker: (d, shift) => this.rocker(d, shift),
      insert: (_latex, text) => {
        if (!this.mode()) this.open('new');
        queueMicrotask(() => {
          const el = this.entry()?.nativeElement;
          if (el) el.value += text;
        });
      },
      help: 'geometry',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  private menu(): MenuButton[] {
    const b = (label: string): MenuButton => ({ label });
    if (this.mode()) return [b(''), b(''), b(''), b(''), b(this.i18n.t('home.no')), b('OK')];
    return [
      b(this.i18n.t('data.edit')),
      b('✓'),
      b(this.i18n.t('geo.new')),
      b(this.i18n.t('geo.rename')),
      b(this.i18n.t('data.delete')),
      b(''),
    ];
  }

  private menuPress(i: number): void {
    if (this.mode()) {
      if (i === 4) this.mode.set(null);
      if (i === 5) this.commit();
      return;
    }
    const cur = this.current();
    if (i === 0 && cur) this.open('edit');
    if (i === 1 && cur) this.session.toggleHidden(cur.name);
    if (i === 2) this.open('new');
    if (i === 3 && cur) this.open('rename');
    if (i === 4) this.remove();
  }

  private open(m: EntryMode, initial?: string): void {
    this.mode.set(m);
    this.message.set(null);
    const cur = this.current();
    const text = initial ?? (m === 'edit' && cur ? cur.def : m === 'rename' && cur ? cur.name : '');
    queueMicrotask(() => {
      const el = this.entry()?.nativeElement;
      if (!el) return;
      el.value = text;
      el.focus();
    });
  }

  protected commit(): void {
    const m = this.mode();
    const text = this.entry()?.nativeElement.value.trim() ?? '';
    const cur = this.current();
    if (!m) return;
    if (!text) {
      this.mode.set(null);
      return;
    }
    const r =
      m === 'new'
        ? this.session.run(text)
        : m === 'edit' && cur
          ? this.session.redefine(cur.name, text)
          : m === 'rename' && cur
            ? this.session.rename(cur.name, text)
            : null;
    if (!r) return;
    if (!r.ok) {
      this.message.set(r.error.message);
      return;
    }
    this.mode.set(null);
    this.message.set(null);
    const i = this.rows().findIndex((x) => x.name === r.value);
    if (i >= 0) this.row.set(i);
  }

  private remove(): void {
    const cur = this.current();
    if (!cur) return;
    const r = this.session.delete(cur.name);
    this.message.set(
      r.ok ? `${this.i18n.t('geo.deleted')}: ${r.value.join(', ')}` : r.error.message,
    );
    this.row.update((x) => Math.max(0, Math.min(x, this.rows().length - 1)));
  }

  private key(p: KeyPress): boolean {
    if (this.mode()) {
      if (p.id === 'enter') this.commit();
      else if (p.id === 'esc') this.mode.set(null);
      else return typeInto(this.entry()?.nativeElement, p);
      return true;
    }
    if (p.id === 'enter') {
      this.open(this.current() ? 'edit' : 'new');
      return true;
    }
    if (p.id === 'bksp') {
      this.remove();
      return true;
    }
    const a = editFor(p);
    if (a?.kind === 'insert') {
      this.open('new', a.text);
      return true;
    }
    return false;
  }

  private rocker(d: RockerDir, shift: boolean): boolean {
    if (this.mode()) return true;
    const n = this.rows().length;
    if (!n) return true;
    if (d === 'up') this.row.update((r) => (Math.min(r, n - 1) + n - 1) % n);
    if (d === 'down') this.row.update((r) => (Math.min(r, n - 1) + 1) % n);
    if (d === 'left' || d === 'right') {
      const cur = this.current();
      const o = cur && this.session.scene().c.get(cur.name);
      if (o?.cmd === 'slider') {
        const [v, lo, hi] = o.args.map((a) => ('num' in a ? a.num : 0));
        const step = ((hi - lo) / 50) * (shift ? 0.1 : 1);
        const next = Math.min(hi, Math.max(lo, v + (d === 'right' ? step : -step)));
        this.session.setSlider(o.name, snap(next, step / 10));
      }
    }
    return true;
  }
}

/**
 * Numeric view of the geometry app (prompt 042): measurements and tests of the construction,
 * recomputed with every change (also while a point is dragged in the Plot view).
 */
@Component({
  selector: 'app-geometry-num',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlotMenu],
  template: `
    <div class="numv">
      <div class="scroll" tabindex="0" role="region" [attr.aria-label]="i18n.t('geo.num')">
        <table class="num">
          <thead>
            <tr>
              <th scope="col">{{ i18n.t('geo.measurement') }}</th>
              <th scope="col">{{ i18n.t('geo.value') }}</th>
            </tr>
          </thead>
          <tbody>
            @for (r of rows(); track $index; let i = $index) {
              <tr
                [class.cur]="row() === i"
                tabindex="-1"
                (click)="row.set(i)"
                (keydown.enter)="row.set(i)"
              >
                <th scope="row">{{ r.expr }}</th>
                <td [class.err]="r.error">{{ r.value }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="2" class="empty">{{ i18n.t('geo.noMeasures') }}</td>
              </tr>
            }
          </tbody>
        </table>
        <p class="note">{{ i18n.t('geo.numeric') }}</p>
      </div>
      @if (message()) {
        <p class="msg" role="alert">{{ message() }}</p>
      }
      @if (mode()) {
        <div class="entry">
          <label for="geo-num-entry">{{ i18n.t('geo.measurement') }}</label>
          <input
            id="geo-num-entry"
            #entry
            type="text"
            spellcheck="false"
            autocomplete="off"
            (keydown.enter)="commit()"
            (keydown.escape)="mode.set(null)"
          />
        </div>
      }
      @if (popup() !== null) {
        <app-plot-menu
          [title]="i18n.t('geo.functions')"
          [items]="items"
          [cursor]="popup()!"
          (pick)="pick($event)"
        />
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .numv {
      position: relative;
      display: flex;
      flex-direction: column;
      height: 100%;
      font-size: 3.6cqw;
    }
    .scroll {
      flex: 1;
      min-height: 0;
      overflow: auto;
    }
    .num {
      width: 100%;
      border-collapse: collapse;
      font-variant-numeric: tabular-nums;
    }
    th,
    td {
      padding: 0.1em 0.3em;
      border-bottom: 1px solid #dde4df;
      white-space: nowrap;
      text-align: left;
    }
    td {
      text-align: right;
    }
    thead th {
      background: #e8eeea;
      position: sticky;
      top: 0;
    }
    tbody th {
      font-weight: 400;
    }
    tr.cur {
      background: #fff1ec;
    }
    td.err {
      color: #b42318;
      font-size: 0.85em;
    }
    td.empty {
      text-align: left;
      white-space: normal;
      color: #3d514c;
    }
    .note {
      margin: 0.2em 0.4em;
      font-size: 0.8em;
      color: #3d514c;
    }
    ${ENTRY_STYLES}
  `,
})
export class GeometryNum implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  private readonly session = inject(GeometrySession);
  private readonly device = inject(DeviceStore);
  private readonly settings = inject(SettingsStore);
  private readonly entry = viewChild<ElementRef<HTMLInputElement>>('entry');
  protected readonly row = signal(0);
  protected readonly mode = signal<'new' | 'edit' | null>(null);
  protected readonly popup = signal<number | null>(null);
  protected readonly message = signal<string | null>(null);
  private pop: (() => void) | null = null;

  protected readonly rows = computed(() => {
    const { c, state } = this.session.scene();
    const s = this.settings.settings();
    const o = {
      format: s.format,
      angle: s.angle,
      yes: this.i18n.t('home.yes'),
      no: this.i18n.t('home.no'),
    };
    return state.measures.map((expr) => {
      const r = measure(c, expr);
      return r.ok
        ? { expr, value: fmtMeasured(r.value, o), error: false }
        : { expr, value: r.error.message, error: true };
    });
  });

  protected readonly items: PlotMenuItem[] = Object.entries(MEASURES).map(([name, spec]) => ({
    label: spec.usage,
    run: () => {
      if (!this.mode()) this.open('new');
      queueMicrotask(() => {
        const el = this.entry()?.nativeElement;
        if (el) {
          el.value += `${name}(`;
          el.focus();
        }
      });
    },
  }));

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'geometry-num',
      title: () => this.i18n.t('geo.num'),
      menu: () => this.menu(),
      key: (p) => this.key(p),
      menuPress: (i) => this.menuPress(i),
      rocker: (d) => this.rocker(d),
      insert: (_latex, text) => {
        if (!this.mode()) this.open('new');
        queueMicrotask(() => {
          const el = this.entry()?.nativeElement;
          if (el) el.value += text;
        });
      },
      help: 'geometry',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  private menu(): MenuButton[] {
    const b = (label: string): MenuButton => ({ label });
    if (this.mode())
      return [
        b(this.i18n.t('geo.functions')),
        b(''),
        b(''),
        b(''),
        b(this.i18n.t('home.no')),
        b('OK'),
      ];
    return [
      b(this.i18n.t('data.edit')),
      b(this.i18n.t('geo.new')),
      b(this.i18n.t('data.delete')),
      b(this.i18n.t('geo.functions')),
      b(''),
      b(''),
    ];
  }

  private menuPress(i: number): void {
    if (this.mode()) {
      if (i === 0) this.popup.set(0);
      if (i === 4) this.mode.set(null);
      if (i === 5) this.commit();
      return;
    }
    if (i === 0 && this.rows().length) this.open('edit');
    if (i === 1) this.open('new');
    if (i === 2) this.remove();
    if (i === 3) this.popup.set(0);
  }

  protected pick(i: number): void {
    this.popup.set(null);
    this.items[i]?.run();
  }

  private open(m: 'new' | 'edit', initial = ''): void {
    this.mode.set(m);
    this.message.set(null);
    const text = m === 'edit' ? (this.rows()[this.row()]?.expr ?? '') : initial;
    queueMicrotask(() => {
      const el = this.entry()?.nativeElement;
      if (!el) return;
      el.value = text;
      el.focus();
    });
  }

  protected commit(): void {
    const m = this.mode();
    const text = this.entry()?.nativeElement.value.trim() ?? '';
    if (!m) return;
    if (!text) {
      this.mode.set(null);
      return;
    }
    const r = measure(this.session.scene().c, text);
    if (!r.ok && r.error.code !== 'not-evaluable' && r.error.code !== 'domain') {
      this.message.set(r.error.message);
      return;
    }
    const i = this.row();
    this.session.update((s) => ({
      ...s,
      measures:
        m === 'edit' ? s.measures.map((x, k) => (k === i ? text : x)) : [...s.measures, text],
    }));
    if (m === 'new') this.row.set(this.session.state().measures.length - 1);
    this.mode.set(null);
    this.message.set(null);
  }

  private remove(): void {
    const i = this.row();
    if (!this.rows().length) return;
    this.session.update((s) => ({ ...s, measures: s.measures.filter((_, k) => k !== i) }));
    this.row.update((r) => Math.max(0, Math.min(r, this.rows().length - 1)));
  }

  private key(p: KeyPress): boolean {
    const pop = this.popup();
    if (pop !== null) {
      if (p.id === 'enter') this.pick(pop);
      else if (p.id === 'esc') this.popup.set(null);
      return true;
    }
    if (this.mode()) {
      if (p.id === 'enter') this.commit();
      else if (p.id === 'esc') this.mode.set(null);
      else return typeInto(this.entry()?.nativeElement, p);
      return true;
    }
    if (p.id === 'enter') {
      this.open(this.rows().length ? 'edit' : 'new');
      return true;
    }
    if (p.id === 'bksp') {
      this.remove();
      return true;
    }
    const a = editFor(p);
    if (a?.kind === 'insert') {
      this.open('new', a.text);
      return true;
    }
    return false;
  }

  private rocker(d: RockerDir): boolean {
    const pop = this.popup();
    if (pop !== null) {
      const n = this.items.length;
      if (d === 'up' || d === 'down') this.popup.set((pop + (d === 'down' ? 1 : n - 1)) % n);
      if (d === 'left') this.popup.set(null);
      return true;
    }
    const n = this.rows().length;
    if (!n || this.mode()) return true;
    if (d === 'up') this.row.update((r) => (r + n - 1) % n);
    if (d === 'down') this.row.update((r) => (r + 1) % n);
    return true;
  }
}

/** Plot setup of the geometry app: window, equal axes, grid. */
@Component({
  selector: 'app-geometry-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SetupForm],
  template: `<app-setup-form
    [title]="i18n.t('app.plotSetup')"
    [fields]="fields()"
    [close]="close"
  />`,
})
export class GeometryPlotSetup {
  protected readonly i18n = inject(I18n);
  private readonly session = inject(GeometrySession);
  protected readonly close = () => this.session.apps.show('plot');
  protected readonly fields = computed<SetupItem[]>(() => {
    const s = () => this.session.state();
    const field = (k: 'xmin' | 'xmax' | 'ymin' | 'ymax', label: string): SetupItem => ({
      label,
      value: () => s().view[k],
      set: (x: number) => {
        const next = { ...s().view, [k]: x };
        if (next.xmin >= next.xmax || next.ymin >= next.ymax) return 'min must be smaller than max';
        this.session.update((t) => ({ ...t, view: next }));
        return null;
      },
    });
    const onOff = (label: string, get: () => boolean, set: (v: boolean) => void): SetupItem => ({
      label,
      choices: [
        { value: 'on', label: this.i18n.t('app.on') },
        { value: 'off', label: this.i18n.t('app.off') },
      ],
      value: () => (get() ? 'on' : 'off'),
      set: (v: string) => set(v === 'on'),
    });
    return [
      field('xmin', 'X min'),
      field('xmax', 'X max'),
      field('ymin', 'Y min'),
      field('ymax', 'Y max'),
      onOff(
        this.i18n.t('geo.equal'),
        () => s().equal,
        (v) => this.session.update((t) => ({ ...t, equal: v })),
      ),
      onOff(
        this.i18n.t('app.grid'),
        () => s().axes,
        (v) => this.session.update((t) => ({ ...t, axes: v })),
      ),
    ];
  });
}
