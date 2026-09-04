import type { ApiErrorCode } from "./api-types";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly headers?: HeadersInit;

  constructor(code: ApiErrorCode, status: number, message: string, headers?: HeadersInit) {
    super(message);
    this.code = code;
    this.status = status;
    this.headers = headers;
  }
}

export function invalidRequest(message: string) {
  return new ApiError("invalid_request", 400, message);
}

export function invalidToken() {
  return new ApiError("invalid_token", 401, "Invalid API token.");
}

export function insufficientScope() {
  return new ApiError("insufficient_scope", 403, "This token does not have the required scope.");
}

export function notFound() {
  return new ApiError("not_found", 404, "Resource not found.");
}

export function payloadTooLarge(message = "Payload exceeds the maximum supported size.") {
  return new ApiError("payload_too_large", 413, message);
}

export function recordTooLarge() {
  return new ApiError("record_too_large", 413, "A single record exceeds the maximum supported payload size.");
}

export function rateLimitExceeded(headers: HeadersInit) {
  return new ApiError("rate_limit_exceeded", 429, "Rate limit exceeded.", headers);
}

export function internalError() {
  return new ApiError("internal_error", 500, "Internal server error.");
}

export function toApiError(error: unknown) {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof Error) {
    return invalidRequest(error.message);
  }
  return internalError();
}
