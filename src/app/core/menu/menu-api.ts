import { Injectable, inject } from '@angular/core';
import { KeyboardDispatcher } from '../actions/keyboard-dispatcher';
import { I18n } from '../i18n/i18n';
import type { TextKey } from '../i18n/texts';
import type { ActionId } from '../actions/keymap';
import { INVOKE } from '@aba/core/platform/platform-api';
import { type Submenu, desktopMenu, nativeSpec } from './menu-model';

/** Menu labels in the current language. */
export function translateMenu(menus: Submenu[], i18n: I18n): Submenu[] {
  return menus.map((m) => ({
    label: i18n.t(`menu.${m.label}` as TextKey),
    items: m.items.map((i) =>
      i.kind === 'action' ? { ...i, label: i18n.t(`action.${i.id}` as TextKey) } : i,
    ),
  }));
}

/** Installs the application menu (prompt 002/019). Desktop: native; web: the HTML menu component. */
export abstract class MenuApi {
  /** True when the platform shows a native menu bar (the HTML menu is hidden then). */
  abstract readonly native: boolean;
  abstract install(): Promise<void>;
}

@Injectable()
export class TauriMenuApi extends MenuApi {
  private readonly invoke = inject(INVOKE);
  private readonly keys = inject(KeyboardDispatcher);
  readonly native = true;

  async install(): Promise<void> {
    await this.invoke('set_app_menu', {
      spec: nativeSpec(desktopMenu(this.keys.os), this.keys.keymap),
    });
    const { listen } = await import('@tauri-apps/api/event');
    await listen<string>('menu', (e) => this.keys.run(e.payload as ActionId));
  }
}

@Injectable()
export class WebMenuApi extends MenuApi {
  readonly native = false;
  install(): Promise<void> {
    return Promise.resolve();
  }
}
