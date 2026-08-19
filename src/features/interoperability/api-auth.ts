import { invalidToken, insufficientScope, rateLimitExceeded } from "./api-errors";
import { consumeApiTokenRateLimit } from "./api-token-repository";
import type { ApiAuthContext, ApiScope } from "./api-types";

const MAX_AUTHORIZATION_HEADER_LENGTH = 1024;

function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization || authorization.length > MAX_AUTHORIZATION_HEADER_LENGTH) {
    throw invalidToken();
  }
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw invalidToken();
  }
  const token = match[1]?.trim();
  if (!token || token.length > 512) {
    throw invalidToken();
  }
  return token;
}

function buildRateLimitHeaders(limit: number, remaining: number, resetAt: string, retryAfterSeconds: number) {
  return {
    "RateLimit-Limit": String(limit),
    "RateLimit-Remaining": String(remaining),
    "RateLimit-Reset": resetAt,
    "Retry-After": String(Math.max(retryAfterSeconds, 1)),
  };
}

export async function authenticateApiRequest(input: {
  request: Request;
  requiredScopes?: ApiScope[];
  limit: number;
}): Promise<ApiAuthContext> {
  const token = readBearerToken(input.request);
  const consumed = await consumeApiTokenRateLimit({ token, limit: input.limit });

  if (!consumed) {
    throw invalidToken();
  }

  const resetMs = Math.max(Date.parse(consumed.reset_at) - Date.now(), 0);
  const retryAfterSeconds = Math.ceil(resetMs / 1000);
  const context: ApiAuthContext = {
    tokenId: consumed.token_id,
    ownerUserId: consumed.owner_user_id,
    scopes: consumed.scopes,
    rateLimit: {
      limit: input.limit,
      remaining: consumed.remaining,
      resetAt: consumed.reset_at,
      retryAfterSeconds,
    },
  };

  if (!consumed.allowed) {
    throw rateLimitExceeded(
      buildRateLimitHeaders(input.limit, consumed.remaining, consumed.reset_at, retryAfterSeconds),
    );
  }

  const requiredScopes = input.requiredScopes ?? [];
  if (requiredScopes.some((scope) => !context.scopes.includes(scope))) {
    throw insufficientScope();
  }

  return context;
}
