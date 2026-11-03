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
import { MathField } from '@aba/core/shared/math-field';
import { MathStatic } from '@aba/core/shared/math-static';
import * as R from '@aba/math/rpn/rpn-stack';
import { formatValue, valueLatex } from '@aba/math/value/format';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import type { MenuButton } from '../device/t1-device';
import { displayOptions, parseHomeInput, valueAsInput } from '../home/home-logic';
import { HomeStore } from '../home/home-store';
import { SettingsStore } from '../settings/settings-store';
import { type RpnAction, rpnActionFor } from './rpn-keys';
import { RpnStore } from './rpn-store';

/**
 * RPN entry of the home view (prompt 028): the stack (level 1 at the bottom) and the entry line.
 * Enter pushes the line (or duplicates level 1), operators act at once, ⌫ on an empty line drops.
 * A selected level offers PICK, ROLL, ROLLD, DROPN and ECHO.
 */
@Component({
  selector: 'app-rpn-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MathField, MathStatic],
  template: `
    <div class="rpn">
      <ol class="stack" #list tabindex="0" aria-label="Stack" aria-live="polite">
        @for (r of rows(); track r.level) {
          <li
            [class.sel]="rpn.selected() === r.level"
            [attr.aria-current]="rpn.selected() === r.level ? 'true' : null"
          >
            <span class="lvl">{{ r.level }}:</span>
            <span class="val" [attr.data-value]="r.text">
              <app-math [latex]="r.latex" />
              <span class="visually-hidden">{{ r.text }}</span>
            </span>
          </li>
        }
      </ol>
      <div class="entry">
        <app-math-field [ariaLabel]="i18n.t('home.input')" [keyHook]="keyHook" />
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .rpn {
      display: grid;
      grid-template-rows: 1fr auto;
      height: 100%;
      font-size: 4.4cqw;
    }
    .stack {
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      margin: 0;
      padding: 0;
      list-style: none;
      overflow-y: auto;
      min-height: 0;
    }
    li {
      display: flex;
      align-items: baseline;
      gap: 0.5em;
      padding: 0.15em 0.5em;
      border-bottom: 1px solid #dde4df;
    }
    li.sel {
      background: #ffe2d8;
    }
    .lvl {
      color: #5a6c67;
      min-width: 1.6em;
    }
    .val {
      flex: 1;
      text-align: right;
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-width: none;
      font-weight: 600;
    }
    .entry {
      border-top: 2px solid #1b3533;
      padding: 0.15em 0.4em;
      min-height: 1.8em;
      background: #fff;
    }
  `,
})
export class RpnView implements OnInit, OnDestroy {
  protected readonly rpn = inject(RpnStore);
  protected readonly i18n = inject(I18n);
  private readonly home = inject(HomeStore);
  private readonly settings = inject(SettingsStore);
  private readonly device = inject(DeviceStore);
  private readonly field = viewChild(MathField);
  private readonly list = viewChild<ElementRef<HTMLOListElement>>('list');
  private readonly confirmClear = signal(false);
  private pop: (() => void) | null = null;

  protected readonly rows = computed(() => {
    const o = displayOptions(this.settings.settings());
    const s = this.rpn.stack();
    return s.map((v, i) => ({
      level: s.length - i,
      latex: valueLatex(v, o),
      text: formatValue(v, o),
    }));
  });

  protected readonly keyHook = (e: KeyboardEvent): boolean => {
    if (e.altKey || e.metaKey || e.ctrlKey) return false;
    const line = this.line();
    const ops: Record<string, string> = {
      '+': 'add',
      '-': 'sub',
      '*': 'mul',
      '/': 'div',
      '^': 'pow',
    };
    // operators act on the stack unless the line is an expression in progress (e.g. "2E-3")
    if (ops[e.key] && !/[eE]$/.test(line)) {
      void this.act(rpnActionFor({ id: ops[e.key], layer: 'main' })!);
      return true;
    }
    if (e.key === 'Enter') {
      void this.act({ kind: 'enter' });
      return true;
    }
    if (e.key === 'Backspace' && line.trim() === '') {
      void this.act({ kind: 'backspace' });
      return true;
    }
    if (e.key === 'Escape') {
      void this.act({ kind: 'edit', edit: { kind: 'clear' } });
      return true;
    }
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && line.trim() === '') {
      return this.rocker(e.key === 'ArrowUp' ? 'up' : 'down');
    }
    return false;
  };

  constructor() {
    afterRenderEffect(() => {
      this.rpn.stack();
      const list = this.list()?.nativeElement;
      if (list && this.rpn.selected() === null) list.scrollTop = list.scrollHeight;
    });
  }

  ngOnInit(): void {
    void import('mathlive');
    this.pop = this.device.push({
      id: 'rpn',
      title: () =>
        this.confirmClear()
          ? this.i18n.t('home.clearAsk')
          : (this.rpn.message() ?? this.i18n.t('home.titleRpn')),
      menu: () => this.menu(),
      key: (p) => this.key(p),
      menuPress: (i) => this.menuPress(i),
      rocker: (d) => this.rocker(d),
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  private menu(): MenuButton[] {
    const b = (label: string): MenuButton => ({ label });
    if (this.confirmClear()) {
      return [b(''), b(''), b(''), b(''), b(this.i18n.t('home.no')), b(this.i18n.t('home.yes'))];
    }
    if (this.rpn.selected() !== null) {
      return [b('PICK'), b('ROLL'), b('ROLLD'), b('DROPN'), b('ECHO'), b('')];
    }
    return [b(this.i18n.t('home.sto')), b('SWAP'), b('DROP'), b('DUP'), b(''), b('')];
  }

  private menuPress(i: number): void {
    if (this.confirmClear()) {
      if (i === 5) this.rpn.clear();
      if (i >= 4) this.confirmClear.set(false);
      return;
    }
    const n = this.rpn.selected();
    if (n !== null) {
      const ops = [R.pick, R.roll, R.rollDown, R.dropN];
      if (i < 4) this.rpn.run((s) => ops[i](s, n));
      if (i === 4) this.echo(n);
      return;
    }
    if (i === 0) void this.act({ kind: 'sto' });
    if (i === 1) this.rpn.run(R.swap);
    if (i === 2) this.rpn.run(R.drop);
    if (i === 3) this.rpn.run(R.dup);
  }

  private key(p: KeyPress): boolean {
    if (p.id === 'on') {
      this.home.cancel();
      return true;
    }
    if (this.rpn.selected() !== null && (p.id === 'esc' || p.id === 'enter')) {
      if (p.id === 'enter') this.echo(this.rpn.selected()!);
      else this.rpn.selected.set(null);
      return true;
    }
    const a = rpnActionFor(p);
    if (!a) return false;
    void this.act(a);
    return true;
  }

  private rocker(d: RockerDir): boolean {
    if (d === 'up' || d === 'down') {
      if (this.rpn.selected() === null && this.line().trim() !== '') return true;
      this.rpn.moveSelection(d === 'up' ? 1 : -1);
      return true;
    }
    this.field()?.command(d === 'left' ? 'moveToPreviousChar' : 'moveToNextChar');
    return true;
  }

  private async act(a: RpnAction): Promise<void> {
    this.confirmClear.set(false);
    switch (a.kind) {
      case 'op':
        if (await this.pushLine()) this.rpn.apply(a.op);
        return;
      case 'enter':
        if (this.line().trim() === '') this.rpn.run(R.dup);
        else await this.pushLine();
        return;
      case 'backspace':
        if (this.line().trim() === '') this.rpn.run(R.drop);
        else this.field()?.command('deleteBackward');
        return;
      case 'sto': {
        const name = this.line()
          .replace(/\\mathrm\{([^}]*)\}/g, '$1')
          .trim();
        if (name && this.rpn.store(name)) this.field()?.clear();
        else if (!name) this.rpn.message.set('type a name, then Sto ▶');
        return;
      }
      case 'clearStack':
        this.confirmClear.set(true);
        return;
      case 'edit':
        if (a.edit.kind === 'insert') this.field()?.insert(a.edit.latex);
        else if (a.edit.kind === 'command') this.field()?.command(a.edit.command);
        else if (a.edit.kind === 'clear') this.field()?.clear();
        else if (a.edit.kind === 'cancel') this.home.cancel();
        return;
    }
  }

  /** Pushes a non-empty entry line; false if it could not be evaluated. */
  private async pushLine(): Promise<boolean> {
    const src = this.line();
    if (src.trim() === '') return true;
    const p = parseHomeInput(src, 'latex', new Set(this.home.functions().keys()));
    if (!p.ok || p.value.kind !== 'expr') {
      this.rpn.message.set(p.ok ? 'use Sto ▶ to store in RPN' : p.error.message);
      return false;
    }
    if (!(await this.rpn.pushExpr(p.value.expr))) return false;
    this.field()?.clear();
    return true;
  }

  private echo(n: number): void {
    const v = R.level(this.rpn.stack(), n);
    if (!v) return;
    this.rpn.selected.set(null);
    this.field()?.insert(valueAsInput(v, 'latex', this.settings.settings()));
  }

  private line(): string {
    return this.field()?.latex() ?? '';
  }
}
