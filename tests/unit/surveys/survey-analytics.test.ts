import { describe, expect, it } from "vitest";
import {
  createInitialMappingContract,
  createInitialSurveyDefinition,
  type MapperOutput,
  type PersistedSurvey,
} from "@/features/surveys/generator-types";
import type { NormalizedLocationLevel } from "@/features/surveys/response-enrichment";
import {
  buildSurveyAnalyticsSchema,
  runSurveyAnalyticsQuery,
  type SurveyAnalyticsRecord,
} from "@/features/surveys/survey-analytics";

function buildSurveyFixture(): PersistedSurvey {
  const definition = createInitialSurveyDefinition("English", ["English"]);
  definition.survey_meta.response_context = {
    collect_country_code: true,
    collect_postal_code: true,
    enrich_weather_context: true,
  };
  definition.survey_meta.measurement_plan_json = {
    schema_version: 1,
    schema_namespace: "flexpulse_behavioural_schema",
    concepts: [
      {
        concept_key: "trust_in_automation",
        evidence_source: "survey_questions",
        measurement_type: "multi_item_likert_median",
        output_type: "number",
        aggregation_rule: "median",
        threshold_profile: "likert_1_5_low_mid_high",
        minimum_answer_count: 2,
        question_keys: ["Q_TRUST_01", "Q_TRUST_02"],
        required_question_keys: ["Q_TRUST_01", "Q_TRUST_02"],
        question_intents: [
          {
            slot_key: "SLOT_TRUST_IN_AUTOMATION_01",
            question_key: "Q_TRUST_01",
            facet: "reliability",
            intent: "Measure reliability trust.",
            polarity: "positive",
          },
          {
            slot_key: "SLOT_TRUST_IN_AUTOMATION_02",
            question_key: "Q_TRUST_02",
            facet: "delegation",
            intent: "Measure willingness to delegate.",
            polarity: "positive",
          },
        ],
      },
      {
        concept_key: "owned_der_assets",
        evidence_source: "survey_questions",
        measurement_type: "multi_choice_tag_set",
        output_type: "string[]",
        aggregation_rule: "set_union",
        threshold_profile: "asset_inventory",
        minimum_answer_count: 1,
        question_keys: ["Q_DER_01"],
        required_question_keys: ["Q_DER_01"],
      },
    ],
  };

  return {
    id: "survey_analytics_test",
    name: "Analytics test survey",
    status: "published",
    created_by: "user_1",
    created_at: "2026-04-06T10:00:00.000Z",
    updated_at: "2026-04-06T10:00:00.000Z",
    published_at: "2026-04-06T10:00:00.000Z",
    default_language: "English",
    supported_languages: ["English"],
    definition_json: definition,
    mapping_contract_json: createInitialMappingContract(),
    mapping_compiled_json: null,
    mapping_hash: "mapping_hash_v1",
    measurement_hash: "measurement_hash_v1",
  };
}

function buildMapperOutput(input: {
  trust: number;
  trustTag: "low" | "medium" | "high";
  assets: string[];
  countryCode: string;
  surveyLanguage: string;
  tempOutdoorC: number;
  humidityPct: number;
  aggCode: string;
  aggLabel: string;
  granularity: string;
}): MapperOutput {
  return {
    profile: {
      trust_in_automation: {
        value: input.trust,
        tag: input.trustTag,
        facets: {
          reliability: {
            value: input.trust,
            evidence_count: 1,
            evidence_level: "interpretive_signal",
          },
        },
      },
      owned_der_assets: {
        value: input.assets,
      },
    },
    context_metadata: {
      country_code: input.countryCode,
      survey_language: input.surveyLanguage,
      location: {
        agg_code: input.aggCode,
        label: input.aggLabel,
        granularity: input.granularity,
        centroid_lat: 40.0,
        centroid_lon: -3.0,
      },
      climate: {
        provider: "open_meteo",
        quality_flag: "ok",
        observed_at: "2026-04-06T09:00:00.000Z",
        temp_outdoor_c: input.tempOutdoorC,
        humidity_pct: input.humidityPct,
      },
    },
    mapping_metadata: {
      mapping_hash: "mapping_hash_v1",
      measurement_hash: "measurement_hash_v1",
      mapping_hash_at_submission: "mapping_hash_v1",
      measurement_hash_at_submission: "measurement_hash_v1",
      mapper_version: "v1",
      threshold_profile_version: "v1",
    },
  };
}

function buildLocationLevels(input: {
  countryCode: string;
  regionCode: string;
  regionLabel: string;
  cityCode: string;
  cityLabel: string;
}): NormalizedLocationLevel[] {
  return [
    {
      kind: "country",
      code: input.countryCode,
      label: input.countryCode,
      providerId: null,
      centroidLat: null,
      centroidLon: null,
    },
    {
      kind: "region",
      code: input.regionCode,
      label: input.regionLabel,
      providerId: null,
      centroidLat: null,
      centroidLon: null,
    },
    {
      kind: "city",
      code: input.cityCode,
      label: input.cityLabel,
      providerId: null,
      centroidLat: null,
      centroidLon: null,
    },
  ];
}

function buildRecord(input: {
  responseId: string;
  audienceToken: string;
  mapperOutput: MapperOutput;
  locationLevels: NormalizedLocationLevel[];
}): SurveyAnalyticsRecord {
  return {
    response_id: input.responseId,
    responded_at: "2026-04-06T10:00:00.000Z",
    audience_token: input.audienceToken,
    audience_label: input.audienceToken,
    mapper_output: input.mapperOutput,
    location_levels: input.locationLevels,
  };
}

describe("survey analytics", () => {
  it("builds a dynamic schema from measurement plan and context capabilities", () => {
    const schema = buildSurveyAnalyticsSchema({
      survey: buildSurveyFixture(),
      readyResponseCount: 3,
    });

    expect(schema.measurement_hash).toBe("measurement_hash_v1");
    expect(schema.ready_response_count).toBe(3);
    expect(schema.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "profile.trust_in_automation.value",
          value_type: "number",
          source: "profile",
        }),
        expect.objectContaining({
          key: "profile.trust_in_automation.tag",
          value_type: "tag",
          source: "profile",
        }),
        expect.objectContaining({
          key: "profile.trust_in_automation.facets.reliability.value",
          value_type: "number",
          evidence_level: "interpretive_signal",
          source: "profile",
        }),
        expect.objectContaining({
          key: "profile.owned_der_assets.value",
          value_type: "string[]",
          source: "profile",
        }),
        expect.objectContaining({
          key: "geo.region.code",
          source: "geo",
        }),
        expect.objectContaining({
          key: "context.climate.temp_outdoor_c",
          value_type: "number",
          source: "context",
        }),
      ]),
    );
  });

  it("aggregates by segment and geo hierarchy with controlled metrics", () => {
    const survey = buildSurveyFixture();
    const schema = buildSurveyAnalyticsSchema({
      survey,
      readyResponseCount: 3,
    });
    const rows: SurveyAnalyticsRecord[] = [
      buildRecord({
        responseId: "r1",
        audienceToken: "default",
        mapperOutput: buildMapperOutput({
          trust: 4.5,
          trustTag: "high",
          assets: ["ev", "heat_pump"],
          countryCode: "ES",
          surveyLanguage: "Spanish",
          tempOutdoorC: 18,
          humidityPct: 45,
          aggCode: "ES:city:madrid",
          aggLabel: "Madrid",
          granularity: "city",
        }),
        locationLevels: buildLocationLevels({
          countryCode: "ES",
          regionCode: "ES:region:madrid",
          regionLabel: "Madrid",
          cityCode: "ES:city:madrid",
          cityLabel: "Madrid",
        }),
      }),
      buildRecord({
        responseId: "r2",
        audienceToken: "default",
        mapperOutput: buildMapperOutput({
          trust: 2,
          trustTag: "low",
          assets: ["heat_pump"],
          countryCode: "IE",
          surveyLanguage: "English",
          tempOutdoorC: 12,
          humidityPct: 70,
          aggCode: "IE:city:dublin",
          aggLabel: "Dublin",
          granularity: "city",
        }),
        locationLevels: buildLocationLevels({
          countryCode: "IE",
          regionCode: "IE:region:leinster",
          regionLabel: "Leinster",
          cityCode: "IE:city:dublin",
          cityLabel: "Dublin",
        }),
      }),
      buildRecord({
        responseId: "r3",
        audienceToken: "pilot",
        mapperOutput: buildMapperOutput({
          trust: 4,
          trustTag: "high",
          assets: ["battery_storage"],
          countryCode: "ES",
          surveyLanguage: "Spanish",
          tempOutdoorC: 20,
          humidityPct: 40,
          aggCode: "ES:city:barcelona",
          aggLabel: "Barcelona",
          granularity: "city",
        }),
        locationLevels: buildLocationLevels({
          countryCode: "ES",
          regionCode: "ES:region:catalonia",
          regionLabel: "Catalonia",
          cityCode: "ES:city:barcelona",
          cityLabel: "Barcelona",
        }),
      }),
    ];

    const grouped = runSurveyAnalyticsQuery({
      schema,
      rows,
      query: {
        group_by: ["context.country_code"],
        metrics: [
          { key: "responses", kind: "count" },
          { key: "avg_trust", kind: "average", field: "profile.trust_in_automation.value" },
          {
            key: "avg_reliability_signal",
            kind: "average",
            field: "profile.trust_in_automation.facets.reliability.value",
          },
          {
            key: "share_high_trust",
            kind: "share_equals",
            field: "profile.trust_in_automation.tag",
            value: "high",
          },
        ],
      },
    });

    expect(grouped.matched_response_count).toBe(3);
    expect(grouped.groups).toEqual([
      {
        group: { "context.country_code": "ES" },
        metrics: {
          responses: { kind: "count", value: 2, sample_size: 2 },
          avg_trust: { kind: "average", value: 4.25, sample_size: 2 },
          avg_reliability_signal: {
            kind: "average",
            value: 4.25,
            sample_size: 2,
          },
          share_high_trust: {
            kind: "share_equals",
            value: 1,
            sample_size: 2,
            matched_count: 2,
          },
        },
        response_count: 2,
      },
      {
        group: { "context.country_code": "IE" },
        metrics: {
          responses: { kind: "count", value: 1, sample_size: 1 },
          avg_trust: { kind: "average", value: 2, sample_size: 1 },
          avg_reliability_signal: {
            kind: "average",
            value: 2,
            sample_size: 1,
          },
          share_high_trust: {
            kind: "share_equals",
            value: 0,
            sample_size: 1,
            matched_count: 0,
          },
        },
        response_count: 1,
      },
    ]);

    const geoFiltered = runSurveyAnalyticsQuery({
      schema,
      rows,
      query: {
        filters: [
          {
            field: "profile.owned_der_assets.value",
            op: "contains",
            value: "heat_pump",
          },
        ],
        group_by: ["geo.region.code", "geo.region.label"],
        metrics: [{ key: "responses", kind: "count" }],
      },
    });

    expect(geoFiltered.matched_response_count).toBe(2);
    expect(geoFiltered.groups).toEqual([
      {
        group: {
          "geo.region.code": "ES:region:madrid",
          "geo.region.label": "Madrid",
        },
        metrics: {
          responses: { kind: "count", value: 1, sample_size: 1 },
        },
        response_count: 1,
      },
      {
        group: {
          "geo.region.code": "IE:region:leinster",
          "geo.region.label": "Leinster",
        },
        metrics: {
          responses: { kind: "count", value: 1, sample_size: 1 },
        },
        response_count: 1,
      },
    ]);
  });
});
