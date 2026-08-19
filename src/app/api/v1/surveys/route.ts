import { API_RATE_LIMIT_STANDARD } from "@/features/interoperability/api-types";
import { listOwnedSurveysForApi } from "@/features/interoperability/api-repository";
import { handleApiRoute } from "@/features/interoperability/api-route-handler";
import { encodeCursor, parsePageLimit, shrinkItemsToFit } from "@/features/interoperability/api-pagination";
import { jsonList } from "@/features/interoperability/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  return handleApiRoute({
    request,
    routeTemplate: "/api/v1/surveys",
    requiredScopes: ["surveys:read"],
    limit: API_RATE_LIMIT_STANDARD,
    handler: async ({ auth, context }) => {
      const url = new URL(request.url);
      const page = await listOwnedSurveysForApi({
        ownerUserId: auth!.ownerUserId,
        limit: parsePageLimit(url.searchParams.get("limit")),
        cursor: url.searchParams.get("cursor"),
      });
      const fitted = shrinkItemsToFit({
        items: page.items,
        sourceHasMore: page.hasMore,
        buildCursor: (item) =>
          encodeCursor({
            createdAt: item.created_at,
            id: item.id,
          }),
        buildEnvelope: (items, meta) => ({
          data: items,
          meta: {
            api_version: "v1",
            request_id: context.requestId,
            generated_at: new Date().toISOString(),
            next_cursor: meta.nextCursor,
            has_more: meta.hasMore,
          },
        }),
      });
      return jsonList(fitted.items, context.requestId, fitted, auth);
    },
  });
}
