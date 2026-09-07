import { getCanonicalDerAssetOptionLabel } from "@/features/surveys/asset-option-labels";
import { getCanonicalPreferredTariffOptionLabel } from "@/features/surveys/tariff-option-labels";
import type { SurveyAnalyticsFieldDefinition } from "@/features/surveys/survey-analytics";

export const OWNED_DER_ASSETS_CONCEPT_KEY = "owned_der_assets" as const;

export const HOUSEHOLD_CONDITIONS_FILTER_GROUP_LABEL = "Household conditions";
export const HOUSEHOLD_CONDITIONS_SECTION_LABEL = "Household conditions and stated settings";

export type HouseholdConditionControl = "numeric_range" | "choice" | "membership";

export type HouseholdConditionPresentation = {
  conceptKey: string;
  control: HouseholdConditionControl;
  unit: string | null;
  scaleMin: number | null;
  scaleMax: number | null;
  /** Ontology dimension used only to nest the control. Presentation is keyed by concept_key. */
  groupingDimension: string;
};

export const HOUSEHOLD_CONDITION_PRESENTATION = {
  winter_comfort_setpoint_c: {
    conceptKey: "winter_comfort_setpoint_c",
    control: "numeric_range",
    unit: "°C",
    scaleMin: 14,
    scaleMax: 26,
    groupingDimension: "thermal_comfort_norms",
  },
  summer_comfort_setpoint_c: {
    conceptKey: "summer_comfort_setpoint_c",
    control: "numeric_range",
    unit: "°C",
    scaleMin: 18,
    scaleMax: 32,
    groupingDimension: "thermal_comfort_norms",
  },
  preferred_tariff_model: {
    conceptKey: "preferred_tariff_model",
    control: "choice",
    unit: null,
    scaleMin: null,
    scaleMax: null,
    groupingDimension: "tariff_preferences",
  },
  interested_der_assets: {
    conceptKey: "interested_der_assets",
    control: "membership",
    unit: null,
    scaleMin: null,
    scaleMax: null,
    groupingDimension: "der_engagement",
  },
} as const satisfies Record<string, HouseholdConditionPresentation>;

export type HouseholdConditionConceptKey = keyof typeof HOUSEHOLD_CONDITION_PRESENTATION;

export function listHouseholdConditionPresentations(): HouseholdConditionPresentation[] {
  return [
    HOUSEHOLD_CONDITION_PRESENTATION.winter_comfort_setpoint_c,
    HOUSEHOLD_CONDITION_PRESENTATION.summer_comfort_setpoint_c,
    HOUSEHOLD_CONDITION_PRESENTATION.preferred_tariff_model,
    HOUSEHOLD_CONDITION_PRESENTATION.interested_der_assets,
  ];
}

export function getHouseholdConditionPresentation(conceptKey: string | null | undefined) {
  if (!conceptKey) {
    return null;
  }
  return HOUSEHOLD_CONDITION_PRESENTATION[conceptKey as HouseholdConditionConceptKey] ?? null;
}

export function isOwnedDerAssetsConcept(conceptKey: string | null | undefined) {
  return conceptKey === OWNED_DER_ASSETS_CONCEPT_KEY;
}

export function isHouseholdConditionConcept(conceptKey: string | null | undefined) {
  return getHouseholdConditionPresentation(conceptKey) != null;
}

export function isOwnedDerAssetsField(field: Pick<SurveyAnalyticsFieldDefinition, "concept_key" | "key">) {
  return isOwnedDerAssetsConcept(field.concept_key) || field.key.includes("owned_der_assets");
}

export function isHouseholdConditionField(field: Pick<SurveyAnalyticsFieldDefinition, "concept_key">) {
  return isHouseholdConditionConcept(field.concept_key);
}

export function isInterestedDerAssetsField(field: Pick<SurveyAnalyticsFieldDefinition, "concept_key" | "key">) {
  return field.concept_key === "interested_der_assets" || field.key.includes("interested_der_assets");
}

export function allowsSemanticBandFilter(field: Pick<SurveyAnalyticsFieldDefinition, "concept_role" | "value_type">) {
  return field.value_type === "number" && field.concept_role !== "applicability_factor";
}

export function getHouseholdConditionValueLabel(conceptKey: string, value: string) {
  if (conceptKey === "interested_der_assets") {
    return getCanonicalDerAssetOptionLabel(value, "English") ?? value;
  }
  if (conceptKey === "preferred_tariff_model") {
    return getCanonicalPreferredTariffOptionLabel(value, "English") ?? value;
  }
  return value;
}
