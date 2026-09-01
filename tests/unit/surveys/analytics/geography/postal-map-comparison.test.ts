import { describe, expect, it } from "vitest";
import { buildPostalMapComparison } from "@/features/surveys/analytics/geography/postal-map-comparison";
import type { PostalMapAnalysis } from "@/features/surveys/analytics/geography/postal-map-types";

function analysis(input: {
  eligibleN: number;
  mappedN: number;
  areas: Array<{ areaKey: string; countryCode: "ES" | "FR" | "IE"; postalPrefix: string; label: string; n: number }>;
}): PostalMapAnalysis {
  return {
    geographyVersion: "v1",
    coverage: {
      eligibleN: input.eligibleN,
      mappedN: input.mappedN,
      unmappedN: input.eligibleN - input.mappedN,
      mappedShare: input.eligibleN === 0 ? 0 : input.mappedN / input.eligibleN,
    },
    areas: input.areas.map((area) => ({
      ...area,
      shareOfMapped: input.mappedN === 0 ? 0 : area.n / input.mappedN,
      shareOfEligible: input.eligibleN === 0 ? 0 : area.n / input.eligibleN,
    })),
  };
}

describe("postal map comparison", () => {
  it("normalises by mappedN so equal distributions yield zero delta even at different sizes", () => {
    const result = buildPostalMapComparison(
      analysis({
        eligibleN: 50,
        mappedN: 40,
        areas: [
          { areaKey: "IE:postal_area:D02", countryCode: "IE", postalPrefix: "D02", label: "Dublin 2", n: 20 },
          { areaKey: "IE:postal_area:D04", countryCode: "IE", postalPrefix: "D04", label: "Dublin 4", n: 20 },
        ],
      }),
      analysis({
        eligibleN: 20,
        mappedN: 10,
        areas: [
          { areaKey: "IE:postal_area:D02", countryCode: "IE", postalPrefix: "D02", label: "Dublin 2", n: 5 },
          { areaKey: "IE:postal_area:D04", countryCode: "IE", postalPrefix: "D04", label: "Dublin 4", n: 5 },
        ],
      }),
    );

    expect(result?.areas.every((area) => area.deltaPercentagePoints === 0)).toBe(true);
  });

  it("keeps exclusive areas and zero-fills the other segment", () => {
    const result = buildPostalMapComparison(
      analysis({
        eligibleN: 10,
        mappedN: 10,
        areas: [{ areaKey: "ES:postal_area:28", countryCode: "ES", postalPrefix: "28", label: "Madrid", n: 10 }],
      }),
      analysis({
        eligibleN: 10,
        mappedN: 10,
        areas: [{ areaKey: "ES:postal_area:08", countryCode: "ES", postalPrefix: "08", label: "Barcelona", n: 10 }],
      }),
    );

    expect(result?.areas).toEqual([
      expect.objectContaining({ areaKey: "ES:postal_area:08", nA: 0, nB: 10, shareA: 0, shareB: 1 }),
      expect.objectContaining({ areaKey: "ES:postal_area:28", nA: 10, nB: 0, shareA: 1, shareB: 0 }),
    ]);
  });
});
