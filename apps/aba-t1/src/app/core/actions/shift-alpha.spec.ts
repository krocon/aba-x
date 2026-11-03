import { keyById } from '../../features/device/keypad-model';
import { IDLE, type ModState, annunciators, step } from './shift-alpha';

const k = (id: string) => keyById(id)!;

function run(ids: string[], state: ModState = IDLE) {
  const presses = [];
  for (const id of ids) {
    const r = step(state, k(id));
    state = r.state;
    if (r.press) presses.push(r.press);
  }
  return { state, presses };
}

describe('shift/alpha', () => {
  it.each([
    [['sin'], { id: 'sin', layer: 'main' }],
    [['shift', 'sin'], { id: 'sin', layer: 'shift' }],
    [['alpha', 'sin'], { id: 'sin', layer: 'alpha', char: 'G' }],
    [['shift', 'alpha', 'sin'], { id: 'sin', layer: 'alpha', char: 'g' }],
    [['alpha', 'enter'], { id: 'enter', layer: 'main' }],
    [['shift', 'space'], { id: 'space', layer: 'shift' }],
    [['shift', 'alpha', 'shift', 'shift', 'cos'], { id: 'cos', layer: 'alpha', char: 'h' }],
  ])('%j → %j', (ids, last) => {
    expect(run(ids).presses.at(-1)).toEqual(last);
  });

  it('shift acts once, shift twice cancels', () => {
    expect(run(['shift', 'sin', 'sin']).presses.map((p) => p.layer)).toEqual(['shift', 'main']);
    expect(run(['shift', 'shift', 'sin']).presses[0].layer).toBe('main');
  });

  it('alpha once types one letter, twice locks, three times releases', () => {
    expect(run(['alpha', 'sin', 'cos']).presses.map((p) => p.layer)).toEqual(['alpha', 'main']);
    const locked = run(['alpha', 'alpha', 'sin', 'cos', 'tan']);
    expect(locked.presses.map((p) => p.char).join('')).toBe('GHI');
    expect(locked.state.alpha).toBe('lock');
    expect(run(['alpha', 'alpha', 'alpha']).state).toEqual(IDLE);
    // a key without a letter does not end the lock, a key without alpha legend falls back
    const lock = run(['alpha', 'alpha', 'enter', 'sin']);
    expect(lock.presses.map((p) => p.layer)).toEqual(['main', 'alpha']);
  });

  it('Esc releases shift and alpha lock', () => {
    const r = run(['alpha', 'alpha', 'esc']);
    expect(r.state).toEqual(IDLE);
    expect(r.presses).toEqual([{ id: 'esc', layer: 'main' }]);
    expect(run(['shift', 'esc']).presses[0]).toEqual({ id: 'esc', layer: 'shift' });
  });

  it('shows annunciators', () => {
    expect(annunciators(IDLE)).toEqual([]);
    expect(annunciators({ shift: true, alpha: 'lock', lower: true })).toEqual(['⇧', 'a🔒']);
  });
});
