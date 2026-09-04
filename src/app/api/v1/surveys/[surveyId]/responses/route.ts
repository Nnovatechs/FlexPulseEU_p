import { API_RATE_LIMIT_STANDARD } from "@/features/interoperability/api-types";
import { listOwnedSurveyResponsesForApi } from "@/features/interoperability/api-repository";
import { handleApiRoute } from "@/features/interoperability/api-route-handler";
import { parsePageLimit, shrinkItemsToFit, encodeCursor } from "@/features/interoperability/api-pagination";
import { jsonList } from "@/features/interoperability/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(
  request: Request,
  context: { params: Promise<{ surveyId: string }> },
) {
  return handleApiRoute({
    request,
    params: context.params,
    routeTemplate: "/api/v1/surveys/{surveyId}/responses",
    requiredScopes: ["data:read"],
    limit: API_RATE_LIMIT_STANDARD,
    handler: async ({ auth, context: requestContext, params }) => {
      const url = new URL(request.url);
      const page = await listOwnedSurveyResponsesForApi({
        ownerUserId: auth!.ownerUserId,
        surveyId: params.surveyId,
        limit: parsePageLimit(url.searchParams.get("limit")),
        cursor: url.searchParams.get("cursor"),
      });
      const fitted = shrinkItemsToFit({
        items: page.items,
        sourceHasMore: page.hasMore,
        buildCursor: (item) =>
          encodeCursor({
            respondedAt: item.responded_at,
            responseId: item.response_id,
          }),
        buildEnvelope: (items, meta) => ({
          data: items,
          meta: {
            api_version: "v1",
            request_id: requestContext.requestId,
            generated_at: new Date().toISOString(),
            next_cursor: meta.nextCursor,
            has_more: meta.hasMore,
          },
        }),
      });
      return jsonList(fitted.items, requestContext.requestId, fitted, auth);
    },
  });
}
