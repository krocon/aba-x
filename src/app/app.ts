import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { AppInfo, PlatformApi } from './core/platform/platform-api';
import { UiStateStore } from './core/ui-state/ui-state-store';
import { CalculatorDevice } from './features/calculator/device/calculator-device';

/** Page frame: the calculator device and a status line (platform, version, storage problems). */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalculatorDevice],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly platform = inject(PlatformApi);
  protected readonly ui = inject(UiStateStore);
  protected readonly info = signal<AppInfo | null>(null);
  protected readonly kind = this.platform.kind;

  async ngOnInit(): Promise<void> {
    await this.ui.restore();
    this.info.set(await this.platform.appInfo().catch(() => null));
  }
}
