import {
  AuthenticationRequiredResponse,
  MessageID,
  MethodCallErrorResponse,
  MethodCallRequest,
  MethodCallResultResponse,
  RequestKind,
  ResponseKind,
  SubscriptionUpdateResponse,
} from './types';
import createWebsocket, {WebsocketAPI} from './websocket';

interface SubscriptionHandle {
  moduleID: string;
  exportName: string;
  etag: string;
  onValue: (value: any) => void;
}
export default class WebsocketRpcClient {
  private readonly _getCsrfToken: () => Promise<string>;
  private readonly _subscriptions = new Map<MessageID, SubscriptionHandle>();
  private readonly _methodCallResults = new Map<
    MessageID,
    {resolve: (val: any) => void; reject: (val: any) => void}
  >();
  private readonly _inFlightMethodCalls = new Map<
    MessageID,
    MethodCallRequest
  >();

  private _socket: WebsocketAPI;
  private _socketReady: boolean = false;
  private _nextMessageID: number = 1;
  private _requestQueue: MethodCallRequest[] = [];

  constructor(getCsrfToken: () => Promise<string>, server: string) {
    this._getCsrfToken = getCsrfToken;
    this._socket = this._connect(server);
  }
  private _connect(server: string) {
    return createWebsocket(server, {
      open: (socket) => {
        this._authenticate(socket);
      },
      response: (response, socket) => {
        switch (response.kind) {
          case ResponseKind.Authenticated:
            this._onAuthenticated(socket);
            break;
          case ResponseKind.AuthenticationRequired:
            this._onAuthenticationRequired(response, socket);
            break;
          case ResponseKind.SubscriptionUpdate:
            this._onSubscriptionUpdate(response);
            break;
          case ResponseKind.SubscriptionError:
            console.error(response.message);
            break;
          case ResponseKind.MethodCallResult:
            this._onMethodCallResult(response);
            break;
          case ResponseKind.MethodCallError:
            this._onMethodCallError(response);
            break;
        }
      },
      close: () => {
        this._socketReady = false;
        const reconnectTime = Math.floor(1000 + Math.random() * 1000);
        console.error(
          `Connection lost, attempting to reconnect in about ${
            Math.round(reconnectTime / 100) / 10
          } seconds`,
        );
        setTimeout(() => {
          this._socket = this._connect(server);
        }, reconnectTime);
      },
    });
  }

  private _getMessageID(): MessageID {
    return this._nextMessageID++ as MessageID;
  }

  private _authenticate(socket: WebsocketAPI) {
    this._getCsrfToken().then(
      (token) => {
        if (!socket.isOpen()) return;
        socket.send({
          kind: RequestKind.Authenticate,
          token,
          id: this._getMessageID(),
        });
      },
      (err) => {
        if (!socket.isOpen()) return;
        console.error(`Error loading csrf token: ${err.message}`);
        setTimeout(() => {
          this._authenticate(socket);
        }, 1000);
      },
    );
  }

  private _onAuthenticated(socket: WebsocketAPI) {
    this._socketReady = true;
    for (const [id, handle] of this._subscriptions) {
      socket.send({
        kind: RequestKind.Subscribe,
        id,
        moduleID: handle.moduleID,
        exportName: handle.exportName,
        etag: handle.etag,
      });
    }
    const queue = this._requestQueue;
    this._requestQueue = [];
    for (const request of queue) {
      socket.send(request);
    }
  }

  private _onAuthenticationRequired(
    response: AuthenticationRequiredResponse,
    socket: WebsocketAPI,
  ) {
    const methodCall = this._inFlightMethodCalls.get(response.id);
    if (methodCall) {
      this._requestQueue.push(methodCall);
      this._inFlightMethodCalls.delete(response.id);
    }
    if (this._socketReady) {
      this._socketReady = false;
      this._authenticate(socket);
    }
  }

  private _onSubscriptionUpdate(response: SubscriptionUpdateResponse) {
    const handler = this._subscriptions.get(response.id);
    if (handler) {
      handler.etag = response.etag;
      handler.onValue(response.value);
    }
  }

  private _onMethodCallResult(response: MethodCallResultResponse) {
    const resolvers = this._methodCallResults.get(response.id);
    if (resolvers) {
      resolvers.resolve(response.value);
    }
    this._methodCallResults.delete(response.id);
    this._inFlightMethodCalls.delete(response.id);
  }
  private _onMethodCallError(response: MethodCallErrorResponse) {
    const resolvers = this._methodCallResults.get(response.id);
    if (resolvers) {
      const err = new Error(response.message);
      if (response.code !== null) {
        Object.assign(err, {code: response.code});
      }
      resolvers.reject(err);
    }
    this._methodCallResults.delete(response.id);
    this._inFlightMethodCalls.delete(response.id);
  }

  public observableState<T>(
    moduleID: string,
    exportName: string,
    initialEtag: string,
    initialValue: T,
  ) {
    const id = this._getMessageID();
    const subscribers = new Set<(value: T) => void>();
    let value = initialValue;
    this._subscriptions.set(id, {
      moduleID,
      exportName,
      etag: initialEtag,
      onValue: (newValue: T) => {
        value = newValue;
        for (const s of subscribers) {
          s(newValue);
        }
      },
    });
    if (this._socketReady) {
      this._socket.send({
        kind: RequestKind.Subscribe,
        id,
        moduleID,
        exportName,
        etag: initialEtag,
      });
    }
    return {
      getValue: () => value,
      subscribe: (fn: (value: T) => void) => {
        subscribers.add(fn);
        return () => subscribers.delete(fn);
      },
    };
  }

  public asyncMethod<TArgs extends any[], TResult>(
    moduleID: string,
    exportName: string,
  ) {
    return async (...args: TArgs): Promise<TResult> => {
      return new Promise<TResult>((resolve, reject) => {
        const id = this._getMessageID();
        this._methodCallResults.set(id, {resolve, reject});
        const request: MethodCallRequest = {
          kind: RequestKind.MethodCall,
          id,
          moduleID,
          exportName,
          args,
        };
        if (this._socketReady) {
          this._inFlightMethodCalls.set(id, request);
          this._socket.send(request);
        } else {
          this._requestQueue.push(request);
        }
      });
    };
  }
}
