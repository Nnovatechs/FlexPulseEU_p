import { describe, expect, it } from "vitest";
import { flexpulsePrimaryProfileAxisKeys } from "@/features/ontology/flexpulse-behavioural-schema";
import { resolveGenerateBehaviouralConceptKeys } from "@/features/surveys/generate-concept-keys";

describe("resolveGenerateBehaviouralConceptKeys", () => {
  it("restores the seven primary axes and the DFC inventory dependency", () => {
    expect(resolveGenerateBehaviouralConceptKeys([])).toEqual([
      ...flexpulsePrimaryProfileAxisKeys,
      "owned_der_assets",
    ]);
  });

  it("keeps optional extras after the baseline and deduplicates submitted keys", () => {
    expect(
      resolveGenerateBehaviouralConceptKeys([
        "manual_override_need",
        "awareness_of_energy_systems",
        " manual_override_need ",
      ]),
    ).toEqual([
      ...flexpulsePrimaryProfileAxisKeys,
      "manual_override_need",
      "owned_der_assets",
    ]);
  });
});
