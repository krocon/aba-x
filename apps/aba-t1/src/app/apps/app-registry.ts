/**
 * The built-in apps of ABA-T1 (prompt 033 ff.). Icons are our own simple glyphs on a 24×24 grid.
 */
import type { AppDef } from './app-contract';
import { FunctionNum } from './function/function-num';
import { FunctionPlot } from './function/function-plot';
import { FunctionSymb } from './function/function-symb';
import { FunctionNumSetup, FunctionPlotSetup } from './function/function-setup';
import { initFunctionState } from './function/function-logic';

export const APP_DEFS: AppDef[] = [
  {
    id: 'function',
    title: { en: 'Function', de: 'Funktion' },
    icon: 'M3 20h18M4 3v18M5 17c4-12 7-12 9-6s4 5 6-4',
    init: initFunctionState,
    version: 2,
    start: 'symb',
    views: {
      symb: FunctionSymb,
      plot: FunctionPlot,
      num: FunctionNum,
      plotSetup: FunctionPlotSetup,
      numSetup: FunctionNumSetup,
    },
  },
];
