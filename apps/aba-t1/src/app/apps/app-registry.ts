/**
 * The built-in apps of ABA-T1 (prompt 033 ff.). Icons are our own simple glyphs on a 24×24 grid.
 */
import { type AppDef, lazy } from './app-contract';
import { initPython } from './python/python-state';
import { initFunctionState } from './function/function-logic';
import { initCurveState } from './curve/curve-logic';
import { ExplorerView, initExplorer } from './explorer/explorer-view';
import { initInference } from './inference/inference-logic';
import { initStats1, initStats2 } from './stats/stats-logic';
import { initSheetState } from './spreadsheet/sheet-logic';
import { initGeometryState } from './geometry/geometry-logic';
import { initLinear } from './linear-solver/linear-logic';
import { initFinance } from './finance/finance-logic';
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
      symb: lazy(() => import('./function/function-symb').then((m) => m.FunctionSymb)),
      plot: lazy(() => import('./function/function-plot').then((m) => m.FunctionPlot)),
      num: lazy(() => import('./function/function-num').then((m) => m.FunctionNum)),
      plotSetup: lazy(() => import('./function/function-setup').then((m) => m.FunctionPlotSetup)),
      numSetup: lazy(() => import('./function/function-setup').then((m) => m.FunctionNumSetup)),
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
      symb: lazy(() => import('./curve/curve-views').then((m) => m.CurveSymb)),
      plot: lazy(() => import('./curve/curve-views').then((m) => m.CurvePlot)),
      num: lazy(() => import('./curve/curve-views').then((m) => m.CurveNum)),
      plotSetup: lazy(() => import('./curve/curve-views').then((m) => m.CurvePlotSetup)),
      numSetup: lazy(() => import('./curve/curve-views').then((m) => m.CurveNumSetup)),
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
      symb: lazy(() => import('./curve/curve-views').then((m) => m.CurveSymb)),
      plot: lazy(() => import('./relation/relation-views').then((m) => m.RelationPlot)),
      num: lazy(() => import('./relation/relation-views').then((m) => m.RelationNum)),
      plotSetup: lazy(() => import('./curve/curve-views').then((m) => m.CurvePlotSetup)),
      numSetup: lazy(() => import('./curve/curve-views').then((m) => m.CurveNumSetup)),
    },
  },
  ...(['stats1', 'stats2'] as const).map((id): AppDef => ({
    id,
    title: {
      stats1: { en: 'Statistics 1Var', de: 'Statistik 1Var' },
      stats2: { en: 'Statistics 2Var', de: 'Statistik 2Var' },
    }[id],
    icon: {
      stats1: 'M3 20h18M5 20v-6h3v6M10 20V8h3v12M15 20v-9h3v9',
      stats2: 'M3 20h18M4 3v18M6 16l12-9M7 13h.1M10 14h.1M12 9h.1M15 10h.1M17 6h.1',
    }[id],
    init: id === 'stats1' ? initStats1 : initStats2,
    version: 1,
    start: 'num',
    views: {
      symb: lazy(() => import('./stats/stats-views').then((m) => m.StatsSymb)),
      plot: lazy(() => import('./stats/stats-views').then((m) => m.StatsPlot)),
      num: lazy(() => import('./stats/stats-views').then((m) => m.StatsNum)),
      plotSetup: lazy(() => import('./stats/stats-views').then((m) => m.StatsPlotSetup)),
    },
  })),
  {
    id: 'inference',
    title: { en: 'Inference', de: 'Inferenz' },
    icon: 'M3 20h18M4 19c3 0 4-13 8-13s5 13 8 13M15 19v-7',
    init: initInference,
    version: 1,
    start: 'symb',
    views: {
      symb: lazy(() => import('./inference/inference-views').then((m) => m.InferenceSymb)),
      num: lazy(() => import('./inference/inference-views').then((m) => m.InferenceNum)),
      plot: lazy(() => import('./inference/inference-views').then((m) => m.InferencePlotView)),
    },
  },
  {
    id: 'graph3d',
    title: { en: '3D Graphing', de: '3D-Grafik' },
    icon: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
    init: () => initCurveState('graph3d'),
    version: 1,
    start: 'symb',
    views: {
      symb: lazy(() => import('./curve/curve-views').then((m) => m.CurveSymb)),
      plot: lazy(() => import('./surface/surface-views').then((m) => m.SurfacePlot)),
      num: lazy(() => import('./surface/surface-views').then((m) => m.SurfaceNum)),
      plotSetup: lazy(() => import('./surface/surface-views').then((m) => m.SurfaceSetup)),
    },
  },
  {
    id: 'spreadsheet',
    title: { en: 'Spreadsheet', de: 'Tabellenkalkulation' },
    icon: 'M3 4h18v16H3zM3 9h18M3 14h18M9 4v16M15 4v16',
    init: initSheetState,
    version: 1,
    start: 'num',
    views: {
      num: lazy(() => import('./spreadsheet/sheet-views').then((m) => m.SheetNum)),
      numSetup: lazy(() => import('./spreadsheet/sheet-views').then((m) => m.SheetNumSetup)),
    },
  },
  {
    id: 'geometry',
    title: { en: 'Geometry', de: 'Geometrie' },
    icon: 'M4 19L12 5l8 14zM12 5v14M4 19l12-7M3 19h2M11 4h2',
    init: initGeometryState,
    version: 1,
    start: 'plot',
    views: {
      symb: lazy(() => import('./geometry/geometry-views').then((m) => m.GeometrySymb)),
      plot: lazy(() => import('./geometry/geometry-plot').then((m) => m.GeometryPlot)),
      num: lazy(() => import('./geometry/geometry-views').then((m) => m.GeometryNum)),
      plotSetup: lazy(() => import('./geometry/geometry-views').then((m) => m.GeometryPlotSetup)),
    },
  },
  // solver apps (prompt 039)
  {
    id: 'solve',
    title: { en: 'Solve', de: 'Lösen' },
    icon: 'M4 8h7M4 12h7M4 16h7M14 6l6 6-6 6M17 12h-3',
    init: () => initCurveState('solve'),
    version: 1,
    start: 'symb',
    views: {
      symb: lazy(() => import('./curve/curve-views').then((m) => m.CurveSymb)),
      plot: lazy(() => import('./solve/solve-views').then((m) => m.SolvePlot)),
      num: lazy(() => import('./solve/solve-views').then((m) => m.SolveNum)),
    },
  },
  {
    id: 'linearSolver',
    title: { en: 'Linear Solver', de: 'Linearlöser' },
    icon: 'M5 4v16M19 4v16M8 8h3M13 8h3M8 12h3M13 12h3M8 16h3M13 16h3',
    init: initLinear,
    version: 1,
    start: 'num',
    views: { num: lazy(() => import('./linear-solver/linear-view').then((m) => m.LinearView)) },
  },
  {
    id: 'finance',
    title: { en: 'Finance', de: 'Finanzen' },
    icon: 'M4 20V10M9 20V6M14 20v-8M19 20V4M3 20h18',
    init: initFinance,
    version: 1,
    start: 'num',
    views: {
      symb: lazy(() => import('./finance/finance-views').then((m) => m.FinanceSymb)),
      plot: lazy(() => import('./finance/finance-views').then((m) => m.FinancePlot)),
      num: lazy(() => import('./finance/finance-views').then((m) => m.FinanceNum)),
    },
  },
  {
    id: 'triangleSolver',
    title: { en: 'Triangle Solver', de: 'Dreiecklöser' },
    icon: 'M4 19L12 5l8 14zM9 19a3 3 0 0 0-2-3',
    init: initTriangle,
    version: 1,
    start: 'num',
    views: {
      num: lazy(() => import('./triangle-solver/triangle-views').then((m) => m.TriangleNum)),
      plot: lazy(() => import('./triangle-solver/triangle-views').then((m) => m.TrianglePlot)),
    },
  },
  {
    id: 'python',
    title: { en: 'Python', de: 'Python' },
    icon: 'M8 3h6a3 3 0 0 1 3 3v4H9a3 3 0 0 0-3 3v2H5a2 2 0 0 1-2-2V9a3 3 0 0 1 3-3h2zM16 21h-6a3 3 0 0 1-3-3v-4h8a3 3 0 0 0 3-3V9h1a2 2 0 0 1 2 2v4a3 3 0 0 1-3 3h-2zM10 6h.1M14 18h.1',
    init: initPython,
    version: 1,
    start: 'num',
    views: {
      symb: lazy(() => import('./python/python-views').then((m) => m.PythonScripts)),
      num: lazy(() => import('./python/python-views').then((m) => m.PythonShell)),
      plot: lazy(() => import('./python/python-views').then((m) => m.PythonPlot)),
    },
  },
];
