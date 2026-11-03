import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { I18n } from './core/i18n/i18n';
import { KeyboardDispatcher } from './core/actions/keyboard-dispatcher';
import { MenuApi } from './core/menu/menu-api';
import { AppInfo, PlatformApi } from '@aba/core/platform/platform-api';
import { UiStateStore } from './core/ui-state/ui-state-store';
import { AboutDialog } from './features/about/about-dialog';
import { BackupStore } from './features/backup/backup-store';
import { ImportDialog } from './features/backup/import-dialog';
import { CalculatorDevice } from './features/calculator/device/calculator-device';
import { ShortcutsDialog } from './features/help/shortcuts-dialog';
import { GraphStore } from './features/graph/graph-store';
import { HistoryStore } from './features/history/history-store';
import { MenuBar } from './features/menus/menu-bar';
import { SettingsDialog } from './features/settings/settings-dialog';
import { SettingsStore } from './features/settings/settings-store';
import { VarsStore } from './features/vars/vars-store';

/**
 * Page frame: menu (HTML on the web, native on the desktop), the calculator device, dialogs and a
 * status line (platform, version, storage problems, export/import messages).
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalculatorDevice, ShortcutsDialog, MenuBar, AboutDialog, ImportDialog, SettingsDialog],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '[class.full]': 'settings.settings().fullSize',
    '[class.web-menu]': '!menu.native',
  },
})
export class App implements OnInit {
  private readonly platform = inject(PlatformApi);
  protected readonly ui = inject(UiStateStore);
  protected readonly keys = inject(KeyboardDispatcher);
  protected readonly vars = inject(VarsStore);
  protected readonly history = inject(HistoryStore);
  private readonly graph = inject(GraphStore);
  protected readonly backup = inject(BackupStore);
  protected readonly menu = inject(MenuApi);
  protected readonly info = signal<AppInfo | null>(null);
  protected readonly kind = this.platform.kind;
  protected readonly aboutOpen = signal(false);
  protected readonly settingsOpen = signal(false);
  protected readonly settings = inject(SettingsStore);
  protected readonly i18n = inject(I18n);
  private ready = false;
  /** PWA: a new version was downloaded in the background (prompt 020). */
  protected readonly updateReady = signal(false);

  constructor() {
    const sw = inject(SwUpdate);
    if (sw.isEnabled) {
      sw.versionUpdates.subscribe((e) => {
        if (e.type === 'VERSION_READY') this.updateReady.set(true);
      });
    }
    this.keys.register('about', () => this.aboutOpen.set(true));
    this.keys.register('settings', () => this.settingsOpen.set(true));
    this.keys.register('toggleFullSize', () =>
      this.settings.update({ fullSize: !this.settings.settings().fullSize }),
    );
    this.keys.register('exportData', () => void this.backup.exportData(this.settings.settings()));
    this.keys.register('importData', () => void this.backup.chooseImport());
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.settings.restore(),
      this.ui.restore(),
      this.vars.restore(),
      this.history.restore(),
    ]);
    await this.graph.restore();
    this.info.set(await this.platform.appInfo().catch(() => null));
    await this.menu.install().catch((e: unknown) => console.error('menu', e));
    this.ready = true;
  }

  /** The native menu follows the language. */
  private readonly relabelMenu = effect(() => {
    this.i18n.lang();
    if (this.ready) void this.menu.install().catch(() => undefined);
  });

  protected reload(): void {
    document.location.reload();
  }

  protected confirmImport(): void {
    this.backup.confirmImport((raw) => this.settings.importRaw(raw));
  }
}
