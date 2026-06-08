import { NextResponse } from "next/server";
import { processPendingSurveyResponseJobs } from "@/features/surveys/response-processing";
import { isInternalJobRequestAuthorized } from "@/lib/server/internal-job-auth";

async function handle(request: Request) {
  if (!isInternalJobRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "10");
  const result = await processPendingSurveyResponseJobs(
    Number.isFinite(limit) && limit > 0 ? Math.min(limit, 50) : 10,
  );

  return NextResponse.json(result);
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
