import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
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
export class T1Device {
  readonly title = input('');
  /** Annunciators on the right of the title bar (shift, alpha, angle mode, …). */
  readonly annunciators = input<string[]>([]);
  readonly menu = input<MenuButton[]>([]);
  readonly shift = input(false);
  readonly alpha = input(false);
  /** Id of a key that lights up (pressed by the hardware keyboard). */
  readonly lit = input<string | null>(null);

  readonly key = output<string>();
  readonly menuPress = output<number>();
  readonly rocker = output<'up' | 'down' | 'left' | 'right'>();

  protected readonly topLeft = TOP_LEFT;
  protected readonly topRight = TOP_RIGHT;
  protected readonly functionRows = FUNCTION_ROWS;
  protected readonly numberRows = NUMBER_ROWS;
  protected readonly slots = [0, 1, 2, 3, 4, 5];

  protected keep(e: Event): void {
    e.preventDefault();
  }

  protected label(k: KeyDef): string {
    const name = k.aria ?? k.main;
    const extra = [k.shift && `shift ${k.shift}`, k.alpha && `alpha ${k.alpha}`].filter(Boolean);
    return extra.length ? `${name} (${extra.join(', ')})` : name;
  }
}
