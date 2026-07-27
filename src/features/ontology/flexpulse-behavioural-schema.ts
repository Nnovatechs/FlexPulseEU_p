export type FlexpulseConceptRole =
  | "primary_profile_axis"
  | "behavioural_modulator"
  | "applicability_factor"
  | "context_signal"
  | "quality_signal";

export type FlexpulseDimension =
  | "awareness_of_energy_systems"
  | "flexibility_willingness"
  | "flexibility_capability"
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

export type FlexpulseBehaviouralConcept = {
  schema_version: 1;
  namespace: "flexpulse_behavioural_schema";
  concept_key: string;
  schema_target: string;
  label: string;
  description: string;
  concept_role: FlexpulseConceptRole;
  dimension: FlexpulseDimension;
  output_type: FlexpulseOutputType;
  validation_constraints?: {
    min?: number;
    max?: number;
    allowed_values?: string[];
  };
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
  "washing_machine",
  "air_conditioning",
] as const;

export const flexpulseBehaviouralSchemaV1: FlexpulseBehaviouralConcept[] = [
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "awareness_of_energy_systems",
    schema_target: "flexpulse_behavioural_schema.awareness_of_energy_systems",
    label: "Awareness of energy systems",
    description:
      "Self-reported recognition of household energy-flexibility mechanisms, including time-varying demand or prices, shiftable loads, system consequences, and the scope and limits of automation.",
    concept_role: "primary_profile_axis",
    dimension: "awareness_of_energy_systems",
    output_type: "number",
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "flexibility_willingness",
    schema_target: "flexpulse_behavioural_schema.flexibility_willingness",
    label: "Flexibility willingness",
    description:
      "Declared readiness to consent to or participate in specific household energy-flexibility actions when those actions are practically feasible.",
    concept_role: "primary_profile_axis",
    dimension: "flexibility_willingness",
    output_type: "number",
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "declared_flexibility_capability",
    schema_target:
      "flexpulse_behavioural_schema.declared_flexibility_capability",
    label: "Declared flexibility capability",
    description:
      "Self-reported practical and repeatable capacity to shift household energy use while preserving the services the household needs.",
    concept_role: "primary_profile_axis",
    dimension: "flexibility_capability",
    output_type: "number",
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "thermal_comfort_norms",
    schema_target: "flexpulse_behavioural_schema.thermal_comfort_norms",
    label: "Thermal comfort norms",
    description:
      "Strength of the respondent’s preference for preserving their chosen indoor temperature and limiting temporary thermal deviation.",
    concept_role: "primary_profile_axis",
    dimension: "thermal_comfort_norms",
    output_type: "number",
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "tariff_preference_orientation",
    schema_target: "flexpulse_behavioural_schema.tariff_preference_orientation",
    label: "Tariff preference orientation",
    description:
      "Declared acceptance of time-varying or flexibility-linked electricity tariffs, including their associated price variability and planning effort.",
    concept_role: "primary_profile_axis",
    dimension: "tariff_preferences",
    output_type: "number",
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "trust_in_automation",
    schema_target: "flexpulse_behavioural_schema.trust_in_automation",
    label: "Trust in automation",
    description:
      "Readiness to rely on automated household energy control to act competently and predictably within stated operational boundaries.",
    concept_role: "primary_profile_axis",
    dimension: "trust_in_automation",
    output_type: "number",
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "der_engagement",
    schema_target: "flexpulse_behavioural_schema.der_engagement",
    label: "DER engagement",
    description:
      "Degree of engagement with household distributed-energy technologies across personal relevance, information seeking, adoption consideration, and active use.",
    concept_role: "primary_profile_axis",
    dimension: "der_engagement",
    output_type: "number",
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "manual_override_need",
    schema_target: "flexpulse_behavioural_schema.manual_override_need",
    label: "Manual override need",
    description:
      "Importance of being able to cancel, pause or change an automated action.",
    concept_role: "behavioural_modulator",
    dimension: "trust_in_automation",
    output_type: "number",
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "explainability_need",
    schema_target: "flexpulse_behavioural_schema.explainability_need",
    label: "Explainability need",
    description:
      "Information required about automated decisions, reasons and consequences.",
    concept_role: "behavioural_modulator",
    dimension: "trust_in_automation",
    output_type: "number",
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "bill_stability_need",
    schema_target: "flexpulse_behavioural_schema.bill_stability_need",
    label: "Bill stability need",
    description:
      "Importance of predictable energy expenditure and protection from unexpectedly high bills.",
    concept_role: "behavioural_modulator",
    dimension: "tariff_preferences",
    output_type: "number",
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "event_frequency_tolerance",
    schema_target: "flexpulse_behavioural_schema.event_frequency_tolerance",
    label: "Event frequency tolerance",
    description:
      "Degree to which repeated flexibility events remain acceptable over time.",
    concept_role: "behavioural_modulator",
    dimension: "flexibility_willingness",
    output_type: "number",
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "savings_motivation",
    schema_target: "flexpulse_behavioural_schema.savings_motivation",
    label: "Savings motivation",
    description:
      "Strength of financial savings as a reason to consider flexibility-related actions.",
    concept_role: "behavioural_modulator",
    dimension: "tariff_preferences",
    output_type: "number",
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "routine_dependency",
    schema_target: "flexpulse_behavioural_schema.routine_dependency",
    label: "Routine dependency",
    description:
      "Degree to which schedules, coordination and recurring obligations constrain when household activities can occur.",
    concept_role: "behavioural_modulator",
    dimension: "der_engagement",
    output_type: "number",
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "owned_der_assets",
    schema_target: "flexpulse_behavioural_schema.owned_der_assets",
    label: "Household energy assets and flexible appliances",
    description:
      "Technologies or appliances present in the home or regularly available for the household to use, including shared, rented, or household-owned equipment.",
    concept_role: "applicability_factor",
    dimension: "der_engagement",
    output_type: "string[]",
    validation_constraints: {
      allowed_values: [...FLEXPULSE_DER_ASSET_VALUES],
    },
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "interested_der_assets",
    schema_target: "flexpulse_behavioural_schema.interested_der_assets",
    label: "Interested DER assets",
    description:
      "The set of DER-relevant assets or device types the respondent is interested in adopting or engaging with in the future.",
    concept_role: "applicability_factor",
    dimension: "der_engagement",
    output_type: "string[]",
    validation_constraints: {
      allowed_values: [...FLEXPULSE_DER_ASSET_VALUES],
    },
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "winter_comfort_setpoint_c",
    schema_target: "flexpulse_behavioural_schema.winter_comfort_setpoint_c",
    label: "Winter comfort setpoint",
    description:
      "Preferred winter indoor temperature setpoint used as a factual comfort anchor for building-specific threshold reasoning.",
    concept_role: "applicability_factor",
    dimension: "thermal_comfort_norms",
    output_type: "number",
    validation_constraints: {
      min: 14,
      max: 26,
    },
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "summer_comfort_setpoint_c",
    schema_target: "flexpulse_behavioural_schema.summer_comfort_setpoint_c",
    label: "Summer comfort setpoint",
    description:
      "Preferred summer indoor temperature setpoint used as a factual comfort anchor for flexibility reasoning in warmer periods.",
    concept_role: "applicability_factor",
    dimension: "thermal_comfort_norms",
    output_type: "number",
    validation_constraints: {
      min: 18,
      max: 32,
    },
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "preferred_tariff_model",
    schema_target: "flexpulse_behavioural_schema.preferred_tariff_model",
    label: "Preferred tariff model",
    description:
      "The tariff model the respondent currently prefers when thinking about energy bills and flexibility participation.",
    concept_role: "applicability_factor",
    dimension: "tariff_preferences",
    output_type: "enum",
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "country_code",
    schema_target: "flexpulse_behavioural_schema.country_code",
    label: "Country code",
    description:
      "Normalized country code associated with the response for regional comparison and policy stratification.",
    concept_role: "context_signal",
    dimension: "response_context",
    output_type: "string",
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "normalized_location_context",
    schema_target: "flexpulse_behavioural_schema.normalized_location_context",
    label: "Normalized location context",
    description:
      "Privacy-preserving normalized location context retained at a suitable granularity for clustering, regional analysis and map aggregation.",
    concept_role: "context_signal",
    dimension: "response_context",
    output_type: "string",
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "climate_context",
    schema_target: "flexpulse_behavioural_schema.climate_context",
    label: "Climate context",
    description:
      "Normalized climate and season context associated with the response, used to interpret comfort and flexibility answers across local climate settings.",
    concept_role: "context_signal",
    dimension: "response_context",
    output_type: "enum",
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "survey_language",
    schema_target: "flexpulse_behavioural_schema.survey_language",
    label: "Survey language",
    description:
      "Language in which the response was completed, retained for multilingual analysis and translation-quality checks.",
    concept_role: "context_signal",
    dimension: "response_context",
    output_type: "string",
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "mapping_low_confidence",
    schema_target: "flexpulse_behavioural_schema.mapping_low_confidence",
    label: "Mapping low confidence",
    description:
      "Quality flag indicating that the final mapped descriptor should be treated cautiously or reviewed.",
    concept_role: "quality_signal",
    dimension: "response_context",
    output_type: "boolean",
  },
  {
    schema_version: 1,
    namespace: "flexpulse_behavioural_schema",
    concept_key: "mapping_requires_review",
    schema_target: "flexpulse_behavioural_schema.mapping_requires_review",
    label: "Mapping requires review",
    description:
      "Quality flag indicating that a response needs manual or secondary review before being treated as fully reliable.",
    concept_role: "quality_signal",
    dimension: "response_context",
    output_type: "boolean",
  },
];

export const flexpulseBehaviouralConceptsByKey = Object.fromEntries(
  flexpulseBehaviouralSchemaV1.map((concept) => [concept.concept_key, concept]),
) satisfies Record<string, FlexpulseBehaviouralConcept>;

export const flexpulseSurveyDesignConcepts = flexpulseBehaviouralSchemaV1.filter(
  (concept) =>
    concept.concept_role === "primary_profile_axis" ||
    concept.concept_role === "behavioural_modulator" ||
    concept.concept_role === "applicability_factor",
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
  (concept) => concept.concept_role === "primary_profile_axis",
);

export const flexpulseBehaviouralModulators = flexpulseBehaviouralSchemaV1.filter(
  (concept) => concept.concept_role === "behavioural_modulator",
);

export const flexpulseApplicabilityFactors = flexpulseBehaviouralSchemaV1.filter(
  (concept) => concept.concept_role === "applicability_factor",
);

export const flexpulseResponseContextConcepts = flexpulseBehaviouralSchemaV1.filter(
  (concept) => concept.concept_role === "context_signal",
);

export const flexpulseQualitySignals = flexpulseBehaviouralSchemaV1.filter(
  (concept) => concept.concept_role === "quality_signal",
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
