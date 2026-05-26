import { NextResponse } from "next/server";
import {
  getSurveyAnalyticsSchema,
  runSurveyAnalytics,
} from "@/features/surveys/use-cases";
import { parseSurveyAnalyticsQueryInput } from "@/features/surveys/survey-analytics";
import { getCurrentSession } from "@/lib/auth/session";

function toErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown analytics error.";

  if (/not found/i.test(message)) {
    return NextResponse.json({ error: message }, { status: 404 });
  }

  if (
    /Unknown .* field/i.test(message) ||
    /Analytics query/i.test(message) ||
    /Analytics metric/i.test(message) ||
    /Duplicate analytics metric key/i.test(message) ||
    /cannot be used in group_by/i.test(message) ||
    /is not allowed/i.test(message)
  ) {
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ surveyId: string }> },
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { surveyId } = await context.params;
    const schema = await getSurveyAnalyticsSchema(surveyId);
    return NextResponse.json(schema);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ surveyId: string }> },
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const query = parseSurveyAnalyticsQueryInput(await request.json());
    const { surveyId } = await context.params;
    const result = await runSurveyAnalytics(surveyId, query);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
