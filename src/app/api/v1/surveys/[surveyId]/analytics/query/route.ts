import { API_MAX_QUERY_BYTES, API_RATE_LIMIT_ANALYTICS } from "@/features/interoperability/api-types";
import { invalidRequest, payloadTooLarge } from "@/features/interoperability/api-errors";
import {
  assertAnalyticsQueryLimits,
  runOwnedSurveyAnalyticsQueryForApi,
} from "@/features/interoperability/api-repository";
import { handleApiRoute } from "@/features/interoperability/api-route-handler";
import { jsonSuccess } from "@/features/interoperability/api-response";
import { parseSurveyAnalyticsQueryInput } from "@/features/surveys/survey-analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function toAnalyticsQueryValidationError(error: unknown) {
  const message = error instanceof Error ? error.message : "Invalid analytics query.";
  if (
    /Unknown .* field/i.test(message) ||
    /Analytics query/i.test(message) ||
    /Analytics metric/i.test(message) ||
    /Duplicate analytics metric key/i.test(message) ||
    /cannot be used in group_by/i.test(message) ||
    /is not allowed/i.test(message)
  ) {
    return invalidRequest(message);
  }
  return error;
}

async function parseQueryRequest(request: Request) {
  const rawText = await request.text();
  if (Buffer.byteLength(rawText, "utf8") > API_MAX_QUERY_BYTES) {
    throw payloadTooLarge("Analytics query bodies must stay below 64 KB.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw invalidRequest("Request body must be valid JSON.");
  }
  let query;
  try {
    query = parseSurveyAnalyticsQueryInput(parsed);
  } catch (error) {
    throw toAnalyticsQueryValidationError(error);
  }
  assertAnalyticsQueryLimits(query);
  return query;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ surveyId: string }> },
) {
  return handleApiRoute({
    request,
    params: context.params,
    routeTemplate: "/api/v1/surveys/{surveyId}/analytics/query",
    requiredScopes: ["analytics:read"],
    limit: API_RATE_LIMIT_ANALYTICS,
    handler: async ({ auth, context: requestContext, params }) => {
      const query = await parseQueryRequest(request);
      let result;
      try {
        result = await runOwnedSurveyAnalyticsQueryForApi(auth!.ownerUserId, params.surveyId, query);
      } catch (error) {
        throw toAnalyticsQueryValidationError(error);
      }
      if ((result.result.groups?.length ?? 0) > 500) {
        throw invalidRequest("Analytics queries may return at most 500 grouped rows.");
      }
      return jsonSuccess(result, requestContext.requestId, auth);
    },
  });
}
