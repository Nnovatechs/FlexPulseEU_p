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

const MAX_MULTILINGUAL_ADVISORY_ISSUES = 3;

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
            "severity",
            "issue",
            "recommendation",
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
            severity: {
              anyOf: [
                { type: "string", enum: ["blocking", "advisory"] },
                { type: "null" },
              ],
            },
            issue: {
              anyOf: [{ type: "string", minLength: 1 }, { type: "null" }],
            },
            recommendation: {
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
    "A translation can receive a quality finding even when parity is mostly preserved.",
    "Use severity = blocking for PII, material parity drift, cultural bias likely to affect answers, or severe quality problems that make an item hard to understand, misleading, or clearly not publishable.",
    "Use severity = advisory when the item is understandable but noticeably translated-sounding, awkward, mildly ambiguous, or likely to benefit from another rewrite pass.",
    "Do not emit advisory findings for pure style preferences or a rewrite that would merely sound a bit smoother.",
    `Return at most ${MAX_MULTILINGUAL_ADVISORY_ISSUES} advisory findings for the target language. If more text could be polished, keep only the highest-impact respondent-facing findings and pass the rest.`,
    "Most acceptable items should pass with no finding. A review with many low-value recommendations is a failure of the audit.",
    "Do not block publication for minor style preferences, slight awkwardness, or a rewrite that would merely sound a bit smoother.",
    "Fail quality as blocking only when a native respondent would likely need to reread the item, when the wording sounds like internal technical documentation instead of a public-facing survey, or when the phrasing uses unnatural calques that materially hurt clarity.",
    "Treat native clarity, respondent-facing framing, idiomaticity, and publishability as mandatory quality checks for every item.",
    "Use issue_type = cultural when the core construct is still recognizable but the localization adds culturally loaded framing, social desirability pressure, country-specific market assumptions, non-equivalent household examples, or institutional cues that could systematically bias how respondents answer.",
    "Reserve issue_type = cultural for localization bias or cultural non-equivalence, not for simple wording errors and not for direct meaning reversals that belong under parity.",
    "Use issue_type = pii if the translated text introduces or strengthens personal-data collection.",
    "Do not emit survey-level quality issues for ordinary survey title or survey description style problems. Use the survey title and description as context, but report quality issues at question or option level unless the survey-level text introduces PII or a severe cross-survey semantic mismatch.",
    "Do not fail an item merely because you can imagine a slightly cleaner alternative when the current wording is already native, clear, and publishable.",
    "Do not pass an item just because its meaning can be recovered. Pass it only if it reads like something a native-speaking survey author would genuinely publish.",
    "For advisory findings, write a short plain-language issue.",
    "For blocking findings, write a short plain-language issue, not a long critique.",
    "Put suggested wording in recommendation only when you have one clearly better, idiomatic alternative. Otherwise set recommendation to null.",
    "Do not include proposed rewrites inside issue. Do not provide multiple speculative alternatives, and do not suggest awkward literal rewrites.",
    untrustedNotice,
  ].join(" ");

  const user = [
    `Source language: ${input.sourceLanguage}`,
    `Target language: ${input.targetLanguage}`,
    "",
    "Evaluate the localized survey title, description and questions.",
    "Return one question-level result for every question. Add survey-level issues only when necessary.",
    "Use a conservative threshold for blocking findings: block only on clear semantic drift, severe quality problems, cultural mismatch or localization bias likely to affect answers, or added PII.",
    "Pass natural paraphrases when the survey meaning and measurement intent are still preserved.",
    "Treat this as localization review, not literal translation review.",
    "Ask yourself whether the target item sounds like it was originally written by a native survey author for real respondents in that language.",
    "If the item sounds slightly translated but remains clear and answerable, return an advisory quality finding only when another rewrite pass is likely to improve respondent-facing quality. If it is hard to process or not publishable, return a blocking quality finding.",
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
      severity: "blocking" | "advisory" | null;
      issue: string | null;
      recommendation: string | null;
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

  const findings = parsed.results
    .filter((result) => {
      if (result.passes) {
        return false;
      }

      // Title and survey-description quality can be useful context while tuning,
      // but it should not block review or publishing by itself.
      return !(result.scope === "survey" && result.issue_type === "quality");
    })
    .map((result) => {
      const type = result.issue_type ?? "quality";
      const severity = result.severity ?? "blocking";

      return {
        language: input.targetLanguage,
        ...(result.question_key ? { question_key: result.question_key } : {}),
        type,
        severity,
        message:
          result.issue ??
          "This translated item does not preserve meaning and publishable quality.",
        ...(result.recommendation ? { recommendation: result.recommendation } : {}),
      };
    });

  const blockingFindings = findings.filter((issue) => issue.severity !== "advisory");
  const advisoryFindings = findings
    .filter((issue) => issue.severity === "advisory")
    .slice(0, MAX_MULTILINGUAL_ADVISORY_ISSUES);

  return [...blockingFindings, ...advisoryFindings];
}
