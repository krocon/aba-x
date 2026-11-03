import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { T1Keyboard } from './core/actions/t1-keyboard';
import { DeviceStore } from './core/device/device-store';
import { NavStore } from './core/nav/nav-store';
import { T1Device } from './features/device/t1-device';
import { ShortcutsDialog } from './features/help/shortcuts-dialog';
import { CasStore } from './features/cas/cas-store';
import { CasView } from './features/cas/cas-view';
import { Modal } from '@aba/core/shared/modal';
import { AppHost } from './apps/app-host';
import { BackupService } from './features/backup/backup-service';
import { MemoryView } from './features/memory/memory-view';
import { AboutDialog } from './features/menus/about-dialog';
import { MenuService } from './features/menus/menu-service';
import { WebMenu } from './features/menus/web-menu';
import { NotesStore } from './features/notes/notes-store';
import { NotesView } from './features/notes/notes-view';
import { I18n } from './core/i18n/i18n';
import { AppStore } from './apps/app-store';
import { LibraryView } from './apps/library-view';
import { DataCatalog } from './features/data/catalog-view';
import { GridEditor } from './features/data/grid-editor';
import { HomeStore } from './features/home/home-store';
import { HomeView } from './features/home/home-view';
import { RpnStore } from './features/rpn/rpn-store';
import { RpnView } from './features/rpn/rpn-view';
import { SettingsStore } from './features/settings/settings-store';
import { SettingsView } from './features/settings/settings-view';
import { PopupStore } from './features/toolbox/popup-store';
import { PopupView } from './features/toolbox/popup-view';

/**
 * Page frame of ABA-T1: the device centred on a dark page, wired to the device store (prompt 026)
 * and the screens of the display (home view, settings – prompt 027). Each view pushes its context
 * onto the device store; app-level keys switch screens.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    T1Device,
    ShortcutsDialog,
    HomeView,
    RpnView,
    SettingsView,
    CasView,
    PopupView,
    DataCatalog,
    GridEditor,
    LibraryView,
    AppHost,
    NotesView,
    MemoryView,
    WebMenu,
    AboutDialog,
    Modal,
  ],
  template: `
    @if (!menu.native) {
      <app-web-menu />
    }
    <main>
      <h1 class="visually-hidden">ABA-T1</h1>
      <app-t1-device
        [title]="device.title()"
        [annunciators]="device.annunciators()"
        [menu]="device.menu()"
        [shift]="device.mods().shift"
        [alpha]="device.mods().alpha !== 'off'"
        [lit]="device.lit()"
        [off]="device.off()"
        (key)="device.pressKey($event)"
        (menuPress)="device.menuPress($event)"
        (rocker)="device.rocker($event)"
        (gesture)="device.gesture($event.g, $event)"
      >
        @switch (nav.screen()) {
          @case ('homeSettings') {
            <app-settings-view kind="home" />
          }
          @case ('cas') {
            <app-cas-view />
          }
          @case ('casSettings') {
            <app-settings-view kind="cas" />
          }
          @case ('lists') {
            <app-data-catalog kind="list" />
          }
          @case ('matrices') {
            <app-data-catalog kind="matrix" />
          }
          @case ('editor') {
            <app-grid-editor />
          }
          @case ('library') {
            <app-library />
          }
          @case ('app') {
            <app-app-host />
          }
          @case ('notes') {
            <app-notes-view />
          }
          @case ('memory') {
            <app-memory-view />
          }
          @default {
            @if (rpnEntry()) {
              <app-rpn-view />
            } @else {
              <app-home-view />
            }
          }
        }
        @if (popup.mode()) {
          <app-popup />
        }
      </app-t1-device>
      <p class="foot" aria-live="polite">
        @if (backup.message(); as m) {
          <span class="msg">{{ m }}</span>
        }
        <button type="button" class="link" (click)="keyboard.helpOpen.set(true)">Keyboard</button>
      </p>
    </main>
    @if (keyboard.helpOpen()) {
      <app-shortcuts-dialog (closed)="keyboard.helpOpen.set(false)" />
    }
    @if (aboutOpen()) {
      <app-about-dialog (closed)="aboutOpen.set(false)" />
    }
    @if (backup.pending(); as p) {
      <app-modal [heading]="i18n.t('menuItem.importBackup')" (closed)="backup.pending.set(null)">
        <p>{{ i18n.t('backup.ask', { parts: p.keys.join(', ') }) }}</p>
        <div class="dialog-actions">
          <button type="button" class="btn" (click)="backup.pending.set(null)">
            {{ i18n.t('backup.cancel') }}
          </button>
          <button type="button" class="btn primary" (click)="backup.confirmImport()">
            {{ i18n.t('backup.import') }}
          </button>
        </div>
      </app-modal>
    }
  `,
  styles: `
    main {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px 0 24px;
    }
    .foot {
      margin: 10px 0 0;
      font-size: 0.85rem;
    }
    .msg {
      margin-right: 1rem;
      color: var(--page-text);
    }
    .link {
      border: 0;
      background: none;
      color: var(--page-muted);
      font: inherit;
      text-decoration: underline;
      cursor: pointer;
    }
    @media (max-width: 400px) {
      main {
        padding: 0;
      }
    }
  `,
})
export class App implements OnInit {
  protected readonly device = inject(DeviceStore);
  protected readonly keyboard = inject(T1Keyboard);
  protected readonly nav = inject(NavStore);
  private readonly settings = inject(SettingsStore);
  private readonly home = inject(HomeStore);
  private readonly rpn = inject(RpnStore);
  private readonly cas = inject(CasStore);
  protected readonly popup = inject(PopupStore);
  private readonly apps = inject(AppStore);
  protected readonly rpnEntry = computed(() => this.settings.settings().entry === 'rpn');
  protected readonly menu = inject(MenuService);
  protected readonly backup = inject(BackupService);
  private readonly notes = inject(NotesStore);
  protected readonly i18n = inject(I18n);
  protected readonly aboutOpen = signal(false);

  constructor() {
    effect(() =>
      this.device.status.set([this.settings.settings().angle === 'deg' ? 'DEG' : 'RAD']),
    );
    this.device.onGlobal('home', () => this.nav.go('home'));
    this.device.onGlobal('home.shift', () => this.nav.go('homeSettings'));
    this.device.onGlobal('cas', () => this.nav.go('cas'));
    this.device.onGlobal('cas.shift', () => this.nav.go('casSettings'));
    const open = (mode: 'toolbox' | 'vars' | 'chars' | 'units' | 'base') => () =>
      this.popup.open(mode, this.device.insertTarget());
    this.device.onGlobal('toolbox', open('toolbox'));
    this.device.onGlobal('vars', open('vars'));
    this.device.onGlobal('vars.shift', open('chars'));
    this.device.onGlobal('template.shift', open('units'));
    this.device.onGlobal('d7.shift', () => this.nav.go('lists'));
    // apps (prompt 033): library, the views of the running app and their setups, info
    this.device.onGlobal('apps', () => this.nav.go('library'));
    this.device.onGlobal('apps.shift', () => this.openApp('info'));
    for (const v of ['symb', 'plot', 'num'] as const) {
      this.device.onGlobal(v, () => this.openApp(v));
      this.device.onGlobal(`${v}.shift`, () => this.openApp(`${v}Setup`));
    }
    this.device.onGlobal('d4.shift', () => this.nav.go('matrices'));
    this.device.onGlobal('sub.shift', open('base'));
    this.device.onGlobal('d0.shift', () => this.nav.go('notes'));
    this.device.onGlobal('toolbox.shift', () => this.nav.go('memory'));
    // menu (prompt 045): one set of actions for the native menu, the HTML menu and the keyboard
    const actions: Record<string, () => void> = {
      exportBackup: () => void this.backup.exportBackup(),
      importBackup: () => void this.backup.chooseBackup(),
      importApp: () => void this.backup.importApp(),
      importNote: () => void this.backup.importNote(),
      goHome: () => this.nav.go('home'),
      goCas: () => this.nav.go('cas'),
      goApps: () => this.nav.go('library'),
      goNotes: () => this.nav.go('notes'),
      goMemory: () => this.nav.go('memory'),
      goLists: () => this.nav.go('lists'),
      goMatrices: () => this.nav.go('matrices'),
      settings: () => this.nav.go('homeSettings'),
      keyboard: () => this.keyboard.helpOpen.set(true),
      about: () => this.aboutOpen.set(true),
    };
    for (const [id, run] of Object.entries(actions)) {
      this.menu.on(id as Parameters<MenuService['on']>[0], run);
      this.keyboard.register(`menu:${id}`, run);
    }
    // the native menu follows the language
    effect(() => {
      this.i18n.lang();
      void this.menu.install().catch((e) => console.error(e));
    });
    this.device.onGlobal('help', () =>
      this.popup.open('help', this.device.insertTarget(), {
        kind: 'view',
        id: this.device.top()?.help ?? 'home',
      }),
    );
  }

  private openApp(view: Parameters<AppStore['show']>[0]): void {
    if (this.apps.show(view)) this.nav.go('app');
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.settings.load(),
      this.home.load(),
      this.rpn.load(),
      this.cas.load(),
      this.apps.load(),
      this.notes.load(),
    ]);
    await this.menu.listen().catch((e) => console.error(e));
  }
}
