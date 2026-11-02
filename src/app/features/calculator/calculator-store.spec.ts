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
  const levels = () => store.stack().map((e) => e.latex);
  const type = async (latex: string, approx = false) => {
    editor.line = latex;
    await store.enter(approx);
  };

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
    store.press(key('d1'));
    store.press(key('shift-left'));
    expect(store.shift()).toBe('left');
    store.press(key('sin'));
    store.press(key('sin'));
    expect(editor.line).toBe('1\\arcsin(#0)\\sin(#0)');
    expect(store.shift()).toBe('none');
  });

  it('ENTER evaluates exactly and adds an approximation', async () => {
    await type('\\frac{1}{3}+\\frac{1}{6}');
    expect(levels()).toEqual(['\\frac{1}{2}']);
    expect(store.stack()[0].approx).toBe('0.5');
    await type('\\sqrt{8}');
    expect(levels()[1]).toBe('2\\sqrt{2}');
    expect(store.stack()[1].approx).toBe('2.82842712475');
    expect(editor.line).toBe('');
  });

  it('→NUM gives the decimal value, also for level 1', async () => {
    await type('\\sqrt{2}', true);
    expect(levels()).toEqual(['1.41421356237']);
    await type('\\pi');
    await store.enter(true);
    expect(levels()).toEqual(['1.41421356237', '3.14159265359']);
  });

  it('keeps the line and shows the error', async () => {
    await type('\\frac{1}{0}');
    expect(store.message()).toContain('division by zero');
    expect(editor.line).toBe('\\frac{1}{0}');
    expect(store.stack()).toEqual([]);
    await type('\\sqrt{-1}');
    expect(store.message()).toMatch(/negative|complex/);
  });

  it('degrees', async () => {
    store.toggleAngle();
    await type('\\sin(30)');
    expect(levels()).toEqual(['\\frac{1}{2}']);
  });

  it('Ans and an empty line duplicating level 1', async () => {
    await type('6');
    await store.enter();
    await type('\\mathrm{Ans}\\cdot7');
    expect(levels()).toEqual(['6', '6', '42']);
  });

  it('RPN: operators and functions on an empty line use the stack', async () => {
    await type('3');
    await type('4');
    store.press(key('add'));
    await vi.waitFor(() => expect(levels()).toEqual(['7']));
    await type('2');
    store.press(key('pow'));
    await vi.waitFor(() => expect(levels()).toEqual(['49']));
    store.press(key('sqrt'));
    await vi.waitFor(() => expect(levels()).toEqual(['7']));
    store.press(key('neg'));
    await vi.waitFor(() => expect(levels()).toEqual(['-7']));
  });

  it('queues keys pressed while a computation runs', async () => {
    editor.line = '7+2';
    const running = store.enter();
    store.press(key('sqrt')); // RPN on the result, after 9 is on the stack
    store.press(key('d1'));
    await running;
    await vi.waitFor(() => expect(levels()).toEqual(['3']));
    expect(editor.line).toBe('1');
  });

  it('DROP, SWAP and RECALL work on the stack', async () => {
    await type('1');
    await type('2');
    store.press(key('shift-left'));
    store.press(key('left'));
    expect(levels()).toEqual(['2', '1']);
    store.press(key('shift-left'));
    store.press(key('up'));
    expect(editor.line).toBe('1');
    editor.line = '';
    store.press(key('shift-left'));
    store.press(key('bksp'));
    expect(levels()).toEqual(['2']);
  });

  it('says so for planned functions', () => {
    store.press(key('sto'));
    expect(store.message()).toContain('STO');
    store.press(key('d1'));
    expect(store.message()).toBeNull();
  });
});
