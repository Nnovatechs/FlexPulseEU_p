"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appRoutes } from "@/lib/config/routes";
import { createSurveyDraft, getOwnedSurveyById, updateSurveyDraft } from "./generator-repository";

export async function createSurveyDraftAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const defaultLanguage = String(formData.get("defaultLanguage") ?? "").trim();
  const supportedLanguages = formData
    .getAll("supportedLanguages")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (!name || !defaultLanguage) {
    redirect(`${appRoutes.surveyNew}?error=missing-fields`);
  }

  const survey = await createSurveyDraft({
    name,
    default_language: defaultLanguage,
    supported_languages: supportedLanguages,
  });

  revalidatePath(appRoutes.dashboard);
  revalidatePath(appRoutes.surveys);
  redirect(`${appRoutes.surveyEdit(survey.id)}?created=1`);
}

export async function updateSurveySettingsAction(formData: FormData) {
  const surveyId = String(formData.get("surveyId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const surveyTitle = String(formData.get("surveyTitle") ?? "").trim();
  const surveyDescription = String(formData.get("surveyDescription") ?? "").trim();
  const defaultLanguage = String(formData.get("defaultLanguage") ?? "").trim();
  const supportedLanguages = formData
    .getAll("supportedLanguages")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (!surveyId || !name || !defaultLanguage) {
    redirect(`${appRoutes.surveyEdit(surveyId)}?error=missing-fields`);
  }

  const existing = await getOwnedSurveyById(surveyId);
  const nextDefinition = structuredClone(existing.definition_json);
  const nextSupportedLanguages = Array.from(
    new Set([defaultLanguage, ...supportedLanguages]),
  );

  nextDefinition.translations[defaultLanguage] ??= {
    survey_title: "",
    survey_description: "",
    questions: {},
  };
  nextDefinition.translations[defaultLanguage].survey_title = surveyTitle;
  nextDefinition.translations[defaultLanguage].survey_description = surveyDescription;

  await updateSurveyDraft({
    surveyId,
    name,
    default_language: defaultLanguage,
    supported_languages: nextSupportedLanguages,
    definition_json: nextDefinition,
    mapping_contract_json: existing.mapping_contract_json,
  });

  revalidatePath(appRoutes.dashboard);
  revalidatePath(appRoutes.surveys);
  revalidatePath(appRoutes.surveyDetail(surveyId));
  revalidatePath(appRoutes.surveyEdit(surveyId));
  revalidatePath(appRoutes.surveyAnalytics(surveyId));
  redirect(`${appRoutes.surveyEdit(surveyId)}?saved=1`);
}
