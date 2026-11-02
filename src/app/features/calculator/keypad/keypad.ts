import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CalculatorStore } from '../calculator-store';
import { FUNCTION_ROWS, KeyDef, NUMBER_ROWS } from './keypad-model';

/**
 * The keypad: six-column function block, five-column number block. Shifted functions are printed
 * above each key (left shift violet, right shift teal), the alpha letter at the lower right.
 * Keys never take the focus away from the input line (pointerdown is cancelled).
 */
@Component({
  selector: 'app-keypad',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  templateUrl: './keypad.html',
  styleUrl: './keypad.css',
})
export class Keypad {
  protected readonly store = inject(CalculatorStore);
  protected readonly functionRows = FUNCTION_ROWS;
  protected readonly numberRows = NUMBER_ROWS;

  protected armed(key: KeyDef): boolean {
    const s = this.store.shift();
    return (
      (key.variant === 'shift-left' && s === 'left') ||
      (key.variant === 'shift-right' && s === 'right') ||
      (key.variant === 'alpha' && key.id === 'alpha' && this.store.alpha())
    );
  }
}
