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
import { FilesApi } from '@aba/core/files/files-api';
import { Modal } from '@aba/core/shared/modal';
import { type PplValue, formatPpl } from '@aba/ppl';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import { NavStore } from '../../core/nav/nav-store';
import { PlotMenu, type PlotMenuItem } from '../../apps/shared/plot-menu';
import { editFor } from '../home/home-keys';
import {
  TEMPLATES,
  findNext,
  highlight,
  indentAfter,
  insertTemplate,
  lineOf,
  offsetOf,
  reindent,
  replaceAll,
} from './editor-logic';
import { ProgramRunner } from './program-runner';
import { ProgramStore, isProgramName, templateSource } from './program-store';

/**
 * Program catalogue (prompt 044, ⇧1): the programs with their state (errors, exported
 * functions). Menu: Edit, New, Rename, Delete, More (copy, export/import file), Run.
 */
@Component({
  selector: 'app-program-catalog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlotMenu],
  template: `
    <div class="cat">
      <ul class="list" [attr.aria-label]="i18n.t('prog.catalog')">
        @for (p of list(); track p.name; let i = $index) {
          <li
            tabindex="-1"
            [class.cur]="cursor() === i"
            [attr.aria-current]="cursor() === i ? 'true' : null"
            (click)="pick(i)"
            (keydown.enter)="pick(i)"
          >
            <span class="name">{{ p.name }}</span>
            <span class="info" [class.err]="p.error">{{ p.info }}</span>
          </li>
        } @empty {
          <li class="empty">{{ i18n.t('prog.empty') }}</li>
        }
      </ul>
      @if (ask(); as a) {
        <div class="ask">
          <label>
            {{ a === 'new' ? i18n.t('prog.newName') : i18n.t('prog.rename') }}
            <input
              #name
              type="text"
              spellcheck="false"
              autocomplete="off"
              (keydown.enter)="confirmName()"
              (keydown.escape)="ask.set(null)"
            />
          </label>
        </div>
      }
      @if (more() !== null) {
        <app-plot-menu
          [title]="i18n.t('prog.more')"
          [items]="moreItems()"
          [cursor]="more()!"
          (pick)="pickMore($event)"
        />
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .cat {
      position: relative;
      height: 100%;
      font-size: 4cqw;
    }
    .list {
      margin: 0;
      padding: 0;
      list-style: none;
      height: 100%;
      overflow-y: auto;
    }
    li {
      display: flex;
      justify-content: space-between;
      gap: 1em;
      padding: 0.15em 0.5em;
      border-bottom: 1px solid var(--lcd-line);
      cursor: pointer;
    }
    li.cur {
      background: var(--lcd-cur);
    }
    .info {
      color: var(--lcd-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .info.err {
      color: var(--lcd-error);
    }
    .empty {
      color: var(--lcd-muted);
      cursor: default;
    }
    .ask {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 0.3em 0.5em;
      background: var(--lcd-bg);
      border-top: 2px solid var(--lcd-line-strong);
    }
    .ask input {
      font: inherit;
      width: 50%;
    }
  `,
})
export class ProgramCatalog implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  private readonly store = inject(ProgramStore);
  private readonly runner = inject(ProgramRunner);
  private readonly device = inject(DeviceStore);
  private readonly nav = inject(NavStore);
  private readonly files = inject(FilesApi);
  private readonly nameEl = viewChild<ElementRef<HTMLInputElement>>('name');
  protected readonly cursor = signal(0);
  protected readonly ask = signal<'new' | 'rename' | null>(null);
  protected readonly more = signal<number | null>(null);
  private readonly message = signal<string | null>(null);
  private pop: (() => void) | null = null;

  protected readonly list = computed(() =>
    this.store.compiled().map((c) => ({
      name: c.doc.name,
      error: !!c.error,
      info: c.error
        ? `${this.i18n.t('prog.error')} ${c.error.line}:${c.error.column}`
        : c.program!.exports.map((e) => `${e.name}(${e.params.join(',')})`).join(' '),
    })),
  );

  private readonly current = computed(() => this.list()[this.cursor()]?.name ?? null);

  protected readonly moreItems = computed<PlotMenuItem[]>(() => {
    const t = (k: Parameters<I18n['t']>[0]) => this.i18n.t(k);
    const cur = this.current();
    return [
      ...(cur
        ? [
            { label: t('prog.copy'), run: () => this.copy(cur) },
            { label: t('prog.export'), run: () => void this.exportFile(cur) },
          ]
        : []),
      { label: t('prog.import'), run: () => void this.importFile() },
      { label: t('prog.terminal'), run: () => this.nav.go('terminal') },
    ];
  });

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'programs',
      title: () => this.message() ?? this.i18n.t('prog.catalog'),
      menu: () => [
        { label: this.i18n.t('data.edit') },
        { label: this.i18n.t('prog.new') },
        { label: this.i18n.t('prog.renameShort') },
        { label: this.i18n.t('data.delete') },
        { label: this.i18n.t('prog.more') },
        { label: this.i18n.t('prog.run') },
      ],
      key: (p) => this.key(p),
      menuPress: (i) => this.menu(i),
      rocker: (d) => this.rocker(d),
      help: 'programs',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  protected pick(i: number): void {
    if (this.cursor() === i) this.edit();
    this.cursor.set(i);
  }

  private edit(): void {
    const cur = this.current();
    if (cur) this.nav.go('programEditor', cur);
  }

  private menu(i: number): void {
    const cur = this.current();
    this.message.set(null);
    if (i === 0) this.edit();
    if (i === 1 || (i === 2 && cur)) {
      this.ask.set(i === 1 ? 'new' : 'rename');
      queueMicrotask(() => {
        const el = this.nameEl()?.nativeElement;
        if (el) {
          el.value = i === 2 ? (cur ?? '') : '';
          el.focus();
        }
      });
    }
    if (i === 3 && cur) {
      this.store.remove(cur);
      this.cursor.update((c) => Math.max(0, Math.min(c, this.list().length - 1)));
    }
    if (i === 4) this.openMore();
    if (i === 5 && cur) void this.runFirst(cur);
  }

  private async runFirst(program: string): Promise<void> {
    const c = this.store.compiled().find((x) => x.doc.name === program);
    const e = c?.program?.exports[0];
    if (!e) {
      this.message.set(c?.error ? c.error.message : this.i18n.t('prog.noExport'));
      return;
    }
    if (await this.runner.start(e.name)) this.nav.go(this.afterRun());
  }

  private afterRun(): 'terminal' | 'home' {
    return this.runner.terminal().length || this.runner.drew() ? 'terminal' : 'home';
  }

  protected confirmName(): void {
    const name = this.nameEl()?.nativeElement.value.trim() ?? '';
    const mode = this.ask();
    if (!isProgramName(name)) {
      this.message.set(this.i18n.t('prog.badName'));
      return;
    }
    if (mode === 'new') {
      if (this.store.get(name)) {
        this.message.set(this.i18n.t('prog.exists'));
        return;
      }
      this.store.put(name, templateSource(name));
      this.ask.set(null);
      this.nav.go('programEditor', name);
      return;
    }
    const cur = this.current();
    if (cur && !this.store.rename(cur, name)) {
      this.message.set(this.i18n.t('prog.exists'));
      return;
    }
    this.ask.set(null);
  }

  private copy(name: string): void {
    let n = 1;
    while (this.store.get(`${name}${n}`)) n++;
    this.store.put(`${name}${n}`, this.store.get(name)?.source ?? '');
  }

  private async exportFile(name: string): Promise<void> {
    const src = this.store.get(name)?.source ?? '';
    await this.files.saveText(`${name}.ppl.txt`, src, { name: 'Program', extensions: ['txt'] });
  }

  private async importFile(): Promise<void> {
    const f = await this.files.openText({ name: 'Program', extensions: ['txt', 'ppl'] });
    if (!f) return;
    let name = (f.name.split(/[\\/]/).pop() ?? 'PROG').replace(/\..*$/, '').replace(/\W/g, '');
    if (!isProgramName(name)) name = 'PROG';
    let n = name;
    for (let k = 1; this.store.get(n); k++) n = `${name}${k}`;
    this.store.put(n, f.text);
  }

  private openMore(): void {
    this.more.set(0);
    const pop = this.device.push({
      id: 'programs-more',
      title: () => this.i18n.t('prog.more'),
      menu: () => [
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: 'OK' },
      ],
      key: (p) => {
        if (p.id === 'enter') this.pickMore(this.more() ?? 0);
        else if (p.id === 'esc') this.closeMore();
        return true;
      },
      menuPress: (i) => {
        if (i === 5) this.pickMore(this.more() ?? 0);
      },
      rocker: (d) => {
        const n = this.moreItems().length;
        const m = this.more() ?? 0;
        if (d === 'up' || d === 'down') this.more.set((m + (d === 'down' ? 1 : n - 1)) % n);
        if (d === 'left') this.closeMore();
        return true;
      },
      help: 'programs',
    });
    this.closeMore = () => {
      pop();
      this.more.set(null);
    };
  }

  private closeMore = () => this.more.set(null);

  protected pickMore(i: number): void {
    const it = this.moreItems()[i];
    this.closeMore();
    it?.run();
  }

  private key(p: KeyPress): boolean {
    if (this.ask()) return false;
    if (p.id === 'enter') this.edit();
    else if (p.id === 'esc') this.nav.go('home');
    else if (p.id === 'bksp') this.menu(3);
    else return false;
    return true;
  }

  private rocker(d: RockerDir): boolean {
    const n = this.list().length;
    if (!n) return true;
    if (d === 'up') this.cursor.update((c) => (c + n - 1) % n);
    if (d === 'down') this.cursor.update((c) => (c + 1) % n);
    if (d === 'right') this.edit();
    return true;
  }
}

/**
 * Program editor (prompt 044): a plain text area over a highlighted copy (the language's own
 * tokenizer). Enter keeps the indentation (two more after BEGIN/THEN/DO …), Tab indents. Menu:
 * Check (jumps to the first error), Tmpl (templates), Find, Indent, Debug, Run. Breakpoints:
 * click the line number. While debugging: Step, Continue, Stop and the variables.
 */
@Component({
  selector: 'app-program-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlotMenu],
  template: `
    <div class="ed" [class.debug]="paused()">
      <div class="code" #scroller>
        <div class="gutter" aria-hidden="true">
          @for (l of lines(); track l) {
            <span
              class="ln"
              [class.bp]="breaks().has(l)"
              [class.at]="paused()?.line === l"
              (click)="toggleBreak(l)"
              >{{ l }}</span
            >
          }
        </div>
        <div class="area">
          <pre
            class="hl"
            aria-hidden="true"
          ><code>@for (s of spans(); track $index) {<span [class]="s.cls">{{ s.text }}</span>}{{ '\\n' }}</code></pre>
          <textarea
            #src
            spellcheck="false"
            autocapitalize="off"
            autocomplete="off"
            [attr.aria-label]="i18n.t('prog.source', { name: name() })"
            [value]="text()"
            (input)="onInput()"
            (keydown)="onKey($event)"
          ></textarea>
        </div>
      </div>
      @if (paused(); as p) {
        <div class="vars" tabindex="0" role="region" [attr.aria-label]="i18n.t('prog.vars')">
          <span class="at">{{ p.snapshot.function }} · {{ i18n.t('prog.line') }} {{ p.line }}</span>
          @for (v of vars(); track v.name) {
            <span class="v"
              ><b>{{ v.name }}</b> = {{ v.value }}</span
            >
          }
        </div>
      }
      @if (find()) {
        <div class="find">
          <label
            >{{ i18n.t('prog.find') }}
            <input
              #findIn
              type="text"
              spellcheck="false"
              (keydown.enter)="doFind()"
              (keydown.escape)="find.set(false)"
          /></label>
          <label
            >{{ i18n.t('prog.replace') }}
            <input
              #replaceIn
              type="text"
              spellcheck="false"
              (keydown.enter)="doReplace()"
              (keydown.escape)="find.set(false)"
          /></label>
        </div>
      }
      <p class="status" role="status">{{ status() }}</p>
      @if (tmpl() !== null) {
        <app-plot-menu
          [title]="i18n.t('prog.tmpl')"
          [items]="tmplItems"
          [cursor]="tmpl()!"
          (pick)="pickTmpl($event)"
        />
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .ed {
      position: relative;
      display: grid;
      grid-template-rows: minmax(0, 1fr) auto auto auto;
      height: 100%;
      font-size: 3.4cqw;
    }
    .code {
      display: flex;
      overflow: auto;
      min-height: 0;
      background: var(--lcd-bg);
    }
    .gutter {
      display: flex;
      flex-direction: column;
      padding: 0.2em 0;
      background: var(--lcd-head);
      color: var(--lcd-muted);
      text-align: right;
      user-select: none;
    }
    .ln {
      padding: 0 0.3em 0 0.6em;
      line-height: 1.35;
      font-family: var(--font-mono);
      cursor: pointer;
      white-space: pre;
    }
    .ln.bp {
      background: #b42318;
      color: #fff;
    }
    .ln.at {
      outline: 2px solid var(--lcd-accent);
    }
    .area {
      position: relative;
      flex: 1;
      min-width: 0;
    }
    .hl,
    textarea {
      margin: 0;
      padding: 0.2em 0.4em;
      border: 0;
      font: inherit;
      font-family: var(--font-mono);
      line-height: 1.35;
      white-space: pre;
      tab-size: 2;
    }
    .hl {
      pointer-events: none;
      color: var(--lcd-text);
      min-height: 100%;
      box-sizing: border-box;
    }
    textarea {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      resize: none;
      overflow: hidden;
      background: transparent;
      color: transparent;
      caret-color: var(--lcd-text);
      outline: none;
    }
    .kw {
      color: #d19bf0;
      font-weight: 600;
    }
    .num {
      color: #6fd3e0;
    }
    .str {
      color: #f2b866;
    }
    .cmt {
      color: var(--lcd-muted);
      font-style: italic;
    }
    .bad {
      color: var(--lcd-error);
      text-decoration: underline wavy;
    }
    .vars {
      display: flex;
      flex-wrap: wrap;
      gap: 0.2em 0.8em;
      max-height: 22cqw;
      overflow: auto;
      padding: 0.2em 0.4em;
      border-top: 2px solid var(--lcd-accent);
      background: var(--lcd-cur-soft);
    }
    .vars .at {
      font-weight: 600;
    }
    .find {
      display: flex;
      gap: 0.5em;
      padding: 0.2em 0.4em;
      border-top: 1px solid var(--lcd-line);
      background: var(--lcd-bg);
    }
    .find input {
      font: inherit;
      width: 7em;
    }
    .status {
      margin: 0;
      padding: 0.05em 0.4em;
      border-top: 1px solid var(--lcd-line);
      background: var(--lcd-bg);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
})
export class ProgramEditor implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  private readonly store = inject(ProgramStore);
  private readonly runner = inject(ProgramRunner);
  private readonly device = inject(DeviceStore);
  private readonly nav = inject(NavStore);
  private readonly srcEl = viewChild<ElementRef<HTMLTextAreaElement>>('src');
  private readonly findEl = viewChild<ElementRef<HTMLInputElement>>('findIn');
  private readonly replaceEl = viewChild<ElementRef<HTMLInputElement>>('replaceIn');

  protected readonly name = computed(() => this.nav.param());
  protected readonly text = signal('');
  protected readonly tmpl = signal<number | null>(null);
  protected readonly find = signal(false);
  private readonly message = signal<string | null>(null);
  private readonly caretLine = signal(1);
  protected readonly tmplItems: PlotMenuItem[] = TEMPLATES.map((t) => ({
    label: t.label,
    run: () => this.insertTmpl(t),
  }));
  private pop: (() => void) | null = null;
  private popDebug: (() => void) | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly spans = computed(() => highlight(this.text()));
  protected readonly lines = computed(() =>
    Array.from({ length: this.text().split('\n').length }, (_, i) => i + 1),
  );
  protected readonly breaks = computed(
    () => this.runner.breakpoints().get(this.name()) ?? new Set<number>(),
  );
  protected readonly paused = computed(() => {
    const p = this.runner.paused();
    return p && p.program === this.name() ? p : null;
  });
  protected readonly vars = computed(() =>
    Object.entries(this.paused()?.snapshot.locals ?? {}).map(([name, v]) => ({
      name,
      value: formatPpl(v),
    })),
  );
  private readonly error = computed(
    () => this.store.compiled().find((c) => c.doc.name === this.name())?.error ?? null,
  );
  protected readonly status = computed(() => {
    const m = this.message();
    if (m) return m;
    const e = this.error();
    if (e) return `${this.i18n.t('prog.error')} ${e.line}:${e.column} – ${e.message}`;
    return `${this.i18n.t('prog.line')} ${this.caretLine()} · ${this.i18n.t('prog.ok')}`;
  });

  constructor() {
    // the text area grows with the text, the highlighted copy shows through
    afterRenderEffect(() => {
      this.text();
      const ta = this.srcEl()?.nativeElement;
      if (ta)
        ta.style.height = `${Math.max(ta.scrollHeight, ta.parentElement?.clientHeight ?? 0)}px`;
    });
  }

  ngOnInit(): void {
    this.text.set(this.store.get(this.name())?.source ?? '');
    // an error of the last run in this program: put the cursor there
    const last = this.runner.lastError();
    this.pop = this.device.push({
      id: 'program-editor',
      title: () => `${this.name()}${this.runner.running() ? ' ▶' : ''}`,
      menu: () => [
        { label: this.i18n.t('prog.check') },
        { label: this.i18n.t('prog.tmpl') },
        { label: this.i18n.t('prog.find') },
        { label: this.i18n.t('prog.indent') },
        { label: this.i18n.t('prog.debug') },
        { label: this.i18n.t('prog.run') },
      ],
      key: (p) => this.key(p),
      menuPress: (i) => this.menu(i),
      rocker: (d) => this.rocker(d),
      insert: (_l, text) => this.insertText(text),
      help: 'programs',
    });
    queueMicrotask(() => {
      const ta = this.srcEl()?.nativeElement;
      if (!ta) return;
      ta.focus();
      if (last && last.program === this.name()) {
        this.jump(last.error.line, last.error.column);
        this.message.set(
          `${this.i18n.t('prog.error')} ${last.error.line}:${last.error.column} – ${last.error.message}`,
        );
      } else ta.setSelectionRange(0, 0);
    });
  }

  ngOnDestroy(): void {
    this.flush();
    this.pop?.();
    this.popDebug?.();
  }

  protected onInput(): void {
    const ta = this.srcEl()?.nativeElement;
    if (!ta) return;
    this.text.set(ta.value);
    this.message.set(null);
    this.caretLine.set(lineOf(ta.value, ta.selectionStart));
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), 400);
  }

  private flush(): void {
    clearTimeout(this.saveTimer);
    const name = this.name();
    if (name && this.store.get(name) && this.store.get(name)!.source !== this.text())
      this.store.put(name, this.text());
  }

  /** Replaces the selection (or inserts at the cursor) and keeps the state in sync. */
  private replace(text: string, from?: number, to?: number): void {
    const ta = this.srcEl()?.nativeElement;
    if (!ta) return;
    ta.focus();
    ta.setRangeText(text, from ?? ta.selectionStart, to ?? ta.selectionEnd, 'end');
    this.onInput();
  }

  private insertText(text: string): void {
    this.replace(text);
  }

  protected onKey(e: KeyboardEvent): void {
    const ta = e.target as HTMLTextAreaElement;
    if (e.key === 'Tab' && !e.altKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      this.replace('  ');
    } else if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      const start = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
      this.replace(`\n${indentAfter(ta.value.slice(start, ta.selectionStart))}`);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (this.find()) this.find.set(false);
      else this.close();
    }
    queueMicrotask(() => this.caretLine.set(lineOf(ta.value, ta.selectionStart)));
  }

  private close(): void {
    this.flush();
    this.nav.go('programs');
  }

  private jump(line: number, column: number): void {
    const ta = this.srcEl()?.nativeElement;
    if (!ta) return;
    const at = offsetOf(this.text(), line, column);
    ta.focus();
    ta.setSelectionRange(at, at);
    this.caretLine.set(line);
    // scroll the line into view (line height ≈ 1.35em)
    const sc = ta.closest('.code') as HTMLElement | null;
    if (sc) {
      const lh = parseFloat(getComputedStyle(ta).lineHeight) || 18;
      sc.scrollTop = Math.max(0, (line - 3) * lh);
    }
  }

  protected toggleBreak(line: number): void {
    this.runner.toggleBreakpoint(this.name(), line);
  }

  private menu(i: number): void {
    this.message.set(null);
    this.flush();
    if (i === 0) {
      const e = this.error();
      if (e) this.jump(e.line, e.column);
      this.message.set(
        e
          ? `${this.i18n.t('prog.error')} ${e.line}:${e.column} – ${e.message}`
          : this.i18n.t('prog.noErrors'),
      );
    }
    if (i === 1) this.openTmpl();
    if (i === 2) {
      this.find.set(true);
      queueMicrotask(() => this.findEl()?.nativeElement.focus());
    }
    if (i === 3) {
      const ta = this.srcEl()?.nativeElement;
      const next = reindent(this.text());
      if (ta) {
        ta.value = next;
        this.onInput();
      }
    }
    if (i === 4) void this.run(this.breaks().size ? 'breakpoints' : 'step');
    if (i === 5) void this.run('off');
  }

  private async run(debug: 'off' | 'step' | 'breakpoints'): Promise<void> {
    const c = this.store.compiled().find((x) => x.doc.name === this.name());
    if (c?.error) {
      this.jump(c.error.line, c.error.column);
      this.message.set(
        `${this.i18n.t('prog.error')} ${c.error.line}:${c.error.column} – ${c.error.message}`,
      );
      return;
    }
    const e = c?.program?.exports[0];
    if (!e) {
      this.message.set(this.i18n.t('prog.noExport'));
      return;
    }
    if (debug !== 'off') this.openDebug();
    const started = this.runner.start(e.name, debug);
    const ok = await started;
    this.closeDebug();
    if (!ok) return;
    const err = this.runner.lastError();
    if (err && err.program === this.name()) {
      this.jump(err.error.line, err.error.column);
      this.message.set(
        `${this.i18n.t('prog.error')} ${err.error.line}:${err.error.column} – ${err.error.message}`,
      );
      return;
    }
    if (debug === 'off')
      this.nav.go(this.runner.terminal().length || this.runner.drew() ? 'terminal' : 'home');
    else this.message.set(this.i18n.t('prog.done'));
  }

  /** Debugger menu while a debugged run is active. */
  private openDebug(): void {
    this.popDebug = this.device.push({
      id: 'program-debug',
      title: () => `${this.name()} – ${this.i18n.t('prog.debug')}`,
      menu: () => [
        { label: this.i18n.t('prog.step') },
        { label: this.i18n.t('prog.continue') },
        { label: '' },
        { label: '' },
        { label: this.i18n.t('prog.terminal') },
        { label: this.i18n.t('prog.stop') },
      ],
      key: (p) => {
        if (p.id === 'enter') this.runner.continueRun(true);
        return true;
      },
      menuPress: (i) => {
        if (i === 0) this.runner.continueRun(true);
        if (i === 1) this.runner.continueRun(false);
        if (i === 4) this.nav.go('terminal');
        if (i === 5) this.runner.cancel();
      },
      rocker: () => true,
      help: 'programs',
    });
  }

  private closeDebug(): void {
    this.popDebug?.();
    this.popDebug = null;
  }

  private openTmpl(): void {
    this.tmpl.set(0);
    const pop = this.device.push({
      id: 'program-tmpl',
      title: () => this.i18n.t('prog.tmpl'),
      menu: () => [
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: 'OK' },
      ],
      key: (p) => {
        if (p.id === 'enter') this.pickTmpl(this.tmpl() ?? 0);
        else if (p.id === 'esc') this.closeTmpl();
        return true;
      },
      menuPress: (i) => {
        if (i === 5) this.pickTmpl(this.tmpl() ?? 0);
      },
      rocker: (d) => {
        const n = this.tmplItems.length;
        const m = this.tmpl() ?? 0;
        if (d === 'up' || d === 'down') this.tmpl.set((m + (d === 'down' ? 1 : n - 1)) % n);
        if (d === 'left') this.closeTmpl();
        return true;
      },
      help: 'programs',
    });
    this.closeTmpl = () => {
      pop();
      this.tmpl.set(null);
    };
  }

  private closeTmpl = () => this.tmpl.set(null);

  protected pickTmpl(i: number): void {
    const it = this.tmplItems[i];
    this.closeTmpl();
    it?.run();
  }

  private insertTmpl(t: (typeof TEMPLATES)[number]): void {
    const ta = this.srcEl()?.nativeElement;
    if (!ta) return;
    const r = insertTemplate(ta.value, ta.selectionStart, t);
    ta.value = r.text;
    ta.focus();
    ta.setSelectionRange(r.cursor, r.cursor);
    this.onInput();
  }

  protected doFind(): void {
    const ta = this.srcEl()?.nativeElement;
    const needle = this.findEl()?.nativeElement.value ?? '';
    if (!ta || !needle) return;
    const at = findNext(ta.value, needle, ta.selectionEnd);
    if (at < 0) {
      this.message.set(this.i18n.t('prog.notFound'));
      return;
    }
    const l = lineOf(ta.value, at);
    this.jump(l, at - offsetOf(ta.value, l, 1) + 1);
    ta.setSelectionRange(at, at + needle.length);
  }

  protected doReplace(): void {
    const ta = this.srcEl()?.nativeElement;
    const needle = this.findEl()?.nativeElement.value ?? '';
    const by = this.replaceEl()?.nativeElement.value ?? '';
    if (!ta || !needle) return;
    const r = replaceAll(ta.value, needle, by);
    ta.value = r.text;
    this.onInput();
    this.message.set(this.i18n.t('prog.replaced', { n: r.count }));
  }

  /** Device keys (the textarea has the focus for the hardware keyboard). */
  private key(p: KeyPress): boolean {
    if (p.id === 'esc') {
      this.close();
      return true;
    }
    if (p.id === 'enter') {
      const ta = this.srcEl()?.nativeElement;
      if (!ta) return true;
      const start = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
      this.replace(`\n${indentAfter(ta.value.slice(start, ta.selectionStart))}`);
      return true;
    }
    if (p.id === 'bksp') {
      const ta = this.srcEl()?.nativeElement;
      if (ta && (ta.selectionStart > 0 || ta.selectionEnd > 0)) {
        const from =
          ta.selectionStart === ta.selectionEnd ? ta.selectionStart - 1 : ta.selectionStart;
        this.replace('', from, ta.selectionEnd);
      }
      return true;
    }
    const a = editFor(p);
    if (a?.kind === 'insert') {
      this.insertText(a.text);
      return true;
    }
    return false;
  }

  private rocker(d: RockerDir): boolean {
    const ta = this.srcEl()?.nativeElement;
    if (!ta) return true;
    const v = ta.value;
    let at = ta.selectionStart;
    if (d === 'left') at = Math.max(0, at - 1);
    if (d === 'right') at = Math.min(v.length, at + 1);
    if (d === 'up' || d === 'down') {
      const line = lineOf(v, at);
      const col = at - offsetOf(v, line, 1) + 1;
      const next = d === 'up' ? Math.max(1, line - 1) : Math.min(this.lines().length, line + 1);
      at = offsetOf(v, next, col);
    }
    ta.focus();
    ta.setSelectionRange(at, at);
    this.caretLine.set(lineOf(v, at));
    return true;
  }
}

/** Terminal (prompt 043): what programs PRINT, or the graphics screen G0 when they drew. */
@Component({
  selector: 'app-terminal-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="term" tabindex="0" role="region" [attr.aria-label]="i18n.t('prog.terminal')">
      @if (showGraphics()) {
        <canvas #screen width="320" height="240" [attr.aria-label]="i18n.t('prog.screen')"></canvas>
      } @else {
        <pre #out>{{ text() }}</pre>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .term {
      height: 100%;
      overflow: auto;
      background: var(--lcd-bg);
    }
    pre {
      margin: 0;
      padding: 0.3em 0.5em;
      font-size: 3.6cqw;
      white-space: pre-wrap;
      word-break: break-word;
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      image-rendering: pixelated;
    }
  `,
})
export class TerminalView implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  private readonly runner = inject(ProgramRunner);
  private readonly device = inject(DeviceStore);
  private readonly nav = inject(NavStore);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('screen');
  private readonly out = viewChild<ElementRef<HTMLPreElement>>('out');
  private readonly graphics = signal(false);
  protected readonly text = computed(() => this.runner.terminal().join('\n'));
  protected readonly showGraphics = computed(() => this.graphics());
  private pop: (() => void) | null = null;

  constructor() {
    afterRenderEffect(() => {
      this.runner.screenVersion();
      const c = this.canvas()?.nativeElement;
      const src = this.runner.screens[0];
      if (c && src) c.getContext('2d')?.drawImage(src, 0, 0);
      const o = this.out()?.nativeElement.parentElement;
      this.text();
      if (o) o.scrollTop = o.scrollHeight;
    });
  }

  ngOnInit(): void {
    this.graphics.set(this.runner.drew() && !this.runner.terminal().length);
    this.pop = this.device.push({
      id: 'terminal',
      title: () =>
        this.runner.running()
          ? `${this.runner.running()} ▶ (On = ${this.i18n.t('prog.stop')})`
          : this.i18n.t('prog.terminal'),
      menu: () => [
        { label: this.i18n.t('prog.clear') },
        { label: 'G0', active: this.graphics() },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: 'OK' },
      ],
      key: (p) => {
        if (p.id === 'esc' || p.id === 'enter') this.nav.go('home');
        else return false;
        return true;
      },
      menuPress: (i) => {
        if (i === 0) this.runner.clearTerminal();
        if (i === 1) this.graphics.update((g) => !g);
        if (i === 5) this.nav.go('home');
      },
      rocker: () => true,
      help: 'programs',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }
}

/** Dialogs of a running program: MSGBOX, INPUT, CHOOSE. */
@Component({
  selector: 'app-program-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal],
  template: `
    @if (runner.dialog(); as d) {
      @switch (d.kind) {
        @case ('msgbox') {
          <app-modal [heading]="runner.running() ?? ''" (closed)="d.done()">
            <p class="msg">{{ d.text }}</p>
            <div class="dialog-actions">
              <button type="button" class="btn primary" (click)="d.done()">OK</button>
            </div>
          </app-modal>
        }
        @case ('input') {
          <app-modal [heading]="d.title || (runner.running() ?? '')" (closed)="d.done(null)">
            <form (submit)="$event.preventDefault(); submit()">
              @for (f of d.fields; track f.name; let i = $index) {
                <label class="field">
                  <span>{{ f.label || f.name }}</span>
                  <input
                    #field
                    type="text"
                    spellcheck="false"
                    autocomplete="off"
                    [value]="initial(f.value)"
                  />
                  @if (f.help) {
                    <small>{{ f.help }}</small>
                  }
                </label>
              }
              <div class="dialog-actions">
                <button type="button" class="btn" (click)="d.done(null)">
                  {{ i18n.t('backup.cancel') }}
                </button>
                <button type="submit" class="btn primary">OK</button>
              </div>
            </form>
          </app-modal>
        }
        @case ('choose') {
          <app-modal [heading]="d.title || (runner.running() ?? '')" (closed)="d.done(0)">
            <div class="choices">
              @for (it of d.items; track $index; let i = $index) {
                <button type="button" class="btn" (click)="d.done(i + 1)">{{ it }}</button>
              }
            </div>
          </app-modal>
        }
      }
    }
  `,
  styles: `
    .msg {
      white-space: pre-wrap;
    }
    .field {
      display: grid;
      gap: 0.2em;
      margin-bottom: 0.6em;
    }
    .field input {
      font: inherit;
      padding: 0.2em 0.4em;
    }
    .choices {
      display: grid;
      gap: 0.4em;
    }
  `,
})
export class ProgramDialogView {
  protected readonly runner = inject(ProgramRunner);
  protected readonly i18n = inject(I18n);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected initial(v: PplValue): string {
    if (v.kind === 'string') return v.s;
    return v.kind === 'real' && v.v !== 0 ? String(v.v) : '';
  }

  protected submit(): void {
    const d = this.runner.dialog();
    if (d?.kind !== 'input') return;
    const inputs = [
      ...(this.host.nativeElement as HTMLElement).ownerDocument.querySelectorAll<HTMLInputElement>(
        'app-program-dialog .field input',
      ),
    ];
    d.done(inputs.map((i) => i.value));
  }
}
