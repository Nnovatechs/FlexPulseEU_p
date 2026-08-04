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
        translatedBundle = await timeSurveyStep(
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
