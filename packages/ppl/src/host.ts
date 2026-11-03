/**
 * The host interface: everything a program sees of the outside world – global variables (A–Z, app
 * variables), the terminal, dialogs, the keyboard, a clock and the graphics screens G0–G9
 * (320 × 240 logical pixels). The interpreter knows nothing else; a worker forwards these calls as
 * messages to the UI, tests use a fake. Graphics commands are plain objects (structured-clone safe),
 * drawn by the host into its screen buffers.
 */
import type { PplValue } from './values';

/** Logical size of the graphics screens G0–G9. */
export const SCREEN_WIDTH = 320;
export const SCREEN_HEIGHT = 240;

/** Pixel coordinates (`…_P` commands) or Cartesian coordinates of the plot window (plain names). */
export type Coords = 'pixel' | 'cartesian';

/** Colours are 24-bit RGB integers (`RGB(255, 0, 0)` = 0xFF0000); absent = the host's default. */
export type GfxCommand =
  | {
      readonly op: 'rect';
      readonly screen: number;
      readonly coords: Coords;
      /** absent = the whole screen */
      readonly x1?: number;
      readonly y1?: number;
      readonly x2?: number;
      readonly y2?: number;
      readonly edge?: number;
      readonly fill?: number;
    }
  | {
      readonly op: 'line';
      readonly screen: number;
      readonly coords: Coords;
      readonly x1: number;
      readonly y1: number;
      readonly x2: number;
      readonly y2: number;
      readonly color?: number;
    }
  | {
      readonly op: 'pixon';
      readonly screen: number;
      readonly coords: Coords;
      readonly x: number;
      readonly y: number;
      readonly color?: number;
    }
  | {
      readonly op: 'textout';
      readonly screen: number;
      readonly coords: Coords;
      readonly text: string;
      readonly x: number;
      readonly y: number;
      /** font size index 0–7 (0 = system default) */
      readonly font?: number;
      readonly color?: number;
      /** clip width in pixels */
      readonly width?: number;
      readonly background?: number;
    }
  | {
      readonly op: 'fillpoly';
      readonly screen: number;
      readonly coords: Coords;
      readonly points: readonly (readonly [number, number])[];
      readonly color?: number;
    }
  | {
      readonly op: 'blit';
      readonly coords: Coords;
      readonly target: number;
      /** destination rectangle; absent = the whole target screen */
      readonly dx1?: number;
      readonly dy1?: number;
      readonly dx2?: number;
      readonly dy2?: number;
      readonly source: number;
      /** source rectangle; absent = the whole source screen */
      readonly sx1?: number;
      readonly sy1?: number;
      readonly sx2?: number;
      readonly sy2?: number;
      /** pixels of this colour are not copied */
      readonly transparent?: number;
    };

/** One field of an INPUT form. */
export interface InputField {
  /** the variable the value goes to */
  readonly name: string;
  readonly label: string;
  readonly help: string;
  /** current value (shown in the form) */
  readonly value: PplValue;
}

export interface Host {
  /** A global variable (A–Z, app variables); undefined = unknown. */
  get(name: string): PplValue | undefined;
  /** Stores a global variable; `false` = refused (read-only or unknown name). */
  set(name: string, value: PplValue): boolean | void;
  /** A line in the terminal. */
  print(text: string): void;
  /** Clears the terminal (`PRINT()`); optional. */
  clearTerminal?(): void;
  /** A form with one field per variable; resolves to the new values, or null when cancelled. */
  input(title: string, fields: readonly InputField[]): Promise<readonly PplValue[] | null>;
  msgbox(text: string): Promise<void>;
  /** A choice; resolves to the 1-based item, 0 when cancelled. */
  choose(title: string, items: readonly string[]): Promise<number>;
  /** The oldest key in the key buffer (removed from it), null when empty. */
  getKey(): number | null;
  isKeyDown(code: number): boolean;
  /** Waits; `seconds <= 0` waits for a key (the host decides). Should settle on cancel. */
  wait(seconds: number): Promise<void>;
  gfx(command: GfxCommand): void;
}
