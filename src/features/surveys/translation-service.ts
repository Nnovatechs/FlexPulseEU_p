import OpenAI from "openai";
import { getOpenAIEnv } from "@/lib/llm/env";
import type {
  SurveyLanguageCode,
  SurveyLanguageTranslations,
  SurveyQuestionDefinition,
} from "./generator-types";
import { buildSurveyTranslationPrompt } from "./translation-prompt";
import { parseSurveyLanguageLLMOutput } from "./translation-output";

type TranslateSurveyLanguageInput = {
  surveyName: string;
  sourceLanguage: SurveyLanguageCode;
  targetLanguage: SurveyLanguageCode;
  sourceTranslations: SurveyLanguageTranslations;
  questions: SurveyQuestionDefinition[];
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

  return parseSurveyLanguageLLMOutput({
    content: message?.content,
    refusal: message?.refusal,
    questions: input.questions,
    targetLanguage: input.targetLanguage,
    operationLabel: "Translation",
  });
}
