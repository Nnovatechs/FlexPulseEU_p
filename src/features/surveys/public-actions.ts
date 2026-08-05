"use server";

import { redirect } from "next/navigation";
import { appRoutes } from "@/lib/config/routes";
import { verifyTurnstileToken } from "@/lib/server/turnstile";
import { getPublicSurveyLegalSnapshot } from "@/features/privacy/repository";
import { getActivePublicProlificIntegration } from "@/features/surveys/integrations/repository";
import {
  getProlificLaunchParamsFromFormData,
  resolveProlificRecruitment,
} from "@/features/surveys/integrations/prolific";
import { buildProlificRecruitmentTokens } from "@/features/surveys/integrations/tokenization";
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

  const legalSnapshot = await getPublicSurveyLegalSnapshot(survey.id);
  const validated = validatePublicSurveySubmission(
    survey,
    formData,
    legalSnapshot?.snapshot,
  );
  const prolificIntegration = await getActivePublicProlificIntegration(link.id);
  const prolificLaunch = getProlificLaunchParamsFromFormData(formData);
  const externalRecruitment = resolveProlificRecruitment({
    ...prolificLaunch,
    integration: prolificIntegration,
  });

  if (externalRecruitment.kind === "error") {
    throw new Error(externalRecruitment.message);
  }

  await createSurveyResponseAndEnqueueJob({
    survey,
    surveyLink: link,
    submittedLanguage: validated.submittedLanguage,
    answers: validated.answers,
    countryCodeRaw: validated.countryCodeRaw,
    postalCodeRaw: validated.postalCodeRaw,
    legalConsent: validated.legalConsent,
    externalRecruitment:
      externalRecruitment.kind === "prolific" && prolificIntegration
        ? {
            integration: prolificIntegration,
            ...buildProlificRecruitmentTokens({
              integrationId: prolificIntegration.id,
              prolificPid: externalRecruitment.prolificPid,
              sessionId: externalRecruitment.sessionId,
            }),
          }
        : null,
  });

  if (externalRecruitment.kind === "prolific" && prolificIntegration) {
    redirect(prolificIntegration.completion_url);
  }

  const target = new URLSearchParams();
  if (validated.submittedLanguage) {
    target.set("lang", validated.submittedLanguage);
  }

  redirect(`${appRoutes.publicSurveyThankYou(linkToken)}?${target.toString()}`);
}
