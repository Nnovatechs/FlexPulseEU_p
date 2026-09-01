import type { SurveyAnalyticsSchema } from "@/features/surveys/survey-analytics";
import type { SegmentComparisonResult } from "./comparison-types";

export const SEGMENT_COMPARISON_EXPORT_VERSION = "segment-comparison-export-v1";
export const SEGMENT_COMPARISON_VERSION = "segment-comparison-v1";
export const SEGMENT_COMPARISON_METHODOLOGY_VERSION = "v1";

export type SegmentComparisonExportEnvelope = {
  exportVersion: string;
  analysisVersion: string;
  methodologyVersion: string;
  generatedAt: string;
  schemaNamespace: string;
  schemaVersion: number;
  measurementHash: string | null;
  comparison: SegmentComparisonResult;
};

const SENSITIVE_IDENTITY =
  /"response_id"|"responseId"|"answers_json"|"mapper_output"|prolific|"audience_token"/i;

export function segmentComparisonExportContainsSensitiveField(payload: unknown) {
  const serialized = JSON.stringify(payload);
  return serialized == null || SENSITIVE_IDENTITY.test(serialized);
}

export function buildSegmentComparisonExport(input: {
  comparison: SegmentComparisonResult;
  schema: SurveyAnalyticsSchema;
  generatedAt?: string;
}) {
  const envelope: SegmentComparisonExportEnvelope = {
    exportVersion: SEGMENT_COMPARISON_EXPORT_VERSION,
    analysisVersion: SEGMENT_COMPARISON_VERSION,
    methodologyVersion: SEGMENT_COMPARISON_METHODOLOGY_VERSION,
    generatedAt: input.generatedAt ?? input.comparison.generatedAt,
    schemaNamespace: input.schema.schema_namespace,
    schemaVersion: input.schema.schema_version ?? 1,
    measurementHash: input.schema.measurement_hash,
    comparison: input.comparison,
  };

  if (segmentComparisonExportContainsSensitiveField(envelope)) {
    throw new Error("Segment comparison export blocked: payload contains a sensitive field.");
  }

  const surveyId = input.schema.survey_id || input.comparison.definitionA.surveyId || "survey";
  const generated = envelope.generatedAt.slice(0, 19).replace(/[:T]/g, "-");

  return {
    filename: `segment-comparison-${surveyId}-${generated}.json`,
    body: JSON.stringify(envelope, null, 2),
    envelope,
  };
}
