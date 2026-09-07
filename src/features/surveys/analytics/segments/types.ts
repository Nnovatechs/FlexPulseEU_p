export const SEGMENT_DEFINITION_VERSION = 1 as const;
export const MAX_SEGMENT_CONDITIONS = 16;
export const MAX_SEGMENT_PAYLOAD_CHARS = 4096;
export const SEGMENT_URL_PARAM = "segment";

export type SegmentBandKey = "high" | "medium" | "low";

export type SegmentSemanticBandCondition = {
  kind: "semantic_band";
  field: string;
  band: SegmentBandKey;
};

export type SegmentNumericRangeCondition = {
  kind: "numeric_range";
  field: string;
  min: number;
  max: number;
};

export type SegmentEqualityCondition = {
  kind: "eq";
  field: string;
  value: string | number | boolean;
};

export type SegmentInCondition = {
  kind: "in";
  field: string;
  values: Array<string | number | boolean>;
};

export type SegmentContainsCondition = {
  kind: "contains";
  field: string;
  value: string | number;
};

export type SegmentNotContainsCondition = {
  kind: "not_contains";
  field: string;
  value: string | number;
};

export type SegmentApplicabilityCondition = {
  kind: "applicability";
  field: string;
  applicable: boolean;
};

export type SegmentDateRangeCondition = {
  kind: "date_range";
  field: string;
  min: string;
  max: string;
};

export type SegmentCondition =
  | SegmentSemanticBandCondition
  | SegmentNumericRangeCondition
  | SegmentEqualityCondition
  | SegmentInCondition
  | SegmentContainsCondition
  | SegmentNotContainsCondition
  | SegmentApplicabilityCondition
  | SegmentDateRangeCondition;

export type SegmentDefinition = {
  version: typeof SEGMENT_DEFINITION_VERSION;
  surveyId: string;
  schemaNamespace: string;
  measurementHash: string | null;
  conditions: SegmentCondition[];
};

export type SegmentValidationIssue =
  | "malformed"
  | "unknown_version"
  | "survey_mismatch"
  | "schema_mismatch"
  | "measurement_hash_mismatch"
  | "unknown_field"
  | "operator_not_allowed"
  | "invalid_condition"
  | "too_many_conditions"
  | "payload_too_large"
  | "duplicate_score_condition";

export type SegmentValidationResult =
  | { ok: true; definition: SegmentDefinition }
  | { ok: false; issue: SegmentValidationIssue; message: string };

export type SegmentCatalogScoreField = {
  field: string;
  conceptKey: string;
  label: string;
  directionNote: string | null;
  scaleMin: number;
  scaleMax: number;
  bandLabels: Record<SegmentBandKey, string>;
};

export type SegmentCatalogFacetField = SegmentCatalogScoreField & {
  facet: string;
  evidenceLevel: "interpretive_signal" | "facet_subscore";
  evidenceLabel: string;
};

export type SegmentCatalogSupportingFactor = {
  conceptKey: string;
  label: string;
  overall: SegmentCatalogScoreField;
};

export type SegmentCatalogConditionalModule = {
  field: string;
  setKey: string;
  label: string;
  conceptKey: string;
  scaleMin: number;
  scaleMax: number;
  bandLabels: Record<SegmentBandKey, string>;
};

export type SegmentCatalogHouseholdCondition =
  | {
      kind: "numeric_range";
      conceptKey: string;
      field: string;
      label: string;
      unit: string;
      scaleMin: number;
      scaleMax: number;
    }
  | {
      kind: "choice";
      conceptKey: string;
      field: string;
      label: string;
      values: Array<{ value: string; label: string }>;
    }
  | {
      kind: "membership";
      conceptKey: string;
      field: string;
      label: string;
      values: Array<{ value: string; label: string }>;
    };

export type SegmentCatalogDimension = {
  dimension: string;
  label: string;
  overall: SegmentCatalogScoreField | null;
  facets: SegmentCatalogFacetField[];
  supportingFactors: SegmentCatalogSupportingFactor[];
  householdConditions: SegmentCatalogHouseholdCondition[];
  conditionalModules: SegmentCatalogConditionalModule[];
};

export type SegmentCatalogChoiceField = {
  field: string;
  label: string;
  values: Array<{ value: string; label: string }>;
};

export type SegmentCatalogAssetGroup = {
  field: string;
  label: string;
  values: Array<{ value: string; label: string }>;
};

export type SegmentCatalogContextField =
  | (SegmentCatalogChoiceField & { kind: "choice" })
  | {
      kind: "date_range";
      field: string;
      label: string;
    }
  | {
      kind: "numeric_range";
      field: string;
      label: string;
      scaleMin: number;
      scaleMax: number;
    };

export type SegmentCatalog = {
  surveyId: string;
  schemaNamespace: string;
  schemaVersion: number;
  measurementHash: string | null;
  analysedN: number;
  dimensions: SegmentCatalogDimension[];
  assets: SegmentCatalogAssetGroup | null;
  geography: SegmentCatalogChoiceField[];
  context: SegmentCatalogContextField[];
};

export type SegmentProfileAxis = {
  conceptKey: string;
  label: string;
  directionNote: string | null;
  defining: boolean;
  applicableN: number;
  median: number;
  q1: number;
  q3: number;
  bands: Array<{
    key: SegmentBandKey;
    label: string;
    count: number;
    share: number;
  }>;
};

export type SegmentExplorerSummary = {
  definition: SegmentDefinition;
  matchedN: number;
  analysedN: number;
  share: number | null;
  readableConditions: Array<{
    field: string;
    label: string;
    detail: string;
    defining: true;
  }>;
  axes: SegmentProfileAxis[];
};

export type SegmentScoreSnapshot = {
  median: number;
  q1: number;
  q3: number;
  applicableN: number;
  bands: SegmentProfileAxis["bands"];
};

export type SegmentAnalysisProfileAxis = SegmentProfileAxis & {
  field: string;
  wholeSurveyMedian: number | null;
};

export type SegmentScoreDifferentiator = {
  kind: "score";
  conceptKey: string;
  field: string;
  label: string;
  directionNote: string | null;
  segment: SegmentScoreSnapshot;
  outside: SegmentScoreSnapshot;
  medianDelta: number;
  cliffsDelta: number | null;
};

export type SegmentCategoryDifferentiator = {
  kind: "categorical";
  field: string;
  label: string;
  value: string;
  valueLabel: string;
  segmentShare: number | null;
  outsideShare: number | null;
  segmentCount: number | null;
  outsideCount: number | null;
  segmentN: number;
  outsideN: number;
  deltaPercentagePoints: number | null;
  disclosure: "visible" | "suppressed";
  comparisonAvailable: boolean;
};

export type SegmentAnalysisSample = {
  selectedN: number;
  outsideN: number;
  analysedN: number;
  share: number | null;
  referenceType: "outside" | "none";
  comparisonAvailable: boolean;
};

export type SegmentFacetSignal = {
  conceptKey: string;
  conceptLabel: string;
  facet: string;
  field: string;
  label: string;
  evidenceLevel: "interpretive_signal" | "facet_subscore";
  evidenceLabel: string;
  definingParent: boolean;
  applicableN: number;
  median: number;
  q1: number;
  q3: number;
  bands: SegmentProfileAxis["bands"];
  wholeSurveyMedian: number | null;
  outside: SegmentScoreSnapshot | null;
  medianDelta: number | null;
  cliffsDelta: number | null;
};

export type SegmentSupportingFactorAxis = {
  conceptKey: string;
  dimension: string;
  dimensionLabel: string;
  field: string;
  label: string;
  directionNote: string | null;
  defining: boolean;
  applicableN: number;
  median: number;
  q1: number;
  q3: number;
  bands: SegmentProfileAxis["bands"];
  wholeSurveyMedian: number | null;
  outside: SegmentScoreSnapshot | null;
  medianDelta: number | null;
  cliffsDelta: number | null;
};

export type SegmentConditionalModule = {
  conceptKey: string;
  setKey: string;
  field: string;
  label: string;
  applicableN: number;
  notApplicableN: number;
  applicabilityRate: number | null;
  missingWithinApplicable: number;
  median: number | null;
  q1: number | null;
  q3: number | null;
  bands: SegmentProfileAxis["bands"];
  outside: {
    applicableN: number;
    median: number | null;
    q1: number | null;
    q3: number | null;
  } | null;
};

export type SegmentConditionalSummary = {
  conceptKey: string;
  label: string;
  overall: SegmentScoreSnapshot | null;
  modules: SegmentConditionalModule[];
  applicableModuleCounts: Array<{
    count: number;
    households: number;
    share: number;
  }>;
};

export type SegmentHouseholdNumericSnapshot = {
  kind: "numeric";
  conceptKey: string;
  field: string;
  label: string;
  unit: string;
  applicableN: number;
  missingN: number;
  median: number;
  q1: number;
  q3: number;
  wholeSurveyMedian: number | null;
  outsideMedian: number | null;
  outsideApplicableN: number;
  outsideMissingN: number;
};

export type SegmentHouseholdCategoryShare = {
  value: string;
  label: string;
  segmentCount: number | null;
  segmentShare: number | null;
  outsideCount: number | null;
  outsideShare: number | null;
  deltaPercentagePoints: number | null;
  disclosure: "visible" | "suppressed";
};

export type SegmentHouseholdCategoricalSnapshot = {
  kind: "categorical" | "membership";
  conceptKey: string;
  field: string;
  label: string;
  applicableN: number;
  missingN: number;
  outsideApplicableN: number;
  outsideMissingN: number;
  comparisonAvailable: boolean;
  values: SegmentHouseholdCategoryShare[];
};

export type SegmentHouseholdConditionsBlock = {
  label: string;
  numerics: SegmentHouseholdNumericSnapshot[];
  categories: SegmentHouseholdCategoricalSnapshot[];
};

export type SegmentAssetPenetration = {
  field: string;
  value: string;
  label: string;
  segmentCount: number | null;
  segmentN: number;
  segmentShare: number | null;
  outsideCount: number | null;
  outsideN: number;
  outsideShare: number | null;
  deltaPercentagePoints: number | null;
  disclosure: "visible" | "suppressed";
  comparisonAvailable: boolean;
};

export type SegmentInternalVariation = {
  field: string;
  conceptKey: string;
  label: string;
  applicableN: number;
  iqr: number;
  normalisedIqr: number;
  bandEntropy: number;
  dominantBand: SegmentBandKey;
  bands: SegmentProfileAxis["bands"];
};

export type SegmentGeographyRow = {
  field: string;
  value: string;
  label: string;
  segmentCount: number | null;
  analysedCount: number;
  selectedN: number;
  penetration: number | null;
  composition: number | null;
  disclosure: "visible" | "suppressed";
};

export type SegmentWeatherSeries = {
  field: string;
  label: string;
  unit: string;
  n: number;
  median: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
  outsideMedian: number | null;
};

export type SegmentInsightEvidence = {
  selectedN: number;
  outsideN: number | null;
  selectedValue: number | null;
  outsideValue: number | null;
  delta: number | null;
  cliffsDelta: number | null;
};

export type SegmentSemanticInsight = {
  kind: "score_difference" | "facet_contrast" | "internal_variation" | "asset_difference" | "none";
  observedPattern: string;
  potentialReading: string;
  worthExamining: string;
  conceptKeys: string[];
  evidence: SegmentInsightEvidence | null;
};

export type SegmentAssociation = {
  leftConceptKey: string;
  leftLabel: string;
  rightConceptKey: string;
  rightLabel: string;
  rho: number;
  pairedN: number;
};

export type SegmentAnalysisResult = {
  definition: SegmentDefinition;
  generatedAt: string;
  sample: SegmentAnalysisSample;
  readableConditions: SegmentExplorerSummary["readableConditions"];
  profileAxes: SegmentAnalysisProfileAxis[];
  differentiators: {
    available: boolean;
    reason: "whole_sample" | "empty_segment" | "empty_outside" | null;
    scores: SegmentScoreDifferentiator[];
    categories: SegmentCategoryDifferentiator[];
  };
  facets: SegmentFacetSignal[];
  supportingFactors: SegmentSupportingFactorAxis[];
  householdConditions: SegmentHouseholdConditionsBlock | null;
  conditionalModules: SegmentConditionalSummary | null;
  assets: SegmentAssetPenetration[];
  internalVariation: SegmentInternalVariation[];
  geography: SegmentGeographyRow[];
  weather: SegmentWeatherSeries[];
  insights: SegmentSemanticInsight[];
  associations: SegmentAssociation[];
};

export const SEGMENT_ASSOCIATION_MIN_N = 5;
export const SEGMENT_ASSOCIATION_MAX_PAIRS = 8;
export const SEGMENT_FACET_CONTRAST_GAP = 0.15;

export type SavedSegmentRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  definition: SegmentDefinition;
};

export type ComparisonTrayState = {
  version: 1;
  slots: [SegmentDefinition | null, SegmentDefinition | null];
};
