import {
  flexpulseBehaviouralSchemaV1,
  getFlexpulseBehaviouralConcept,
  type FlexpulseBehaviouralConcept,
} from "@/features/ontology/flexpulse-behavioural-schema";
import type { PlannerQuestionType } from "./generator-types";
import type { MeasurementType } from "./measurement-plan";

export type TargetPriority = "high" | "medium" | "low";

export type GeneratorSemanticFacetGuidance = {
  key: string;
  meaning: string;
};

export type GeneratorSemanticGuidance = {
  measurement_intent: string;
  high_score_meaning: string;
  recommended_facets: GeneratorSemanticFacetGuidance[];
  must_not_measure: string[];
};

export type GeneratorConceptBoundaryRule = {
  concept_keys: [string, string];
  instruction: string;
};

export type GeneratorTargetConfig = {
  ontology_target: string;
  concept: FlexpulseBehaviouralConcept;
  allowed_measurement_types: MeasurementType[];
  allowed_question_types: PlannerQuestionType[];
  expected_type: "string" | "number" | "boolean" | "string[]";
  slot_capacity_max: number;
  priority: TargetPriority;
  prompt_notes: string;
  semantic_guidance?: GeneratorSemanticGuidance;
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
  semantic_guidance?: GeneratorSemanticGuidance;
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

function derivePriority(concept: FlexpulseBehaviouralConcept): TargetPriority {
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
    semantic_guidance: {
      measurement_intent:
        "Collect declared recognition of concrete flexibility mechanisms, not objective knowledge, willingness or trust.",
      high_score_meaning:
        "Stronger declared recognition of residential energy-flexibility mechanisms.",
      recommended_facets: [
        { key: "temporal_demand_recognition", meaning: "recognises higher- and lower-demand periods." },
        { key: "shiftable_load_recognition", meaning: "recognises activities that may be moved in time." },
        { key: "price_timing_recognition", meaning: "recognises relationships between timing and prices." },
        { key: "system_consequence_recognition", meaning: "recognises effects on network pressure or reliability." },
        { key: "automation_scope_recognition", meaning: "recognises what automation can and cannot schedule." },
      ],
      must_not_measure: [
        "Willingness.",
        "Capability.",
        "Trust.",
        "DER adoption.",
        "Financial or environmental motivation.",
      ],
    },
  },
  flexibility_willingness: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_mean"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 6,
    prompt_notes:
      "Measure willingness to accept concrete household timing or comfort changes. Name the action and its minimum trade-off, such as delaying a non-urgent task until later the same day, charging later, accepting a short thermal adjustment, or refusing disruption to an important routine. For participation_intention, do not hide willingness behind favourable undefined conditions such as 'when feasible', 'when practical', 'when suitable' or 'when it fits'; specify what action or inconvenience the arrangement may require. Keep willingness separate from capability, trust, savings motivation and tariff preference.",
    semantic_guidance: {
      measurement_intent:
        "Collect whether the respondent would accept a concrete flexibility action, not whether the household can execute it.",
      high_score_meaning:
        "Greater declared readiness to participate in flexibility actions.",
      recommended_facets: [
        { key: "participation_intention", meaning: "readiness to join an arrangement that requires a defined, non-urgent timing change." },
        { key: "appliance_shift_acceptance", meaning: "acceptance of moving an appliance task." },
        { key: "temporary_thermal_adjustment_acceptance", meaning: "acceptance of a limited thermal adjustment." },
        { key: "inconvenience_acceptance", meaning: "acceptance of a defined inconvenience." },
        { key: "routine_disruption_boundary", meaning: "point where disruption reduces willingness." },
      ],
      must_not_measure: [
        "Operational control.",
        "Temporal slack.",
        "Household coordination capability.",
        "Ownership.",
        "Trust.",
        "Savings motivation.",
        "Tariff preference.",
      ],
    },
  },
  thermal_comfort_norms: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_mean"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 6,
    prompt_notes:
      "Measure comfort expectations with concrete temperature situations. Distinguish temperature stability, tolerance for a limited deviation, recovery expectations, and the point where variation becomes unacceptable. Polarity follows the construct direction, not the linguistic tone of the statement: agreement with tolerance for deviation is negative evidence; agreement with stability requirements, prompt recovery, rejection or intolerance of deviation is positive evidence. Avoid internally conflicted items, abstract operational language, and drift into willingness, trust or programme support.",
    semantic_guidance: {
      measurement_intent:
        "Collect comfort-preservation expectations independently of willingness to participate.",
      high_score_meaning:
        "Stronger comfort-preservation requirements and lower deviation tolerance.",
      recommended_facets: [
        { key: "temperature_stability_requirement", meaning: "need to preserve the chosen indoor temperature." },
        { key: "temporary_deviation_tolerance", meaning: "tolerance for limited temperature deviation; agreement expressing tolerance must use negative polarity." },
        { key: "recovery_expectation", meaning: "expectation that the home returns to the chosen temperature." },
        { key: "comfort_variation_boundary", meaning: "point where thermal variation becomes unacceptable; agreement expressing rejection or intolerance must use positive polarity." },
      ],
      must_not_measure: [
        "Flexibility willingness.",
        "Heating/cooling capability.",
        "Trust.",
        "General support for demand response.",
      ],
    },
  },
  tariff_preference_orientation: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_mean"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 6,
    prompt_notes:
      "Measure preference for concrete bill and tariff arrangements, not technical tariff literacy. Use plain situations: same price most of the day, cheaper electricity at certain times, higher prices at busy times, predictable monthly bills, or more effort in exchange for possible savings. Avoid measuring pure savings motivation, generic flexibility willingness, or technical tariff knowledge unless used as a clearly separated facet.",
    semantic_guidance: {
      measurement_intent:
        "Collect acceptance of concrete tariff structures and their trade-offs.",
      high_score_meaning:
        "Greater acceptance of time-varying or flexibility-linked tariffs.",
      recommended_facets: [
        { key: "time_of_use_acceptance", meaning: "acceptance of tariffs with cheaper and costlier times." },
        { key: "dynamic_price_acceptance", meaning: "acceptance of more variable price structures." },
        { key: "flexibility_reward_acceptance", meaning: "acceptance of tariff designs that reward shifting use." },
        { key: "planning_effort_acceptance", meaning: "acceptance of planning effort imposed by tariff timing." },
        { key: "price_variability_tolerance", meaning: "tolerance for variability or uncertainty in costs." },
      ],
      must_not_measure: [
        "Generic savings motivation.",
        "Generic bill-stability need.",
        "Tariff knowledge.",
        "Generic flexibility willingness.",
      ],
    },
  },
  trust_in_automation: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_mean"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 6,
    prompt_notes:
      "Measure trust in concrete automated actions at home. Use situations like the system delaying a dishwasher cycle, charging a device later, or making a short heating/cooling adjustment within household settings. Distinguish reliability confidence, predictability confidence, readiness to delegate, expectation that the system respects predefined operational boundaries, and trust after minor mistakes. When delegation_readiness and boundary_respect_expectation are both selected, delegation measures handing off one suitable action without manual handling each time. Settings, limits, schedules and predefined conditions belong to boundary_respect_expectation and must not be used to qualify the delegation slot. Keep each slot single-focus: do not merge predictability with understandability, delegation with override or approval requirements, or trust resilience with ease of correction. Avoid contaminating this with manual override need, explainability need, thermal comfort, incentives, savings, or general technology enthusiasm.",
    semantic_guidance: {
      measurement_intent:
        "Collect readiness to rely on automated control, not requirements for override or explanation.",
      high_score_meaning:
        "Greater confidence and readiness to delegate suitable actions.",
      recommended_facets: [
        { key: "reliability_confidence", meaning: "confidence that the system will act dependably." },
        { key: "predictability_confidence", meaning: "confidence that the system behaves predictably." },
        { key: "delegation_readiness", meaning: "readiness to let the system handle one suitable action without manual handling each time." },
        { key: "boundary_respect_expectation", meaning: "confidence that the system stays within household-defined settings and limits." },
        { key: "trust_resilience", meaning: "capacity for trust to remain after a minor mistake." },
      ],
      must_not_measure: [
        "Manual override need.",
        "Monitoring or approval need as a trust proxy.",
        "Explainability need.",
        "Comfort.",
        "Savings.",
        "General technology enthusiasm.",
      ],
    },
  },
  der_engagement: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_mean"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 6,
    prompt_notes:
      "Measure engagement with concrete household energy devices or services: solar panels, home batteries, EV charging, heat pumps, smart thermostats, or energy management apps. Distinguish interest, readiness to use, and perceived relevance. For active_use_engagement, measure one behaviour: actual use of an available DER-related tool or service. Do not combine 'pay attention to' and 'use' in the same slot. Select this facet only when the survey population or branching establishes access to a relevant tool or service; otherwise prefer personal relevance, information-seeking, adoption consideration or adoption readiness. Avoid collapsing it into asset ownership, environmental motivation, or general technology openness.",
    semantic_guidance: {
      measurement_intent:
        "Collect position in an engagement/adoption continuum, not ownership or willingness to operate an asset flexibly.",
      high_score_meaning:
        "Greater engagement with investigating, considering, adopting or using DER technologies.",
      recommended_facets: [
        { key: "personal_relevance", meaning: "whether DER technologies feel relevant to the household." },
        { key: "information_seeking", meaning: "interest in learning more about DER technologies." },
        { key: "adoption_consideration", meaning: "active consideration of future adoption." },
        { key: "adoption_readiness", meaning: "readiness to move toward adoption or setup." },
        { key: "active_use_engagement", meaning: "active use of a DER-related tool or service when access is established." },
      ],
      must_not_measure: [
        "Ownership.",
        "Flexible operation.",
        "Flexibility willingness.",
        "Capability.",
        "Generic environmental motivation.",
        "Generic technology enthusiasm.",
      ],
    },
  },
  manual_override_need: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_mean"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 4,
    prompt_notes:
      "Measure need for human control over one concrete automated action at a time. Ask about cancelling, pausing, changing, or overriding either an appliance delay or a temperature adjustment, but do not combine both domains in the same item. Distinguish desire for immediate override, ability to intervene after an action starts, and comfort with temporary autonomous control. Do not use prior notice or permission-before-action as a proxy for override need unless the slot intent explicitly asks for consent. Avoid treating low trust, thermal discomfort, or technology rejection as the same construct.",
    semantic_guidance: {
      measurement_intent:
        "Collect the requirement to cancel, pause or change an automated action.",
      high_score_meaning: "Stronger intervention requirement.",
      recommended_facets: [
        { key: "immediate_intervention_need", meaning: "need to intervene immediately when necessary." },
        { key: "cancel_pause_need", meaning: "need to cancel or pause an ongoing action." },
        { key: "post_start_control_need", meaning: "need to change an action after it has started." },
      ],
      must_not_measure: [
        "General distrust.",
        "Explainability.",
        "Notification.",
        "Thermal discomfort.",
      ],
    },
  },
  explainability_need: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_mean"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 4,
    prompt_notes:
      "Measure the information respondents require about automated decisions using concrete explanation moments. Ask whether they need to know what changed, why it changed, and what consequences it had for comfort, costs, or device operation. Distinguish explanations before an action, explanations after an action, simple summaries versus detailed reasoning, and explanations following unexpected outcomes. Avoid measuring general energy awareness, trust in automation, manual override need, or prior approval requirements.",
    semantic_guidance: {
      measurement_intent:
        "Collect information required about automated actions, reasons and consequences.",
      high_score_meaning: "Greater explanation requirement.",
      recommended_facets: [
        { key: "pre_action_rationale", meaning: "need to know why the system may act before use." },
        { key: "post_action_explanation", meaning: "need to know what happened after an action." },
        { key: "impact_explanation", meaning: "need to know effects on comfort, bills or operation." },
        { key: "explanation_depth", meaning: "need for more detailed rather than minimal explanation." },
      ],
      must_not_measure: [
        "Awareness.",
        "Trust.",
        "Override.",
        "Prior approval.",
      ],
    },
  },
  bill_stability_need: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_mean"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 4,
    prompt_notes:
      "Measure need for predictable household energy costs. Use concrete bill situations: stable monthly bill, noticeable month-to-month changes, risk of a high bill, and willingness to accept lower possible savings for more certainty. When this is a central economic concept, prefer 3 distinct items if capacity allows. Avoid measuring pure savings motivation or tariff-model familiarity.",
    semantic_guidance: {
      measurement_intent:
        "Collect the requirement for predictable expenditure and protection from high-bill risk.",
      high_score_meaning: "Greater need for predictability.",
      recommended_facets: [
        { key: "monthly_predictability_need", meaning: "need for stable month-to-month expenditure." },
        { key: "high_bill_risk_aversion", meaning: "aversion to unexpectedly high energy costs." },
        { key: "certainty_priority", meaning: "preference for certainty over possible upside." },
      ],
      must_not_measure: [
        "Tariff acceptance.",
        "Savings motivation.",
        "Tariff literacy.",
      ],
    },
  },
  event_frequency_tolerance: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_mean"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 4,
    prompt_notes:
      "Measure tolerance for repeated requests or automated adjustments. When this concept is selected with comfort or override concepts, prefer 3 distinct items if capacity allows: acceptable weekly frequency, cumulative annoyance over time, and a negative-polarity item about repeated events becoming too disruptive. The core signal is frequency, so every item should include a frequency anchor such as several times per week or a few times per month. Duration can be mentioned only as a condition inside a repeated-event item, not as a standalone duration-tolerance item. Do not use advance notice or predictability as a proxy for frequency tolerance unless the slot intent explicitly asks for predictability.",
    semantic_guidance: {
      measurement_intent: "Collect tolerance for repeated flexibility events.",
      high_score_meaning: "Greater recurrence tolerance.",
      recommended_facets: [
        { key: "acceptable_recurrence", meaning: "how often events can happen before becoming too much." },
        { key: "cumulative_intrusiveness", meaning: "whether repetition becomes intrusive over time." },
        { key: "frequency_boundary", meaning: "point where frequency becomes unacceptable." },
      ],
      must_not_measure: [
        "Standalone duration.",
        "General willingness.",
        "Prior notice.",
        "Single-event inconvenience.",
      ],
    },
  },
  savings_motivation: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_mean"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 4,
    prompt_notes:
      "Measure motivation to save money on household energy. Use one decision context per item: lower bill, euro savings, reward, discount, switching plan for savings, monitoring usage for savings, or accepting a delay for savings. Do not combine choosing a tariff with shifting usage in the same item. Do not combine monitoring usage with changing routines in the same item. When this is a central economic concept, prefer 3 distinct items if capacity allows: importance of savings, active effort to reduce costs, and one clean trade-off item. Avoid measuring generic flexibility willingness, tariff preference, or bill predictability.",
    semantic_guidance: {
      measurement_intent:
        "Collect the strength of financial benefit as a reason to consider flexibility.",
      high_score_meaning: "Stronger activation by potential savings.",
      recommended_facets: [
        { key: "financial_salience", meaning: "importance of savings in the respondent's reasoning." },
        { key: "minimum_meaningful_benefit", meaning: "benefit needed before savings feel worthwhile." },
        { key: "reward_responsiveness", meaning: "responsiveness to financial rewards or discounts." },
      ],
      must_not_measure: [
        "Tariff preference.",
        "Bill predictability.",
        "Actual participation.",
      ],
    },
  },
  routine_dependency: {
    allowed_measurement_types: ["single_item_direct", "multi_item_likert_mean"],
    allowed_question_types: ["rating_scale", "single_choice"],
    slot_capacity_max: 4,
    prompt_notes:
      "Measure dependence on stable household routines using concrete daily constraints: work schedules, meals, childcare, sleep, appliance timing, charging needs, or when someone must be at home. Distinguish scheduling rigidity, difficulty moving activities, and need for predictability. Avoid measuring comfort norms or general unwillingness to support flexibility.",
    semantic_guidance: {
      measurement_intent:
        "Collect general scheduling and coordination constraints affecting when activities can occur.",
      high_score_meaning: "Stronger dependence on fixed schedules.",
      recommended_facets: [
        { key: "schedule_rigidity", meaning: "difficulty changing the timing of daily activities." },
        { key: "household_coordination_constraint", meaning: "constraints created by coordinating with others." },
        { key: "presence_constraint", meaning: "need for someone to be present at specific times." },
        { key: "deadline_constraint", meaning: "hard timing requirements imposed by routines or obligations." },
      ],
      must_not_measure: [
        "Unwillingness.",
        "Thermal comfort.",
        "Asset-specific capability.",
      ],
    },
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

  if (
    (concept.concept_role === "primary_profile_axis" ||
      concept.concept_role === "behavioural_modulator") &&
    !strategy.semantic_guidance
  ) {
    throw new Error(
      `Missing semantic guidance for planner concept "${concept.concept_key}".`,
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
    prompt_notes: strategy.prompt_notes.trim() || derivePromptNotes(concept),
    semantic_guidance: strategy.semantic_guidance,
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
  const config = generatorTargetConfigs.find((item) => item.ontology_target === ontologyTarget);

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

export const generatorConceptBoundaryRules: GeneratorConceptBoundaryRule[] = [
  {
    concept_keys: ["awareness_of_energy_systems", "flexibility_willingness"],
    instruction:
      "Recognising how flexibility works is not evidence of willingness to participate.",
  },
  {
    concept_keys: ["awareness_of_energy_systems", "explainability_need"],
    instruction:
      "Awareness measures respondent recognition; explainability measures information required from automation.",
  },
  {
    concept_keys: ["flexibility_willingness", "thermal_comfort_norms"],
    instruction:
      "Willingness measures consent to an adjustment; thermal norms measure the underlying comfort-preservation requirement.",
  },
  {
    concept_keys: ["flexibility_willingness", "routine_dependency"],
    instruction:
      "Willingness measures readiness; routine dependency measures scheduling constraints.",
  },
  {
    concept_keys: ["flexibility_willingness", "der_engagement"],
    instruction:
      "Willingness measures acceptance of flexibility actions; DER engagement measures technology engagement and adoption.",
  },
  {
    concept_keys: ["trust_in_automation", "manual_override_need"],
    instruction:
      "Trust measures readiness to rely; override measures the requirement to intervene.",
  },
  {
    concept_keys: ["trust_in_automation", "explainability_need"],
    instruction:
      "Trust measures readiness to rely; explainability measures information requirements.",
  },
  {
    concept_keys: ["tariff_preference_orientation", "bill_stability_need"],
    instruction:
      "Tariff preference measures acceptance of a tariff structure; bill stability measures the underlying need for predictable expenditure.",
  },
  {
    concept_keys: ["tariff_preference_orientation", "savings_motivation"],
    instruction:
      "Tariff preference measures product acceptance; savings motivation measures financial motivational salience.",
  },
];

export function getActiveGeneratorConceptBoundaryRules(conceptKeys: string[]) {
  const selected = new Set(conceptKeys);
  return generatorConceptBoundaryRules.filter(
    (rule) => selected.has(rule.concept_keys[0]) && selected.has(rule.concept_keys[1]),
  );
}
