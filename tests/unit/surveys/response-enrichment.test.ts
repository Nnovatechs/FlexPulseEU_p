import { describe, expect, it } from "vitest";
import { deriveNormalizedSurveyLocation } from "@/features/surveys/response-enrichment";

describe("response enrichment helpers", () => {
  it("keeps a normalized hierarchy while exposing the best available level", () => {
    const location = deriveNormalizedSurveyLocation({
      countryCode: "ES",
      postalCode: "28013",
      geocodedLocation: {
        id: 3117735,
        name: "Madrid",
        latitude: 40.4165,
        longitude: -3.70256,
        country: "Spain",
        country_code: "ES",
        admin1: "Community of Madrid",
        admin2: "Madrid",
        admin2_id: 6355233,
      },
    });

    expect(location).toMatchObject({
      normalizedCountryCode: "ES",
      locationAggCode: "ES:city:6355233",
      locationAggLabel: "Madrid",
      locationGranularity: "city",
      centroidLat: 40.4165,
      centroidLon: -3.70256,
    });
    expect(location.normalizedLocationJson).toMatchObject({
      provider: "open_meteo_geocoding",
      postalAreaMask: "280*",
      bestAvailableKind: "city",
    });
    expect(location.normalizedLocationJson.levels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "country",
          code: "ES:country:spain",
          label: "Spain",
        }),
        expect.objectContaining({
          kind: "region",
          label: "Community of Madrid",
        }),
        expect.objectContaining({
          kind: "city",
          code: "ES:city:6355233",
          label: "Madrid",
        }),
        expect.objectContaining({
          kind: "place",
          code: "ES:place:3117735",
          label: "Madrid",
        }),
      ]),
    );
  });

  it("falls back to a masked postal area when geocoding is unavailable", () => {
    const location = deriveNormalizedSurveyLocation({
      countryCode: "HR",
      postalCode: "10000",
      geocodedLocation: null,
    });

    expect(location).toMatchObject({
      normalizedCountryCode: "HR",
      locationAggCode: "HR:postal_area:100",
      locationAggLabel: "100*",
      locationGranularity: "postal_area",
      centroidLat: null,
      centroidLon: null,
    });
    expect(location.normalizedLocationJson).toMatchObject({
      provider: "fallback",
      postalAreaMask: "100*",
      bestAvailableKind: "postal_area",
    });
  });

  it("falls back to country-only context when no postal code or geocoding result exists", () => {
    const location = deriveNormalizedSurveyLocation({
      countryCode: "IE",
      postalCode: null,
      geocodedLocation: null,
    });

    expect(location).toMatchObject({
      normalizedCountryCode: "IE",
      locationAggCode: "IE:country:ie",
      locationAggLabel: "IE",
      locationGranularity: "country",
      centroidLat: null,
      centroidLon: null,
    });
    expect(location.normalizedLocationJson).toMatchObject({
      provider: "fallback",
      postalAreaMask: null,
      bestAvailableKind: "country",
    });
  });
});
