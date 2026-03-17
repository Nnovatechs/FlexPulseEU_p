export type BehaviourOntologyBlock =
  | "response_context"
  | "environment_context"
  | "awareness"
  | "flex_willingness"
  | "thermal_comfort"
  | "trust_automation"
  | "tariff_preferences"
  | "device_engagement"
  | "mapping_quality";

export type OntologyValueType =
  | "string"
  | "number"
  | "boolean"
  | "string[]"
  | "ordinal_1_5"
  | "timestamp"
  | "enum";

export type OntologyConceptDefinition = {
  namespace: "fp_behaviour_v1";
  block: BehaviourOntologyBlock;
  attribute: string;
  value_type: OntologyValueType;
  description: string;
};

export const fpBehaviourV1Concepts: OntologyConceptDefinition[] = [
  {
    namespace: "fp_behaviour_v1",
    block: "response_context",
    attribute: "region_code",
    value_type: "string",
    description: "Normalized region identifier used for aggregation and comparison.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "response_context",
    attribute: "country_code",
    value_type: "string",
    description: "Normalized country code associated with the response.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "response_context",
    attribute: "language_code",
    value_type: "string",
    description: "Language in which the response was completed.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "response_context",
    attribute: "respondent_segment",
    value_type: "enum",
    description: "High-level respondent segment used for comparisons.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "response_context",
    attribute: "completeness_score",
    value_type: "number",
    description: "Completeness indicator for the response.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "response_context",
    attribute: "response_timestamp",
    value_type: "timestamp",
    description: "Timestamp of the recorded response event.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "environment_context",
    attribute: "outdoor_temperature_c",
    value_type: "number",
    description: "Outdoor temperature associated with the response event.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "environment_context",
    attribute: "apparent_temperature_c",
    value_type: "number",
    description: "Perceived outdoor temperature associated with the response event.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "environment_context",
    attribute: "seasonal_context",
    value_type: "enum",
    description: "Normalized seasonal context derived from response timing and location.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "environment_context",
    attribute: "extreme_heat_flag",
    value_type: "boolean",
    description: "Flag indicating unusually high heat conditions during the response.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "environment_context",
    attribute: "extreme_cold_flag",
    value_type: "boolean",
    description: "Flag indicating unusually cold conditions during the response.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "environment_context",
    attribute: "climate_zone_normalized",
    value_type: "enum",
    description: "Normalized climate-zone label retained after enrichment.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "environment_context",
    attribute: "weather_context_quality",
    value_type: "enum",
    description: "Quality indicator for weather enrichment confidence.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "awareness",
    attribute: "energy_awareness_level",
    value_type: "ordinal_1_5",
    description: "Self-reported awareness of domestic energy topics.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "awareness",
    attribute: "flexibility_awareness_level",
    value_type: "ordinal_1_5",
    description: "Self-reported awareness of energy flexibility concepts.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "awareness",
    attribute: "automation_awareness_level",
    value_type: "ordinal_1_5",
    description: "Self-reported awareness of automation in energy management.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "awareness",
    attribute: "self_reported_knowledge_confidence",
    value_type: "ordinal_1_5",
    description: "Confidence in the respondent's own understanding of the topic.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "flex_willingness",
    attribute: "participation_level",
    value_type: "ordinal_1_5",
    description: "Overall willingness to participate in flexibility programmes.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "flex_willingness",
    attribute: "participation_conditions",
    value_type: "string[]",
    description: "Conditions under which flexibility participation becomes acceptable.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "flex_willingness",
    attribute: "participation_barriers",
    value_type: "string[]",
    description: "Main barriers to participating in flexibility programmes.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "flex_willingness",
    attribute: "participation_motivators",
    value_type: "string[]",
    description: "Main motivators that increase participation interest.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "flex_willingness",
    attribute: "event_frequency_tolerance",
    value_type: "ordinal_1_5",
    description: "Tolerance for how often flexibility events may occur.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "thermal_comfort",
    attribute: "winter_setpoint_c",
    value_type: "number",
    description: "Preferred winter indoor temperature setpoint.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "thermal_comfort",
    attribute: "summer_setpoint_c",
    value_type: "number",
    description: "Preferred summer indoor temperature setpoint.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "thermal_comfort",
    attribute: "comfort_strictness",
    value_type: "ordinal_1_5",
    description: "How strict the respondent is about preserving thermal comfort.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "thermal_comfort",
    attribute: "temperature_variation_tolerance",
    value_type: "ordinal_1_5",
    description: "Tolerance for indoor temperature variation during control events.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "thermal_comfort",
    attribute: "schedule_flexibility_for_comfort",
    value_type: "ordinal_1_5",
    description: "Flexibility around comfort-related schedules and routines.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "thermal_comfort",
    attribute: "night_setback_acceptance",
    value_type: "ordinal_1_5",
    description: "Acceptance of night setback or similar thermal strategies.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "trust_automation",
    attribute: "automation_trust_level",
    value_type: "ordinal_1_5",
    description: "Degree of trust in automated energy management actions.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "trust_automation",
    attribute: "automation_acceptance_scope",
    value_type: "string[]",
    description: "Which automation actions or domains the respondent accepts.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "trust_automation",
    attribute: "automation_conditions",
    value_type: "string[]",
    description: "Conditions required for automation acceptance.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "trust_automation",
    attribute: "manual_override_need",
    value_type: "ordinal_1_5",
    description: "Need for manual override capability when automation is active.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "trust_automation",
    attribute: "explainability_need",
    value_type: "ordinal_1_5",
    description: "Need for explanations and transparency in automation decisions.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "trust_automation",
    attribute: "bill_protection_need",
    value_type: "ordinal_1_5",
    description: "Need for billing protection before accepting automation.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "tariff_preferences",
    attribute: "preferred_tariff_model",
    value_type: "enum",
    description: "Preferred tariff model, such as fixed, dynamic, or hybrid.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "tariff_preferences",
    attribute: "bill_variability_tolerance",
    value_type: "ordinal_1_5",
    description: "Tolerance for changes and variability in the energy bill.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "tariff_preferences",
    attribute: "price_saving_motivation",
    value_type: "ordinal_1_5",
    description: "Importance of bill savings as a motivation factor.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "tariff_preferences",
    attribute: "risk_aversion_level",
    value_type: "ordinal_1_5",
    description: "Level of aversion to tariff and price-related uncertainty.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "tariff_preferences",
    attribute: "incentive_sensitivity",
    value_type: "ordinal_1_5",
    description: "Sensitivity to monetary or contractual incentives.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "device_engagement",
    attribute: "owned_devices",
    value_type: "string[]",
    description: "Devices already owned by the respondent.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "device_engagement",
    attribute: "interested_devices",
    value_type: "string[]",
    description: "Devices the respondent is interested in adopting.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "device_engagement",
    attribute: "device_familiarity",
    value_type: "ordinal_1_5",
    description: "Overall familiarity with relevant distributed energy devices.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "device_engagement",
    attribute: "device_control_readiness",
    value_type: "ordinal_1_5",
    description: "General readiness to allow managed control of household devices.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "device_engagement",
    attribute: "device_usage_dependence",
    value_type: "ordinal_1_5",
    description: "How strongly daily routines depend on the relevant devices.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "device_engagement",
    attribute: "ev_ownership",
    value_type: "boolean",
    description: "Whether the respondent currently owns or uses an EV.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "device_engagement",
    attribute: "ev_control_readiness",
    value_type: "ordinal_1_5",
    description: "Willingness to allow managed control of EV charging.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "device_engagement",
    attribute: "ev_charging_flexibility",
    value_type: "ordinal_1_5",
    description: "Tolerance for flexible timing of EV charging sessions.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "device_engagement",
    attribute: "heat_pump_ownership",
    value_type: "boolean",
    description: "Whether the respondent currently owns or uses a heat pump.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "device_engagement",
    attribute: "heat_pump_control_readiness",
    value_type: "ordinal_1_5",
    description: "Willingness to allow managed control of a heat pump.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "device_engagement",
    attribute: "heat_pump_comfort_dependency",
    value_type: "ordinal_1_5",
    description: "Extent to which comfort routines depend on heat pump behaviour.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "device_engagement",
    attribute: "battery_ownership",
    value_type: "boolean",
    description: "Whether the respondent owns or uses a battery system.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "device_engagement",
    attribute: "pv_ownership",
    value_type: "boolean",
    description: "Whether the respondent owns or uses photovoltaic generation.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "device_engagement",
    attribute: "smart_appliance_readiness",
    value_type: "ordinal_1_5",
    description: "Readiness to allow flexible or automated operation of smart appliances.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "mapping_quality",
    attribute: "low_confidence",
    value_type: "boolean",
    description: "Flag indicating low confidence in semantic interpretation.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "mapping_quality",
    attribute: "ambiguous_answer",
    value_type: "boolean",
    description: "Flag indicating that the response was ambiguous for mapping.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "mapping_quality",
    attribute: "out_of_scope",
    value_type: "boolean",
    description: "Flag indicating that the response falls outside the ontology scope.",
  },
  {
    namespace: "fp_behaviour_v1",
    block: "mapping_quality",
    attribute: "requires_review",
    value_type: "boolean",
    description: "Flag indicating that manual review is recommended.",
  },
];

export function buildOntologyTarget(
  block: BehaviourOntologyBlock,
  attribute: string,
) {
  return `fp_behaviour_v1.${block}.${attribute}`;
}

export const fpBehaviourV1Targets = fpBehaviourV1Concepts.map((concept) =>
  buildOntologyTarget(concept.block, concept.attribute),
);
