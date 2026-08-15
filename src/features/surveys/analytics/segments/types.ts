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
  facets: SegmentCatalogFacetField[];
};

export type SegmentCatalogConditionalModule = {
  field: string;
  setKey: string;
  label: string;
  scaleMin: number;
  scaleMax: number;
};

export type SegmentCatalogDimension = {
  dimension: string;
  label: string;
  overall: SegmentCatalogScoreField | null;
  facets: SegmentCatalogFacetField[];
  supportingFactors: SegmentCatalogSupportingFactor[];
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
