import { compile } from './parser';

const error = (src: string) => {
  const r = compile(src);
  if (r.ok) throw new Error('expected a syntax error');
  return `${r.error.line}:${r.error.column} ${r.error.message}`;
};

describe('compile – valid programs', () => {
  it('lists exported functions with their parameters', () => {
    const r = compile(`
      EXPORT AREA(w, h)
      BEGIN
        RETURN w * h;
      END;
      helper(x) BEGIN RETURN x; END;
      export Zero() begin return 0; end;
    `);
    expect(r.ok && r.value.exports).toEqual([
      { name: 'AREA', params: ['w', 'h'] },
      { name: 'Zero', params: [] },
    ]);
  });

  it('accepts forward declarations, program-wide LOCALs and comments', () => {
    const r = compile(`
      // program with a forward declaration
      LOCAL count := 0, limit;
      LATER();
      EXPORT FIRST() BEGIN RETURN LATER(); END;
      LATER() BEGIN RETURN 1; END;
    `);
    expect(r.ok).toBe(true);
    expect(r.ok && r.value.variables.map((v) => v.name)).toEqual(['count', 'limit']);
  });

  it('allows a missing semicolon before END, ELSE and UNTIL', () => {
    const r = compile(`EXPORT T() BEGIN
      IF 1 THEN RETURN 1 ELSE RETURN 2 END;
      REPEAT A := A + 1 UNTIL A > 3;
      RETURN A
    END;`);
    expect(r.ok).toBe(true);
  });

  it('accepts all statement forms', () => {
    const r = compile(`EXPORT ALL(n) BEGIN
      LOCAL i, s := 0, L := {1, "two", [[1, 2], [3, 4]]};
      FOR i FROM 1 TO n STEP 2 DO s := s + i; END;
      FOR i := n DOWNTO 1 DO CONTINUE; END;
      WHILE s > 0 DO s := s - 1; IF s == 3 THEN BREAK; END; END;
      REPEAT s := s + 1; UNTIL s ≥ 10;
      CASE IF s < 0 THEN s := 0; END; IF s = 10 THEN s := 1; END; DEFAULT s := 2; END;
      L(1) := NOT 0 AND 1 OR 0 XOR 1;
      RETURN s MOD 3 + 2^3^2 - -1 + 3!;
    END;`);
    expect(r.ok).toBe(true);
  });
});

describe('compile – syntax errors with positions', () => {
  it('reports a missing THEN', () => {
    expect(error('EXPORT F()\nBEGIN\n  IF 1 RETURN 2; END;\nEND;')).toBe(
      "3:8 expected THEN after the IF condition, found 'RETURN'",
    );
  });

  it('reports a missing semicolon between statements', () => {
    expect(error('EXPORT F() BEGIN\n  A := 1\n  B := 2;\nEND;')).toBe(
      "3:3 expected ';' after the statement, found 'B'",
    );
  });

  it('reports an unclosed function at the end of the program', () => {
    expect(error('EXPORT F() BEGIN\n  RETURN 1;\n')).toMatch(/^3:1 expected END to close F/);
  });

  it('reports an unterminated string', () => {
    expect(error('EXPORT F() BEGIN\n  PRINT("hi);\nEND;')).toBe('2:9 unterminated string');
  });

  it('reports BREAK outside of a loop', () => {
    expect(error('EXPORT F() BEGIN BREAK; END;')).toBe('1:18 BREAK outside of a loop');
  });

  it('reports a wrong number of arguments of a user function', () => {
    expect(error('G(a, b) BEGIN RETURN a; END;\nEXPORT F() BEGIN RETURN G(1); END;')).toBe(
      '2:25 G takes 2 argument(s), not 1',
    );
  });

  it('reports a wrong number of arguments of a catalogue function', () => {
    expect(error('EXPORT F() BEGIN RETURN SIN(1, 2); END;')).toBe(
      '1:25 SIN takes 1 argument(s), not 2',
    );
  });

  it('reports a function defined twice', () => {
    expect(error('F() BEGIN END;\nf() BEGIN END;')).toBe('2:1 function f is defined twice');
  });

  it('reports a reserved word used as a name', () => {
    expect(error('EXPORT F() BEGIN LOCAL end; END;')).toMatch(
      /^1:24 expected a name after LOCAL.*END is a reserved word/,
    );
  });

  it('reports an assignment to something that is not a variable', () => {
    expect(error('EXPORT F() BEGIN 3 := 4; END;')).toBe(
      '1:20 only a variable or an indexed variable can be assigned',
    );
  });

  it('reports ragged matrices', () => {
    expect(error('EXPORT F() BEGIN RETURN [[1, 2], [3]]; END;')).toBe(
      '1:25 all rows of a matrix need the same number of entries',
    );
  });

  it('reports a declared but undefined function', () => {
    expect(error('MISSING();\nEXPORT F() BEGIN RETURN 1; END;')).toBe(
      '1:1 function MISSING is declared but never defined',
    );
  });

  it('reports unsupported # directives', () => {
    expect(error('#cas\nF(x) BEGIN END;\n#end')).toMatch(/^1:1 #-directives/);
  });

  it('reports a statement outside of a function', () => {
    expect(error('A := 5;')).toMatch(/^1:3 expected '\(' after A/);
  });

  it('reports an incomplete expression', () => {
    expect(error('EXPORT F() BEGIN RETURN 1 + ; END;')).toBe(
      "1:29 unexpected ';' in an expression",
    );
  });
});
