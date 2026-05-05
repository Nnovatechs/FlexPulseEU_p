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
    prompt_notes:
      "Measure awareness as more than self-confidence when possible: distinguish perceived understanding, concrete recognition of shiftable household loads, and applied understanding of what automation can or cannot change. Avoid using ability to explain as a proxy for awareness when explainability_need is also selected. Avoid drifting into trust, acceptance, or environmental motivation.",
  },
  flexibility_willingness: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_median"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 6,
    prompt_notes:
      "Measure willingness to adapt electricity use under concrete household conditions. Distinguish general openness, inconvenience tolerance, routine disruption, and boundary conditions. Avoid contaminating this construct with trust in automation, savings motivation, or tariff preference unless the survey brief explicitly asks for that trade-off.",
  },
  thermal_comfort_norms: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_median"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 6,
    prompt_notes:
      "Measure comfort expectations and tolerance for temporary temperature deviation. Distinguish stability preference, acceptable deviation, and recovery expectations. Avoid turning this into general flexibility willingness or environmental support.",
  },
  tariff_preference_orientation: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_median"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 6,
    prompt_notes:
      "Measure orientation toward tariff structure: stable pricing, time-varying pricing, active management, and predictability versus potential savings. Avoid measuring pure savings motivation, generic flexibility willingness, or technical tariff knowledge unless used as a clearly separated facet.",
  },
  trust_in_automation: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_median"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 6,
    prompt_notes:
      "Measure trust in system competence and delegation under realistic safeguards. Distinguish reliability, predictability, willingness to delegate, oversight need, and trust after minor mistakes. Keep each slot single-focus: do not merge predictability with understandability, delegation with boundary-setting, or mistake tolerance with ease of correction unless that trade-off is explicitly the slot intent. Avoid contaminating this with thermal comfort, incentives, savings, or general technology enthusiasm.",
  },
  der_engagement: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_median"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 6,
    prompt_notes:
      "Measure engagement with distributed energy resources as interest, readiness to use, and perceived relevance. Avoid collapsing it into asset ownership, environmental motivation, or general technology openness.",
  },
  manual_override_need: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_median"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 4,
    prompt_notes:
      "Measure need for human control over automated actions. Distinguish desire for immediate override, ability to intervene after an action starts, and comfort with temporary autonomous control. Do not use prior notice or permission-before-action as a proxy for override need unless the slot intent explicitly asks for consent. Avoid treating low trust, thermal discomfort, or technology rejection as the same construct.",
  },
  explainability_need: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_median"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 4,
    prompt_notes:
      "Measure desire to understand automated decisions. Distinguish explanations before acceptance, explanations after actions, simple summaries versus detailed reasoning, and explanations after unexpected outcomes. Avoid measuring general awareness or trust directly.",
  },
  bill_stability_need: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_median"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 4,
    prompt_notes:
      "Measure need for predictable energy costs. When this is a central economic concept, prefer 3 distinct items if capacity allows: importance of predictability, discomfort with bill volatility, and willingness to trade lower expected savings for stable bills. Avoid measuring pure savings motivation or tariff-model familiarity.",
  },
  event_frequency_tolerance: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_median"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 4,
    prompt_notes:
      "Measure tolerance for repeated flexibility events. Use concrete frequency anchors when possible, such as several times per week or a few times per month. Distinguish frequency, duration, and cumulative disruption. Do not use advance notice or predictability as a proxy for frequency tolerance unless the slot intent explicitly asks for predictability.",
  },
  savings_motivation: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_median"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 4,
    prompt_notes:
      "Measure economic motivation to reduce energy costs. When this is a central economic concept, prefer 3 distinct items if capacity allows: importance of savings, active effort to reduce costs, and acceptable inconvenience for savings. Avoid measuring generic flexibility willingness, tariff preference, or bill predictability.",
  },
  routine_dependency: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_median"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 4,
    prompt_notes:
      "Measure dependence on stable household routines. Distinguish scheduling rigidity, difficulty moving activities, and need for predictability. Avoid measuring comfort norms or general unwillingness to support flexibility.",
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
    prompt_notes:
      "Measure stated tariff-model preference as a factual categorical choice. Keep this to one clear item and use plain-language option descriptions. Do not expand it into a latent economic scale; use savings_motivation and bill_stability_need for that.",
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
