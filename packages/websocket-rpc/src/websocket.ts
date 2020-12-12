import {RpcRequest, RpcResponse} from './types';

export interface WebsocketAPI {
  isOpen: () => boolean;
  send(request: RpcRequest): void;
}
export interface Handlers {
  open: (api: WebsocketAPI) => void;
  close: (api: WebsocketAPI) => void;
  response: (response: RpcResponse, api: WebsocketAPI) => void;
}
export default function createWebsocket(server: string, handlers: Handlers) {
  const socket = new WebSocket(server);

  let openned = false;
  let closed = false;
  const api: WebsocketAPI = {
    send(request) {
      socket.send(JSON.stringify(request));
    },
    isOpen: () => openned && !closed,
  };

  socket.addEventListener('open', () => {
    if (closed) return;
    openned = true;
    handlers.open(api);
  });

  socket.addEventListener('close', () => {
    if (closed) return;
    closed = true;
    handlers.close(api);
  });

  const onPingTimeout = () => {
    if (closed) return;
    closed = true;
    handlers.close(api);
    socket.close();
  };
  let pingTimeout = setTimeout(onPingTimeout, 3000);

  socket.addEventListener('message', (event) => {
    if (closed) return;
    if (event.data === 'ping') {
      socket.send('pong');
      clearTimeout(pingTimeout);
      pingTimeout = setTimeout(onPingTimeout, 3000);
      return;
    }
    handlers.response(JSON.parse(event.data), api);
  });

  return api;
}
