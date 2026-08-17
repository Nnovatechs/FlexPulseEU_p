import { describe, expect, it } from "vitest";
import {
  assertAggregateSegmentComparison,
  buildSegmentCatalog,
  buildSegmentComparison,
  buildSegmentComparisonExport,
  canExportSegmentComparison,
  canGenerateSegmentComparison,
  isSegmentComparisonStale,
  SEGMENT_COMPARISON_EXPORT_VERSION,
  SEGMENT_SEMANTIC_MIN_N,
  segmentComparisonExportContainsSensitiveField,
  type SegmentDefinition,
} from "@/features/surveys/analytics/segments";
import {
  createInitialMappingContract,
  createInitialSurveyDefinition,
  type MapperOutput,
  type MeasurementPlanEntry,
  type PersistedSurvey,
} from "@/features/surveys/generator-types";
import type { NormalizedLocationLevel } from "@/features/surveys/response-enrichment";
import { buildSurveyAnalyticsSchema, type SurveyAnalyticsRecord } from "@/features/surveys/survey-analytics";

function buildSurvey(concepts: MeasurementPlanEntry[], extras?: { weather?: boolean; geo?: boolean }): PersistedSurvey {
  const definition = createInitialSurveyDefinition("English", ["English"]);
  definition.survey_meta.response_context = {
    collect_country_code: extras?.geo !== false,
    collect_postal_code: extras?.geo !== false,
    enrich_weather_context: extras?.weather === true,
  };
  definition.survey_meta.measurement_plan_json = {
    schema_version: 1,
    schema_namespace: "flexpulse_behavioural_schema",
    concepts,
  };
  return {
    id: "survey-segments",
    name: "Segment survey",
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
  minimum_answer_count: 2,
  question_keys: ["Q_TRUST_01", "Q_TRUST_02"],
  required_question_keys: ["Q_TRUST_01", "Q_TRUST_02"],
  question_intents: [
    { slot_key: "SLOT_T1", question_key: "Q_TRUST_01", facet: "reliability", intent: "r", polarity: "positive" },
    { slot_key: "SLOT_T2", question_key: "Q_TRUST_02", facet: "delegation", intent: "d", polarity: "positive" },
  ],
};

const overrideConcept: MeasurementPlanEntry = {
  concept_key: "manual_override_need",
  evidence_source: "survey_questions",
  measurement_type: "multi_item_likert_mean",
  output_type: "number",
  aggregation_rule: "mean",
  threshold_profile: "likert_1_5_low_mid_high",
  minimum_answer_count: 1,
  question_keys: ["Q_OVERRIDE_01"],
  required_question_keys: ["Q_OVERRIDE_01"],
  question_intents: [
    { slot_key: "SLOT_O1", question_key: "Q_OVERRIDE_01", facet: "cancel", intent: "c", polarity: "positive" },
  ],
};

const savingsConcept: MeasurementPlanEntry = {
  concept_key: "savings_motivation",
  evidence_source: "survey_questions",
  measurement_type: "multi_item_likert_mean",
  output_type: "number",
  aggregation_rule: "mean",
  threshold_profile: "likert_1_5_low_mid_high",
  minimum_answer_count: 1,
  question_keys: ["Q_SAVE_01"],
  required_question_keys: ["Q_SAVE_01"],
  question_intents: [],
};

const assetsConcept: MeasurementPlanEntry = {
  concept_key: "owned_der_assets",
  evidence_source: "survey_questions",
  measurement_type: "multi_choice_tag_set",
  output_type: "string[]",
  aggregation_rule: "set_union",
  threshold_profile: "asset_inventory",
  minimum_answer_count: 1,
  question_keys: ["Q_DER_01"],
  required_question_keys: ["Q_DER_01"],
  question_intents: [],
};

const dfcConcept: MeasurementPlanEntry = {
  concept_key: "declared_flexibility_capability",
  evidence_source: "survey_questions",
  measurement_type: "multi_item_likert_mean",
  output_type: "number",
  aggregation_rule: "mean",
  threshold_profile: "likert_1_5_low_mid_high",
  minimum_answer_count: 4,
  question_keys: ["Q_DFC_01", "Q_DFC_02", "Q_DFC_03", "Q_DFC_04"],
  required_question_keys: ["Q_DFC_01", "Q_DFC_02", "Q_DFC_03", "Q_DFC_04"],
  question_intents: ["Q_DFC_01", "Q_DFC_02", "Q_DFC_03", "Q_DFC_04"].map((questionKey, index) => ({
    slot_key: `SLOT_DFC_${index}`,
    question_key: questionKey,
    facet: "ev_charging",
    intent: "ev",
    polarity: "positive" as const,
  })),
};

const thermalConcept: MeasurementPlanEntry = {
  concept_key: "thermal_comfort_norms",
  evidence_source: "survey_questions",
  measurement_type: "multi_item_likert_mean",
  output_type: "number",
  aggregation_rule: "mean",
  threshold_profile: "likert_1_5_low_mid_high",
  minimum_answer_count: 1,
  question_keys: ["Q_THERMAL_01"],
  required_question_keys: ["Q_THERMAL_01"],
  question_intents: [],
};

function mapperOutput(input: {
  trust?: number;
  override?: number;
  savings?: number;
  assets?: string[];
  dfc?: number | null;
  ev?: number | null;
  thermal?: number;
  country?: string;
  location?: MapperOutput["context_metadata"]["location"];
}): MapperOutput {
  return {
    profile: {
      ...(input.trust != null
        ? {
            trust_in_automation: {
              value: input.trust,
              tag: input.trust >= 4 ? "high" : input.trust <= 2 ? "low" : "medium",
              facets: {
                reliability: { value: input.trust, evidence_count: 1, evidence_level: "interpretive_signal" },
                delegation: { value: input.trust, evidence_count: 1, evidence_level: "interpretive_signal" },
              },
            },
          }
        : {}),
      ...(input.override != null
        ? {
            manual_override_need: {
              value: input.override,
              tag: "medium",
              facets: { cancel: { value: input.override, evidence_count: 1, evidence_level: "interpretive_signal" } },
            },
          }
        : {}),
      ...(input.savings != null ? { savings_motivation: { value: input.savings, tag: "medium" } } : {}),
      ...(input.thermal != null ? { thermal_comfort_norms: { value: input.thermal, tag: "medium" } } : {}),
      ...(input.assets ? { owned_der_assets: { value: input.assets } } : {}),
      ...(input.dfc !== undefined
        ? {
            declared_flexibility_capability: {
              value: input.dfc,
              tag: input.dfc != null && input.dfc >= 4 ? "high" : "medium",
              facets: {
                ev_charging: {
                  value: input.ev ?? null,
                  evidence_count: input.ev == null ? 0 : 4,
                  evidence_level: "facet_subscore",
                },
              },
            },
          }
        : {}),
    },
    context_metadata: {
      country_code: input.country ?? "ES",
      survey_language: "English",
      location: input.location ?? null,
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

function record(
  id: string,
  output: MapperOutput,
  locationLevels: NormalizedLocationLevel[] = [],
): SurveyAnalyticsRecord {
  return {
    response_id: id,
    responded_at: "2026-01-01T00:00:00.000Z",
    audience_token: "default",
    audience_label: "Default",
    mapper_output: output,
    location_levels: locationLevels,
  };
}

function definition(conditions: SegmentDefinition["conditions"] = []): SegmentDefinition {
  return {
    version: 1,
    surveyId: "survey-segments",
    schemaNamespace: "flexpulse_behavioural_schema",
    measurementHash: "measure-1",
    conditions,
  };
}

const highTrust = definition([{ kind: "semantic_band", field: "profile.trust_in_automation.value", band: "high" }]);
const lowTrust = definition([{ kind: "semantic_band", field: "profile.trust_in_automation.value", band: "low" }]);
const spain = definition([{ kind: "eq", field: "context.country_code", value: "ES" }]);
const whole = definition();

describe("segment comparison", () => {
  it("compares two disjoint segments with effect sizes and schema-driven fields", () => {
    const survey = buildSurvey([trustConcept, thermalConcept, overrideConcept, savingsConcept, assetsConcept, dfcConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 10 });
    const rows = [
      ...Array.from({ length: 5 }, (_, index) =>
        record(`a${index}`, mapperOutput({ trust: 5, thermal: 2, override: 2, savings: 4, assets: ["ev"], dfc: 4, ev: 4, country: "ES" })),
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        record(`b${index}`, mapperOutput({ trust: 1, thermal: 5, override: 5, savings: 2, assets: ["heat_pump"], dfc: 2, ev: 2, country: "FR" })),
      ),
    ];
    const result = buildSegmentComparison({ schema, rows, definitionA: spain, definitionB: definition([{ kind: "eq", field: "context.country_code", value: "FR" }]) });
    expect(result.sample.relation).toBe("disjoint");
    expect(result.sample.effectSizesAvailable).toBe(true);
    expect(result.sample.intersectionN).toBe(0);
    expect(result.blockedReason).toBeNull();
    expect(result.scoreDifferences.some((row) => row.kind === "primary_axis" && row.conceptKey === "trust_in_automation")).toBe(true);
    expect(result.scoreDifferences.some((row) => row.kind === "facet" && row.facet === "reliability")).toBe(true);
    expect(result.scoreDifferences.some((row) => row.kind === "modulator" && row.conceptKey === "manual_override_need")).toBe(true);
    expect(result.scoreDifferences.some((row) => row.kind === "modulator" && row.conceptKey === "savings_motivation")).toBe(true);
    expect(result.scoreDifferences.some((row) => row.kind === "capability_module")).toBe(true);
    expect(result.scoreDifferences.every((row) => row.cliffsDelta != null)).toBe(true);
    expect(result.scoreDifferences[0]?.cliffsDelta).not.toBeNull();
    const catalog = buildSegmentCatalog({ survey, schema, rows });
    expect(catalog.schemaVersion).toBe(schema.schema_version ?? 1);
    expect(assertAggregateSegmentComparison(result)).toEqual({
      hasResponseId: false,
      hasAnswers: false,
      hasMapperOutput: false,
    });
  });

  it("keeps country in geography and omits finer location fields from composition", () => {
    const survey = buildSurvey([trustConcept, assetsConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 10 });
    const madrid: NormalizedLocationLevel[] = [
      { kind: "country", code: "ES", label: "Spain", providerId: null, centroidLat: null, centroidLon: null },
      { kind: "region", code: "ES:region:madrid", label: "Madrid", providerId: null, centroidLat: null, centroidLon: null },
      { kind: "postal_area", code: "280*", label: "280*", providerId: null, centroidLat: null, centroidLon: null },
    ];
    const paris: NormalizedLocationLevel[] = [
      { kind: "country", code: "FR", label: "France", providerId: null, centroidLat: null, centroidLon: null },
      { kind: "region", code: "FR:region:idf", label: "Île-de-France", providerId: null, centroidLat: null, centroidLon: null },
      { kind: "postal_area", code: "750*", label: "750*", providerId: null, centroidLat: null, centroidLon: null },
    ];
    const rows = [
      ...Array.from({ length: 5 }, (_, index) =>
        record(
          `a${index}`,
          mapperOutput({
            trust: 5,
            assets: ["ev"],
            country: "ES",
            location: {
              agg_code: "ES:postal_area:280",
              label: "Madrid",
              granularity: "postal_area",
              centroid_lat: null,
              centroid_lon: null,
            },
          }),
          madrid,
        ),
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        record(
          `b${index}`,
          mapperOutput({
            trust: 1,
            assets: ["heat_pump"],
            country: "FR",
            location: {
              agg_code: "FR:postal_area:750",
              label: "Paris",
              granularity: "postal_area",
              centroid_lat: null,
              centroid_lon: null,
            },
          }),
          paris,
        ),
      ),
    ];
    const result = buildSegmentComparison({
      schema,
      rows,
      definitionA: spain,
      definitionB: definition([{ kind: "eq", field: "context.country_code", value: "FR" }]),
    });
    expect(result.compositionDifferences.every((row) => row.family !== "geography")).toBe(true);
    expect(result.compositionDifferences.every((row) => !row.field.startsWith("geo."))).toBe(true);
    expect(result.compositionDifferences.every((row) => !row.field.startsWith("context.location."))).toBe(true);
    expect(result.compositionDifferences.every((row) => row.field !== "context.country_code")).toBe(true);
    expect(result.geography).toEqual([]);
  });

  it("can show country in geography when country does not define the segments", () => {
    const survey = buildSurvey([trustConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 10 });
    const madrid: NormalizedLocationLevel[] = [
      { kind: "country", code: "ES", label: "Spain", providerId: null, centroidLat: null, centroidLon: null },
    ];
    const paris: NormalizedLocationLevel[] = [
      { kind: "country", code: "FR", label: "France", providerId: null, centroidLat: null, centroidLon: null },
    ];
    const rows = [
      ...Array.from({ length: 5 }, (_, index) =>
        record(`a${index}`, mapperOutput({ trust: 5, country: "ES" }), madrid),
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        record(`b${index}`, mapperOutput({ trust: 1, country: "FR" }), paris),
      ),
    ];
    const result = buildSegmentComparison({ schema, rows, definitionA: highTrust, definitionB: lowTrust });
    expect(result.geography.every((row) => row.field === "context.country_code")).toBe(true);
    expect(result.geography.some((row) => row.value === "ES")).toBe(true);
  });

  it("ranks a 1/7 score row after n>=5 rows", () => {
    const survey = buildSurvey([thermalConcept, overrideConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 14 });
    const rows = [
      record(`a0`, mapperOutput({ thermal: 5, override: 1, country: "ES" })),
      ...Array.from({ length: 6 }, (_, index) => record(`a${index + 1}`, mapperOutput({ thermal: 5, country: "ES" }))),
      ...Array.from({ length: 7 }, (_, index) => record(`b${index}`, mapperOutput({ thermal: 1, override: 5, country: "FR" }))),
    ];
    const result = buildSegmentComparison({
      schema,
      rows,
      definitionA: spain,
      definitionB: definition([{ kind: "eq", field: "context.country_code", value: "FR" }]),
    });
    const thermal = result.scoreDifferences.find((row) => row.conceptKey === "thermal_comfort_norms");
    const override = result.scoreDifferences.find((row) => row.conceptKey === "manual_override_need");
    expect(thermal?.applicableNA).toBe(7);
    expect(thermal?.applicableNB).toBe(7);
    expect(override?.applicableNA).toBe(1);
    expect(override?.applicableNB).toBe(7);
    expect(result.scoreDifferences.indexOf(thermal!)).toBeLessThan(result.scoreDifferences.indexOf(override!));
  });

  it("does not generate an insight from a small-n score row", () => {
    const survey = buildSurvey([thermalConcept, overrideConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 14 });
    const rows = [
      record(`a0`, mapperOutput({ thermal: 3, override: 1, country: "ES" })),
      ...Array.from({ length: 6 }, (_, index) => record(`a${index + 1}`, mapperOutput({ thermal: 3, country: "ES" }))),
      ...Array.from({ length: 7 }, (_, index) => record(`b${index}`, mapperOutput({ thermal: 3, override: 5, country: "FR" }))),
    ];
    const result = buildSegmentComparison({
      schema,
      rows,
      definitionA: spain,
      definitionB: definition([{ kind: "eq", field: "context.country_code", value: "FR" }]),
    });
    expect(result.scoreDifferences.some((row) => row.conceptKey === "manual_override_need" && row.applicableNA === 1)).toBe(
      true,
    );
    expect(result.insights.every((item) => !item.conceptKeys.includes("manual_override_need"))).toBe(true);
  });

  it("emits at most one insight for a construct and its facets", () => {
    const survey = buildSurvey([trustConcept, thermalConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 10 });
    const rows = [
      ...Array.from({ length: 5 }, (_, index) => record(`a${index}`, mapperOutput({ trust: 5, thermal: 3, country: "ES" }))),
      ...Array.from({ length: 5 }, (_, index) => record(`b${index}`, mapperOutput({ trust: 1, thermal: 3, country: "FR" }))),
    ];
    const result = buildSegmentComparison({
      schema,
      rows,
      definitionA: spain,
      definitionB: definition([{ kind: "eq", field: "context.country_code", value: "FR" }]),
    });
    expect(result.scoreDifferences.filter((row) => row.conceptKey === "trust_in_automation").length).toBeGreaterThan(1);
    expect(result.insights.filter((item) => item.conceptKeys.includes("trust_in_automation"))).toHaveLength(1);
  });

  it("omits a category used as a filter from composition differences", () => {
    const survey = buildSurvey([trustConcept, assetsConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 10 });
    const hasEv = definition([{ kind: "contains", field: "profile.owned_der_assets.value", value: "ev" }]);
    const hasHeatPump = definition([{ kind: "contains", field: "profile.owned_der_assets.value", value: "heat_pump" }]);
    const rows = [
      ...Array.from({ length: 5 }, (_, index) => record(`a${index}`, mapperOutput({ trust: 5, assets: ["ev"], country: "ES" }))),
      ...Array.from({ length: 5 }, (_, index) =>
        record(`b${index}`, mapperOutput({ trust: 1, assets: ["heat_pump"], country: "FR" })),
      ),
    ];
    const result = buildSegmentComparison({ schema, rows, definitionA: hasEv, definitionB: hasHeatPump });
    expect(result.compositionDifferences.every((row) => !row.field.includes("owned_der_assets"))).toBe(true);
  });

  it("omits exact 0 pp composition rows", () => {
    const survey = buildSurvey([trustConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 10 });
    const rows = [
      ...Array.from({ length: 5 }, (_, index) => record(`a${index}`, mapperOutput({ trust: 5, country: "ES" }))),
      ...Array.from({ length: 5 }, (_, index) => record(`b${index}`, mapperOutput({ trust: 1, country: "FR" }))),
    ];
    const result = buildSegmentComparison({
      schema,
      rows,
      definitionA: spain,
      definitionB: definition([{ kind: "eq", field: "context.country_code", value: "FR" }]),
    });
    expect(result.compositionDifferences.every((row) => row.deltaPercentagePoints !== 0)).toBe(true);
    expect(result.compositionDifferences.every((row) => !row.field.includes("survey_language"))).toBe(true);
  });

  it("does not generate a comparison when A and B select the same responses", () => {
    const survey = buildSurvey([trustConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 6 });
    const rows = Array.from({ length: 6 }, (_, index) => record(`r${index}`, mapperOutput({ trust: index < 3 ? 5 : 2 })));
    const result = buildSegmentComparison({ schema, rows, definitionA: highTrust, definitionB: highTrust });
    expect(result.sample.relation).toBe("identical");
    expect(result.blockedReason).toBe("identical");
    expect(result.scoreDifferences).toEqual([]);
    expect(result.insights).toEqual([]);
    expect(canExportSegmentComparison("ready", false, result)).toBe(false);
  });

  it("keeps overlapping responses and withholds independent-sample effect sizes", () => {
    const survey = buildSurvey([trustConcept, thermalConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 10 });
    const rows = [
      ...Array.from({ length: 5 }, (_, index) => record(`es-high-${index}`, mapperOutput({ trust: 5, thermal: 2, country: "ES" }))),
      ...Array.from({ length: 3 }, (_, index) => record(`es-low-${index}`, mapperOutput({ trust: 1, thermal: 4, country: "ES" }))),
      ...Array.from({ length: 2 }, (_, index) => record(`fr-high-${index}`, mapperOutput({ trust: 5, thermal: 2, country: "FR" }))),
    ];
    const result = buildSegmentComparison({ schema, rows, definitionA: highTrust, definitionB: spain });
    expect(result.sample.relation).toBe("overlap");
    expect(result.sample.intersectionN).toBe(5);
    expect(result.sample.effectSizesAvailable).toBe(false);
    expect(result.scoreDifferences.every((row) => row.cliffsDelta == null)).toBe(true);
    expect(result.insights.every((item) => item.kind === "descriptive" || item.kind === "none")).toBe(true);
    expect(result.profileAxes.length).toBeGreaterThan(0);
  });

  it("treats whole survey versus a subgroup as containment without dropping shared responses", () => {
    const survey = buildSurvey([trustConcept, thermalConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 8 });
    const rows = [
      ...Array.from({ length: 5 }, (_, index) => record(`high-${index}`, mapperOutput({ trust: 5, thermal: 2 }))),
      ...Array.from({ length: 3 }, (_, index) => record(`low-${index}`, mapperOutput({ trust: 1, thermal: 4 }))),
    ];
    const result = buildSegmentComparison({ schema, rows, definitionA: whole, definitionB: highTrust });
    expect(result.sample.relation).toBe("a_contains_b");
    expect(result.sample.intersectionN).toBe(5);
    expect(result.sample.bOnlyN).toBe(0);
    expect(result.sample.effectSizesAvailable).toBe(false);
    expect(result.definitionDifferences.some((row) => row.conceptKey === "trust_in_automation")).toBe(true);
    expect(result.insights.some((item) => item.kind === "score_difference")).toBe(false);
  });

  it("works with zero, one and several modulators and never exposes modulator facets", () => {
    const noneSurvey = buildSurvey([trustConcept]);
    const oneSurvey = buildSurvey([trustConcept, overrideConcept]);
    const manySurvey = buildSurvey([trustConcept, overrideConcept, savingsConcept]);
    const rows = [
      ...Array.from({ length: 5 }, (_, index) =>
        record(`a${index}`, mapperOutput({ trust: 5, override: 2, savings: 5, country: "ES" })),
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        record(`b${index}`, mapperOutput({ trust: 1, override: 5, savings: 2, country: "FR" })),
      ),
    ];
    const defA = spain;
    const defB = definition([{ kind: "eq", field: "context.country_code", value: "FR" }]);
    const none = buildSegmentComparison({
      schema: buildSurveyAnalyticsSchema({ survey: noneSurvey, readyResponseCount: 10 }),
      rows,
      definitionA: defA,
      definitionB: defB,
    });
    const one = buildSegmentComparison({
      schema: buildSurveyAnalyticsSchema({ survey: oneSurvey, readyResponseCount: 10 }),
      rows,
      definitionA: defA,
      definitionB: defB,
    });
    const many = buildSegmentComparison({
      schema: buildSurveyAnalyticsSchema({ survey: manySurvey, readyResponseCount: 10 }),
      rows,
      definitionA: defA,
      definitionB: defB,
    });
    expect(none.scoreDifferences.some((row) => row.kind === "modulator")).toBe(false);
    expect(one.scoreDifferences.filter((row) => row.kind === "modulator").map((row) => row.conceptKey)).toEqual([
      "manual_override_need",
    ]);
    expect(many.scoreDifferences.filter((row) => row.kind === "modulator").map((row) => row.conceptKey).sort()).toEqual([
      "manual_override_need",
      "savings_motivation",
    ]);
    expect(many.scoreDifferences.some((row) => row.kind === "facet" && row.conceptKey === "manual_override_need")).toBe(
      false,
    );
    expect(none.scoreDifferences.some((row) => row.kind === "facet" && row.conceptKey === "trust_in_automation")).toBe(
      true,
    );
  });

  it("compares DFC modules with different applicable n and keeps overall out of the main ranking", () => {
    const survey = buildSurvey([trustConcept, dfcConcept, assetsConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 10 });
    const rows = [
      ...Array.from({ length: 5 }, (_, index) =>
        record(`a${index}`, mapperOutput({ trust: 4, dfc: 5, ev: 5, assets: ["ev"], country: "ES" })),
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        record(`b-ev-${index}`, mapperOutput({ trust: 2, dfc: 2, ev: 2, assets: ["ev"], country: "FR" })),
      ),
      ...Array.from({ length: 2 }, (_, index) =>
        record(`b-none-${index}`, mapperOutput({ trust: 2, dfc: null, ev: null, assets: ["heat_pump"], country: "FR" })),
      ),
    ];
    const result = buildSegmentComparison({
      schema,
      rows,
      definitionA: spain,
      definitionB: definition([{ kind: "eq", field: "context.country_code", value: "FR" }]),
    });
    expect(result.dfc).not.toBeNull();
    expect(result.dfc?.overall.includedInMainRanking).toBe(false);
    expect(result.dfc?.modules[0]?.applicableNA).toBe(5);
    expect(result.dfc?.modules[0]?.applicableNB).toBe(3);
    expect(result.scoreDifferences.some((row) => row.kind === "capability_module")).toBe(true);
    expect(result.scoreDifferences.every((row) => row.kind !== "primary_axis" || row.conceptKey !== "declared_flexibility_capability")).toBe(true);
  });

  it("excludes defining variables from comparative insights", () => {
    const survey = buildSurvey([trustConcept, thermalConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 10 });
    const rows = [
      ...Array.from({ length: 5 }, (_, index) => record(`a${index}`, mapperOutput({ trust: 5, thermal: 2, country: "ES" }))),
      ...Array.from({ length: 5 }, (_, index) => record(`b${index}`, mapperOutput({ trust: 1, thermal: 5, country: "FR" }))),
    ];
    const result = buildSegmentComparison({ schema, rows, definitionA: highTrust, definitionB: lowTrust });
    expect(result.definitionDifferences.some((row) => row.conceptKey === "trust_in_automation")).toBe(true);
    expect(result.scoreDifferences.some((row) => row.conceptKey === "trust_in_automation" && row.kind === "primary_axis")).toBe(
      false,
    );
    expect(result.insights.every((item) => !item.conceptKeys.includes("trust_in_automation") || item.kind === "none")).toBe(
      true,
    );
    expect(result.insights.length).toBeLessThanOrEqual(3);
    expect(SEGMENT_SEMANTIC_MIN_N).toBe(5);
  });

  it("exports generated aggregate JSON without row identities and disables stale exports", () => {
    const survey = buildSurvey([trustConcept, overrideConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 10 });
    const rows = [
      ...Array.from({ length: 5 }, (_, index) => record(`a${index}`, mapperOutput({ trust: 5, override: 2, country: "ES" }))),
      ...Array.from({ length: 5 }, (_, index) => record(`b${index}`, mapperOutput({ trust: 1, override: 5, country: "FR" }))),
    ];
    const comparison = buildSegmentComparison({
      schema,
      rows,
      definitionA: spain,
      definitionB: definition([{ kind: "eq", field: "context.country_code", value: "FR" }]),
      generatedAt: "2026-08-17T10:00:00.000Z",
    });
    const file = buildSegmentComparisonExport({ comparison, schema });
    const parsed = JSON.parse(file.body) as { exportVersion: string; comparison: typeof comparison };
    expect(parsed.exportVersion).toBe(SEGMENT_COMPARISON_EXPORT_VERSION);
    expect(parsed.comparison.definitionA).toEqual(spain);
    expect(parsed.comparison.rules.effectSizesRequireDisjoint).toBe(true);
    expect(segmentComparisonExportContainsSensitiveField(parsed)).toBe(false);
    expect(file.body).not.toMatch(/response_id|answers_json|mapper_output|prolific/i);
    expect(canExportSegmentComparison("ready", false, comparison)).toBe(true);
    expect(canExportSegmentComparison("ready", true, comparison)).toBe(false);
  });

  it("marks the comparison stale when a definition or the available population changes", () => {
    const generated = {
      trayA: spain,
      trayB: highTrust,
      generatedA: spain,
      generatedB: highTrust,
      analysedN: 10,
      generatedAnalysedN: 10,
      status: "ready" as const,
    };
    expect(isSegmentComparisonStale(generated)).toBe(false);
    expect(canGenerateSegmentComparison(generated)).toBe(false);
    expect(isSegmentComparisonStale({ ...generated, trayB: lowTrust })).toBe(true);
    expect(canGenerateSegmentComparison({ ...generated, trayB: lowTrust })).toBe(true);
    expect(isSegmentComparisonStale({ ...generated, analysedN: 12 })).toBe(true);
    expect(canGenerateSegmentComparison({ ...generated, trayA: null })).toBe(false);
  });
});
