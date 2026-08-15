import type { SurveyAnalyticsSchema } from "@/features/surveys/survey-analytics";
import { normalizeSegmentDefinition } from "./normalize";
import {
  MAX_SEGMENT_CONDITIONS,
  MAX_SEGMENT_PAYLOAD_CHARS,
  SEGMENT_DEFINITION_VERSION,
  type SegmentCondition,
  type SegmentDefinition,
  type SegmentValidationIssue,
  type SegmentValidationResult,
} from "./types";

const SCORE_KINDS = new Set(["semantic_band", "numeric_range"]);

function fail(issue: SegmentValidationIssue, message: string): SegmentValidationResult {
  return { ok: false, issue, message };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBand(value: unknown): value is SegmentCondition extends { band: infer Band } ? Band : never {
  return value === "high" || value === "medium" || value === "low";
}

function validateConditionShape(condition: unknown): condition is SegmentCondition {
  if (typeof condition !== "object" || condition == null) {
    return false;
  }

  const candidate = condition as SegmentCondition;
  if (typeof candidate.kind !== "string" || typeof candidate.field !== "string" || !candidate.field.trim()) {
    return false;
  }

  switch (candidate.kind) {
    case "semantic_band":
      return isBand(candidate.band);
    case "numeric_range":
      return (
        isFiniteNumber(candidate.min) &&
        isFiniteNumber(candidate.max) &&
        candidate.min <= candidate.max
      );
    case "eq":
      return (
        typeof candidate.value === "string" ||
        typeof candidate.value === "number" ||
        typeof candidate.value === "boolean"
      );
    case "contains":
    case "not_contains":
      return typeof candidate.value === "string" || typeof candidate.value === "number";
    case "applicability":
      return typeof candidate.applicable === "boolean";
    case "date_range":
      return (
        typeof candidate.min === "string" &&
        typeof candidate.max === "string" &&
        candidate.min <= candidate.max
      );
    default:
      return false;
  }
}

function scoreConditionKey(condition: SegmentCondition) {
  if (SCORE_KINDS.has(condition.kind) || condition.kind === "applicability") {
    return `${condition.field}:${condition.kind === "applicability" ? "applicability" : "score"}`;
  }

  if (condition.kind === "eq" || condition.kind === "date_range") {
    return `${condition.field}:${condition.kind}`;
  }

  return null;
}

export function validateSegmentDefinition(
  input: unknown,
  schema: SurveyAnalyticsSchema,
  expected: { surveyId: string; measurementHash: string | null },
): SegmentValidationResult {
  if (typeof input !== "object" || input == null) {
    return fail("malformed", "The segment definition is not a valid object.");
  }

  const candidate = input as Partial<SegmentDefinition>;
  if (candidate.version !== SEGMENT_DEFINITION_VERSION) {
    return fail("unknown_version", "This segment uses an unknown contract version.");
  }

  if (typeof candidate.surveyId !== "string" || !candidate.surveyId.trim()) {
    return fail("malformed", "The segment definition is missing a survey.");
  }

  if (candidate.surveyId !== expected.surveyId || candidate.surveyId !== schema.survey_id) {
    return fail("survey_mismatch", "This segment belongs to a different survey.");
  }

  if (typeof candidate.schemaNamespace !== "string" || !candidate.schemaNamespace.trim()) {
    return fail("malformed", "The segment definition is missing a schema namespace.");
  }

  if (candidate.schemaNamespace !== schema.schema_namespace) {
    return fail("schema_mismatch", "This segment belongs to a different analytics schema.");
  }

  if (candidate.measurementHash !== schema.measurement_hash) {
    return fail(
      "measurement_hash_mismatch",
      "This segment was saved against a different measurement version.",
    );
  }

  if (expected.measurementHash !== schema.measurement_hash) {
    return fail(
      "measurement_hash_mismatch",
      "This segment was saved against a different measurement version.",
    );
  }

  if (!Array.isArray(candidate.conditions)) {
    return fail("malformed", "The segment definition conditions are invalid.");
  }

  if (candidate.conditions.length > MAX_SEGMENT_CONDITIONS) {
    return fail("too_many_conditions", `A segment can include at most ${MAX_SEGMENT_CONDITIONS} conditions.`);
  }

  const serialized = JSON.stringify(candidate);
  if (serialized.length > MAX_SEGMENT_PAYLOAD_CHARS) {
    return fail("payload_too_large", "This segment definition is too large to apply.");
  }

  const fieldsByKey = new Map(schema.fields.map((field) => [field.key, field]));
  const seenScoreKeys = new Set<string>();

  for (const condition of candidate.conditions) {
    if (!validateConditionShape(condition)) {
      return fail("invalid_condition", "A segment condition is malformed.");
    }

    const field = fieldsByKey.get(condition.field);
    if (!field) {
      return fail("unknown_field", `Unknown analytics field "${condition.field}".`);
    }

    if (condition.kind === "semantic_band" || condition.kind === "numeric_range") {
      if (field.value_type !== "number") {
        return fail("invalid_condition", `Field "${condition.field}" does not accept a numeric score filter.`);
      }
    }

    if (condition.kind === "eq" && !field.filter_operators.includes("eq")) {
      return fail("operator_not_allowed", `Equality is not allowed for "${condition.field}".`);
    }

    if (condition.kind === "contains" && !field.filter_operators.includes("contains")) {
      return fail("operator_not_allowed", `Contains is not allowed for "${condition.field}".`);
    }

    if (condition.kind === "not_contains" && !field.filter_operators.includes("not_contains")) {
      return fail("operator_not_allowed", `not_contains is not allowed for "${condition.field}".`);
    }

    if (condition.kind === "applicability") {
      if (!field.filter_operators.includes("is_null") || !field.filter_operators.includes("not_null")) {
        return fail("operator_not_allowed", `Applicability is not allowed for "${condition.field}".`);
      }
    }

    if (condition.kind === "date_range" && field.value_type !== "date") {
      return fail("invalid_condition", `Field "${condition.field}" does not accept a date range.`);
    }

    if (condition.kind === "numeric_range" && condition.min === 1 && condition.max === 5 && field.value_type === "number") {
      return fail("invalid_condition", "A full 1–5 range is not a segment condition.");
    }

    const scoreKey = scoreConditionKey(condition);
    if (scoreKey) {
      if (seenScoreKeys.has(scoreKey)) {
        return fail("duplicate_score_condition", `Field "${condition.field}" already has a condition of this type.`);
      }
      seenScoreKeys.add(scoreKey);
    }
  }

  return {
    ok: true,
    definition: normalizeSegmentDefinition({
      version: SEGMENT_DEFINITION_VERSION,
      surveyId: candidate.surveyId,
      schemaNamespace: candidate.schemaNamespace,
      measurementHash: candidate.measurementHash ?? null,
      conditions: candidate.conditions,
    }),
  };
}

export function sanitizeStoredSegmentDefinition(
  definition: unknown,
  schema: SurveyAnalyticsSchema,
) {
  const result = validateSegmentDefinition(definition, schema, {
    surveyId: schema.survey_id,
    measurementHash: schema.measurement_hash,
  });
  return result.ok ? result.definition : null;
}
