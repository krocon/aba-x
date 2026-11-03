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
import { RelationNum, RelationPlot } from './relation/relation-views';
import { SurfaceNum, SurfacePlot, SurfaceSetup } from './surface/surface-views';
import { CurveNum, CurveNumSetup, CurvePlot, CurvePlotSetup, CurveSymb } from './curve/curve-views';
import { SolveNum, SolvePlot } from './solve/solve-views';
import { LinearView } from './linear-solver/linear-view';
import { initLinear } from './linear-solver/linear-logic';
import { FinanceNum, FinancePlot, FinanceSymb } from './finance/finance-views';
import { initFinance } from './finance/finance-logic';
import { TriangleNum, TrianglePlot } from './triangle-solver/triangle-views';
import { initTriangle } from './triangle-solver/triangle-logic';

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
  {
    id: 'relation',
    title: { en: 'Advanced Graphing', de: 'Erweiterte Grafiken' },
    icon: 'M3 20h18M4 3v18M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0M8 16l8-8M10 18l8-8',
    init: () => initCurveState('relation'),
    version: 1,
    start: 'symb',
    views: {
      symb: CurveSymb,
      plot: RelationPlot,
      num: RelationNum,
      plotSetup: CurvePlotSetup,
      numSetup: CurveNumSetup,
    },
  },
  {
    id: 'graph3d',
    title: { en: '3D Graphing', de: '3D-Grafik' },
    icon: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
    init: () => initCurveState('graph3d'),
    version: 1,
    start: 'symb',
    views: { symb: CurveSymb, plot: SurfacePlot, num: SurfaceNum, plotSetup: SurfaceSetup },
  },
  // solver apps (prompt 039)
  {
    id: 'solve',
    title: { en: 'Solve', de: 'Lösen' },
    icon: 'M4 8h7M4 12h7M4 16h7M14 6l6 6-6 6M17 12h-3',
    init: () => initCurveState('solve'),
    version: 1,
    start: 'symb',
    views: { symb: CurveSymb, plot: SolvePlot, num: SolveNum },
  },
  {
    id: 'linearSolver',
    title: { en: 'Linear Solver', de: 'Linearlöser' },
    icon: 'M5 4v16M19 4v16M8 8h3M13 8h3M8 12h3M13 12h3M8 16h3M13 16h3',
    init: initLinear,
    version: 1,
    start: 'num',
    views: { num: LinearView },
  },
  {
    id: 'finance',
    title: { en: 'Finance', de: 'Finanzen' },
    icon: 'M4 20V10M9 20V6M14 20v-8M19 20V4M3 20h18',
    init: initFinance,
    version: 1,
    start: 'num',
    views: { symb: FinanceSymb, plot: FinancePlot, num: FinanceNum },
  },
  {
    id: 'triangleSolver',
    title: { en: 'Triangle Solver', de: 'Dreiecklöser' },
    icon: 'M4 19L12 5l8 14zM9 19a3 3 0 0 0-2-3',
    init: initTriangle,
    version: 1,
    start: 'num',
    views: { num: TriangleNum, plot: TrianglePlot },
  },
];
