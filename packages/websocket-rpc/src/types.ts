export type MessageID = number & {__brand: MessageID};

export enum RequestKind {
  Authenticate,
  Subscribe,
  MethodCall,
}

export interface BaseRequest {
  id: MessageID;
}

export interface AuthenticateRequest extends BaseRequest {
  kind: RequestKind.Authenticate;
  token: string;
}

export interface SubscribeRequest extends BaseRequest {
  kind: RequestKind.Subscribe;
  moduleID: string;
  exportName: string;
  etag: string;
}

export interface MethodCallRequest extends BaseRequest {
  kind: RequestKind.MethodCall;
  moduleID: string;
  exportName: string;
  args: any[];
}

export type RpcRequest =
  | AuthenticateRequest
  | SubscribeRequest
  | MethodCallRequest;

export enum ResponseKind {
  Authenticated,
  AuthenticationRequired,
  SubscriptionUpdate,
  SubscriptionError,
  MethodCallResult,
  MethodCallError,
}

export interface BaseResponse {
  id: MessageID;
}

export interface AuthenticatedResponse extends BaseResponse {
  kind: ResponseKind.Authenticated;
}

export interface SubscriptionUpdateResponse extends BaseResponse {
  kind: ResponseKind.SubscriptionUpdate;
  etag: string;
  value: any;
}

export interface SubscriptionErrorResponse extends BaseResponse {
  kind: ResponseKind.SubscriptionError;
  message: string;
}

export interface MethodCallResultResponse extends BaseResponse {
  kind: ResponseKind.MethodCallResult;
  value: any;
}

export interface MethodCallErrorResponse extends BaseResponse {
  kind: ResponseKind.MethodCallError;
  code: string | null;
  message: string;
}

export interface AuthenticationRequiredResponse extends BaseResponse {
  kind: ResponseKind.AuthenticationRequired;
}

export type RpcResponse =
  | AuthenticatedResponse
  | AuthenticationRequiredResponse
  | SubscriptionUpdateResponse
  | SubscriptionErrorResponse
  | MethodCallResultResponse
  | MethodCallErrorResponse;
