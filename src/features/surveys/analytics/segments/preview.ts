import {
  applySurveyAnalyticsFilters,
  type SurveyAnalyticsRecord,
  type SurveyAnalyticsSchema,
} from "@/features/surveys/survey-analytics";
import { compileSegmentDefinition } from "./compiler";
import type { SegmentDefinition } from "./types";

export type SegmentSamplePreview = {
  matchedN: number;
  outsideN: number;
  analysedN: number;
  share: number | null;
};

export function previewSegmentSample(input: {
  schema: SurveyAnalyticsSchema;
  rows: SurveyAnalyticsRecord[];
  definition: SegmentDefinition;
}): SegmentSamplePreview {
  const selected = applySurveyAnalyticsFilters({
    schema: input.schema,
    rows: input.rows,
    filters: compileSegmentDefinition(input.definition),
  });
  const matchedN = selected.length;
  const analysedN = input.rows.length;
  return {
    matchedN,
    analysedN,
    outsideN: analysedN - matchedN,
    share: analysedN === 0 ? null : matchedN / analysedN,
  };
}
