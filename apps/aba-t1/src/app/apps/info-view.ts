import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  viewChild,
} from '@angular/core';
import { DeviceStore } from '../core/device/device-store';
import { I18n } from '../core/i18n/i18n';
import { AppStore } from './app-store';

/** Notes of the running app (Info, ⇧Apps – prompt 033); stored with the app. */
@Component({
  selector: 'app-info-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <textarea
      #text
      [attr.aria-label]="i18n.t('app.info') + ': ' + apps.current().name"
      [value]="apps.current().info"
      (input)="apps.setInfo($any($event.target).value)"
    ></textarea>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    textarea {
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      border: 0;
      padding: 0.4em 0.6em;
      font: inherit;
      font-size: 4cqw;
      resize: none;
      outline: none;
      background: var(--lcd-bg);
    }
  `,
})
export class InfoView implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  protected readonly apps = inject(AppStore);
  private readonly device = inject(DeviceStore);
  private readonly text = viewChild<ElementRef<HTMLTextAreaElement>>('text');
  private pop: (() => void) | null = null;

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'info',
      title: () => `${this.apps.current().name} · ${this.i18n.t('app.info')}`,
      menu: () => [
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: 'OK' },
      ],
      key: (p) => {
        if (p.id === 'esc') this.back();
        return p.id === 'esc';
      },
      menuPress: (i) => {
        if (i === 5) this.back();
      },
      insert: (_l, t) => {
        const el = this.text()?.nativeElement;
        if (!el) return;
        el.setRangeText(t, el.selectionStart, el.selectionEnd, 'end');
        this.apps.setInfo(el.value);
      },
    });
    queueMicrotask(() => this.text()?.nativeElement.focus());
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  private back(): void {
    this.apps.show(this.apps.currentDef().start);
  }
}
