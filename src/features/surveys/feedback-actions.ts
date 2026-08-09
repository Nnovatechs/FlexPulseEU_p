"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { appRoutes } from "@/lib/config/routes";
import {
  createPublicSurveyResponseFeedback,
  getPublicSurveyFeedbackCompletionUrl,
  getPublicSurveyFeedbackPageData,
  setOwnedSurveyFeedbackEnabled,
} from "./feedback-repository";

const FEEDBACK_TEXT_MAX_LENGTH = 2000;

function readRequiredText(
  formData: FormData,
  key: string,
  label: string,
  maxLength = FEEDBACK_TEXT_MAX_LENGTH,
) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) {
    throw new Error(`${label} is required.`);
  }
  if (value.length > maxLength) {
    throw new Error(`${label} must be at most ${maxLength} characters.`);
  }
  return value;
}

export async function setSurveyFeedbackEnabledAction(formData: FormData) {
  const surveyId = String(formData.get("surveyId") ?? "").trim();
  const enabled = String(formData.get("enabled") ?? "").trim() === "true";

  if (!surveyId) {
    throw new Error("Survey ID is required.");
  }

  await setOwnedSurveyFeedbackEnabled({ surveyId, enabled });
  revalidatePath(appRoutes.surveyEdit(surveyId));
  revalidatePath(appRoutes.surveyDetail(surveyId));
}

export async function submitPublicSurveyFeedbackAction(
  formData: FormData,
): Promise<void> {
  const linkToken = readRequiredText(formData, "linkToken", "Survey link token");
  const responseId = readRequiredText(formData, "responseId", "Response ID");
  const easeRatingRaw = readRequiredText(formData, "easeRating", "Ease rating");
  const easeRating = Number(easeRatingRaw);

  if (!Number.isInteger(easeRating) || easeRating < 1 || easeRating > 5) {
    throw new Error("Ease rating must be an integer between 1 and 5.");
  }

  const pageData = await getPublicSurveyFeedbackPageData({ linkToken, responseId });
  if (!pageData) {
    throw new Error("Survey feedback is unavailable for this response.");
  }

  await createPublicSurveyResponseFeedback({
    responseId,
    easeRating,
    unclearQuestionsText: readRequiredText(
      formData,
      "unclearQuestionsText",
      "Unclear questions feedback",
    ),
    energyFlexibilityProgrammeText: readRequiredText(
      formData,
      "energyFlexibilityProgrammeText",
      "Energy-flexibility programme feedback",
    ),
    automatedControlText: readRequiredText(
      formData,
      "automatedControlText",
      "Automated home energy control feedback",
    ),
    leadingQuestionsText: readRequiredText(
      formData,
      "leadingQuestionsText",
      "Leading questions feedback",
    ),
    overlapOrTechnicalText: readRequiredText(
      formData,
      "overlapOrTechnicalText",
      "Overlap or technical wording feedback",
    ),
  });

  const completionUrl = await getPublicSurveyFeedbackCompletionUrl(responseId);
  if (completionUrl) {
    redirect(completionUrl);
  }

  redirect(
    `${appRoutes.publicSurveyThankYou(linkToken)}?lang=${encodeURIComponent(
      pageData.response.submitted_language,
    )}`,
  );
}
