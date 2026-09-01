import { describe, expect, it } from "vitest";
import { buildPostalMapAnalysis } from "@/features/surveys/analytics/geography/postal-map-analysis";
import { buildSurveyAnalyticsSchema, type SurveyAnalyticsRecord } from "@/features/surveys/survey-analytics";
import {
  createInitialMappingContract,
  createInitialSurveyDefinition,
  type MapperOutput,
  type MeasurementPlanEntry,
  type PersistedSurvey,
} from "@/features/surveys/generator-types";
import type { NormalizedLocationLevel } from "@/features/surveys/response-enrichment";

function buildSurvey(concepts: MeasurementPlanEntry[]): PersistedSurvey {
  const definition = createInitialSurveyDefinition("English", ["English"]);
  definition.survey_meta.response_context = {
    collect_country_code: true,
    collect_postal_code: true,
    enrich_weather_context: false,
  };
  definition.survey_meta.measurement_plan_json = {
    schema_version: 1,
    schema_namespace: "flexpulse_behavioural_schema",
    concepts,
  };

  return {
    id: "survey-postal-map",
    name: "Postal map survey",
    status: "published",
    created_by: "owner-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    published_at: "2026-01-01T00:00:00.000Z",
    default_language: "English",
    supported_languages: ["English"],
    definition_json: definition,
    mapping_contract_json: createInitialMappingContract(),
    mapping_compiled_json: null,
    mapping_hash: "map-1",
    measurement_hash: "measure-1",
  };
}

const trustConcept: MeasurementPlanEntry = {
  concept_key: "trust_in_automation",
  evidence_source: "survey_questions",
  measurement_type: "multi_item_likert_median",
  output_type: "number",
  aggregation_rule: "mean",
  threshold_profile: "likert_1_5_low_mid_high",
  minimum_answer_count: 1,
  question_keys: ["Q_TRUST_01"],
  required_question_keys: ["Q_TRUST_01"],
  question_intents: [{ slot_key: "SLOT_T1", question_key: "Q_TRUST_01", facet: "reliability", intent: "r", polarity: "positive" }],
};

function mapperOutput(input: {
  country: "ES" | "FR" | "IE";
  rawPostalArea: string | null;
}): MapperOutput {
  return {
    profile: {
      trust_in_automation: { value: 4, tag: "high" },
    },
    context_metadata: {
      country_code: input.country,
      survey_language: "English",
      location: input.rawPostalArea
        ? {
            agg_code: input.rawPostalArea.includes(":")
              ? input.rawPostalArea
              : `${input.country}:postal_area:${input.rawPostalArea}`,
            label: input.rawPostalArea,
            granularity: "postal_area",
            centroid_lat: null,
            centroid_lon: null,
          }
        : null,
      climate: null,
    },
    mapping_metadata: {
      mapping_hash: "map-1",
      measurement_hash: "measure-1",
      mapping_hash_at_submission: "map-1",
      measurement_hash_at_submission: "measure-1",
      mapper_version: "v1",
      threshold_profile_version: "v1",
    },
  };
}

function locationLevels(country: "ES" | "FR" | "IE", code: string | null): NormalizedLocationLevel[] {
  if (!code) {
    return [];
  }
  return [
    { kind: "country", code: country, label: country, providerId: null, centroidLat: null, centroidLon: null },
    { kind: "postal_area", code, label: code, providerId: null, centroidLat: null, centroidLon: null },
  ];
}

function record(id: string, country: "ES" | "FR" | "IE", rawPostalArea: string | null): SurveyAnalyticsRecord {
  return {
    response_id: id,
    responded_at: "2026-01-01T00:00:00.000Z",
    audience_token: "default",
    audience_label: "Default",
    mapper_output: mapperOutput({ country, rawPostalArea }),
    location_levels: locationLevels(country, rawPostalArea),
  };
}

function definition(conditions: Array<{ kind: "in"; field: string; values: string[] }> = []) {
  return {
    version: 1 as const,
    surveyId: "survey-postal-map",
    schemaNamespace: "flexpulse_behavioural_schema",
    measurementHash: "measure-1",
    conditions,
  };
}

describe("postal map analysis", () => {
  it("keeps unmapped responses in the segment when there is no geographic filter", () => {
    const survey = buildSurvey([trustConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 52 });
    const rows = [
      ...Array.from({ length: 25 }, (_, index) => record(`es-${index}`, "ES", "280")),
      ...Array.from({ length: 25 }, (_, index) => record(`ie-${index}`, "IE", "d02")),
      record("unmapped-1", "FR", "98000"),
      record("unmapped-2", "IE", "H90"),
    ];

    const result = buildPostalMapAnalysis({
      schema,
      rows,
      definition: definition(),
    });

    expect(result).not.toBeNull();
    expect(result?.coverage).toEqual({
      eligibleN: 52,
      mappedN: 50,
      unmappedN: 2,
      mappedShare: 50 / 52,
    });
    expect(result?.areas.reduce((total, area) => total + area.n, 0)).toBe(50);
    expect(result?.areas.map((area) => area.areaKey)).toEqual(["ES:postal_area:28", "IE:postal_area:D02"]);
  });

  it("filters to the selected mapped postal area only when a geographic IN condition is active", () => {
    const survey = buildSurvey([trustConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 6 });
    const rows = [
      ...Array.from({ length: 3 }, (_, index) => record(`es-${index}`, "ES", "280")),
      ...Array.from({ length: 2 }, (_, index) => record(`fr-${index}`, "FR", "750")),
      record("unmapped", "FR", "98000"),
    ];

    const result = buildPostalMapAnalysis({
      schema,
      rows,
      definition: definition([{ kind: "in", field: "geo.postal_area.area_key", values: ["FR:postal_area:75"] }]),
    });

    expect(result?.coverage).toEqual({
      eligibleN: 2,
      mappedN: 2,
      unmappedN: 0,
      mappedShare: 1,
    });
    expect(result?.areas).toHaveLength(1);
    expect(result?.areas[0]).toMatchObject({
      areaKey: "FR:postal_area:75",
      n: 2,
    });
  });
});
