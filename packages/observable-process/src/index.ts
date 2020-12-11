export default 1;
// import {resolve} from 'path';
// import {spawn, ChildProcess} from 'child_process';
// import {Readable} from 'stream';
// import {
//   createStateAtom,
//   ObservableState,
//   ObservableState,
// } from '@graphical-scripts/state';

// const root = resolve(`${__dirname}/../..`);

// function onLine(stream: Readable | null, onLine: (line: string) => void) {
//   let buffer = '';

//   stream?.on('data', (data) => {
//     buffer += data.toString('utf8');
//     const split = buffer.split('\n');
//     for (let i = 0; i < split.length - 1; i++) {
//       onLine(JSON.stringify(split[i]));
//       onLine(
//         split[i]
//           .trimEnd()
//           .replace(/\r/g, '')
//           .replace(/\u001b\[0m/g, ''),
//       );
//     }
//     buffer = split[split.length - 1];
//   });
// }

// function spawnChildProcess(
//   command: string,
//   args: string[],
//   options: {
//     onError: (err: Error) => void;
//     onExit: (code: number) => void;
//     onStdout: (line: string) => void;
//     onStderr: (line: string) => void;
//   },
// ): ChildProcess {
//   const child = spawn(command, args, {cwd: root, stdio: 'pipe'})
//     .on('error', options.onError)
//     .on('exit', options.onExit);
//   onLine(child.stdout, options.onStdout);
//   onLine(child.stderr, options.onStderr);
//   return child;
// }

// type ChildProcessState<TOutputState> =
//   | {kind: 'idle'; output: TOutputState}
//   | {kind: 'running'; output: TOutputState}
//   | {kind: 'stopping'; output: TOutputState}
//   | {kind: 'error'; error: Error; output: TOutputState}
//   | {kind: 'stopped'; code: number; output: TOutputState};

// interface ChildProcessApi {
//   start(): void;
//   restart(shouldKill: boolean): void;
//   stop(): void;
// }
// export function createChildProcess<TOutputState>(
//   command: string,
//   args: string[],
//   options: {
//     initialState: TOutputState;
//     onStart?: (currentState: TOutputState) => TOutputState;
//     onKill?: (currentState: TOutputState) => TOutputState;
//     onError?: (currentState: TOutputState, err: Error) => TOutputState;
//     onExit?: (currentState: TOutputState, code: number) => TOutputState;
//     onLine?: (currentState: TOutputState, line: string) => TOutputState;
//   },
// ): [ObservableState<ChildProcessState<TOutputState>>, ChildProcessApi] {
//   const [state, setState] = createStateAtom<ChildProcessState<TOutputState>>({
//     kind: 'idle',
//     output: options.initialState,
//   });
//   const listeners = new Set<() => void>();
//   let childState: ChildProcessState<TOutputState> = {
//     kind: 'idle',
//     output: options.initialState,
//   };
//   let kill = () => {};
//   let restart = (_shouldKill: boolean) => {};
//   function onUpdate() {
//     for (const listener of listeners) {
//       listener();
//     }
//   }
//   function run() {
//     childState = {
//       kind: 'running',
//       output: options.onStart(childState.output),
//     };
//     onUpdate();
//     let stopped = false;
//     let stopping = false;
//     let restarting = false;
//     const child = spawnChildProcess(command, args, {
//       onError(err) {
//         if (stopped) return;
//         stopped = true;
//         if (restarting) run();
//         if (stopping || restarting) return;
//         childState = {
//           kind: 'error',
//           error: err,
//           output: options.onError(childState.output, err),
//         };
//         onUpdate();
//       },
//       onExit(code) {
//         if (stopped) return;
//         stopped = true;
//         if (restarting) run();
//         if (stopping || restarting) return;
//         childState = {
//           kind: 'stopped',
//           code,
//           output: options.onExit(childState.output, code),
//         };
//         onUpdate();
//       },
//       onStdout(line) {
//         if (stopping || stopped) return;
//         childState = {
//           ...childState,
//           output: options.onLine(childState.output, line),
//         };
//         onUpdate();
//       },
//       onStderr(line) {
//         if (stopping || stopped) return;
//         childState = {
//           ...childState,
//           output: options.onLine(childState.output, line),
//         };
//         onUpdate();
//       },
//     });
//     kill = () => {
//       stopping = true;
//       child.kill();
//     };
//     restart = (shouldKill: boolean) => {
//       restarting = true;
//       if (shouldKill) {
//         kill();
//       }
//     };
//   }
//   return [
//     state,
//     {
//       start() {
//         if (childState.kind === 'running') return;
//         run();
//       },
//       restart(shouldKill: boolean) {
//         if (childState.kind === 'running') {
//           restart(shouldKill);
//         } else {
//           run();
//         }
//       },
//       stop() {
//         childState = {
//           kind: 'idle',
//           output: options.onKill(childState.output),
//         };
//         onUpdate();
//         kill();
//       },
//     },
//   ];
// }
