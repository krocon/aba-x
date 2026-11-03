/// <reference lib="webworker" />
import { handle } from '@aba/math/worker/host';
import type { ComputeRequest } from '@aba/math/worker/protocol';

addEventListener('message', ({ data }: MessageEvent<ComputeRequest>) => {
  postMessage(handle(data));
});
