import type { SurveyAnalyticsSchema } from "@/features/surveys/survey-analytics";
import type { SegmentDefinition, SegmentValidationResult } from "./types";
import { validateSegmentDefinition } from "./validation";

export function commitSegmentDefinition(input: {
  next: SegmentDefinition;
  schema: SurveyAnalyticsSchema;
}): SegmentValidationResult {
  return validateSegmentDefinition(input.next, input.schema, {
    surveyId: input.schema.survey_id,
    measurementHash: input.schema.measurement_hash,
  });
}
