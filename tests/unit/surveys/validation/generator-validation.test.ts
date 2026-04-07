import { describe, expect, it } from "vitest";
import {
  createInitialSurveyDefinition,
  normalizeSurveyResponseContextConfig,
} from "@/features/surveys/generator-types";
import { validateSurveyDefinition } from "@/features/surveys/generator-validation";

describe("survey definition validation — response context", () => {
  it("rejects postal code collection without country code collection", () => {
    const definition = createInitialSurveyDefinition("English", ["English"]);
    definition.translations.English.survey_title = "Baseline survey";
    definition.survey_meta.response_context = {
      collect_country_code: false,
      collect_postal_code: true,
      enrich_weather_context: false,
    };

    const issues = validateSurveyDefinition(definition, {
      require_complete_translations: false,
    });

    expect(
      issues.some((issue) => issue.code === "postal_code_requires_country_code"),
    ).toBe(true);
  });

  it("rejects weather enrichment without full location context", () => {
    const definition = createInitialSurveyDefinition("English", ["English"]);
    definition.translations.English.survey_title = "Baseline survey";
    definition.survey_meta.response_context = {
      collect_country_code: true,
      collect_postal_code: false,
      enrich_weather_context: true,
    };

    const issues = validateSurveyDefinition(definition, {
      require_complete_translations: false,
    });

    expect(
      issues.some(
        (issue) => issue.code === "weather_enrichment_requires_location_context",
      ),
    ).toBe(true);
  });

  it("normalizes response context so weather enrichment forces required inputs", () => {
    expect(
      normalizeSurveyResponseContextConfig({
        enrich_weather_context: true,
      }),
    ).toEqual({
      collect_country_code: true,
      collect_postal_code: true,
      enrich_weather_context: true,
    });
  });
});
