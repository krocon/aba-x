import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MathStatic } from '@aba/core/shared/math-static';
import { TEMPLATES } from './templates';

/** The template palette (prompt 027): a 4-column grid over the display, used by home and CAS. */
@Component({
  selector: 'app-template-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MathStatic],
  template: `
    <div class="templates" role="listbox" [attr.aria-label]="label()">
      @for (t of templates; track t.id; let i = $index) {
        <button
          type="button"
          role="option"
          class="tpl"
          [class.cur]="index() === i"
          [attr.aria-selected]="index() === i"
          [attr.aria-label]="t.label"
          (pointerdown)="$event.preventDefault()"
          (click)="pick.emit(i)"
        >
          <app-math [latex]="t.preview" />
        </button>
      }
    </div>
  `,
  styles: `
    .templates {
      position: absolute;
      inset: 0;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.3em;
      padding: 0.4em;
      align-content: start;
      overflow: auto;
      background: #f5f7f2;
    }
    .tpl {
      min-height: 2.6em;
      border: 1px solid #c9d5d1;
      border-radius: 0.3em;
      background: #fff;
      color: inherit;
      font: inherit;
      font-size: 0.85em;
      cursor: pointer;
    }
    .tpl.cur {
      outline: 2px solid #e8603f;
    }
  `,
})
export class TemplatePalette {
  readonly index = input(0);
  readonly label = input('Templates');
  readonly pick = output<number>();
  protected readonly templates = TEMPLATES;
}

/** Cursor movement in the 4-column palette; null = not a navigation key. */
export function paletteMove(index: number, key: string): number | null {
  const move: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 4, ArrowUp: -4 };
  if (!(key in move)) return null;
  return Math.min(TEMPLATES.length - 1, Math.max(0, index + move[key]));
}
