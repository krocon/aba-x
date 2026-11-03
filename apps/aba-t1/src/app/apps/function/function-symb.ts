import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MathField } from '@aba/core/shared/math-field';
import { MathStatic } from '@aba/core/shared/math-static';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import { catalogShortcuts } from '../../core/latex/typed-names';
import type { MenuButton } from '../../features/device/t1-device';
import { editFor } from '../../features/home/home-keys';
import { AppStore } from '../app-store';
import { FN_COLORS, FN_NAMES, type FunctionState, definitions } from './function-logic';

/**
 * Symbolic view of the function app (prompts 033/034): F1…F9, F0 with a check mark (plotted or
 * not) and their colour. Enter or Edit opens the definition in the entry line, Enter stores it.
 */
@Component({
  selector: 'app-function-symb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MathField, MathStatic],
  template: `
    <div class="symb">
      <ul class="defs" role="listbox" [attr.aria-label]="i18n.t('app.functions')">
        @for (r of rows(); track r.name; let i = $index) {
          <li
            role="option"
            tabindex="-1"
            [class.cur]="cursor() === i"
            [attr.aria-selected]="cursor() === i"
            (click)="cursor() === i ? edit() : cursor.set(i)"
            (keydown.enter)="edit()"
          >
            <button
              type="button"
              class="check"
              [attr.aria-pressed]="r.on"
              [attr.aria-label]="r.name + (r.on ? ' on' : ' off')"
              (click)="toggle(i); $event.stopPropagation()"
            >
              {{ r.on ? '✓' : '' }}
            </button>
            <span class="swatch" [style.background]="r.color"></span>
            <span class="name">{{ r.name }}(X)=</span>
            <span class="def" [class.err]="r.error">
              @if (r.latex) {
                <app-math [latex]="r.latex" />
              }
            </span>
          </li>
        }
      </ul>
      @if (editing() !== null) {
        <div class="entry">
          <span class="prefix">{{ names[editing()!] }}(X)=</span>
          <app-math-field
            [ariaLabel]="names[editing()!] + '(X)'"
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
      font-size: 4.2cqw;
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
      border-bottom: 1px solid #dde4df;
      min-height: 1.6em;
      cursor: pointer;
    }
    li.cur {
      background: #ffe2d8;
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
    }
    .swatch {
      width: 0.6em;
      height: 0.6em;
      border-radius: 50%;
    }
    .name {
      color: #3d514c;
      white-space: nowrap;
    }
    .def {
      overflow: hidden;
      white-space: nowrap;
    }
    .def.err {
      outline: 1px dashed #b42318;
    }
    .entry {
      display: flex;
      align-items: center;
      gap: 0.3em;
      border-top: 2px solid #1b3533;
      padding: 0.1em 0.4em;
      background: #fff;
    }
    .entry app-math-field {
      flex: 1;
    }
    .prefix {
      white-space: nowrap;
      color: #3d514c;
    }
  `,
})
export class FunctionSymb implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  private readonly apps = inject(AppStore);
  private readonly device = inject(DeviceStore);
  private readonly field = viewChild(MathField);
  protected readonly names = FN_NAMES;
  protected readonly shortcuts = catalogShortcuts(FN_NAMES);
  protected readonly cursor = signal(0);
  protected readonly editing = signal<number | null>(null);
  private readonly state = computed(() => this.apps.current().state as FunctionState);
  protected readonly rows = computed(() => {
    const fns = this.state().fns;
    const errors = definitions(fns).errors;
    return fns.map((f, i) => ({
      name: FN_NAMES[i],
      latex: f.latex,
      on: f.on,
      color: FN_COLORS[i],
      error: errors[i],
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
      this.editing.set(null);
      return true;
    }
    return false;
  };

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'function-symb',
      title: () => this.i18n.t('app.functionSymb'),
      menu: () => this.menu(),
      key: (p) => this.key(p),
      menuPress: (i) => this.menuPress(i),
      rocker: (d) => this.rocker(d),
      insert: (latex) => {
        if (this.editing() === null) this.edit();
        queueMicrotask(() => this.field()?.insert(latex));
      },
      help: 'function',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  private menu(): MenuButton[] {
    const b = (label: string): MenuButton => ({ label });
    if (this.editing() !== null)
      return [b(''), b(''), b('X'), b(''), b(this.i18n.t('home.no')), b('OK')];
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
    if (this.editing() !== null) {
      if (i === 2) this.field()?.insert('X');
      if (i === 4) this.editing.set(null);
      if (i === 5) this.store();
      return;
    }
    if (i === 0) this.edit();
    if (i === 1) this.toggle(this.cursor());
    if (i === 4) this.set(this.cursor(), '');
  }

  protected edit(): void {
    this.editing.set(this.cursor());
  }

  protected fill(): void {
    const i = this.editing();
    if (i !== null) this.field()?.setLatex(this.state().fns[i].latex);
  }

  protected toggle(i: number): void {
    this.apps.update<FunctionState>((s) => ({
      ...s,
      fns: s.fns.map((f, k) => (k === i ? { ...f, on: !f.on } : f)),
    }));
  }

  private set(i: number, latex: string): void {
    this.apps.update<FunctionState>((s) => ({
      ...s,
      fns: s.fns.map((f, k) => (k === i ? { ...f, latex, on: true } : f)),
    }));
  }

  private store(): void {
    const i = this.editing();
    if (i === null) return;
    this.set(i, this.field()?.latex() ?? '');
    this.editing.set(null);
    this.cursor.set(Math.min(FN_NAMES.length - 1, i + 1));
  }

  private key(p: KeyPress): boolean {
    if (this.editing() !== null) {
      if (p.id === 'enter') this.store();
      else if (p.id === 'esc') this.editing.set(null);
      else if (p.id === 'xtn' && p.layer === 'main') this.field()?.insert('X');
      else {
        const a = editFor(p);
        if (a?.kind === 'insert') this.field()?.insert(a.latex);
        else if (a?.kind === 'command') this.field()?.command(a.command);
        else return false;
      }
      return true;
    }
    if (p.id === 'enter') {
      this.edit();
      return true;
    }
    if (p.id === 'bksp') {
      this.set(this.cursor(), '');
      return true;
    }
    // typing starts a new definition
    const a = editFor(p);
    if (a?.kind === 'insert' || (p.id === 'xtn' && p.layer === 'main')) {
      this.edit();
      const latex = a?.kind === 'insert' ? a.latex : 'X';
      setTimeout(() => this.field()?.insert(latex), 50);
      return true;
    }
    return false;
  }

  private rocker(d: RockerDir): boolean {
    if (this.editing() !== null) {
      if (d === 'left' || d === 'right')
        this.field()?.command(d === 'left' ? 'moveToPreviousChar' : 'moveToNextChar');
      return true;
    }
    const n = FN_NAMES.length;
    if (d === 'up') this.cursor.update((c) => (c + n - 1) % n);
    if (d === 'down') this.cursor.update((c) => (c + 1) % n);
    return true;
  }
}
