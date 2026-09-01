export const SEGMENT_SEMANTIC_MIN_N = 5;

export const SEMANTIC_INSUFFICIENT_EVIDENCE =
  "Not enough comparable evidence for a semantic reading. Descriptive results remain available.";

export function hasSemanticComparisonN(segmentN: number, outsideN: number) {
  return segmentN >= SEGMENT_SEMANTIC_MIN_N && outsideN >= SEGMENT_SEMANTIC_MIN_N;
}

export function hasSemanticInternalN(segmentN: number) {
  return segmentN >= SEGMENT_SEMANTIC_MIN_N;
}
