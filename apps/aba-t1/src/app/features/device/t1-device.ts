import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, input, output } from '@angular/core';
import { type Gesture, GestureRecognizer } from '@aba/core/actions/gestures';
import { FUNCTION_ROWS, KeyDef, NUMBER_ROWS, TOP_LEFT, TOP_RIGHT } from './keypad-model';

/** One of the six touch buttons under the display (empty label = unused). */
export interface MenuButton {
  label: string;
  /** Highlighted (e.g. the active choice of a toggle). */
  active?: boolean;
}

/**
 * The ABA-T1 device (prompt 025): brand line, display with a fixed 4:3 size (title bar, content,
 * six touch menu buttons), the upper key cluster around the rocker and the keypad. The content of
 * the display comes from the views (`<ng-content>`); keys are reported as their id. Keys never take
 * the focus from the input (`pointerdown` → `preventDefault`, CLAUDE.md).
 */
@Component({
  selector: 'app-t1-device',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  templateUrl: './t1-device.html',
  styleUrl: './t1-device.css',
})
export class T1Device implements OnDestroy {
  readonly title = input('');
  /** Annunciators on the right of the title bar (shift, alpha, angle mode, …). */
  readonly annunciators = input<string[]>([]);
  readonly menu = input<MenuButton[]>([]);
  readonly shift = input(false);
  readonly alpha = input(false);
  /** Id of a key that lights up (pressed by the hardware keyboard). */
  readonly lit = input<string | null>(null);
  /** Switched off (shift + On): the display is dark until On. */
  readonly off = input(false);

  readonly key = output<string>();
  readonly menuPress = output<number>();
  readonly rocker = output<'up' | 'down' | 'left' | 'right'>();
  /** Gestures on the display content with the size of the content area (CSS px). */
  readonly gesture = output<{ g: Gesture; width: number; height: number }>();

  private readonly recognizer = new GestureRecognizer();
  private repeat: ReturnType<typeof setTimeout> | undefined;

  protected readonly topLeft = TOP_LEFT;
  protected readonly topRight = TOP_RIGHT;
  protected readonly functionRows = FUNCTION_ROWS;
  protected readonly numberRows = NUMBER_ROWS;
  protected readonly slots = [0, 1, 2, 3, 4, 5];

  protected keep(e: Event): void {
    e.preventDefault();
  }

  /** Rocker: a press moves once, holding repeats (after 400 ms, every 70 ms). */
  protected rockerDown(e: PointerEvent, dir: 'up' | 'down' | 'left' | 'right'): void {
    e.preventDefault();
    this.stopRepeat();
    this.rocker.emit(dir);
    const again = (delay: number) => {
      this.repeat = setTimeout(() => {
        this.rocker.emit(dir);
        again(70);
      }, delay);
    };
    again(400);
  }

  protected stopRepeat(): void {
    clearTimeout(this.repeat);
    this.repeat = undefined;
  }

  /** Keyboard activation of a rocker button (Enter/Space on a focused button). */
  protected rockerKey(e: Event, dir: 'up' | 'down' | 'left' | 'right'): void {
    if ((e as MouseEvent).detail === 0) this.rocker.emit(dir);
  }

  protected pointer(e: PointerEvent, kind: 'down' | 'move' | 'up' | 'cancel'): void {
    if (this.off()) return;
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (kind === 'down') el.setPointerCapture?.(e.pointerId);
    const gs =
      kind === 'down'
        ? this.recognizer.down(e.pointerId, x, y, e.timeStamp)
        : kind === 'move'
          ? this.recognizer.move(e.pointerId, x, y, e.timeStamp)
          : kind === 'up'
            ? this.recognizer.up(e.pointerId, x, y, e.timeStamp)
            : this.recognizer.cancel(e.pointerId);
    for (const g of gs) this.gesture.emit({ g, width: r.width, height: r.height });
  }

  ngOnDestroy(): void {
    this.stopRepeat();
  }

  protected label(k: KeyDef): string {
    const name = k.aria ?? k.main;
    const extra = [k.shift && `shift ${k.shift}`, k.alpha && `alpha ${k.alpha}`].filter(Boolean);
    return extra.length ? `${name} (${extra.join(', ')})` : name;
  }
}
