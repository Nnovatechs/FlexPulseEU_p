import { FLEXPULSE_DER_ASSET_VALUES, getFlexpulseBehaviouralConcept } from "@/features/ontology/flexpulse-behavioural-schema";
import { CANONICAL_DER_ASSET_OPTION_LABELS } from "@/features/surveys/asset-option-labels";
import {
  createDeclaredFlexibilityCapabilityDefinitionArtifacts,
} from "@/features/surveys/declared-flexibility-capability-module";
import {
  compileMappingContract,
  computeMappingHash,
  computeMeasurementHash,
} from "@/features/surveys/generator-mapping";
import {
  createInitialMappingContract,
  createInitialSurveyDefinition,
  type MeasurementPlanEntry,
  type PersistedSurvey,
  type SurveyMappingDefinition,
  type SurveyQuestionDefinition,
} from "@/features/surveys/generator-types";
import { CANONICAL_PREFERRED_TARIFF_OPTION_LABELS } from "@/features/surveys/tariff-option-labels";
import {
  DASHBOARD_QA_FIXTURE_KIND,
  DASHBOARD_QA_SURVEY_NAME,
} from "./constants";

type LikertSlot = {
  facet: string;
  intent: string;
};

type LikertConceptSpec = {
  conceptKey: string;
  slots: LikertSlot[];
};

const LIKERT_CONCEPTS: LikertConceptSpec[] = [
  {
    conceptKey: "awareness_of_energy_systems",
    slots: [
      { facet: "temporal_demand_recognition", intent: "Familiarity with how electricity demand changes through the day." },
      { facet: "shiftable_load_recognition", intent: "Understanding that shifting use changes when electricity is consumed." },
      { facet: "price_timing_recognition", intent: "Familiarity with how time of use can affect the household bill." },
    ],
  },
  {
    conceptKey: "flexibility_willingness",
    slots: [
      { facet: "participation_intention", intent: "Willingness to join a bounded household flexibility programme." },
      { facet: "appliance_shift_acceptance", intent: "Willingness to delay a named appliance task by two hours." },
      { facet: "temporary_thermal_adjustment_acceptance", intent: "Willingness to accept a 2°C indoor change for two hours." },
    ],
  },
  {
    conceptKey: "thermal_comfort_norms",
    slots: [
      { facet: "temperature_stability_requirement", intent: "Need to preserve the chosen indoor temperature while at home." },
      { facet: "temporary_deviation_intolerance", intent: "Low tolerance for a 1°C indoor deviation for one hour." },
      { facet: "comfort_variation_boundary", intent: "Point where a 2°C indoor deviation for one hour is unacceptable." },
    ],
  },
  {
    conceptKey: "tariff_preference_orientation",
    slots: [
      { facet: "time_of_use_acceptance", intent: "Acceptance of a tariff with known cheaper and more expensive periods." },
      { facet: "dynamic_price_acceptance", intent: "Acceptance of a tariff whose price updates with defined notice." },
      { facet: "flexibility_reward_acceptance", intent: "Acceptance of a tariff that rewards one bounded shift of appliance use." },
    ],
  },
  {
    conceptKey: "trust_in_automation",
    slots: [
      { facet: "reliability_confidence", intent: "Confidence that home automation acts dependably." },
      { facet: "predictability_confidence", intent: "Confidence that automated actions stay predictable." },
      { facet: "delegation_readiness", intent: "Readiness to let the system handle one suitable action." },
    ],
  },
  {
    conceptKey: "der_engagement",
    slots: [
      { facet: "personal_relevance", intent: "Whether DER technologies feel relevant to the household." },
      { facet: "information_seeking", intent: "Interest in learning more about household energy devices." },
      { facet: "adoption_readiness", intent: "Readiness to move toward adopting a DER technology." },
    ],
  },
  {
    conceptKey: "manual_override_need",
    slots: [
      { facet: "immediate_intervention_need", intent: "Need to intervene immediately in an automated action." },
      { facet: "cancel_pause_need", intent: "Need to cancel or pause an ongoing automated action." },
    ],
  },
  {
    conceptKey: "explainability_need",
    slots: [
      { facet: "pre_action_rationale", intent: "Need to know why the system may act before it does." },
      { facet: "post_action_explanation", intent: "Need to know what happened after an automated action." },
    ],
  },
  {
    conceptKey: "bill_stability_need",
    slots: [
      { facet: "monthly_predictability_need", intent: "Need for stable month-to-month energy expenditure." },
      { facet: "high_bill_risk_aversion", intent: "Aversion to unexpectedly high energy costs." },
    ],
  },
  {
    conceptKey: "event_frequency_tolerance",
    slots: [
      { facet: "acceptable_recurrence", intent: "How often flexibility events can happen before becoming too much." },
      { facet: "cumulative_annoyance", intent: "Tolerance for several flexibility events in the same week." },
    ],
  },
  {
    conceptKey: "savings_motivation",
    slots: [
      { facet: "financial_salience", intent: "Importance of bill savings in household energy decisions." },
      { facet: "reward_responsiveness", intent: "Responsiveness to a stated energy-saving reward." },
    ],
  },
  {
    conceptKey: "routine_dependency",
    slots: [
      { facet: "schedule_rigidity", intent: "Difficulty changing the timing of daily household activities." },
      { facet: "deadline_constraint", intent: "Hard timing requirements imposed by household routines." },
    ],
  },
];

function conceptTarget(conceptKey: string) {
  return getFlexpulseBehaviouralConcept(conceptKey)?.schema_target
    ?? `flexpulse_behavioural_schema.${conceptKey}`;
}

function questionKeyFor(conceptKey: string, index: number) {
  return `Q_DQA_${conceptKey.toUpperCase()}_${String(index + 1).padStart(2, "0")}`;
}

function slotKeyFor(conceptKey: string, index: number) {
  return `SLOT_DQA_${conceptKey.toUpperCase()}_${String(index + 1).padStart(2, "0")}`;
}

const HOUSEHOLD_TARIFF_VALUES = [
  "same_price",
  "time_of_use",
  "shift_rewards",
  "dynamic_price",
  "not_sure",
] as const;

function appendHouseholdApplicabilityQuestions(input: {
  questions: SurveyQuestionDefinition[];
  mappings: SurveyMappingDefinition[];
  planEntries: MeasurementPlanEntry[];
  startOrder: number;
}) {
  let order = input.startOrder;
  const interestedKey = questionKeyFor("interested_der_assets", 0);
  input.questions.push({
    question_key: interestedKey,
    type: "multiple_choice",
    required: true,
    order: order++,
    exclusive_option_keys: ["none_of_these", "not_sure"],
    options: [
      ...FLEXPULSE_DER_ASSET_VALUES.map((asset) => ({ option_key: asset, value: asset })),
      { option_key: "none_of_these", value: "none_of_these" },
      { option_key: "not_sure", value: "not_sure" },
    ],
  });
  input.mappings.push({
    question_key: interestedKey,
    ontology_target: conceptTarget("interested_der_assets"),
    expected_type: "string[]",
    required_for_mapping: true,
    transform_strategy: {
      kind: "enum_lookup",
      option_to_value: Object.fromEntries(FLEXPULSE_DER_ASSET_VALUES.map((asset) => [asset, asset])),
    },
    validation_constraints: { allowed_values: [...FLEXPULSE_DER_ASSET_VALUES] },
  });
  input.planEntries.push({
    concept_key: "interested_der_assets",
    evidence_source: "survey_questions",
    measurement_type: "multi_choice_tag_set",
    output_type: "string[]",
    aggregation_rule: "set_union",
    threshold_profile: "asset_inventory",
    minimum_answer_count: 1,
    question_keys: [interestedKey],
    required_question_keys: [interestedKey],
    question_intents: [
      {
        slot_key: slotKeyFor("interested_der_assets", 0),
        question_key: interestedKey,
        facet: "asset_interest",
        intent: "Capture DER assets the household is interested in adopting or using.",
        polarity: "neutral",
      },
    ],
  });

  for (const spec of [
    { conceptKey: "winter_comfort_setpoint_c", min: 14, max: 26 },
    { conceptKey: "summer_comfort_setpoint_c", min: 18, max: 32 },
  ] as const) {
    const questionKey = questionKeyFor(spec.conceptKey, 0);
    input.questions.push({
      question_key: questionKey,
      type: "numeric",
      required: true,
      order: order++,
      numeric: { min: spec.min, max: spec.max, unit: "°C" },
    });
    input.mappings.push({
      question_key: questionKey,
      ontology_target: conceptTarget(spec.conceptKey),
      expected_type: "number",
      required_for_mapping: true,
      transform_strategy: { kind: "numeric_range", min: spec.min, max: spec.max, unit: "celsius" },
      validation_constraints: { min: spec.min, max: spec.max },
    });
    input.planEntries.push({
      concept_key: spec.conceptKey,
      evidence_source: "survey_questions",
      measurement_type: "numeric_direct",
      output_type: "number",
      aggregation_rule: "identity",
      threshold_profile: "none",
      minimum_answer_count: 1,
      question_keys: [questionKey],
      required_question_keys: [questionKey],
      question_intents: [
        {
          slot_key: slotKeyFor(spec.conceptKey, 0),
          question_key: questionKey,
          facet: "setpoint",
          intent: `Capture the household ${spec.conceptKey.replaceAll("_", " ")}.`,
          polarity: "neutral",
        },
      ],
    });
  }

  const tariffKey = questionKeyFor("preferred_tariff_model", 0);
  input.questions.push({
    question_key: tariffKey,
    type: "single_choice",
    required: true,
    order: order++,
    options: HOUSEHOLD_TARIFF_VALUES.map((value) => ({ option_key: value, value })),
  });
  input.mappings.push({
    question_key: tariffKey,
    ontology_target: conceptTarget("preferred_tariff_model"),
    expected_type: "string",
    required_for_mapping: true,
    transform_strategy: {
      kind: "enum_lookup",
      option_to_value: Object.fromEntries(HOUSEHOLD_TARIFF_VALUES.map((value) => [value, value])),
    },
    validation_constraints: { allowed_values: [...HOUSEHOLD_TARIFF_VALUES] },
  });
  input.planEntries.push({
    concept_key: "preferred_tariff_model",
    evidence_source: "survey_questions",
    measurement_type: "single_choice_enum",
    output_type: "enum",
    aggregation_rule: "identity",
    threshold_profile: "none",
    minimum_answer_count: 1,
    question_keys: [tariffKey],
    required_question_keys: [tariffKey],
    question_intents: [
      {
        slot_key: slotKeyFor("preferred_tariff_model", 0),
        question_key: tariffKey,
        facet: "stated_tariff_model",
        intent: "Capture the stated preferred tariff model as a factual household setting.",
        polarity: "neutral",
      },
    ],
  });

  return order;
}

export function buildDashboardQaSurveyFixture(input: {
  surveyId: string;
  ownerUserId: string;
  createdAt: string;
}): PersistedSurvey {
  const definition = createInitialSurveyDefinition("English", ["English", "Spanish", "French"]);
  const mapping = createInitialMappingContract();
  const questions: SurveyQuestionDefinition[] = [];
  const mappings: SurveyMappingDefinition[] = [];
  const planEntries: MeasurementPlanEntry[] = [];
  let order = 1;

  for (const spec of LIKERT_CONCEPTS) {
    const questionKeys: string[] = [];
    spec.slots.forEach((slot, index) => {
      const questionKey = questionKeyFor(spec.conceptKey, index);
      questionKeys.push(questionKey);
      questions.push({
        question_key: questionKey,
        type: "rating_scale",
        required: true,
        order: order++,
        scale: { min: 1, max: 5, step: 1, min_label: "Low", max_label: "High" },
      });
      mappings.push({
        question_key: questionKey,
        ontology_target: conceptTarget(spec.conceptKey),
        expected_type: "number",
        required_for_mapping: true,
        transform_strategy: { kind: "numeric_range", min: 1, max: 5 },
        validation_constraints: { min: 1, max: 5 },
      });
    });
    planEntries.push({
      concept_key: spec.conceptKey,
      evidence_source: "survey_questions",
      measurement_type: spec.slots.length === 1 ? "single_item_direct" : "multi_item_likert_mean",
      output_type: "number",
      aggregation_rule: spec.slots.length === 1 ? "identity" : "mean",
      threshold_profile: "likert_1_5_low_mid_high",
      minimum_answer_count: Math.min(2, spec.slots.length),
      question_keys: questionKeys,
      required_question_keys: questionKeys,
      question_intents: spec.slots.map((slot, index) => ({
        slot_key: slotKeyFor(spec.conceptKey, index),
        question_key: questionKeyFor(spec.conceptKey, index),
        facet: slot.facet,
        intent: slot.intent,
        polarity: "positive",
      })),
    });
  }

  order = appendHouseholdApplicabilityQuestions({
    questions,
    mappings,
    planEntries,
    startOrder: order,
  });

  const dfc = createDeclaredFlexibilityCapabilityDefinitionArtifacts(order);
  questions.push(...dfc.questions);
  mappings.push(...dfc.mappingContract.mappings);
  planEntries.push(...dfc.measurementPlan.concepts);

  definition.questions = questions;
  definition.survey_meta.behavioural_concept_keys = planEntries.map((entry) => entry.concept_key);
  definition.survey_meta.ontology_targets = mappings.map((entry) => entry.ontology_target);
  definition.survey_meta.capability_module_version = "v1";
  definition.survey_meta.measurement_plan_json = {
    schema_version: 1,
    schema_namespace: "flexpulse_behavioural_schema",
    concepts: planEntries,
  };
  definition.survey_meta.response_context = {
    collect_country_code: true,
    collect_postal_code: true,
    enrich_weather_context: true,
  };
  definition.survey_meta.internal_qa = {
    kind: DASHBOARD_QA_FIXTURE_KIND,
    synthetic: true,
  };

  const title = DASHBOARD_QA_SURVEY_NAME;
  for (const language of Object.keys(definition.translations)) {
    definition.translations[language] = {
      survey_title: title,
      survey_description: "Internal synthetic QA data — not participant fieldwork",
      questions: Object.fromEntries(
        questions.map((question) => [
          question.question_key,
          {
            title: question.question_key.replaceAll("_", " "),
            options: Object.fromEntries(
              (question.options ?? []).map((option) => {
                const assetLabel = CANONICAL_DER_ASSET_OPTION_LABELS[language]?.[option.value];
                const tariffLabel = CANONICAL_PREFERRED_TARIFF_OPTION_LABELS[language]?.[option.value];
                return [option.option_key, assetLabel ?? tariffLabel ?? option.value];
              }),
            ),
          },
        ]),
      ),
    };
  }

  mapping.mappings = mappings;
  const mappingHash = computeMappingHash(mapping);
  const measurementHash = computeMeasurementHash(definition.survey_meta.measurement_plan_json);

  return {
    id: input.surveyId,
    name: DASHBOARD_QA_SURVEY_NAME,
    status: "archived",
    created_by: input.ownerUserId,
    created_at: input.createdAt,
    updated_at: input.createdAt,
    published_at: input.createdAt,
    default_language: "English",
    supported_languages: ["English", "Spanish", "French"],
    definition_json: definition,
    mapping_contract_json: mapping,
    mapping_compiled_json: compileMappingContract(mapping),
    mapping_hash: mappingHash,
    measurement_hash: measurementHash,
  };
}

export function isDashboardQaSandboxSurvey(survey: {
  name?: string | null;
  definition_json?: { survey_meta?: { internal_qa?: { kind?: string } } };
}) {
  return (
    survey.name === DASHBOARD_QA_SURVEY_NAME ||
    survey.definition_json?.survey_meta?.internal_qa?.kind === DASHBOARD_QA_FIXTURE_KIND
  );
}
