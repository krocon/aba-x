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
import { initInference } from './inference/inference-logic';
import { InferenceNum, InferencePlotView, InferenceSymb } from './inference/inference-views';
import { initStats1, initStats2 } from './stats/stats-logic';
import { StatsNum, StatsPlot, StatsPlotSetup, StatsSymb } from './stats/stats-views';
import { RelationNum, RelationPlot } from './relation/relation-views';
import { SurfaceNum, SurfacePlot, SurfaceSetup } from './surface/surface-views';
import { CurveNum, CurveNumSetup, CurvePlot, CurvePlotSetup, CurveSymb } from './curve/curve-views';
import { initSheetState } from './spreadsheet/sheet-logic';
import { SheetNum, SheetNumSetup } from './spreadsheet/sheet-views';
import { initGeometryState } from './geometry/geometry-logic';
import { GeometryPlot } from './geometry/geometry-plot';
import { GeometryNum, GeometryPlotSetup, GeometrySymb } from './geometry/geometry-views';

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
    views: { symb: StatsSymb, plot: StatsPlot, num: StatsNum, plotSetup: StatsPlotSetup },
  })),
  {
    id: 'inference',
    title: { en: 'Inference', de: 'Inferenz' },
    icon: 'M3 20h18M4 19c3 0 4-13 8-13s5 13 8 13M15 19v-7',
    init: initInference,
    version: 1,
    start: 'symb',
    views: { symb: InferenceSymb, num: InferenceNum, plot: InferencePlotView },
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
  {
    id: 'spreadsheet',
    title: { en: 'Spreadsheet', de: 'Tabellenkalkulation' },
    icon: 'M3 4h18v16H3zM3 9h18M3 14h18M9 4v16M15 4v16',
    init: initSheetState,
    version: 1,
    start: 'num',
    views: { num: SheetNum, numSetup: SheetNumSetup },
  },
  {
    id: 'geometry',
    title: { en: 'Geometry', de: 'Geometrie' },
    icon: 'M4 19L12 5l8 14zM12 5v14M4 19l12-7M3 19h2M11 4h2',
    init: initGeometryState,
    version: 1,
    start: 'plot',
    views: {
      symb: GeometrySymb,
      plot: GeometryPlot,
      num: GeometryNum,
      plotSetup: GeometryPlotSetup,
    },
  },
];
