import { NextResponse } from "next/server";
import { cleanupExpiredSurveyResponseLocationData } from "@/features/surveys/response-processing";
import { isInternalJobRequestAuthorized } from "@/lib/server/internal-job-auth";

async function handle(request: Request) {
  if (!isInternalJobRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "200");
  const result = await cleanupExpiredSurveyResponseLocationData(
    Number.isFinite(limit) && limit > 0 ? Math.min(limit, 1000) : 200,
  );

  return NextResponse.json(result);
}

export async function GET() {
  return new Response(null, { status: 404 });
}

export async function POST(request: Request) {
  return handle(request);
}
