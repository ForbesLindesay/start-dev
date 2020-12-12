import {createHash} from 'crypto';
import {Server as HttpServer} from 'http';
import {Server as WsServer} from 'ws';
import {loadModule} from './rpc-client';

if (process.env.POPULATE_SNOWPACK_CACHE === 'true') {
  require('rimraf').sync(`${__dirname}/../snowpack-cache`);
}

export default async function handleRequest(request: any): Promise<any> {
  if (request.type === 'method-call') {
    return await (await loadModule(request.moduleID))[request.exportName](
      ...request.args,
    );
  }
  if (request.type === 'long-poll') {
    const observable = (await loadModule(request.moduleID))[request.exportName];
    const etag = createHash('sha1')
      .update(JSON.stringify(observable.getValue()))
      .digest('base64');
    if (etag !== request.etag) {
      return {
        etag,
        value: observable.getValue(),
      };
    }
    const unsubscribe: (() => void)[] = [];
    return await Promise.race([
      new Promise((resolve) => {
        const t = setTimeout(() => {
          for (const u of unsubscribe) {
            u();
          }
          resolve({etag});
        }, request.timeout);
        unsubscribe.push(() => clearTimeout(t));
      }),
      new Promise((resolve) => {
        unsubscribe.push(
          observable.subscribe(() => {
            for (const u of unsubscribe) {
              u();
            }
            const etag = createHash('sha1')
              .update(JSON.stringify(observable.getValue()))
              .digest('base64');
            resolve({
              etag,
              value: observable.getValue(),
            });
          }),
        );
      }),
    ]);
  }
  if (
    request.type === 'frontend-loaded' &&
    process.env.POPULATE_SNOWPACK_CACHE === 'true'
  ) {
    require('rimraf').sync(`${__dirname}/../snowpack-cache`);
    require('copy-dir').sync(
      `${__dirname}/../node_modules/.cache/snowpack/development`,
      `${__dirname}/../snowpack-cache`,
    );
    require('rimraf').sync(
      `${__dirname}/../node_modules/.cache/snowpack/development`,
    );
    process.exit(0);
  }
}

// import {createHash}
// import { ObservableState } from ".";

// export default async function longPoll<T>(state: ObservableState<T>, lastToken?: string) {
//   if (JSON.stringify(state.getValue())) {

//   }
// }

export function createWebsocketServer(server: HttpServer, csrf: string) {
  const wss = new WsServer({server});

  wss.on('connection', (ws) => {
    let authenticated = false;
    const unsubscribe: (() => void)[] = [];
    ws.on('message', async (message) => {
      const m = JSON.parse(message.toString('utf8'));

      if (m.kind === 'auth') {
        if (csrf === m.csrf) {
          authenticated = true;
        } else {
          authenticated = false;
        }
        ws.send(JSON.stringify({kind: 'auth-result', id: m.id, authenticated}));
        return;
      }

      if (!authenticated) {
        ws.send(JSON.stringify({kind: 'authentication-required', id: m.id}));
        return;
      }

      try {
        if (m.kind === 'method-call') {
          const result = await (await loadModule(m.moduleID))[m.exportName](
            ...m.args,
          );
          ws.send(JSON.stringify({kind: 'method-result', id: m.id, result}));
          return;
        }
        if (m.kind === 'subscribe') {
          const observable = (await loadModule(m.moduleID))[m.exportName];
          const etag = getEtag(observable.getValue());
          if (etag !== m.etag) {
            ws.send(
              JSON.stringify({
                kind: 'observable',
                id: m.id,
                etag,
                value: observable.getValue(),
              }),
            );
          }
          unsubscribe.push(
            observable.subscribe((value: any) => {
              ws.send(
                JSON.stringify({
                  kind: 'observable',
                  id: m.id,
                  etag: getEtag(value),
                  value,
                }),
              );
            }),
          );
          return;
        }
        console.error(`Invalid request kind: ${message}`);
        ws.send(
          JSON.stringify({
            kind: 'error',
            id: m.id,
            code: 'INVALID_REQUEST',
            message: 'Invalid request kind',
          }),
        );
      } catch (ex) {
        console.error(ex.stack);
        ws.send(
          JSON.stringify({
            kind: 'error',
            id: m.id,
            code: ex.code,
            message: ex.message,
          }),
        );
      }
    });

    let lastPingSuccess = true;
    ws.on('pong', () => {
      lastPingSuccess = true;
    });
    const ping = setInterval(() => {
      if (!lastPingSuccess) {
        ws.close();
        return;
      }
      lastPingSuccess = false;
      ws.ping();
    }, 2_000);

    ws.on('close', () => {
      for (const u of unsubscribe) {
        u();
      }
      clearTimeout(ping);
    });
  });
}

function getEtag(obj: any) {
  return createHash('sha1').update(JSON.stringify(obj)).digest('base64');
}
// ws.on('pong', heartbeat);
// });

// const interval = setInterval(function ping() {
//   wss.clients.forEach(function each(ws) {
//     if (ws.isAlive === false) return ws.terminate();

//     ws.isAlive = false;
//     ws.ping(noop);
//   });
// }, 30000);

// wss.on('close', function close() {
//   clearInterval(interval);
// });
