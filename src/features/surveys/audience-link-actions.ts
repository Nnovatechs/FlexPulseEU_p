"use server";

import { revalidatePath } from "next/cache";
import { appRoutes } from "@/lib/config/routes";
import {
  createOwnedSurveyAudienceLink,
  setOwnedSurveyAudienceLinkActive,
} from "./generator-repository";

function readRequiredValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function revalidateSurveyAudiencePaths(surveyId: string) {
  revalidatePath(appRoutes.surveyDetail(surveyId));
  revalidatePath(appRoutes.surveyAnalytics(surveyId));
  revalidatePath(appRoutes.surveyAnalyticsV2(surveyId));
}

export async function createSurveyAudienceLinkAction(formData: FormData) {
  const surveyId = readRequiredValue(formData, "surveyId");
  const audienceLabel = String(formData.get("audienceLabel") ?? "");
  if (!surveyId) {
    throw new Error("Survey ID is required.");
  }

  const link = await createOwnedSurveyAudienceLink({
    surveyId,
    audienceLabel,
  });
  revalidateSurveyAudiencePaths(surveyId);
  return {
    id: link.id,
    audienceLabel: link.audience_label,
  };
}

export async function activateSurveyAudienceLinkAction(formData: FormData) {
  const surveyId = readRequiredValue(formData, "surveyId");
  const surveyLinkId = readRequiredValue(formData, "surveyLinkId");
  if (!surveyId || !surveyLinkId) {
    throw new Error("Survey ID and link ID are required.");
  }

  await setOwnedSurveyAudienceLinkActive({
    surveyId,
    surveyLinkId,
    isActive: true,
  });
  revalidateSurveyAudiencePaths(surveyId);
}

export async function deactivateSurveyAudienceLinkAction(formData: FormData) {
  const surveyId = readRequiredValue(formData, "surveyId");
  const surveyLinkId = readRequiredValue(formData, "surveyLinkId");
  if (!surveyId || !surveyLinkId) {
    throw new Error("Survey ID and link ID are required.");
  }

  await setOwnedSurveyAudienceLinkActive({
    surveyId,
    surveyLinkId,
    isActive: false,
  });
  revalidateSurveyAudiencePaths(surveyId);
}
