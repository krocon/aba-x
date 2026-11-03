import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { parseText } from '@aba/math/parser/text-parser';
import { evaluateValue } from '@aba/math/value/evaluate-value';
import { formatReal } from '@aba/math/value/format';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { DeviceStore, type RockerDir } from '../../core/device/device-store';
import { editFor } from '../../features/home/home-keys';
import { HomeStore } from '../../features/home/home-store';

export interface SetupField {
  label: string;
  value: () => number;
  set: (v: number) => string | null;
}

/** A choice (checkbox-like on/off or a few options) instead of a number. */
export interface SetupChoice {
  label: string;
  choices: { value: string; label: string }[];
  value: () => string;
  set: (v: string) => void;
}

export type SetupItem = SetupField | SetupChoice;

const isChoice = (f: SetupItem): f is SetupChoice => 'choices' in f;

/**
 * Setup view of an app (prompt 033): number fields. ↑↓ choose a field, typing replaces its value,
 * Enter stores it (any expression, e.g. 2π), Esc leaves the setup.
 */
@Component({
  selector: 'app-setup-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="form">
      @for (f of fields(); track f.label; let i = $index) {
        <div class="row" [class.cur]="cursor() === i">
          <span>{{ f.label }}</span>
          @if (choice(f); as c) {
            <select
              [attr.aria-label]="f.label"
              [value]="c.value()"
              (focus)="cursor.set(i)"
              (change)="c.set($any($event.target).value)"
            >
              @for (o of c.choices; track o.value) {
                <option [value]="o.value" [selected]="o.value === c.value()">{{ o.label }}</option>
              }
            </select>
          } @else {
            <input
              type="text"
              spellcheck="false"
              [attr.aria-label]="f.label"
              [value]="show(num(f).value())"
              (focus)="cursor.set(i)"
              (keydown.enter)="commit(i, $any($event.target).value)"
            />
          }
        </div>
      }
      @if (message()) {
        <p class="msg" role="alert">{{ message() }}</p>
      }
    </div>
  `,
  styles: `
    .form {
      padding: 0.3em 0.5em;
      font-size: 4.2cqw;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5em;
      padding: 0.15em 0.3em;
      border-radius: 0.2em;
    }
    .row.cur {
      background: #ffe2d8;
    }
    input,
    select {
      width: 45%;
      font: inherit;
      text-align: right;
      border: 1px solid #c9d5d1;
      border-radius: 0.2em;
      background: #fff;
    }
    .msg {
      color: #b42318;
      margin: 0.3em 0 0;
      font-size: 0.85em;
    }
  `,
})
export class SetupForm implements OnInit, OnDestroy {
  readonly title = input('Setup');
  readonly fields = input<SetupItem[]>([]);
  readonly close = input<() => void>(() => undefined);
  private readonly home = inject(HomeStore);
  private readonly device = inject(DeviceStore);
  private readonly host = inject(ElementRef<HTMLElement>);
  protected readonly cursor = signal(0);
  protected readonly message = signal<string | null>(null);
  private readonly dummy = viewChild<ElementRef>('none');
  private pop: (() => void) | null = null;

  ngOnInit(): void {
    void this.dummy;
    this.pop = this.device.push({
      id: 'setup',
      title: () => this.title(),
      menu: () => [
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: 'OK' },
      ],
      key: (p) => this.key(p),
      menuPress: (i) => {
        if (i === 5) this.close()();
      },
      rocker: (d) => this.rocker(d),
      insert: (_l, text) => this.typeText(text),
      help: 'settings',
    });
    queueMicrotask(() => this.input(0)?.focus());
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  protected choice(f: SetupItem): SetupChoice | null {
    return isChoice(f) ? f : null;
  }

  protected num(f: SetupItem): SetupField {
    return f as SetupField;
  }

  /** ←→ / Enter on a choice: the next option. */
  private cycle(i: number, step: 1 | -1): boolean {
    const f = this.fields()[i];
    if (!f || !isChoice(f)) return false;
    const k = f.choices.findIndex((c) => c.value === f.value());
    f.set(f.choices[(k + step + f.choices.length) % f.choices.length].value);
    return true;
  }

  protected show(v: number): string {
    return formatReal(v, { mode: 'standard', digits: 0, decimal: '.' });
  }

  private input(i: number): HTMLInputElement | null {
    const rows = (this.host.nativeElement as HTMLElement).querySelectorAll('.row');
    const el = rows[i]?.querySelector('input, select');
    return el instanceof HTMLInputElement ? el : null;
  }

  protected commit(i: number, src: string): void {
    const f = this.fields()[i];
    if (!f || isChoice(f)) return;
    const p = parseText(src);
    const r = p.ok ? evaluateValue(p.value, this.home.scope()) : p;
    if (!r.ok || r.value.kind !== 'real') {
      this.message.set(r.ok ? 'a real number is needed' : r.error.message);
      return;
    }
    const err = f.set(r.value.v);
    this.message.set(err);
    if (!err) this.rocker('down');
  }

  private typeText(text: string): void {
    const el = this.input(this.cursor());
    if (!el) return;
    el.setRangeText(
      text,
      el.selectionStart ?? el.value.length,
      el.selectionEnd ?? el.value.length,
      'end',
    );
    el.focus();
  }

  private key(p: KeyPress): boolean {
    if (p.id === 'esc') {
      this.close()();
      return true;
    }
    if (p.id === 'enter') {
      if (this.cycle(this.cursor(), 1)) return true;
      const el = this.input(this.cursor());
      if (el) this.commit(this.cursor(), el.value);
      return true;
    }
    if (p.id === 'bksp') {
      const el = this.input(this.cursor());
      if (el) el.value = el.value.slice(0, -1);
      return true;
    }
    const a = editFor(p);
    if (a?.kind === 'insert') {
      this.typeText(a.text);
      return true;
    }
    return false;
  }

  private rocker(d: RockerDir): boolean {
    const n = this.fields().length;
    if (d === 'up') this.cursor.update((c) => (c + n - 1) % n);
    if (d === 'down') this.cursor.update((c) => (c + 1) % n);
    if ((d === 'left' || d === 'right') && this.cycle(this.cursor(), d === 'right' ? 1 : -1))
      return true;
    const el = this.input(this.cursor());
    el?.focus();
    el?.select();
    return true;
  }
}
