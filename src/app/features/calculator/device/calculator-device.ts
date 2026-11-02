import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { UiStateStore } from '../../../core/ui-state/ui-state-store';
import { CalculatorStore } from '../calculator-store';
import { visibleLevels } from '../entry-stack';
import { Keypad } from '../keypad/keypad';
import { keyIdForPhysical, softkeyIndexForPhysical } from '../keypad/keypad-model';
import { MathInput } from '../math-input';
import { MAIN_MENU, MODE_TITLES, Softkey } from './softkeys';

/** Visible stack levels in the display. */
const LEVELS = 4;

/**
 * The calculator: display (annunciators, stack, input line, soft menu), the six softkeys and the
 * keypad. Also the one place that listens to the hardware keyboard outside the input line:
 * F1–F6 press the softkeys, typing anywhere goes to the input line, the matching virtual key
 * lights up.
 */
@Component({
  selector: 'app-calculator-device',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Keypad, MathInput],
  // <math-span> (static MathLive rendering) is registered when MathLive loads.
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './calculator-device.html',
  styleUrl: './calculator-device.css',
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class CalculatorDevice {
  protected readonly ui = inject(UiStateStore);
  protected readonly calc = inject(CalculatorStore);

  protected readonly menu = MAIN_MENU;
  protected readonly title = computed(() => MODE_TITLES[this.ui.mode()]);
  protected readonly levels = computed(() => visibleLevels(this.calc.stack(), LEVELS));

  protected isActive(key: Softkey): boolean {
    return key.kind === 'mode' && key.mode === this.ui.mode();
  }

  protected softkey(index: number): void {
    const key = this.menu[index];
    if (!key) return;
    if (key.kind === 'mode') this.ui.setMode(key.mode);
    else this.calc.run({ kind: 'planned', what: key.what });
  }

  protected onKeydown(e: KeyboardEvent): void {
    const soft = softkeyIndexForPhysical(e.key);
    if (soft >= 0 && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      this.calc.flash(`soft-${soft}`);
      this.softkey(soft);
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const id = keyIdForPhysical(e.key);
    if (id) this.calc.flash(id);

    // Typing while the focus is elsewhere (after a click on the body) goes to the input line.
    const target = e.target;
    const inEditor =
      target instanceof Element &&
      !!target.closest('math-field, input, textarea, [contenteditable]');
    if (!inEditor && this.ui.mode() === 'standard') {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.calc.enter();
      } else if (e.key.length === 1 && /[\w+\-*/.^()=,|!]/.test(e.key) && !e.repeat) {
        e.preventDefault();
        this.calc.run({ kind: 'insert', latex: e.key === '*' ? '\\cdot' : e.key });
      }
    }
  }
}
