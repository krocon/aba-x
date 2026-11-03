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
import type { KeyPress } from '../../core/actions/shift-alpha';
import { DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import { editFor } from '../../features/home/home-keys';
import { ProgramRunner } from '../../features/programs/program-runner';
import { offsetOf } from '../../features/programs/editor-logic';
import { AppStore } from '../app-store';
import { PythonRunner } from './python-runner';

export interface PythonScript {
  name: string;
  source: string;
}

export interface PythonState {
  scripts: PythonScript[];
  /** index of the open script, −1 = the list */
  open: number;
  /** earlier shell lines (↑↓) */
  history: string[];
}

const DEMO = `# a few lines to start with
import math
import graphic

graphic.clear()
for k in range(0, 320, 4):
    y = 120 - 80 * math.sin(k / 30)
    graphic.pixel(k, int(y), graphic.rgb(209, 73, 91))
graphic.line(0, 120, 319, 120, 0x5a6c67)
print('sin drawn')
`;

export function initPython(): PythonState {
  return { scripts: [{ name: 'demo', source: DEMO }], open: -1, history: [] };
}

/** Indentation for a new line: the same, four more after a line ending with ':'. */
export function pyIndent(line: string): string {
  const base = /^\s*/.exec(line)?.[0] ?? '';
  return /:\s*(#.*)?$/.test(line) ? `${base}    ` : base;
}

function pythonApp() {
  const apps = inject(AppStore);
  const state = computed(() => apps.current().state as PythonState);
  const update = (f: (s: PythonState) => PythonState) => apps.update<PythonState>(f);
  return { apps, state, update };
}

/**
 * Python shell (prompt 047, Num): a line is run like in a REPL (the value of an expression is
 * shown), ↑↓ recall earlier lines; On stops a running program.
 */
@Component({
  selector: 'app-python-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">
      <pre
        #out
        class="out"
        tabindex="0"
        role="log"
        [attr.aria-label]="i18n.t('py.shell')"
      >@for (l of runner.output(); track $index) {<span [class.err]="l.err" [class.in]="l.input">{{ l.text }}{{ '\\n' }}</span>}</pre>
      <label class="line">
        <span aria-hidden="true">&gt;&gt;&gt;</span>
        <input
          #line
          type="text"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          [attr.aria-label]="i18n.t('py.input')"
          (keydown)="lineKey($event)"
        />
      </label>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .shell {
      display: grid;
      grid-template-rows: minmax(0, 1fr) auto;
      height: 100%;
      font-size: 3.6cqw;
      background: #fff;
    }
    .out {
      margin: 0;
      padding: 0.2em 0.4em;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: var(--font-mono);
    }
    .err {
      color: #b42318;
    }
    .in {
      color: #3d514c;
    }
    .line {
      display: flex;
      gap: 0.4em;
      align-items: center;
      padding: 0.1em 0.4em;
      border-top: 2px solid #1b3533;
      font-family: var(--font-mono);
    }
    .line input {
      flex: 1;
      border: 0;
      font: inherit;
      outline: none;
    }
  `,
})
export class PythonShell implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  protected readonly runner = inject(PythonRunner);
  private readonly app = pythonApp();
  private readonly device = inject(DeviceStore);
  private readonly lineEl = viewChild<ElementRef<HTMLInputElement>>('line');
  private readonly outEl = viewChild<ElementRef<HTMLPreElement>>('out');
  private back = -1;
  private pop: (() => void) | null = null;

  constructor() {
    afterRenderEffect(() => {
      this.runner.output();
      const o = this.outEl()?.nativeElement;
      if (o) o.scrollTop = o.scrollHeight;
    });
  }

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'python-shell',
      title: () => `${this.i18n.t('py.shell')}${this.runner.running() ? ' ▶' : ''}`,
      menu: () => [
        { label: this.i18n.t('prog.clear') },
        { label: this.i18n.t('prog.stop') },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
      ],
      key: (p) => this.key(p),
      menuPress: (i) => {
        if (i === 0) this.runner.clear();
        if (i === 1) this.runner.cancel();
      },
      rocker: (d) => this.rocker(d),
      insert: (_l, text) => this.insert(text),
      help: 'python',
    });
    queueMicrotask(() => this.lineEl()?.nativeElement.focus());
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  private insert(text: string): void {
    const el = this.lineEl()?.nativeElement;
    if (!el) return;
    el.setRangeText(
      text,
      el.selectionStart ?? el.value.length,
      el.selectionEnd ?? el.value.length,
      'end',
    );
    el.focus();
  }

  /** lines typed while Python runs wait here and run in order */
  private queue: string[] = [];
  private draining = false;

  private async submit(): Promise<void> {
    const el = this.lineEl()?.nativeElement;
    const src = el?.value ?? '';
    if (!el || !src.trim()) return;
    el.value = '';
    this.back = -1;
    this.app.update((s) => ({ ...s, history: [...s.history, src].slice(-50) }));
    this.queue.push(src);
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length) {
        const line = this.queue.shift()!;
        this.runner.print(`>>> ${line}`, false, true);
        await this.runner.run(line, 'shell');
      }
    } finally {
      this.draining = false;
    }
  }

  private recall(step: 1 | -1): void {
    const h = this.app.state().history;
    if (!h.length) return;
    this.back = Math.max(-1, Math.min(h.length - 1, this.back + step));
    const el = this.lineEl()?.nativeElement;
    if (el) el.value = this.back < 0 ? '' : h[h.length - 1 - this.back];
  }

  protected lineKey(e: KeyboardEvent): void {
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      void this.submit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.recall(1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.recall(-1);
    }
  }

  private key(p: KeyPress): boolean {
    const el = this.lineEl()?.nativeElement;
    if (p.id === 'enter') void this.submit();
    else if (p.id === 'bksp' && el) el.value = el.value.slice(0, -1);
    else if (p.id === 'esc' && el) el.value = '';
    else {
      const a = editFor(p);
      if (a?.kind !== 'insert') return false;
      this.insert(a.text);
    }
    return true;
  }

  private rocker(d: RockerDir): boolean {
    if (d === 'up') this.recall(1);
    if (d === 'down') this.recall(-1);
    return true;
  }
}

/** Scripts (prompt 047, Symb): the list (Edit, New, Delete, Run) and a plain editor. */
@Component({
  selector: 'app-python-scripts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (openScript(); as s) {
      <div class="ed">
        <textarea
          #src
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
          [attr.aria-label]="i18n.t('prog.source', { name: s.name })"
          [value]="s.source"
          (input)="edited()"
          (keydown)="editKey($event)"
        ></textarea>
        <p class="status" role="status">{{ message() ?? s.name + '.py' }}</p>
      </div>
    } @else {
      <ul class="list" [attr.aria-label]="i18n.t('py.scripts')">
        @for (s of app.state().scripts; track s.name; let i = $index) {
          <li
            tabindex="-1"
            [class.cur]="cursor() === i"
            [attr.aria-current]="cursor() === i ? 'true' : null"
            (click)="cursor() === i ? edit() : cursor.set(i)"
            (keydown.enter)="edit()"
          >
            {{ s.name }}.py
          </li>
        }
      </ul>
      @if (asking()) {
        <label class="ask"
          >{{ i18n.t('prog.newName') }}
          <input
            #name
            type="text"
            spellcheck="false"
            (keydown.enter)="create()"
            (keydown.escape)="asking.set(false)"
        /></label>
      }
    }
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      position: relative;
      font-size: 3.8cqw;
    }
    .list {
      margin: 0;
      padding: 0;
      list-style: none;
      height: 100%;
      overflow-y: auto;
    }
    li {
      padding: 0.15em 0.5em;
      border-bottom: 1px solid #dde4df;
      cursor: pointer;
      font-family: var(--font-mono);
    }
    li.cur {
      background: #ffe2d8;
    }
    .ed {
      display: grid;
      grid-template-rows: minmax(0, 1fr) auto;
      height: 100%;
    }
    textarea {
      border: 0;
      padding: 0.2em 0.4em;
      font: inherit;
      font-family: var(--font-mono);
      font-size: 0.9em;
      resize: none;
      white-space: pre;
      outline: none;
      tab-size: 4;
    }
    .status {
      margin: 0;
      padding: 0.05em 0.4em;
      border-top: 1px solid #dde4df;
      background: #fff;
    }
    .ask {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 0.3em 0.5em;
      background: #fff;
      border-top: 2px solid #1b3533;
    }
    .ask input {
      font: inherit;
      width: 40%;
    }
  `,
})
export class PythonScripts implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  protected readonly app = pythonApp();
  private readonly runner = inject(PythonRunner);
  private readonly programs = inject(ProgramRunner);
  private readonly device = inject(DeviceStore);
  private readonly srcEl = viewChild<ElementRef<HTMLTextAreaElement>>('src');
  private readonly nameEl = viewChild<ElementRef<HTMLInputElement>>('name');
  protected readonly cursor = signal(0);
  protected readonly asking = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly openScript = computed(() => {
    const s = this.app.state();
    return s.open >= 0 ? (s.scripts[s.open] ?? null) : null;
  });
  private pop: (() => void) | null = null;

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'python-scripts',
      title: () => this.i18n.t('py.scripts'),
      menu: () =>
        this.openScript()
          ? [
              { label: this.i18n.t('prog.run') },
              { label: '' },
              { label: '' },
              { label: '' },
              { label: '' },
              { label: 'OK' },
            ]
          : [
              { label: this.i18n.t('data.edit') },
              { label: this.i18n.t('prog.new') },
              { label: this.i18n.t('data.delete') },
              { label: '' },
              { label: '' },
              { label: this.i18n.t('prog.run') },
            ],
      key: (p) => this.key(p),
      menuPress: (i) => this.menu(i),
      rocker: (d) => this.rocker(d),
      insert: (_l, text) => this.insert(text),
      help: 'python',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  protected edit(): void {
    const i = this.cursor();
    if (!this.app.state().scripts[i]) return;
    this.app.update((s) => ({ ...s, open: i }));
    this.message.set(null);
    queueMicrotask(() => this.srcEl()?.nativeElement.focus());
  }

  private close(): void {
    this.app.update((s) => ({ ...s, open: -1 }));
  }

  protected edited(): void {
    const v = this.srcEl()?.nativeElement.value ?? '';
    const k = this.app.state().open;
    this.message.set(null);
    this.app.update((s) => ({
      ...s,
      scripts: s.scripts.map((x, i) => (i === k ? { ...x, source: v } : x)),
    }));
  }

  protected create(): void {
    const name = (this.nameEl()?.nativeElement.value ?? '').trim();
    if (
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ||
      this.app.state().scripts.some((s) => s.name === name)
    )
      return;
    this.asking.set(false);
    this.app.update((s) => ({ ...s, scripts: [...s.scripts, { name, source: '' }] }));
    this.cursor.set(this.app.state().scripts.length - 1);
    this.edit();
  }

  private menu(i: number): void {
    if (this.openScript()) {
      if (i === 0) void this.run();
      if (i === 5) this.close();
      return;
    }
    if (i === 0) this.edit();
    if (i === 1) {
      this.asking.set(true);
      queueMicrotask(() => this.nameEl()?.nativeElement.focus());
    }
    if (i === 2) {
      const k = this.cursor();
      this.app.update((s) => ({ ...s, scripts: s.scripts.filter((_, j) => j !== k) }));
      this.cursor.update((c) => Math.max(0, c - 1));
    }
    if (i === 5) void this.run();
  }

  /** Runs the open (or selected) script; an error puts the cursor on its line. */
  private async run(): Promise<void> {
    const s = this.openScript() ?? this.app.state().scripts[this.cursor()];
    if (!s) return;
    this.runner.print(`>>> run ${s.name}.py`, false, true);
    const r = await this.runner.run(s.source, 'script');
    if (!r.ok && r.line && this.openScript()) {
      const ta = this.srcEl()?.nativeElement;
      if (ta) {
        const at = offsetOf(ta.value, r.line, 1);
        ta.focus();
        ta.setSelectionRange(
          at,
          ta.value.indexOf('\n', at) < 0 ? ta.value.length : ta.value.indexOf('\n', at),
        );
      }
      this.message.set(`${this.i18n.t('prog.line')} ${r.line}: ${r.error}`);
      return;
    }
    this.app.apps.show(this.runner.drew() || this.programs.drew() ? 'plot' : 'num');
  }

  private insert(text: string): void {
    const ta = this.srcEl()?.nativeElement;
    if (!ta) return;
    ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
    ta.focus();
    this.edited();
  }

  protected editKey(e: KeyboardEvent): void {
    const ta = e.target as HTMLTextAreaElement;
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      this.insert('    ');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const start = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
      this.insert(`\n${pyIndent(ta.value.slice(start, ta.selectionStart))}`);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
    }
  }

  private key(p: KeyPress): boolean {
    if (this.asking()) return false;
    if (this.openScript()) {
      if (p.id === 'esc') this.close();
      else if (p.id === 'enter') {
        const ta = this.srcEl()?.nativeElement;
        if (!ta) return true;
        const start = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
        this.insert(`\n${pyIndent(ta.value.slice(start, ta.selectionStart))}`);
      } else {
        const a = editFor(p);
        if (a?.kind !== 'insert') return false;
        this.insert(a.text);
      }
      return true;
    }
    if (p.id === 'enter') this.edit();
    else return false;
    return true;
  }

  private rocker(d: RockerDir): boolean {
    if (this.openScript()) return false;
    const n = this.app.state().scripts.length;
    if (!n) return true;
    if (d === 'up') this.cursor.update((c) => (c + n - 1) % n);
    if (d === 'down') this.cursor.update((c) => (c + 1) % n);
    return true;
  }
}

/** Plot: the screen G0 that Python's `graphic` module draws on. */
@Component({
  selector: 'app-python-plot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas
    #screen
    width="320"
    height="240"
    [attr.aria-label]="i18n.t('prog.screen')"
  ></canvas>`,
  styles: `
    :host {
      display: block;
      height: 100%;
      background: #fff;
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
export class PythonPlot implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  private readonly programs = inject(ProgramRunner);
  private readonly device = inject(DeviceStore);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('screen');
  private pop: (() => void) | null = null;

  constructor() {
    afterRenderEffect(() => {
      this.programs.screenVersion();
      const c = this.canvas()?.nativeElement;
      const src = this.programs.screen(0);
      if (c && src) c.getContext('2d')?.drawImage(src, 0, 0);
    });
  }

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'python-plot',
      title: () => 'G0',
      menu: () => [
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
      ],
      help: 'python',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }
}
