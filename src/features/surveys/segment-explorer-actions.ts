"use server";

import { runSegmentExplorerSummary } from "./use-cases";
import type { SegmentDefinition, SegmentExplorerSummary } from "./analytics/segments";

export async function runSegmentExplorerAction(
  surveyId: string,
  definition: SegmentDefinition,
): Promise<SegmentExplorerSummary> {
  const trimmedSurveyId = surveyId.trim();
  if (!trimmedSurveyId) {
    throw new Error("Survey ID is required.");
  }

  return runSegmentExplorerSummary(trimmedSurveyId, definition);
}
