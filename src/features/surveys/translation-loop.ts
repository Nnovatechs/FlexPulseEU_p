import { translateSurveyLanguage } from "./translation-service";
import { polishSurveyLanguage } from "./translation-polish";
import { validateTranslatedSurveyLanguage } from "./translation-validation";
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
  const firstDraft = await translateSurveyLanguage({
    surveyName: params.surveyName,
    sourceLanguage: params.sourceLanguage,
    targetLanguage: params.targetLanguage,
    sourceTranslations: params.sourceTranslations,
    questions: params.questions,
  });
  let translatedBundle = await polishSurveyLanguage({
    sourceLanguage: params.sourceLanguage,
    targetLanguage: params.targetLanguage,
    sourceTranslations: params.sourceTranslations,
    draftTranslations: firstDraft,
    questions: params.questions,
  });

  let issues = await validateTranslatedSurveyLanguage({
    sourceLanguage: params.sourceLanguage,
    targetLanguage: params.targetLanguage,
    sourceTranslations: params.sourceTranslations,
    targetTranslations: translatedBundle,
    questions: params.questions,
    mappings: params.mappings,
  });
  const initialIssues = issues;
  let attempts = 1;

  for (
    let retry = 0;
    retry < MULTILINGUAL_TRANSLATION_MAX_RETRIES && issues.length > 0;
    retry += 1
  ) {
    translatedBundle = await polishSurveyLanguage({
      sourceLanguage: params.sourceLanguage,
      targetLanguage: params.targetLanguage,
      sourceTranslations: params.sourceTranslations,
      draftTranslations: translatedBundle,
      questions: params.questions,
      validationIssues: issues,
    });

    issues = await validateTranslatedSurveyLanguage({
      sourceLanguage: params.sourceLanguage,
      targetLanguage: params.targetLanguage,
      sourceTranslations: params.sourceTranslations,
      targetTranslations: translatedBundle,
      questions: params.questions,
      mappings: params.mappings,
    });
    attempts += 1;
  }

  return {
    targetLanguage: params.targetLanguage,
    translatedBundle,
    issues,
    attempts,
    initialIssues,
  };
}
