import { emptySegmentDefinition, normalizeSegmentDefinition } from "./normalize";
import type { SegmentBandKey, SegmentCondition, SegmentDefinition } from "./types";

function replaceFieldConditions(
  definition: SegmentDefinition,
  field: string,
  kinds: SegmentCondition["kind"][],
  next: SegmentCondition[],
): SegmentDefinition {
  return normalizeSegmentDefinition({
    ...definition,
    conditions: [
      ...definition.conditions.filter(
        (condition) => condition.field !== field || !kinds.includes(condition.kind),
      ),
      ...next,
    ],
  });
}

const SCORE_KINDS: SegmentCondition["kind"][] = ["semantic_band", "numeric_range", "applicability"];

export function toggleSemanticBand(
  definition: SegmentDefinition,
  field: string,
  band: SegmentBandKey,
): SegmentDefinition {
  const current = definition.conditions.find(
    (condition) => condition.field === field && condition.kind === "semantic_band",
  );
  if (current?.kind === "semantic_band" && current.band === band) {
    return replaceFieldConditions(definition, field, SCORE_KINDS, []);
  }

  return replaceFieldConditions(definition, field, SCORE_KINDS, [
    { kind: "semantic_band", field, band },
  ]);
}

export function setNumericRange(
  definition: SegmentDefinition,
  field: string,
  min: number,
  max: number,
  scale: { min?: number; max?: number; scaleMin?: number; scaleMax?: number } = { min: 1, max: 5 },
): SegmentDefinition {
  const scaleMin = scale.scaleMin ?? scale.min ?? 1;
  const scaleMax = scale.scaleMax ?? scale.max ?? 5;
  if (min === scaleMin && max === scaleMax) {
    return replaceFieldConditions(definition, field, SCORE_KINDS, []);
  }

  return replaceFieldConditions(definition, field, SCORE_KINDS, [
    { kind: "numeric_range", field, min, max },
  ]);
}

export function clearScoreCondition(definition: SegmentDefinition, field: string) {
  return replaceFieldConditions(definition, field, SCORE_KINDS, []);
}

export function setEquality(
  definition: SegmentDefinition,
  field: string,
  value: string | number | boolean | null,
): SegmentDefinition {
  if (value == null || value === "") {
    return replaceFieldConditions(definition, field, ["eq"], []);
  }

  return replaceFieldConditions(definition, field, ["eq"], [{ kind: "eq", field, value }]);
}

export function setInValues(
  definition: SegmentDefinition,
  field: string,
  values: Array<string | number | boolean>,
): SegmentDefinition {
  if (values.length === 0) {
    return replaceFieldConditions(definition, field, ["in"], []);
  }

  return replaceFieldConditions(definition, field, ["in"], [{ kind: "in", field, values }]);
}

export function toggleInValue(
  definition: SegmentDefinition,
  field: string,
  value: string | number | boolean,
  options?: { allValues?: Array<string | number | boolean> },
): SegmentDefinition {
  const existing = definition.conditions.find(
    (condition) => condition.field === field && condition.kind === "in",
  );
  const current = existing?.kind === "in" ? existing.values : [];
  const hasValue = current.includes(value);
  const next = hasValue ? current.filter((entry) => entry !== value) : [...current, value];

  if (next.length === 0) {
    return replaceFieldConditions(definition, field, ["in"], []);
  }

  const uniqueNext = Array.from(new Set(next));
  const allValues = options?.allValues;
  if (
    allValues &&
    allValues.length > 0 &&
    uniqueNext.length === Array.from(new Set(allValues)).length &&
    uniqueNext.every((entry) => allValues.includes(entry))
  ) {
    return replaceFieldConditions(definition, field, ["in"], []);
  }

  return replaceFieldConditions(definition, field, ["in"], [{ kind: "in", field, values: uniqueNext }]);
}

export function toggleMembership(
  definition: SegmentDefinition,
  field: string,
  value: string | number,
  mode: "contains" | "not_contains",
): SegmentDefinition {
  const existing = definition.conditions.find(
    (condition) =>
      condition.field === field &&
      (condition.kind === "contains" || condition.kind === "not_contains") &&
      condition.value === value,
  );

  const withoutValue = definition.conditions.filter(
    (condition) =>
      !(
        condition.field === field &&
        (condition.kind === "contains" || condition.kind === "not_contains") &&
        condition.value === value
      ),
  );

  if (existing?.kind === mode) {
    return normalizeSegmentDefinition({ ...definition, conditions: withoutValue });
  }

  return normalizeSegmentDefinition({
    ...definition,
    conditions: [...withoutValue, { kind: mode, field, value }],
  });
}

export function setApplicability(
  definition: SegmentDefinition,
  field: string,
  applicable: boolean | null,
): SegmentDefinition {
  if (applicable == null) {
    return replaceFieldConditions(definition, field, SCORE_KINDS, []);
  }

  return replaceFieldConditions(definition, field, SCORE_KINDS, [
    { kind: "applicability", field, applicable },
  ]);
}

export function setDateRange(
  definition: SegmentDefinition,
  field: string,
  min: string | null,
  max: string | null,
): SegmentDefinition {
  if (!min || !max) {
    return replaceFieldConditions(definition, field, ["date_range"], []);
  }

  return replaceFieldConditions(definition, field, ["date_range"], [
    { kind: "date_range", field, min, max },
  ]);
}

export function removeConditionAt(definition: SegmentDefinition, index: number) {
  return normalizeSegmentDefinition({
    ...definition,
    conditions: definition.conditions.filter((_, current) => current !== index),
  });
}

export function resetSegmentDefinition(definition: SegmentDefinition) {
  return emptySegmentDefinition(definition);
}

export function scoreControlMode(
  preferred: "band" | "range",
  band: SegmentBandKey | null,
  range: { min: number; max: number } | null,
): "band" | "range" {
  if (range) {
    return "range";
  }
  if (band) {
    return "band";
  }
  return preferred;
}

export function getFieldBand(definition: SegmentDefinition, field: string): SegmentBandKey | null {
  const condition = definition.conditions.find(
    (entry) => entry.field === field && entry.kind === "semantic_band",
  );
  return condition?.kind === "semantic_band" ? condition.band : null;
}

export function getFieldRange(definition: SegmentDefinition, field: string) {
  const condition = definition.conditions.find(
    (entry) => entry.field === field && entry.kind === "numeric_range",
  );
  return condition?.kind === "numeric_range" ? { min: condition.min, max: condition.max } : null;
}

export function getFieldEquality(definition: SegmentDefinition, field: string) {
  const condition = definition.conditions.find((entry) => entry.field === field && entry.kind === "eq");
  return condition?.kind === "eq" ? condition.value : null;
}

export function getFieldInValues(definition: SegmentDefinition, field: string) {
  const condition = definition.conditions.find((entry) => entry.field === field && entry.kind === "in");
  return condition?.kind === "in" ? condition.values : [];
}

export function getMembershipValues(
  definition: SegmentDefinition,
  field: string,
  mode: "contains" | "not_contains",
) {
  return definition.conditions
    .filter((condition) => condition.field === field && condition.kind === mode)
    .map((condition) => (condition.kind === mode ? condition.value : null))
    .filter((value): value is string | number => value != null);
}

export function getFieldApplicability(definition: SegmentDefinition, field: string) {
  const condition = definition.conditions.find(
    (entry) => entry.field === field && entry.kind === "applicability",
  );
  return condition?.kind === "applicability" ? condition.applicable : null;
}
