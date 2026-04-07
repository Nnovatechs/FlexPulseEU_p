"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appRoutes } from "@/lib/config/routes";
import { runContentValidation, computeContentHash } from "./content-validator";
import { generateSurveyDraftProposal } from "./generator-executor";
import { translateSurveyLanguage } from "./translation-service";
import {
  computeMultilingualTranslationHash,
  validateTranslatedSurveyLanguage,
} from "./translation-validation";
import {
  createSurveyDraft,
  getOwnedSurveyById,
  updateSurveyDraft,
  publishSurvey,
} from "./generator-repository";
import type {
  MultilingualValidationIssue,
  MultilingualValidationResult,
  SurveyDefinition,
  SurveyLanguageTranslations,
} from "./generator-types";
import { normalizeSurveyResponseContextConfig } from "./generator-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEditErrorRedirect(surveyId: string, error: string) {
  return `${appRoutes.surveyEdit(surveyId)}?error=${error}`;
}

function clearReviewValidationResults(definition: SurveyDefinition): SurveyDefinition {
  const next = structuredClone(definition);
  delete next.survey_meta.validation_result;
  delete next.survey_meta.multilingual_validation_result;
  return next;
}

function assertCurrentContentValidation(survey: Awaited<ReturnType<typeof getOwnedSurveyById>>) {
  const validationResult = survey.definition_json.survey_meta.validation_result;
  const translations = survey.definition_json.translations[survey.default_language];

  if (!validationResult?.passed) {
    throw new Error(
      "Survey must pass content validation before generating translations.",
    );
  }

  const currentHash = computeContentHash(survey.definition_json.questions, translations);

  if (currentHash !== validationResult.content_hash) {
    throw new Error(
      "Content validation is outdated. Re-run content validation before generating translations.",
    );
  }
}

function buildMultilingualValidationResult(
  validatedLanguages: string[],
  translationHash: string,
  issues: MultilingualValidationIssue[],
): MultilingualValidationResult {
  return {
    validated_at: new Date().toISOString(),
    translation_hash: translationHash,
    validated_languages: validatedLanguages,
    passed: issues.length === 0,
    issues,
    language_statuses: validatedLanguages.map((language) => {
      const issueCount = issues.filter((issue) => issue.language === language).length;
      return {
        language,
        passed: issueCount === 0,
        issue_count: issueCount,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Create draft
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Update settings / generate
// ---------------------------------------------------------------------------

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
  const collectCountryCode = formData.get("collectCountryCode") === "on";
  const collectPostalCode = formData.get("collectPostalCode") === "on";
  const enrichWeatherContext = formData.get("enrichWeatherContext") === "on";

  if (!surveyId || !name || !defaultLanguage) {
    redirect(buildEditErrorRedirect(surveyId, "missing-fields"));
  }

  const existing = await getOwnedSurveyById(surveyId);
  const nextSupportedLanguages = Array.from(
    new Set([defaultLanguage, ...supportedLanguages]),
  );
  const responseContext = normalizeSurveyResponseContextConfig({
    collect_country_code: collectCountryCode,
    collect_postal_code: collectPostalCode,
    enrich_weather_context: enrichWeatherContext,
  });

  // Always clear validation when settings or questions change
  const nextDefinition = clearReviewValidationResults(existing.definition_json);
  nextDefinition.survey_meta.ontology_targets = ontologyTargets;
  nextDefinition.survey_meta.response_context = responseContext;
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

      // Generated content → validation is stale, clear it
      proposal.definition.survey_meta.validation_result = undefined;
      proposal.definition.survey_meta.multilingual_validation_result = undefined;

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

// ---------------------------------------------------------------------------
// Update question translation (inline edit)
// ---------------------------------------------------------------------------

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

  // Clear validation — any text edit invalidates previous result
  const nextDefinition = clearReviewValidationResults(existing.definition_json);

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

// ---------------------------------------------------------------------------
// Validate survey content (PII + semantic)
// ---------------------------------------------------------------------------

export async function validateSurveyContentAction(
  formData: FormData,
): Promise<void> {
  const surveyId = String(formData.get("surveyId") ?? "").trim();

  if (!surveyId) {
    throw new Error("Missing survey ID.");
  }

  const survey = await getOwnedSurveyById(surveyId);
  const { questions } = survey.definition_json;
  const { mappings } = survey.mapping_contract_json;
  const translations =
    survey.definition_json.translations[survey.default_language];

  if (!translations || questions.length === 0) {
    throw new Error("No questions to validate. Generate the survey first.");
  }

  const result = await runContentValidation(
    questions,
    mappings,
    translations,
    survey.default_language,
  );

  const nextDefinition = structuredClone(survey.definition_json);
  nextDefinition.survey_meta.validation_result = result;

  await updateSurveyDraft({ surveyId, definition_json: nextDefinition });

  revalidatePath(appRoutes.surveyEdit(surveyId));
}

// ---------------------------------------------------------------------------
// Generate + validate multilingual survey versions
// ---------------------------------------------------------------------------

export async function generateSurveyTranslationsAction(
  formData: FormData,
): Promise<void> {
  const surveyId = String(formData.get("surveyId") ?? "").trim();

  if (!surveyId) {
    throw new Error("Missing survey ID.");
  }

  const survey = await getOwnedSurveyById(surveyId);
  assertCurrentContentValidation(survey);

  const sourceTranslations =
    survey.definition_json.translations[survey.default_language];
  const targetLanguages = survey.supported_languages.filter(
    (language) => language !== survey.default_language,
  );

  const nextDefinition = structuredClone(survey.definition_json);

  if (targetLanguages.length === 0) {
    nextDefinition.survey_meta.multilingual_validation_result =
      buildMultilingualValidationResult(
        survey.supported_languages,
        computeMultilingualTranslationHash(nextDefinition, survey.supported_languages),
        [],
      );

    await updateSurveyDraft({ surveyId, definition_json: nextDefinition });
    revalidatePath(appRoutes.surveyEdit(surveyId));
    return;
  }

  const translationRuns = await Promise.all(
    targetLanguages.map(async (targetLanguage) => {
      const translatedBundle = await translateSurveyLanguage({
        surveyName: survey.name,
        sourceLanguage: survey.default_language,
        targetLanguage,
        sourceTranslations,
        questions: survey.definition_json.questions,
        mappings: survey.mapping_contract_json.mappings,
      });

      const issues = await validateTranslatedSurveyLanguage({
        sourceLanguage: survey.default_language,
        targetLanguage,
        sourceTranslations,
        targetTranslations: translatedBundle,
        questions: survey.definition_json.questions,
        mappings: survey.mapping_contract_json.mappings,
      });

      return { targetLanguage, translatedBundle, issues };
    }),
  );

  const multilingualIssues: MultilingualValidationIssue[] = [];

  for (const run of translationRuns) {
    nextDefinition.translations[run.targetLanguage] = run.translatedBundle;
    multilingualIssues.push(...run.issues);
  }

  nextDefinition.survey_meta.multilingual_validation_result =
    buildMultilingualValidationResult(
      survey.supported_languages,
      computeMultilingualTranslationHash(nextDefinition, survey.supported_languages),
      multilingualIssues,
    );

  await updateSurveyDraft({ surveyId, definition_json: nextDefinition });

  revalidatePath(appRoutes.surveyEdit(surveyId));
}

// ---------------------------------------------------------------------------
// Publish survey
// ---------------------------------------------------------------------------

export async function publishSurveyAction(formData: FormData): Promise<void> {
  const surveyId = String(formData.get("surveyId") ?? "").trim();

  if (!surveyId) {
    throw new Error("Missing survey ID.");
  }

  const survey = await getOwnedSurveyById(surveyId);
  const validationResult = survey.definition_json.survey_meta.validation_result;
  const translations =
    survey.definition_json.translations[survey.default_language];
  const multilingualValidationResult =
    survey.definition_json.survey_meta.multilingual_validation_result;

  if (!validationResult?.passed) {
    throw new Error(
      "Survey must pass content validation before publishing.",
    );
  }

  // Guard against stale validation (questions edited after validation ran)
  const currentHash = computeContentHash(
    survey.definition_json.questions,
    translations,
  );

  if (currentHash !== validationResult.content_hash) {
    throw new Error(
      "Validation result is outdated. Re-run validation after your recent edits.",
    );
  }

  if (survey.supported_languages.length > 1) {
    if (!multilingualValidationResult?.passed) {
      throw new Error(
        "Survey must pass multilingual validation before publishing.",
      );
    }

    const currentTranslationHash = computeMultilingualTranslationHash(
      survey.definition_json,
      survey.supported_languages,
    );

    if (currentTranslationHash !== multilingualValidationResult.translation_hash) {
      throw new Error(
        "Multilingual validation is outdated. Re-run translation validation before publishing.",
      );
    }

    const missingValidatedLanguages = survey.supported_languages.filter(
      (language) =>
        !multilingualValidationResult.validated_languages.includes(language),
    );

    if (missingValidatedLanguages.length > 0) {
      throw new Error(
        `Multilingual validation is missing languages: ${missingValidatedLanguages.join(", ")}.`,
      );
    }
  }

  await publishSurvey(surveyId);

  revalidatePath(appRoutes.surveyDetail(surveyId));
  revalidatePath(appRoutes.surveys);
  revalidatePath(appRoutes.dashboard);

  redirect(`${appRoutes.surveyDetail(surveyId)}?published=1`);
}
