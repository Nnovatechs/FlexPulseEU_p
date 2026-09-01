import { describe, expect, it } from "vitest";
import { buildPostalMapBaseline, POSTAL_AREA_KEY_FIELD } from "@/features/surveys/analytics/geography/postal-map-baseline";
import type { SegmentDefinition } from "@/features/surveys/analytics/segments";

function definition(conditions: SegmentDefinition["conditions"]): SegmentDefinition {
  return {
    version: 1,
    surveyId: "survey-1",
    schemaNamespace: "flexpulse_behavioural_schema",
    measurementHash: "measure-1",
    conditions,
  };
}

describe("postal map baseline", () => {
  it("keeps the same baseline key when only postal selections change", () => {
    const first = buildPostalMapBaseline(
      definition([{ kind: "in", field: POSTAL_AREA_KEY_FIELD, values: ["IE:postal_area:D02"] }]),
    );
    const second = buildPostalMapBaseline(
      definition([{ kind: "in", field: POSTAL_AREA_KEY_FIELD, values: ["IE:postal_area:D02", "IE:postal_area:D04"] }]),
    );

    expect(first.key).toBe(second.key);
    expect(first.definition.conditions).toEqual([]);
    expect(second.definition.conditions).toEqual([]);
  });

  it("changes the baseline key when a non-geographic filter changes", () => {
    const first = buildPostalMapBaseline(
      definition([{ kind: "semantic_band", field: "profile.trust_in_automation.value", band: "high" }]),
    );
    const second = buildPostalMapBaseline(
      definition([{ kind: "semantic_band", field: "profile.trust_in_automation.value", band: "low" }]),
    );

    expect(first.key).not.toBe(second.key);
  });
});
