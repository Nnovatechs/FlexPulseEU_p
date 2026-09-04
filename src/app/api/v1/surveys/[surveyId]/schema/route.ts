import { API_RATE_LIMIT_STANDARD } from "@/features/interoperability/api-types";
import { getOwnedSurveySchemaForApi } from "@/features/interoperability/api-repository";
import { handleApiRoute } from "@/features/interoperability/api-route-handler";
import { jsonSuccess } from "@/features/interoperability/api-response";

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
    routeTemplate: "/api/v1/surveys/{surveyId}/schema",
    requiredScopes: ["surveys:read"],
    limit: API_RATE_LIMIT_STANDARD,
    handler: async ({ auth, context: requestContext, params }) =>
      jsonSuccess(
        await getOwnedSurveySchemaForApi(auth!.ownerUserId, params.surveyId),
        requestContext.requestId,
        auth,
      ),
  });
}
