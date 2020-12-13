import {fork} from 'child_process';
import type {WorkerRequest, WorkerResponse} from './worker-process';

export type {WorkerRequest, WorkerResponse};
export interface WorkerApi {
  send(message: WorkerRequest): void;
  onResponse(fn: (response: WorkerResponse) => void): void;
}

export interface WorkerOptions {
  token: string;
  cwd?: string;
  args?: string[];
  env?: {[key: string]: string};
}

const workerPath = require.resolve('./worker-process.cjs');
export default function createWorker(options: WorkerOptions): WorkerApi {
  const worker = fork(workerPath, options.args ?? process.argv.slice(2), {
    cwd: options.cwd ?? process.cwd(),
    stdio: 'inherit',
    env: {
      ...(options.env ?? process.env),
      WEBSOCKET_RPC_TOKEN: options.token,
    },
  });
  // TODO: handle error and exit events
  return {
    send: (message) => {
      worker.send(message);
    },
    onResponse: (fn) => {
      worker.on('message', (m) => fn(m as WorkerResponse));
    },
  };
}
