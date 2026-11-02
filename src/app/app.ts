import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { AppInfo, PlatformApi } from './core/platform/platform-api';
import { APP_MODES, AppMode, stepMode } from './core/ui-state/ui-state-logic';
import { UiStateStore } from './core/ui-state/ui-state-store';
import { CalculatorPage } from './features/calculator/calculator-page';
import { ModePlaceholder } from './features/shell/mode-placeholder';

const MODE_LABELS: Record<AppMode, string> = {
  standard: 'Standard',
  cas: 'CAS',
  graph: 'Graph',
};

/** Window frame: brand, mode tabs (APG tabs pattern), the active mode, status line. */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalculatorPage, ModePlaceholder],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly platform = inject(PlatformApi);
  protected readonly ui = inject(UiStateStore);
  private readonly tabs = viewChildren<ElementRef<HTMLButtonElement>>('tab');

  protected readonly modes = APP_MODES;
  protected readonly labels = MODE_LABELS;
  protected readonly info = signal<AppInfo | null>(null);
  protected readonly kind = this.platform.kind;

  async ngOnInit(): Promise<void> {
    await this.ui.restore();
    this.info.set(await this.platform.appInfo().catch(() => null));
  }

  protected select(mode: AppMode): void {
    this.ui.setMode(mode);
  }

  protected onTabKey(event: KeyboardEvent): void {
    let next: AppMode | null = null;
    if (event.key === 'ArrowRight') next = stepMode(this.ui.mode(), 1);
    else if (event.key === 'ArrowLeft') next = stepMode(this.ui.mode(), -1);
    else if (event.key === 'Home') next = APP_MODES[0];
    else if (event.key === 'End') next = APP_MODES[APP_MODES.length - 1];
    if (!next) return;
    event.preventDefault();
    this.ui.setMode(next);
    this.tabs()[APP_MODES.indexOf(next)]?.nativeElement.focus();
  }
}
