import { SurveyQuestionType } from "./generator-types";
import type { MeasurementPlanBaseBlueprint } from "./measurement-plan";

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
  slot_key: string;
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

export type MeasurementPlannerLLMConcept = {
  concept_key: string;
  measurement_type:
    | "single_item_direct"
    | "multi_item_likert_median"
    | "single_choice_enum"
    | "multi_choice_tag_set"
    | "numeric_direct"
    | "context_passthrough"
    | "quality_flag_passthrough";
  aggregation_rule:
    | "identity"
    | "median"
    | "mean"
    | "set_union"
    | "context_passthrough";
  threshold_profile:
    | "none"
    | "likert_1_5_low_mid_high"
    | "likert_1_5_low_mid_high_strict"
    | "numeric_temperature_window"
    | "enum_identity"
    | "asset_inventory";
  slot_count: number;
  required_slot_count: number;
};

export type MeasurementPlannerLLMOutput = {
  concepts: MeasurementPlannerLLMConcept[];
};

export function buildMeasurementPlannerOutputJsonSchema(
  blueprint: MeasurementPlanBaseBlueprint,
) {
  return {
    name: "measurement_planner_output",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["concepts"],
      properties: {
        concepts: {
          type: "array",
          minItems: blueprint.concepts.length,
          maxItems: blueprint.concepts.length,
          items: {
            anyOf: blueprint.concepts.map((concept) => ({
              type: "object",
              additionalProperties: false,
              required: [
                "concept_key",
                "measurement_type",
                "aggregation_rule",
                "threshold_profile",
                "slot_count",
                "required_slot_count",
              ],
              properties: {
                concept_key: {
                  type: "string",
                  const: concept.concept_key,
                },
                measurement_type: {
                  type: "string",
                  enum: concept.allowed_measurement_types,
                },
                aggregation_rule: {
                  type: "string",
                  enum: ["identity", "median", "mean", "set_union", "context_passthrough"],
                },
                threshold_profile: {
                  type: "string",
                  enum: [
                    "none",
                    "likert_1_5_low_mid_high",
                    "likert_1_5_low_mid_high_strict",
                    "numeric_temperature_window",
                    "enum_identity",
                    "asset_inventory",
                  ],
                },
                slot_count: {
                  type: "integer",
                  minimum: 0,
                  maximum: concept.slot_capacity_max,
                },
                required_slot_count: {
                  type: "integer",
                  minimum: 0,
                  maximum: concept.slot_capacity_max,
                },
              },
            })),
          },
        },
      },
    },
  } as const;
}

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
            "slot_key",
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
            slot_key: {
              type: "string",
              minLength: 1,
            },
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

export function parseMeasurementPlannerLLMOutput(
  value: string,
): MeasurementPlannerLLMOutput {
  const parsed: unknown = JSON.parse(value);

  if (!isObject(parsed) || !Array.isArray(parsed.concepts)) {
    throw new Error("Measurement planner output is missing required concept fields.");
  }

  return parsed as MeasurementPlannerLLMOutput;
}
