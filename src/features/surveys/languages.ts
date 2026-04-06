export const supportedSurveyLanguages = [
  "English",
  "French",
  "Spanish",
  "Croatian",
] as const;

export type SupportedSurveyLanguage = (typeof supportedSurveyLanguages)[number];

export function isSupportedSurveyLanguage(
  language: string,
): language is SupportedSurveyLanguage {
  return (supportedSurveyLanguages as readonly string[]).includes(language);
}

export function getInvalidSurveyLanguages(languages: string[]): string[] {
  return languages.filter((language) => !isSupportedSurveyLanguage(language));
}

export function assertSupportedSurveyLanguages(languages: string[]) {
  const invalidLanguages = getInvalidSurveyLanguages(languages);

  if (invalidLanguages.length > 0) {
    throw new Error(
      `Unsupported survey language(s): ${invalidLanguages.join(", ")}.`,
    );
  }
}
