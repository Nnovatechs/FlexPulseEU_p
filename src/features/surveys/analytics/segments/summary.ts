import { buildSegmentAnalysis } from "./analysis";
import { describeReadableConditions } from "./readable-conditions";
import type { SegmentDefinition, SegmentExplorerSummary } from "./types";
import type { SurveyAnalyticsRecord, SurveyAnalyticsSchema } from "@/features/surveys/survey-analytics";

export function buildSegmentExplorerSummary(input: {
  schema: SurveyAnalyticsSchema;
  rows: SurveyAnalyticsRecord[];
  definition: SegmentDefinition;
}): SegmentExplorerSummary {
  const analysis = buildSegmentAnalysis(input);
  return {
    definition: analysis.definition,
    matchedN: analysis.sample.selectedN,
    analysedN: analysis.sample.analysedN,
    share: analysis.sample.share,
    readableConditions: describeReadableConditions(input.definition, input.schema),
    axes: analysis.profileAxes.map((axis) => ({
      conceptKey: axis.conceptKey,
      label: axis.label,
      directionNote: axis.directionNote,
      defining: axis.defining,
      applicableN: axis.applicableN,
      median: axis.median,
      q1: axis.q1,
      q3: axis.q3,
      bands: axis.bands,
    })),
  };
}

export function assertAggregateSegmentDto(summary: SegmentExplorerSummary) {
  const serialized = JSON.stringify(summary);
  return {
    hasResponseId: serialized.includes("response_id") || serialized.includes("responseId"),
    hasAnswers: serialized.includes("answers_json") || serialized.includes("answers"),
    hasMapperOutput: serialized.includes("mapper_output"),
  };
}
