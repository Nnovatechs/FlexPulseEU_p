import type { SegmentDefinition } from "./types";
import type { SegmentExplorerSummary } from "./types";
import type { PostalMapComparison } from "@/features/surveys/analytics/geography/postal-map-types";

export type ComparisonOverlapRelation =
  | "identical"
  | "disjoint"
  | "overlap"
  | "a_contains_b"
  | "b_contains_a";

export type ComparisonScoreKind = "primary_axis" | "facet" | "modulator" | "capability_module";

export type ComparisonScoreDifference = {
  kind: ComparisonScoreKind;
  conceptKey: string;
  field: string;
  label: string;
  facet: string | null;
  evidenceLevel: "interpretive_signal" | "facet_subscore" | null;
  evidenceLabel: string | null;
  directionNote: string | null;
  definitionDifference: boolean;
  medianA: number;
  medianB: number;
  q1A: number;
  q3A: number;
  q1B: number;
  q3B: number;
  medianDelta: number;
  cliffsDelta: number | null;
  applicableNA: number;
  applicableNB: number;
};

export type ComparisonCompositionFamily = "asset" | "geography" | "category";

export type ComparisonCompositionDifference = {
  field: string;
  label: string;
  value: string;
  valueLabel: string;
  family: ComparisonCompositionFamily;
  shareA: number | null;
  shareB: number | null;
  countA: number | null;
  countB: number | null;
  deltaPercentagePoints: number | null;
  applicableNA: number;
  applicableNB: number;
  definitionDifference: boolean;
  disclosure: "visible" | "suppressed";
};

export type ComparisonDfcModule = {
  conceptKey: string;
  setKey: string;
  field: string;
  label: string;
  applicableNA: number;
  applicableNB: number;
  notApplicableNA: number;
  notApplicableNB: number;
  applicabilityRateA: number | null;
  applicabilityRateB: number | null;
  medianA: number | null;
  medianB: number | null;
  q1A: number | null;
  q3A: number | null;
  q1B: number | null;
  q3B: number | null;
  medianDelta: number | null;
  cliffsDelta: number | null;
};

export type ComparisonDfcSummary = {
  conceptKey: string;
  label: string;
  overall: {
    medianA: number | null;
    medianB: number | null;
    q1A: number | null;
    q3A: number | null;
    q1B: number | null;
    q3B: number | null;
    applicableNA: number;
    applicableNB: number;
    medianDelta: number | null;
    cliffsDelta: number | null;
    includedInMainRanking: false;
  };
  modules: ComparisonDfcModule[];
  assetCompositionDiffers: boolean;
};

export type ComparisonProfileAxis = {
  conceptKey: string;
  field: string;
  label: string;
  directionNote: string | null;
  medianA: number;
  medianB: number;
  applicableNA: number;
  applicableNB: number;
};

export type ComparisonGeographyRow = {
  field: string;
  value: string;
  label: string;
  shareA: number | null;
  shareB: number | null;
  countA: number | null;
  countB: number | null;
  analysedCount: number;
  deltaPercentagePoints: number | null;
  disclosure: "visible" | "suppressed";
};

export type ComparisonWeatherSeries = {
  field: string;
  label: string;
  unit: string;
  nA: number;
  nB: number;
  medianA: number | null;
  medianB: number | null;
};

export type ComparisonInsight = {
  kind: "score_difference" | "composition_difference" | "descriptive" | "none";
  observedPattern: string;
  potentialReading: string;
  worthExamining: string;
  conceptKeys: string[];
  evidence: {
    selectedN: number;
    outsideN: number | null;
    selectedValue: number | null;
    outsideValue: number | null;
    delta: number | null;
    cliffsDelta: number | null;
  } | null;
};

export type ComparisonSample = {
  analysedN: number;
  nA: number;
  nB: number;
  intersectionN: number;
  aOnlyN: number;
  bOnlyN: number;
  shareA: number | null;
  shareB: number | null;
  relation: ComparisonOverlapRelation;
  effectSizesAvailable: boolean;
};

export type ComparisonRules = {
  semanticMinN: number;
  cellMinN: number;
  scoreRanking: "abs_cliffs_delta";
  compositionRanking: "abs_percentage_points";
  effectSizesRequireDisjoint: true;
};

export type SegmentComparisonResult = {
  generatedAt: string;
  definitionA: SegmentDefinition;
  definitionB: SegmentDefinition;
  readableConditionsA: SegmentExplorerSummary["readableConditions"];
  readableConditionsB: SegmentExplorerSummary["readableConditions"];
  sample: ComparisonSample;
  blockedReason: "identical" | null;
  scoreDifferences: ComparisonScoreDifference[];
  definitionDifferences: ComparisonScoreDifference[];
  compositionDifferences: ComparisonCompositionDifference[];
  dfc: ComparisonDfcSummary | null;
  profileAxes: ComparisonProfileAxis[];
  geography: ComparisonGeographyRow[];
  weather: ComparisonWeatherSeries[];
  postalMap: PostalMapComparison | null;
  insights: ComparisonInsight[];
  rules: ComparisonRules;
};
