"use server";

import { redirect } from "next/navigation";
import { requireCurrentSession } from "@/lib/auth/session";
import {
  createDashboardQaSandboxForSession,
  resetDashboardQaSandboxForSession,
} from "@/features/surveys/dashboard-qa-sandbox";

export async function createDashboardQaSandboxAction() {
  const session = await requireCurrentSession();
  const result = await createDashboardQaSandboxForSession(session);
  redirect(result.analyticsUrl);
}

export async function resetDashboardQaSandboxAction() {
  const session = await requireCurrentSession();
  const result = await resetDashboardQaSandboxForSession(session);
  redirect(result.analyticsUrl);
}
