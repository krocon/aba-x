import { ProgramStore } from '../programs/program-store';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MathStatic } from '@aba/core/shared/math-static';
import { toLatex } from '@aba/math/serializer';
import { formatValue } from '@aba/math/value/format';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import type { MenuButton } from '../device/t1-device';
import { CasStore } from '../cas/cas-store';
import { displayOptions } from '../home/home-logic';
import { HomeStore } from '../home/home-store';
import { SettingsStore } from '../settings/settings-store';
import { COMMAND_HELP, VIEW_HELP } from './help-data';
import { PopupStore } from './popup-store';
import {
  CAS_TAB,
  CHARS,
  MATH_TAB,
  type ToolCategory,
  type ToolEntry,
  type ToolboxTab,
  baseEntries,
  catalog,
  jumpTo,
  unitCategories,
  userEntries,
} from './toolbox-model';

interface Row {
  label: string;
  /** shown on the right (value, description) */
  detail?: string;
  latex?: string;
  /** what Enter inserts */
  insert?: { latex: string; text: string };
  /** opens this category */
  category?: ToolCategory;
  entry?: ToolEntry;
}

const TABS: ToolboxTab[] = ['math', 'cas', 'app', 'user', 'catalog'];

/**
 * Overlay over the display (prompt 030): toolbox (Math, CAS, App, User, Catalogue), variables,
 * characters and help. Rocker/arrows move, → or Enter opens, ← goes back, Enter inserts into the
 * entry line of the view below, Help explains the selected command, Esc closes.
 */
@Component({
  selector: 'app-popup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MathStatic],
  template: `
    <div class="popup" role="dialog" [attr.aria-label]="heading()">
      @if (popup.mode() === 'help') {
        <div class="help">
          @if (help(); as h) {
            @if (h.syntax) {
              <p class="syntax">
                <code>{{ h.syntax }}</code>
              </p>
            }
            <p>{{ h.text }}</p>
            @if (h.example) {
              <p class="example"><app-math [latex]="h.example" /></p>
            }
          }
        </div>
      } @else if (popup.mode() === 'chars') {
        <div class="chars" role="listbox" aria-label="Characters">
          @for (c of chars; track c.label; let i = $index) {
            <button
              type="button"
              role="option"
              class="ch"
              [class.cur]="cursor() === i"
              [attr.aria-selected]="cursor() === i"
              [attr.aria-label]="c.label"
              (pointerdown)="$event.preventDefault()"
              (click)="pickChar(i)"
            >
              {{ c.text }}
            </button>
          }
        </div>
      } @else {
        @if (crumb()) {
          <div class="crumb">{{ crumb() }}</div>
        }
        <ul class="list" #list role="listbox" [attr.aria-label]="heading()">
          @for (r of rows(); track $index; let i = $index) {
            <li
              role="option"
              tabindex="-1"
              [class.cur]="cursor() === i"
              [attr.aria-selected]="cursor() === i"
              (click)="choose(i)"
              (keydown.enter)="choose(i)"
            >
              <span class="name">{{ r.label }}</span>
              @if (r.latex) {
                <span class="detail"><app-math [latex]="r.latex" /></span>
              } @else if (r.detail) {
                <span class="detail">{{ r.detail }}</span>
              }
              @if (r.category) {
                <span class="more" aria-hidden="true">›</span>
              }
            </li>
          } @empty {
            <li class="empty">{{ emptyText() }}</li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .popup {
      position: absolute;
      inset: 0;
      z-index: 2;
      display: flex;
      flex-direction: column;
      background: #f5f7f2;
      font-size: 4.2cqw;
    }
    .crumb {
      padding: 0.15em 0.5em;
      background: #dde7e2;
      font-size: 0.85em;
    }
    .list {
      flex: 1;
      margin: 0;
      padding: 0;
      list-style: none;
      overflow-y: auto;
    }
    li {
      display: flex;
      align-items: center;
      gap: 0.5em;
      padding: 0.2em 0.5em;
      border-bottom: 1px solid #dde4df;
      cursor: pointer;
    }
    li.cur {
      background: #ffe2d8;
    }
    li.empty {
      color: #5a6c67;
      cursor: default;
    }
    .name {
      font-family: var(--font-mono);
    }
    .detail {
      margin-left: auto;
      color: #3d514c;
      font-size: 0.85em;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      max-width: 60%;
    }
    .more {
      color: #5a6c67;
    }
    .chars {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 0.2em;
      padding: 0.3em;
      overflow: auto;
    }
    .ch {
      min-height: 1.8em;
      border: 1px solid #c9d5d1;
      border-radius: 0.2em;
      background: #fff;
      font: inherit;
      cursor: pointer;
    }
    .ch.cur {
      outline: 2px solid #e8603f;
    }
    .help {
      padding: 0.4em 0.6em;
      overflow-y: auto;
      font-size: 0.9em;
    }
    .help p {
      margin: 0 0 0.5em;
    }
    .syntax code {
      font-family: var(--font-mono);
      font-weight: 600;
    }
  `,
})
export class PopupView implements OnInit, OnDestroy {
  private readonly programs = inject(ProgramStore);
  protected readonly popup = inject(PopupStore);
  private readonly i18n = inject(I18n);
  private readonly device = inject(DeviceStore);
  private readonly home = inject(HomeStore);
  private readonly cas = inject(CasStore);
  private readonly settings = inject(SettingsStore);
  private readonly list = viewChild<ElementRef<HTMLUListElement>>('list');

  protected readonly tab = signal<ToolboxTab>('math');
  protected readonly category = signal<ToolCategory | null>(null);
  protected readonly cursor = signal(0);
  protected readonly chars = CHARS;
  private readonly unitCats = unitCategories();
  private pop: (() => void) | null = null;

  private readonly de = computed(() => this.i18n.lang() === 'de');

  protected readonly rows = computed<Row[]>(() => {
    const de = this.de();
    if (this.popup.mode() === 'vars') return this.varRows();
    const cat = this.category();
    if (cat) return cat.entries.map((e) => this.entryRow(e));
    if (this.popup.mode() === 'units') {
      return this.unitCats.map((c) => ({ label: de ? c.de : c.en, category: c }));
    }
    if (this.popup.mode() === 'base') return baseEntries().map((e) => this.entryRow(e));
    switch (this.tab()) {
      case 'math':
      case 'cas':
        return (this.tab() === 'math' ? MATH_TAB : CAS_TAB).map((c) => ({
          label: de ? c.de : c.en,
          category: c,
        }));
      case 'user':
        return userEntries([
          ...this.home.functions().keys(),
          ...this.cas.functions().keys(),
          ...[...this.programs.exports().values()].map((e) => e.name),
        ]).map((e) => this.entryRow(e));
      case 'catalog':
        return catalog().map((e) => this.entryRow(e));
      default:
        return [];
    }
  });

  protected readonly crumb = computed(() => {
    if (this.popup.mode() !== 'toolbox') return '';
    const c = this.category();
    const tab = this.tabLabel(this.tab());
    return c ? `${tab} › ${this.de() ? c.de : c.en}` : tab;
  });

  protected readonly heading = computed(() => {
    switch (this.popup.mode()) {
      case 'vars':
        return 'Vars';
      case 'chars':
        return this.de() ? 'Zeichen' : 'Characters';
      case 'help':
        return this.de() ? 'Hilfe' : 'Help';
      case 'units':
        return this.de() ? 'Einheiten' : 'Units';
      case 'base':
        return 'Base';
      default:
        return 'Toolbox';
    }
  });

  protected readonly help = computed(() => {
    const t = this.popup.topic();
    const de = this.de();
    if (t.kind === 'command') {
      const h = COMMAND_HELP[t.name];
      return h ? { syntax: h.syntax, text: de ? h.de : h.en, example: h.example } : null;
    }
    const v = VIEW_HELP[t.id] ?? VIEW_HELP['home'];
    return { syntax: '', text: de ? v.de : v.en, example: '' };
  });

  protected readonly emptyText = computed(() =>
    this.de()
      ? this.tab() === 'app'
        ? 'Funktionen der Apps folgen mit den Apps.'
        : 'Noch nichts definiert.'
      : this.tab() === 'app'
        ? 'App functions arrive with the apps.'
        : 'Nothing defined yet.',
  );

  constructor() {
    afterRenderEffect(() => {
      const i = this.cursor();
      const el = this.list()?.nativeElement.children[i] as HTMLElement | undefined;
      el?.scrollIntoView?.({ block: 'nearest' });
    });
  }

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'popup',
      title: () => this.heading(),
      menu: () => this.menu(),
      key: (p) => this.key(p),
      menuPress: (i) => this.menuPress(i),
      rocker: (d) => this.rocker(d),
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  private tabLabel(t: ToolboxTab): string {
    const de = this.de();
    return {
      math: 'Math',
      cas: 'CAS',
      app: 'App',
      user: de ? 'Nutzer' : 'User',
      catalog: de ? 'Katalog' : 'Catlg',
    }[t];
  }

  private menu(): MenuButton[] {
    const de = this.de();
    const b = (label: string, active = false): MenuButton => ({ label, active });
    switch (this.popup.mode()) {
      case 'toolbox':
        return [
          ...TABS.map((t) => b(this.tabLabel(t), this.tab() === t)),
          b(de ? 'Hilfe' : 'Help'),
        ];
      case 'help':
        return [
          b(''),
          b(''),
          b(''),
          b(''),
          b(this.help()?.example ? (de ? 'Beispiel' : 'Example') : ''),
          b('OK'),
        ];
      default:
        return [b(''), b(''), b(''), b(''), b(''), b(de ? 'Schließen' : 'Close')];
    }
  }

  private menuPress(i: number): void {
    const mode = this.popup.mode();
    if (mode === 'toolbox' && i < 5) {
      this.tab.set(TABS[i]);
      this.category.set(null);
      this.cursor.set(0);
      return;
    }
    if (mode === 'toolbox' && i === 5) {
      this.showHelp();
      return;
    }
    if (mode === 'help' && i === 4) {
      const ex = this.help()?.example;
      if (ex) this.insert(ex, ex);
      return;
    }
    if (i === 5) this.popup.close();
  }

  private key(p: KeyPress): boolean {
    if (p.id === 'esc' || (p.id === this.popup.mode() && p.layer === 'main')) {
      if (this.category()) this.back();
      else this.popup.close();
      return true;
    }
    if (p.id === 'enter') {
      if (this.popup.mode() === 'help') this.popup.close();
      else if (this.popup.mode() === 'chars') this.pickChar(this.cursor());
      else this.choose(this.cursor());
      return true;
    }
    if (p.id === 'help') {
      this.showHelp();
      return true;
    }
    if (p.layer === 'alpha' && p.char && this.popup.mode() === 'toolbox') {
      // catalogue: a letter jumps
      if (this.tab() !== 'catalog') {
        this.tab.set('catalog');
        this.category.set(null);
      }
      const i = jumpTo(catalog(), p.char);
      if (i >= 0) this.cursor.set(i);
      return true;
    }
    if (p.layer === 'main' && /^d\d$/.test(p.id) && this.popup.mode() !== 'chars') {
      // digits pick the n-th row (1–9), like a numbered menu
      const n = Number(p.id.slice(1));
      if (n >= 1 && n <= this.rows().length) this.choose(n - 1);
      return true;
    }
    return true;
  }

  private rocker(d: RockerDir): boolean {
    const n = this.popup.mode() === 'chars' ? this.chars.length : this.rows().length;
    const cols = this.popup.mode() === 'chars' ? 8 : 1;
    const step: Record<RockerDir, number> = { up: -cols, down: cols, left: -1, right: 1 };
    if (this.popup.mode() === 'chars') {
      this.cursor.update((c) => Math.min(n - 1, Math.max(0, c + step[d])));
      return true;
    }
    if (d === 'left') this.back();
    else if (d === 'right') {
      if (this.rows()[this.cursor()]?.category) this.choose(this.cursor());
    } else if (n) this.cursor.update((c) => (c + (d === 'down' ? 1 : -1) + n) % n);
    return true;
  }

  private back(): void {
    const c = this.category();
    if (!c) return;
    const list =
      this.popup.mode() === 'units' ? this.unitCats : this.tab() === 'cas' ? CAS_TAB : MATH_TAB;
    this.category.set(null);
    this.cursor.set(Math.max(0, list.indexOf(c)));
  }

  protected choose(i: number): void {
    const r = this.rows()[i];
    if (!r) return;
    this.cursor.set(i);
    if (r.category) {
      this.category.set(r.category);
      this.cursor.set(0);
      return;
    }
    if (r.insert) this.insert(r.insert.latex, r.insert.text);
  }

  protected pickChar(i: number): void {
    const c = this.chars[i];
    if (c) this.insert(c.latex, c.text);
  }

  private showHelp(): void {
    const e = this.rows()[this.cursor()]?.entry;
    this.popup.open(
      'help',
      this.popup.target,
      e ? { kind: 'command', name: e.name } : { kind: 'view', id: 'toolbox' },
    );
  }

  private insert(latex: string, text: string): void {
    const target = this.popup.target;
    this.popup.close();
    target?.insert?.(latex, text);
  }

  private entryRow(e: ToolEntry): Row {
    const h = COMMAND_HELP[e.name];
    return {
      label: e.name,
      detail: h ? (this.de() ? h.de : h.en) : undefined,
      insert: { latex: e.latex, text: e.text },
      entry: e,
    };
  }

  private varRows(): Row[] {
    const o = displayOptions(this.settings.settings());
    const rows: Row[] = [];
    for (const [k, v] of this.home.variables()) {
      rows.push({
        label: k,
        detail: formatValue(v, o),
        insert: { latex: k === 'Ans' ? '\\mathrm{Ans}' : nameLatex(k), text: k },
      });
    }
    for (const [k, f] of this.home.functions()) {
      rows.push({
        label: `${k}(${f.params.join(',')})`,
        detail: 'Home',
        insert: { latex: `${nameLatex(k)}\\left(#0\\right)`, text: `${k}(` },
      });
    }
    for (const [k, e] of this.cas.variables()) {
      rows.push({ label: k, latex: toLatex(e), insert: { latex: nameLatex(k), text: k } });
    }
    for (const [k, f] of this.cas.functions()) {
      rows.push({
        label: `${k}(${f.params.join(',')})`,
        detail: 'CAS',
        insert: { latex: `${nameLatex(k)}\\left(#0\\right)`, text: `${k}(` },
      });
    }
    return rows;
  }
}

function nameLatex(name: string): string {
  return name.length === 1 ? name : `\\mathrm{${name}}`;
}
