export type FlexpulseBehaviouralLayer =
  | "profile_axes"
  | "behavioural_modulators"
  | "applicability_and_assets"
  | "response_context"
  | "quality_signals";

export type FlexpulseDescriptorRole =
  | "primary_profile_axis"
  | "behavioural_modulator"
  | "applicability_factor"
  | "context_signal"
  | "quality_signal";

export type FlexpulseDimension =
  | "awareness_of_energy_systems"
  | "flexibility_willingness"
  | "thermal_comfort_norms"
  | "tariff_preferences"
  | "trust_in_automation"
  | "der_engagement"
  | "response_context";

export type FlexpulseOutputType =
  | "number"
  | "boolean"
  | "string"
  | "string[]"
  | "enum";

export type FlexpulseQuestionType =
  | "single_choice"
  | "multiple_choice"
  | "rating_scale"
  | "numeric";

export type FlexpulseMeasurementFamily =
  | "likert_construct"
  | "single_choice_enum"
  | "multi_select_inventory"
  | "binary_applicability"
  | "numeric_preference"
  | "contextual_signal"
  | "quality_flag";

export type FlexpulseAggregationRule =
  | "identity"
  | "median"
  | "mean"
  | "set_union"
  | "context_passthrough";

export type FlexpulseThresholdProfile =
  | "none"
  | "likert_1_5_low_mid_high"
  | "likert_1_5_low_mid_high_strict"
  | "numeric_temperature_window"
  | "enum_identity"
  | "asset_inventory";

export type FlexpulseDownstreamUse =
  | "survey_generation"
  | "response_mapping"
  | "profiling"
  | "dashboarding"
  | "dr_thresholds"
  | "comfort_windows"
  | "regional_strategy";

export type FlexpulseBehaviouralConcept = {
  schema_version: 1;
  namespace: "flexpulse_behavioural_schema";
  concept_key: string;
  schema_target: string;
  label: string;
  description: string;
  layer: FlexpulseBehaviouralLayer;
  descriptor_role: FlexpulseDescriptorRole;
  dimension: FlexpulseDimension;
  output_type: FlexpulseOutputType;
  measurement_family: FlexpulseMeasurementFamily;
  recommended_question_types: FlexpulseQuestionType[];
  minimum_item_count: number;
  recommended_item_count: number;
  default_aggregation_rule: FlexpulseAggregationRule;
  threshold_profile: FlexpulseThresholdProfile;
  validation_constraints?: {
    min?: number;
    max?: number;
    allowed_values?: string[];
  };
  question_strategy_hints: string[];
  interpretation_note: string;
  source_v1_targets: string[];
  downstream_uses: FlexpulseDownstreamUse[];
};

export const FLEXPULSE_DER_ASSET_VALUES = [
  "pv_system",
  "battery_storage",
  "heating_system",
  "ev",
  "inverter",
  "heat_pump",
  "thermal_storage",
  "hot_water_tank",
  "programmable_appliance",
] as const;

export const flexpulseBehaviouralSchemaV1: FlexpulseBehaviouralConcept[] = [
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "awareness_of_energy_systems",
    schema_target: "flexpulse_behavioural_schema.awareness_of_energy_systems",
    label: "Awareness of energy systems",
    description:
      "How well the respondent understands energy systems, energy flexibility and the role of automation in household energy management.",
    layer: "profile_axes",
    descriptor_role: "primary_profile_axis",
    dimension: "awareness_of_energy_systems",
    output_type: "number",
    measurement_family: "likert_construct",
    recommended_question_types: ["rating_scale"],
    minimum_item_count: 2,
    recommended_item_count: 3,
    default_aggregation_rule: "median",
    threshold_profile: "likert_1_5_low_mid_high",
    validation_constraints: {
      min: 1,
      max: 5,
    },
    question_strategy_hints: [
      "Use direct self-report items about understanding of domestic energy systems and flexibility concepts.",
      "Mix general system awareness with awareness of automation or demand response to avoid a single narrow item.",
    ],
    interpretation_note:
      "This is a profile axis because the open call explicitly wants awareness investigated and compared across regional contexts.",
    source_v1_targets: [
      "fp_behaviour_v1.awareness.energy_awareness_level",
      "fp_behaviour_v1.awareness.flexibility_awareness_level",
      "fp_behaviour_v1.awareness.automation_awareness_level",
      "fp_behaviour_v1.awareness.self_reported_knowledge_confidence",
    ],
    downstream_uses: [
      "survey_generation",
      "response_mapping",
      "profiling",
      "dashboarding",
      "regional_strategy",
    ],
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "flexibility_willingness",
    schema_target: "flexpulse_behavioural_schema.flexibility_willingness",
    label: "Flexibility willingness",
    description:
      "Overall willingness to participate in flexibility or demand response programmes under realistic domestic conditions.",
    layer: "profile_axes",
    descriptor_role: "primary_profile_axis",
    dimension: "flexibility_willingness",
    output_type: "number",
    measurement_family: "likert_construct",
    recommended_question_types: ["rating_scale"],
    minimum_item_count: 2,
    recommended_item_count: 3,
    default_aggregation_rule: "median",
    threshold_profile: "likert_1_5_low_mid_high",
    validation_constraints: {
      min: 1,
      max: 5,
    },
    question_strategy_hints: [
      "Use a short battery that asks about general openness to participating in flexibility schemes.",
      "Avoid collapsing conditions or incentives into this construct; those belong in modulators.",
    ],
    interpretation_note:
      "This is one of the main respondent-level outputs because it directly supports participation scores and programme acceptability analysis.",
    source_v1_targets: ["fp_behaviour_v1.flex_willingness.participation_level"],
    downstream_uses: [
      "survey_generation",
      "response_mapping",
      "profiling",
      "dashboarding",
      "dr_thresholds",
      "regional_strategy",
    ],
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "thermal_comfort_norms",
    schema_target: "flexpulse_behavioural_schema.thermal_comfort_norms",
    label: "Thermal comfort norms",
    description:
      "How strict the respondent is about preserving thermal comfort and how much indoor variation they consider acceptable.",
    layer: "profile_axes",
    descriptor_role: "primary_profile_axis",
    dimension: "thermal_comfort_norms",
    output_type: "number",
    measurement_family: "likert_construct",
    recommended_question_types: ["rating_scale"],
    minimum_item_count: 2,
    recommended_item_count: 3,
    default_aggregation_rule: "median",
    threshold_profile: "likert_1_5_low_mid_high_strict",
    validation_constraints: {
      min: 1,
      max: 5,
    },
    question_strategy_hints: [
      "Mix one item about protecting comfort and one item about tolerating thermal variation.",
      "Use this construct to derive comfort windows and behavioural comfort constraints, not just subjective preference.",
    ],
    interpretation_note:
      "This is central because the open call explicitly highlights thermal comfort norms and building-specific comfort windows.",
    source_v1_targets: [
      "fp_behaviour_v1.thermal_comfort.comfort_strictness",
      "fp_behaviour_v1.thermal_comfort.temperature_variation_tolerance",
      "fp_behaviour_v1.thermal_comfort.schedule_flexibility_for_comfort",
      "fp_behaviour_v1.thermal_comfort.night_setback_acceptance",
    ],
    downstream_uses: [
      "survey_generation",
      "response_mapping",
      "profiling",
      "dashboarding",
      "comfort_windows",
      "dr_thresholds",
      "regional_strategy",
    ],
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "tariff_preference_orientation",
    schema_target: "flexpulse_behavioural_schema.tariff_preference_orientation",
    label: "Tariff preference orientation",
    description:
      "Attitudinal orientation toward tariff structures, variability and risk when deciding whether flexibility feels acceptable.",
    layer: "profile_axes",
    descriptor_role: "primary_profile_axis",
    dimension: "tariff_preferences",
    output_type: "number",
    measurement_family: "likert_construct",
    recommended_question_types: ["rating_scale"],
    minimum_item_count: 2,
    recommended_item_count: 3,
    default_aggregation_rule: "median",
    threshold_profile: "likert_1_5_low_mid_high",
    validation_constraints: {
      min: 1,
      max: 5,
    },
    question_strategy_hints: [
      "Focus on tolerance for variability and uncertainty, not only on declared preferred tariff labels.",
      "Keep price-saving motivation separate as a behavioural modulator.",
    ],
    interpretation_note:
      "This axis is better for profiling than the old flat list because it captures behavioural orientation toward tariffs, not just tariff labels.",
    source_v1_targets: [
      "fp_behaviour_v1.tariff_preferences.bill_variability_tolerance",
      "fp_behaviour_v1.tariff_preferences.risk_aversion_level",
      "fp_behaviour_v1.tariff_preferences.incentive_sensitivity",
    ],
    downstream_uses: [
      "survey_generation",
      "response_mapping",
      "profiling",
      "dashboarding",
      "regional_strategy",
    ],
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "trust_in_automation",
    schema_target: "flexpulse_behavioural_schema.trust_in_automation",
    label: "Trust in automation",
    description:
      "The respondent's readiness to trust automated control in residential energy management under realistic safeguards.",
    layer: "profile_axes",
    descriptor_role: "primary_profile_axis",
    dimension: "trust_in_automation",
    output_type: "number",
    measurement_family: "likert_construct",
    recommended_question_types: ["rating_scale"],
    minimum_item_count: 2,
    recommended_item_count: 3,
    default_aggregation_rule: "median",
    threshold_profile: "likert_1_5_low_mid_high",
    validation_constraints: {
      min: 1,
      max: 5,
    },
    question_strategy_hints: [
      "Use a compact battery that measures general trust, not only conditions or boundaries.",
      "Treat override, explainability and bill protection as modulators around trust, not substitutes for trust itself.",
    ],
    interpretation_note:
      "This is a core axis because trust in automation is explicitly central to the product and to socially acceptable flexibility adoption.",
    source_v1_targets: ["fp_behaviour_v1.trust_automation.automation_trust_level"],
    downstream_uses: [
      "survey_generation",
      "response_mapping",
      "profiling",
      "dashboarding",
      "dr_thresholds",
      "regional_strategy",
    ],
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "der_engagement",
    schema_target: "flexpulse_behavioural_schema.der_engagement",
    label: "DER engagement",
    description:
      "General behavioural engagement with distributed energy resources, including openness to using, adopting and flexibly operating DER-relevant assets.",
    layer: "profile_axes",
    descriptor_role: "primary_profile_axis",
    dimension: "der_engagement",
    output_type: "number",
    measurement_family: "likert_construct",
    recommended_question_types: ["rating_scale"],
    minimum_item_count: 2,
    recommended_item_count: 3,
    default_aggregation_rule: "median",
    threshold_profile: "likert_1_5_low_mid_high",
    validation_constraints: {
      min: 1,
      max: 5,
    },
    question_strategy_hints: [
      "Measure openness to engaging with controllable or flexible assets as a class.",
      "Keep inventory of actual assets separate from this attitudinal readiness axis.",
    ],
    interpretation_note:
      "This axis operationalizes the open-call interest in DER engagement without tying the schema to any single device.",
    source_v1_targets: [
      "fp_behaviour_v1.device_engagement.device_control_readiness",
      "fp_behaviour_v1.device_engagement.device_familiarity",
      "fp_behaviour_v1.device_engagement.smart_appliance_readiness",
      "fp_behaviour_v1.device_engagement.ev_control_readiness",
      "fp_behaviour_v1.device_engagement.heat_pump_control_readiness",
    ],
    downstream_uses: [
      "survey_generation",
      "response_mapping",
      "profiling",
      "dashboarding",
      "dr_thresholds",
      "regional_strategy",
    ],
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "manual_override_need",
    schema_target: "flexpulse_behavioural_schema.manual_override_need",
    label: "Manual override need",
    description:
      "How important manual override capability is before automated energy control feels acceptable.",
    layer: "behavioural_modulators",
    descriptor_role: "behavioural_modulator",
    dimension: "trust_in_automation",
    output_type: "number",
    measurement_family: "likert_construct",
    recommended_question_types: ["rating_scale"],
    minimum_item_count: 1,
    recommended_item_count: 1,
    default_aggregation_rule: "identity",
    threshold_profile: "likert_1_5_low_mid_high",
    validation_constraints: { min: 1, max: 5 },
    question_strategy_hints: [
      "Ask directly whether manual override is necessary for acceptance of automated control.",
    ],
    interpretation_note:
      "This is a modulator because it explains the shape and conditions of trust rather than serving as the trust axis itself.",
    source_v1_targets: ["fp_behaviour_v1.trust_automation.manual_override_need"],
    downstream_uses: ["survey_generation", "response_mapping", "profiling", "dashboarding"],
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "explainability_need",
    schema_target: "flexpulse_behavioural_schema.explainability_need",
    label: "Explainability need",
    description:
      "How strongly the respondent needs transparent explanations before trusting automated control.",
    layer: "behavioural_modulators",
    descriptor_role: "behavioural_modulator",
    dimension: "trust_in_automation",
    output_type: "number",
    measurement_family: "likert_construct",
    recommended_question_types: ["rating_scale"],
    minimum_item_count: 1,
    recommended_item_count: 1,
    default_aggregation_rule: "identity",
    threshold_profile: "likert_1_5_low_mid_high",
    validation_constraints: { min: 1, max: 5 },
    question_strategy_hints: [
      "Ask about the need for understandable explanations or visibility into automation decisions.",
    ],
    interpretation_note:
      "This remains a modulator because it refines automation trust and helps tailor communication strategies.",
    source_v1_targets: ["fp_behaviour_v1.trust_automation.explainability_need"],
    downstream_uses: [
      "survey_generation",
      "response_mapping",
      "profiling",
      "dashboarding",
      "regional_strategy",
    ],
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "bill_stability_need",
    schema_target: "flexpulse_behavioural_schema.bill_stability_need",
    label: "Bill stability need",
    description:
      "How important it is for the respondent to protect against unstable or unpredictable bills before adopting flexibility or automation.",
    layer: "behavioural_modulators",
    descriptor_role: "behavioural_modulator",
    dimension: "tariff_preferences",
    output_type: "number",
    measurement_family: "likert_construct",
    recommended_question_types: ["rating_scale"],
    minimum_item_count: 1,
    recommended_item_count: 1,
    default_aggregation_rule: "identity",
    threshold_profile: "likert_1_5_low_mid_high",
    validation_constraints: { min: 1, max: 5 },
    question_strategy_hints: [
      "Ask whether predictable bills or protection against adverse billing outcomes are required.",
    ],
    interpretation_note:
      "This is a modulator because it constrains tariff and automation acceptance without replacing those primary axes.",
    source_v1_targets: ["fp_behaviour_v1.trust_automation.bill_protection_need"],
    downstream_uses: [
      "survey_generation",
      "response_mapping",
      "profiling",
      "dashboarding",
      "regional_strategy",
    ],
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "event_frequency_tolerance",
    schema_target: "flexpulse_behavioural_schema.event_frequency_tolerance",
    label: "Event frequency tolerance",
    description:
      "How often flexibility events can happen before the programme feels intrusive or unacceptable.",
    layer: "behavioural_modulators",
    descriptor_role: "behavioural_modulator",
    dimension: "flexibility_willingness",
    output_type: "number",
    measurement_family: "likert_construct",
    recommended_question_types: ["rating_scale"],
    minimum_item_count: 1,
    recommended_item_count: 1,
    default_aggregation_rule: "identity",
    threshold_profile: "likert_1_5_low_mid_high",
    validation_constraints: { min: 1, max: 5 },
    question_strategy_hints: [
      "Ask directly about tolerance for how often flexibility events or interventions may occur.",
    ],
    interpretation_note:
      "This is a modulator because it helps turn willingness into operational programme design but is narrower than the willingness axis.",
    source_v1_targets: ["fp_behaviour_v1.flex_willingness.event_frequency_tolerance"],
    downstream_uses: [
      "survey_generation",
      "response_mapping",
      "profiling",
      "dashboarding",
      "dr_thresholds",
    ],
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "savings_motivation",
    schema_target: "flexpulse_behavioural_schema.savings_motivation",
    label: "Savings motivation",
    description:
      "How strongly bill savings motivate the respondent to consider flexibility or new tariff arrangements.",
    layer: "behavioural_modulators",
    descriptor_role: "behavioural_modulator",
    dimension: "tariff_preferences",
    output_type: "number",
    measurement_family: "likert_construct",
    recommended_question_types: ["rating_scale"],
    minimum_item_count: 1,
    recommended_item_count: 1,
    default_aggregation_rule: "identity",
    threshold_profile: "likert_1_5_low_mid_high",
    validation_constraints: { min: 1, max: 5 },
    question_strategy_hints: [
      "Keep this explicitly about savings motivation, not broader tariff risk orientation.",
    ],
    interpretation_note:
      "This belongs in modulators because it explains why a respondent may accept flexibility without being a core axis itself.",
    source_v1_targets: ["fp_behaviour_v1.tariff_preferences.price_saving_motivation"],
    downstream_uses: ["survey_generation", "response_mapping", "profiling", "dashboarding"],
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "routine_dependency",
    schema_target: "flexpulse_behavioural_schema.routine_dependency",
    label: "Routine dependency",
    description:
      "How strongly daily routines depend on devices or comfort patterns that could be affected by flexibility programmes.",
    layer: "behavioural_modulators",
    descriptor_role: "behavioural_modulator",
    dimension: "der_engagement",
    output_type: "number",
    measurement_family: "likert_construct",
    recommended_question_types: ["rating_scale"],
    minimum_item_count: 1,
    recommended_item_count: 2,
    default_aggregation_rule: "median",
    threshold_profile: "likert_1_5_low_mid_high",
    validation_constraints: { min: 1, max: 5 },
    question_strategy_hints: [
      "Ask about routine dependence on key devices and comfort-maintaining routines that limit flexibility.",
    ],
    interpretation_note:
      "This is a cross-cutting modulator because it shapes both device engagement and comfort-related willingness.",
    source_v1_targets: [
      "fp_behaviour_v1.device_engagement.device_usage_dependence",
      "fp_behaviour_v1.device_engagement.heat_pump_comfort_dependency",
    ],
    downstream_uses: [
      "survey_generation",
      "response_mapping",
      "profiling",
      "dashboarding",
      "dr_thresholds",
      "comfort_windows",
    ],
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "owned_der_assets",
    schema_target: "flexpulse_behavioural_schema.owned_der_assets",
    label: "Owned DER assets",
    description:
      "The set of DER-relevant assets or devices currently present in the home or routinely used by the respondent.",
    layer: "applicability_and_assets",
    descriptor_role: "applicability_factor",
    dimension: "der_engagement",
    output_type: "string[]",
    measurement_family: "multi_select_inventory",
    recommended_question_types: ["multiple_choice"],
    minimum_item_count: 1,
    recommended_item_count: 1,
    default_aggregation_rule: "set_union",
    threshold_profile: "asset_inventory",
    validation_constraints: {
      allowed_values: [...FLEXPULSE_DER_ASSET_VALUES],
    },
    question_strategy_hints: [
      "Use a closed multi-select inventory.",
      "Ensure the option list covers PV systems, battery storage, heating systems, EVs, inverters, heat pumps, thermal storage, hot water tanks and programmable appliances.",
    ],
    interpretation_note:
      "This replaces several narrow ownership booleans with one inventory concept better aligned with the open-call device list.",
    source_v1_targets: [
      "fp_behaviour_v1.device_engagement.owned_devices",
      "fp_behaviour_v1.device_engagement.ev_ownership",
      "fp_behaviour_v1.device_engagement.heat_pump_ownership",
      "fp_behaviour_v1.device_engagement.battery_ownership",
      "fp_behaviour_v1.device_engagement.pv_ownership",
    ],
    downstream_uses: [
      "survey_generation",
      "response_mapping",
      "profiling",
      "dashboarding",
      "dr_thresholds",
    ],
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "interested_der_assets",
    schema_target: "flexpulse_behavioural_schema.interested_der_assets",
    label: "Interested DER assets",
    description:
      "The set of DER-relevant assets or device types the respondent is interested in adopting or engaging with in the future.",
    layer: "applicability_and_assets",
    descriptor_role: "applicability_factor",
    dimension: "der_engagement",
    output_type: "string[]",
    measurement_family: "multi_select_inventory",
    recommended_question_types: ["multiple_choice"],
    minimum_item_count: 1,
    recommended_item_count: 1,
    default_aggregation_rule: "set_union",
    threshold_profile: "asset_inventory",
    validation_constraints: {
      allowed_values: [...FLEXPULSE_DER_ASSET_VALUES],
    },
    question_strategy_hints: [
      "Use the same normalized device vocabulary as the owned-assets inventory.",
    ],
    interpretation_note:
      "This captures future-facing applicability and engagement potential without inflating the core engagement axis.",
    source_v1_targets: ["fp_behaviour_v1.device_engagement.interested_devices"],
    downstream_uses: ["survey_generation", "response_mapping", "profiling", "dashboarding"],
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "winter_comfort_setpoint_c",
    schema_target: "flexpulse_behavioural_schema.winter_comfort_setpoint_c",
    label: "Winter comfort setpoint",
    description:
      "Preferred winter indoor temperature setpoint used as a factual comfort anchor for building-specific threshold reasoning.",
    layer: "applicability_and_assets",
    descriptor_role: "applicability_factor",
    dimension: "thermal_comfort_norms",
    output_type: "number",
    measurement_family: "numeric_preference",
    recommended_question_types: ["numeric"],
    minimum_item_count: 1,
    recommended_item_count: 1,
    default_aggregation_rule: "identity",
    threshold_profile: "numeric_temperature_window",
    validation_constraints: {
      min: 14,
      max: 26,
    },
    question_strategy_hints: [
      "Ask for a realistic indoor comfort setpoint in winter using numeric input in degrees Celsius.",
    ],
    interpretation_note:
      "This is not a profile axis; it is a factual anchor that helps derive comfort windows and building-specific DR thresholds.",
    source_v1_targets: ["fp_behaviour_v1.thermal_comfort.winter_setpoint_c"],
    downstream_uses: [
      "survey_generation",
      "response_mapping",
      "comfort_windows",
      "dr_thresholds",
    ],
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "summer_comfort_setpoint_c",
    schema_target: "flexpulse_behavioural_schema.summer_comfort_setpoint_c",
    label: "Summer comfort setpoint",
    description:
      "Preferred summer indoor temperature setpoint used as a factual comfort anchor for flexibility reasoning in warmer periods.",
    layer: "applicability_and_assets",
    descriptor_role: "applicability_factor",
    dimension: "thermal_comfort_norms",
    output_type: "number",
    measurement_family: "numeric_preference",
    recommended_question_types: ["numeric"],
    minimum_item_count: 1,
    recommended_item_count: 1,
    default_aggregation_rule: "identity",
    threshold_profile: "numeric_temperature_window",
    validation_constraints: {
      min: 18,
      max: 32,
    },
    question_strategy_hints: [
      "Ask for a realistic indoor comfort setpoint in summer using numeric input in degrees Celsius.",
    ],
    interpretation_note:
      "Like the winter setpoint, this is factual input that supports comfort windows and contextual interpretation rather than profile scoring.",
    source_v1_targets: ["fp_behaviour_v1.thermal_comfort.summer_setpoint_c"],
    downstream_uses: [
      "survey_generation",
      "response_mapping",
      "comfort_windows",
      "dr_thresholds",
    ],
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "preferred_tariff_model",
    schema_target: "flexpulse_behavioural_schema.preferred_tariff_model",
    label: "Preferred tariff model",
    description:
      "The tariff model the respondent currently prefers when thinking about energy bills and flexibility participation.",
    layer: "applicability_and_assets",
    descriptor_role: "applicability_factor",
    dimension: "tariff_preferences",
    output_type: "enum",
    measurement_family: "single_choice_enum",
    recommended_question_types: ["single_choice"],
    minimum_item_count: 1,
    recommended_item_count: 1,
    default_aggregation_rule: "identity",
    threshold_profile: "enum_identity",
    question_strategy_hints: [
      "Use a closed single choice question with normalized tariff categories such as fixed, dynamic or hybrid.",
    ],
    interpretation_note:
      "This is a factual preference descriptor, not the main tariff orientation axis.",
    source_v1_targets: ["fp_behaviour_v1.tariff_preferences.preferred_tariff_model"],
    downstream_uses: ["survey_generation", "response_mapping", "profiling", "dashboarding"],
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "country_code",
    schema_target: "flexpulse_behavioural_schema.country_code",
    label: "Country code",
    description:
      "Normalized country code associated with the response for regional comparison and policy stratification.",
    layer: "response_context",
    descriptor_role: "context_signal",
    dimension: "response_context",
    output_type: "string",
    measurement_family: "contextual_signal",
    recommended_question_types: ["single_choice"],
    minimum_item_count: 1,
    recommended_item_count: 1,
    default_aggregation_rule: "context_passthrough",
    threshold_profile: "none",
    question_strategy_hints: [
      "Prefer collecting this as controlled response context rather than free text.",
    ],
    interpretation_note:
      "This is context only; it exists to support local and regional strategy comparisons, not behavioural scoring.",
    source_v1_targets: ["fp_behaviour_v1.response_context.country_code"],
    downstream_uses: ["response_mapping", "profiling", "dashboarding", "regional_strategy"],
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "normalized_location_context",
    schema_target: "flexpulse_behavioural_schema.normalized_location_context",
    label: "Normalized location context",
    description:
      "Privacy-preserving normalized location context retained at a suitable granularity for clustering, regional analysis and map aggregation.",
    layer: "response_context",
    descriptor_role: "context_signal",
    dimension: "response_context",
    output_type: "string",
    measurement_family: "contextual_signal",
    recommended_question_types: ["single_choice"],
    minimum_item_count: 1,
    recommended_item_count: 1,
    default_aggregation_rule: "context_passthrough",
    threshold_profile: "none",
    question_strategy_hints: [
      "This should normally be produced by normalization and enrichment rather than asked as open text.",
    ],
    interpretation_note:
      "This concept keeps the schema ready for regional clustering and map analytics without making exact postal codes the final product descriptor.",
    source_v1_targets: [
      "fp_behaviour_v1.response_context.region_code",
      "fp_behaviour_v1.response_context.country_code",
    ],
    downstream_uses: ["response_mapping", "dashboarding", "regional_strategy"],
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "climate_context",
    schema_target: "flexpulse_behavioural_schema.climate_context",
    label: "Climate context",
    description:
      "Normalized climate and season context associated with the response, used to interpret comfort and flexibility answers across local climate settings.",
    layer: "response_context",
    descriptor_role: "context_signal",
    dimension: "response_context",
    output_type: "enum",
    measurement_family: "contextual_signal",
    recommended_question_types: ["single_choice"],
    minimum_item_count: 1,
    recommended_item_count: 1,
    default_aggregation_rule: "context_passthrough",
    threshold_profile: "none",
    question_strategy_hints: [
      "This should come from weather and location enrichment, not from free-text respondent interpretation.",
    ],
    interpretation_note:
      "The open call explicitly mentions tailoring by local climate contexts, so this context layer is part of the final descriptor even though it is not surveyed as an attitude.",
    source_v1_targets: [
      "fp_behaviour_v1.environment_context.outdoor_temperature_c",
      "fp_behaviour_v1.environment_context.apparent_temperature_c",
      "fp_behaviour_v1.environment_context.seasonal_context",
      "fp_behaviour_v1.environment_context.climate_zone_normalized",
    ],
    downstream_uses: [
      "response_mapping",
      "profiling",
      "dashboarding",
      "comfort_windows",
      "regional_strategy",
    ],
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "survey_language",
    schema_target: "flexpulse_behavioural_schema.survey_language",
    label: "Survey language",
    description:
      "Language in which the response was completed, retained for multilingual analysis and translation-quality checks.",
    layer: "response_context",
    descriptor_role: "context_signal",
    dimension: "response_context",
    output_type: "string",
    measurement_family: "contextual_signal",
    recommended_question_types: ["single_choice"],
    minimum_item_count: 1,
    recommended_item_count: 1,
    default_aggregation_rule: "context_passthrough",
    threshold_profile: "none",
    question_strategy_hints: [
      "Treat this as response metadata, not as a behavioural outcome.",
    ],
    interpretation_note:
      "This helps compare multilingual deployments and validate translation-driven differences without confusing language with behaviour.",
    source_v1_targets: ["fp_behaviour_v1.response_context.language_code"],
    downstream_uses: ["response_mapping", "dashboarding", "regional_strategy"],
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "mapping_low_confidence",
    schema_target: "flexpulse_behavioural_schema.mapping_low_confidence",
    label: "Mapping low confidence",
    description:
      "Quality flag indicating that the final mapped descriptor should be treated cautiously or reviewed.",
    layer: "quality_signals",
    descriptor_role: "quality_signal",
    dimension: "response_context",
    output_type: "boolean",
    measurement_family: "quality_flag",
    recommended_question_types: ["single_choice"],
    minimum_item_count: 1,
    recommended_item_count: 1,
    default_aggregation_rule: "context_passthrough",
    threshold_profile: "none",
    question_strategy_hints: [
      "Never ask this directly; it is produced by the mapping pipeline.",
    ],
    interpretation_note:
      "Quality signals belong in the final descriptor but must remain separated from behavioural meaning.",
    source_v1_targets: ["fp_behaviour_v1.mapping_quality.low_confidence"],
    downstream_uses: ["response_mapping", "dashboarding"],
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "mapping_requires_review",
    schema_target: "flexpulse_behavioural_schema.mapping_requires_review",
    label: "Mapping requires review",
    description:
      "Quality flag indicating that a response needs manual or secondary review before being treated as fully reliable.",
    layer: "quality_signals",
    descriptor_role: "quality_signal",
    dimension: "response_context",
    output_type: "boolean",
    measurement_family: "quality_flag",
    recommended_question_types: ["single_choice"],
    minimum_item_count: 1,
    recommended_item_count: 1,
    default_aggregation_rule: "context_passthrough",
    threshold_profile: "none",
    question_strategy_hints: [
      "Never ask this directly; it is emitted by the processing layer.",
    ],
    interpretation_note:
      "This remains outside behavioural interpretation but is essential for auditable response mapping.",
    source_v1_targets: ["fp_behaviour_v1.mapping_quality.requires_review"],
    downstream_uses: ["response_mapping", "dashboarding"],
  },
];

export const flexpulseBehaviouralConceptsByKey = Object.fromEntries(
  flexpulseBehaviouralSchemaV1.map((concept) => [concept.concept_key, concept]),
) satisfies Record<string, FlexpulseBehaviouralConcept>;

export const flexpulseSurveyDesignConcepts = flexpulseBehaviouralSchemaV1.filter(
  (concept) =>
    concept.layer === "profile_axes" ||
    concept.layer === "behavioural_modulators" ||
    concept.layer === "applicability_and_assets",
);

export const flexpulseSurveyDesignDimensions = Array.from(
  new Set(flexpulseSurveyDesignConcepts.map((concept) => concept.dimension)),
);

export const flexpulseSurveyDesignConceptsByDimension =
  flexpulseSurveyDesignDimensions.map((dimension) => ({
    dimension,
    concepts: flexpulseSurveyDesignConcepts.filter(
      (concept) => concept.dimension === dimension,
    ),
  }));

export const flexpulsePrimaryProfileAxes = flexpulseBehaviouralSchemaV1.filter(
  (concept) => concept.descriptor_role === "primary_profile_axis",
);

export const flexpulseBehaviouralModulators = flexpulseBehaviouralSchemaV1.filter(
  (concept) => concept.descriptor_role === "behavioural_modulator",
);

export const flexpulseApplicabilityFactors = flexpulseBehaviouralSchemaV1.filter(
  (concept) => concept.descriptor_role === "applicability_factor",
);

export const flexpulseResponseContextConcepts = flexpulseBehaviouralSchemaV1.filter(
  (concept) => concept.descriptor_role === "context_signal",
);

export const flexpulseQualitySignals = flexpulseBehaviouralSchemaV1.filter(
  (concept) => concept.descriptor_role === "quality_signal",
);

export function getFlexpulseBehaviouralConcept(conceptKey: string) {
  return flexpulseBehaviouralConceptsByKey[conceptKey] ?? null;
}

export function deriveSchemaTargetsFromBehaviouralConceptKeys(conceptKeys: string[]) {
  return Array.from(
    new Set(
      conceptKeys.map((conceptKey) => {
        const concept = getFlexpulseBehaviouralConcept(conceptKey);
        if (!concept) {
          throw new Error(`Unknown FlexPulse behavioural concept "${conceptKey}".`);
        }
        return concept.schema_target;
      }),
    ),
  );
}

export const flexpulseBehaviouralConceptsByTarget = Object.fromEntries(
  flexpulseBehaviouralSchemaV1.map((concept) => [concept.schema_target, concept]),
) satisfies Record<string, FlexpulseBehaviouralConcept>;

export function getFlexpulseBehaviouralConceptByTarget(schemaTarget: string) {
  return flexpulseBehaviouralConceptsByTarget[schemaTarget] ?? null;
}
