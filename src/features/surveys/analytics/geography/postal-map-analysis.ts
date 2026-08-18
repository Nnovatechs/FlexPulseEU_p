import {
  applySurveyAnalyticsFilters,
  getSurveyAnalyticsFieldValue,
  type SurveyAnalyticsRecord,
  type SurveyAnalyticsSchema,
} from "@/features/surveys/survey-analytics";
import { compileSegmentDefinition } from "../segments/compiler";
import type { SegmentDefinition } from "../segments/types";
import { readPostalAreaProperties, readSupportedPostalAreaKeys, getPostalGeographyVersion } from "./postal-area-artifacts";
import type { SupportedPostalAreaCountryCode } from "./postal-area-key";
import type { PostalAreaAggregate, PostalMapAnalysis } from "./postal-map-types";

const SUPPORTED_COUNTRIES: SupportedPostalAreaCountryCode[] = ["ES", "FR", "IE"];

function areaCountryCode(areaKey: string): SupportedPostalAreaCountryCode | null {
  const countryCode = areaKey.slice(0, 2);
  if (countryCode === "ES" || countryCode === "FR" || countryCode === "IE") {
    return countryCode;
  }
  return null;
}

export function buildPostalMapAnalysis(input: {
  schema: SurveyAnalyticsSchema;
  rows: SurveyAnalyticsRecord[];
  definition?: SegmentDefinition;
  eligibleRows?: SurveyAnalyticsRecord[];
}): PostalMapAnalysis | null {
  const supportsPostalAreaKey = input.schema.fields.some((field) => field.key === "geo.postal_area.area_key");
  if (!supportsPostalAreaKey) {
    return null;
  }

  const eligibleRows =
    input.eligibleRows ??
    applySurveyAnalyticsFilters({
      schema: input.schema,
      rows: input.rows,
      filters: compileSegmentDefinition(input.definition as SegmentDefinition),
    });

  const propertyMaps = new Map<
    SupportedPostalAreaCountryCode,
    Map<string, { postalPrefix: string; label: string }>
  >();

  for (const countryCode of SUPPORTED_COUNTRIES) {
    propertyMaps.set(
      countryCode,
      new Map(
        readPostalAreaProperties(countryCode).map((entry) => [
          entry.areaKey,
          { postalPrefix: entry.postalPrefix, label: entry.label },
        ]),
      ),
    );
  }

  const counts = new Map<string, number>();
  let mappedN = 0;

  for (const row of eligibleRows) {
    const areaKey = getSurveyAnalyticsFieldValue(row, "geo.postal_area.area_key");
    if (typeof areaKey !== "string" || !areaKey) {
      continue;
    }
    const countryCode = areaCountryCode(areaKey);
    if (!countryCode) {
      continue;
    }
    if (!readSupportedPostalAreaKeys(countryCode).has(areaKey)) {
      continue;
    }
    mappedN += 1;
    counts.set(areaKey, (counts.get(areaKey) ?? 0) + 1);
  }

  const eligibleN = eligibleRows.length;
  const areas: PostalAreaAggregate[] = Array.from(counts.entries())
    .map(([areaKey, n]) => {
      const countryCode = areaCountryCode(areaKey) as SupportedPostalAreaCountryCode;
      const details = propertyMaps.get(countryCode)?.get(areaKey);
      if (!details) {
        return null;
      }
      return {
        areaKey,
        countryCode,
        postalPrefix: details.postalPrefix,
        label: details.label,
        n,
        shareOfMapped: mappedN === 0 ? 0 : n / mappedN,
        shareOfEligible: eligibleN === 0 ? 0 : n / eligibleN,
      };
    })
    .filter((entry): entry is PostalAreaAggregate => entry != null)
    .sort((left, right) => right.n - left.n || left.areaKey.localeCompare(right.areaKey));

  return {
    geographyVersion: getPostalGeographyVersion(),
    coverage: {
      eligibleN,
      mappedN,
      unmappedN: Math.max(eligibleN - mappedN, 0),
      mappedShare: eligibleN === 0 ? 0 : mappedN / eligibleN,
    },
    areas,
  };
}
