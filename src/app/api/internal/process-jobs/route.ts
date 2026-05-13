import { NextResponse } from "next/server";
import { processPendingSurveyResponseEnrichmentJobs } from "@/features/surveys/response-processing";
import { isInternalJobRequestAuthorized } from "@/lib/server/internal-job-auth";

async function handle(request: Request) {
  if (!isInternalJobRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "10");
  const result = await processPendingSurveyResponseEnrichmentJobs(
    Number.isFinite(limit) && limit > 0 ? Math.min(limit, 50) : 10,
  );

  return NextResponse.json(result);
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "process-jobs",
    allowed_methods: ["POST"],
  });
}

export async function POST(request: Request) {
  return handle(request);
}
