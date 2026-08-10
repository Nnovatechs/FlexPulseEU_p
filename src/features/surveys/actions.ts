"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appRoutes } from "@/lib/config/routes";
import {
  getCurrentOwnerLegalProfile,
  prepareSurveyLegalSnapshot,
} from "@/features/privacy/repository";
import { getDpaConfig, isDpaConfigComplete } from "@/features/privacy/dpa";
import { getCurrentDpaAcceptance } from "@/features/privacy/dpa-repository";
import {
  DPA_ACCEPTANCE_REQUIRED_ERROR,
  isOwnerDpaProfileComplete,
  isOwnerLegalProfileComplete,
  PRIVACY_PROFILE_INCOMPLETE_ERROR,
} from "@/features/privacy/types";
import { deriveSchemaTargetsFromBehaviouralConceptKeys } from "@/features/ontology/flexpulse-behavioural-schema";
import { ensureDeclaredFlexibilityCapabilityDependencies } from "./declared-flexibility-capability-module";
import { runContentValidation, computeContentHash } from "./content-validator";
import {
  applyExpertReviewChanges,
  EXPERT_REVIEW_CONFIRMATION,
  getSurveyIntegrityState,
  normalizeExpertReviewBatch,
  type ApplyExpertReviewInput,
} from "./expert-review";
import { generateSurveyDraftProposal } from "./survey-generation-flow";
import { generateAndValidateTranslatedLanguage } from "./translation-loop";
import {
  computeMultilingualTranslationHash,
} from "./translation-validation";
import {
  createSurveyDraft,
  duplicateOwnedSurvey,
  getOwnedSurveyById,
  updateSurveyDraft,
  publishSurvey,
  deleteOwnedSurveyDraft,
  archiveOwnedSurvey,
} from "./generator-repository";
import type {
  ExpertReviewChangeField,
  ExpertReviewerType,
  MultilingualValidationIssue,
  MultilingualValidationResult,
  SurveyDefinition,
  SurveyLanguageTranslations,
} from "./generator-types";
import { normalizeSurveyResponseContextConfig } from "./generator-types";
import { prepareThermalComfortFacetRepair } from "./measurement-plan-repairs";
import { withSurveyTimingOperation, timeSurveyStep } from "./local-timing";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEditErrorRedirect(surveyId: string, error: string) {
  return `${appRoutes.surveyEdit(surveyId)}?error=${error}`;
}

function redirectIfSurveyNotEditable(
  surveyId: string,
  surveyStatus: Awaited<ReturnType<typeof getOwnedSurveyById>>["status"],
): void {
  if (surveyStatus !== "draft") {
    redirect(`${appRoutes.surveyDetail(surveyId)}?error=immutable`);
  }
}

function clearReviewValidationResults(definition: SurveyDefinition): SurveyDefinition {
  const next = structuredClone(definition);
  delete next.survey_meta.validation_result;
  delete next.survey_meta.multilingual_validation_result;
  delete next.survey_meta.expert_review_result;
  return next;
}

function haveSameStrings(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function shouldPreserveSettingsSnapshots(input: {
  existing: Awaited<ReturnType<typeof getOwnedSurveyById>>;
  nextDefaultLanguage: string;
  nextSupportedLanguages: string[];
  nextSurveyDescription: string;
}) {
  const existingDescription =
    input.existing.definition_json.translations[input.existing.default_language]
      ?.survey_description ?? "";

  const defaultLanguageChanged = input.existing.default_language !== input.nextDefaultLanguage;
  const supportedLanguagesChanged = !haveSameStrings(
    input.existing.supported_languages,
    input.nextSupportedLanguages,
  );
  const descriptionChanged = existingDescription.trim() !== input.nextSurveyDescription.trim();

  return {
    preserveSnapshots:
      !defaultLanguageChanged && !supportedLanguagesChanged && !descriptionChanged,
  };
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

function assertExpertReviewNotApplied(
  survey: Awaited<ReturnType<typeof getOwnedSurveyById>>,
  actionLabel: string,
) {
  if (survey.definition_json.survey_meta.expert_review_result) {
    throw new Error(
      `${actionLabel} is locked after expert review. Make a normal edit to clear the expert review snapshot first.`,
    );
  }
}

function assertValidApplyExpertReviewInput(
  survey: Awaited<ReturnType<typeof getOwnedSurveyById>>,
  input: ApplyExpertReviewInput,
) {
  const reviewerTypes = new Set<ExpertReviewerType>([
    "language_expert",
    "domain_expert",
    "research_team",
  ]);
  const changeFields = new Set<ExpertReviewChangeField>([
    "survey_title",
    "survey_description",
    "question_title",
  ]);

  if (!reviewerTypes.has(input.reviewerType)) {
    throw new Error("Reviewer type is invalid.");
  }

  if (!Array.isArray(input.changes)) {
    throw new Error("Expert review changes must be provided as an array.");
  }

  const questionKeys = new Set(
    survey.definition_json.questions.map((question) => question.question_key),
  );

  for (const change of input.changes) {
    if (!change || typeof change !== "object") {
      throw new Error("Each expert review change must be an object.");
    }

    if (typeof change.language !== "string" || !change.language.trim()) {
      throw new Error("Expert review change language is invalid.");
    }

    if (!changeFields.has(change.field)) {
      throw new Error("Expert review change field is invalid.");
    }

    if (typeof change.reviewed_value !== "string") {
      throw new Error("Expert review change value is invalid.");
    }

    if (change.field === "question_title") {
      if (typeof change.question_key !== "string" || !change.question_key.trim()) {
        throw new Error("Question title changes require a valid question_key.");
      }

      if (!questionKeys.has(change.question_key.trim())) {
        throw new Error(
          `Question "${change.question_key.trim()}" is not part of the survey definition.`,
        );
      }
      continue;
    }

    if (
      change.question_key != null &&
      (typeof change.question_key !== "string" || !change.question_key.trim())
    ) {
      throw new Error("Survey-level expert review changes cannot use an empty question_key.");
    }
  }
}

function buildMultilingualValidationResult(
  validatedLanguages: string[],
  translationHash: string,
  issues: MultilingualValidationIssue[],
): MultilingualValidationResult {
  const blockingIssues = issues.filter((issue) => issue.severity !== "advisory");

  return {
    validated_at: new Date().toISOString(),
    translation_hash: translationHash,
    validated_languages: validatedLanguages,
    passed: blockingIssues.length === 0,
    issues,
    language_statuses: validatedLanguages.map((language) => {
      const issueCount = blockingIssues.filter(
        (issue) => issue.language === language,
      ).length;
      return {
        language,
        passed: issueCount === 0,
        issue_count: issueCount,
      };
    }),
  };
}

export async function repairDraftThermalComfortFacetSemantics(surveyId: string) {
  if (!surveyId.trim()) {
    throw new Error("Missing survey ID.");
  }

  const survey = await getOwnedSurveyById(surveyId.trim());

  if (survey.status !== "draft") {
    throw new Error("Thermal facet repair only supports draft surveys.");
  }

  const preparedRepair = prepareThermalComfortFacetRepair(survey);
  if (!preparedRepair.changed) {
    return {
      survey,
      changed: false,
      previousMeasurementHash: preparedRepair.previousMeasurementHash,
      nextMeasurementHash: preparedRepair.nextMeasurementHash,
    };
  }

  const updatedSurvey = await updateSurveyDraft({
    surveyId: survey.id,
    definition_json: preparedRepair.nextDefinition,
  });

  revalidatePath(appRoutes.dashboard);
  revalidatePath(appRoutes.surveys);
  revalidatePath(appRoutes.surveyDetail(survey.id));
  revalidatePath(appRoutes.surveyEdit(survey.id));

  return {
    survey: updatedSurvey,
    changed: true,
    previousMeasurementHash: preparedRepair.previousMeasurementHash,
    nextMeasurementHash: preparedRepair.nextMeasurementHash,
  };
}

function toProductMultilingualIssues(
  issues: MultilingualValidationIssue[],
): MultilingualValidationIssue[] {
  const blockingIssues = issues.filter((issue) => {
    if (issue.type === "pii") {
      return true;
    }

    return issue.severity === "blocking";
  }).map((issue) => ({
    ...issue,
    severity: "blocking" as const,
  }));

  const advisoryByLanguage = new Map<string, MultilingualValidationIssue[]>();

  for (const issue of issues) {
    if (issue.type === "pii" || issue.severity === "blocking") {
      continue;
    }

    const normalizedIssue: MultilingualValidationIssue = {
      ...issue,
      severity: "advisory",
    };
    const languageIssues = advisoryByLanguage.get(issue.language) ?? [];

    if (languageIssues.length < 3) {
      languageIssues.push(normalizedIssue);
      advisoryByLanguage.set(issue.language, languageIssues);
    }
  }

  return [...blockingIssues, ...Array.from(advisoryByLanguage.values()).flat()];
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
  let postRedirectMessage: string | null = null;
  const supportedLanguages = formData
    .getAll("supportedLanguages")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const behaviouralConceptKeys = ensureDeclaredFlexibilityCapabilityDependencies(
    formData
      .getAll("behaviouralConceptKeys")
      .map((value) => String(value).trim())
      .filter(Boolean),
  );
  const schemaTargets =
    behaviouralConceptKeys.length > 0
      ? deriveSchemaTargetsFromBehaviouralConceptKeys(behaviouralConceptKeys)
      : [];
  const surveyContextMode = String(formData.get("surveyContextMode") ?? "none").trim();
  const responseContext = normalizeSurveyResponseContextConfig({
    collect_country_code:
      surveyContextMode === "country_only" ||
      surveyContextMode === "postal_prefix" ||
      surveyContextMode === "full_postal" ||
      surveyContextMode === "weather_enriched",
    collect_postal_code:
      surveyContextMode === "postal_prefix" ||
      surveyContextMode === "full_postal" ||
      surveyContextMode === "weather_enriched",
    enrich_weather_context: surveyContextMode === "weather_enriched",
    postal_collection_mode: surveyContextMode === "postal_prefix" ? "prefix" : "full",
  });

  if (!surveyId || !name || !defaultLanguage) {
    redirect(buildEditErrorRedirect(surveyId, "missing-fields"));
  }

  const existing = await getOwnedSurveyById(surveyId);
  redirectIfSurveyNotEditable(surveyId, existing.status);
  const nextSupportedLanguages = Array.from(
    new Set([defaultLanguage, ...supportedLanguages]),
  );
  const settingsSnapshotPolicy = shouldPreserveSettingsSnapshots({
    existing,
    nextDefaultLanguage: defaultLanguage,
    nextSupportedLanguages,
    nextSurveyDescription: surveyDescription,
  });

  const nextDefinition = settingsSnapshotPolicy.preserveSnapshots
    ? structuredClone(existing.definition_json)
    : clearReviewValidationResults(existing.definition_json);
  nextDefinition.survey_meta.response_context = responseContext;
  nextDefinition.translations[defaultLanguage] ??= {
    survey_title: "",
    survey_description: "",
    questions: {},
  };
  nextDefinition.translations[defaultLanguage].survey_description = surveyDescription;

  if (intent === "generate") {
    nextDefinition.survey_meta.behavioural_concept_keys = behaviouralConceptKeys;
    nextDefinition.survey_meta.ontology_targets = schemaTargets;

    if (behaviouralConceptKeys.length === 0) {
      redirect(buildEditErrorRedirect(surveyId, "missing-ontology-targets"));
    }

    try {
      await withSurveyTimingOperation(
        {
          operation: "survey.generate",
          surveyId,
          ownerUserId: existing.created_by,
          meta: {
            default_language: defaultLanguage,
            supported_language_count: nextSupportedLanguages.length,
            behavioural_concept_count: behaviouralConceptKeys.length,
          },
        },
        async () => {
          const proposal = await timeSurveyStep(
            "generate_survey_draft_proposal",
            {
              supported_languages: nextSupportedLanguages,
              behavioural_concept_keys: behaviouralConceptKeys,
            },
            async () =>
              generateSurveyDraftProposal({
                survey: {
                  ...existing,
                  definition_json: nextDefinition,
                },
                surveyName: name,
                surveyDescription,
                defaultLanguage,
                supportedLanguages: nextSupportedLanguages,
                behaviouralConceptKeys,
                schemaTargets,
              }),
          );

          // Generated content -> validation is stale, clear it
          proposal.definition.survey_meta.validation_result = undefined;
          proposal.definition.survey_meta.multilingual_validation_result = undefined;
          postRedirectMessage = proposal.warnings?.[0] ?? null;

          await timeSurveyStep(
            "update_survey_draft",
            {
              question_count: proposal.definition.questions.length,
            },
            async () =>
              updateSurveyDraft({
                surveyId,
                name,
                default_language: defaultLanguage,
                supported_languages: nextSupportedLanguages,
                definition_json: proposal.definition,
                mapping_contract_json: proposal.mappingContract,
              }),
          );
        },
      );
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
  const messageParam = postRedirectMessage
    ? `&message=${encodeURIComponent(postRedirectMessage)}`
    : "";
  redirect(`${appRoutes.surveyEdit(surveyId)}?${redirectParam}${messageParam}`);
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
  redirectIfSurveyNotEditable(surveyId, existing.status);

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
// Expert review
// ---------------------------------------------------------------------------

export async function applyExpertReviewAction(
  input: ApplyExpertReviewInput,
): Promise<{ appliedChangeCount: number }> {
  const surveyId = input.surveyId.trim();
  const reviewBasis = input.reviewBasis.trim();
  const confirmation = input.confirmation.trim();

  if (!surveyId) {
    throw new Error("Missing survey ID.");
  }
  if (!reviewBasis) {
    throw new Error("Review basis is required.");
  }
  if (confirmation !== EXPERT_REVIEW_CONFIRMATION) {
    throw new Error(
      `Confirmation must be exactly "${EXPERT_REVIEW_CONFIRMATION}".`,
    );
  }

  const survey = await getOwnedSurveyById(surveyId);
  redirectIfSurveyNotEditable(surveyId, survey.status);
  assertValidApplyExpertReviewInput(survey, input);

  const integrity = getSurveyIntegrityState({
    definition: survey.definition_json,
    defaultLanguage: survey.default_language,
    supportedLanguages: survey.supported_languages,
  });

  const hasExistingExpertReview =
    survey.definition_json.survey_meta.expert_review_result != null;

  if (!integrity.automatic_content_passed) {
    throw new Error(
      "Survey must pass content validation before applying expert review.",
    );
  }

  if (hasExistingExpertReview) {
    if (!integrity.expert_review_baseline_linked) {
      throw new Error(
        "Expert review baseline is no longer linked to the validated automatic baseline.",
      );
    }

    if (!integrity.expert_review_final_current) {
      throw new Error(
        "Expert-reviewed content is outdated. Re-apply expert review or make a normal edit and validate again.",
      );
    }
  } else if (!integrity.automatic_content_current) {
    throw new Error(
      "Content validation is outdated. Re-run validation before applying expert review.",
    );
  }

  if (integrity.automatic_multilingual_required) {
    if (!integrity.automatic_multilingual_passed) {
      throw new Error(
        "Survey must pass multilingual validation before applying expert review.",
      );
    }

    if (!integrity.automatic_multilingual_languages_complete) {
      throw new Error(
        "Multilingual validation is missing one or more supported languages.",
      );
    }

    if (!hasExistingExpertReview && !integrity.automatic_multilingual_current) {
      throw new Error(
        "Multilingual validation is outdated. Re-run translation validation before applying expert review.",
      );
    }
  }

  const normalizedChanges = normalizeExpertReviewBatch(input.changes);

  for (const change of normalizedChanges) {
    if (!survey.supported_languages.includes(change.language)) {
      throw new Error(`Unsupported language "${change.language}".`);
    }

    if (change.field === "question_title") {
      if (!change.question_key) {
        throw new Error("Question title changes require question_key.");
      }
      if (!change.reviewed_value) {
        throw new Error("Question title cannot be empty.");
      }
      continue;
    }

    if (change.field === "survey_title" && !change.reviewed_value) {
      throw new Error("Survey title cannot be empty.");
    }
  }

  const appliedAt = new Date().toISOString();
  const { definition, result } = applyExpertReviewChanges({
    definition: survey.definition_json,
    supportedLanguages: survey.supported_languages,
    normalizedChanges,
    reviewerType: input.reviewerType,
    reviewBasis,
    appliedByUserId: survey.created_by,
    appliedAt,
  });

  await updateSurveyDraft({
    surveyId,
    definition_json: definition,
  });

  revalidatePath(appRoutes.surveyEdit(surveyId));
  revalidatePath(appRoutes.surveyDetail(surveyId));

  return { appliedChangeCount: result.changes.length };
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
  redirectIfSurveyNotEditable(surveyId, survey.status);
  assertExpertReviewNotApplied(survey, "Validation");
  const { questions } = survey.definition_json;
  const { mappings } = survey.mapping_contract_json;
  const translations =
    survey.definition_json.translations[survey.default_language];

  if (!translations || questions.length === 0) {
    throw new Error("No questions to validate. Generate the survey first.");
  }

  await withSurveyTimingOperation(
    {
      operation: "survey.validate_content",
      surveyId,
      ownerUserId: survey.created_by,
      meta: {
        default_language: survey.default_language,
        question_count: questions.length,
      },
    },
    async () => {
      const result = await timeSurveyStep(
        "run_content_validation",
        {
          question_count: questions.length,
        },
        async () =>
          runContentValidation(
            questions,
            mappings,
            translations,
            survey.default_language,
            survey.definition_json.survey_meta.measurement_plan_json,
          ),
      );

      const nextDefinition = structuredClone(survey.definition_json);
      nextDefinition.survey_meta.validation_result = result;

      await timeSurveyStep(
        "update_survey_draft",
        {
          passed: result.passed,
          issue_count: result.issues.length,
        },
        async () => updateSurveyDraft({ surveyId, definition_json: nextDefinition }),
      );
    },
  );

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
  redirectIfSurveyNotEditable(surveyId, survey.status);
  assertExpertReviewNotApplied(survey, "Multilingual validation");
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

  await withSurveyTimingOperation(
    {
      operation: "survey.generate_translations",
      surveyId,
      ownerUserId: survey.created_by,
      meta: {
        source_language: survey.default_language,
        target_languages: targetLanguages,
        question_count: survey.definition_json.questions.length,
      },
    },
    async () => {
      const translationRuns = await timeSurveyStep(
        "translate_all_languages",
        {
          target_language_count: targetLanguages.length,
          target_languages: targetLanguages,
        },
        async () =>
          Promise.all(
            targetLanguages.map(async (targetLanguage) => {
              return generateAndValidateTranslatedLanguage({
                surveyName: survey.name,
                sourceLanguage: survey.default_language,
                targetLanguage,
                sourceTranslations,
                questions: survey.definition_json.questions,
                mappings: survey.mapping_contract_json.mappings,
              });
            }),
          ),
      );

      const multilingualIssues: MultilingualValidationIssue[] = [];

      for (const run of translationRuns) {
        nextDefinition.translations[run.targetLanguage] = run.translatedBundle;
        multilingualIssues.push(...toProductMultilingualIssues(run.issues));
      }

      nextDefinition.survey_meta.multilingual_validation_result =
        buildMultilingualValidationResult(
          survey.supported_languages,
          computeMultilingualTranslationHash(nextDefinition, survey.supported_languages),
          multilingualIssues,
        );

      await timeSurveyStep(
        "update_survey_draft",
        {
          target_language_count: targetLanguages.length,
          issue_count: multilingualIssues.length,
        },
        async () => updateSurveyDraft({ surveyId, definition_json: nextDefinition }),
      );
    },
  );

  revalidatePath(appRoutes.surveyEdit(surveyId));
}

// ---------------------------------------------------------------------------
// Publish survey
// ---------------------------------------------------------------------------

export async function publishSurveyAction(
  formData: FormData,
): Promise<
  | {
      error:
        | typeof PRIVACY_PROFILE_INCOMPLETE_ERROR
        | typeof DPA_ACCEPTANCE_REQUIRED_ERROR;
    }
  | void
> {
  const surveyId = String(formData.get("surveyId") ?? "").trim();

  if (!surveyId) {
    throw new Error("Missing survey ID.");
  }

  const survey = await getOwnedSurveyById(surveyId);
  const validationResult = survey.definition_json.survey_meta.validation_result;
  const translations =
    survey.definition_json.translations[survey.default_language];
  if (!translations) {
    throw new Error("Canonical survey translations are missing.");
  }

  const integrity = getSurveyIntegrityState({
    definition: survey.definition_json,
    defaultLanguage: survey.default_language,
    supportedLanguages: survey.supported_languages,
  });

  if (!validationResult?.passed) {
    throw new Error("Survey must pass content validation before publishing.");
  }

  if (survey.definition_json.survey_meta.expert_review_result) {
    if (!integrity.expert_review_baseline_linked) {
      throw new Error(
        "Expert review baseline is no longer linked to the validated automatic baseline.",
      );
    }

    if (!integrity.expert_review_final_current) {
      throw new Error(
        "Expert-reviewed content is outdated. Re-apply expert review or make a normal edit and validate again.",
      );
    }

    if (!integrity.can_publish_expert_reviewed) {
      throw new Error(
        "Survey must pass the automatic publication gates before publishing the expert-reviewed version.",
      );
    }
  } else {
    if (!integrity.automatic_content_current) {
      throw new Error(
        "Validation result is outdated. Re-run validation after your recent edits.",
      );
    }

    if (survey.supported_languages.length > 1) {
      const multilingualValidationResult =
        survey.definition_json.survey_meta.multilingual_validation_result;

      if (!multilingualValidationResult?.passed) {
        throw new Error(
          "Survey must pass multilingual validation before publishing.",
        );
      }

      if (!integrity.automatic_multilingual_current) {
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
  }

  const legalProfile = await getCurrentOwnerLegalProfile();

  if (!isOwnerLegalProfileComplete(legalProfile)) {
    return { error: PRIVACY_PROFILE_INCOMPLETE_ERROR };
  }

  const dpaConfig = getDpaConfig();
  if (dpaConfig.required) {
    if (
      !isOwnerDpaProfileComplete(legalProfile) ||
      !isDpaConfigComplete(dpaConfig)
    ) {
      return { error: DPA_ACCEPTANCE_REQUIRED_ERROR };
    }

    const dpaAcceptance = await getCurrentDpaAcceptance(legalProfile);
    if (!dpaAcceptance) {
      return { error: DPA_ACCEPTANCE_REQUIRED_ERROR };
    }
  }

  await prepareSurveyLegalSnapshot(surveyId, survey.created_by);
  await publishSurvey(surveyId);

  revalidatePath(appRoutes.surveyDetail(surveyId));
  revalidatePath(appRoutes.surveys);
  revalidatePath(appRoutes.dashboard);

  redirect(`${appRoutes.surveyDetail(surveyId)}?published=1`);
}

// ---------------------------------------------------------------------------
// Survey lifecycle
// ---------------------------------------------------------------------------

export async function deleteSurveyDraftAction(formData: FormData): Promise<void> {
  const surveyId = String(formData.get("surveyId") ?? "").trim();

  if (!surveyId) {
    throw new Error("Missing survey ID.");
  }

  await deleteOwnedSurveyDraft(surveyId);

  revalidatePath(appRoutes.dashboard);
  revalidatePath(appRoutes.surveys);

  redirect(appRoutes.dashboard);
}

export async function archiveSurveyAction(formData: FormData): Promise<void> {
  const surveyId = String(formData.get("surveyId") ?? "").trim();

  if (!surveyId) {
    throw new Error("Missing survey ID.");
  }

  await archiveOwnedSurvey(surveyId);

  revalidatePath(appRoutes.dashboard);
  revalidatePath(appRoutes.surveys);
  revalidatePath(appRoutes.surveyDetail(surveyId));

  redirect(appRoutes.dashboard);
}

export async function duplicateSurveyAction(formData: FormData): Promise<void> {
  const surveyId = String(formData.get("surveyId") ?? "").trim();

  if (!surveyId) {
    throw new Error("Missing survey ID.");
  }

  const duplicatedSurvey = await duplicateOwnedSurvey(surveyId);

  revalidatePath(appRoutes.dashboard);
  revalidatePath(appRoutes.surveys);
  revalidatePath(appRoutes.surveyDetail(surveyId));
  revalidatePath(appRoutes.surveyDetail(duplicatedSurvey.id));
  revalidatePath(appRoutes.surveyEdit(duplicatedSurvey.id));

  redirect(`${appRoutes.surveyEdit(duplicatedSurvey.id)}?duplicated=1`);
}
