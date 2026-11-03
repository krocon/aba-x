import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  afterRenderEffect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MathField } from '@aba/core/shared/math-field';
import { MathStatic } from '@aba/core/shared/math-static';
import { CAS_COMMANDS } from '@aba/math/symbolic/cas-commands';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { ClipboardStore } from '../../core/clipboard/clipboard-store';
import { DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import type { MenuButton } from '../device/t1-device';
import { editFor } from '../home/home-keys';
import { STO_LATEX } from '../home/home-logic';
import { TemplatePalette, paletteMove } from '../home/template-palette';
import { TEMPLATES } from '../home/templates';
import { CasStore } from './cas-store';

/**
 * Typed command names become one name (`\operatorname{ifactor}`) – otherwise MathLive's own shortcuts
 * turn parts of them into symbols (`or` → ∨ in “ifactor”).
 */
const SHORTCUTS: Record<string, string> = Object.fromEntries(
  CAS_COMMANDS.map((c) => [c, `\\operatorname{${c}}`]),
);

type Overlay = 'none' | 'templates' | 'confirmClear';

/**
 * The CAS view of ABA-T1 (prompt 029): own history of exact results, the entry line (textbook),
 * Enter = exact (or approximate per CAS settings), ⇧Enter = ≈. Results show ≈ for approximations
 * and a mark when the numerical check could not run. ⇧View copies, ⇧Menu pastes (also to home).
 */
@Component({
  selector: 'app-cas-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MathField, MathStatic, TemplatePalette],
  template: `
    <div class="cas">
      <ol class="history" #list tabindex="0" aria-label="CAS history" aria-live="polite">
        @for (e of cas.entries(); track $index) {
          <li
            tabindex="-1"
            [class.sel]="cas.selected() === $index"
            [class.err]="e.error"
            [attr.aria-current]="cas.selected() === $index ? 'true' : null"
            (click)="cas.selected.set($index)"
            (keydown.enter)="cas.selected.set($index)"
          >
            <span class="in"><app-math [latex]="e.input" /></span>
            @if (e.answer; as a) {
              <span class="out" [attr.data-value]="a.text">
                @if (a.approximate) {
                  <span class="badge" [title]="i18n.t('cas.approx')">≈</span>
                }
                @if (!a.verified) {
                  <span class="badge" [title]="i18n.t('cas.unverified')">?</span>
                }
                <app-math [latex]="a.latex" />
                <span class="visually-hidden">{{ a.text }}</span>
              </span>
            } @else {
              <span class="out note" [attr.data-value]="e.note">{{
                e.note === 'Done' ? i18n.t('home.done') : e.note
              }}</span>
            }
          </li>
        } @empty {
          <li class="empty">{{ i18n.t('cas.empty') }}</li>
        }
      </ol>
      <div class="entry">
        <app-math-field
          [ariaLabel]="i18n.t('home.input')"
          [keyHook]="keyHook"
          [shortcuts]="shortcuts"
        />
      </div>
      @if (overlay() === 'templates') {
        <app-template-palette
          [index]="tpl()"
          [label]="i18n.t('home.template')"
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
    .cas {
      position: relative;
      display: grid;
      grid-template-rows: 1fr auto;
      height: 100%;
      font-size: 4.4cqw;
    }
    .history {
      margin: 0;
      padding: 0;
      list-style: none;
      overflow-y: auto;
      min-height: 0;
    }
    li {
      display: flex;
      flex-direction: column;
      padding: 0.3em 0.5em;
      border-bottom: 1px solid #dde4df;
      cursor: pointer;
    }
    li.sel {
      background: #ffe2d8;
    }
    li.empty {
      color: #5a6c67;
      font-size: 0.8em;
      cursor: default;
    }
    .in,
    .out {
      max-width: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-width: none;
    }
    .out {
      align-self: flex-end;
      font-weight: 600;
    }
    .note {
      font-weight: 400;
      font-size: 0.85em;
    }
    li.err .note {
      color: #b42318;
    }
    .badge {
      margin-right: 0.3em;
      color: #e8603f;
      font-weight: 700;
    }
    .entry {
      border-top: 2px solid #1b3533;
      padding: 0.15em 0.4em;
      min-height: 1.8em;
      background: #fff;
    }
  `,
})
export class CasView implements OnInit, OnDestroy {
  protected readonly cas = inject(CasStore);
  protected readonly i18n = inject(I18n);
  private readonly device = inject(DeviceStore);
  private readonly clipboard = inject(ClipboardStore);
  private readonly field = viewChild(MathField);
  private readonly list = viewChild<ElementRef<HTMLOListElement>>('list');
  protected readonly overlay = signal<Overlay>('none');
  protected readonly tpl = signal(0);
  protected readonly shortcuts = SHORTCUTS;
  private pop: (() => void) | null = null;

  protected readonly keyHook = (e: KeyboardEvent): boolean => {
    if (e.altKey || e.metaKey || e.ctrlKey) return false;
    if (this.overlay() === 'templates') {
      const next = paletteMove(this.tpl(), e.key);
      if (next !== null) this.tpl.set(next);
      else if (e.key === 'Enter') this.pick(this.tpl());
      else if (e.key === 'Escape') this.overlay.set('none');
      return true;
    }
    if (e.key === 'Enter') {
      void this.enter(e.shiftKey);
      return true;
    }
    if (e.key === 'Escape') {
      this.escape();
      return true;
    }
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && this.line().trim() === '') {
      return this.rocker(e.key === 'ArrowUp' ? 'up' : 'down');
    }
    return false;
  };

  constructor() {
    afterRenderEffect(() => {
      this.cas.entries();
      const sel = this.cas.selected();
      const list = this.list()?.nativeElement;
      if (!list) return;
      const row = sel === null ? null : list.children[sel];
      if (row) (row as HTMLElement).scrollIntoView?.({ block: 'nearest' });
      else list.scrollTop = list.scrollHeight;
    });
  }

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'cas',
      title: () =>
        this.overlay() === 'confirmClear'
          ? this.i18n.t('home.clearAsk')
          : this.cas.busy()
            ? this.i18n.t('home.busy')
            : this.i18n.t('cas.title'),
      menu: () => this.menu(),
      key: (p) => this.key(p),
      menuPress: (i) => this.menuPress(i),
      rocker: (d) => this.rocker(d),
      insert: (latex) => {
        this.overlay.set('none');
        this.field()?.insert(latex);
      },
      help: 'cas',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  private menu(): MenuButton[] {
    const b = (label: string): MenuButton => ({ label });
    const t = this.i18n.t.bind(this.i18n);
    if (this.overlay() === 'confirmClear') {
      return [b(''), b(''), b(''), b(''), b(t('home.no')), b(t('home.yes'))];
    }
    return [
      b(t('home.sto')),
      b(t('cas.simplify')),
      b('≈'),
      b(''),
      b(this.cas.selected() !== null ? t('home.copy') : ''),
      b(this.clipboard.clip() ? t('home.paste') : ''),
    ];
  }

  private menuPress(i: number): void {
    if (this.overlay() === 'confirmClear') {
      if (i === 5) this.cas.clearHistory();
      if (i >= 4) this.overlay.set('none');
      return;
    }
    if (i === 0) this.field()?.insert(STO_LATEX);
    if (i === 1) this.wrap('simplify');
    if (i === 2) void this.enter(true);
    if (i === 4) this.copySelected(true);
    if (i === 5) this.paste();
  }

  private key(p: KeyPress): boolean {
    if (this.overlay() === 'templates') {
      if (p.id === 'esc') this.overlay.set('none');
      if (p.id === 'enter') this.pick(this.tpl());
      return true;
    }
    if (p.id === 'on') {
      this.cas.cancel();
      return true;
    }
    if (p.id === 'view' && p.layer === 'shift') {
      this.copySelected(false);
      return true;
    }
    if (p.id === 'menu' && p.layer === 'shift') {
      this.paste();
      return true;
    }
    if (p.id === 'xtn' && p.layer === 'main') {
      this.field()?.insert('x');
      return true;
    }
    const a = editFor(p);
    if (!a) return false;
    switch (a.kind) {
      case 'insert':
        if (this.cas.selected() !== null) this.cas.selected.set(null);
        this.field()?.insert(a.latex);
        break;
      case 'command':
        this.field()?.command(a.command);
        break;
      case 'enter':
        if (this.cas.selected() !== null) this.copySelected(true);
        else void this.enter(p.layer === 'shift');
        break;
      case 'clear':
        this.escape();
        break;
      case 'clearHistory':
        this.overlay.set('confirmClear');
        break;
      case 'templates':
        this.overlay.set('templates');
        break;
      case 'cancel':
        this.cas.cancel();
        break;
    }
    return true;
  }

  private rocker(d: RockerDir): boolean {
    if (this.overlay() === 'templates') {
      const keys = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
      const next = paletteMove(this.tpl(), keys[d]);
      if (next !== null) this.tpl.set(next);
      return true;
    }
    if (d === 'up' || d === 'down') {
      if (this.cas.selected() === null && this.line().trim() !== '') return true;
      this.cas.moveSelection(d === 'up' ? 1 : -1);
      return true;
    }
    this.field()?.command(d === 'left' ? 'moveToPreviousChar' : 'moveToNextChar');
    return true;
  }

  protected pick(i: number): void {
    this.overlay.set('none');
    const t = TEMPLATES[i];
    if (t) this.field()?.insert(t.latex);
  }

  private async enter(approx: boolean): Promise<void> {
    const src = this.line();
    if (await this.cas.submit(src, approx, this.i18n.t('cas.noSolution'))) this.field()?.clear();
  }

  private escape(): void {
    if (this.cas.selected() !== null) this.cas.selected.set(null);
    else this.field()?.clear();
  }

  /** Wraps the line (or the last input) in a command. */
  private wrap(cmd: string): void {
    const src = this.line().trim() || this.cas.entries().at(-1)?.input || '';
    if (!src) return;
    this.field()?.setLatex(`\\operatorname{${cmd}}\\left(${src}\\right)`);
  }

  /** Copy: into the line (Enter / menu) or onto the clipboard for other views (⇧View). */
  private copySelected(intoLine: boolean): void {
    const i = this.cas.selected() ?? this.cas.entries().length - 1;
    const e = this.cas.entries()[i];
    if (!e?.answer) return;
    const clip = { latex: e.answer.latex, text: e.answer.text };
    this.cas.selected.set(null);
    if (intoLine) this.field()?.insert(clip.latex);
    else this.clipboard.copy(clip);
  }

  private paste(): void {
    const c = this.clipboard.clip();
    if (c) this.field()?.insert(c.latex);
  }

  private line(): string {
    return this.field()?.latex() ?? '';
  }
}
