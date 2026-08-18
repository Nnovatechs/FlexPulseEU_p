import type { PostalMapAnalysis, PostalMapComparison } from "./postal-map-types";

export function buildPostalMapComparison(
  analysisA: PostalMapAnalysis | null,
  analysisB: PostalMapAnalysis | null,
): PostalMapComparison | null {
  if (!analysisA || !analysisB) {
    return null;
  }
  if (analysisA.coverage.mappedN === 0 && analysisB.coverage.mappedN === 0) {
    return null;
  }

  const areaMapA = new Map(analysisA.areas.map((area) => [area.areaKey, area]));
  const areaMapB = new Map(analysisB.areas.map((area) => [area.areaKey, area]));
  const areaKeys = Array.from(new Set([...areaMapA.keys(), ...areaMapB.keys()])).sort();

  return {
    geographyVersion: analysisA.geographyVersion,
    coverageA: analysisA.coverage,
    coverageB: analysisB.coverage,
    areas: areaKeys
      .map((areaKey) => {
        const areaA = areaMapA.get(areaKey);
        const areaB = areaMapB.get(areaKey);
        const reference = areaA ?? areaB;
        if (!reference) {
          return null;
        }
        const shareA = areaA?.shareOfMapped ?? 0;
        const shareB = areaB?.shareOfMapped ?? 0;
        return {
          areaKey,
          countryCode: reference.countryCode,
          label: reference.label,
          postalPrefix: reference.postalPrefix,
          nA: areaA?.n ?? 0,
          nB: areaB?.n ?? 0,
          shareA,
          shareB,
          deltaPercentagePoints: (shareA - shareB) * 100,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry != null)
      .sort((left, right) => Math.abs(right.deltaPercentagePoints) - Math.abs(left.deltaPercentagePoints) || left.areaKey.localeCompare(right.areaKey)),
  };
}
