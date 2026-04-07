import { NextResponse } from "next/server";
import { cleanupExpiredSurveyResponseLocationData } from "@/features/surveys/response-processing";
import { getInternalJobSecret } from "@/lib/server/internal-jobs-env";

function isAuthorized(request: Request) {
  const expected = getInternalJobSecret();
  const provided =
    request.headers.get("x-internal-job-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  return provided === expected;
}

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "200");
  const result = await cleanupExpiredSurveyResponseLocationData(
    Number.isFinite(limit) && limit > 0 ? Math.min(limit, 1000) : 200,
  );

  return NextResponse.json(result);
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
