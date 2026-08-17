"use server";

import { runSegmentExplorerSummary } from "./use-cases";
import type { SegmentAnalysisResult, SegmentDefinition } from "./analytics/segments";

export async function runSegmentExplorerAction(
  surveyId: string,
  definition: SegmentDefinition,
): Promise<SegmentAnalysisResult> {
  const trimmedSurveyId = surveyId.trim();
  if (!trimmedSurveyId) {
    throw new Error("Survey ID is required.");
  }

  return runSegmentExplorerSummary(trimmedSurveyId, definition);
}
