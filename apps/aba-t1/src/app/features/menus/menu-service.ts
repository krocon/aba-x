import { Injectable, inject } from '@angular/core';
import { INVOKE, PlatformApi } from '@aba/core/platform/platform-api';
import { T1Keyboard } from '../../core/actions/t1-keyboard';
import { I18n } from '../../core/i18n/i18n';
import type { TextKey } from '../../core/i18n/texts';
import { type MenuAction, desktopMenu, nativeSpec, webMenu } from './menu-model';

/**
 * The application menu of ABA-T1 (prompt 045): native on the desktop (Rust `set_app_menu`, clicks
 * come back as the event `menu`), an HTML menu on the web – both from one model. Handlers are
 * registered by the app frame.
 */
@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly platform = inject(PlatformApi);
  private readonly invoke = inject(INVOKE);
  private readonly keyboard = inject(T1Keyboard);
  private readonly i18n = inject(I18n);
  private readonly handlers = new Map<MenuAction, () => void>();
  readonly native = this.platform.kind === 'desktop';
  readonly web = webMenu();

  on(id: MenuAction, run: () => void): void {
    this.handlers.set(id, run);
  }

  run(id: string): void {
    this.handlers.get(id as MenuAction)?.();
  }

  label(key: string): string {
    return this.i18n.t(key as TextKey);
  }

  /** Installs the native menu (desktop) – again after a language change. */
  async install(): Promise<void> {
    if (!this.native) return;
    const spec = nativeSpec(desktopMenu(this.keyboard.os), (k) => this.label(k));
    await this.invoke('set_app_menu', { spec });
  }

  async listen(): Promise<void> {
    if (!this.native) return;
    const { listen } = await import('@tauri-apps/api/event');
    await listen<string>('menu', (e) => this.run(e.payload));
  }
}
