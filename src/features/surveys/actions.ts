"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appRoutes } from "@/lib/config/routes";
import { generateSurveyDraftProposal } from "./generator-executor";
import { createSurveyDraft, getOwnedSurveyById, updateSurveyDraft } from "./generator-repository";
import type { SurveyLanguageTranslations } from "./generator-types";

export async function createSurveyDraftAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const defaultLanguage = String(formData.get("defaultLanguage") ?? "").trim();

  if (!name || !defaultLanguage) {
    redirect(`${appRoutes.surveyNew}?error=missing-fields`);
  }

  const survey = await createSurveyDraft({
    name,
    default_language: defaultLanguage,
    supported_languages: [defaultLanguage],
  });

  revalidatePath(appRoutes.dashboard);
  revalidatePath(appRoutes.surveys);
  redirect(`${appRoutes.surveyEdit(survey.id)}?created=1`);
}

function buildEditErrorRedirect(surveyId: string, error: string) {
  return `${appRoutes.surveyEdit(surveyId)}?error=${error}`;
}

export async function updateSurveySettingsAction(formData: FormData) {
  const surveyId = String(formData.get("surveyId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const surveyDescription = String(formData.get("surveyDescription") ?? "").trim();
  const defaultLanguage = String(formData.get("defaultLanguage") ?? "").trim();
  const intent = String(formData.get("intent") ?? "save").trim();
  const supportedLanguages = formData
    .getAll("supportedLanguages")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const ontologyTargets = formData
    .getAll("ontologyTargets")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (!surveyId || !name || !defaultLanguage) {
    redirect(buildEditErrorRedirect(surveyId, "missing-fields"));
  }

  const existing = await getOwnedSurveyById(surveyId);
  const nextDefinition = structuredClone(existing.definition_json);
  const nextSupportedLanguages = Array.from(
    new Set([defaultLanguage, ...supportedLanguages]),
  );

  nextDefinition.survey_meta.ontology_targets = ontologyTargets;

  nextDefinition.translations[defaultLanguage] ??= {
    survey_title: "",
    survey_description: "",
    questions: {},
  };
  nextDefinition.translations[defaultLanguage].survey_description = surveyDescription;

  if (intent === "generate") {
    if (ontologyTargets.length === 0) {
      redirect(buildEditErrorRedirect(surveyId, "missing-ontology-targets"));
    }

    try {
      const proposal = await generateSurveyDraftProposal({
        survey: existing,
        surveyName: name,
        surveyDescription,
        defaultLanguage,
        supportedLanguages: nextSupportedLanguages,
        ontologyTargets,
      });

      await updateSurveyDraft({
        surveyId,
        name,
        default_language: defaultLanguage,
        supported_languages: nextSupportedLanguages,
        definition_json: proposal.definition,
        mapping_contract_json: proposal.mappingContract,
      });
    } catch (error) {
      const message =
        error instanceof Error ? encodeURIComponent(error.message) : "unknown";
      redirect(
        `${buildEditErrorRedirect(surveyId, "generation-failed")}&message=${message}`,
      );
    }
  } else {
    await updateSurveyDraft({
      surveyId,
      name,
      default_language: defaultLanguage,
      supported_languages: nextSupportedLanguages,
      definition_json: nextDefinition,
      mapping_contract_json: existing.mapping_contract_json,
    });
  }

  revalidatePath(appRoutes.dashboard);
  revalidatePath(appRoutes.surveys);
  revalidatePath(appRoutes.surveyDetail(surveyId));
  revalidatePath(appRoutes.surveyEdit(surveyId));
  revalidatePath(appRoutes.surveyAnalytics(surveyId));

  const redirectParam = intent === "generate" ? "generated=1" : "saved=1";
  redirect(`${appRoutes.surveyEdit(surveyId)}?${redirectParam}`);
}

export async function updateQuestionTranslationAction(
  formData: FormData,
): Promise<void> {
  const surveyId = String(formData.get("surveyId") ?? "").trim();
  const questionKey = String(formData.get("questionKey") ?? "").trim();
  const defaultLanguage = String(formData.get("defaultLanguage") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!surveyId || !questionKey || !defaultLanguage || !title) {
    throw new Error("Missing required fields.");
  }

  const existing = await getOwnedSurveyById(surveyId);
  const nextDefinition = structuredClone(existing.definition_json);

  nextDefinition.translations[defaultLanguage] ??= {
    survey_title: "",
    questions: {},
  };

  const currentQuestion: SurveyLanguageTranslations["questions"][string] =
    nextDefinition.translations[defaultLanguage].questions[questionKey] ?? {
      title: "",
    };

  const options: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("option_")) {
      const optionKey = key.slice(7);
      const label = String(value).trim();
      if (label) {
        options[optionKey] = label;
      }
    }
  }

  nextDefinition.translations[defaultLanguage].questions[questionKey] = {
    ...currentQuestion,
    title,
    ...(description ? { description } : {}),
    ...(Object.keys(options).length > 0 ? { options } : {}),
  };

  await updateSurveyDraft({
    surveyId,
    definition_json: nextDefinition,
  });

  revalidatePath(appRoutes.surveyEdit(surveyId));
}
