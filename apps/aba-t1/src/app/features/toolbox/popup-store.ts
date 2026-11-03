import { Injectable, signal } from '@angular/core';
import type { ViewContext } from '../../core/device/device-store';

export type PopupMode = 'toolbox' | 'vars' | 'chars' | 'help';

export type HelpTopic = { kind: 'command'; name: string } | { kind: 'view'; id: string };

/** Which overlay is open over the display (prompt 030) and where its insertions go. */
@Injectable({ providedIn: 'root' })
export class PopupStore {
  readonly mode = signal<PopupMode | null>(null);
  readonly topic = signal<HelpTopic>({ kind: 'view', id: 'home' });
  /** the view whose entry line receives insertions */
  target: ViewContext | null = null;

  open(mode: PopupMode, target: ViewContext | null, topic?: HelpTopic): void {
    this.target = target;
    if (topic) this.topic.set(topic);
    this.mode.set(mode);
  }

  close(): void {
    this.mode.set(null);
  }
}
