import { computeContentHash } from "./content-validator";
import { computeMultilingualTranslationHash } from "./translation-validation";
import type {
  ExpertReviewChange,
  ExpertReviewChangeField,
  ExpertReviewResult,
  ExpertReviewerType,
  MeasurementPlan,
  SurveyDefinition,
  SurveyLanguageCode,
} from "./generator-types";

export const EXPERT_REVIEW_CONFIRMATION = "EXPERT REVIEW";

export type ExpertReviewDraftChangeInput = {
  language: SurveyLanguageCode;
  field: ExpertReviewChangeField;
  question_key?: string;
  reviewed_value: string;
};

export type ApplyExpertReviewInput = {
  surveyId: string;
  reviewerType: ExpertReviewerType;
  reviewBasis: string;
  confirmation: string;
  changes: ExpertReviewDraftChangeInput[];
};

export type SurveyIntegrityState = {
  has_secondary_languages: boolean;
  current_content_hash: string;
  current_copy_hash: string;
  automatic_content_passed: boolean;
  automatic_content_current: boolean;
  automatic_multilingual_required: boolean;
  automatic_multilingual_passed: boolean;
  automatic_multilingual_current: boolean;
  automatic_multilingual_languages_complete: boolean;
  automatic_baseline_ready: boolean;
  has_expert_review: boolean;
  expert_review_baseline_linked: boolean;
  expert_review_final_current: boolean;
  can_publish_automatic: boolean;
  can_publish_expert_reviewed: boolean;
};

function hasSecondaryLanguages(
  defaultLanguage: SurveyLanguageCode,
  supportedLanguages: SurveyLanguageCode[],
) {
  return supportedLanguages.some((language) => language !== defaultLanguage);
}

export function computeSurveyCopyHash(
  definition: SurveyDefinition,
  supportedLanguages: SurveyLanguageCode[],
): string {
  return computeMultilingualTranslationHash(definition, supportedLanguages);
}

export function getSurveyIntegrityState(input: {
  definition: SurveyDefinition;
  defaultLanguage: SurveyLanguageCode;
  supportedLanguages: SurveyLanguageCode[];
}): SurveyIntegrityState {
  const { definition, defaultLanguage, supportedLanguages } = input;
  const canonicalTranslations = definition.translations[defaultLanguage];
  const validationResult = definition.survey_meta.validation_result;
  const multilingualValidationResult =
    definition.survey_meta.multilingual_validation_result;
  const expertReviewResult = definition.survey_meta.expert_review_result;
  const currentContentHash = canonicalTranslations
    ? computeContentHash(definition.questions, canonicalTranslations)
    : "";
  const currentCopyHash = computeSurveyCopyHash(definition, supportedLanguages);
  const secondaryLanguagesPresent = hasSecondaryLanguages(
    defaultLanguage,
    supportedLanguages,
  );
  const automaticContentPassed = validationResult?.passed === true;
  const automaticContentCurrent =
    automaticContentPassed && currentContentHash === validationResult.content_hash;
  const automaticMultilingualRequired = secondaryLanguagesPresent;
  const automaticMultilingualPassed = automaticMultilingualRequired
    ? multilingualValidationResult?.passed === true
    : true;
  const automaticMultilingualCurrent = automaticMultilingualRequired
    ? currentCopyHash === multilingualValidationResult?.translation_hash
    : true;
  const automaticMultilingualLanguagesComplete = automaticMultilingualRequired
    ? supportedLanguages.every((language) =>
        multilingualValidationResult?.validated_languages.includes(language),
      )
    : true;
  const automaticBaselineReady =
    automaticContentPassed &&
    automaticContentCurrent &&
    automaticMultilingualPassed &&
    automaticMultilingualCurrent &&
    automaticMultilingualLanguagesComplete;
  const expertReviewBaselineLinked = expertReviewResult
    ? expertReviewResult.baseline_content_hash === validationResult?.content_hash &&
      (!automaticMultilingualRequired ||
        expertReviewResult.baseline_copy_hash ===
          multilingualValidationResult?.translation_hash)
    : false;
  const expertReviewFinalCurrent = expertReviewResult
    ? expertReviewResult.final_content_hash === currentContentHash &&
      expertReviewResult.final_copy_hash === currentCopyHash
    : false;

  return {
    has_secondary_languages: secondaryLanguagesPresent,
    current_content_hash: currentContentHash,
    current_copy_hash: currentCopyHash,
    automatic_content_passed: automaticContentPassed,
    automatic_content_current: automaticContentCurrent,
    automatic_multilingual_required: automaticMultilingualRequired,
    automatic_multilingual_passed: automaticMultilingualPassed,
    automatic_multilingual_current: automaticMultilingualCurrent,
    automatic_multilingual_languages_complete:
      automaticMultilingualLanguagesComplete,
    automatic_baseline_ready: automaticBaselineReady,
    has_expert_review: expertReviewResult != null,
    expert_review_baseline_linked: expertReviewBaselineLinked,
    expert_review_final_current: expertReviewFinalCurrent,
    can_publish_automatic: automaticBaselineReady && expertReviewResult == null,
    can_publish_expert_reviewed:
      expertReviewResult != null &&
      automaticContentPassed &&
      expertReviewBaselineLinked &&
      expertReviewFinalCurrent &&
      (!automaticMultilingualRequired ||
        (automaticMultilingualPassed &&
          automaticMultilingualLanguagesComplete)),
  };
}

type NormalizedExpertReviewChange = {
  key: string;
  language: SurveyLanguageCode;
  target: "survey" | "question";
  question_key?: string;
  field: ExpertReviewChangeField;
  reviewed_value: string;
};

export function normalizeExpertReviewBatch(
  changes: ExpertReviewDraftChangeInput[],
): NormalizedExpertReviewChange[] {
  const deduped = new Map<string, NormalizedExpertReviewChange>();

  for (const change of changes) {
    const reviewedValue = change.reviewed_value.trim();
    const target = change.field === "question_title" ? "question" : "survey";
    const normalizedQuestionKey =
      target === "question" ? change.question_key?.trim() ?? "" : "";
    const key = [
      change.language.trim(),
      target,
      change.field,
      normalizedQuestionKey,
    ].join("::");

    deduped.set(key, {
      key,
      language: change.language.trim(),
      target,
      question_key: normalizedQuestionKey || undefined,
      field: change.field,
      reviewed_value: reviewedValue,
    });
  }

  return Array.from(deduped.values()).sort((left, right) =>
    left.key.localeCompare(right.key),
  );
}

export function buildQuestionIntentLookup(
  measurementPlan?: MeasurementPlan,
): Record<string, string[]> {
  const intentsByQuestion = new Map<string, string[]>();

  for (const concept of measurementPlan?.concepts ?? []) {
    for (const questionIntent of concept.question_intents ?? []) {
      const value = questionIntent.intent.trim();
      if (!value) {
        continue;
      }

      const nextValues = intentsByQuestion.get(questionIntent.question_key) ?? [];
      if (!nextValues.includes(value)) {
        nextValues.push(value);
      }
      intentsByQuestion.set(questionIntent.question_key, nextValues);
    }
  }

  return Object.fromEntries(
    Array.from(intentsByQuestion.entries()).map(([questionKey, values]) => [
      questionKey,
      values,
    ]),
  );
}

export function applyExpertReviewChanges(input: {
  definition: SurveyDefinition;
  supportedLanguages: SurveyLanguageCode[];
  normalizedChanges: NormalizedExpertReviewChange[];
  reviewerType: ExpertReviewerType;
  reviewBasis: string;
  appliedByUserId: string;
  appliedAt: string;
}): {
  definition: SurveyDefinition;
  result: ExpertReviewResult;
} {
  const nextDefinition = structuredClone(input.definition);
  const defaultLanguage = nextDefinition.survey_meta.default_language;
  const baselineTranslations = nextDefinition.translations[defaultLanguage];
  const existingExpertReview = nextDefinition.survey_meta.expert_review_result;
  const baselineContentHash =
    existingExpertReview?.baseline_content_hash ??
    computeContentHash(nextDefinition.questions, baselineTranslations);
  const baselineCopyHash =
    existingExpertReview?.baseline_copy_hash ??
    computeSurveyCopyHash(nextDefinition, input.supportedLanguages);
  const appliedChanges: ExpertReviewChange[] = [];

  for (const change of input.normalizedChanges) {
    const bundle = nextDefinition.translations[change.language];
    if (!bundle) {
      throw new Error(`Unsupported language "${change.language}".`);
    }

    if (change.field === "survey_title") {
      const previousValue = bundle.survey_title ?? "";
      bundle.survey_title = change.reviewed_value;
      if (previousValue !== change.reviewed_value) {
        appliedChanges.push({
          language: change.language,
          target: "survey",
          field: change.field,
          previous_value: previousValue,
          reviewed_value: change.reviewed_value,
        });
      }
      continue;
    }

    if (change.field === "survey_description") {
      const previousValue = bundle.survey_description ?? "";
      bundle.survey_description = change.reviewed_value;
      if (previousValue !== change.reviewed_value) {
        appliedChanges.push({
          language: change.language,
          target: "survey",
          field: change.field,
          previous_value: previousValue,
          reviewed_value: change.reviewed_value,
        });
      }
      continue;
    }

    const questionKey = change.question_key;
    if (!questionKey) {
      throw new Error("Question title changes require question_key.");
    }

    const translation = bundle.questions[questionKey];
    if (!translation) {
      throw new Error(`Question "${questionKey}" is missing for ${change.language}.`);
    }

    const previousValue = translation.title ?? "";
    translation.title = change.reviewed_value;
    if (previousValue !== change.reviewed_value) {
      appliedChanges.push({
        language: change.language,
        target: "question",
        question_key: questionKey,
        field: change.field,
        previous_value: previousValue,
        reviewed_value: change.reviewed_value,
      });
    }
  }

  const finalCanonicalTranslations = nextDefinition.translations[defaultLanguage];
  const result: ExpertReviewResult = {
    schema_version: 1,
    baseline_content_hash: baselineContentHash,
    baseline_copy_hash: baselineCopyHash,
    final_content_hash: computeContentHash(
      nextDefinition.questions,
      finalCanonicalTranslations,
    ),
    final_copy_hash: computeSurveyCopyHash(nextDefinition, input.supportedLanguages),
    applied_at: input.appliedAt,
    applied_by_user_id: input.appliedByUserId,
    reviewer_type: input.reviewerType,
    review_basis: input.reviewBasis,
    acknowledgement_version: "v1",
    changes: appliedChanges,
  };

  nextDefinition.survey_meta.expert_review_result = result;

  return {
    definition: nextDefinition,
    result,
  };
}
