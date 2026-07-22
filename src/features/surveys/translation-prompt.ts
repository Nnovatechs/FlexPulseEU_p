import type {
  SurveyQuestionDefinition,
  SurveyLanguageTranslations,
} from "./generator-types";

type BuildSurveyTranslationPromptInput = {
  surveyName: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceTranslations: SurveyLanguageTranslations;
  questions: SurveyQuestionDefinition[];
};

export type SurveyTranslationPrompt = {
  system: string;
  user: string;
};

export function buildSurveyTranslationPrompt(
  input: BuildSurveyTranslationPromptInput,
): SurveyTranslationPrompt {
  const questionPayload = input.questions.map((question) => {
    const sourceQuestion = input.sourceTranslations.questions[question.question_key];

    return {
      question_key: question.question_key,
      source_title: sourceQuestion?.title ?? "",
      source_description: sourceQuestion?.description ?? "",
      source_options: question.options?.map((option) => ({
        option_key: option.option_key,
        label: sourceQuestion?.options?.[option.option_key] ?? "",
      })),
      source_scale:
        question.type === "rating_scale"
          ? {
              min_label:
                sourceQuestion?.scale?.min_label ??
                question.scale?.min_label ??
                "",
              max_label:
                sourceQuestion?.scale?.max_label ??
                question.scale?.max_label ??
                "",
            }
          : null,
    };
  });

  const system =
    "Rewrite survey text into the target language. Understand what each source item asks and write it naturally, as a clear human survey question. Return JSON only.";

  const user = [
    `Source language: ${input.sourceLanguage}`,
    `Target language: ${input.targetLanguage}`,
    "",
    "Task:",
    "- Rewrite the survey title, description, questions, option labels and rating-scale endpoint labels in the target language.",
    "- Keep the same meaning and answer direction.",
    "- Keep every question_key and option_key exactly as provided.",
    "- Do not add, remove, reorder or merge questions or options.",
    "- If the source sounds robotic, technical or unclear, write a natural equivalent that a normal respondent would understand.",
    "- Treat domain phrases as meaning, not fixed labels. Do not preserve literal noun chains like home energy system, household energy devices or household interest if they sound unnatural in the target language.",
    "- Use the respondent as the subject for feelings, comfort, interest, willingness and trust when that is more natural than making the household or system the grammatical subject.",
    "- Option labels must read naturally as standalone response choices. Do not compress them into ambiguous fragments; add a natural category word when needed so the label is clear on its own.",
    "- For each rating question, translate min_label and max_label naturally and preserve their answer direction. Do not alter numeric scale bounds or steps.",
    "- Do not copy awkward source phrasing.",
    "",
    `Survey title: ${input.sourceTranslations.survey_title}`,
    `Survey description: ${input.sourceTranslations.survey_description ?? ""}`,
    "",
    `Questions:\n${JSON.stringify(questionPayload, null, 2)}`,
  ].join("\n");

  return { system, user };
}
