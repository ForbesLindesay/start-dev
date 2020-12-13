import 'sucrase/register';
import getObjectEtag from './getObjectEtag';
import {RequestKind, ResponseKind, RpcRequest, RpcResponse} from './types';

const TOKEN = process.env.WEBSOCKET_RPC_TOKEN;
if (!TOKEN) {
  throw new Error('Missing websocket RPC token');
}

export type WorkerResponse =
  | {kind: 'response'; connectionID: number; response: RpcResponse}
  | {kind: 'module-source'; moduleID: string; source: string}
  | {kind: 'module-error'; moduleID: string; message: string};
export type WorkerRequest =
  | {kind: 'open'; connectionID: number}
  | {kind: 'close'; connectionID: number}
  | {kind: 'request'; connectionID: number; request: RpcRequest}
  | {kind: 'get-module'; moduleID: string; clientName: string};

function send(r: WorkerResponse) {
  process.send!(r);
}
interface Connection {
  onRequest(request: RpcRequest): void;
  onClose(): void;
}
function createConnection(send: (response: RpcResponse) => void): Connection {
  let authenticated = false;
  const unsubscribe: (() => void)[] = [];
  return {
    onRequest(request) {
      switch (request.kind) {
        case RequestKind.Authenticate:
          if (request.token === TOKEN) {
            authenticated = true;
            send({
              kind: ResponseKind.Authenticated,
              id: request.id,
            });
          } else {
            authenticated = false;
            send({
              kind: ResponseKind.AuthenticationRequired,
              id: request.id,
            });
          }
          break;
        case RequestKind.MethodCall:
          if (!authenticated) {
            send({
              kind: ResponseKind.AuthenticationRequired,
              id: request.id,
            });
            return;
          }
          Promise.resolve(null)
            .then(async () => {
              return require(request.moduleID)[request.exportName](
                ...request.args,
              );
            })
            .then(
              (value) => {
                send({
                  kind: ResponseKind.MethodCallResult,
                  id: request.id,
                  value,
                });
              },
              (error) => {
                console.error(error.stack || error.message || error);
                send({
                  kind: ResponseKind.MethodCallError,
                  id: request.id,
                  message: `${error.stack || error.message || error}`,
                  code: typeof error.code === 'string' ? error.code : null,
                });
              },
            );
          break;
        case RequestKind.Subscribe:
          if (!authenticated) {
            send({
              kind: ResponseKind.AuthenticationRequired,
              id: request.id,
            });
            return;
          }
          Promise.resolve(null)
            .then(async () => {
              const observable = require(request.moduleID)[request.exportName];
              if (observable === undefined) {
                send({
                  kind: ResponseKind.SubscriptionError,
                  id: request.id,
                  message: `"${request.moduleID}" has no export called "${request.exportName}"`,
                });
                return;
              }
              if (
                !observable ||
                !(
                  typeof observable.getValue === 'function' &&
                  typeof observable.subscribe === 'function'
                )
              ) {
                send({
                  kind: ResponseKind.SubscriptionError,
                  id: request.id,
                  message: `"${request.moduleID}" has an export called "${request.exportName}" but it is not an observable`,
                });
                return;
              }
              const value = observable.getValue();
              const etag = getObjectEtag(value);
              if (etag !== request.etag) {
                send({
                  kind: ResponseKind.SubscriptionUpdate,
                  id: request.id,
                  value,
                  etag,
                });
              }
              unsubscribe.push(
                observable.subscribe((value: any) => {
                  const etag = getObjectEtag(value);
                  send({
                    kind: ResponseKind.SubscriptionUpdate,
                    id: request.id,
                    value,
                    etag,
                  });
                }),
              );
            })
            .catch((error) => {
              console.error(error.stack || error.message || error);
              send({
                kind: ResponseKind.SubscriptionError,
                id: request.id,
                message: `${error.stack || error.message || error}`,
              });
            });
          break;
      }
    },
    onClose() {
      for (const u of unsubscribe) {
        u();
      }
    },
  };
}

const connections = new Map<number, Connection>();
process.on('message', (message: WorkerRequest) => {
  switch (message.kind) {
    case 'open': {
      const connectionID = message.connectionID;
      connections.set(
        connectionID,
        createConnection((response) => {
          send({kind: 'response', connectionID, response});
        }),
      );
      break;
    }
    case 'request': {
      const connectionID = message.connectionID;
      const connection = connections.get(connectionID);
      if (connection) connection.onRequest(message.request);
      break;
    }
    case 'close': {
      const connectionID = message.connectionID;
      const connection = connections.get(connectionID);
      if (connection) connection.onClose();
      connections.delete(connectionID);
      break;
    }
    case 'get-module': {
      const moduleID = message.moduleID;
      const clientName = message.clientName;
      Promise.resolve(null)
        .then(async () => {
          const pkg = require(moduleID);
          const output = [];
          output.push(`const __filename__ = ${JSON.stringify(moduleID)};`);
          for (const methodName of Object.keys(pkg)) {
            const declaration =
              methodName === 'default'
                ? `export default`
                : `export const ${methodName} =`;
            if (typeof pkg[methodName] === 'function') {
              output.push(
                `${declaration} ${clientName}.asyncMethod(__filename__, ${JSON.stringify(
                  methodName,
                )});`,
              );
            } else if (
              pkg[methodName] &&
              typeof pkg[methodName].getValue === 'function' &&
              typeof pkg[methodName].subscribe === 'function'
            ) {
              const initialValue = pkg[methodName].getValue();
              const initialEtag = getObjectEtag(initialValue);
              output.push(
                `${declaration} ${clientName}.observableState(__filename__, ${JSON.stringify(
                  methodName,
                )}, ${JSON.stringify(initialEtag)}, ${JSON.stringify(
                  initialValue,
                )});`,
              );
            }
          }
          return output.join('\n');
        })
        .then(
          (source) => {
            send({kind: 'module-source', moduleID, source});
          },
          (error) => {
            send({
              kind: 'module-error',
              moduleID,
              message: `${error.stack || error.message || error}`,
            });
          },
        );
      break;
    }
  }
});

// a default export to satisfy rollup
export default 0;
