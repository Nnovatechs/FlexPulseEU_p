"use server";

import { redirect } from "next/navigation";
import { appRoutes } from "@/lib/config/routes";
import {
  getPublicSurveyLinkByToken,
  getPublishedSurveyByIdPublic,
} from "./generator-repository";
import { createSurveyResponseAndEnqueueJob } from "./response-repository";
import { validatePublicSurveySubmission } from "./response-validation";

export async function submitPublicSurveyResponseAction(
  formData: FormData,
): Promise<void> {
  const linkToken = String(formData.get("linkToken") ?? "").trim();
  const submittedLanguage = String(formData.get("submittedLanguage") ?? "").trim();

  if (!linkToken) {
    throw new Error("Missing survey link token.");
  }

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
  if (submittedLanguage) {
    target.set("lang", submittedLanguage);
  }

  redirect(`${appRoutes.publicSurveyThankYou(linkToken)}?${target.toString()}`);
}
