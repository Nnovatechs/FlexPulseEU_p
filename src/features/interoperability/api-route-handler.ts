import { authenticateApiRequest } from "./api-auth";
import { ApiError, internalError } from "./api-errors";
import { logApiRequest } from "./api-logging";
import { createApiRequestContext, jsonError } from "./api-response";
import { API_RATE_LIMIT_STANDARD, type ApiAuthContext, type ApiRequestContext, type ApiScope } from "./api-types";

type HandleApiRouteInput<TParams> = {
  request: Request;
  routeTemplate: string;
  requiredScopes?: ApiScope[];
  limit?: number;
  publicRoute?: boolean;
  params?: Promise<TParams>;
  handler: (input: {
    auth: ApiAuthContext | null;
    context: ApiRequestContext;
    params: TParams;
  }) => Promise<Response>;
};

export async function handleApiRoute<TParams = Record<string, never>>(
  input: HandleApiRouteInput<TParams>,
) {
  const context = createApiRequestContext(input.request, input.routeTemplate);
  let auth: ApiAuthContext | null = null;
  try {
    if (!input.publicRoute) {
      auth = await authenticateApiRequest({
        request: input.request,
        requiredScopes: input.requiredScopes,
        limit: input.limit ?? API_RATE_LIMIT_STANDARD,
      });
    }
    const response = await input.handler({
      auth,
      context,
      params: input.params ? await input.params : ({} as TParams),
    });
    logApiRequest({
      context,
      tokenId: auth?.tokenId ?? null,
      status: response.status,
    });
    return response;
  } catch (error) {
    const apiError = error instanceof ApiError ? error : internalError();
    const response = jsonError(apiError, context.requestId, auth);
    logApiRequest({
      context,
      tokenId: auth?.tokenId ?? null,
      status: apiError.status,
    });
    return response;
  }
}
