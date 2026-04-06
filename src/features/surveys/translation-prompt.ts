import type {
  SurveyMappingDefinition,
  SurveyQuestionDefinition,
  SurveyLanguageTranslations,
} from "./generator-types";

type BuildSurveyTranslationPromptInput = {
  surveyName: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceTranslations: SurveyLanguageTranslations;
  questions: SurveyQuestionDefinition[];
  mappings: SurveyMappingDefinition[];
};

export type SurveyTranslationPrompt = {
  system: string;
  user: string;
};

const translationGuidance: Record<string, string> = {
  English:
    "Use clear Irish English suitable for real respondents in Ireland. Keep the tone institutional, neutral and natural.",
  French:
    "Use standard contemporary French suitable for public-facing surveys in Europe. Avoid Anglicisms and awkward literal calques.",
  Spanish:
    "Use neutral international Spanish suitable for institutional surveys. Avoid region-specific slang and preserve clarity.",
  Croatian:
    "Use standard Croatian suitable for formal public surveys. Prefer natural phrasing over literal word-by-word translation.",
};

export function buildSurveyTranslationPrompt(
  input: BuildSurveyTranslationPromptInput,
): SurveyTranslationPrompt {
  const mappingByQuestionKey = Object.fromEntries(
    input.mappings.map((mapping) => [mapping.question_key, mapping]),
  );

  const questionPayload = input.questions.map((question) => {
    const sourceQuestion = input.sourceTranslations.questions[question.question_key];

    return {
      question_key: question.question_key,
      type: question.type,
      ontology_target:
        mappingByQuestionKey[question.question_key]?.ontology_target ?? "unknown",
      source_title: sourceQuestion?.title ?? "",
      source_description: sourceQuestion?.description ?? "",
      source_options: question.options?.map((option) => ({
        option_key: option.option_key,
        label: sourceQuestion?.options?.[option.option_key] ?? "",
      })),
      scale: question.scale ?? null,
    };
  });

  const system = [
    "You are a professional survey translator and localizer for FlexPulseEU.",
    "Translate from the canonical survey language into the requested target language.",
    "Preserve meaning, measurement intent, question order, question_key and option_key mapping exactly.",
    "Do not add or remove questions, options or explanations.",
    "Do not introduce personal-data requests, semantic drift, false friends or casual wording.",
    "Keep the final text publishable, culturally natural and institutionally professional.",
    translationGuidance[input.targetLanguage] ?? "",
  ].join(" ");

  const user = [
    `Survey name: ${input.surveyName}`,
    `Source language: ${input.sourceLanguage}`,
    `Target language: ${input.targetLanguage}`,
    "",
    "Translate the following survey content and return JSON only.",
    "Keep question_key and option_key associations stable.",
    "If a question has no options, return an empty options array.",
    "",
    `Survey title: ${input.sourceTranslations.survey_title}`,
    `Survey description: ${input.sourceTranslations.survey_description ?? ""}`,
    "",
    `Questions:\n${JSON.stringify(questionPayload, null, 2)}`,
  ].join("\n");

  return { system, user };
}
