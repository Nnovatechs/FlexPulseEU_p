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

  it("uses the calibrated 2°C for 2 hours flexibility thermal scenario", () => {
    const config = getGeneratorTargetConfigByConceptKey("flexibility_willingness");
    const thermalFacet = config.semantic_guidance?.recommended_facets.find(
      (facet) => facet.key === "temporary_thermal_adjustment_acceptance",
    );

    expect(thermalFacet?.meaning).toContain("2°C for 2 hours");
    expect(thermalFacet?.meaning).not.toContain("1°C for 1 hour");
  });

  it("keeps thermal comfort guidance at 1°C/1 hour and 2°C/1 hour", () => {
    const config = getGeneratorTargetConfigByConceptKey("thermal_comfort_norms");
    const facets = Object.fromEntries(
      (config.semantic_guidance?.recommended_facets ?? []).map((facet) => [
        facet.key,
        facet.meaning,
      ]),
    );

    expect(facets.temporary_deviation_intolerance).toContain("1°C for 1 hour");
    expect(facets.recovery_expectation).toContain("1°C for 1 hour");
    expect(facets.comfort_variation_boundary).toContain("2°C for 1 hour");
  });
});
