import {
  flexpulseSurveyDesignConcepts,
  type FlexpulseBehaviouralConcept,
  type FlexpulseQuestionType,
} from "@/features/ontology/flexpulse-behavioural-schema";

export type MeasurementFamily =
  | "likert_construct"
  | "single_choice_enum"
  | "multi_select_inventory"
  | "binary_applicability"
  | "numeric_preference";

export type TargetPriority = "high" | "medium" | "low";

export type ThresholdPolicy =
  | "none"
  | "single_item_1_5"
  | "aggregate_1_5"
  | "conditional_summary";

export type GeneratorTargetConfig = {
  ontology_target: string;
  concept: FlexpulseBehaviouralConcept;
  measurement_family: MeasurementFamily;
  question_type: FlexpulseQuestionType;
  expected_type: "string" | "number" | "boolean" | "string[]";
  item_count_min: number;
  item_count_default: number;
  priority: TargetPriority;
  threshold_policy: ThresholdPolicy;
  prompt_notes: string;
  numeric?: {
    min?: number;
    max?: number;
    unit?: string;
  };
};

function mapOutputTypeToExpectedType(
  outputType: FlexpulseBehaviouralConcept["output_type"],
): GeneratorTargetConfig["expected_type"] {
  switch (outputType) {
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "string[]":
      return "string[]";
    case "enum":
    case "string":
    default:
      return "string";
  }
}

function mapThresholdProfileToPolicy(
  thresholdProfile: FlexpulseBehaviouralConcept["threshold_profile"],
): ThresholdPolicy {
  switch (thresholdProfile) {
    case "likert_1_5_low_mid_high":
    case "likert_1_5_low_mid_high_strict":
      return "aggregate_1_5";
    case "asset_inventory":
      return "conditional_summary";
    case "numeric_temperature_window":
    case "enum_identity":
    case "none":
    default:
      return "none";
  }
}

function derivePriority(
  concept: FlexpulseBehaviouralConcept,
): TargetPriority {
  if (concept.descriptor_role === "primary_profile_axis") {
    return "high";
  }

  if (concept.descriptor_role === "behavioural_modulator") {
    return "medium";
  }

  return "medium";
}

function deriveQuestionType(
  concept: FlexpulseBehaviouralConcept,
): FlexpulseQuestionType {
  return concept.recommended_question_types[0] ?? "rating_scale";
}

function derivePromptNotes(concept: FlexpulseBehaviouralConcept) {
  return concept.question_strategy_hints.join(" ");
}

export const generatorTargetConfigs: GeneratorTargetConfig[] =
  flexpulseSurveyDesignConcepts.map((concept) => ({
    ontology_target: concept.schema_target,
    concept,
    measurement_family:
      concept.measurement_family === "contextual_signal" ||
      concept.measurement_family === "quality_flag"
        ? "single_choice_enum"
        : concept.measurement_family,
    question_type: deriveQuestionType(concept),
    expected_type: mapOutputTypeToExpectedType(concept.output_type),
    item_count_min: concept.minimum_item_count,
    item_count_default: concept.recommended_item_count,
    priority: derivePriority(concept),
    threshold_policy: mapThresholdProfileToPolicy(concept.threshold_profile),
    prompt_notes: derivePromptNotes(concept),
    numeric:
      concept.measurement_family === "numeric_preference"
        ? {
            min: concept.validation_constraints?.min,
            max: concept.validation_constraints?.max,
            unit: "°C",
          }
        : undefined,
  }));

export function getGeneratorTargetConfig(
  ontologyTarget: string,
): GeneratorTargetConfig {
  const config = generatorTargetConfigs.find(
    (item) => item.ontology_target === ontologyTarget,
  );

  if (!config) {
    throw new Error(`Missing generator configuration for "${ontologyTarget}".`);
  }

  return config;
}

export function getGeneratorTargetConfigs(
  ontologyTargets: string[],
): GeneratorTargetConfig[] {
  return ontologyTargets.map(getGeneratorTargetConfig);
}
