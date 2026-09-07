import type { SurveyAnalyticsSchema } from "@/features/surveys/survey-analytics";
import {
  formatVisibleDate,
  getAssetValueLabel,
  getBandLabel,
  getChoiceValueLabel,
  getFieldLabel,
  type SegmentLabelContext,
} from "./labels";
import { getHouseholdConditionValueLabel, isHouseholdConditionField, isOwnedDerAssetsField } from "./household-conditions";
import type { SegmentCondition, SegmentDefinition } from "./types";

export function segmentLabelContext(schema: SurveyAnalyticsSchema): SegmentLabelContext {
  return {
    schemaNamespace: schema.schema_namespace,
    schemaVersion: schema.schema_version ?? 1,
    fields: schema.fields,
  };
}

function conditionValueLabel(condition: SegmentCondition, context: SegmentLabelContext) {
  const field = context.fields.find((candidate) => candidate.key === condition.field);
  const raw = "value" in condition ? String(condition.value) : "";
  if (field?.concept_key && (isOwnedDerAssetsField(field) || isHouseholdConditionField(field))) {
    return isOwnedDerAssetsField(field)
      ? getAssetValueLabel(raw)
      : getHouseholdConditionValueLabel(field.concept_key, raw);
  }
  return getChoiceValueLabel(raw);
}

export function describeSegmentCondition(condition: SegmentCondition, context: SegmentLabelContext) {
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
    case "in": {
      const visible = condition.values.slice(0, 3).map((value) =>
        conditionValueLabel({ kind: "eq", field: condition.field, value }, context),
      );
      const suffix =
        condition.values.length > visible.length ? ` +${condition.values.length - visible.length} more` : "";
      return { label, detail: `Includes ${visible.join(", ")}${suffix}` };
    }
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

export function describeReadableConditions(
  definition: SegmentDefinition,
  schema: SurveyAnalyticsSchema,
) {
  const context = segmentLabelContext(schema);
  return definition.conditions.map((condition) => ({
    field: condition.field,
    ...describeSegmentCondition(condition, context),
    defining: true as const,
  }));
}
