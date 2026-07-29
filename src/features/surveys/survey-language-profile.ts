export type SurveyLanguageProfile = {
  language: string;
  locale: string;
  audience: string;
  surveyMode: string;
  register: string;
  surveyStyle: string;
  inclusivityGuidance: string;
};

const surveyLanguageProfiles: Record<string, SurveyLanguageProfile> = {
  English: {
    language: "English",
    locale: "International English",
    audience: "general adult population",
    surveyMode: "self-administered online questionnaire",
    register: "neutral, professional and accessible",
    surveyStyle:
      "natural direct questions or first-person statements; consistent throughout",
    inclusivityGuidance:
      "prefer natural inclusive reformulation over awkward repeated forms",
  },
  Spanish: {
    language: "Spanish",
    locale: "Spain Spanish (es-ES)",
    audience: "general adult population",
    surveyMode: "self-administered online questionnaire",
    register: "neutral, professional and accessible",
    surveyStyle:
      "natural direct questions or first-person statements; consistent throughout",
    inclusivityGuidance:
      "prefer naturally inclusive reformulation over slash forms or duplicated gender endings",
  },
  French: {
    language: "French",
    locale: "France French (fr-FR)",
    audience: "general adult population",
    surveyMode: "self-administered online questionnaire",
    register: "neutral, professional and accessible",
    surveyStyle:
      "natural direct questions or first-person statements; consistent throughout",
    inclusivityGuidance:
      "prefer naturally inclusive reformulation over awkward duplicated forms",
  },
  Croatian: {
    language: "Croatian",
    locale: "Standard Croatian",
    audience: "general adult population",
    surveyMode: "self-administered online questionnaire",
    register: "neutral, professional and accessible",
    surveyStyle:
      "natural direct questions or first-person statements; consistent throughout",
    inclusivityGuidance:
      "prefer naturally inclusive reformulation over awkward duplicated forms",
  },
};

export function getSurveyLanguageProfile(language: string): SurveyLanguageProfile {
  return (
    surveyLanguageProfiles[language] ?? {
      language,
      locale: `${language} (default locale)`,
      audience: "general adult population",
      surveyMode: "self-administered online questionnaire",
      register: "neutral, professional and accessible",
      surveyStyle:
        "natural direct questions or first-person statements; consistent throughout",
      inclusivityGuidance:
        "prefer naturally inclusive reformulation when the language allows it",
    }
  );
}
