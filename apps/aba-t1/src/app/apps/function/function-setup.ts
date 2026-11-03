import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { Viewport } from '@aba/math/graph/viewport';
import { I18n } from '../../core/i18n/i18n';
import { AppStore } from '../app-store';
import { SetupForm, type SetupItem } from '../shared/setup-form';
import type { FunctionState, PlotOptions } from './function-logic';

/** Plot setup of the function app: X and Y range (prompt 033). */
@Component({
  selector: 'app-function-plot-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SetupForm],
  template: `<app-setup-form
    [title]="i18n.t('app.plotSetup')"
    [fields]="fields()"
    [close]="close"
  />`,
})
export class FunctionPlotSetup {
  protected readonly i18n = inject(I18n);
  private readonly apps = inject(AppStore);
  protected readonly close = () => this.apps.show('plot');
  protected readonly fields = computed<SetupItem[]>(() => {
    this.apps.current();
    const v = () => this.apps.state<FunctionState>().view;
    const opt = () => this.apps.state<FunctionState>().plot;
    const setOpt = (o: Partial<PlotOptions>) =>
      this.apps.update<FunctionState>((s) => ({ ...s, plot: { ...s.plot, ...o } }));
    const t = (k: Parameters<I18n['t']>[0]) => this.i18n.t(k);
    const onOff = [
      { value: 'on', label: t('app.on') },
      { value: 'off', label: t('app.off') },
    ];
    const set = (k: keyof Viewport) => (x: number) => {
      const next = { ...v(), [k]: x };
      if (next.xmin >= next.xmax || next.ymin >= next.ymax) return 'min must be smaller than max';
      this.apps.update<FunctionState>((s) => ({ ...s, view: next }));
      return null;
    };
    return [
      { label: 'X min', value: () => v().xmin, set: set('xmin') },
      { label: 'X max', value: () => v().xmax, set: set('xmax') },
      { label: 'Y min', value: () => v().ymin, set: set('ymin') },
      { label: 'Y max', value: () => v().ymax, set: set('ymax') },
      {
        label: t('app.grid'),
        choices: onOff,
        value: () => (opt().grid ? 'on' : 'off'),
        set: (x: string) => setOpt({ grid: x === 'on' }),
      },
      {
        label: t('app.axes'),
        choices: onOff,
        value: () => (opt().axes ? 'on' : 'off'),
        set: (x: string) => setOpt({ axes: x === 'on' }),
      },
      {
        label: t('app.labels'),
        choices: onOff,
        value: () => (opt().labels ? 'on' : 'off'),
        set: (x: string) => setOpt({ labels: x === 'on' }),
      },
      {
        label: t('app.method'),
        choices: [
          { value: 'adaptive', label: t('app.adaptive') },
          { value: 'segments', label: t('app.segments') },
          { value: 'dots', label: t('app.dots') },
        ],
        value: () => opt().method,
        set: (x: string) => setOpt({ method: x as PlotOptions['method'] }),
      },
    ];
  });
}

/** Numeric setup: start value and step of the table (prompt 033). */
@Component({
  selector: 'app-function-num-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SetupForm],
  template: `<app-setup-form
    [title]="i18n.t('app.numSetup')"
    [fields]="fields()"
    [close]="close"
  />`,
})
export class FunctionNumSetup {
  protected readonly i18n = inject(I18n);
  private readonly apps = inject(AppStore);
  protected readonly close = () => this.apps.show('num');
  protected readonly fields = computed<SetupItem[]>(() => {
    this.apps.current();
    const s = () => this.apps.state<FunctionState>();
    return [
      {
        label: this.i18n.t('app.numStart'),
        value: () => s().numStart,
        set: (x: number) => (this.apps.update<FunctionState>((t) => ({ ...t, numStart: x })), null),
      },
      {
        label: this.i18n.t('app.numStep'),
        value: () => s().numStep,
        set: (x: number) => {
          if (x <= 0) return 'the step must be positive';
          this.apps.update<FunctionState>((t) => ({ ...t, numStep: x }));
          return null;
        },
      },
    ];
  });
}
