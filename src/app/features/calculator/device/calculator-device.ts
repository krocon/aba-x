import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
} from '@angular/core';
import { KeyboardDispatcher } from '../../../core/actions/keyboard-dispatcher';
import { I18n } from '../../../core/i18n/i18n';
import type { ActionId } from '../../../core/actions/keymap';
import { UiStateStore } from '../../../core/ui-state/ui-state-store';
import { CalculatorStore } from '../calculator-store';
import { visibleLevels } from '../entry-stack';
import { Keypad } from '../keypad/keypad';
import { keyIdForPhysical } from '../keypad/keypad-model';
import { MathInput } from '../math-input';
import { varsMenu } from '../../vars/vars-logic';
import { GraphExportService } from '../../graph/graph-export-service';
import { GraphView } from '../../graph/graph-view';
import { MathStatic } from '../../../shared/math-static';
import {
  MAIN_MENU,
  MODE_TITLES,
  type MenuItem,
  casCalcMenu,
  casMenu,
  graphAnalyseMenu,
  graphExportMenu,
  graphMenu,
  graphZoomMenu,
  histMenu,
  mainItems,
} from './softkeys';

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
  imports: [Keypad, MathInput, GraphView, MathStatic],
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
    if (m === 'main' || (m === 'mode' && mode === 'standard')) {
      return mainItems(MAIN_MENU, mode, {
        setMode: (next) => {
          this.ui.setMode(next);
          this.calc.menu.set('mode');
        },
        openVars: () => this.calc.run({ kind: 'vars' }),
        openHistory: () => this.calc.openHistory(),
        openSettings: () => this.keys.run('settings'),
        planned: (what) => this.calc.run({ kind: 'planned', what }),
      });
    }
    if (m === 'hist') return histMenu(this.calc);
    const graphTarget = {
      menu: this.calc.menu,
      graph: this.calc.graph,
      exportPng: () => void this.exportPlot('png'),
      exportSvg: () => void this.exportPlot('svg'),
      editFunction: () => this.calc.editFunction(),
    };
    if (m === 'mode' && mode === 'graph') return graphMenu(graphTarget);
    if (m === 'graph-zoom') return graphZoomMenu(graphTarget);
    if (m === 'graph-anlz') return graphAnalyseMenu(graphTarget);
    if (m === 'graph-exprt') return graphExportMenu(graphTarget);
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

  private readonly keys = inject(KeyboardDispatcher);
  protected readonly i18n = inject(I18n);

  constructor() {
    const keys = this.keys;
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
      ['history', () => this.calc.openHistory()],
      ['vars', () => this.calc.run({ kind: 'vars' })],
      ['modeStandard', () => this.setMode('standard')],
      ['modeCas', () => this.setMode('cas')],
      ['modeGraph', () => this.setMode('graph')],
      ['copyResult', () => this.copy()],
    ];
    const off = handlers.map(([id, h]) => keys.register(id, h));
    inject(DestroyRef).onDestroy(() => off.forEach((f) => f()));
  }

  private readonly exporter = inject(GraphExportService);

  private async exportPlot(kind: 'png' | 'svg'): Promise<void> {
    try {
      const name = kind === 'png' ? await this.exporter.png() : await this.exporter.svg();
      if (name) this.calc.message.set(`saved ${name}`);
    } catch (e) {
      this.calc.message.set(`export failed: ${(e as { message?: string }).message ?? e}`);
    }
  }

  private setMode(mode: 'standard' | 'cas' | 'graph'): void {
    this.ui.setMode(mode);
    this.calc.menu.set('mode');
  }

  private copy(): void {
    const t = this.calc.clipboardText();
    if (!t) return;
    void navigator.clipboard?.writeText(t.text).then(
      () => this.calc.message.set(this.i18n.t('msg.copied')),
      () => this.calc.message.set(this.i18n.t('msg.copyFailed')),
    );
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
