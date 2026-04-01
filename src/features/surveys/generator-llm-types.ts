import { SurveyQuestionType } from "./generator-types";

export type SurveyGeneratorQuestionType = Extract<
  SurveyQuestionType,
  "single_choice" | "multiple_choice" | "rating_scale" | "numeric"
>;

export type SurveyGeneratorLLMOption = {
  label: string;
  ontology_value: string;
  is_truthy: boolean;
};

export type SurveyGeneratorLLMQuestion = {
  title: string;
  description: string;
  ontology_target: string;
  type: SurveyGeneratorQuestionType;
  required: boolean;
  options: SurveyGeneratorLLMOption[];
  scale: {
    min: number;
    max: number;
    step: number;
    min_label: string;
    max_label: string;
  } | null;
  numeric: {
    min: number | null;
    max: number | null;
    unit: string | null;
  } | null;
};

export type SurveyGeneratorLLMOutput = {
  survey_title: string;
  survey_description: string;
  estimated_completion_minutes: number;
  questions: SurveyGeneratorLLMQuestion[];
};

export const surveyGeneratorOutputJsonSchema = {
  name: "survey_generator_output",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "survey_title",
      "survey_description",
      "estimated_completion_minutes",
      "questions",
    ],
    properties: {
      survey_title: {
        type: "string",
        minLength: 1,
      },
      survey_description: {
        type: "string",
      },
      estimated_completion_minutes: {
        type: "integer",
        minimum: 1,
        maximum: 30,
      },
      questions: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "title",
            "description",
            "ontology_target",
            "type",
            "required",
            "options",
            "scale",
            "numeric",
          ],
          properties: {
            title: {
              type: "string",
              minLength: 1,
            },
            description: {
              type: "string",
            },
            ontology_target: {
              type: "string",
              minLength: 1,
            },
            type: {
              type: "string",
              enum: [
                "single_choice",
                "multiple_choice",
                "rating_scale",
                "numeric",
              ],
            },
            required: {
              type: "boolean",
            },
            options: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["label", "ontology_value", "is_truthy"],
                properties: {
                  label: {
                    type: "string",
                    minLength: 1,
                  },
                  ontology_value: {
                    type: "string",
                    minLength: 1,
                  },
                  is_truthy: {
                    type: "boolean",
                  },
                },
              },
            },
            scale: {
              anyOf: [
                {
                  type: "null",
                },
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["min", "max", "step", "min_label", "max_label"],
                  properties: {
                    min: { type: "number" },
                    max: { type: "number" },
                    step: { type: "number" },
                    min_label: { type: "string" },
                    max_label: { type: "string" },
                  },
                },
              ],
            },
            numeric: {
              anyOf: [
                {
                  type: "null",
                },
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["min", "max", "unit"],
                  properties: {
                    min: {
                      anyOf: [{ type: "number" }, { type: "null" }],
                    },
                    max: {
                      anyOf: [{ type: "number" }, { type: "null" }],
                    },
                    unit: {
                      anyOf: [{ type: "string" }, { type: "null" }],
                    },
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

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseSurveyGeneratorLLMOutput(
  value: string,
): SurveyGeneratorLLMOutput {
  const parsed: unknown = JSON.parse(value);

  if (!isObject(parsed)) {
    throw new Error("LLM output must be a JSON object.");
  }

  if (
    typeof parsed.survey_title !== "string" ||
    typeof parsed.survey_description !== "string" ||
    typeof parsed.estimated_completion_minutes !== "number" ||
    !Array.isArray(parsed.questions)
  ) {
    throw new Error("LLM output is missing required survey fields.");
  }

  return parsed as SurveyGeneratorLLMOutput;
}
