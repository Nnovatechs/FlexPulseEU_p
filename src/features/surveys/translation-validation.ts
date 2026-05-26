import { createHash } from "node:crypto";
import OpenAI from "openai";
import { buildUntrustedSurveyContentNotice } from "@/lib/llm/prompt-safety";
import { getOpenAIEnv } from "@/lib/llm/env";
import type {
  MultilingualValidationIssue,
  SurveyDefinition,
  SurveyLanguageCode,
  SurveyLanguageTranslations,
  SurveyMappingDefinition,
  SurveyQuestionDefinition,
} from "./generator-types";

type ValidateTranslatedSurveyLanguageInput = {
  sourceLanguage: SurveyLanguageCode;
  targetLanguage: SurveyLanguageCode;
  sourceTranslations: SurveyLanguageTranslations;
  targetTranslations: SurveyLanguageTranslations;
  questions: SurveyQuestionDefinition[];
  mappings: SurveyMappingDefinition[];
};

export type TranslationValidationPrompt = {
  system: string;
  user: string;
};

const translationValidationOutputSchema = {
  name: "translation_validation_output",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["results"],
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "scope",
            "question_key",
            "passes",
            "issue_type",
            "issue",
          ],
          properties: {
            scope: {
              type: "string",
              enum: ["survey", "question"],
            },
            question_key: {
              anyOf: [{ type: "string" }, { type: "null" }],
            },
            passes: { type: "boolean" },
            issue_type: {
              anyOf: [
                { type: "string", enum: ["parity", "quality", "pii", "cultural"] },
                { type: "null" },
              ],
            },
            issue: {
              anyOf: [{ type: "string", minLength: 1 }, { type: "null" }],
            },
          },
        },
      },
    },
  },
} as const;

export function computeMultilingualTranslationHash(
  definition: SurveyDefinition,
  languages: SurveyLanguageCode[],
): string {
  const orderedLanguages = [...languages].sort();
  const parts: string[] = [];

  for (const language of orderedLanguages) {
    const bundle = definition.translations[language];

    parts.push(
      `${language}:${bundle?.survey_title ?? ""}:${bundle?.survey_description ?? ""}`,
    );

    for (const question of definition.questions) {
      const translation = bundle?.questions[question.question_key];
      const optionTexts =
        question.options
          ?.map((option) => translation?.options?.[option.option_key] ?? "")
          .join("|") ?? "";

      parts.push(
        `${language}:${question.question_key}:${translation?.title ?? ""}:${translation?.description ?? ""}:${optionTexts}`,
      );
    }
  }

  return createHash("sha256").update(parts.join("\n")).digest("hex").slice(0, 16);
}

export function buildTranslationValidationPrompt(
  input: ValidateTranslatedSurveyLanguageInput,
): TranslationValidationPrompt {
  const mappingByQuestionKey = Object.fromEntries(
    input.mappings.map((mapping) => [mapping.question_key, mapping]),
  );

  const questionPayload = input.questions.map((question) => ({
    question_key: question.question_key,
    type: question.type,
    ontology_target:
      mappingByQuestionKey[question.question_key]?.ontology_target ?? "unknown",
    source_title:
      input.sourceTranslations.questions[question.question_key]?.title ?? "",
    source_description:
      input.sourceTranslations.questions[question.question_key]?.description ?? "",
    source_options: question.options?.map((option) => ({
      option_key: option.option_key,
      label:
        input.sourceTranslations.questions[question.question_key]?.options?.[
          option.option_key
        ] ?? "",
    })),
    target_title:
      input.targetTranslations.questions[question.question_key]?.title ?? "",
    target_description:
      input.targetTranslations.questions[question.question_key]?.description ?? "",
    target_options: question.options?.map((option) => ({
      option_key: option.option_key,
      label:
        input.targetTranslations.questions[question.question_key]?.options?.[
          option.option_key
        ] ?? "",
    })),
  }));

  const untrustedNotice = buildUntrustedSurveyContentNotice();
  const system = [
    "You are a multilingual survey auditor for FlexPulseEU.",
    "Your role is to verify that each translated survey item preserves the same respondent-facing meaning as the source language and is culturally natural and publishable in the target language.",
    "Apply a high-precision audit: default to pass unless there is a clear material problem.",
    "Judge parity at the level of likely respondent interpretation and measurement intent, not word-for-word correspondence.",
    "Do not flag parity for harmless changes in syntax, register, idiom, or close paraphrase when a reasonable native respondent would answer the item the same way.",
    "Only use issue_type = parity when the target wording materially changes the likely interpretation, referent, agency, polarity, timeframe, or expected answer.",
    "Use issue_type = quality only for wording that is clearly awkward, broken, misleading, or not publishable to native speakers.",
    "Use issue_type = cultural for culturally misleading or contextually awkward adaptation.",
    "Use issue_type = pii if the translated text introduces or strengthens personal-data collection.",
    "Do not fail an item just because you can imagine a more literal or slightly cleaner wording.",
    "If the target text is understandable, natural enough, and publishable, pass it.",
    "For any failing item, write a concise explanation.",
    "If you propose a rewrite, provide exactly one high-confidence, minimal, idiomatic alternative in the target language.",
    "Do not provide multiple speculative alternatives, and do not suggest awkward literal rewrites.",
    untrustedNotice,
  ].join(" ");

  const user = [
    `Source language: ${input.sourceLanguage}`,
    `Target language: ${input.targetLanguage}`,
    "",
    "Evaluate the translated survey title, description and questions.",
    "Return one question-level result for every question. Add survey-level issues only when necessary.",
    "Use a conservative threshold for failures: fail only on clear semantic drift, clear quality problems, cultural mismatch, or added PII.",
    "Pass natural paraphrases when the survey meaning and measurement intent are still preserved.",
    "",
    `Source survey title: ${input.sourceTranslations.survey_title}`,
    `Source survey description: ${input.sourceTranslations.survey_description ?? ""}`,
    `Target survey title: ${input.targetTranslations.survey_title}`,
    `Target survey description: ${input.targetTranslations.survey_description ?? ""}`,
    "",
    `Questions:\n${JSON.stringify(questionPayload, null, 2)}`,
  ].join("\n");

  return { system, user };
}

export async function validateTranslatedSurveyLanguage(
  input: ValidateTranslatedSurveyLanguageInput,
): Promise<MultilingualValidationIssue[]> {
  const prompt = buildTranslationValidationPrompt(input);

  const env = getOpenAIEnv();
  const client = new OpenAI({ apiKey: env.apiKey });

  const completion = await client.chat.completions.create({
    model: env.model,
    temperature: 0,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: translationValidationOutputSchema,
    },
  });

  const message = completion.choices[0]?.message;

  if (message?.refusal) {
    throw new Error(
      `Translation validation was refused for ${input.targetLanguage}: ${message.refusal}`,
    );
  }

  if (!message?.content) {
    throw new Error(
      `Translation validation returned an empty response for ${input.targetLanguage}.`,
    );
  }

  const parsed = JSON.parse(message.content) as {
    results: Array<{
      scope: "survey" | "question";
      question_key: string | null;
      passes: boolean;
      issue_type: "parity" | "quality" | "pii" | "cultural" | null;
      issue: string | null;
    }>;
  };

  const expectedQuestionKeys = new Set(
    input.questions.map((question) => question.question_key),
  );
  const returnedQuestionKeys = new Set(
    parsed.results
      .filter((result) => result.scope === "question" && result.question_key)
      .map((result) => result.question_key as string),
  );

  if (returnedQuestionKeys.size !== expectedQuestionKeys.size) {
    throw new Error(
      `Translation validation returned an unexpected question set for ${input.targetLanguage}.`,
    );
  }

  for (const questionKey of expectedQuestionKeys) {
    if (!returnedQuestionKeys.has(questionKey)) {
      throw new Error(
        `Translation validation is missing question "${questionKey}" for ${input.targetLanguage}.`,
      );
    }
  }

  return parsed.results
    .filter((result) => !result.passes)
    .map((result) => ({
      language: input.targetLanguage,
      ...(result.question_key ? { question_key: result.question_key } : {}),
      type: result.issue_type ?? "quality",
      message:
        result.issue ??
        "This translated item does not preserve meaning and publishable quality.",
    }));
}
