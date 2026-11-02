/// <reference lib="webworker" />
import { handle } from '../../../math/worker/host';
import type { ComputeRequest } from '../../../math/worker/protocol';

addEventListener('message', ({ data }: MessageEvent<ComputeRequest>) => {
  postMessage(handle(data));
});
