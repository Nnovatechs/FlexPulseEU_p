import { describe, expect, it } from "vitest";
import {
  deriveNormalizedSurveyLocation,
  fetchHistoricalWeatherWithOpenMeteo,
  geocodePostalCodeWithOpenMeteo,
} from "@/features/surveys/response-enrichment";

const describeWithOpenMeteo =
  process.env.OPEN_METEO_LIVE_TESTS === "true" ? describe : describe.skip;

describeWithOpenMeteo("Open-Meteo response enrichment live integration", () => {
  it(
    "geocodes a known postal code and attaches weather context",
    async () => {
      const geocodedLocation = await geocodePostalCodeWithOpenMeteo({
        countryCode: "ES",
        postalCode: "28013",
      });

      expect(geocodedLocation).toEqual(
        expect.objectContaining({
          country_code: "ES",
          latitude: expect.any(Number),
          longitude: expect.any(Number),
        }),
      );

      const location = deriveNormalizedSurveyLocation({
        countryCode: "ES",
        postalCode: "28013",
        geocodedLocation,
      });

      expect(location).toMatchObject({
        normalizedCountryCode: "ES",
        locationGranularity: expect.any(String),
        centroidLat: expect.any(Number),
        centroidLon: expect.any(Number),
      });
      expect(location.normalizedLocationJson.levels.length).toBeGreaterThan(0);

      if (location.centroidLat == null || location.centroidLon == null) {
        throw new Error("Expected Open-Meteo geocoding to return coordinates.");
      }

      const weather = await fetchHistoricalWeatherWithOpenMeteo({
        latitude: location.centroidLat,
        longitude: location.centroidLon,
        respondedAt: "2024-05-01T12:00:00.000Z",
      });

      expect(weather).toEqual(
        expect.objectContaining({
          observedAt: expect.any(String),
          temperatureOutdoorC: expect.any(Number),
          humidityPct: expect.any(Number),
        }),
      );
    },
    30_000,
  );
});
