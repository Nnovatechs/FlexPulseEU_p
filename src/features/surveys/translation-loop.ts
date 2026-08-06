import { translateSurveyLanguage } from "./translation-service";
import { polishSurveyLanguage } from "./translation-polish";
import { validateTranslatedSurveyLanguage } from "./translation-validation";
import { timeSurveyStep } from "./local-timing";
import type {
  MultilingualValidationIssue,
  SurveyLanguageCode,
  SurveyLanguageTranslations,
  SurveyMappingDefinition,
  SurveyQuestionDefinition,
} from "./generator-types";

export const MULTILINGUAL_TRANSLATION_MAX_RETRIES = 2;

export type GenerateAndValidateTranslatedLanguageInput = {
  surveyName: string;
  sourceLanguage: SurveyLanguageCode;
  targetLanguage: SurveyLanguageCode;
  sourceTranslations: SurveyLanguageTranslations;
  questions: SurveyQuestionDefinition[];
  mappings: SurveyMappingDefinition[];
};

export type GenerateAndValidateTranslatedLanguageResult = {
  targetLanguage: SurveyLanguageCode;
  translatedBundle: SurveyLanguageTranslations;
  issues: MultilingualValidationIssue[];
  attempts: number;
  initialIssues: MultilingualValidationIssue[];
};

export function reconcileTranslationRetryBundle(input: {
  previousBundle: SurveyLanguageTranslations;
  polishedBundle: SurveyLanguageTranslations;
  validationIssues: MultilingualValidationIssue[];
  questions: SurveyQuestionDefinition[];
}): SurveyLanguageTranslations {
  const targetedQuestionKeys = new Set(
    input.validationIssues
      .map((issue) => issue.question_key)
      .filter((questionKey): questionKey is string => Boolean(questionKey)),
  );
  const hasSurveyLevelIssue = input.validationIssues.some(
    (issue) => !issue.question_key,
  );

  return {
    survey_title: hasSurveyLevelIssue
      ? input.polishedBundle.survey_title
      : input.previousBundle.survey_title,
    survey_description: hasSurveyLevelIssue
      ? input.polishedBundle.survey_description ?? ""
      : input.previousBundle.survey_description ?? "",
    questions: Object.fromEntries(
      input.questions.map((question) => [
        question.question_key,
        targetedQuestionKeys.has(question.question_key)
          ? (input.polishedBundle.questions[question.question_key] ??
            input.previousBundle.questions[question.question_key])
          : input.previousBundle.questions[question.question_key],
      ]),
    ),
  };
}

export async function generateAndValidateTranslatedLanguage(
  params: GenerateAndValidateTranslatedLanguageInput,
): Promise<GenerateAndValidateTranslatedLanguageResult> {
  return timeSurveyStep(
    `translation_language_${params.targetLanguage}`,
    {
      target_language: params.targetLanguage,
      question_count: params.questions.length,
    },
    async () => {
      const firstDraft = await timeSurveyStep(
        "translate_initial_draft",
        {
          target_language: params.targetLanguage,
        },
        async () =>
          translateSurveyLanguage({
            surveyName: params.surveyName,
            sourceLanguage: params.sourceLanguage,
            targetLanguage: params.targetLanguage,
            sourceTranslations: params.sourceTranslations,
            questions: params.questions,
          }),
      );
      let translatedBundle = await timeSurveyStep(
        "polish_initial_draft",
        {
          target_language: params.targetLanguage,
        },
        async () =>
          polishSurveyLanguage({
            sourceLanguage: params.sourceLanguage,
            targetLanguage: params.targetLanguage,
            sourceTranslations: params.sourceTranslations,
            draftTranslations: firstDraft,
            questions: params.questions,
          }),
      );

      let issues = await timeSurveyStep(
        "validate_translation_initial",
        {
          target_language: params.targetLanguage,
        },
        async () =>
          validateTranslatedSurveyLanguage({
            sourceLanguage: params.sourceLanguage,
            targetLanguage: params.targetLanguage,
            sourceTranslations: params.sourceTranslations,
            targetTranslations: translatedBundle,
            questions: params.questions,
            mappings: params.mappings,
          }),
      );
      const initialIssues = issues;
      let attempts = 1;

      // Retry while any validator findings remain. Loop semantics differ from publish:
      // quality/advisory findings still trigger polish, even though only parity/pii/cultural
      // block publication after toProductMultilingualIssues runs in actions.ts.
      for (
        let retry = 0;
        retry < MULTILINGUAL_TRANSLATION_MAX_RETRIES && issues.length > 0;
        retry += 1
      ) {
        const retryNumber = retry + 1;
        const retryPolishOutput = await timeSurveyStep(
          `polish_retry_${retryNumber}`,
          {
            target_language: params.targetLanguage,
            retry: retryNumber,
            issue_count: issues.length,
          },
          async () =>
            polishSurveyLanguage({
              sourceLanguage: params.sourceLanguage,
              targetLanguage: params.targetLanguage,
              sourceTranslations: params.sourceTranslations,
              draftTranslations: translatedBundle,
              questions: params.questions,
              validationIssues: issues,
            }),
        );
        translatedBundle = reconcileTranslationRetryBundle({
          previousBundle: translatedBundle,
          polishedBundle: retryPolishOutput,
          validationIssues: issues,
          questions: params.questions,
        });

        issues = await timeSurveyStep(
          `validate_retry_${retryNumber}`,
          {
            target_language: params.targetLanguage,
            retry: retryNumber,
          },
          async () =>
            validateTranslatedSurveyLanguage({
              sourceLanguage: params.sourceLanguage,
              targetLanguage: params.targetLanguage,
              sourceTranslations: params.sourceTranslations,
              targetTranslations: translatedBundle,
              questions: params.questions,
              mappings: params.mappings,
            }),
        );
        attempts += 1;
      }

      return {
        targetLanguage: params.targetLanguage,
        translatedBundle,
        issues,
        attempts,
        initialIssues,
      };
    },
  );
}
