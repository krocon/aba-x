import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
} from '@angular/core';
import { KeyboardDispatcher } from '../../../core/actions/keyboard-dispatcher';
import type { ActionId } from '../../../core/actions/keymap';
import { UiStateStore } from '../../../core/ui-state/ui-state-store';
import { CalculatorStore } from '../calculator-store';
import { visibleLevels } from '../entry-stack';
import { Keypad } from '../keypad/keypad';
import { keyIdForPhysical } from '../keypad/keypad-model';
import { MathInput } from '../math-input';
import { varsMenu } from '../../vars/vars-logic';
import { MAIN_MENU, MODE_TITLES, type MenuItem, casCalcMenu, casMenu, mainItems } from './softkeys';

/** Visible stack levels in the display. */
const LEVELS = 4;

/**
 * The calculator: display (annunciators, stack, input line, soft menu), the six softkeys and the
 * keypad. Shortcuts (F1–F6, →NUM, …) come from the KeyboardDispatcher; here only: typing while the
 * focus is outside the input line goes to the line, and the matching virtual key lights up.
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

  /** The six soft-menu labels: main menu or VARS. */
  protected readonly menu = computed<MenuItem[]>(() => {
    const m = this.calc.menu();
    const mode = this.ui.mode();
    if (m === 'main' || (m === 'mode' && mode !== 'cas')) {
      return mainItems(MAIN_MENU, mode, {
        setMode: (next) => {
          this.ui.setMode(next);
          this.calc.menu.set('mode');
        },
        openVars: () => this.calc.run({ kind: 'vars' }),
        planned: (what) => this.calc.run({ kind: 'planned', what }),
      });
    }
    if (m === 'mode') return casMenu(this.calc);
    if (m === 'cas-calc') return casCalcMenu(this.calc);
    const vars = this.calc.vars;
    const fns = [...vars.functions()].map(([name, f]) => ({ name, arity: f.params.length }));
    const items = varsMenu([...vars.variables().keys()], fns, this.calc.varsPage()).map((e) => ({
      label:
        e.kind === 'next'
          ? 'NXT'
          : e.kind === 'exit'
            ? 'EXIT'
            : e.kind === 'fn'
              ? `${e.name}()`
              : e.name,
      run: () => this.calc.varsSoftkey(e),
      active: false,
      planned: false,
      pressed: null,
    }));
    // EXIT stays on the last softkey; empty slots in between
    const exit = items.pop()!;
    while (items.length < 5)
      items.push({ label: '', run: () => undefined, active: false, planned: true, pressed: null });
    return [...items, exit];
  });
  protected readonly title = computed(() => MODE_TITLES[this.ui.mode()]);
  protected readonly levels = computed(() =>
    visibleLevels(this.calc.stack(), LEVELS, this.calc.selected()),
  );

  constructor() {
    const keys = inject(KeyboardDispatcher);
    const softkey = (i: number) => () => {
      this.calc.flash(`soft-${i}`);
      this.softkey(i);
    };
    const handlers: [ActionId, () => void][] = [
      ['softkey1', softkey(0)],
      ['softkey2', softkey(1)],
      ['softkey3', softkey(2)],
      ['softkey4', softkey(3)],
      ['softkey5', softkey(4)],
      ['softkey6', softkey(5)],
      ['toNumber', () => void this.calc.enter(true)],
      ['toggleAngle', () => this.calc.toggleAngle()],
      ['toggleApprox', () => this.calc.toggleApprox()],
      ['drop', () => this.calc.run({ kind: 'stack', op: 'drop' })],
      ['swap', () => this.calc.run({ kind: 'stack', op: 'swap' })],
      ['clearStack', () => this.calc.clearStack()],
    ];
    const off = handlers.map(([id, h]) => keys.register(id, h));
    inject(DestroyRef).onDestroy(() => off.forEach((f) => f()));
  }

  protected softkey(index: number): void {
    const item = this.menu()[index];
    if (item) item.run();
    else this.calc.shift.set('none');
  }

  protected onKeydown(e: KeyboardEvent): void {
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
        void this.calc.enter();
      } else if (e.key.length === 1 && /[\w+\-*/.^()=,|!]/.test(e.key) && !e.repeat) {
        e.preventDefault();
        this.calc.run({ kind: 'insert', latex: e.key === '*' ? '\\cdot' : e.key });
      }
    }
  }
}
