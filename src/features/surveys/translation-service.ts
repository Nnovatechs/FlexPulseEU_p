import OpenAI from "openai";
import { getOpenAIEnv } from "@/lib/llm/env";
import type {
  SurveyLanguageCode,
  SurveyLanguageTranslations,
  SurveyMappingDefinition,
  SurveyQuestionDefinition,
} from "./generator-types";
import { buildSurveyTranslationPrompt } from "./translation-prompt";

type TranslateSurveyLanguageInput = {
  surveyName: string;
  sourceLanguage: SurveyLanguageCode;
  targetLanguage: SurveyLanguageCode;
  sourceTranslations: SurveyLanguageTranslations;
  questions: SurveyQuestionDefinition[];
  mappings: SurveyMappingDefinition[];
};

const surveyTranslationOutputSchema = {
  name: "survey_translation_output",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["survey_title", "survey_description", "questions"],
    properties: {
      survey_title: { type: "string", minLength: 1 },
      survey_description: { type: "string" },
      questions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["question_key", "title", "description", "options"],
          properties: {
            question_key: { type: "string" },
            title: { type: "string", minLength: 1 },
            description: { type: "string" },
            options: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["option_key", "label"],
                properties: {
                  option_key: { type: "string" },
                  label: { type: "string", minLength: 1 },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

export async function translateSurveyLanguage(
  input: TranslateSurveyLanguageInput,
): Promise<SurveyLanguageTranslations> {
  const env = getOpenAIEnv();
  const client = new OpenAI({ apiKey: env.apiKey });
  const prompt = buildSurveyTranslationPrompt(input);

  const completion = await client.chat.completions.create({
    model: env.model,
    temperature: 0.2,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: surveyTranslationOutputSchema,
    },
  });

  const message = completion.choices[0]?.message;

  if (message?.refusal) {
    throw new Error(`Translation was refused for ${input.targetLanguage}: ${message.refusal}`);
  }

  if (!message?.content) {
    throw new Error(`Translation returned an empty response for ${input.targetLanguage}.`);
  }

  const parsed = JSON.parse(message.content) as {
    survey_title: string;
    survey_description: string;
    questions: Array<{
      question_key: string;
      title: string;
      description: string;
      options: Array<{ option_key: string; label: string }>;
    }>;
  };

  const expectedQuestionKeys = new Set(
    input.questions.map((question) => question.question_key),
  );
  const translatedQuestionKeys = new Set(
    parsed.questions.map((question) => question.question_key),
  );

  if (translatedQuestionKeys.size !== expectedQuestionKeys.size) {
    throw new Error(
      `Translation returned an unexpected number of questions for ${input.targetLanguage}.`,
    );
  }

  for (const question of input.questions) {
    if (!translatedQuestionKeys.has(question.question_key)) {
      throw new Error(
        `Translation is missing question "${question.question_key}" for ${input.targetLanguage}.`,
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
        `Translation is missing a title for question "${question.question_key}" in ${input.targetLanguage}.`,
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
          `Translation returned an unexpected option set for question "${question.question_key}" in ${input.targetLanguage}.`,
        );
      }

      for (const optionKey of expectedOptionKeys) {
        if (!translatedOptionKeys.has(optionKey)) {
          throw new Error(
            `Translation is missing option "${optionKey}" for question "${question.question_key}" in ${input.targetLanguage}.`,
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
