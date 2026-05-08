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
    "Your role is to verify that each localized survey item preserves the same respondent-facing meaning as the source language and is culturally natural and publishable in the target language.",
    "Apply a high-precision audit: default to pass unless there is a clear material problem.",
    "Judge parity at the level of likely respondent interpretation and measurement intent, not word-for-word correspondence.",
    "Do not flag parity for harmless changes in syntax, register, idiom, or close paraphrase when a reasonable native respondent would answer the item the same way.",
    "Only use issue_type = parity when the target wording materially changes the likely interpretation, referent, agency, polarity, timeframe, or expected answer.",
    "Do not use parity for slight wording imprecision, translationese, or awkward phrasing when the same respondent would still answer for the same construct in the same direction; use quality for those cases if they are not publishable.",
    "Reserve parity for issues that would make the answer unmappable or materially different from the source measurement intent.",
    "Use issue_type = quality for wording that is awkward, overly literal, clearly translated-sounding, bureaucratic, abstract in the wrong way, hard to understand on first read, misleading, or not publishable to native speakers.",
    "A translation can fail quality even when parity is mostly preserved.",
    "Fail quality when a native respondent would likely need to reread the item, when the wording sounds like internal technical documentation instead of a public-facing survey, or when the phrasing uses unnatural calques rather than idiomatic native survey language.",
    "Treat native clarity, respondent-facing framing, idiomaticity, and publishability as mandatory quality checks for every item.",
    "Use issue_type = cultural when the core construct is still recognizable but the localization adds culturally loaded framing, social desirability pressure, country-specific market assumptions, non-equivalent household examples, or institutional cues that could systematically bias how respondents answer.",
    "Reserve issue_type = cultural for localization bias or cultural non-equivalence, not for simple wording errors and not for direct meaning reversals that belong under parity.",
    "Use issue_type = pii if the translated text introduces or strengthens personal-data collection.",
    "Do not emit survey-level quality issues for ordinary survey title or survey description style problems. Use the survey title and description as context, but report quality issues at question or option level unless the survey-level text introduces PII or a severe cross-survey semantic mismatch.",
    "Do not fail an item merely because you can imagine a slightly cleaner alternative when the current wording is already native, clear, and publishable.",
    "Do not pass an item just because its meaning can be recovered. Pass it only if it reads like something a native-speaking survey author would genuinely publish.",
    "For any failing item, write a concise explanation.",
    "If you propose a rewrite, provide exactly one high-confidence, minimal, idiomatic alternative in the target language.",
    "Do not provide multiple speculative alternatives, and do not suggest awkward literal rewrites.",
    untrustedNotice,
  ].join(" ");

  const user = [
    `Source language: ${input.sourceLanguage}`,
    `Target language: ${input.targetLanguage}`,
    "",
    "Evaluate the localized survey title, description and questions.",
    "Return one question-level result for every question. Add survey-level issues only when necessary.",
    "Use a conservative threshold for failures: fail only on clear semantic drift, clear quality problems, cultural mismatch or localization bias, or added PII.",
    "Pass natural paraphrases when the survey meaning and measurement intent are still preserved.",
    "Treat this as localization review, not literal translation review.",
    "Ask yourself whether the target item sounds like it was originally written by a native survey author for real respondents in that language.",
    "If the item sounds translated, abstract in an unnatural way, or harder to process than a native survey item should be, fail it as quality.",
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
    .filter((result) => {
      if (result.passes) {
        return false;
      }

      // Title and survey-description quality can be useful context while tuning,
      // but it should not block review or publishing by itself.
      return !(result.scope === "survey" && result.issue_type === "quality");
    })
    .map((result) => ({
      language: input.targetLanguage,
      ...(result.question_key ? { question_key: result.question_key } : {}),
      type: result.issue_type ?? "quality",
      message:
        result.issue ??
        "This translated item does not preserve meaning and publishable quality.",
    }));
}
