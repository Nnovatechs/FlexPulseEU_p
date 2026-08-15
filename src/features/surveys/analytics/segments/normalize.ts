import type { SegmentCondition, SegmentDefinition } from "./types";
import { SEGMENT_DEFINITION_VERSION } from "./types";

function compareUnknown(left: unknown, right: unknown) {
  const leftValue = JSON.stringify(left) ?? "";
  const rightValue = JSON.stringify(right) ?? "";
  return leftValue.localeCompare(rightValue);
}

export function compareSegmentConditions(left: SegmentCondition, right: SegmentCondition) {
  const fieldOrder = left.field.localeCompare(right.field);
  if (fieldOrder !== 0) {
    return fieldOrder;
  }

  const kindOrder = left.kind.localeCompare(right.kind);
  if (kindOrder !== 0) {
    return kindOrder;
  }

  return compareUnknown(left, right);
}

export function normalizeSegmentDefinition(definition: SegmentDefinition): SegmentDefinition {
  return {
    version: SEGMENT_DEFINITION_VERSION,
    surveyId: definition.surveyId,
    schemaNamespace: definition.schemaNamespace,
    measurementHash: definition.measurementHash,
    conditions: definition.conditions.slice().sort(compareSegmentConditions),
  };
}

export function emptySegmentDefinition(input: {
  surveyId: string;
  schemaNamespace: string;
  measurementHash: string | null;
}): SegmentDefinition {
  return normalizeSegmentDefinition({
    version: SEGMENT_DEFINITION_VERSION,
    surveyId: input.surveyId,
    schemaNamespace: input.schemaNamespace,
    measurementHash: input.measurementHash,
    conditions: [],
  });
}

export function segmentDefinitionsEqual(left: SegmentDefinition, right: SegmentDefinition) {
  return JSON.stringify(normalizeSegmentDefinition(left)) === JSON.stringify(normalizeSegmentDefinition(right));
}

export function isWholeSampleDefinition(definition: SegmentDefinition) {
  return definition.conditions.length === 0;
}
