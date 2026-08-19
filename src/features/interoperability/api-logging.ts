import type { ApiRequestContext } from "./api-types";

export function logApiRequest(input: {
  context: ApiRequestContext;
  tokenId: string | null;
  status: number;
}) {
  console.info(
    JSON.stringify({
      request_id: input.context.requestId,
      token_id: input.tokenId,
      route: input.context.routeTemplate,
      method: input.context.method,
      status: input.status,
      duration_ms: Date.now() - input.context.startedAt,
    }),
  );
}
