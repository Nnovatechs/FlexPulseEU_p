import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { ApiError, payloadTooLarge } from "./api-errors";
import {
  API_MAX_JSON_BYTES,
  INTEROPERABILITY_API_VERSION,
  type ApiAuthContext,
  type ApiListMeta,
  type ApiRequestContext,
  type ApiSuccessMeta,
} from "./api-types";

function createBaseHeaders() {
  return new Headers({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
}

export function createApiRequestContext(request: Request, routeTemplate: string): ApiRequestContext {
  return {
    requestId: randomUUID(),
    startedAt: Date.now(),
    routeTemplate,
    method: request.method.toUpperCase(),
  };
}

function attachRateLimitHeaders(headers: Headers, auth: ApiAuthContext | null) {
  if (!auth) {
    return;
  }
  headers.set("RateLimit-Limit", String(auth.rateLimit.limit));
  headers.set("RateLimit-Remaining", String(auth.rateLimit.remaining));
  headers.set("RateLimit-Reset", auth.rateLimit.resetAt);
}

export function measureJsonBytes(value: unknown) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function ensurePayloadWithinLimit(value: unknown) {
  if (measureJsonBytes(value) > API_MAX_JSON_BYTES) {
    throw payloadTooLarge();
  }
}

export function jsonSuccess<T>(data: T, requestId: string, auth: ApiAuthContext | null = null) {
  const meta: ApiSuccessMeta = {
    api_version: INTEROPERABILITY_API_VERSION,
    request_id: requestId,
    generated_at: new Date().toISOString(),
  };
  const body = { data, meta };
  ensurePayloadWithinLimit(body);
  const headers = createBaseHeaders();
  attachRateLimitHeaders(headers, auth);
  return NextResponse.json(body, { status: 200, headers });
}

export function jsonList<T>(
  data: T[],
  requestId: string,
  metaInput: { nextCursor: string | null; hasMore: boolean },
  auth: ApiAuthContext | null = null,
) {
  const meta: ApiListMeta = {
    api_version: INTEROPERABILITY_API_VERSION,
    request_id: requestId,
    generated_at: new Date().toISOString(),
    next_cursor: metaInput.nextCursor,
    has_more: metaInput.hasMore,
  };
  const body = { data, meta };
  ensurePayloadWithinLimit(body);
  const headers = createBaseHeaders();
  attachRateLimitHeaders(headers, auth);
  return NextResponse.json(body, { status: 200, headers });
}

export function jsonError(error: ApiError, requestId: string, auth: ApiAuthContext | null = null) {
  const headers = createBaseHeaders();
  attachRateLimitHeaders(headers, auth);
  if (error.headers) {
    new Headers(error.headers).forEach((value, key) => headers.set(key, value));
  }
  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        request_id: requestId,
      },
    },
    {
      status: error.status,
      headers,
    },
  );
}
