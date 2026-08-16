import type { SurveyAnalyticsFilter } from "@/features/surveys/survey-analytics";
import type { SegmentCondition, SegmentDefinition } from "./types";

const HIGH_MIN = 4;
const LOW_MAX = 2;
const MEDIUM_LOWER = 2;
const MEDIUM_UPPER = 4;

export function compileSegmentCondition(condition: SegmentCondition): SurveyAnalyticsFilter[] {
  switch (condition.kind) {
    case "semantic_band":
      if (condition.band === "high") {
        return [{ field: condition.field, op: "gte", value: HIGH_MIN }];
      }
      if (condition.band === "low") {
        return [{ field: condition.field, op: "lte", value: LOW_MAX }];
      }
      return [
        { field: condition.field, op: "gt", value: MEDIUM_LOWER },
        { field: condition.field, op: "lt", value: MEDIUM_UPPER },
      ];
    case "numeric_range":
      return [{ field: condition.field, op: "between", value: [condition.min, condition.max] }];
    case "eq":
      return [{ field: condition.field, op: "eq", value: condition.value }];
    case "contains":
      return [{ field: condition.field, op: "contains", value: condition.value }];
    case "not_contains":
      return [{ field: condition.field, op: "not_contains", value: condition.value }];
    case "applicability":
      return [
        {
          field: condition.field,
          op: condition.applicable ? "not_null" : "is_null",
          value: null,
        },
      ];
    case "date_range": {
      const bounds = utcInclusiveDateBounds(condition.min, condition.max);
      return [
        { field: condition.field, op: "gte", value: bounds.startInclusive },
        { field: condition.field, op: "lt", value: bounds.endExclusive },
      ];
    }
  }
}

export function utcInclusiveDateBounds(min: string, max: string) {
  return {
    startInclusive: toUtcDayStartIso(min),
    endExclusive: toUtcNextDayStartIso(max),
  };
}

function toUtcDayStartIso(value: string) {
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return value;
  }
  return `${day}T00:00:00.000Z`;
}

function toUtcNextDayStartIso(value: string) {
  const start = Date.parse(toUtcDayStartIso(value));
  if (Number.isNaN(start)) {
    return value;
  }
  return new Date(start + 24 * 60 * 60 * 1000).toISOString();
}

export function compileSegmentDefinition(definition: SegmentDefinition): SurveyAnalyticsFilter[] {
  return definition.conditions.flatMap(compileSegmentCondition);
}
