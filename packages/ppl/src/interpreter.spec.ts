import { FakeHost, num, runSource, value } from './testing/fake-host';
import { str } from './values';

const fn = (body: string, params = '') => `EXPORT T(${params})\nBEGIN\n${body}\nEND;`;

describe('run – expressions', () => {
  it('computes with precedence and right-associative powers', async () => {
    expect(await value(fn('RETURN 2 + 3 * 4 - 2^3^2 / 64;'), 'T')).toBe('6');
    expect(await value(fn('RETURN -2^2;'), 'T')).toBe('-4');
    expect(await value(fn('RETURN 17 MOD 5 + 4!;'), 'T')).toBe('26');
  });

  it('uses the math catalogue in any case', async () => {
    expect(await value(fn('RETURN SIN(0) + cos(0) + SQRT(16) + nCr(5, 2) + NCR(4, 2);'), 'T')).toBe(
      '21',
    );
  });

  it('respects the angle mode', async () => {
    expect(await value(fn('RETURN SIN(90);'), 'T', [], undefined, { angle: 'deg' })).toBe('1');
  });

  it('compares with == and =, ≠ and <>', async () => {
    expect(
      await value(
        fn('RETURN {1 == 1, 2 = 3, 2 ≠ 3, 2 <> 2, 2 <= 2, 3 >= 4, 0.1 + 0.2 == 0.3};'),
        'T',
      ),
    ).toBe('{1, 0, 1, 0, 1, 0, 1}');
  });

  it('evaluates AND, OR, NOT, XOR (short-circuit)', async () => {
    expect(await value(fn('RETURN {1 AND 0, 1 OR 0, NOT 0, 1 XOR 1, 0 AND (1/0)};'), 'T')).toBe(
      '{0, 1, 1, 0, 0}',
    );
  });

  it('handles complex numbers through the math core', async () => {
    expect(await value(fn('RETURN (2 + 3*i) * (2 - 3*i) + SQRT(-4);'), 'T')).toBe('13+2*i');
  });

  it('reports division by zero with the position of the operation', async () => {
    expect(await value(fn('LOCAL a := 0;\nRETURN 1 + 5 / a;'), 'T')).toBe(
      'error division-by-zero 4:12 division by zero',
    );
  });

  it('reports unknown variables and functions', async () => {
    expect(await value(fn('RETURN foo + 1;'), 'T')).toMatch(
      /^error unknown-symbol 3:8 unknown variable foo/,
    );
    expect(await value(fn('RETURN bar(2);'), 'T')).toMatch(
      /^error unknown-function 3:8 unknown function or variable bar/,
    );
  });
});

describe('run – variables and scopes', () => {
  it('reads parameters and LOCALs; LOCAL without value is 0', async () => {
    expect(await value(fn('LOCAL x, y := a * 2;\nRETURN x + y;', 'a'), 'T', [21])).toBe('42');
  });

  it('writes global variables A–Z through the host', async () => {
    const host = new FakeHost();
    host.globals.set('B', num(5));
    const r = await runSource(fn('A := B * 2; RETURN A;'), 'T', [], host);
    expect(r.ok).toBe(true);
    expect(host.globals.get('A')).toEqual(num(10));
  });

  it('keeps a LOCAL apart from a global of the same name', async () => {
    const host = new FakeHost();
    host.globals.set('A', num(7));
    const r = await value(fn('LOCAL A := 1; A := A + 1; RETURN A;'), 'T', [], host);
    expect(r).toBe('2');
    expect(host.globals.get('A')).toEqual(num(7));
  });

  it('gives every call its own locals', async () => {
    const src = `
      inner(n) BEGIN LOCAL x := n * 10; RETURN x; END;
      EXPORT T() BEGIN LOCAL x := 1; inner(5); RETURN x; END;`;
    expect(await value(src, 'T')).toBe('1');
  });

  it('shares program-wide LOCALs between functions', async () => {
    const src = `
      LOCAL counter := 100;
      bump() BEGIN counter := counter + 1; END;
      EXPORT T() BEGIN bump(); bump(); RETURN counter; END;`;
    expect(await value(src, 'T')).toBe('102');
  });

  it('refuses assignments to unknown globals', async () => {
    expect(await value(fn('undeclared := 3;'), 'T')).toMatch(
      /^error type 3:1 undeclared cannot be assigned/,
    );
  });

  it('a function without RETURN returns the value of its last statement', async () => {
    expect(await value('EXPORT T(x) BEGIN x * 3; END;', 'T', [4])).toBe('12');
  });

  it('runs only exported functions with the right number of arguments', async () => {
    const src = 'hidden() BEGIN RETURN 1; END; EXPORT T(a) BEGIN RETURN a; END;';
    expect(await value(src, 'hidden')).toMatch(
      /^error unknown-function .* not an exported function/,
    );
    expect(await value(src, 't', [1, 2])).toMatch(/takes 1 argument/);
    expect(await value(src, 't', [9])).toBe('9');
  });
});

describe('run – control flow', () => {
  it('IF / ELSE', async () => {
    const src = fn(
      'IF x > 0 THEN RETURN "pos"; ELSE IF x < 0 THEN RETURN "neg"; ELSE RETURN "zero"; END; END;',
      'x',
    );
    expect(await value(src, 'T', [5])).toBe('"pos"');
    expect(await value(src, 'T', [-5])).toBe('"neg"');
    expect(await value(src, 'T', [0])).toBe('"zero"');
  });

  it('CASE takes the first true arm, else DEFAULT', async () => {
    const src = fn(
      `CASE
        IF x < 10 THEN RETURN 1; END;
        IF x < 100 THEN RETURN 2; END;
        DEFAULT RETURN 3;
      END;`,
      'x',
    );
    expect([
      await value(src, 'T', [5]),
      await value(src, 'T', [50]),
      await value(src, 'T', [500]),
    ]).toEqual(['1', '2', '3']);
  });

  it('FOR with STEP and DOWNTO', async () => {
    expect(
      await value(
        fn('LOCAL i, s := 0; FOR i FROM 1 TO 10 STEP 3 DO s := s + i; END; RETURN {s, i};'),
        'T',
      ),
    ).toBe('{22, 13}');
    expect(
      await value(
        fn('LOCAL i, L := {}; FOR i FROM 5 DOWNTO 1 STEP 2 DO L := CONCAT(L, i); END; RETURN L;'),
        'T',
      ),
    ).toBe('{5, 3, 1}');
  });

  it('FOR with a fractional step does not lose the last value', async () => {
    expect(
      await value(
        fn('LOCAL t, n := 0; FOR t FROM 0 TO 0.3 STEP 0.1 DO n := n + 1; END; RETURN n;'),
        'T',
      ),
    ).toBe('4');
  });

  it('FOR does not run when the range is empty', async () => {
    expect(
      await value(fn('LOCAL i, n := 0; FOR i FROM 5 TO 1 DO n := n + 1; END; RETURN n;'), 'T'),
    ).toBe('0');
  });

  it('rejects a non-positive STEP', async () => {
    expect(await value(fn('LOCAL i; FOR i FROM 1 TO 5 STEP 0 DO END;'), 'T')).toMatch(
      /^error domain 3:33 STEP must be positive/,
    );
  });

  it('BREAK and CONTINUE', async () => {
    const src = fn(`LOCAL i, s := 0;
      FOR i FROM 1 TO 100 DO
        IF i MOD 2 == 0 THEN CONTINUE; END;
        IF i > 9 THEN BREAK; END;
        s := s + i;
      END;
      RETURN s;`);
    expect(await value(src, 'T')).toBe('25');
  });

  it('WHILE and REPEAT', async () => {
    expect(await value(fn('LOCAL n := 1; WHILE n < 1000 DO n := n * 2; END; RETURN n;'), 'T')).toBe(
      '1024',
    );
    expect(await value(fn('LOCAL n := 50; REPEAT n := n + 1; UNTIL n > 3; RETURN n;'), 'T')).toBe(
      '51',
    );
    expect(
      await value(
        fn('LOCAL n := 0; REPEAT n := n + 1; IF n == 4 THEN BREAK; END; UNTIL 0; RETURN n;'),
        'T',
      ),
    ).toBe('4');
  });

  it('RETURN leaves nested loops', async () => {
    const src = fn(`LOCAL i, j;
      FOR i FROM 1 TO 10 DO FOR j FROM 1 TO 10 DO IF i * j == 42 THEN RETURN {i, j}; END; END; END;`);
    expect(await value(src, 'T')).toBe('{6, 7}');
  });

  it('a condition must be a number', async () => {
    expect(await value(fn('IF "yes" THEN RETURN 1; END;'), 'T')).toMatch(
      /^error type 3:4 a condition must be a number, not a string/,
    );
  });
});

describe('run – recursion', () => {
  it('factorial', async () => {
    const src = 'EXPORT FAK(n) BEGIN IF n <= 1 THEN RETURN 1; END; RETURN n * FAK(n - 1); END;';
    expect(await value(src, 'FAK', [5])).toBe('120');
    expect(await value(src, 'fak', [20])).toBe('2.43290200818E18');
  });

  it('fibonacci (tree recursion)', async () => {
    const src =
      'EXPORT FIB(n) BEGIN IF n < 2 THEN RETURN n; END; RETURN FIB(n - 1) + FIB(n - 2); END;';
    expect(await value(src, 'FIB', [20])).toBe('6765');
  });

  it('mutual recursion with a forward declaration', async () => {
    const src = `ODD(n);
      EXPORT EVEN(n) BEGIN IF n == 0 THEN RETURN 1; END; RETURN ODD(n - 1); END;
      ODD(n) BEGIN IF n == 0 THEN RETURN 0; END; RETURN EVEN(n - 1); END;`;
    expect(await value(src, 'EVEN', [10])).toBe('1');
    expect(await value(src, 'EVEN', [7])).toBe('0');
  });

  it('stops endless recursion at the recursion limit', async () => {
    const src = 'EXPORT DOWN(n) BEGIN\n  RETURN DOWN(n + 1);\nEND;';
    expect(await value(src, 'DOWN', [0], undefined, { maxDepth: 50 })).toBe(
      'error recursion-limit 2:10 more than 50 nested calls of DOWN – endless recursion?',
    );
  });

  it('allows deep but finite recursion within the default limit', async () => {
    const src = 'EXPORT TRI(n) BEGIN IF n == 0 THEN RETURN 0; END; RETURN n + TRI(n - 1); END;';
    expect(await value(src, 'TRI', [190])).toBe('18145');
    expect(await value(src, 'TRI', [250])).toMatch(/^error recursion-limit .* more than 200/);
  });

  it('caps the recursion limit (no stack overflow, no unbounded memory)', async () => {
    const src = 'EXPORT DOWN(n) BEGIN RETURN DOWN(n + 1); END;';
    expect(await value(src, 'DOWN', [0], undefined, { maxDepth: 1e9 })).toMatch(
      /^error recursion-limit /,
    );
  });
});

describe('run – strings', () => {
  it('concatenates strings with + and numbers turn into text', async () => {
    expect(await value(fn('RETURN "x = " + 2.5 + ", " + {1, 2};'), 'T')).toBe('"x = 2.5, {1, 2}"');
  });

  it('compares strings', async () => {
    expect(await value(fn('RETURN {"ab" == "ab", "ab" < "b", "a" ≠ "a", "1" == 1};'), 'T')).toBe(
      '{1, 1, 0, 0}',
    );
  });

  it('string builtins', async () => {
    expect(
      await value(
        fn(
          'LOCAL s := "Calculator"; RETURN {DIM(s), LEFT(s, 4), RIGHT(s, 3), MID(s, 2, 3), INSTRING(s, "cul"), UPPER("ab"), CHAR(ASC("A") + 1), s(1)};',
        ),
        'T',
      ),
    ).toBe('{10, "Calc", "tor", "alc", 4, "AB", "B", "C"}');
  });

  it('a string is not a number', async () => {
    expect(await value(fn('RETURN "a" * 2;'), 'T')).toMatch(
      /^error type 3:8 \* is not defined for strings/,
    );
  });

  it('STRING formats values', async () => {
    expect(await value(fn('RETURN STRING(1/4) + STRING([[1, 2]]);'), 'T')).toBe('"0.25[[1, 2]]"');
  });
});

describe('run – lists and matrices', () => {
  it('indexes lists and matrices inside programs', async () => {
    expect(
      await value(
        fn('LOCAL L := {10, 20, 30}, M := [[1, 2], [3, 4]]; RETURN {L(2), M(2, 1), SIZE(L)};'),
        'T',
      ),
    ).toBe('{20, 3, 3}');
  });

  it('assigns list items and appends one beyond the end', async () => {
    expect(await value(fn('LOCAL L := {1, 2, 3}; L(2) := 5; L(4) := 9; RETURN L;'), 'T')).toBe(
      '{1, 5, 3, 9}',
    );
  });

  it('assigns matrix entries', async () => {
    expect(await value(fn('LOCAL M := [[1, 2], [3, 4]]; M(1, 2) := 7; RETURN M;'), 'T')).toBe(
      '[[1, 7], [3, 4]]',
    );
  });

  it('index assignment does not change a copy (value semantics)', async () => {
    expect(await value(fn('LOCAL a := {1, 2}, b; b := a; a(1) := 99; RETURN {a, b};'), 'T')).toBe(
      '{{99, 2}, {1, 2}}',
    );
  });

  it('a list passed to a function is not changed by the callee', async () => {
    const src = `
      change(L) BEGIN L(1) := 0; RETURN L; END;
      EXPORT T() BEGIN LOCAL L := {5, 6}; LOCAL r := change(L); RETURN {L, r}; END;`;
    expect(await value(src, 'T')).toBe('{{5, 6}, {0, 6}}');
  });

  it('reports an index out of range with its position', async () => {
    expect(await value(fn('LOCAL L := {1, 2};\nRETURN L(3);'), 'T')).toBe(
      'error index 4:8 item 3 of L does not exist (1…2)',
    );
  });

  it('indexes a global list variable from the host', async () => {
    const host = new FakeHost();
    host.globals.set('L1', { kind: 'list', items: [num(4), num(8)] });
    expect(await value(fn('L1(1) := 5; RETURN L1(1) + L1(2);'), 'T', [], host)).toBe('13');
    expect(host.globals.get('L1')).toEqual({ kind: 'list', items: [num(5), num(8)] });
  });

  it('computes with lists and matrices in the math core', async () => {
    expect(
      await value(fn('RETURN {DET([[2, 1], [1, 3]]), {1, 2} * 3, CONCAT({1}, {2, 3})};'), 'T'),
    ).toBe('{5, {3, 6}, {1, 2, 3}}');
  });
});

describe('run – EXPR', () => {
  it('evaluates a string with the current locals', async () => {
    expect(await value(fn('LOCAL x := 4; RETURN EXPR("x^2 + " + 1);'), 'T')).toBe('17');
  });

  it('calls user functions from EXPR', async () => {
    const src = 'sq(x) BEGIN RETURN x * x; END; EXPORT T() BEGIN RETURN EXPR("sq(7)"); END;';
    expect(await value(src, 'T')).toBe('49');
  });

  it('reports a syntax error inside EXPR at the EXPR call', async () => {
    expect(await value(fn('RETURN EXPR("1 +");'), 'T')).toMatch(
      /^error syntax 3:8 EXPR: the expression is incomplete/,
    );
  });
});

describe('run – host I/O', () => {
  it('PRINT writes to the terminal, PRINT() clears it', async () => {
    const host = new FakeHost();
    await runSource(
      fn('PRINT("old"); PRINT(); PRINT("n = " + 3); PRINT(1/3); PRINT({1, "a"});'),
      'T',
      [],
      host,
    );
    expect(host.printed).toEqual(['n = 3', '0.333333333333', '{1, "a"}']);
  });

  it('INPUT asks the host and stores the answers', async () => {
    const host = new FakeHost();
    host.inputAnswers = [[num(3), num(4)]];
    const r = await value(
      fn(
        'LOCAL a := 1, b := 2, ok; ok := INPUT({a, b}, "Sides", {"a=", "b="}, {"first", "second"}); RETURN {ok, a, b};',
      ),
      'T',
      [],
      host,
    );
    expect(r).toBe('{1, 3, 4}');
    expect(host.forms[0].title).toBe('Sides');
    expect(host.forms[0].fields.map((f) => [f.name, f.label, f.help, f.value])).toEqual([
      ['a', 'a=', 'first', num(1)],
      ['b', 'b=', 'second', num(2)],
    ]);
  });

  it('INPUT cancelled returns 0 and keeps the variable', async () => {
    const host = new FakeHost();
    host.inputAnswers = [null];
    expect(await value(fn('LOCAL a := 5; RETURN {INPUT(a), a};'), 'T', [], host)).toBe('{0, 5}');
  });

  it('INPUT into a global variable', async () => {
    const host = new FakeHost();
    host.inputAnswers = [[str('typed')]];
    await runSource(fn('INPUT(N);'), 'T', [], host);
    expect(host.globals.get('N')).toEqual(str('typed'));
  });

  it('CHOOSE, MSGBOX, WAIT, GETKEY and ISKEYDOWN', async () => {
    const host = new FakeHost();
    host.chooseAnswers = [2];
    host.keys = [30];
    host.down.add(4);
    const r = await value(
      fn(
        'LOCAL c; CHOOSE(c, "Pick", "red", "green"); MSGBOX("got " + c); WAIT(0.5); RETURN {c, GETKEY, GETKEY(), ISKEYDOWN(4), ISKEYDOWN(5)};',
      ),
      'T',
      [],
      host,
    );
    expect(r).toBe('{2, 30, -1, 1, 0}');
    expect(host.messages).toEqual(['Pick: red|green', 'got 2']);
    expect(host.waited).toEqual([0.5]);
  });

  it('RANDOM and RANDINT use the given generator', async () => {
    const src = fn('RETURN {RANDOM(), RANDOM(10), RANDOM(2, 4), RANDINT(6), RANDINT(10, 12)};');
    expect(await value(src, 'T', [], undefined, { random: () => 0.5 })).toBe('{0.5, 5, 3, 4, 11}');
  });
});

describe('run – graphics', () => {
  it('sends LINE, RECT, PIXON, TEXTOUT, FILLPOLY and BLIT commands', async () => {
    const host = new FakeHost();
    const src = fn(`
      RECT_P();
      RECT_P(G1, 10, 20, 30, 40, RGB(255, 0, 0), RGB(0, 0, 255));
      LINE_P(0, 0, 319, 239, #0);
      LINE(-1, -1, 1, 1);
      PIXON_P(G2, 5, 6, 255);
      TEXTOUT_P("Hi", G1, 7, 8, 2, 65280);
      FILLPOLY_P({{0, 0}, {10, 0}, {5, 9}}, 16711680);
      BLIT_P(G0, G1);
      BLIT_P(G0, 10, 10, G1, 0, 0, 50, 50, 0);`).replace('#0', '0');
    const r = await runSource(src, 'T', [], host);
    expect(r.ok).toBe(true);
    expect(host.gfxLog).toEqual([
      { op: 'rect', screen: 0, coords: 'pixel', fill: 0xffffff, edge: 0xffffff },
      {
        op: 'rect',
        screen: 1,
        coords: 'pixel',
        x1: 10,
        y1: 20,
        x2: 30,
        y2: 40,
        edge: 0xff0000,
        fill: 0x0000ff,
      },
      { op: 'line', screen: 0, coords: 'pixel', x1: 0, y1: 0, x2: 319, y2: 239, color: 0 },
      { op: 'line', screen: 0, coords: 'cartesian', x1: -1, y1: -1, x2: 1, y2: 1 },
      { op: 'pixon', screen: 2, coords: 'pixel', x: 5, y: 6, color: 255 },
      { op: 'textout', screen: 1, coords: 'pixel', text: 'Hi', x: 7, y: 8, font: 2, color: 65280 },
      {
        op: 'fillpoly',
        screen: 0,
        coords: 'pixel',
        points: [
          [0, 0],
          [10, 0],
          [5, 9],
        ],
        color: 16711680,
      },
      { op: 'blit', coords: 'pixel', target: 0, source: 1 },
      {
        op: 'blit',
        coords: 'pixel',
        target: 0,
        dx1: 10,
        dy1: 10,
        source: 1,
        sx1: 0,
        sy1: 0,
        sx2: 50,
        sy2: 50,
        transparent: 0,
      },
    ]);
  });

  it('reports wrong graphics arguments', async () => {
    expect(await value(fn('LINE_P(1, 2, G3, 4);'), 'T')).toMatch(
      /^error type 3:1 LINE_P: a screen \(G0–G9\) is only allowed as argument 1/,
    );
  });
});
