/* Types of the MicroPython WebAssembly port (prompt 047) – only what ABA-T1 uses. */
declare module '@micropython/micropython-webassembly-pyscript' {
  export interface MicroPython {
    FS: {
      mkdir(path: string): void;
      writeFile(path: string, data: string): void;
    };
    globals: { get(key: string): unknown; set(key: string, value: unknown): void };
    registerJsModule(name: string, module: Record<string, unknown>): void;
    runPython(code: string): unknown;
  }
  export function loadMicroPython(options: {
    url?: string;
    heapsize?: number;
    pystack?: number;
    linebuffer?: boolean;
    stdout?: (line: string) => void;
    stderr?: (line: string) => void;
  }): Promise<MicroPython>;
}
