import { Injectable, inject } from '@angular/core';
import { FilesApi } from '../../core/files/files-api';
import { curves, drawPlot } from './graph-draw';
import { plotSvg } from './graph-export';
import { GraphStore } from './graph-store';

const W = 1200;
const H = 800;

/** PNG and SVG export of the plot (prompt 014) through FilesApi (save dialog / download). */
@Injectable({ providedIn: 'root' })
export class GraphExportService {
  private readonly files = inject(FilesApi);
  private readonly graph = inject(GraphStore);

  private state() {
    const g = this.graph;
    return {
      view: g.view(),
      functions: g.functions(),
      selected: g.selected(),
      trace: null,
      marks: g.marks(),
      tangent: g.tangentAt(),
      area: g.areaMark(),
      areaStart: null,
    };
  }

  async png(): Promise<string | null> {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    drawPlot(ctx, W, H, this.state(), {
      bg: '#ffffff',
      ink: '#1d2417',
      dim: 'rgba(0, 0, 0, 0.12)',
    });
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
    if (!blob) return null;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return this.files.saveBytes('aba-x-plot.png', bytes, {
      name: 'PNG image',
      extensions: ['png'],
    });
  }

  svg(): Promise<string | null> {
    const s = this.state();
    const lines = curves(s, W / 2, H / 2);
    const svg = plotSvg(
      s.view,
      lines.map((l, i) => ({ lines: l, label: `y${i + 1} = ${s.functions[i].text}` })),
      640,
      400,
    );
    return this.files.saveText('aba-x-plot.svg', svg, { name: 'SVG image', extensions: ['svg'] });
  }
}
