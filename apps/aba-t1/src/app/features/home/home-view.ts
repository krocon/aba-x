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
import type { Gesture } from '@aba/core/actions/gestures';
import { MathField } from '@aba/core/shared/math-field';
import { MathStatic } from '@aba/core/shared/math-static';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { ClipboardStore } from '../../core/clipboard/clipboard-store';
import { DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import type { MenuButton } from '../device/t1-device';
import { SettingsStore } from '../settings/settings-store';
import { type EditAction, editFor } from './home-keys';
import { type HistoryEntry, inputLatex, resultLatex, resultText, valueAsInput } from './home-logic';
import { HomeStore } from './home-store';
import { TemplatePalette, paletteMove } from './template-palette';
import { TEMPLATES } from './templates';
import { catalogShortcuts } from '../../core/latex/typed-names';

type Overlay = 'none' | 'templates' | 'show' | 'confirmClear';

/**
 * The home view of ABA-T1 (prompt 027): history (input left, result right, newest at the bottom)
 * and the entry line – MathLive in textbook mode, a text field in algebraic mode. Device keys,
 * the PC keyboard and touch all edit the same line. Overlays: template palette, large view of a
 * result, confirmation of Clear.
 */
@Component({
  selector: 'app-home-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MathField, MathStatic, TemplatePalette],
  templateUrl: './home-view.html',
  styleUrl: './home-view.css',
})
export class HomeView implements OnInit, OnDestroy {
  protected readonly home = inject(HomeStore);
  protected readonly settingsStore = inject(SettingsStore);
  protected readonly i18n = inject(I18n);
  private readonly device = inject(DeviceStore);
  private readonly clipboard = inject(ClipboardStore);
  private readonly mathField = viewChild(MathField);
  private readonly textField = viewChild<ElementRef<HTMLInputElement>>('text');
  private readonly list = viewChild<ElementRef<HTMLOListElement>>('list');

  protected readonly overlay = signal<Overlay>('none');
  protected readonly templateIndex = signal(0);
  protected readonly templates = TEMPLATES;
  protected readonly shortcuts = catalogShortcuts();
  protected readonly textbook = computed(() => this.settingsStore.settings().entry !== 'algebraic');
  protected readonly rows = computed(() => {
    const s = this.settingsStore.settings();
    return this.home.entries().map((e: HistoryEntry) => ({
      e,
      inLatex: inputLatex(e),
      outLatex: resultLatex(e, s),
      outText: resultText(e, s),
    }));
  });
  protected readonly shown = computed(() => {
    const i = this.home.selected() ?? this.home.entries().length - 1;
    return this.rows()[i] ?? null;
  });

  private pop: (() => void) | null = null;

  /** the hardware keyboard inside the entry line: Enter, Esc, ↑ into the history */
  protected readonly keyHook = (e: KeyboardEvent): boolean => {
    if (e.altKey || e.metaKey || e.ctrlKey) return false;
    if (this.overlay() !== 'none') return this.overlayKey(e.key);
    if (e.key === 'Enter') {
      this.run({ kind: 'enter' });
      return true;
    }
    if (e.key === 'Escape') {
      this.run({ kind: e.shiftKey ? 'clearHistory' : 'clear' });
      return true;
    }
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && this.lineEmpty()) {
      return this.rocker(e.key === 'ArrowUp' ? 'up' : 'down');
    }
    if (this.home.selected() !== null && e.key.length === 1) this.home.selected.set(null);
    return false;
  };

  constructor() {
    afterRenderEffect(() => {
      this.home.entries();
      const sel = this.home.selected();
      const list = this.list()?.nativeElement;
      if (!list) return;
      const row = sel === null ? null : list.children[sel];
      if (row) (row as HTMLElement).scrollIntoView?.({ block: 'nearest' });
      else list.scrollTop = list.scrollHeight;
    });
  }

  ngOnInit(): void {
    // history rows render formulas with <math-span>: MathLive must be loaded in algebraic mode too
    void import('mathlive');
    this.pop = this.device.push({
      id: 'home',
      title: () =>
        this.home.busy()
          ? this.i18n.t('home.busy')
          : (this.home.problem() ?? this.i18n.t('home.title')),
      menu: () => this.menu(),
      key: (p) => this.key(p),
      menuPress: (i) => this.menuPress(i),
      rocker: (d) => this.rocker(d),
      gesture: (g) => this.gesture(g),
      insert: (latex, text) => {
        this.closeOverlay();
        this.insert(latex, text);
      },
      help: 'home',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  private menu(): MenuButton[] {
    const t = (k: Parameters<I18n['t']>[0]) => this.i18n.t(k);
    switch (this.overlay()) {
      case 'confirmClear':
        return [
          { label: t('home.clearAsk') },
          { label: '' },
          { label: '' },
          { label: '' },
          { label: t('home.no') },
          { label: t('home.yes') },
        ];
      case 'templates':
        return [
          { label: '' },
          { label: '' },
          { label: '' },
          { label: '' },
          { label: t('home.close') },
          { label: 'OK' },
        ];
      case 'show':
        return [
          { label: '' },
          { label: '' },
          { label: '' },
          { label: '' },
          { label: '' },
          { label: t('home.close') },
        ];
      default: {
        const sel = this.home.selected() !== null;
        return [
          { label: t('home.sto') },
          { label: '' },
          { label: '' },
          { label: '' },
          { label: sel ? t('home.copy') : '' },
          { label: this.home.entries().length ? t('home.show') : '' },
        ];
      }
    }
  }

  private menuPress(i: number): void {
    switch (this.overlay()) {
      case 'confirmClear':
        if (i === 5) this.home.clearHistory();
        if (i === 4 || i === 5) this.overlay.set('none');
        return;
      case 'templates':
        if (i === 5) this.pickTemplate(this.templateIndex());
        if (i === 4) this.closeOverlay();
        return;
      case 'show':
        if (i === 5) this.closeOverlay();
        return;
    }
    if (i === 0) this.run(editFor({ id: 'eex', layer: 'shift' })!);
    if (i === 4) this.copySelected();
    if (i === 5 && this.home.entries().length) this.overlay.set('show');
  }

  private key(p: KeyPress): boolean {
    if (this.overlay() !== 'none') {
      if (p.id === 'enter') return this.overlayKey('Enter');
      if (p.id === 'esc') return this.overlayKey('Escape');
      if (this.overlay() === 'templates') return true;
      this.overlay.set('none');
    }
    if (p.id === 'on') {
      this.home.cancel();
      return true;
    }
    if (p.id === 'view' && p.layer === 'shift') {
      this.copyToClipboard();
      return true;
    }
    if (p.id === 'menu' && p.layer === 'shift') {
      const c = this.clipboard.clip();
      if (c) this.insert(c.latex, c.text);
      return true;
    }
    const action = editFor(p);
    if (!action) return false;
    this.run(action);
    return true;
  }

  private overlayKey(key: string): boolean {
    const o = this.overlay();
    if (key === 'Escape') {
      this.closeOverlay();
      return true;
    }
    if (o === 'templates') {
      const next = paletteMove(this.templateIndex(), key);
      if (next !== null) {
        this.templateIndex.set(next);
        return true;
      }
      if (key === 'Enter') {
        this.pickTemplate(this.templateIndex());
        return true;
      }
      return true;
    }
    if (o === 'confirmClear' && key === 'Enter') {
      this.home.clearHistory();
      this.overlay.set('none');
      return true;
    }
    if (key === 'Enter') {
      this.closeOverlay();
      return true;
    }
    return true;
  }

  private rocker(d: RockerDir): boolean {
    if (this.overlay() === 'templates') {
      const keys: Record<RockerDir, string> = {
        up: 'ArrowUp',
        down: 'ArrowDown',
        left: 'ArrowLeft',
        right: 'ArrowRight',
      };
      return this.overlayKey(keys[d]);
    }
    if (this.overlay() !== 'none') return true;
    if (d === 'up' || d === 'down') {
      if (this.home.selected() === null && !this.lineEmpty()) return true;
      this.home.moveSelection(d === 'up' ? 1 : -1);
      return true;
    }
    if (this.home.selected() !== null) return true;
    if (this.textbook())
      this.mathField()?.command(d === 'left' ? 'moveToPreviousChar' : 'moveToNextChar');
    else {
      const el = this.textField()?.nativeElement;
      if (el) {
        const pos = (el.selectionStart ?? 0) + (d === 'left' ? -1 : 1);
        el.setSelectionRange(Math.max(0, pos), Math.max(0, pos));
      }
    }
    return true;
  }

  private gesture(g: Gesture): void {
    if (g.kind === 'swipe' && this.overlay() === 'none' && (g.dir === 'up' || g.dir === 'down')) {
      this.home.moveSelection(g.dir === 'down' ? 1 : -1);
    }
  }

  /** Tap on a history row: select it; tap on the selected row: copy it into the line. */
  protected tapRow(i: number): void {
    if (this.home.selected() === i) this.copySelected();
    else this.home.selected.set(i);
  }

  protected pickTemplate(i: number): void {
    const t = this.templates[i];
    this.closeOverlay();
    if (t) this.insert(t.latex, '');
  }

  private run(a: EditAction): void {
    switch (a.kind) {
      case 'insert':
        if (this.home.selected() !== null) this.home.selected.set(null);
        this.insert(a.latex, a.text);
        return;
      case 'command':
        if (this.textbook()) this.mathField()?.command(a.command);
        else this.textCommand(a.command);
        return;
      case 'enter':
        if (this.home.selected() !== null) {
          this.copySelected();
          return;
        }
        void this.submit();
        return;
      case 'clear':
        if (this.home.selected() !== null) this.home.selected.set(null);
        else this.setLine('');
        return;
      case 'clearHistory':
        this.overlay.set('confirmClear');
        return;
      case 'templates':
        if (this.textbook()) this.overlay.set('templates');
        return;
      case 'cancel':
        this.home.cancel();
        return;
    }
  }

  private async submit(): Promise<void> {
    const kind = this.textbook() ? 'latex' : 'text';
    const src = this.line();
    if (await this.home.submit(src, kind)) this.setLine('');
  }

  private copySelected(): void {
    const i = this.home.selected();
    if (i === null) return;
    const row = this.home.entries()[i];
    if (!row) return;
    const kind = this.textbook() ? 'latex' : 'text';
    // copying the input of a row needs the same entry mode; results always work
    const src = row.value
      ? valueAsInput(row.value, kind, this.settingsStore.settings())
      : row.kind === kind
        ? row.input
        : '';
    this.home.selected.set(null);
    this.insert(src, src);
  }

  /** ⇧View: the selected (or last) result for other views and the system clipboard. */
  private copyToClipboard(): void {
    const i = this.home.selected() ?? this.home.entries().length - 1;
    const e = this.home.entries()[i];
    if (!e?.value) return;
    const s = this.settingsStore.settings();
    this.clipboard.copy({
      latex: valueAsInput(e.value, 'latex', s),
      text: valueAsInput(e.value, 'text', s),
    });
    this.home.selected.set(null);
  }

  private closeOverlay(): void {
    this.overlay.set('none');
    this.focusLine();
  }

  private insert(latex: string, text: string): void {
    if (this.textbook()) {
      this.mathField()?.insert(latex);
      return;
    }
    const el = this.textField()?.nativeElement;
    if (!el || !text) return;
    el.setRangeText(
      text,
      el.selectionStart ?? el.value.length,
      el.selectionEnd ?? el.value.length,
      'end',
    );
    el.focus();
  }

  private textCommand(c: 'deleteBackward' | 'deleteForward'): void {
    const el = this.textField()?.nativeElement;
    if (!el) return;
    const s = el.selectionStart ?? 0;
    const e = el.selectionEnd ?? s;
    if (s !== e) el.setRangeText('', s, e, 'end');
    else if (c === 'deleteBackward' && s > 0) el.setRangeText('', s - 1, s, 'end');
    else if (c === 'deleteForward') el.setRangeText('', s, s + 1, 'end');
  }

  private line(): string {
    return this.textbook()
      ? (this.mathField()?.latex() ?? '')
      : (this.textField()?.nativeElement.value ?? '');
  }

  private lineEmpty(): boolean {
    return this.line().trim() === '';
  }

  private setLine(v: string): void {
    if (this.textbook()) this.mathField()?.setLatex(v);
    else {
      const el = this.textField()?.nativeElement;
      if (el) el.value = v;
    }
  }

  private focusLine(): void {
    if (this.textbook()) this.mathField()?.focus();
    else this.textField()?.nativeElement.focus();
  }

  protected textKey(e: KeyboardEvent): void {
    if (this.keyHook(e)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
}
