import Client from '@graphical-scripts/websocket-rpc/client';

// let nextMessageID = 1;

async function getCsrfToken() {
  const response = await fetch('/_csrf');
  if (!response.ok) {
    throw new Error(response.statusText + ': ' + (await response.text()));
  }
  const responseText = await response.text();
  // while(true);console.log(${JSON.stringify(CSRF_TOKEN)})
  return JSON.parse(
    responseText.substring(
      'while(true);console.log('.length,
      responseText.length - 1,
    ),
  );
}

const client = new Client(getCsrfToken, `ws://${location.host}`);
export default client;

// const subscriptions = new Map();
// const pendingRequests = new Map();
// const inFlightRequests = new Map();
// let send = null;
// function createSocket() {
//   const socket = new WebSocket(`ws://${location.host}`);
//   let connecting = false;

//   const authMessageID = nextMessageID++;

//   socket.addEventListener('open', () => {
//     connect();
//   });

//   function connect() {
//     if (connecting) return;
//     connecting = true;
//     send = null;
//     getCsrfToken().then(
//       (csrfToken) => {
//         socket.send(
//           JSON.stringify({kind: 'auth', id: authMessageID, csrf: csrfToken}),
//         );
//       },
//       () => {
//         connecting = false;
//         setTimeout(connect, Math.floor(Math.random() * 1000 + 2000));
//       },
//     );
//   }

//   socket.addEventListener('close', () => {
//     send = null;
//     socket.close();
//     setTimeout(() => {
//       createSocket();
//     }, 2000);
//   });

//   // Listen for messages
//   socket.addEventListener('message', (event) => {
//     const m = JSON.parse(event.data);
//     if (m.kind === 'auth-result') {
//       connecting = false;
//       if (m.authenticated) {
//         send = (msg) => socket.send(JSON.stringify(msg));
//         for (const [id, subscription] of subscriptions) {
//           socket.send(
//             JSON.stringify({
//               kind: 'subscribe',
//               id,
//               moduleID: subscription.moduleID,
//               exportName: subscription.exportName,
//               etag: subscription.etag,
//             }),
//           );
//         }
//         for (const [id, request] of [...pendingRequests]) {
//           inFlightRequests.set(id, request);
//           pendingRequests.delete(id);
//           socket.send(
//             JSON.stringify({
//               kind: 'method-call',
//               id,
//               moduleID: request.moduleID,
//               exportName: request.exportName,
//               args: request.args,
//             }),
//           );
//         }
//       } else {
//         connect();
//       }
//       return;
//     }

//     if (m.kind === 'authentication-required') {
//       const req = inFlightRequests.get(m.id);
//       if (req) {
//         pendingRequests.set(m.id, req);
//       }
//       connect();
//     }

//     if (m.kind === 'observable') {
//       const subscription = subscriptions.get(m.id);
//       subscription.etag = m.etag;
//       subscription.onUpdate(m.value);
//       return;
//     }

//     if (m.kind === 'method-result') {
//       const req = inFlightRequests.get(m.id);
//       if (req) {
//         req.resolve(m.result);
//       }
//       return;
//     }

//     if (m.kind === 'error') {
//       const err = new Error(m.message);
//       err.code = m.code;
//       const req = inFlightRequests.get(m.id);
//       if (req) {
//         req.reject(err);
//       } else {
//         setTimeout(() => {
//           throw err;
//         }, 0);
//       }
//       return;
//     }
//   });
// }
// createSocket();

// export async function callmethod(request) {
//   const response = await fetch('/_api', {
//     method: 'post',
//     headers: {
//       'x-csrf-token': await getCsrfToken(),
//       'content-type': 'application/json',
//     },
//     body: JSON.stringify(request),
//   });
//   if (!response.ok) {
//     if (response.status === 403) {
//       csrfTokenCache = undefined;
//       return await callmethod(request);
//     }
//     if (response.headers.get('content-type') === 'application/json') {
//       const err = await response.json();

//       throw new Error(err.stack ? `${err.stack.join('\n')}\n\n` : err.message);
//     } else {
//       throw new Error(`${response.statusText}: ${await response.text()}`);
//     }
//   } else {
//     return response.json();
//   }
// }

// export function asyncMethod(moduleID, exportName) {
//   return async (...args) => {
//     return new Promise((resolve, reject) => {
//       const id = nextMessageID++;
//       const request = {
//         type: 'method-call',
//         moduleID,
//         exportName,
//         args,
//         resolve,
//         reject,
//       };
//       if (send) {
//         inFlightRequests.set(id, request);
//         send({
//           type: 'method-call',
//           id,
//           moduleID,
//           exportName,
//           args,
//         });
//       } else {
//         pendingRequests.set(id, request);
//       }
//     });
//   };
// }

// export function observableState(
//   moduleID,
//   exportName,
//   initialValue,
//   initialEtag,
// ) {
//   const subscribers = new Set();
//   let value = initialValue;
//   subscriptions.set(nextMessageID++, {
//     moduleID,
//     exportName,
//     etag: initialEtag,
//     onUpdate: (newValue) => {
//       value = newValue;
//       for (const s of subscribers) {
//         s(newValue);
//       }
//     },
//   });
//   return {
//     getValue: () => value,
//     subscribe: (fn) => {
//       subscribers.add(fn);
//       return () => subscribers.delete(fn);
//     },
//   };
// }
