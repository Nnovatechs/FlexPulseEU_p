"use server";

import { runSegmentComparison } from "./use-cases";
import type { SegmentComparisonResult, SegmentDefinition } from "./analytics/segments";

export async function runSegmentComparisonAction(
  surveyId: string,
  definitionA: SegmentDefinition,
  definitionB: SegmentDefinition,
): Promise<SegmentComparisonResult> {
  const trimmedSurveyId = surveyId.trim();
  if (!trimmedSurveyId) {
    throw new Error("Survey ID is required.");
  }

  return runSegmentComparison(trimmedSurveyId, definitionA, definitionB);
}
