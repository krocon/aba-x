import { TestBed } from '@angular/core/testing';
import { CalculatorStore, MathEditor } from './calculator-store';
import { ALL_KEYS } from './keypad/keypad-model';

class FakeEditor implements MathEditor {
  line = '';
  commands: string[] = [];
  insert(latex: string) {
    this.line += latex;
  }
  command(c: string) {
    this.commands.push(c);
  }
  latex() {
    return this.line;
  }
  clear() {
    this.line = '';
  }
  focus() {
    /* nothing to do */
  }
}

const key = (id: string) => ALL_KEYS.find((k) => k.id === id)!;

describe('CalculatorStore', () => {
  let store: CalculatorStore;
  let editor: FakeEditor;

  beforeEach(() => {
    store = TestBed.inject(CalculatorStore);
    editor = new FakeEditor();
    store.attach(editor);
  });

  it('inserts key templates and runs edit commands', () => {
    store.press(key('d7'));
    store.press(key('add'));
    store.press(key('bksp'));
    expect(editor.line).toBe('7+');
    expect(editor.commands).toEqual(['deleteBackward']);
  });

  it('applies a shift once', () => {
    store.press(key('shift-left'));
    expect(store.shift()).toBe('left');
    store.press(key('sin'));
    store.press(key('sin'));
    expect(editor.line).toBe('\\arcsin(#0)\\sin(#0)');
    expect(store.shift()).toBe('none');
  });

  it('ENTER pushes the line, an empty line duplicates level 1', () => {
    editor.line = 'x^2';
    store.press(key('enter'));
    expect(editor.line).toBe('');
    store.press(key('enter'));
    expect(store.stack().map((e) => e.latex)).toEqual(['x^2', 'x^2']);
    store.enter();
    expect(store.stack().length).toBe(3);
  });

  it('ENTER on an empty line and an empty stack does nothing', () => {
    store.enter();
    expect(store.stack()).toEqual([]);
  });

  it('DROP, SWAP and RECALL work on the stack', () => {
    for (const l of ['a', 'b']) {
      editor.line = l;
      store.enter();
    }
    store.press(key('shift-left'));
    store.press(key('left'));
    expect(store.stack().map((e) => e.latex)).toEqual(['b', 'a']);
    store.press(key('shift-left'));
    store.press(key('up'));
    expect(editor.line).toBe('a');
    store.press(key('shift-left'));
    store.press(key('bksp'));
    expect(store.stack().map((e) => e.latex)).toEqual(['b']);
  });

  it('says so for planned functions', () => {
    store.press(key('sto'));
    expect(store.message()).toContain('STO');
    store.press(key('d1'));
    expect(store.message()).toBeNull();
  });
});
