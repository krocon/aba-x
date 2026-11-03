import { describe, expect, it } from 'vitest';
import type { Expr } from '../ast/nodes';
import { parseText } from '../parser/text-parser';
import { equationSides, equationVariables, residualFunction, solveEquations } from './equations';

const p = (s: string): Expr => {
  const r = parseText(s);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

describe('equations', () => {
  it('reads an equation and a bare expression', () => {
    expect(equationSides(p('A=B+1')).ok).toBe(true);
    const s = equationSides(p('X^2-4'));
    expect(s.ok && s.value.right).toEqual({ type: 'num', value: '0' });
    expect(equationSides(p('X<1')).ok).toBe(false);
  });

  it('lists the variables without constants', () => {
    expect(equationVariables([p('V=P*R^2*pi'), p('E=M*C^2+e')])).toEqual([
      'C',
      'E',
      'M',
      'P',
      'R',
      'V',
    ]);
  });

  it('evaluates left − right', () => {
    const f = residualFunction(p('Y=2*X+1'), ['X', 'Y']);
    expect(f([1, 3])).toBe(0);
    expect(f([1, 5])).toBe(2);
    expect(Number.isNaN(residualFunction(p('Y=1/X'), ['X', 'Y'])([0, 1]))).toBe(true);
  });

  it('solves for any of three variables', () => {
    // ideal gas P·V = N·R·T with R fixed in the equation
    const eq = [p('P*V=N*8.314*T')];
    const names = equationVariables(eq); // N, P, T, V
    expect(names).toEqual(['N', 'P', 'T', 'V']);
    const vals = [1, 101325, 273.15, 0.02];
    const r = solveEquations(eq, names, vals, [3]);
    expect(r.ok && r.value.solved).toBe(true);
    if (r.ok) expect(r.value.values[3]).toBeCloseTo((8.314 * 273.15) / 101325, 12);
    const t = solveEquations(eq, names, vals, [2]);
    if (t.ok) expect(t.value.values[2]).toBeCloseTo((101325 * 0.02) / 8.314, 9);
    expect(t.ok && t.value.outcome?.kind).toBe('zero');
  });

  it('reports an equation without a zero honestly', () => {
    const r = solveEquations([p('X^2+1=0')], ['X'], [0.5], [0]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.solved).toBe(false);
      expect(r.value.outcome?.kind).toBe('extremum');
    }
    const s = solveEquations([p('1/X=0')], ['X'], [1], [0]);
    expect(s.ok && s.value.solved).toBe(false);
  });

  it('solves a system of two equations', () => {
    const eq = [p('X^2+Y^2=25'), p('Y=X+1')];
    const r = solveEquations(eq, ['X', 'Y'], [2, 2], [0, 1]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.values[0]).toBeCloseTo(3, 9);
      expect(r.value.values[1]).toBeCloseTo(4, 9);
    }
  });

  it('refuses mismatched counts', () => {
    const eq = [p('X+Y=1'), p('X-Y=0')];
    expect(solveEquations(eq, ['X', 'Y'], [0, 0], [0]).ok).toBe(false);
    expect(solveEquations([p('X+Y=1')], ['X', 'Y'], [0, 0], [0, 1]).ok).toBe(false);
    expect(solveEquations([p('X=1')], ['X', 'Y'], [0, 0], [1]).ok).toBe(false);
    expect(solveEquations([p('X=1')], ['X'], [0], []).ok).toBe(false);
  });
});
