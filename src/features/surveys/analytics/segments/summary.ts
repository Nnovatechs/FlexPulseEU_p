import { computeLinearQuantile } from "@/features/surveys/analytics/descriptive-stats";
import { getOverviewBandFromScore } from "@/features/surveys/analytics/overview-semantics";
import {
  applySurveyAnalyticsFilters,
  type SurveyAnalyticsRecord,
  type SurveyAnalyticsSchema,
} from "@/features/surveys/survey-analytics";
import { compileSegmentDefinition } from "./compiler";
import {
  formatVisibleDate,
  getAssetValueLabel,
  getBandLabel,
  getChoiceValueLabel,
  getConceptLabel,
  getFieldLabel,
  getScoreDirectionNote,
  type SegmentLabelContext,
} from "./labels";
import type {
  SegmentBandKey,
  SegmentCondition,
  SegmentDefinition,
  SegmentExplorerSummary,
  SegmentProfileAxis,
} from "./types";

function labelContext(schema: SurveyAnalyticsSchema): SegmentLabelContext {
  return {
    schemaNamespace: schema.schema_namespace,
    schemaVersion: 1,
    fields: schema.fields,
  };
}

function conditionValueLabel(condition: SegmentCondition, context: SegmentLabelContext) {
  const field = context.fields.find((candidate) => candidate.key === condition.field);
  const raw = "value" in condition ? String(condition.value) : "";
  if (field?.concept_key === "owned_der_assets" || condition.field.includes("owned_der_assets")) {
    return getAssetValueLabel(raw);
  }
  return getChoiceValueLabel(raw);
}

function describeCondition(condition: SegmentCondition, context: SegmentLabelContext) {
  const label = getFieldLabel(condition.field, context);
  switch (condition.kind) {
    case "semantic_band": {
      const field = context.fields.find((candidate) => candidate.key === condition.field);
      const bandLabel = field?.concept_key
        ? getBandLabel(field.concept_key, condition.band, context)
        : condition.band;
      return { label, detail: `Semantic band: ${bandLabel}` };
    }
    case "numeric_range":
      return { label, detail: `Range ${condition.min}–${condition.max}` };
    case "eq":
      return { label, detail: `Equals ${conditionValueLabel(condition, context)}` };
    case "contains":
      return { label, detail: `Has ${conditionValueLabel(condition, context)}` };
    case "not_contains":
      return { label, detail: `Does not have ${conditionValueLabel(condition, context)}` };
    case "applicability":
      return { label, detail: condition.applicable ? "Applicable" : "Not applicable" };
    case "date_range":
      return {
        label,
        detail: `${formatVisibleDate(condition.min)} → ${formatVisibleDate(condition.max)}`,
      };
  }
}

function definingFields(definition: SegmentDefinition) {
  return new Set(definition.conditions.map((condition) => condition.field));
}

function buildAxis(
  conceptKey: string,
  rows: SurveyAnalyticsRecord[],
  context: SegmentLabelContext,
  defining: boolean,
): SegmentProfileAxis | null {
  const values = rows
    .map((row) => {
      const entry = row.mapper_output.profile[conceptKey];
      return typeof entry?.value === "number" && Number.isFinite(entry.value) ? entry.value : null;
    })
    .filter((value): value is number => value != null)
    .sort((left, right) => left - right);

  if (values.length === 0) {
    return null;
  }

  const bandCounts = { high: 0, medium: 0, low: 0 } satisfies Record<SegmentBandKey, number>;
  for (const value of values) {
    bandCounts[getOverviewBandFromScore(value)] += 1;
  }

  return {
    conceptKey,
    label: getConceptLabel(conceptKey, context),
    directionNote: getScoreDirectionNote(conceptKey, context),
    defining,
    applicableN: values.length,
    median: computeLinearQuantile(values, 0.5) ?? 0,
    q1: computeLinearQuantile(values, 0.25) ?? 0,
    q3: computeLinearQuantile(values, 0.75) ?? 0,
    bands: (["high", "medium", "low"] as const).map((band) => ({
      key: band,
      label: getBandLabel(conceptKey, band, context),
      count: bandCounts[band],
      share: bandCounts[band] / values.length,
    })),
  };
}

export function buildSegmentExplorerSummary(input: {
  schema: SurveyAnalyticsSchema;
  rows: SurveyAnalyticsRecord[];
  definition: SegmentDefinition;
}): SegmentExplorerSummary {
  const context = labelContext(input.schema);
  const filters = compileSegmentDefinition(input.definition);
  const matched = applySurveyAnalyticsFilters({
    schema: input.schema,
    rows: input.rows,
    filters,
  });
  const defining = definingFields(input.definition);
  const axes = input.schema.fields
    .filter(
      (field) =>
        field.concept_role === "primary_profile_axis" &&
        field.value_type === "number" &&
        !field.facet &&
        field.key.endsWith(".value") &&
        field.concept_key,
    )
    .map((field) =>
      buildAxis(
        field.concept_key as string,
        matched,
        context,
        defining.has(field.key) ||
          input.definition.conditions.some(
            (condition) => condition.field.startsWith(`profile.${field.concept_key}.`),
          ),
      ),
    )
    .filter((axis): axis is SegmentProfileAxis => axis != null);

  return {
    definition: input.definition,
    matchedN: matched.length,
    analysedN: input.rows.length,
    share: input.rows.length === 0 ? null : matched.length / input.rows.length,
    readableConditions: input.definition.conditions.map((condition) => ({
      field: condition.field,
      ...describeCondition(condition, context),
      defining: true as const,
    })),
    axes,
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
