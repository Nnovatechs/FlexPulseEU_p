import type {
  SurveyLanguageCode,
  SurveyLanguageTranslations,
  SurveyQuestionDefinition,
} from "./generator-types";

export type SurveyLanguageLLMQuestionOutput = {
  question_key: string;
  title: string;
  description: string;
  options: Array<{ option_key: string; label: string }>;
};

export type SurveyLanguageLLMOutput = {
  survey_title: string;
  survey_description: string;
  questions: SurveyLanguageLLMQuestionOutput[];
};

type ParseSurveyLanguageLLMOutputInput = {
  content: string | null | undefined;
  refusal: string | null | undefined;
  questions: SurveyQuestionDefinition[];
  targetLanguage: SurveyLanguageCode;
  operationLabel: "Translation" | "Translation polish";
};

export function parseSurveyLanguageLLMOutput(
  input: ParseSurveyLanguageLLMOutputInput,
): SurveyLanguageTranslations {
  if (input.refusal) {
    throw new Error(
      `${input.operationLabel} was refused for ${input.targetLanguage}: ${input.refusal}`,
    );
  }

  if (!input.content) {
    throw new Error(
      `${input.operationLabel} returned an empty response for ${input.targetLanguage}.`,
    );
  }

  const parsed = JSON.parse(input.content) as SurveyLanguageLLMOutput;

  const expectedQuestionKeys = new Set(
    input.questions.map((question) => question.question_key),
  );
  const outputQuestionKeys = new Set(
    parsed.questions.map((question) => question.question_key),
  );

  if (outputQuestionKeys.size !== expectedQuestionKeys.size) {
    throw new Error(
      `${input.operationLabel} returned an unexpected number of questions for ${input.targetLanguage}.`,
    );
  }

  for (const question of input.questions) {
    if (!outputQuestionKeys.has(question.question_key)) {
      throw new Error(
        `${input.operationLabel} is missing question "${question.question_key}" for ${input.targetLanguage}.`,
      );
    }
  }

  const translatedQuestions = Object.fromEntries(
    parsed.questions.map((question) => [
      question.question_key,
      {
        title: question.title,
        ...(question.description ? { description: question.description } : {}),
        ...(question.options.length > 0
          ? {
              options: Object.fromEntries(
                question.options.map((option) => [option.option_key, option.label]),
              ),
            }
          : {}),
      },
    ]),
  );

  for (const question of input.questions) {
    const translatedQuestion = translatedQuestions[question.question_key];

    if (!translatedQuestion?.title?.trim()) {
      throw new Error(
        `${input.operationLabel} is missing a title for question "${question.question_key}" in ${input.targetLanguage}.`,
      );
    }

    if (question.options?.length) {
      const expectedOptionKeys = new Set(
        question.options.map((option) => option.option_key),
      );
      const translatedOptionKeys = new Set(
        Object.keys(translatedQuestion.options ?? {}),
      );

      if (translatedOptionKeys.size !== expectedOptionKeys.size) {
        throw new Error(
          `${input.operationLabel} returned an unexpected option set for question "${question.question_key}" in ${input.targetLanguage}.`,
        );
      }

      for (const optionKey of expectedOptionKeys) {
        if (!translatedOptionKeys.has(optionKey)) {
          throw new Error(
            `${input.operationLabel} is missing option "${optionKey}" for question "${question.question_key}" in ${input.targetLanguage}.`,
          );
        }
      }
    }
  }

  return {
    survey_title: parsed.survey_title,
    ...(parsed.survey_description
      ? { survey_description: parsed.survey_description }
      : {}),
    questions: translatedQuestions,
  };
}
