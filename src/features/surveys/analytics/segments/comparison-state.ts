import { segmentDefinitionsEqual } from "./normalize";
import type { SegmentDefinition } from "./types";
import type { SegmentComparisonResult } from "./comparison-types";

export type SegmentComparisonStatus = "idle" | "loading" | "ready" | "error";

export function isSegmentComparisonStale(input: {
  trayA: SegmentDefinition | null;
  trayB: SegmentDefinition | null;
  generatedA: SegmentDefinition | null;
  generatedB: SegmentDefinition | null;
  analysedN: number;
  generatedAnalysedN: number | null;
}) {
  if (input.generatedA == null || input.generatedB == null) {
    return false;
  }
  if (input.trayA == null || input.trayB == null) {
    return true;
  }
  if (
    !segmentDefinitionsEqual(input.trayA, input.generatedA) ||
    !segmentDefinitionsEqual(input.trayB, input.generatedB)
  ) {
    return true;
  }
  return input.generatedAnalysedN != null && input.generatedAnalysedN !== input.analysedN;
}

export function canGenerateSegmentComparison(input: {
  trayA: SegmentDefinition | null;
  trayB: SegmentDefinition | null;
  generatedA: SegmentDefinition | null;
  generatedB: SegmentDefinition | null;
  analysedN: number;
  generatedAnalysedN: number | null;
  status: SegmentComparisonStatus;
}) {
  if (input.status === "loading" || input.trayA == null || input.trayB == null) {
    return false;
  }
  if (input.generatedA == null || input.generatedB == null) {
    return true;
  }
  return isSegmentComparisonStale(input);
}

export function getCompareActionLabel(input: {
  trayA: SegmentDefinition | null;
  trayB: SegmentDefinition | null;
  generatedA: SegmentDefinition | null;
  generatedB: SegmentDefinition | null;
  analysedN: number;
  generatedAnalysedN: number | null;
  status: SegmentComparisonStatus;
}) {
  if (input.status === "loading") {
    return "Generating…";
  }
  if (input.trayA == null || input.trayB == null) {
    return "Add two segments to compare";
  }
  if (input.generatedA == null || input.generatedB == null) {
    return "Generate comparison";
  }
  if (isSegmentComparisonStale(input)) {
    return "Update comparison";
  }
  return "Comparison up to date";
}

export function canExportSegmentComparison(
  status: SegmentComparisonStatus,
  stale: boolean,
  result: SegmentComparisonResult | null,
) {
  return status === "ready" && !stale && result != null && result.blockedReason == null;
}
