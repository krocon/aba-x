import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import type { Gesture } from '@aba/core/actions/gestures';
import { FilesApi } from '@aba/core/files/files-api';
import { PlotCanvas, type PlotPainter } from '@aba/core/graph/plot-canvas';
import { drawAxes, DARK_PLOT } from '@aba/core/graph/plot-draw';
import { nearestParameter } from '@aba/math/geometry/constructions';
import type { GeoObject } from '@aba/math/geometry/model';
import { renderData } from '@aba/math/geometry/render-data';
import type { Vec } from '@aba/math/geometry/shapes';
import { type Viewport, niceStep, pan, toWorldX, toWorldY, zoom } from '@aba/math/graph/viewport';
import { evaluateNumeric } from '@aba/math/numeric/evaluate';
import { parseText } from '@aba/math/parser/text-parser';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import type { TextKey } from '../../core/i18n/texts';
import type { MenuButton } from '../../features/device/t1-device';
import { editFor } from '../../features/home/home-keys';
import { SettingsStore } from '../../features/settings/settings-store';
import { PlotMenu, type PlotMenuItem } from '../shared/plot-menu';
import { drawCursor, drawScene, drawTraces } from './geometry-draw';
import {
  GEOMETRY_VIEW,
  TOOLS,
  type Tool,
  type ToolGroup,
  chooseIndex,
  colorOf,
  createsPoint,
  defaultMeasures,
  equalView,
  fitView,
  fmtMeasured,
  fmtValue,
  hitTest,
  measure,
  nextColor,
  nextStep,
  snap,
  snapStep,
  toolComplete,
} from './geometry-logic';
import { GeometrySession } from './geometry-session';

type Popup = 'view' | ToolGroup;
const GROUPS: ToolGroup[] = ['lines', 'polygons', 'curves', 'transform', 'measure'];
/** pick radius in pixels */
const PICK_PX = 12;

/**
 * Plot view of the geometry app (prompt 042): the construction canvas. The menu buttons open the
 * tool lists; a tool collects its objects by taps (or the keyboard cross + Enter), empty space
 * creates free points. Without a tool, a tap selects an object (then the menu acts on it) and
 * dragging moves free points – all dependants follow – or pans the plane.
 */
@Component({
  selector: 'app-geometry-plot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlotCanvas, PlotMenu],
  template: `
    <div class="plot">
      <app-plot-canvas [view]="view()" [painter]="painter()" [label]="label()" />
      @if (shown().length) {
        <ul class="meas" [attr.aria-label]="i18n.t('geo.num')">
          @for (m of shown(); track $index) {
            <li>{{ m }}</li>
          }
        </ul>
      }
      @if (popup(); as p) {
        <app-plot-menu
          [title]="popupTitle()"
          [items]="items()"
          [cursor]="p.cursor"
          (pick)="pick($event)"
        />
      }
      <div class="bar" aria-live="polite">
        @if (prompt(); as q) {
          <label>
            {{ q.label }} =
            <input
              #entry
              type="text"
              spellcheck="false"
              autocomplete="off"
              (keydown.enter)="submitPrompt()"
              (keydown.escape)="prompt.set(null)"
            />
          </label>
        } @else {
          {{ bar() }}
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .plot {
      position: relative;
      height: 100%;
    }
    .meas {
      position: absolute;
      top: 0;
      left: 0;
      margin: 0;
      padding: 0.1em 0.4em;
      list-style: none;
      background: var(--lcd-overlay);
      font-size: 3.1cqw;
      font-variant-numeric: tabular-nums;
      pointer-events: none;
      max-width: 70%;
    }
    .meas li {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bar {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 0.05em 0.4em;
      background: var(--lcd-overlay);
      font-size: 3.3cqw;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-height: 1.3em;
    }
    .bar input {
      width: 40%;
      font: inherit;
    }
  `,
})
export class GeometryPlot implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  private readonly session = inject(GeometrySession);
  private readonly device = inject(DeviceStore);
  private readonly settings = inject(SettingsStore);
  private readonly files = inject(FilesApi);
  private readonly canvas = viewChild(PlotCanvas);
  private readonly entry = viewChild<ElementRef<HTMLInputElement>>('entry');

  protected readonly tool = signal<Tool | null>(null);
  /** names of the objects picked so far by the tool */
  private readonly picks = signal<string[]>([]);
  private lastTap: Vec = { x: 0, y: 0 };
  protected readonly selected = signal<string | null>(null);
  protected readonly popup = signal<{ kind: Popup; cursor: number } | null>(null);
  protected readonly prompt = signal<{ label: string; run: (text: string) => void } | null>(null);
  private readonly cursor = signal<Vec | null>(null);
  private readonly message = signal<string | null>(null);
  private readonly traces = signal<Record<string, Vec[]>>({});
  private drag: { name: string; offset: Vec } | 'pan' | null = null;
  private pop: (() => void) | null = null;

  private readonly scene = this.session.scene;
  private readonly size = computed(() => {
    const a = this.canvas()?.area();
    return a?.width ? a : { width: 320, height: 200 };
  });
  protected readonly view = computed<Viewport>(() => {
    const s = this.scene().state;
    return s.equal ? equalView(s.view, this.size()) : s.view;
  });
  private readonly fmt = computed(() => this.settings.settings().format);

  private readonly selectedObj = computed(() => {
    const n = this.selected();
    return n ? (this.scene().objects.find((o) => o.name === n) ?? null) : null;
  });

  protected readonly shown = computed(() => {
    const { c, state } = this.scene();
    const o = {
      format: this.fmt(),
      angle: this.settings.settings().angle,
      yes: this.i18n.t('home.yes'),
      no: this.i18n.t('home.no'),
    };
    return state.measures.slice(-4).map((m) => {
      const r = measure(c, m);
      return `${m} = ${r.ok ? fmtMeasured(r.value, o) : '—'}`;
    });
  });

  protected readonly bar = computed(() => {
    const msg = this.message();
    if (msg) return msg;
    const t = this.tool();
    if (t) {
      const picks = this.picks();
      const step = nextStep(t, this.objects(picks));
      const what = step.length === 1 && step[0] === 'point' ? 'geo.pickPoint' : 'geo.pickObject';
      const total = t.many ? '' : `${picks.length + 1}/${Math.max(1, t.steps.length)} `;
      return `${this.toolLabel(t)}: ${total}${this.i18n.t(what as TextKey)}${
        picks.length ? ` (${picks.join(', ')})` : ''
      }`;
    }
    const o = this.selectedObj();
    if (o)
      return `${o.name} = ${this.session.scene().c.describe(o.name)}: ${fmtValue(o.value, this.fmt())}`;
    return this.i18n.t('geo.hint');
  });

  protected readonly label = computed(() => {
    const objs = this.scene().objects.filter((o) => !o.hidden);
    const list = objs
      .slice(0, 12)
      .map((o) => `${o.name}: ${fmtValue(o.value, this.fmt())}`)
      .join('; ');
    return `${this.i18n.t('geo.plot')}. ${objs.length} ${this.i18n.t('geo.objects')}. ${list}`;
  });

  protected readonly painter = computed<PlotPainter>(() => {
    const { objects, state } = this.scene();
    const marked = new Set([...this.picks(), this.selected() ?? '']);
    const cursor = this.cursor();
    const traces = this.traces();
    const c = this.scene().c;
    return (frame) => {
      drawAxes(frame, DARK_PLOT, { grid: state.axes, axes: state.axes, labels: state.axes });
      drawTraces(
        frame,
        Object.entries(traces).map(([n, pts]) => ({
          pts,
          color: colorOf(objects.find((o) => o.name === n) ?? objects[0], state.colors),
        })),
      );
      drawScene(
        frame,
        objects
          .filter((o) => !o.hidden)
          .map((o) => ({
            name: o.name,
            primitive: renderData(o.value, frame.view),
            color: colorOf(o, state.colors),
            free: c.isFree(o.id) && o.value.kind === 'point',
            marked: marked.has(o.name),
          })),
      );
      if (cursor) drawCursor(frame, cursor);
    };
  });

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'geometry-plot',
      title: () => this.i18n.t('geo.plot'),
      menu: () => this.menu(),
      key: (p) => this.key(p),
      menuPress: (i) => this.menuPress(i),
      rocker: (d, shift) => this.rocker(d, shift),
      gesture: (g) => this.gesture(g),
      insert: (_latex, text) => {
        const el = this.entry()?.nativeElement;
        if (el) el.value += text;
      },
      help: 'geometry',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  private objects(names: readonly string[]): GeoObject[] {
    const c = this.scene().c;
    return names.map((n) => c.get(n)).filter((o): o is GeoObject => !!o);
  }

  private toolLabel(t: Tool): string {
    return this.i18n.t(`geo.t.${t.id}` as TextKey);
  }

  // --- menu -----------------------------------------------------------------------------------

  private menu(): MenuButton[] {
    const o = this.selectedObj();
    if (o && !this.tool()) {
      return [
        { label: 'Trace', active: this.scene().state.trace.includes(o.name) },
        { label: this.i18n.t('geo.color') },
        { label: this.i18n.t('geo.hide') },
        { label: this.i18n.t('data.delete') },
        { label: this.i18n.t('geo.measure') },
        { label: 'OK' },
      ];
    }
    const g = this.tool()?.group;
    return [
      { label: this.i18n.t('geo.view') },
      ...GROUPS.map((k) => ({ label: this.i18n.t(`geo.g.${k}` as TextKey), active: g === k })),
    ];
  }

  private menuPress(i: number): void {
    const o = this.selectedObj();
    if (o && !this.tool()) {
      if (i === 0) this.toggleTrace(o);
      if (i === 1) {
        const c = colorOf(o, this.scene().state.colors);
        this.session.update((s) => ({ ...s, colors: { ...s.colors, [o.name]: nextColor(c) } }));
      }
      if (i === 2) {
        this.session.toggleHidden(o.name);
        this.selected.set(null);
      }
      if (i === 3) this.deleteSelected();
      if (i === 4) {
        const add = defaultMeasures(o).filter((m) => !this.scene().state.measures.includes(m));
        this.session.update((s) => ({ ...s, measures: [...s.measures, ...add] }));
      }
      if (i === 5) this.selected.set(null);
      return;
    }
    this.popup.set({ kind: i === 0 ? 'view' : GROUPS[i - 1], cursor: 0 });
  }

  protected readonly popupTitle = computed(() => {
    const p = this.popup();
    return p ? this.i18n.t(p.kind === 'view' ? 'geo.view' : (`geo.g.${p.kind}` as TextKey)) : '';
  });

  protected readonly items = computed<PlotMenuItem[]>(() => {
    const p = this.popup();
    if (!p) return [];
    if (p.kind === 'view') {
      const z = (k: TextKey, run: () => void) => ({ label: this.i18n.t(k), run });
      return [
        z('geo.t.move', () => this.setTool(null)),
        z('zoom.in', () => this.zoomBy(0.5)),
        z('zoom.out', () => this.zoomBy(2)),
        z('geo.fit', () => {
          const v = fitView(this.scene().c);
          if (v) this.setView(v);
        }),
        z('zoom.standard', () => this.setView(GEOMETRY_VIEW)),
        z('geo.clearTraces', () => this.traces.set({})),
        { label: 'PNG', run: () => void this.exportPng() },
      ];
    }
    return TOOLS.filter((t) => t.group === p.kind).map((t) => ({
      label: this.toolLabel(t),
      run: () => this.setTool(t),
    }));
  });

  protected pick(i: number): void {
    const it = this.items()[i];
    this.popup.set(null);
    it?.run();
  }

  private setTool(t: Tool | null): void {
    this.tool.set(t);
    this.picks.set([]);
    this.selected.set(null);
    this.message.set(null);
    if (t && !t.steps.length && !t.many) this.finish();
  }

  // --- input ----------------------------------------------------------------------------------

  private key(p: KeyPress): boolean {
    const pop = this.popup();
    if (this.prompt()) {
      const el = this.entry()?.nativeElement;
      if (p.id === 'enter') this.submitPrompt();
      else if (p.id === 'esc') this.prompt.set(null);
      else if (p.id === 'bksp' && el) el.value = el.value.slice(0, -1);
      else {
        const a = editFor(p);
        if (a?.kind === 'insert' && el) el.value += a.text;
      }
      return true;
    }
    if (pop) {
      if (p.id === 'enter') this.pick(pop.cursor);
      else if (p.id === 'esc') this.popup.set(null);
      return true;
    }
    if (p.id === 'add' || p.id === 'sub') {
      this.zoomBy(p.id === 'add' ? 0.5 : 2);
      return true;
    }
    if (p.id === 'enter') {
      const t = this.tool();
      const cur = this.cursor();
      if (cur) this.tapAt(cur);
      else if (t?.many && this.picks().length >= 3) this.finish();
      else this.cursor.set(this.center());
      return true;
    }
    if (p.id === 'esc') {
      this.message.set(null);
      if (this.picks().length) this.picks.set([]);
      else if (this.tool()) this.tool.set(null);
      else if (this.selected()) this.selected.set(null);
      else this.cursor.set(null);
      return true;
    }
    if (p.id === 'bksp' && this.selected()) {
      this.deleteSelected();
      return true;
    }
    return false;
  }

  private rocker(d: RockerDir, shift: boolean): boolean {
    const pop = this.popup();
    if (pop) {
      const n = this.items().length;
      if (d === 'up' || d === 'down')
        this.popup.set({ ...pop, cursor: (pop.cursor + (d === 'down' ? 1 : n - 1)) % n });
      if (d === 'left') this.popup.set(null);
      return true;
    }
    const v = this.view();
    const dx = d === 'left' ? -1 : d === 'right' ? 1 : 0;
    const dy = d === 'down' ? -1 : d === 'up' ? 1 : 0;
    const o = this.selectedObj();
    const c = this.scene().c;
    if (o && !this.tool() && o.cmd === 'slider') {
      const [val, lo, hi] = o.args.map((a) => ('num' in a ? a.num : 0));
      const step = ((hi - lo) / 50) * (shift ? 0.1 : 1);
      this.session.setSlider(
        o.name,
        snap(Math.min(hi, Math.max(lo, val + (dx || dy) * step)), step / 10),
      );
      this.recordTraces();
      return true;
    }
    const step = niceStep(v.xmax - v.xmin, 40) * (shift ? 0.1 : 1);
    if (o && !this.tool() && c.isFree(o.id) && o.value.kind === 'point') {
      const p = o.value.p;
      this.moveTo(o.name, { x: p.x + dx * step, y: p.y + dy * step });
      return true;
    }
    const cur = this.cursor() ?? this.center();
    const next = { x: snap(cur.x + dx * step, step), y: snap(cur.y + dy * step, step) };
    this.cursor.set(next);
    if (next.x < v.xmin || next.x > v.xmax || next.y < v.ymin || next.y > v.ymax)
      this.setView(pan(this.scene().state.view, dx * 0.25, dy * 0.25));
    return true;
  }

  private center(): Vec {
    const v = this.view();
    const step = snapStep(v, this.size().width);
    return { x: snap((v.xmin + v.xmax) / 2, step), y: snap((v.ymin + v.ymax) / 2, step) };
  }

  private toWorld(x: number, y: number): Vec {
    const v = this.view();
    const scr = this.size();
    return { x: toWorldX(v, scr, x), y: toWorldY(v, scr, y) };
  }

  private gesture(g: Gesture): void {
    if (this.prompt()) return;
    // the pop-up list handles its own clicks (a tap must not close it before the click arrives)
    if (this.popup()) return;
    const v = this.view();
    const scr = this.size();
    if (g.kind === 'tap' || g.kind === 'longPress' || (g.kind === 'doubleTap' && this.tool())) {
      this.tapAt(this.toWorld(g.x, g.y));
    } else if (g.kind === 'doubleTap') {
      const w = this.toWorld(g.x, g.y);
      this.zoomBy(0.5, w);
    } else if (g.kind === 'drag') {
      if (g.phase === 'start') {
        const w = this.toWorld(g.x, g.y);
        const c = this.scene().c;
        const hit = this.tool()
          ? undefined
          : hitTest(c, w, this.tolerance(), (o) => c.isFree(o.id) && o.value.kind === 'point');
        this.drag =
          hit && hit.value.kind === 'point'
            ? { name: hit.name, offset: { x: hit.value.p.x - w.x, y: hit.value.p.y - w.y } }
            : 'pan';
        if (hit) this.selected.set(hit.name);
      } else if (g.phase === 'move') {
        const d = this.drag;
        if (d && d !== 'pan') {
          const w = this.toWorld(g.x, g.y);
          this.moveTo(d.name, { x: w.x + d.offset.x, y: w.y + d.offset.y }, true);
        } else {
          this.setView(
            pan(
              this.scene().state.view,
              (-g.dx * (v.xmax - v.xmin)) / scr.width,
              (g.dy * (v.ymax - v.ymin)) / scr.height,
            ),
          );
        }
      } else this.drag = null;
    } else if (g.kind === 'pinch' && g.phase === 'move' && g.scale > 0) {
      this.zoomBy(1 / g.scale, this.toWorld(g.cx, g.cy));
    }
  }

  private tolerance(): number {
    const v = this.view();
    const scr = this.size();
    return PICK_PX * Math.max((v.xmax - v.xmin) / scr.width, (v.ymax - v.ymin) / scr.height);
  }

  private moveTo(name: string, to: Vec, snapToGrid = false): void {
    const step = snapStep(this.view(), this.size().width);
    const x = snapToGrid ? snap(to.x, step) : Number(to.x.toPrecision(12));
    const y = snapToGrid ? snap(to.y, step) : Number(to.y.toPrecision(12));
    const r = this.session.move(name, x, y);
    if (!r.ok) this.message.set(r.error.message);
    else this.recordTraces();
  }

  private recordTraces(): void {
    const { c, state } = this.scene();
    if (!state.trace.length) return;
    const next = { ...this.traces() };
    for (const n of state.trace) {
      const v = c.get(n)?.value;
      if (v?.kind !== 'point') continue;
      const pts = next[n] ?? [];
      const last = pts.at(-1);
      if (!last || last.x !== v.p.x || last.y !== v.p.y) next[n] = [...pts, v.p].slice(-4000);
    }
    this.traces.set(next);
  }

  private toggleTrace(o: GeoObject): void {
    if (o.value.kind !== 'point' && !o.kinds.includes('point')) {
      this.message.set(this.i18n.t('geo.tracePoints'));
      return;
    }
    const on = this.scene().state.trace.includes(o.name);
    this.session.update((s) => ({
      ...s,
      trace: on ? s.trace.filter((n) => n !== o.name) : [...s.trace, o.name],
    }));
    if (on) {
      const t = { ...this.traces() };
      delete t[o.name];
      this.traces.set(t);
    }
  }

  private deleteSelected(): void {
    const n = this.selected();
    if (!n) return;
    const r = this.session.delete(n);
    this.selected.set(null);
    this.message.set(
      r.ok ? `${this.i18n.t('geo.deleted')}: ${r.value.join(', ')}` : r.error.message,
    );
  }

  // --- tools ----------------------------------------------------------------------------------

  /** A tap (or Enter on the keyboard cross) at a world position. */
  private tapAt(w: Vec): void {
    this.message.set(null);
    const c = this.scene().c;
    const tol = this.tolerance();
    const t = this.tool();
    if (!t) {
      this.selected.set(hitTest(c, w, tol)?.name ?? null);
      return;
    }
    const step = snapStep(this.view(), this.size().width);
    const at = { x: snap(w.x, step), y: snap(w.y, step) };
    if (t.id === 'point') {
      const hit = hitTest(c, w, tol);
      if (hit?.value.kind === 'point') {
        this.message.set(`${hit.name}: ${this.i18n.t('geo.exists')}`);
        return;
      }
      const tParam =
        hit && hit.kinds.some((k) => t.steps[0].includes(k))
          ? nearestParameter(hit.value, w)
          : undefined;
      const r =
        hit && tParam !== undefined
          ? this.session.add('pointOn', [hit.name, Number(tParam.toPrecision(12))])
          : this.session.add('point', [at.x, at.y]);
      this.message.set(r.ok ? `${r.value} = ${c.describe(r.value)}` : r.error.message);
      return;
    }
    const picks = this.picks();
    const kinds = nextStep(t, this.objects(picks));
    if (t.many && picks.length >= 3) {
      const first = hitTest(c, w, tol, (o) => o.name === picks[0]);
      if (first) {
        this.finish();
        return;
      }
    }
    const hit = hitTest(
      c,
      w,
      tol,
      (o) => o.kinds.some((k) => kinds.includes(k)) && !picks.includes(o.name),
    );
    let name = hit?.name;
    if (!name && createsPoint(kinds, t)) {
      const r = this.session.add('point', [at.x, at.y]);
      if (!r.ok) {
        this.message.set(r.error.message);
        return;
      }
      name = r.value;
    }
    if (!name) {
      this.message.set(this.i18n.t('geo.nothing'));
      return;
    }
    this.lastTap = w;
    const next = [...picks, name];
    this.picks.set(next);
    if (toolComplete(t, this.objects(next))) this.finish();
  }

  /** All objects picked: create the object (asking for a number first if needed) or measure. */
  private finish(): void {
    const t = this.tool();
    if (!t) return;
    const picks = this.picks();
    const c = this.scene().c;
    if (t.measure) {
      const text = `${t.measure}(${picks.join(', ')})`;
      if (!this.scene().state.measures.includes(text))
        this.session.update((s) => ({ ...s, measures: [...s.measures, text] }));
      this.picks.set([]);
      return;
    }
    const args: (string | number)[] = [...picks];
    if (t.cmd === 'intersect' || t.cmd === 'tangent')
      args.push(
        chooseIndex(
          t.cmd,
          this.objects(picks).map((o) => o.value),
          this.lastTap,
          c.tolerance(),
        ),
      );
    const create = (extra: number[]) => {
      const r = this.session.add(t.cmd!, [...args, ...extra]);
      this.picks.set([]);
      this.message.set(r.ok ? `${r.value} = ${c.describe(r.value)}` : r.error.message);
    };
    const num = t.num;
    if (!num) {
      create([]);
      return;
    }
    const deg = num.angle && this.settings.settings().angle === 'deg';
    const def = num.angle && !deg ? 'pi/2' : num.def;
    this.prompt.set({
      label: num.angle ? `${num.label} (${deg ? '°' : 'rad'})` : num.label,
      run: (text) => {
        const e = parseText(text);
        const v = e.ok ? evaluateNumeric(e.value) : e;
        if (!v.ok) {
          this.message.set(v.error.message);
          this.picks.set([]);
          return;
        }
        create([deg ? (v.value * Math.PI) / 180 : v.value]);
      },
    });
    queueMicrotask(() => {
      const el = this.entry()?.nativeElement;
      if (el) {
        el.value = def;
        el.focus();
        el.select();
      }
    });
  }

  protected submitPrompt(): void {
    const q = this.prompt();
    const text = this.entry()?.nativeElement.value ?? '';
    this.prompt.set(null);
    q?.run(text);
  }

  // --- view -----------------------------------------------------------------------------------

  private setView(v: Viewport): void {
    this.session.update((s) => ({ ...s, view: v }));
  }

  private zoomBy(f: number, at?: Vec): void {
    const s = this.scene().state.view;
    const v = this.view();
    const cx = at?.x ?? (v.xmin + v.xmax) / 2;
    const cy = at?.y ?? (v.ymin + v.ymax) / 2;
    this.setView(zoom(s, f, cx, cy));
  }

  private async exportPng(): Promise<void> {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const s = this.scene().state;
    this.painter()({
      ctx,
      width: 640,
      height: 480,
      view: s.equal ? equalView(s.view, { width: 640, height: 480 }) : s.view,
    });
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    if (blob)
      await this.files.saveBytes('geometry.png', new Uint8Array(await blob.arrayBuffer()), {
        name: 'PNG',
        extensions: ['png'],
      });
  }
}
