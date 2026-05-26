import type {
  MultilingualValidationIssue,
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
  previousTranslation?: SurveyLanguageTranslations;
  validationIssues?: MultilingualValidationIssue[];
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
    "Use neutral international Spanish suitable for institutional surveys. Avoid region-specific slang, awkward calques and formulae that sound translated from English. Prefer idiomatic phrasing such as 'por mi' or 'en mi lugar' over unnatural literal renderings like 'en mi nombre' when the context requires it.",
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
    "You are a professional survey localizer for FlexPulseEU.",
    "Write each item as if it had originally been authored in the requested target language for a real public-facing survey.",
    "Do not produce word-for-word or mechanically literal translations.",
    "Preserve meaning, measurement intent, question order, register, polarity, and question_key and option_key mapping exactly.",
    "Do not add or remove questions, options or explanations.",
    "Do not introduce personal-data requests, semantic drift, false friends or casual wording.",
    "When the most natural target-language wording differs from the source syntax, prefer the natural publishable wording while keeping the same measurement intent.",
    "Keep the final text publishable, culturally natural and institutionally professional.",
    input.validationIssues?.length
      ? "You may receive validator feedback on a previous draft. Use it to fix only genuine problems while preserving question_key and option_key mapping."
      : "",
    translationGuidance[input.targetLanguage] ?? "",
  ].join(" ");

  const user = [
    `Survey name: ${input.surveyName}`,
    `Source language: ${input.sourceLanguage}`,
    `Target language: ${input.targetLanguage}`,
    "",
    "Localize the following survey content and return JSON only.",
    "The output must read like a native target-language survey version, not a literal translation of the source wording.",
    "Keep question_key and option_key associations stable.",
    "If a question has no options, return an empty options array.",
    input.validationIssues?.length
      ? "This is a revision pass. Fix the validator feedback where it identifies a genuine issue, but do not over-correct unaffected items."
      : "",
    "",
    `Survey title: ${input.sourceTranslations.survey_title}`,
    `Survey description: ${input.sourceTranslations.survey_description ?? ""}`,
    "",
    `Questions:\n${JSON.stringify(questionPayload, null, 2)}`,
  ].join("\n");

  const revisionSections =
    input.validationIssues && input.validationIssues.length > 0
      ? [
          "",
          "Previous target-language draft:",
          JSON.stringify(input.previousTranslation ?? null, null, 2),
          "",
          "Validator feedback on that draft:",
          JSON.stringify(
            input.validationIssues.map((issue) => ({
              question_key: issue.question_key ?? null,
              issue_type: issue.type,
              issue: issue.message,
            })),
            null,
            2,
          ),
        ].join("\n")
      : "";

  return { system, user: `${user}${revisionSections}` };
}
