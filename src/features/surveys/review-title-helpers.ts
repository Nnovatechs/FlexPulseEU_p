import type {
  MultilingualValidationIssue,
  SurveyLanguageCode,
  SurveyLanguageTranslations,
  SurveyQuestionDefinition,
} from "./generator-types";

export function buildQuestionTitleLookup(
  questions: SurveyQuestionDefinition[],
  translations: SurveyLanguageTranslations | null | undefined,
): Record<string, string> {
  const titleByKey: Record<string, string> = {};

  for (const question of questions) {
    titleByKey[question.question_key] =
      translations?.questions[question.question_key]?.title ?? question.question_key;
  }

  return titleByKey;
}

type GetMultilingualIssueQuestionTitleInput = {
  issue: MultilingualValidationIssue;
  canonicalTitleByKey: Record<string, string>;
  translationsByLanguage: Partial<Record<SurveyLanguageCode, SurveyLanguageTranslations>>;
};

export function getMultilingualIssueQuestionTitle({
  issue,
  canonicalTitleByKey,
  translationsByLanguage,
}: GetMultilingualIssueQuestionTitleInput): string | null {
  if (!issue.question_key) {
    return null;
  }

  return (
    translationsByLanguage[issue.language]?.questions[issue.question_key]?.title ??
    canonicalTitleByKey[issue.question_key] ??
    issue.question_key
  );
}
