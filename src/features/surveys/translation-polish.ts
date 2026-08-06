import OpenAI from "openai";
import { getOpenAIEnv } from "@/lib/llm/env";
import type {
  MultilingualValidationIssue,
  SurveyLanguageCode,
  SurveyLanguageTranslations,
  SurveyQuestionDefinition,
} from "./generator-types";
import { parseSurveyLanguageLLMOutput } from "./translation-output";
import { timeSurveyStep } from "./local-timing";
import { getSurveyLanguageProfile } from "./survey-language-profile";

type PolishSurveyLanguageInput = {
  sourceLanguage: SurveyLanguageCode;
  targetLanguage: SurveyLanguageCode;
  sourceTranslations: SurveyLanguageTranslations;
  draftTranslations: SurveyLanguageTranslations;
  questions: SurveyQuestionDefinition[];
  validationIssues?: MultilingualValidationIssue[];
};

export type SurveyPolishPrompt = {
  system: string;
  user: string;
};

const surveyPolishOutputSchema = {
  name: "survey_polish_output",
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
          required: ["question_key", "title", "description", "options", "scale"],
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
            scale: {
              anyOf: [
                { type: "null" },
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["min_label", "max_label"],
                  properties: {
                    min_label: { type: "string", minLength: 1 },
                    max_label: { type: "string", minLength: 1 },
                  },
                },
              ],
            },
          },
        },
      },
    },
  },
} as const;

function buildQuestionPayload(input: PolishSurveyLanguageInput) {
  return input.questions.map((question) => {
    const sourceQuestion = input.sourceTranslations.questions[question.question_key];
    const draftQuestion = input.draftTranslations.questions[question.question_key];

    return {
      question_key: question.question_key,
      source_title: sourceQuestion?.title ?? "",
      source_description: sourceQuestion?.description ?? "",
      draft_title: draftQuestion?.title ?? "",
      draft_description: draftQuestion?.description ?? "",
      options: question.options?.map((option) => ({
        option_key: option.option_key,
        source_label: sourceQuestion?.options?.[option.option_key] ?? "",
        draft_label: draftQuestion?.options?.[option.option_key] ?? "",
      })),
      scale:
        question.type === "rating_scale"
          ? {
              source_min_label:
                sourceQuestion?.scale?.min_label ??
                question.scale?.min_label ??
                "",
              source_max_label:
                sourceQuestion?.scale?.max_label ??
                question.scale?.max_label ??
                "",
              draft_min_label: draftQuestion?.scale?.min_label ?? "",
              draft_max_label: draftQuestion?.scale?.max_label ?? "",
            }
          : null,
    };
  });
}

function getTargetedQuestionKeys(validationIssues?: MultilingualValidationIssue[]) {
  return Array.from(
    new Set(
      (validationIssues ?? [])
        .map((issue) => issue.question_key)
        .filter((questionKey): questionKey is string => Boolean(questionKey)),
    ),
  );
}

export function buildSurveyPolishPrompt(input: PolishSurveyLanguageInput): SurveyPolishPrompt {
  const languageProfile = getSurveyLanguageProfile(input.targetLanguage);
  const targetedQuestionKeys = getTargetedQuestionKeys(input.validationIssues);
  const system =
    "Rewrite the target-language survey text so it sounds natural and human. Use the source text only to preserve meaning. Return JSON only.";

  const user = [
    `Source language: ${input.sourceLanguage}`,
    `Target language: ${input.targetLanguage}`,
    `Target locale: ${languageProfile.locale}`,
    `Target audience: ${languageProfile.audience}`,
    `Target register: ${languageProfile.register}`,
    `Target survey style: ${languageProfile.surveyStyle}`,
    `Target inclusivity guidance: ${languageProfile.inclusivityGuidance}`,
    "",
    "You will receive source survey text and a target-language draft.",
    "Rewrite the target-language draft so it sounds like it was written directly by a native speaker for a real survey.",
    "Keep the same meaning, answer direction, question_key and option_key values.",
    "Do not add, remove, reorder or merge questions or options.",
    "If a target sentence sounds robotic, translated, technical or unclear, rewrite it freely so a normal respondent understands it.",
    "Treat domain phrases as meaning, not fixed labels. Do not preserve literal noun chains like home energy system, household energy devices, energy settings or household interest if they sound unnatural in the target language.",
    "Use the respondent as the subject for feelings, comfort, interest, willingness and trust when that is more natural than making the household, home or system the grammatical subject.",
    "Do not make a household, home, system or device the subject of mental states unless that is idiomatic in the target language. Rebuild the sentence around the respondent, the people in the household, or the concrete action when needed.",
    "Avoid vague placeholders when the source refers to a concrete action, task, device, system or short period of automated management. Keep the object clear in natural target-language wording.",
    "Avoid repeating the same technical domain phrase across many items when ordinary target-language survey wording would vary it naturally.",
    "Option labels must read naturally as standalone response choices. Do not leave compressed, overly technical or ambiguous label fragments; use plain wording a general respondent would recognize.",
    "Rating-scale min_label and max_label must also read naturally in the target language while preserving answer direction.",
    input.validationIssues?.length
      ? "Some items failed validation. Rewrite only the flagged question_key values and keep every other question exactly unchanged."
      : "",
    input.validationIssues?.length
      ? "Use each validation issue as a diagnostic signal. Preserve meaning, answer direction, and central conditions. Do not blindly copy the validator recommendation."
      : "",
    input.validationIssues?.length
      ? "Return the full survey bundle, including every question_key in the draft. Do not omit unchanged questions; copy them exactly unchanged."
      : "",
    "",
    `Source survey title: ${input.sourceTranslations.survey_title}`,
    `Source survey description: ${input.sourceTranslations.survey_description ?? ""}`,
    `Target draft survey title: ${input.draftTranslations.survey_title}`,
    `Target draft survey description: ${input.draftTranslations.survey_description ?? ""}`,
    "",
    `Questions:\n${JSON.stringify(buildQuestionPayload(input), null, 2)}`,
  ].join("\n");

  const failedChecks =
    input.validationIssues && input.validationIssues.length > 0
      ? [
          "",
          `Rewrite only these question_key values: ${
            targetedQuestionKeys.length > 0
              ? targetedQuestionKeys.join(", ")
              : "(survey-level issue only)"
          }`,
          "Return every question_key from the draft in the final JSON output.",
          "Keep all other question titles, descriptions, options and scale labels exactly unchanged.",
          "Failed validation checks:",
          JSON.stringify(
            input.validationIssues.map((issue) => ({
              question_key: issue.question_key ?? null,
              failed_check: issue.type,
              severity: issue.severity ?? null,
              issue: issue.message,
              recommendation: issue.recommendation ?? null,
            })),
            null,
            2,
          ),
        ].join("\n")
      : "";

  return { system, user: `${user}${failedChecks}` };
}

export async function polishSurveyLanguage(
  input: PolishSurveyLanguageInput,
): Promise<SurveyLanguageTranslations> {
  const env = getOpenAIEnv();
  const client = new OpenAI({ apiKey: env.apiKey });
  const prompt = buildSurveyPolishPrompt(input);

  const completion = await timeSurveyStep(
    "llm.translation.polish",
    {
      model: env.model,
      target_language: input.targetLanguage,
      question_count: input.questions.length,
      validation_issue_count: input.validationIssues?.length ?? 0,
    },
    async () =>
      client.chat.completions.create({
        model: env.model,
        temperature: 0.2,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: surveyPolishOutputSchema,
        },
      }),
  );

  const message = completion.choices[0]?.message;

  return parseSurveyLanguageLLMOutput({
    content: message?.content,
    refusal: message?.refusal,
    questions: input.questions,
    targetLanguage: input.targetLanguage,
    operationLabel: "Translation polish",
  });
}
