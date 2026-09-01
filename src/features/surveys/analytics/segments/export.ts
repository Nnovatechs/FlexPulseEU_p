import type { SurveyAnalyticsSchema } from "@/features/surveys/survey-analytics";
import type { SegmentAnalysisResult } from "./types";

export const SEGMENT_ANALYSIS_EXPORT_VERSION = "segment-analysis-export-v1";
export const SEGMENT_ANALYSIS_VERSION = "segment-analysis-v1";
export const SEGMENT_ANALYSIS_METHODOLOGY_VERSION = "v1";

export type SegmentAnalysisExportEnvelope = {
  exportVersion: string;
  analysisVersion: string;
  methodologyVersion: string;
  generatedAt: string;
  schemaNamespace: string;
  schemaVersion: number;
  measurementHash: string | null;
  analysis: SegmentAnalysisResult;
};

const SENSITIVE_IDENTITY =
  /"response_id"|"responseId"|"answers_json"|"mapper_output"|prolific|"audience_token"/i;

export function segmentAnalysisExportContainsSensitiveField(payload: unknown) {
  const serialized = JSON.stringify(payload);
  return serialized == null || SENSITIVE_IDENTITY.test(serialized);
}

export function buildSegmentAnalysisExport(input: {
  analysis: SegmentAnalysisResult;
  schema: SurveyAnalyticsSchema;
  generatedAt?: string;
}) {
  const envelope: SegmentAnalysisExportEnvelope = {
    exportVersion: SEGMENT_ANALYSIS_EXPORT_VERSION,
    analysisVersion: SEGMENT_ANALYSIS_VERSION,
    methodologyVersion: SEGMENT_ANALYSIS_METHODOLOGY_VERSION,
    generatedAt: input.generatedAt ?? input.analysis.generatedAt,
    schemaNamespace: input.schema.schema_namespace,
    schemaVersion: input.schema.schema_version ?? 1,
    measurementHash: input.schema.measurement_hash,
    analysis: input.analysis,
  };

  if (segmentAnalysisExportContainsSensitiveField(envelope)) {
    throw new Error("Segment analysis export blocked: payload contains a sensitive field.");
  }

  const surveyId = input.schema.survey_id || input.analysis.definition.surveyId || "survey";
  const generated = envelope.generatedAt.slice(0, 19).replace(/[:T]/g, "-");

  return {
    filename: `segment-analysis-${surveyId}-${generated}.json`,
    body: JSON.stringify(envelope, null, 2),
    envelope,
  };
}
