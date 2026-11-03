import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { parseText } from '@aba/math/parser/text-parser';
import { evaluateValue } from '@aba/math/value/evaluate-value';
import { formatReal } from '@aba/math/value/format';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { DeviceStore, type RockerDir } from '../../core/device/device-store';
import type { MenuButton } from '../../features/device/t1-device';
import { editFor } from '../../features/home/home-keys';
import { HomeStore } from '../../features/home/home-store';

/** A number field; an empty entry sets null (unknown / not given). */
export interface FormNumber {
  kind?: 'number';
  label: string;
  value: () => number | null;
  set: (v: number | null) => string | null;
  /** shown as a computed result (not typed by the user) */
  computed?: () => boolean;
  /** marked (e.g. an unknown of the solver) */
  marked?: () => boolean;
}

/** A free text field (dates …). */
export interface FormText {
  kind: 'text';
  label: string;
  text: () => string;
  setText: (s: string) => string | null;
}

export interface FormChoice {
  kind: 'choice';
  label: string;
  choices: { value: string; label: string }[];
  value: () => string;
  set: (v: string) => void;
}

/** A read-only result line. */
export interface FormOutput {
  kind: 'output';
  label: string;
  output: () => string;
}

export type FormItem = FormNumber | FormText | FormChoice | FormOutput;

const plain = (x: number) => formatReal(x, { mode: 'standard', digits: 0, decimal: '.' });

/**
 * Input form of the solver apps (prompt 039): number, text and choice fields plus result lines.
 * ↑↓ (or the arrow keys in a field) choose a row, typing replaces the value, Enter stores it (any
 * expression, e.g. 30*12 or 2π), ←→/Enter cycle a choice. The menu comes from the owning view;
 * `menuPress` gets the index of the current row.
 */
@Component({
  selector: 'app-field-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="form" role="group" [attr.aria-label]="title()">
      @for (f of items(); track f.label; let i = $index) {
        <div class="row" [class.cur]="cursor() === i">
          <span class="lbl">
            @if (marked(f)) {
              <span class="mark" aria-hidden="true">●</span>
            }
            {{ f.label }}
          </span>
          @switch (f.kind) {
            @case ('choice') {
              <select
                [attr.aria-label]="f.label"
                [value]="ch(f).value()"
                (focus)="cursor.set(i)"
                (keydown.arrowup)="move(-1, $event)"
                (keydown.arrowdown)="move(1, $event)"
                (change)="ch(f).set($any($event.target).value)"
              >
                @for (o of ch(f).choices; track o.value) {
                  <option [value]="o.value" [selected]="o.value === ch(f).value()">
                    {{ o.label }}
                  </option>
                }
              </select>
            }
            @case ('output') {
              <output [attr.aria-label]="f.label">{{ out(f).output() }}</output>
            }
            @default {
              <input
                type="text"
                spellcheck="false"
                autocomplete="off"
                [class.calc]="isComputed(f)"
                [attr.aria-label]="f.label + (marked(f) ? ' (unknown)' : '')"
                [value]="shown(f)"
                (focus)="cursor.set(i)"
                (keydown.enter)="commit(i, $any($event.target))"
                (keydown.arrowup)="move(-1, $event)"
                (keydown.arrowdown)="move(1, $event)"
              />
            }
          }
        </div>
      }
    </div>
    @if (message() || status()) {
      <p class="msg" [class.err]="!!message()" role="status">{{ message() || status() }}</p>
    }
  `,
  styles: `
    :host {
      display: grid;
      grid-template-rows: 1fr auto;
      height: 100%;
      font-size: 3.9cqw;
    }
    .form {
      overflow-y: auto;
      min-height: 0;
      padding: 0.15em 0.4em;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5em;
      padding: 0.08em 0.3em;
      border-radius: 0.2em;
    }
    .row.cur {
      background: var(--lcd-cur);
    }
    .lbl {
      white-space: nowrap;
      color: var(--lcd-text);
    }
    .mark {
      color: var(--lcd-error);
      font-size: 0.7em;
      vertical-align: middle;
    }
    input,
    select,
    output {
      width: 55%;
      font: inherit;
      text-align: right;
      border: 1px solid var(--lcd-line);
      border-radius: 0.2em;
      background: var(--lcd-bg);
      color: var(--lcd-text);
      box-sizing: border-box;
    }
    output {
      border-color: transparent;
      background: transparent;
      font-variant-numeric: tabular-nums;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    input.calc {
      color: #7cc8f0;
      font-style: italic;
    }
    .msg {
      margin: 0;
      padding: 0.1em 0.5em;
      border-top: 1px solid var(--lcd-line);
      background: var(--lcd-bg);
      font-size: 0.85em;
      color: var(--lcd-text);
    }
    .msg.err {
      color: var(--lcd-error);
    }
  `,
})
export class FieldForm implements OnInit, OnDestroy {
  readonly title = input('');
  readonly help = input('');
  readonly items = input<FormItem[]>([]);
  readonly menu = input<() => MenuButton[]>(() => []);
  readonly menuPress = input<(i: number, cursor: number) => void>(() => undefined);
  /** extra keys of the owning view (before the form's own handling) */
  readonly keys = input<(p: KeyPress, cursor: number) => boolean>(() => false);
  readonly status = input<string | null>(null);
  readonly cursor = signal(0);
  protected readonly message = signal<string | null>(null);
  private readonly home = inject(HomeStore);
  private readonly device = inject(DeviceStore);
  private readonly host = inject(ElementRef<HTMLElement>);
  private pop: (() => void) | null = null;

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'field-form',
      title: () => this.title(),
      menu: () => this.menu()(),
      key: (p) => this.key(p),
      menuPress: (i) => {
        this.commitPending();
        this.message.set(null);
        this.menuPress()(i, this.cursor());
      },
      rocker: (d) => this.rocker(d),
      insert: (_l, text) => this.typeText(text),
      help: this.help(),
    });
    queueMicrotask(() => this.focus());
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  /** Shows an error (or clears it). */
  say(msg: string | null): void {
    this.message.set(msg);
  }

  protected ch(f: FormItem): FormChoice {
    return f as FormChoice;
  }

  protected out(f: FormItem): FormOutput {
    return f as FormOutput;
  }

  protected marked(f: FormItem): boolean {
    return (f.kind === undefined || f.kind === 'number') && !!f.marked?.();
  }

  protected isComputed(f: FormItem): boolean {
    return (f.kind === undefined || f.kind === 'number') && !!f.computed?.();
  }

  protected shown(f: FormItem): string {
    if (f.kind === 'text') return f.text();
    if (f.kind === 'choice' || f.kind === 'output') return '';
    const v = f.value();
    return v === null ? '' : plain(v);
  }

  private row(i: number): HTMLElement | undefined {
    return (this.host.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.row')[i];
  }

  private control(i: number): HTMLInputElement | HTMLSelectElement | null {
    return this.row(i)?.querySelector('input, select') ?? null;
  }

  focus(): void {
    const el = this.control(this.cursor());
    el?.focus();
    if (el instanceof HTMLInputElement) el.select();
    if (!el) this.row(this.cursor())?.scrollIntoView({ block: 'nearest' });
  }

  /** Stores the field under the cursor when its text was edited (before a menu action). */
  private commitPending(): void {
    const el = this.control(this.cursor());
    const f = this.items()[this.cursor()];
    if (!(el instanceof HTMLInputElement) || !f) return;
    if (el.value !== this.shown(f)) this.commit(this.cursor(), el, false);
  }

  protected commit(i: number, el: HTMLInputElement, advance = true): void {
    const f = this.items()[i];
    if (!f || f.kind === 'choice' || f.kind === 'output') return;
    const src = el.value.trim();
    let err: string | null;
    if (f.kind === 'text') {
      err = f.setText(src);
    } else if (!src) {
      err = f.set(null);
    } else {
      const p = parseText(src);
      const r = p.ok ? evaluateValue(p.value, this.home.scope()) : p;
      if (!r.ok || r.value.kind !== 'real') {
        this.message.set(r.ok ? 'a real number is needed' : r.error.message);
        return;
      }
      err = f.set(r.value.v);
    }
    this.message.set(err);
    if (err) return;
    // show the stored value (the input keeps typed text when the bound value did not change)
    queueMicrotask(() => {
      const g = this.items()[i];
      if (g) el.value = this.shown(g);
    });
    if (advance) this.move(1);
  }

  private typeText(text: string): void {
    const el = this.control(this.cursor());
    if (!(el instanceof HTMLInputElement)) return;
    el.setRangeText(
      text,
      el.selectionStart ?? el.value.length,
      el.selectionEnd ?? el.value.length,
      'end',
    );
    el.focus();
  }

  private cycle(step: 1 | -1): boolean {
    const f = this.items()[this.cursor()];
    if (!f || f.kind !== 'choice') return false;
    const k = f.choices.findIndex((c) => c.value === f.value());
    f.set(f.choices[(k + step + f.choices.length) % f.choices.length].value);
    return true;
  }

  private key(p: KeyPress): boolean {
    if (this.keys()(p, this.cursor())) return true;
    if (p.id === 'enter') {
      if (this.cycle(1)) return true;
      const el = this.control(this.cursor());
      if (el instanceof HTMLInputElement) this.commit(this.cursor(), el);
      else this.move(1);
      return true;
    }
    if (p.id === 'bksp' && p.layer === 'main') {
      const el = this.control(this.cursor());
      if (el instanceof HTMLInputElement) {
        const s = el.selectionStart ?? el.value.length;
        const e = el.selectionEnd ?? el.value.length;
        if (s !== e) el.setRangeText('', s, e, 'end');
        else if (s > 0) el.setRangeText('', s - 1, s, 'end');
      }
      return true;
    }
    const a = editFor(p);
    if (a?.kind === 'insert') {
      this.typeText(a.text);
      return true;
    }
    return false;
  }

  move(step: number, e?: Event): void {
    e?.preventDefault();
    const n = this.items().length;
    if (!n) return;
    this.cursor.update((c) => (c + step + n) % n);
    this.focus();
  }

  private rocker(d: RockerDir): boolean {
    if (d === 'up') this.move(-1);
    if (d === 'down') this.move(1);
    if (d === 'left' || d === 'right') {
      if (this.cycle(d === 'right' ? 1 : -1)) return true;
      const el = this.control(this.cursor());
      if (el instanceof HTMLInputElement) {
        const p = Math.max(
          0,
          Math.min(el.value.length, (el.selectionStart ?? 0) + (d === 'right' ? 1 : -1)),
        );
        el.setSelectionRange(p, p);
        el.focus();
      }
    }
    return true;
  }
}
