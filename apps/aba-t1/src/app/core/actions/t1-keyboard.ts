import { Injectable, inject, signal } from '@angular/core';
import { ActionDispatcher } from '@aba/core/actions/dispatcher';
import { DeviceStore } from '../device/device-store';
import { CHORDS, type T1Action, keyOfAction, keymapFor, physicalKey } from './keymap';

/** Inputs keep their own keys (typing, arrows, Enter) – the device only gets the rest. */
function editable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.tagName) return false;
  return (
    el.isContentEditable ||
    /^(INPUT|TEXTAREA|SELECT|MATH-FIELD)$/.test(el.tagName) ||
    !!el.closest?.('[role="dialog"]')
  );
}

/**
 * The PC keyboard of ABA-T1 (prompt 026): chords for the device keys without a PC counterpart
 * (capture phase, shared `ActionDispatcher`) and plain keys → device keys when no input has the
 * focus (bubble phase).
 */
@Injectable({ providedIn: 'root' })
export class T1Keyboard extends ActionDispatcher<T1Action> {
  private readonly device = inject(DeviceStore);
  readonly keymap = keymapFor(this.os);
  readonly helpOpen = signal(false);

  private readonly plain = (e: KeyboardEvent) => {
    if (e.defaultPrevented || editable(e.target)) return;
    const p = physicalKey(e);
    if (!p) return;
    e.preventDefault();
    if (p.kind === 'rocker') this.device.rocker(p.dir, p.shift);
    else this.device.pressLayer(p.id, p.layer, p.char);
  };

  constructor() {
    super();
    for (const b of CHORDS) {
      if (b.action === 'shortcuts') continue;
      this.register(b.action, () => {
        const m = /^menu([1-6])$/.exec(b.action);
        if (m) return this.device.menuPress(Number(m[1]) - 1, false);
        const { id, layer } = keyOfAction(b.action);
        if (id === 'shift' || id === 'alpha') return this.device.pressKey(id);
        this.device.pressLayer(id, layer);
      });
    }
    this.register('shortcuts', () => this.helpOpen.update((o) => !o));
    this.doc.addEventListener('keydown', this.plain);
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.doc.removeEventListener('keydown', this.plain);
  }
}
