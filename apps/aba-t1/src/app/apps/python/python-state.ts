/** State of the Python app (prompt 047): scripts, the open one, shell history. */
export interface PythonScript {
  name: string;
  source: string;
}

export interface PythonState {
  scripts: PythonScript[];
  /** index of the open script, −1 = the list */
  open: number;
  /** earlier shell lines (↑↓) */
  history: string[];
}

const DEMO = `# a few lines to start with
import math
import graphic

graphic.clear()
for k in range(0, 320, 4):
    y = 120 - 80 * math.sin(k / 30)
    graphic.pixel(k, int(y), graphic.rgb(209, 73, 91))
graphic.line(0, 120, 319, 120, 0x5a6c67)
print('sin drawn')
`;

export function initPython(): PythonState {
  return { scripts: [{ name: 'demo', source: DEMO }], open: -1, history: [] };
}
