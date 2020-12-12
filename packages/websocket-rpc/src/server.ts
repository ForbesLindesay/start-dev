import {Server as HttpServer} from 'http';
import {Server as HttpsServer} from 'https';
import type WebSocket from 'ws';
import {Server as WsServer, ServerOptions as WsServerOptions} from 'ws';
import chalk from 'chalk';
import createWorker, {WorkerOptions} from './worker';

export interface ServerOptions extends WorkerOptions {
  clientName: string;
  server: HttpServer | HttpsServer;
  /**
   * @default 100MB
   */
  maxPayloadBytes?: number;
}
export default function createWebsocketServer({
  clientName,
  server,
  maxPayloadBytes,
  ...workerOptions
}: ServerOptions) {
  const wsOptions: WsServerOptions = {server};
  if (maxPayloadBytes !== undefined) {
    wsOptions.maxPayload = maxPayloadBytes;
  }
  const wss = new WsServer(wsOptions);
  const worker = createWorker(workerOptions);

  const moduleClients = new Map<string, Promise<string>>();
  const moduleResolvers = new Map<
    string,
    {resolve: (source: string) => void; reject: (err: Error) => void}
  >();

  let count = 0;
  let nextConnectionID = 0;
  const sockets = new Map<number, WebSocket>();
  worker.onResponse((response) => {
    switch (response.kind) {
      case 'response': {
        const socket = sockets.get(response.connectionID);
        if (socket) {
          socket.send(JSON.stringify(response.response));
        }
        break;
      }
      case 'module-source': {
        const resolvers = moduleResolvers.get(response.moduleID);
        if (resolvers) {
          resolvers.resolve(response.source);
        }
        break;
      }
      case 'module-error': {
        const resolvers = moduleResolvers.get(response.moduleID);
        if (resolvers) {
          resolvers.reject(
            new Error(
              `Error building ${response.moduleID}: ${response.message}`,
            ),
          );
        }
        break;
      }
    }
  });
  wss.on('connection', (ws) => {
    const connectionID = nextConnectionID++;
    sockets.set(connectionID, ws);
    worker.send({kind: 'open', connectionID});
    console.log(chalk.cyan(`connection open (active count: ${++count})`));
    let closed = false;
    const onClose = () => {
      if (closed) return;
      closed = true;
      console.log(chalk.cyan(`connection close (active count: ${--count})`));
      sockets.delete(connectionID);
      clearInterval(ping);
      worker.send({kind: 'close', connectionID});
    };
    let lastPingSuccess = true;
    const ping = setInterval(() => {
      if (!lastPingSuccess) {
        ws.terminate();
        onClose();
        return;
      }
      lastPingSuccess = false;
      ws.send('ping');
    }, 2_000);
    ws.on('close', () => {
      onClose();
    });
    ws.on('message', (message) => {
      const messageString = message.toString('utf8');
      if (messageString === 'pong') {
        lastPingSuccess = true;
      } else {
        worker.send({
          kind: 'request',
          connectionID,
          request: JSON.parse(messageString),
        });
      }
    });
  });
  return {
    async getClient(moduleID: string) {
      const cached = moduleClients.get(moduleID);
      if (cached) return await cached;
      const fresh = new Promise<string>((resolve, reject) => {
        moduleResolvers.set(moduleID, {resolve, reject});
        worker.send({kind: 'get-module', moduleID, clientName});
      });
      moduleClients.set(moduleID, fresh);
      try {
        return await fresh;
      } finally {
        // we are just deduping requests here, not actually caching
        moduleClients.delete(moduleID);
        moduleResolvers.delete(moduleID);
      }
    },
  };
}
