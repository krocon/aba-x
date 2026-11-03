import { Injectable, signal } from '@angular/core';

/** The screens of the display (prompt 027 ff.); apps and further views join later. */
export type Screen =
  | 'home'
  | 'homeSettings'
  | 'cas'
  | 'casSettings'
  | 'lists'
  | 'matrices'
  | 'editor'
  | 'library'
  | 'app'
  | 'notes'
  | 'memory'
  | 'programs'
  | 'programEditor'
  | 'terminal';

/** Which screen the display shows. App-level keys (Home, shift Home, …) switch it. */
@Injectable({ providedIn: 'root' })
export class NavStore {
  readonly screen = signal<Screen>('home');
  /** what the screen works on (the variable of the editor) */
  readonly param = signal<string>('');

  go(screen: Screen, param = ''): void {
    this.param.set(param);
    this.screen.set(screen);
  }
}
