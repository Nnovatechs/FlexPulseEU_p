export const INSTRUMENT_HEALTH_ANALYSIS_VERSION = "instrument-health-v1";
export const INSTRUMENT_HEALTH_ALPHA_BOOTSTRAP_REPLICATES = 1000;
export const INSTRUMENT_HEALTH_SCORE_TOLERANCE = 1e-9;
export const INSTRUMENT_HEALTH_LOW_ITEM_TOTAL = 0.3;
export const INSTRUMENT_HEALTH_LOW_SPREAD_SD = 0.9;
export const INSTRUMENT_HEALTH_CONCENTRATION_SHARE = 0.75;
export const INSTRUMENT_HEALTH_OVERLAP_RHO = 0.85;
export const INSTRUMENT_HEALTH_HTMT_REFERENCE = 0.85;
export const INSTRUMENT_HEALTH_LOW_DIFFERENTIATION_SD = 0.5;

export type InstrumentMeasurementRole =
  | "reflective_candidate"
  | "descriptive_composite"
  | "conditional_module"
  | "single_item"
  | "not_applicable";

export type ItemPolarity = "positive" | "negative" | "neutral";

export type InstrumentHealthItemFlagKey =
  | "top_two_concentration"
  | "bottom_two_concentration"
  | "low_spread"
  | "low_item_total"
  | "zero_variance"
  | "high_missingness"
  | "endpoint_concentration";

export type InstrumentHealthItemFlag = {
  key: InstrumentHealthItemFlagKey;
  label: string;
  observed: string;
  rule: string;
  whyNotDelete: string;
};

const REFLECTIVE_CANDIDATES = new Set([
  "awareness_of_energy_systems",
  "flexibility_willingness",
  "thermal_comfort_norms",
  "trust_in_automation",
]);

const DESCRIPTIVE_COMPOSITES = new Set([
  "tariff_preference_orientation",
  "der_engagement",
]);

const CONDITIONAL_MODULES = new Set(["declared_flexibility_capability"]);

const NOT_APPLICABLE_CONCEPTS = new Set([
  "owned_der_assets",
  "interested_der_assets",
  "winter_comfort_setpoint_c",
  "summer_comfort_setpoint_c",
  "preferred_tariff_model",
  "country_code",
  "normalized_location_context",
  "climate_context",
  "survey_language",
  "mapping_low_confidence",
  "mapping_requires_review",
]);

export const DFC_MODULE_LABELS: Record<string, string> = {
  washing_machine_scheduling: "Washing machine",
  ev_charging: "EV charging",
  space_conditioning: "Space conditioning",
  water_heating: "Water heating",
  battery_operation: "Battery operation",
};

export const DFC_COMPONENT_LABELS: Record<string, string> = {
  operational_control: "Operational control",
  temporal_slack: "Temporal slack",
  service_preservation: "Service preservation",
  household_coordination: "Household coordination",
};

export function getInstrumentMeasurementRole(conceptKey: string): InstrumentMeasurementRole {
  if (REFLECTIVE_CANDIDATES.has(conceptKey)) {
    return "reflective_candidate";
  }

  if (DESCRIPTIVE_COMPOSITES.has(conceptKey)) {
    return "descriptive_composite";
  }

  if (CONDITIONAL_MODULES.has(conceptKey)) {
    return "conditional_module";
  }

  if (NOT_APPLICABLE_CONCEPTS.has(conceptKey)) {
    return "not_applicable";
  }

  return "descriptive_composite";
}

export function getMeasurementRoleLabel(role: InstrumentMeasurementRole) {
  switch (role) {
    case "reflective_candidate":
      return "Reflective candidate";
    case "descriptive_composite":
      return "Descriptive composite";
    case "conditional_module":
      return "Conditional module";
    case "single_item":
      return "Single item";
    case "not_applicable":
      return "Not applicable";
  }
}

export function getConstructDirectionNote(conceptKey: string) {
  if (conceptKey === "thermal_comfort_norms") {
    return "Higher scores indicate stricter thermal comfort norms, not a better outcome.";
  }

  if (conceptKey === "awareness_of_energy_systems") {
    return "This is self-reported awareness, not an objective knowledge test.";
  }

  return null;
}

export function getAlphaReading(alpha: number) {
  if (alpha < 0.7) {
    return "Below the common alpha reference.";
  }

  if (alpha < 0.9) {
    return "Meets the common alpha reference conditionally. Alpha is interpretable only if the scale is sufficiently unidimensional.";
  }

  if (alpha <= 0.95) {
    return "Very high internal consistency; inspect possible redundancy. Alpha is interpretable only if the scale is sufficiently unidimensional.";
  }

  return "Possible redundancy. Alpha is interpretable only if the scale is sufficiently unidimensional.";
}

export function getConstructInterpretation(input: {
  role: InstrumentMeasurementRole;
  itemFlagCount: number;
  itemCount: number;
}) {
  if (input.role === "conditional_module") {
    return "Conditional module — inspect coverage by asset";
  }

  if (input.role === "descriptive_composite") {
    return "Descriptive profile";
  }

  if (input.role === "not_applicable") {
    return "Outside consistency analysis";
  }

  if (input.itemCount < 2) {
    return "Reliability not applicable to a single item";
  }

  if (input.itemFlagCount > 0) {
    return "Review item behaviour";
  }

  return "No major signal";
}

export function buildItemFlag(
  key: InstrumentHealthItemFlagKey,
  observed: string,
): InstrumentHealthItemFlag {
  switch (key) {
    case "top_two_concentration":
      return {
        key,
        label: "Top-two concentration",
        observed,
        rule: "At least 75% of valid answers sit on 4–5 of a 1–5 scale.",
        whyNotDelete:
          "Concentration can be a real opinion, a ceiling, or a sample composition effect. It does not by itself justify deleting the item.",
      };
    case "bottom_two_concentration":
      return {
        key,
        label: "Bottom-two concentration",
        observed,
        rule: "At least 75% of valid answers sit on 1–2 of a 1–5 scale.",
        whyNotDelete:
          "A floor can be genuine rejection or limited sample spread. Inspect wording and sample composition before changing the item.",
      };
    case "low_spread":
      return {
        key,
        label: "Low spread",
        observed,
        rule: "Sample SD is below 0.90. This is a pilot heuristic, not a universal standard.",
        whyNotDelete:
          "Low dispersion can reflect a homogeneous sample or a narrowly worded item. Conceptual coverage may still require it.",
      };
    case "low_item_total":
      return {
        key,
        label: "Low item-total",
        observed,
        rule: "Corrected item-total correlation is below 0.30 on the complete-case reflective set.",
        whyNotDelete:
          "A weak item-total correlation is a review signal. Coverage of a distinct facet can justify keeping the item.",
      };
    case "zero_variance":
      return {
        key,
        label: "Zero variance",
        observed,
        rule: "Every valid answer is identical, so correlations and reliability involving this item are not computable.",
        whyNotDelete:
          "Zero variance blocks some statistics. It does not prove the question is useless; the sample may simply not vary.",
      };
    case "high_missingness":
      return {
        key,
        label: "Missing answers",
        observed,
        rule: "Missingness is reported against the eligible denominator. No universal cutoff is applied yet.",
        whyNotDelete:
          "Missing answers may come from visibility rules, fatigue, or optional items. Inspect eligibility before treating this as item failure.",
      };
    case "endpoint_concentration":
      return {
        key,
        label: "Endpoint concentration",
        observed,
        rule: "More than 15% of valid answers sit on the exact minimum or maximum of the item scale.",
        whyNotDelete:
          "Endpoint concentration on a single item is not the same as scale-level floor or ceiling. Do not delete automatically.",
      };
  }
}

export const MULTILINGUAL_INVARIANCE_NOTE =
  "Similar alpha values do not establish measurement invariance.";

export const ADVANCED_MODEL_ROWS = [
  {
    model: "Configural",
    groups: "Available languages",
    status: "Not run" as const,
  },
  {
    model: "Threshold/loading invariance",
    groups: "Available languages",
    status: "Not run" as const,
  },
  {
    model: "Scalar-equivalent comparison",
    groups: "Available languages",
    status: "Not run" as const,
  },
];
