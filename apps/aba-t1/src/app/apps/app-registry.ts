/**
 * The built-in apps of ABA-T1 (prompt 033 ff.). Icons are our own simple glyphs on a 24×24 grid.
 */
import type { AppDef } from './app-contract';
import { FunctionNum } from './function/function-num';
import { FunctionPlot } from './function/function-plot';
import { FunctionSymb } from './function/function-symb';
import { FunctionNumSetup, FunctionPlotSetup } from './function/function-setup';
import { initFunctionState } from './function/function-logic';
import { initCurveState } from './curve/curve-logic';
import { ExplorerView, initExplorer } from './explorer/explorer-view';
import { CurveNum, CurveNumSetup, CurvePlot, CurvePlotSetup, CurveSymb } from './curve/curve-views';

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
  ...(['parametric', 'polar', 'sequence'] as const).map((kind): AppDef => ({
    id: kind,
    title: {
      parametric: { en: 'Parametric', de: 'Parametrisch' },
      polar: { en: 'Polar', de: 'Polar' },
      sequence: { en: 'Sequence', de: 'Folge' },
    }[kind],
    icon: {
      parametric: 'M3 20h18M4 3v18M12 6a6 6 0 1 1-0.1 0M12 6l3-2',
      polar: 'M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0M12 12c3-6 6-3 0 0s-6 3 0 0',
      sequence: 'M3 20h18M4 3v18M6 18h3v-3h3v-4h3v-6h3',
    }[kind],
    init: () => initCurveState(kind),
    version: 1,
    start: 'symb',
    views: {
      symb: CurveSymb,
      plot: CurvePlot,
      num: CurveNum,
      plotSetup: CurvePlotSetup,
      numSetup: CurveNumSetup,
    },
  })),
  ...(['linear', 'quadratic', 'trig'] as const).map((kind): AppDef => ({
    id: `${kind}Explorer`,
    title: {
      linear: { en: 'Linear Explorer', de: 'Linear-Explorer' },
      quadratic: { en: 'Quadratic Explorer', de: 'Quadratik-Explorer' },
      trig: { en: 'Trig Explorer', de: 'Trig-Explorer' },
    }[kind],
    icon: {
      linear: 'M3 20h18M4 3v18M5 18L19 6M15 6h4v4',
      quadratic: 'M3 20h18M4 3v18M6 5c3 14 9 14 12 0M12 15v4',
      trig: 'M3 12h18M4 3v18M5 12c2-6 4-6 6 0s4 6 6 0 2-4 3-3',
    }[kind],
    init: () => initExplorer(kind),
    version: 1,
    start: 'plot',
    views: { plot: ExplorerView },
  })),
];
