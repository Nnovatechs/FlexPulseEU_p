import OpenAI from "openai";
import { getOpenAIEnv } from "@/lib/llm/env";
import type {
  MultilingualValidationIssue,
  SurveyLanguageCode,
  SurveyLanguageTranslations,
  SurveyQuestionDefinition,
} from "./generator-types";

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
    };
  });
}

export function buildSurveyPolishPrompt(input: PolishSurveyLanguageInput): SurveyPolishPrompt {
  const system =
    "Rewrite the target-language survey text so it sounds natural and human. Use the source text only to preserve meaning. Return JSON only.";

  const user = [
    `Source language: ${input.sourceLanguage}`,
    `Target language: ${input.targetLanguage}`,
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
    input.validationIssues?.length
      ? "Some items failed validation. Rewrite those failed items from the source meaning, not from the previous target wording or validator suggestions."
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
          "Failed validation checks:",
          JSON.stringify(
            input.validationIssues.map((issue) => ({
              question_key: issue.question_key ?? null,
              failed_check: issue.type,
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

  const completion = await client.chat.completions.create({
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
  });

  const message = completion.choices[0]?.message;

  if (message?.refusal) {
    throw new Error(`Translation polish was refused for ${input.targetLanguage}: ${message.refusal}`);
  }

  if (!message?.content) {
    throw new Error(`Translation polish returned an empty response for ${input.targetLanguage}.`);
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
  const polishedQuestionKeys = new Set(
    parsed.questions.map((question) => question.question_key),
  );

  if (polishedQuestionKeys.size !== expectedQuestionKeys.size) {
    throw new Error(
      `Translation polish returned an unexpected number of questions for ${input.targetLanguage}.`,
    );
  }

  for (const question of input.questions) {
    if (!polishedQuestionKeys.has(question.question_key)) {
      throw new Error(
        `Translation polish is missing question "${question.question_key}" for ${input.targetLanguage}.`,
      );
    }
  }

  const polishedQuestions = Object.fromEntries(
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
    const polishedQuestion = polishedQuestions[question.question_key];

    if (!polishedQuestion?.title?.trim()) {
      throw new Error(
        `Translation polish is missing a title for question "${question.question_key}" in ${input.targetLanguage}.`,
      );
    }

    if (question.options?.length) {
      const expectedOptionKeys = new Set(
        question.options.map((option) => option.option_key),
      );
      const polishedOptionKeys = new Set(
        Object.keys(polishedQuestion.options ?? {}),
      );

      if (polishedOptionKeys.size !== expectedOptionKeys.size) {
        throw new Error(
          `Translation polish returned an unexpected option set for question "${question.question_key}" in ${input.targetLanguage}.`,
        );
      }

      for (const optionKey of expectedOptionKeys) {
        if (!polishedOptionKeys.has(optionKey)) {
          throw new Error(
            `Translation polish is missing option "${optionKey}" for question "${question.question_key}" in ${input.targetLanguage}.`,
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
    questions: polishedQuestions,
  };
}
