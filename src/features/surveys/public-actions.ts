"use server";

import { redirect } from "next/navigation";
import { appRoutes } from "@/lib/config/routes";
import { verifyTurnstileToken } from "@/lib/server/turnstile";
import {
  getPublicSurveyLinkByToken,
  getPublishedSurveyByIdPublic,
} from "./public-survey-load";
import { createSurveyResponseAndEnqueueJob } from "./response-repository";
import { validatePublicSurveySubmission } from "./response-validation";

export async function submitPublicSurveyResponseAction(
  formData: FormData,
): Promise<void> {
  const linkToken = String(formData.get("linkToken") ?? "").trim();

  if (!linkToken) {
    throw new Error("Missing survey link token.");
  }

  await verifyTurnstileToken(String(formData.get("cf-turnstile-response") ?? ""));

  const link = await getPublicSurveyLinkByToken(linkToken);
  if (!link) {
    throw new Error("Survey link not found or inactive.");
  }

  const survey = await getPublishedSurveyByIdPublic(link.survey_id);
  if (!survey) {
    throw new Error("Published survey not found.");
  }

  const validated = validatePublicSurveySubmission(survey, formData);

  await createSurveyResponseAndEnqueueJob({
    survey,
    surveyLink: link,
    submittedLanguage: validated.submittedLanguage,
    answers: validated.answers,
    countryCodeRaw: validated.countryCodeRaw,
    postalCodeRaw: validated.postalCodeRaw,
  });

  const target = new URLSearchParams();
  if (validated.submittedLanguage) {
    target.set("lang", validated.submittedLanguage);
  }

  redirect(`${appRoutes.publicSurveyThankYou(linkToken)}?${target.toString()}`);
}
