import { createHash } from "node:crypto";
import {
  CompiledMappingContract,
  MappingContract,
  MeasurementPlan,
  SurveyMappingDefinition,
} from "./generator-types";

function sortValueRecursively(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValueRecursively);
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = sortValueRecursively(
          (value as Record<string, unknown>)[key],
        );
        return accumulator;
      }, {});
  }

  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValueRecursively(value));
}

export function compileMappingContract(
  contract: MappingContract,
): CompiledMappingContract {
  const byQuestionKey = contract.mappings.reduce<
    Record<string, SurveyMappingDefinition>
  >((accumulator, mapping) => {
    accumulator[mapping.question_key] = mapping;
    return accumulator;
  }, {});

  return {
    schema_version: 1,
    by_question_key: byQuestionKey,
    question_keys: Object.keys(byQuestionKey),
  };
}

export function computeMappingHash(contract: MappingContract): string {
  return createHash("sha256")
    .update(stableStringify(contract))
    .digest("hex");
}

export function computeMeasurementHash(measurementPlan: MeasurementPlan): string {
  return createHash("sha256")
    .update(stableStringify(measurementPlan))
    .digest("hex");
}
