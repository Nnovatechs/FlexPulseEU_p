import { flexpulsePrimaryProfileAxisKeys } from "@/features/ontology/flexpulse-behavioural-schema";
import { ensureDeclaredFlexibilityCapabilityDependencies } from "./declared-flexibility-capability-module";

export function resolveGenerateBehaviouralConceptKeys(
  submittedConceptKeys: Iterable<string>,
): string[] {
  const extras = Array.from(submittedConceptKeys)
    .map((value) => value.trim())
    .filter(Boolean);

  return ensureDeclaredFlexibilityCapabilityDependencies([
    ...new Set([...flexpulsePrimaryProfileAxisKeys, ...extras]),
  ]);
}
