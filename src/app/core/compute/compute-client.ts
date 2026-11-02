import { Injectable, InjectionToken, OnDestroy, inject } from '@angular/core';
import { type MathResult, fail } from '../../../math/result';
import type {
  ComputeOp,
  ComputeRequest,
  ComputeResponse,
  ComputeResults,
} from '../../../math/worker/protocol';

/** Creates the worker; `null` = run in-thread (tests, browsers without module workers). */
export const COMPUTE_WORKER_FACTORY = new InjectionToken<() => Worker | null>(
  'COMPUTE_WORKER_FACTORY',
  {
    providedIn: 'root',
    factory: () => () =>
      typeof Worker === 'undefined'
        ? null
        : new Worker(new URL('./compute.worker', import.meta.url), { type: 'module' }),
  },
);

/** Default time limit for one computation (SETUP may change it, prompt 018). */
export const DEFAULT_TIMEOUT_MS = 8000;

interface Pending {
  resolve: (r: MathResult<unknown>) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Runs CAS work in a web worker (prompt 004). A computation that exceeds its time limit, or is
 * cancelled, terminates the worker – a hung Nerdamer call cannot be interrupted otherwise – and a
 * fresh one starts with the next request.
 */
@Injectable({ providedIn: 'root' })
export class ComputeClient implements OnDestroy {
  private readonly factory = inject(COMPUTE_WORKER_FACTORY);
  private worker: Worker | null = null;
  private inline = false;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();

  run<K extends ComputeOp['op']>(
    task: Extract<ComputeOp, { op: K }>,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): Promise<MathResult<ComputeResults[K]>> {
    const worker = this.ensureWorker();
    if (!worker) return this.runInline(task);
    const id = this.nextId++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.restart(fail('timeout', `the computation took longer than ${timeoutMs / 1000} s`));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve as Pending['resolve'], timer });
      worker.postMessage({ id, task } satisfies ComputeRequest);
    });
  }

  /** Abandons all running computations (new input, Esc). */
  cancelAll(): void {
    if (this.pending.size > 0) this.restart(fail('cancelled', 'cancelled'));
  }

  get busy(): boolean {
    return this.pending.size > 0;
  }

  private async runInline<K extends ComputeOp['op']>(
    task: ComputeOp,
  ): Promise<MathResult<ComputeResults[K]>> {
    const { execute } = await import('../../../math/worker/host');
    return execute(task) as MathResult<ComputeResults[K]>;
  }

  private ensureWorker(): Worker | null {
    if (this.inline) return null;
    if (!this.worker) {
      this.worker = this.factory();
      if (!this.worker) {
        this.inline = true;
        return null;
      }
      this.worker.onmessage = ({ data }: MessageEvent<ComputeResponse>) => {
        const p = this.pending.get(data.id);
        if (!p) return;
        clearTimeout(p.timer);
        this.pending.delete(data.id);
        p.resolve(data.result);
      };
      this.worker.onerror = (e) => {
        e.preventDefault();
        this.restart(fail('not-evaluable', `compute worker failed: ${e.message}`));
      };
    }
    return this.worker;
  }

  /** Terminates the worker and answers every pending request with `result`. */
  private restart(result: MathResult<never>): void {
    this.worker?.terminate();
    this.worker = null;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.resolve(result);
    }
    this.pending.clear();
  }

  ngOnDestroy(): void {
    this.worker?.terminate();
  }
}
