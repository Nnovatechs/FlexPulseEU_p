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
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_mean"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 6,
    prompt_notes:
      "Measure practical awareness, not vague self-confidence. Prefer items that test whether respondents recognize a concrete mechanism: peak/busy times, lower-demand periods, shiftable appliance tasks, network reliability, price signals, or what automation can and cannot schedule. Avoid circular wording like 'I understand the basic idea' unless the item names the specific mechanism. Avoid 'some electricity use', 'certain uses', and 'when needed'. Avoid using ability to explain as a proxy for awareness when explainability_need is also selected. Avoid drifting into trust, acceptance, or environmental motivation.",
  },
  flexibility_willingness: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_mean"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 6,
    prompt_notes:
      "Measure willingness to adapt concrete household actions. Name the action and trade-off: delaying laundry, running the dishwasher later, charging a device/EV later, accepting a short heating or cooling adjustment, or refusing disruption to a routine. Distinguish general openness, inconvenience tolerance, routine disruption, and boundary conditions. Avoid vague phrases like 'shift some household electricity use', 'normal home life', or 'if needed'. Avoid contaminating this construct with trust in automation, savings motivation, or tariff preference unless the survey brief explicitly asks for that trade-off.",
  },
  thermal_comfort_norms: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_mean"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 6,
    prompt_notes:
      "Measure comfort expectations with concrete temperature situations. Distinguish preference for stable indoor temperature, tolerance for being slightly warmer/cooler for a limited time, and expectation that the home returns to the chosen temperature. Do not write internally conflicted items such as staying close to the chosen temperature while it is being adjusted. Avoid abstract terms like 'operational adjustments'. Avoid turning this into general flexibility willingness, automation trust, or environmental support.",
  },
  tariff_preference_orientation: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_mean"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 6,
    prompt_notes:
      "Measure preference for concrete bill and tariff arrangements, not technical tariff literacy. Use plain situations: same price most of the day, cheaper electricity at certain times, higher prices at busy times, predictable monthly bills, or more effort in exchange for possible savings. Avoid measuring pure savings motivation, generic flexibility willingness, or technical tariff knowledge unless used as a clearly separated facet.",
  },
  trust_in_automation: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_mean"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 6,
    prompt_notes:
      "Measure trust in concrete automated actions at home. Use situations like the system delaying a dishwasher cycle, charging a device later, or making a short heating/cooling adjustment within household settings. Distinguish reliability, predictability, willingness to delegate, oversight need, and trust after minor mistakes. Keep each slot single-focus: do not merge predictability with understandability, delegation with boundary-setting, or mistake tolerance with ease of correction unless that trade-off is explicitly the slot intent. Avoid contaminating this with thermal comfort, incentives, savings, or general technology enthusiasm.",
  },
  der_engagement: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_mean"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 6,
    prompt_notes:
      "Measure engagement with concrete household energy devices or services: solar panels, home batteries, EV charging, heat pumps, smart thermostats, or energy management apps. Distinguish interest, readiness to use, and perceived relevance. Avoid collapsing it into asset ownership, environmental motivation, or general technology openness.",
  },
  manual_override_need: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_mean"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 4,
    prompt_notes:
      "Measure need for human control over one concrete automated action at a time. Ask about cancelling, pausing, changing, or overriding either an appliance delay or a temperature adjustment, but do not combine both domains in the same item. Distinguish desire for immediate override, ability to intervene after an action starts, and comfort with temporary autonomous control. Do not use prior notice or permission-before-action as a proxy for override need unless the slot intent explicitly asks for consent. Avoid treating low trust, thermal discomfort, or technology rejection as the same construct.",
  },
  explainability_need: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_mean"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 4,
    prompt_notes:
      "Measure desire to understand automated decisions using concrete explanation moments. Ask whether the respondent needs to know what changed, why it changed, whether it affected comfort or bills, and how to override it next time. Distinguish explanations before acceptance, explanations after actions, simple summaries versus detailed reasoning, and explanations after unexpected outcomes. Avoid measuring general awareness or trust directly.",
  },
  bill_stability_need: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_mean"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 4,
    prompt_notes:
      "Measure need for predictable household energy costs. Use concrete bill situations: stable monthly bill, noticeable month-to-month changes, risk of a high bill, and willingness to accept lower possible savings for more certainty. When this is a central economic concept, prefer 3 distinct items if capacity allows. Avoid measuring pure savings motivation or tariff-model familiarity.",
  },
  event_frequency_tolerance: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_mean"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 4,
    prompt_notes:
      "Measure tolerance for repeated requests or automated adjustments. When this concept is selected with comfort or override concepts, prefer 3 distinct items if capacity allows: acceptable weekly frequency, cumulative annoyance over time, and a negative-polarity item about repeated events becoming too disruptive. The core signal is frequency, so every item should include a frequency anchor such as several times per week or a few times per month. Duration can be mentioned only as a condition inside a repeated-event item, not as a standalone duration-tolerance item. Do not use advance notice or predictability as a proxy for frequency tolerance unless the slot intent explicitly asks for predictability.",
  },
  savings_motivation: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_mean"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 4,
    prompt_notes:
      "Measure motivation to save money on household energy. Use one decision context per item: lower bill, euro savings, reward, discount, switching plan for savings, monitoring usage for savings, or accepting a delay for savings. Do not combine choosing a tariff with shifting usage in the same item. Do not combine monitoring usage with changing routines in the same item. When this is a central economic concept, prefer 3 distinct items if capacity allows: importance of savings, active effort to reduce costs, and one clean trade-off item. Avoid measuring generic flexibility willingness, tariff preference, or bill predictability.",
  },
  routine_dependency: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_mean"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 4,
    prompt_notes:
      "Measure dependence on stable household routines using concrete daily constraints: work schedules, meals, childcare, sleep, appliance timing, charging needs, or when someone must be at home. Distinguish scheduling rigidity, difficulty moving activities, and need for predictability. Avoid measuring comfort norms or general unwillingness to support flexibility.",
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
      "Measure stated tariff-model preference as one factual categorical choice. Option labels must be plain respondent-facing descriptions, not internal values. Use labels such as 'Same price most of the time', 'Cheaper electricity at certain times of day', 'Rewards for shifting use when asked', 'Prices change often, with more risk and possible savings', and 'Not sure / I would need more information'. Do not expand it into a latent economic scale; use savings_motivation and bill_stability_need for that.",
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
        concept.concept_key !== "declared_flexibility_capability" &&
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
