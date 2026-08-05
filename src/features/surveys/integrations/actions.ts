"use server";

import { revalidatePath } from "next/cache";
import { appRoutes } from "@/lib/config/routes";
import {
  deactivateOwnedProlificIntegration,
  upsertOwnedProlificIntegration,
} from "./repository";

export async function connectProlificIntegrationAction(formData: FormData) {
  const surveyId = String(formData.get("surveyId") ?? "").trim();
  const surveyLinkId = String(formData.get("surveyLinkId") ?? "").trim();
  const studyId = String(formData.get("studyId") ?? "").trim();
  const completionUrl = String(formData.get("completionUrl") ?? "").trim();

  if (!surveyId || !surveyLinkId || !studyId || !completionUrl) {
    throw new Error("Missing required Prolific integration fields.");
  }

  await upsertOwnedProlificIntegration({
    surveyLinkId,
    studyId,
    completionUrl,
  });

  revalidatePath(appRoutes.surveyDetail(surveyId));
}

export async function disconnectProlificIntegrationAction(formData: FormData) {
  const surveyId = String(formData.get("surveyId") ?? "").trim();
  const surveyLinkId = String(formData.get("surveyLinkId") ?? "").trim();

  if (!surveyId || !surveyLinkId) {
    throw new Error("Missing required Prolific integration fields.");
  }

  await deactivateOwnedProlificIntegration(surveyLinkId);
  revalidatePath(appRoutes.surveyDetail(surveyId));
}
