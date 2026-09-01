"use server";

import { runSegmentExplorerSummary, runSegmentPostalMapPreview, runSegmentSamplePreview } from "./use-cases";
import type { SegmentAnalysisResult, SegmentDefinition, SegmentSamplePreview } from "./analytics/segments";
import type { PostalMapAnalysis } from "./analytics/geography/postal-map-types";

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

export async function previewSegmentSampleAction(
  surveyId: string,
  definition: SegmentDefinition,
): Promise<SegmentSamplePreview> {
  const trimmedSurveyId = surveyId.trim();
  if (!trimmedSurveyId) {
    throw new Error("Survey ID is required.");
  }

  return runSegmentSamplePreview(trimmedSurveyId, definition);
}

export async function previewSegmentPostalMapAction(
  surveyId: string,
  definition: SegmentDefinition,
): Promise<PostalMapAnalysis | null> {
  const trimmedSurveyId = surveyId.trim();
  if (!trimmedSurveyId) {
    throw new Error("Survey ID is required.");
  }

  return runSegmentPostalMapPreview(trimmedSurveyId, definition);
}
