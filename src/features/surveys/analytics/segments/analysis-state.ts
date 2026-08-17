import { isWholeSampleDefinition, segmentDefinitionsEqual } from "./normalize";
import type { SegmentDefinition } from "./types";


export type SegmentAnalysisStatus = "idle" | "loading" | "ready" | "error";

export function isSegmentAnalysisStale(
  draft: SegmentDefinition,
  analysed: SegmentDefinition | null,
) {
  return analysed != null && !segmentDefinitionsEqual(draft, analysed);
}

export function canRunSegmentAnalysis(
  draft: SegmentDefinition,
  analysed: SegmentDefinition | null,
  status: SegmentAnalysisStatus,
) {
  return status !== "loading" && (analysed == null || !segmentDefinitionsEqual(draft, analysed));
}

export function getAnalyseActionLabel(
  draft: SegmentDefinition,
  analysed: SegmentDefinition | null,
  status: SegmentAnalysisStatus,
) {
  if (status === "loading") {
    return "Analysing…";
  }
  if (analysed && !isSegmentAnalysisStale(draft, analysed)) {
    return "Analysis up to date";
  }
  if (analysed) {
    return "Update analysis";
  }
  return isWholeSampleDefinition(draft) ? "Analyse whole sample" : "Analyse segment";
}
