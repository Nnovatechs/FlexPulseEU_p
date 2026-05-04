import {
  flexpulseBehaviouralSchemaV1,
  getFlexpulseBehaviouralConcept,
  type FlexpulseBehaviouralConcept,
} from "@/features/ontology/flexpulse-behavioural-schema";
import type {
  PlannerQuestionType,
} from "./generator-types";
import type { MeasurementType } from "./measurement-plan";

export type TargetPriority = "high" | "medium" | "low";

export type GeneratorTargetConfig = {
  ontology_target: string;
  concept: FlexpulseBehaviouralConcept;
  allowed_measurement_types: MeasurementType[];
  allowed_question_types: PlannerQuestionType[];
  expected_type: "string" | "number" | "boolean" | "string[]";
  slot_capacity_max: number;
  priority: TargetPriority;
  prompt_notes: string;
  numeric?: {
    min?: number;
    max?: number;
    unit?: string;
  };
};

type GeneratorConceptStrategy = {
  allowed_measurement_types: MeasurementType[];
  allowed_question_types: PlannerQuestionType[];
  slot_capacity_max: number;
  prompt_notes: string;
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

function derivePriority(
  concept: FlexpulseBehaviouralConcept,
): TargetPriority {
  if (concept.concept_role === "primary_profile_axis") {
    return "high";
  }

  if (concept.concept_role === "behavioural_modulator") {
    return "medium";
  }

  return "medium";
}

function derivePromptNotes(concept: FlexpulseBehaviouralConcept): string {
  switch (concept.concept_role) {
    case "primary_profile_axis":
      return "Plan this as a core behavioural construct. You must decide whether single-item or multi-item coverage is methodologically justified; prefer interpretable profile-level signal over superficial attitudes.";
    case "behavioural_modulator":
      return "Plan this as explanatory supporting evidence for a core axis. Keep it compact unless extra coverage clearly improves interpretation, and decide item count yourself.";
    case "applicability_factor":
      return "Plan this as factual or segmenting evidence. Prefer stable, low-ambiguity measurement over deeper latent construct treatment.";
    case "context_signal":
      return "This concept is system/runtime context and should normally stay outside respondent-facing question design.";
    case "quality_signal":
      return "This concept is pipeline quality state, not a survey-measured construct.";
    default:
      return "Plan only what is operationally useful for downstream survey generation and mapping.";
  }
}

const generatorConceptStrategies: Record<string, GeneratorConceptStrategy> = {
  awareness_of_energy_systems: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_median"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 6,
    prompt_notes: "",
  },
  flexibility_willingness: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_median"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 6,
    prompt_notes: "",
  },
  thermal_comfort_norms: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_median"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 6,
    prompt_notes: "",
  },
  tariff_preference_orientation: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_median"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 6,
    prompt_notes: "",
  },
  trust_in_automation: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_median"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 6,
    prompt_notes: "",
  },
  der_engagement: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_median"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 6,
    prompt_notes: "",
  },
  manual_override_need: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_median"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 4,
    prompt_notes: "",
  },
  explainability_need: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_median"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 4,
    prompt_notes: "",
  },
  bill_stability_need: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_median"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 4,
    prompt_notes: "",
  },
  event_frequency_tolerance: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_median"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 4,
    prompt_notes: "",
  },
  savings_motivation: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_median"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 4,
    prompt_notes: "",
  },
  routine_dependency: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_median"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 4,
    prompt_notes: "",
  },
  owned_der_assets: {
    allowed_measurement_types: ["multi_choice_tag_set"],
    allowed_question_types: ["multiple_choice"],
    slot_capacity_max: 1,
    prompt_notes: "",
  },
  interested_der_assets: {
    allowed_measurement_types: ["multi_choice_tag_set"],
    allowed_question_types: ["multiple_choice"],
    slot_capacity_max: 1,
    prompt_notes: "",
  },
  winter_comfort_setpoint_c: {
    allowed_measurement_types: ["numeric_direct"],
    allowed_question_types: ["numeric"],
    slot_capacity_max: 1,
    prompt_notes: "",
  },
  summer_comfort_setpoint_c: {
    allowed_measurement_types: ["numeric_direct"],
    allowed_question_types: ["numeric"],
    slot_capacity_max: 1,
    prompt_notes: "",
  },
  preferred_tariff_model: {
    allowed_measurement_types: ["single_choice_enum"],
    allowed_question_types: ["single_choice"],
    slot_capacity_max: 1,
    prompt_notes: "",
  },
  country_code: {
    allowed_measurement_types: ["context_passthrough"],
    allowed_question_types: [],
    slot_capacity_max: 0,
    prompt_notes: "",
  },
  normalized_location_context: {
    allowed_measurement_types: ["context_passthrough"],
    allowed_question_types: [],
    slot_capacity_max: 0,
    prompt_notes: "",
  },
  climate_context: {
    allowed_measurement_types: ["context_passthrough"],
    allowed_question_types: [],
    slot_capacity_max: 0,
    prompt_notes: "",
  },
  survey_language: {
    allowed_measurement_types: ["context_passthrough"],
    allowed_question_types: [],
    slot_capacity_max: 0,
    prompt_notes: "",
  },
  mapping_low_confidence: {
    allowed_measurement_types: ["quality_flag_passthrough"],
    allowed_question_types: [],
    slot_capacity_max: 0,
    prompt_notes: "",
  },
  mapping_requires_review: {
    allowed_measurement_types: ["quality_flag_passthrough"],
    allowed_question_types: [],
    slot_capacity_max: 0,
    prompt_notes: "",
  },
};

function buildGeneratorTargetConfig(
  concept: FlexpulseBehaviouralConcept,
): GeneratorTargetConfig {
  const strategy = generatorConceptStrategies[concept.concept_key];
  if (!strategy) {
    throw new Error(
      `Missing generator strategy for behavioural concept "${concept.concept_key}".`,
    );
  }

  return {
    ontology_target: concept.schema_target,
    concept,
    allowed_measurement_types: strategy.allowed_measurement_types,
    allowed_question_types: strategy.allowed_question_types,
    expected_type: mapOutputTypeToExpectedType(concept.output_type),
    slot_capacity_max: strategy.slot_capacity_max,
    priority: derivePriority(concept),
    prompt_notes:
      strategy.prompt_notes.trim() || derivePromptNotes(concept),
    numeric:
      strategy.allowed_measurement_types.includes("numeric_direct")
        ? {
            min: concept.validation_constraints?.min,
            max: concept.validation_constraints?.max,
            unit: "°C",
          }
        : undefined,
  };
}

export const generatorTargetConfigs: GeneratorTargetConfig[] =
  flexpulseBehaviouralSchemaV1
    .filter(
      (concept) =>
        concept.concept_role !== "context_signal" &&
        concept.concept_role !== "quality_signal",
    )
    .map(buildGeneratorTargetConfig);

export function getGeneratorTargetConfig(
  ontologyTarget: string,
): GeneratorTargetConfig {
  const config = generatorTargetConfigs.find(
    (item) => item.ontology_target === ontologyTarget,
  );

  if (config) {
    return config;
  }

  const concept = flexpulseBehaviouralSchemaV1.find(
    (item) => item.schema_target === ontologyTarget,
  );

  if (!concept) {
    throw new Error(`Missing generator configuration for "${ontologyTarget}".`);
  }

  return buildGeneratorTargetConfig(concept);
}

export function getGeneratorTargetConfigs(
  ontologyTargets: string[],
): GeneratorTargetConfig[] {
  return ontologyTargets.map(getGeneratorTargetConfig);
}

export function getGeneratorTargetConfigByConceptKey(
  conceptKey: string,
): GeneratorTargetConfig {
  const concept = getFlexpulseBehaviouralConcept(conceptKey);

  if (!concept) {
    throw new Error(`Unknown FlexPulse behavioural concept "${conceptKey}".`);
  }

  return buildGeneratorTargetConfig(concept);
}
