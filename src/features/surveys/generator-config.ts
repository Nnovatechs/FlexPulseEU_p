import {
  buildOntologyTarget,
  fpBehaviourV1Concepts,
  type OntologyConceptDefinition,
  type OntologyValueType,
} from "@/features/ontology/fp-behaviour-v1";

export type MeasurementFamily =
  | "factual"
  | "latent_scale"
  | "conditional"
  | "tradeoff";

export type TargetPriority = "high" | "medium" | "low";

export type GeneratorTargetConfig = {
  ontology_target: string;
  concept: OntologyConceptDefinition;
  measurement_family: MeasurementFamily;
  question_type: "single_choice" | "multiple_choice" | "rating_scale" | "numeric";
  expected_type: "string" | "number" | "boolean" | "string[]";
  item_count_min: number;
  item_count_default: number;
  priority: TargetPriority;
  threshold_policy:
    | "none"
    | "single_item_1_5"
    | "aggregate_1_5"
    | "conditional_summary";
  prompt_notes: string;
  numeric?: {
    min?: number;
    max?: number;
    unit?: string;
  };
};

const overrides: Partial<
  Record<
    string,
    Omit<GeneratorTargetConfig, "ontology_target" | "concept" | "expected_type">
  >
> = {
  "fp_behaviour_v1.awareness.energy_awareness_level": {
    measurement_family: "latent_scale",
    question_type: "rating_scale",
    item_count_min: 1,
    item_count_default: 1,
    priority: "medium",
    threshold_policy: "single_item_1_5",
    prompt_notes: "Measure self-reported awareness using a direct 1-5 labelled scale.",
  },
  "fp_behaviour_v1.awareness.flexibility_awareness_level": {
    measurement_family: "latent_scale",
    question_type: "rating_scale",
    item_count_min: 1,
    item_count_default: 1,
    priority: "medium",
    threshold_policy: "single_item_1_5",
    prompt_notes: "Measure awareness of flexibility concepts with a direct 1-5 scale.",
  },
  "fp_behaviour_v1.awareness.automation_awareness_level": {
    measurement_family: "latent_scale",
    question_type: "rating_scale",
    item_count_min: 1,
    item_count_default: 1,
    priority: "medium",
    threshold_policy: "single_item_1_5",
    prompt_notes: "Measure awareness of automation in domestic energy management.",
  },
  "fp_behaviour_v1.awareness.self_reported_knowledge_confidence": {
    measurement_family: "latent_scale",
    question_type: "rating_scale",
    item_count_min: 1,
    item_count_default: 1,
    priority: "low",
    threshold_policy: "single_item_1_5",
    prompt_notes: "Measure confidence in personal understanding, not factual knowledge.",
  },
  "fp_behaviour_v1.flex_willingness.participation_level": {
    measurement_family: "latent_scale",
    question_type: "rating_scale",
    item_count_min: 2,
    item_count_default: 3,
    priority: "high",
    threshold_policy: "aggregate_1_5",
    prompt_notes:
      "This is a core construct. Prefer a short battery of 2-3 non-duplicate items when budget allows.",
  },
  "fp_behaviour_v1.flex_willingness.participation_conditions": {
    measurement_family: "conditional",
    question_type: "multiple_choice",
    item_count_min: 1,
    item_count_default: 1,
    priority: "high",
    threshold_policy: "conditional_summary",
    prompt_notes:
      "Ask for conditions under which flexibility participation would be acceptable.",
  },
  "fp_behaviour_v1.flex_willingness.participation_barriers": {
    measurement_family: "conditional",
    question_type: "multiple_choice",
    item_count_min: 1,
    item_count_default: 1,
    priority: "high",
    threshold_policy: "conditional_summary",
    prompt_notes: "Ask for the main barriers to participation.",
  },
  "fp_behaviour_v1.flex_willingness.participation_motivators": {
    measurement_family: "conditional",
    question_type: "multiple_choice",
    item_count_min: 1,
    item_count_default: 1,
    priority: "medium",
    threshold_policy: "conditional_summary",
    prompt_notes: "Ask for the main motivators for joining a flexibility scheme.",
  },
  "fp_behaviour_v1.flex_willingness.event_frequency_tolerance": {
    measurement_family: "latent_scale",
    question_type: "rating_scale",
    item_count_min: 1,
    item_count_default: 1,
    priority: "medium",
    threshold_policy: "single_item_1_5",
    prompt_notes: "Measure how often flexibility events would still feel acceptable.",
  },
  "fp_behaviour_v1.thermal_comfort.winter_setpoint_c": {
    measurement_family: "factual",
    question_type: "numeric",
    item_count_min: 1,
    item_count_default: 1,
    priority: "medium",
    threshold_policy: "none",
    prompt_notes: "Ask for a preferred winter indoor temperature.",
    numeric: { min: 14, max: 26, unit: "°C" },
  },
  "fp_behaviour_v1.thermal_comfort.summer_setpoint_c": {
    measurement_family: "factual",
    question_type: "numeric",
    item_count_min: 1,
    item_count_default: 1,
    priority: "medium",
    threshold_policy: "none",
    prompt_notes: "Ask for a preferred summer indoor temperature.",
    numeric: { min: 18, max: 32, unit: "°C" },
  },
  "fp_behaviour_v1.thermal_comfort.comfort_strictness": {
    measurement_family: "latent_scale",
    question_type: "rating_scale",
    item_count_min: 1,
    item_count_default: 1,
    priority: "high",
    threshold_policy: "single_item_1_5",
    prompt_notes: "Measure how strict the respondent is about preserving comfort.",
  },
  "fp_behaviour_v1.thermal_comfort.temperature_variation_tolerance": {
    measurement_family: "latent_scale",
    question_type: "rating_scale",
    item_count_min: 1,
    item_count_default: 1,
    priority: "high",
    threshold_policy: "single_item_1_5",
    prompt_notes: "Measure tolerance for indoor temperature variation during control events.",
  },
  "fp_behaviour_v1.thermal_comfort.schedule_flexibility_for_comfort": {
    measurement_family: "latent_scale",
    question_type: "rating_scale",
    item_count_min: 1,
    item_count_default: 1,
    priority: "low",
    threshold_policy: "single_item_1_5",
    prompt_notes: "Measure flexibility around comfort-related routines and schedules.",
  },
  "fp_behaviour_v1.thermal_comfort.night_setback_acceptance": {
    measurement_family: "latent_scale",
    question_type: "rating_scale",
    item_count_min: 1,
    item_count_default: 1,
    priority: "medium",
    threshold_policy: "single_item_1_5",
    prompt_notes: "Measure acceptance of night setback or similar strategies.",
  },
  "fp_behaviour_v1.trust_automation.automation_trust_level": {
    measurement_family: "latent_scale",
    question_type: "rating_scale",
    item_count_min: 2,
    item_count_default: 3,
    priority: "high",
    threshold_policy: "aggregate_1_5",
    prompt_notes:
      "This is a core construct. Prefer a short battery of 2-3 non-duplicate items when budget allows.",
  },
  "fp_behaviour_v1.trust_automation.automation_acceptance_scope": {
    measurement_family: "conditional",
    question_type: "multiple_choice",
    item_count_min: 1,
    item_count_default: 1,
    priority: "low",
    threshold_policy: "conditional_summary",
    prompt_notes: "Ask which automation domains or actions the respondent would accept.",
  },
  "fp_behaviour_v1.trust_automation.automation_conditions": {
    measurement_family: "conditional",
    question_type: "multiple_choice",
    item_count_min: 1,
    item_count_default: 1,
    priority: "high",
    threshold_policy: "conditional_summary",
    prompt_notes: "Ask which conditions are required before accepting automation.",
  },
  "fp_behaviour_v1.trust_automation.manual_override_need": {
    measurement_family: "latent_scale",
    question_type: "rating_scale",
    item_count_min: 1,
    item_count_default: 1,
    priority: "high",
    threshold_policy: "single_item_1_5",
    prompt_notes: "Measure how necessary manual override feels.",
  },
  "fp_behaviour_v1.trust_automation.explainability_need": {
    measurement_family: "latent_scale",
    question_type: "rating_scale",
    item_count_min: 1,
    item_count_default: 1,
    priority: "medium",
    threshold_policy: "single_item_1_5",
    prompt_notes: "Measure the need for explanations and transparency.",
  },
  "fp_behaviour_v1.trust_automation.bill_protection_need": {
    measurement_family: "latent_scale",
    question_type: "rating_scale",
    item_count_min: 1,
    item_count_default: 1,
    priority: "medium",
    threshold_policy: "single_item_1_5",
    prompt_notes: "Measure how important bill protection is before accepting automation.",
  },
  "fp_behaviour_v1.tariff_preferences.preferred_tariff_model": {
    measurement_family: "factual",
    question_type: "single_choice",
    item_count_min: 1,
    item_count_default: 1,
    priority: "medium",
    threshold_policy: "none",
    prompt_notes:
      "Use a single choice with clear tariff models such as fixed, dynamic or hybrid.",
  },
  "fp_behaviour_v1.tariff_preferences.bill_variability_tolerance": {
    measurement_family: "latent_scale",
    question_type: "rating_scale",
    item_count_min: 1,
    item_count_default: 1,
    priority: "high",
    threshold_policy: "single_item_1_5",
    prompt_notes: "Measure tolerance for bill variability.",
  },
  "fp_behaviour_v1.tariff_preferences.price_saving_motivation": {
    measurement_family: "latent_scale",
    question_type: "rating_scale",
    item_count_min: 1,
    item_count_default: 1,
    priority: "low",
    threshold_policy: "single_item_1_5",
    prompt_notes: "Measure the importance of savings as a motivator.",
  },
  "fp_behaviour_v1.tariff_preferences.risk_aversion_level": {
    measurement_family: "latent_scale",
    question_type: "rating_scale",
    item_count_min: 1,
    item_count_default: 1,
    priority: "high",
    threshold_policy: "single_item_1_5",
    prompt_notes: "Measure aversion to tariff or price uncertainty.",
  },
  "fp_behaviour_v1.tariff_preferences.incentive_sensitivity": {
    measurement_family: "latent_scale",
    question_type: "rating_scale",
    item_count_min: 1,
    item_count_default: 1,
    priority: "medium",
    threshold_policy: "single_item_1_5",
    prompt_notes: "Measure responsiveness to monetary or contractual incentives.",
  },
  "fp_behaviour_v1.device_engagement.owned_devices": {
    measurement_family: "conditional",
    question_type: "multiple_choice",
    item_count_min: 1,
    item_count_default: 1,
    priority: "low",
    threshold_policy: "conditional_summary",
    prompt_notes: "Ask which relevant devices are already owned or used.",
  },
  "fp_behaviour_v1.device_engagement.interested_devices": {
    measurement_family: "conditional",
    question_type: "multiple_choice",
    item_count_min: 1,
    item_count_default: 1,
    priority: "medium",
    threshold_policy: "conditional_summary",
    prompt_notes: "Ask which relevant devices the respondent is interested in adopting.",
  },
  "fp_behaviour_v1.device_engagement.device_familiarity": {
    measurement_family: "latent_scale",
    question_type: "rating_scale",
    item_count_min: 1,
    item_count_default: 1,
    priority: "low",
    threshold_policy: "single_item_1_5",
    prompt_notes: "Measure overall familiarity with relevant energy devices.",
  },
  "fp_behaviour_v1.device_engagement.device_control_readiness": {
    measurement_family: "latent_scale",
    question_type: "rating_scale",
    item_count_min: 1,
    item_count_default: 1,
    priority: "high",
    threshold_policy: "single_item_1_5",
    prompt_notes: "Measure general readiness to allow managed control of household devices.",
  },
  "fp_behaviour_v1.device_engagement.device_usage_dependence": {
    measurement_family: "latent_scale",
    question_type: "rating_scale",
    item_count_min: 1,
    item_count_default: 1,
    priority: "medium",
    threshold_policy: "single_item_1_5",
    prompt_notes: "Measure how strongly routines depend on those devices.",
  },
  "fp_behaviour_v1.device_engagement.ev_ownership": {
    measurement_family: "factual",
    question_type: "single_choice",
    item_count_min: 1,
    item_count_default: 1,
    priority: "medium",
    threshold_policy: "none",
    prompt_notes: "Ask directly whether the respondent owns or uses an EV.",
  },
  "fp_behaviour_v1.device_engagement.ev_control_readiness": {
    measurement_family: "latent_scale",
    question_type: "rating_scale",
    item_count_min: 1,
    item_count_default: 1,
    priority: "high",
    threshold_policy: "single_item_1_5",
    prompt_notes: "Measure willingness to allow managed EV charging control.",
  },
  "fp_behaviour_v1.device_engagement.ev_charging_flexibility": {
    measurement_family: "latent_scale",
    question_type: "rating_scale",
    item_count_min: 1,
    item_count_default: 1,
    priority: "medium",
    threshold_policy: "single_item_1_5",
    prompt_notes: "Measure tolerance for flexible timing of EV charging.",
  },
  "fp_behaviour_v1.device_engagement.heat_pump_ownership": {
    measurement_family: "factual",
    question_type: "single_choice",
    item_count_min: 1,
    item_count_default: 1,
    priority: "medium",
    threshold_policy: "none",
    prompt_notes: "Ask directly whether the respondent owns or uses a heat pump.",
  },
  "fp_behaviour_v1.device_engagement.heat_pump_control_readiness": {
    measurement_family: "latent_scale",
    question_type: "rating_scale",
    item_count_min: 1,
    item_count_default: 1,
    priority: "high",
    threshold_policy: "single_item_1_5",
    prompt_notes: "Measure willingness to allow managed heat pump control.",
  },
  "fp_behaviour_v1.device_engagement.heat_pump_comfort_dependency": {
    measurement_family: "latent_scale",
    question_type: "rating_scale",
    item_count_min: 1,
    item_count_default: 1,
    priority: "high",
    threshold_policy: "single_item_1_5",
    prompt_notes: "Measure how much comfort routines depend on heat pump behaviour.",
  },
  "fp_behaviour_v1.device_engagement.battery_ownership": {
    measurement_family: "factual",
    question_type: "single_choice",
    item_count_min: 1,
    item_count_default: 1,
    priority: "low",
    threshold_policy: "none",
    prompt_notes: "Ask directly whether the respondent owns or uses a battery system.",
  },
  "fp_behaviour_v1.device_engagement.pv_ownership": {
    measurement_family: "factual",
    question_type: "single_choice",
    item_count_min: 1,
    item_count_default: 1,
    priority: "low",
    threshold_policy: "none",
    prompt_notes: "Ask directly whether the respondent owns or uses photovoltaic generation.",
  },
  "fp_behaviour_v1.device_engagement.smart_appliance_readiness": {
    measurement_family: "latent_scale",
    question_type: "rating_scale",
    item_count_min: 1,
    item_count_default: 1,
    priority: "medium",
    threshold_policy: "single_item_1_5",
    prompt_notes: "Measure readiness to allow flexible or automated operation of smart appliances.",
  },
};

function mapOntologyValueTypeToExpectedType(
  valueType: OntologyValueType,
): GeneratorTargetConfig["expected_type"] {
  switch (valueType) {
    case "boolean":
      return "boolean";
    case "number":
    case "ordinal_1_5":
      return "number";
    case "string[]":
      return "string[]";
    case "enum":
    case "string":
    default:
      return "string";
  }
}

export const generatorTargetConfigs: GeneratorTargetConfig[] = fpBehaviourV1Concepts
  .map((concept) => {
    const ontology_target = buildOntologyTarget(concept.block, concept.attribute);
    const override = overrides[ontology_target];

    if (!override) {
      return null;
    }

    return {
      ontology_target,
      concept,
      expected_type: mapOntologyValueTypeToExpectedType(concept.value_type),
      ...override,
    } satisfies GeneratorTargetConfig;
  })
  .filter((value): value is GeneratorTargetConfig => value !== null);

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
