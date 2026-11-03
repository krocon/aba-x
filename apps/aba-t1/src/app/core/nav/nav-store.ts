import { Injectable, signal } from '@angular/core';

/** The screens of the display (prompt 027 ff.); apps and further views join later. */
export type Screen = 'home' | 'homeSettings' | 'cas' | 'casSettings';

/** Which screen the display shows. App-level keys (Home, shift Home, …) switch it. */
@Injectable({ providedIn: 'root' })
export class NavStore {
  readonly screen = signal<Screen>('home');

  go(screen: Screen): void {
    this.screen.set(screen);
  }
}
