import {
  FLEXPULSE_BEHAVIOURAL_SCHEMA_NAMESPACE,
  resolveFlexpulseAnalysisModel,
  resolveFlexpulseBehaviouralConcept,
  type FlexpulseAnalysisModel,
  type FlexpulseMeasurementRole,
  type FlexpulseScoreDirection,
} from "@/features/ontology/flexpulse-behavioural-schema";
import {
  DFC_ANALYSIS_CATALOG_ID,
  getDeclaredFlexibilityCapabilityAnalysisCatalog,
  type ConditionalModuleAnalysisCatalog,
} from "@/features/surveys/declared-flexibility-capability-module";

export const INSTRUMENT_HEALTH_ANALYSIS_VERSION = "instrument-health-v4";
export const INSTRUMENT_HEALTH_METHODOLOGY_VERSION = "v1";
export const INSTRUMENT_HEALTH_ALPHA_BOOTSTRAP_REPLICATES = 1000;
export const INSTRUMENT_HEALTH_SCORE_TOLERANCE = 1e-9;

export const INSTRUMENT_HEALTH_POLICY_V1 = {
  correctedItemTotalReviewBelow: 0.3,
  lowItemSpreadBelow: 0.9,
  topTwoConcentrationAtOrAbove: 0.75,
  bottomTwoConcentrationAtOrAbove: 0.75,
  htmtOverlapAtOrAbove: 0.85,
  lowWithinPersonSdBelow: 0.5,
  sampleAdequacy: {
    descriptiveOnlyBelow: 30,
    fullScreeningAtOrAbove: 50,
  },
} as const;

export const INSTRUMENT_HEALTH_LOW_ITEM_TOTAL =
  INSTRUMENT_HEALTH_POLICY_V1.correctedItemTotalReviewBelow;
export const INSTRUMENT_HEALTH_LOW_SPREAD_SD =
  INSTRUMENT_HEALTH_POLICY_V1.lowItemSpreadBelow;
export const INSTRUMENT_HEALTH_CONCENTRATION_SHARE =
  INSTRUMENT_HEALTH_POLICY_V1.topTwoConcentrationAtOrAbove;
export const INSTRUMENT_HEALTH_HTMT_REFERENCE =
  INSTRUMENT_HEALTH_POLICY_V1.htmtOverlapAtOrAbove;
export const INSTRUMENT_HEALTH_LOW_DIFFERENTIATION_SD =
  INSTRUMENT_HEALTH_POLICY_V1.lowWithinPersonSdBelow;

export type InstrumentMeasurementRole = FlexpulseMeasurementRole;
export type InstrumentScoreDirection = FlexpulseScoreDirection;
export type InstrumentAnalysisModel = FlexpulseAnalysisModel;
export type ItemPolarity = "positive" | "negative" | "neutral";
export type InstrumentHealthSignalKind = "scoring" | "item_coherence" | "distribution";
export type InstrumentHealthSampleAdequacy = "descriptive_only" | "preliminary" | "full";

export type InstrumentHealthItemFlagKey =
  | "top_two_concentration"
  | "bottom_two_concentration"
  | "low_spread"
  | "low_item_total"
  | "zero_variance"
  | "high_missingness";

export type InstrumentHealthItemFlag = {
  key: InstrumentHealthItemFlagKey;
  kind: InstrumentHealthSignalKind;
  label: string;
  observed: string;
  rule: string;
};

export type InstrumentHealthSchemaRef = {
  schemaNamespace: string;
  schemaVersion: number;
};

const GENERIC_BAND_LABELS = {
  high: "high",
  medium: "intermediate",
  low: "low",
} as const;

const CONDITIONAL_MODULE_CATALOGS: Record<string, () => ConditionalModuleAnalysisCatalog> = {
  [DFC_ANALYSIS_CATALOG_ID]: getDeclaredFlexibilityCapabilityAnalysisCatalog,
};

export function defaultInstrumentHealthSchemaRef(): InstrumentHealthSchemaRef {
  return {
    schemaNamespace: FLEXPULSE_BEHAVIOURAL_SCHEMA_NAMESPACE,
    schemaVersion: 1,
  };
}

export function resolveInstrumentAnalysisModel(
  conceptKey: string,
  schemaRef: InstrumentHealthSchemaRef = defaultInstrumentHealthSchemaRef(),
) {
  return resolveFlexpulseAnalysisModel({
    schemaNamespace: schemaRef.schemaNamespace,
    schemaVersion: schemaRef.schemaVersion,
    conceptKey,
  });
}

export function resolveInstrumentConcept(
  conceptKey: string,
  schemaRef: InstrumentHealthSchemaRef = defaultInstrumentHealthSchemaRef(),
) {
  return resolveFlexpulseBehaviouralConcept({
    schemaNamespace: schemaRef.schemaNamespace,
    schemaVersion: schemaRef.schemaVersion,
    conceptKey,
  });
}

export function getInstrumentMeasurementRole(
  conceptKey: string,
  schemaRef: InstrumentHealthSchemaRef = defaultInstrumentHealthSchemaRef(),
): InstrumentMeasurementRole {
  return resolveInstrumentAnalysisModel(conceptKey, schemaRef)?.measurement_role ?? "not_applicable";
}

export function getConditionalModuleCatalog(catalogId: string | undefined) {
  if (!catalogId) {
    return null;
  }

  return CONDITIONAL_MODULE_CATALOGS[catalogId]?.() ?? null;
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

export function getScoreDirectionNote(direction: InstrumentScoreDirection | null | undefined) {
  if (direction === "higher_is_stricter") {
    return "Higher scores indicate stricter expectations.";
  }

  return null;
}

export function getConstructBandLabel(
  conceptKey: string,
  band: keyof typeof GENERIC_BAND_LABELS,
  schemaRef: InstrumentHealthSchemaRef = defaultInstrumentHealthSchemaRef(),
) {
  return (
    resolveInstrumentAnalysisModel(conceptKey, schemaRef)?.band_labels?.[band] ??
    GENERIC_BAND_LABELS[band]
  );
}

export function getSampleAdequacy(n: number): InstrumentHealthSampleAdequacy {
  if (n < INSTRUMENT_HEALTH_POLICY_V1.sampleAdequacy.descriptiveOnlyBelow) {
    return "descriptive_only";
  }

  if (n < INSTRUMENT_HEALTH_POLICY_V1.sampleAdequacy.fullScreeningAtOrAbove) {
    return "preliminary";
  }

  return "full";
}

export function automatedSignalsActive(n: number) {
  return getSampleAdequacy(n) !== "descriptive_only";
}

export function getSampleAdequacyLabel(adequacy: InstrumentHealthSampleAdequacy) {
  if (adequacy === "descriptive_only") {
    return "Small applicable sample — descriptive only";
  }

  if (adequacy === "preliminary") {
    return "Preliminary distribution";
  }

  return null;
}

export function getItemSignalKind(key: InstrumentHealthItemFlagKey): InstrumentHealthSignalKind {
  if (key === "low_item_total" || key === "zero_variance") {
    return "item_coherence";
  }

  if (key === "high_missingness") {
    return "scoring";
  }

  return "distribution";
}

export const INSTRUMENT_HEALTH_COPY = {
  pageIntro:
    "Instrument Health brings together scoring integrity, response distributions, item coherence and construct relationships for the current survey version.",
  relationships:
    "Spearman’s rho shows whether respondents with higher scores on one construct also tend to have higher or lower scores on another. Positive values indicate movement in the same direction; negative values indicate movement in opposite directions.",
  htmt:
    "HTMT screens possible overlap between reflective candidate constructs. The complete-case n of each pair is always shown. Values at or above 0.85 are highlighted as an overlap signal only when that n is at least 30; below that, the estimate stays visible as descriptive only.",
  longestRun:
    "For each respondent this is the longest streak of consecutive rating questions given the same answer. It is shown as a count and as a share of the Likert questions that person actually saw, because conditional modules can change how many items appear.",
  identicalWithinConstruct:
    "The proportion of respondents who selected the same rating for every item in a construct.",
  debrief:
    "Optional post-survey feedback collected from respondents. These results describe perceived clarity and ease of completion; they are not part of construct scoring.",
  exploratoryAssociations:
    "Associations among descriptive composites and conditional modules are exploratory. Conditional modules can be formed from different applicable items per respondent.",
  methodologyLink: "How this analysis works",
} as const;

export function buildItemFlag(
  key: InstrumentHealthItemFlagKey,
  observed: string,
): InstrumentHealthItemFlag {
  const kind = getItemSignalKind(key);
  const share = Math.round(INSTRUMENT_HEALTH_POLICY_V1.topTwoConcentrationAtOrAbove * 100);
  const citc = INSTRUMENT_HEALTH_POLICY_V1.correctedItemTotalReviewBelow.toFixed(2);
  const spread = INSTRUMENT_HEALTH_POLICY_V1.lowItemSpreadBelow.toFixed(2);

  switch (key) {
    case "top_two_concentration":
      return {
        key,
        kind,
        label: "Upper-end concentration",
        observed,
        rule: `At least ${share}% of valid responses are in categories 4–5.`,
      };
    case "bottom_two_concentration":
      return {
        key,
        kind,
        label: "Lower-end concentration",
        observed,
        rule: `At least ${share}% of valid responses are in categories 1–2.`,
      };
    case "low_spread":
      return {
        key,
        kind,
        label: "Low response spread",
        observed,
        rule: `The item standard deviation is below ${spread}.`,
      };
    case "low_item_total":
      return {
        key,
        kind,
        label: "Low item-total relationship",
        observed,
        rule: `Corrected item-total correlation is below ${citc}.`,
      };
    case "zero_variance":
      return {
        key,
        kind,
        label: "Zero variance",
        observed,
        rule: "Every valid answer is identical.",
      };
    case "high_missingness":
      return {
        key,
        kind,
        label: "Missing answers",
        observed,
        rule: "Missingness is reported against the eligible denominator.",
      };
  }
}

export const MULTILINGUAL_INVARIANCE_NOTE =
  "Language descriptives can be compared here. Factorial equivalence requires a separate advanced analysis.";
