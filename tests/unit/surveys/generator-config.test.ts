import { describe, expect, it } from "vitest";
import { getGeneratorTargetConfigByConceptKey } from "@/features/surveys/generator-config";

describe("generator config", () => {
  it("uses the repaired thermal temporary-deviation facet for future generations", () => {
    const config = getGeneratorTargetConfigByConceptKey("thermal_comfort_norms");
    const facetKeys = config.semantic_guidance?.recommended_facets.map((facet) => facet.key) ?? [];

    expect(facetKeys).toContain("temporary_deviation_intolerance");
    expect(facetKeys).not.toContain("temporary_deviation_tolerance");
    expect(facetKeys).toContain("comfort_variation_boundary");
  });
});
