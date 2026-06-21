import { NextResponse } from "next/server";
import { seedAnalyticsSandboxForSession } from "@/features/surveys/analytics-sandbox";
import { getCurrentSession } from "@/lib/auth/session";

function toErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown analytics sandbox error.";

  if (/Unauthorized|not allowed|disabled|must be configured/i.test(message)) {
    return NextResponse.json({ error: message }, { status: 403 });
  }

  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await seedAnalyticsSandboxForSession(session);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
