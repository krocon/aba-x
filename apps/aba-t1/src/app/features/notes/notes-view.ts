import { NgTemplateOutlet } from '@angular/common';
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
import { FilesApi } from '@aba/core/files/files-api';
import { MathStatic } from '@aba/core/shared/math-static';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import { NavStore } from '../../core/nav/nav-store';
import type { MenuButton } from '../device/t1-device';
import { editFor } from '../home/home-keys';
import { render } from './notes-logic';
import { NotesStore } from './notes-store';

type Mode = 'list' | 'edit' | 'show';

/**
 * Notes (prompt 045, ⇧0): a catalogue of notes, an editor (plain text with **bold**, *italic*,
 * `code`, $formulas$, # headings and - lists) and a formatted view. Export as Markdown.
 */
@Component({
  selector: 'app-notes-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MathStatic, NgTemplateOutlet],
  template: `
    @switch (mode()) {
      @case ('list') {
        <ul class="list" [attr.aria-label]="i18n.t('notes.title')">
          @for (n of notes.notes(); track n.id; let i = $index) {
            <li
              tabindex="-1"
              [class.cur]="cursor() === i"
              (click)="cursor() === i ? open('show') : cursor.set(i)"
              (keydown.enter)="open('show')"
            >
              <span class="t">{{ n.title }}</span>
              <span class="d">{{ date(n.updated) }}</span>
            </li>
          } @empty {
            <li class="empty">{{ i18n.t('notes.empty') }}</li>
          }
        </ul>
      }
      @case ('edit') {
        <textarea
          #text
          [attr.aria-label]="i18n.t('notes.title')"
          [value]="currentText()"
          (input)="edited($any($event.target).value)"
        ></textarea>
      }
      @case ('show') {
        <article class="show">
          @for (b of blocks(); track $index) {
            @switch (b.kind) {
              @case ('h') {
                <h3>
                  @for (p of b.parts; track $index) {
                    <ng-container *ngTemplateOutlet="part; context: { $implicit: p }" />
                  }
                </h3>
              }
              @case ('li') {
                <p class="li">
                  •
                  @for (p of b.parts; track $index) {
                    <ng-container *ngTemplateOutlet="part; context: { $implicit: p }" />
                  }
                </p>
              }
              @default {
                <p>
                  @for (p of b.parts; track $index) {
                    <ng-container *ngTemplateOutlet="part; context: { $implicit: p }" />
                  }
                </p>
              }
            }
          }
        </article>
      }
    }
    <ng-template #part let-p>
      @switch (p.kind) {
        @case ('b') {
          <strong>{{ p.text }}</strong>
        }
        @case ('i') {
          <em>{{ p.text }}</em>
        }
        @case ('code') {
          <code>{{ p.text }}</code>
        }
        @case ('math') {
          <app-math [latex]="p.text" />
        }
        @default {
          {{ p.text }}
        }
      }
    </ng-template>
  `,
  styles: `
    :host {
      display: block;
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
      gap: 0.5em;
      padding: 0.2em 0.5em;
      border-bottom: 1px solid var(--lcd-line);
      cursor: pointer;
    }
    li.cur {
      background: var(--lcd-cur);
    }
    li.empty {
      color: var(--lcd-muted);
      cursor: default;
    }
    .d {
      color: var(--lcd-muted);
      font-size: 0.8em;
    }
    textarea {
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      border: 0;
      padding: 0.4em 0.6em;
      font: inherit;
      resize: none;
      outline: none;
    }
    .show {
      height: 100%;
      overflow-y: auto;
      padding: 0.3em 0.6em;
    }
    h3 {
      margin: 0.2em 0;
      font-size: 1.1em;
    }
    p {
      margin: 0.2em 0;
    }
    p.li {
      padding-left: 0.6em;
    }
  `,
})
export class NotesView implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  protected readonly notes = inject(NotesStore);
  private readonly device = inject(DeviceStore);
  private readonly nav = inject(NavStore);
  private readonly files = inject(FilesApi);
  private readonly textEl = viewChild<ElementRef<HTMLTextAreaElement>>('text');
  protected readonly mode = signal<Mode>('list');
  protected readonly cursor = signal(0);
  protected readonly current = computed(() => this.notes.notes()[this.cursor()] ?? null);
  protected readonly currentText = computed(() => this.current()?.text ?? '');
  protected readonly blocks = computed(() => render(this.current()?.text ?? ''));
  private pop: (() => void) | null = null;

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'notes',
      title: () =>
        this.mode() === 'list' ? this.i18n.t('notes.title') : (this.current()?.title ?? ''),
      menu: () => this.menu(),
      key: (p) => this.key(p),
      menuPress: (i) => this.press(i),
      rocker: (d) => this.rocker(d),
      insert: (_l, t) => this.typeText(t),
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  protected date(t: number): string {
    return new Date(t).toLocaleDateString(this.i18n.lang());
  }

  private menu(): MenuButton[] {
    const t = (k: Parameters<I18n['t']>[0]) => this.i18n.t(k);
    const b = (label: string, active = false): MenuButton => ({ label, active });
    if (this.mode() === 'list') {
      const has = !!this.current();
      return [
        b(t('notes.new')),
        b(has ? t('data.edit') : ''),
        b(has ? t('notes.show') : ''),
        b(has ? t('data.delete') : ''),
        b(has ? 'Export' : ''),
        b('OK'),
      ];
    }
    return [
      b(t('data.edit'), this.mode() === 'edit'),
      b(t('notes.show'), this.mode() === 'show'),
      b(''),
      b(''),
      b(''),
      b('OK'),
    ];
  }

  private press(i: number): void {
    if (this.mode() === 'list') {
      if (i === 0) {
        this.notes.create();
        this.cursor.set(0);
        this.open('edit');
      }
      if (i === 1 && this.current()) this.open('edit');
      if (i === 2 && this.current()) this.open('show');
      if (i === 3 && this.current()) this.notes.remove(this.current()!.id);
      if (i === 4 && this.current()) void this.exportNote();
      if (i === 5) this.nav.go('home');
      return;
    }
    if (i === 0) this.open('edit');
    if (i === 1) this.open('show');
    if (i === 5) this.mode.set('list');
  }

  protected open(m: Mode): void {
    this.mode.set(m);
    if (m === 'edit') queueMicrotask(() => this.textEl()?.nativeElement.focus());
  }

  protected edited(text: string): void {
    const n = this.current();
    if (n) this.notes.update(n.id, text);
  }

  private typeText(t: string): void {
    const el = this.textEl()?.nativeElement;
    if (!el) return;
    el.setRangeText(t, el.selectionStart, el.selectionEnd, 'end');
    this.edited(el.value);
  }

  private async exportNote(): Promise<void> {
    const n = this.current();
    if (n)
      await this.files.saveText(
        `${n.title.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'note'}.md`,
        n.text,
        { name: 'Markdown', extensions: ['md', 'txt'] },
      );
  }

  private key(p: KeyPress): boolean {
    if (p.id === 'esc') {
      if (this.mode() === 'list') this.nav.go('home');
      else this.mode.set('list');
      return true;
    }
    if (this.mode() === 'list') {
      if (p.id !== 'enter') return false;
      if (this.current()) this.open('show');
      return true;
    }
    if (this.mode() === 'edit') {
      if (p.id === 'enter') this.typeText('\n');
      else if (p.id === 'bksp') {
        const el = this.textEl()?.nativeElement;
        if (el && el.selectionStart > 0) {
          el.setRangeText('', el.selectionStart - 1, el.selectionEnd, 'end');
          this.edited(el.value);
        }
      } else {
        const a = editFor(p);
        if (a?.kind === 'insert') this.typeText(a.text);
        else return false;
      }
      return true;
    }
    return false;
  }

  private rocker(d: RockerDir): boolean {
    if (this.mode() !== 'list') return false;
    const n = this.notes.notes().length;
    if (!n) return true;
    if (d === 'up') this.cursor.update((c) => (c + n - 1) % n);
    if (d === 'down') this.cursor.update((c) => (c + 1) % n);
    if (d === 'right') this.open('show');
    return true;
  }
}
