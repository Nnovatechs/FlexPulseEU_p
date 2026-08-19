import { describe, expect, it } from "vitest";
import {
  addToComparisonTray,
  assertAggregateSegmentAnalysis,
  buildSegmentAnalysis,
  buildSegmentAnalysisExport,
  buildSegmentCatalog,
  buildSegmentExplorerSummary,
  canRunSegmentAnalysis,
  canExportSegmentAnalysis,
  commitSegmentDefinition,
  compileSegmentDefinition,
  computeCliffsDelta,
  decodeSegmentDefinition,
  describeReadableConditions,
  emptySegmentDefinition,
  encodeSegmentDefinition,
  formatVisibleDate,
  getAnalyseActionLabel,
  previewSegmentSample,
  getAssetValueLabel,
  getBandLabel,
  getConceptDescription,
  getEvidenceLabel,
  getFieldBand,
  getFieldRange,
  getScoreDirectionNote,
  isSegmentAnalysisStale,
  isWholeSampleDefinition,
  discloseExclusiveCounts,
  isUsableWeatherQuality,
  percentageBarWidth,
  SEGMENT_CELL_MIN_N,
  SEGMENT_SEMANTIC_MIN_N,
  SEMANTIC_INSUFFICIENT_EVIDENCE,
  SEGMENT_ANALYSIS_EXPORT_VERSION,
  SEGMENT_ANALYSIS_VERSION,
  SEGMENT_ANALYSIS_METHODOLOGY_VERSION,
  segmentAnalysisExportContainsSensitiveField,
  savedSegmentsStorageKey,
  comparisonTrayStorageKey,
  MULTI_ITEM_FACET_SCORE_LABEL,
  NEUTRAL_BAND_LABELS,
  readComparisonTray,
  readSavedSegments,
  removeComparisonSlot,
  saveNamedSegment,
  scoreControlMode,
  segmentDefinitionsEqual,
  setInValues,
  setEquality,
  setNumericRange,
  SINGLE_ITEM_SIGNAL_LABEL,
  getFieldInValues,
  toggleInValue,
  toggleMembership,
  toggleSemanticBand,
  utcInclusiveDateBounds,
  validateSegmentDefinition,
  writeComparisonTray,
  type SegmentDefinition,
  type SegmentStorageAdapter,
} from "@/features/surveys/analytics/segments";
import {
  createInitialMappingContract,
  createInitialSurveyDefinition,
  type MapperOutput,
  type MeasurementPlanEntry,
  type PersistedSurvey,
} from "@/features/surveys/generator-types";
import {
  applySurveyAnalyticsFilters,
  buildSurveyAnalyticsSchema,
  type SurveyAnalyticsRecord,
} from "@/features/surveys/survey-analytics";
import { buildSurveyOverviewData } from "@/features/surveys/analytics/overview-v2";

function memoryAdapter(store: Record<string, string> = {}): SegmentStorageAdapter {
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => {
      store[key] = value;
    },
    removeItem: (key) => {
      delete store[key];
    },
  };
}

function concept(entry: MeasurementPlanEntry): MeasurementPlanEntry {
  return entry;
}

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

const trustConcept = concept({
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
});

const overrideConcept = concept({
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
});

const savingsConcept = concept({
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
});

const assetsConcept = concept({
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
});

const dfcConcept = concept({
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
});

const thermalConcept = concept({
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
});

function mapperOutput(input: {
  trust?: number;
  override?: number;
  savings?: number;
  assets?: string[];
  dfc?: number | null;
  ev?: number | null;
  thermal?: number;
  country?: string;
  language?: string;
  temp?: number;
  weatherFlag?: string;
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
      survey_language: input.language ?? "English",
      location: null,
      climate:
        input.temp != null
          ? {
              provider: "open_meteo",
              quality_flag: input.weatherFlag ?? "weather_ok",
              observed_at: "2026-01-01T00:00:00.000Z",
              temp_outdoor_c: input.temp,
              humidity_pct: 40,
            }
          : null,
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
  audience?: { token?: string; label?: string },
): SurveyAnalyticsRecord {
  return {
    response_id: id,
    responded_at: "2026-01-01T00:00:00.000Z",
    audience_token: audience?.token ?? "default",
    audience_label: audience?.label ?? "Default",
    mapper_output: output,
    location_levels: [
      {
        kind: "postal_area",
        code: "28",
        label: "28",
        providerId: null,
        centroidLat: null,
        centroidLon: null,
      },
    ],
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

function validationIssue(result: ReturnType<typeof validateSegmentDefinition>) {
  return result.ok ? null : result.issue;
}

describe("segment contract and compiler", () => {
  const survey = buildSurvey([trustConcept, assetsConcept, dfcConcept], { weather: true });
  const expected = { surveyId: survey.id, measurementHash: survey.measurement_hash ?? null };
  const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 3 });
  const rows = [
    record("r1", mapperOutput({ trust: 5, assets: ["ev", "heat_pump"], dfc: 4, ev: 4, country: "ES" })),
    record("r2", mapperOutput({ trust: 3, assets: ["ev"], dfc: 3, ev: 3, country: "FR" })),
    record("r3", mapperOutput({ trust: 2, assets: ["heat_pump"], dfc: null, ev: null, country: "IE" })),
  ];

  it("compiles AND filters and treats zero conditions as the full sample", () => {
    const empty = validateSegmentDefinition(definition(), schema, expected);
    expect(empty.ok).toBe(true);
    if (!empty.ok) {
      return;
    }
    expect(compileSegmentDefinition(empty.definition)).toEqual([]);
    expect(
      applySurveyAnalyticsFilters({ schema, rows, filters: compileSegmentDefinition(empty.definition) }),
    ).toHaveLength(3);
  });

  it("compiles high >=4, medium >2 && <4, and low <=2", () => {
    expect(compileSegmentDefinition(definition([{ kind: "semantic_band", field: "profile.trust_in_automation.value", band: "high" }]))).toEqual([
      { field: "profile.trust_in_automation.value", op: "gte", value: 4 },
    ]);
    expect(compileSegmentDefinition(definition([{ kind: "semantic_band", field: "profile.trust_in_automation.value", band: "medium" }]))).toEqual([
      { field: "profile.trust_in_automation.value", op: "gt", value: 2 },
      { field: "profile.trust_in_automation.value", op: "lt", value: 4 },
    ]);
    expect(compileSegmentDefinition(definition([{ kind: "semantic_band", field: "profile.trust_in_automation.value", band: "low" }]))).toEqual([
      { field: "profile.trust_in_automation.value", op: "lte", value: 2 },
    ]);

    const high = applySurveyAnalyticsFilters({
      schema,
      rows,
      filters: compileSegmentDefinition(definition([{ kind: "semantic_band", field: "profile.trust_in_automation.value", band: "high" }])),
    });
    const medium = applySurveyAnalyticsFilters({
      schema,
      rows,
      filters: compileSegmentDefinition(definition([{ kind: "semantic_band", field: "profile.trust_in_automation.value", band: "medium" }])),
    });
    const low = applySurveyAnalyticsFilters({
      schema,
      rows,
      filters: compileSegmentDefinition(definition([{ kind: "semantic_band", field: "profile.trust_in_automation.value", band: "low" }])),
    });
    expect(high).toHaveLength(1);
    expect(medium).toHaveLength(1);
    expect(low).toHaveLength(1);
  });

  it("compiles inclusive custom ranges and rejects a full 1-5 range", () => {
    const compiled = compileSegmentDefinition(
      definition([{ kind: "numeric_range", field: "profile.trust_in_automation.value", min: 2, max: 4 }]),
    );
    expect(compiled).toEqual([
      { field: "profile.trust_in_automation.value", op: "between", value: [2, 4] },
    ]);
    expect(
      applySurveyAnalyticsFilters({ schema, rows, filters: compiled }).map((row) => row.response_id),
    ).toEqual(["r2", "r3"]);
    expect(
      validateSegmentDefinition(
        definition([{ kind: "numeric_range", field: "profile.trust_in_automation.value", min: 1, max: 5 }]),
        schema,
        expected,
      ).ok,
    ).toBe(false);
  });

  it("keeps band and range exclusive when toggling", () => {
    const withBand = toggleSemanticBand(definition(), "profile.trust_in_automation.value", "high");
    const withRange = setNumericRange(withBand, "profile.trust_in_automation.value", 2, 3);
    expect(withRange.conditions).toEqual([
      { kind: "numeric_range", field: "profile.trust_in_automation.value", min: 2, max: 3 },
    ]);
    const cleared = setNumericRange(withRange, "profile.trust_in_automation.value", 1, 5);
    expect(cleared.conditions).toEqual([]);
    const toggledOff = toggleSemanticBand(withBand, "profile.trust_in_automation.value", "high");
    expect(toggledOff.conditions).toEqual([]);
  });

  it("requires every selected asset with AND and supports not_contains", () => {
    const both = definition([
      { kind: "contains", field: "profile.owned_der_assets.value", value: "ev" },
      { kind: "contains", field: "profile.owned_der_assets.value", value: "heat_pump" },
    ]);
    expect(applySurveyAnalyticsFilters({ schema, rows, filters: compileSegmentDefinition(both) })).toHaveLength(1);
    const noneOf = definition([
      { kind: "not_contains", field: "profile.owned_der_assets.value", value: "ev" },
      { kind: "not_contains", field: "profile.owned_der_assets.value", value: "heat_pump" },
    ]);
    expect(applySurveyAnalyticsFilters({ schema, rows, filters: compileSegmentDefinition(noneOf) })).toHaveLength(0);
    expect(
      validateSegmentDefinition(noneOf, schema, expected).ok,
    ).toBe(true);
  });

  it("compiles a postal-area IN condition and combines it with AND filters", () => {
    const geoSurvey = buildSurvey([trustConcept, assetsConcept], { geo: true });
    const geoSchema = buildSurveyAnalyticsSchema({ survey: geoSurvey, readyResponseCount: 3 });
    const geoRows = [
      record("es", mapperOutput({ trust: 5, assets: ["ev"], country: "ES" })),
      record("fr", mapperOutput({ trust: 3, assets: ["ev"], country: "FR" })),
      record("ie", mapperOutput({ trust: 2, assets: ["heat_pump"], country: "IE" })),
    ];

    const source = definition([
      { kind: "in", field: "geo.postal_area.code", values: ["28", "75"] },
      { kind: "contains", field: "profile.owned_der_assets.value", value: "ev" },
    ]);
    expect(compileSegmentDefinition(source)).toEqual([
      { field: "geo.postal_area.code", op: "in", value: ["28", "75"] },
      { field: "profile.owned_der_assets.value", op: "contains", value: "ev" },
    ]);
    expect(
      applySurveyAnalyticsFilters({
        schema: geoSchema,
        rows: geoRows,
        filters: compileSegmentDefinition(source),
      }).map((row) => row.response_id),
    ).toEqual(["es", "fr"]);
  });

  it("toggles IN values without duplicates and clears the condition when empty or fully selected", () => {
    const field = "geo.postal_area.code";
    const allValues = ["D02", "D04", "D06"];

    const single = toggleInValue(definition(), field, "D02", { allValues });
    expect(getFieldInValues(single, field)).toEqual(["D02"]);

    const multi = toggleInValue(single, field, "D04", { allValues });
    expect(getFieldInValues(multi, field)).toEqual(["D02", "D04"]);

    const deduped = setInValues(multi, field, ["D04", "D02", "D02"]);
    expect(getFieldInValues(deduped, field)).toEqual(["D02", "D04"]);

    const cleared = toggleInValue(multi, field, "D02", { allValues });
    expect(getFieldInValues(cleared, field)).toEqual(["D04"]);

    const allSelected = toggleInValue(multi, field, "D06", { allValues });
    expect(getFieldInValues(allSelected, field)).toEqual([]);
    expect(allSelected.conditions.some((condition) => condition.field === field && condition.kind === "in")).toBe(false);
  });

  it("rejects empty IN arrays and fields that do not allow the in operator", () => {
    expect(
      validationIssue(
        validateSegmentDefinition(
          definition([{ kind: "in", field: "geo.postal_area.code", values: [] }]),
          schema,
          expected,
        ),
      ),
    ).toBe("invalid_condition");

    expect(
      validationIssue(
        validateSegmentDefinition(
          definition([{ kind: "in", field: "profile.owned_der_assets.value", values: ["ev"] }]),
          schema,
          expected,
        ),
      ),
    ).toBe("operator_not_allowed");
  });

  it("rejects incompatible hashes, unknown fields and oversized definitions", () => {
    expect(validationIssue(validateSegmentDefinition(definition(), schema, { surveyId: "other", measurementHash: "measure-1" }))).toBe(
      "survey_mismatch",
    );
    expect(
      validationIssue(
        validateSegmentDefinition({ ...definition(), measurementHash: "other" }, schema, expected),
      ),
    ).toBe("measurement_hash_mismatch");
    expect(
      validationIssue(
        validateSegmentDefinition({ ...definition(), schemaNamespace: "other_schema" }, schema, expected),
      ),
    ).toBe("schema_mismatch");
    expect(
      validationIssue(
        validateSegmentDefinition(
          definition([{ kind: "eq", field: "profile.missing.value", value: "x" }]),
          schema,
          expected,
        ),
      ),
    ).toBe("unknown_field");
    expect(
      validationIssue(
        validateSegmentDefinition(
          definition(
            Array.from({ length: 17 }, (_, index) => ({
              kind: "contains" as const,
              field: "profile.owned_der_assets.value",
              value: `asset-${index}`,
            })),
          ),
          schema,
          expected,
        ),
      ),
    ).toBe("too_many_conditions");
  });

  it("round-trips the URL codec and rejects invalid payloads", () => {
    const source = definition([
      { kind: "semantic_band", field: "profile.trust_in_automation.value", band: "high" },
      { kind: "in", field: "geo.postal_area.code", values: ["D04", "D02", "D02"] },
    ]);
    const encoded = encodeSegmentDefinition(source);
    const decoded = decodeSegmentDefinition(encoded);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(segmentDefinitionsEqual(decoded.definition, source)).toBe(true);
      expect(getFieldInValues(decoded.definition, "geo.postal_area.code")).toEqual(["D02", "D04"]);
    }
    expect(encodeSegmentDefinition(source)).toBe(encoded);
    expect(decodeSegmentDefinition("%%%not-base64%%%").ok).toBe(false);
    const unknownVersion = Buffer.from(JSON.stringify({ ...source, version: 2 }), "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    expect(decodeSegmentDefinition(unknownVersion).ok).toBe(false);
  });

  it("does not crash on unknown postal-area values and simply matches no rows", () => {
    const geoSurvey = buildSurvey([trustConcept], { geo: true });
    const geoSchema = buildSurveyAnalyticsSchema({ survey: geoSurvey, readyResponseCount: 1 });
    const geoRows = [record("r1", mapperOutput({ trust: 4, country: "ES" }))];
    const source = definition([{ kind: "in", field: "geo.postal_area.code", values: ["UNKNOWN"] }]);

    expect(() =>
      applySurveyAnalyticsFilters({
        schema: geoSchema,
        rows: geoRows,
        filters: compileSegmentDefinition(source),
      }),
    ).not.toThrow();
    expect(
      applySurveyAnalyticsFilters({
        schema: geoSchema,
        rows: geoRows,
        filters: compileSegmentDefinition(source),
      }),
    ).toEqual([]);
  });
});

describe("segment catalog", () => {
  it("groups modulators by schema dimension and keeps DFC modules out of generic facets", () => {
    const survey = buildSurvey([trustConcept, overrideConcept, dfcConcept, assetsConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 1 });
    const rows = [record("r1", mapperOutput({ trust: 4, override: 5, assets: ["ev"], dfc: 4, ev: 4 }))];
    const catalog = buildSegmentCatalog({ survey, schema, rows });
    const trust = catalog.dimensions.find((dimension) => dimension.dimension === "trust_in_automation");
    const capability = catalog.dimensions.find((dimension) => dimension.dimension === "flexibility_capability");

    expect(trust?.overall?.conceptKey).toBe("trust_in_automation");
    expect(trust?.supportingFactors.map((factor) => factor.conceptKey)).toEqual(["manual_override_need"]);
    expect(trust?.supportingFactors[0]).not.toHaveProperty("facets");
    expect(trust?.facets.map((facet) => facet.conceptKey)).toEqual(["trust_in_automation", "trust_in_automation"]);
    expect(catalog.schemaVersion).toBe(schema.schema_version ?? 1);
    expect(trust?.facets.map((facet) => facet.evidenceLabel)).toContain(SINGLE_ITEM_SIGNAL_LABEL);
    expect(capability?.conditionalModules.map((module) => module.setKey)).toEqual(["ev_charging"]);
    expect(capability?.facets).toEqual([]);
    expect(capability?.conditionalModules[0]?.label).toBe("EV charging");
    expect(catalog.assets?.values.map((value) => value.value)).toEqual(["ev"]);
    expect(catalog.assets?.values.map((value) => value.label)).toEqual(["Electric vehicle"]);
    expect(trust?.overall?.bandLabels).toEqual({
      high: "Confidence",
      medium: "Unclear confidence",
      low: "Distrust",
    });
    expect(trust?.facets[0]?.bandLabels.high).toBe("Confidence");
    expect(trust?.supportingFactors[0]?.overall.bandLabels).toEqual(NEUTRAL_BAND_LABELS);
    expect(capability?.conditionalModules[0]?.bandLabels).toEqual({
      high: "Favourable",
      medium: "Limited",
      low: "Low declared capability",
    });
  });

  it("keeps a dimension when only a supporting factor is measured", () => {
    const survey = buildSurvey([savingsConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 1 });
    const rows = [record("r1", mapperOutput({ savings: 4 }))];
    const catalog = buildSegmentCatalog({ survey, schema, rows });
    expect(catalog.dimensions).toHaveLength(1);
    expect(catalog.dimensions[0]?.overall).toBeNull();
    expect(catalog.dimensions[0]?.supportingFactors[0]?.conceptKey).toBe("savings_motivation");
  });

  it("omits weather and geography when those values are absent", () => {
    const withWeather = buildSurvey([trustConcept], { weather: true, geo: true });
    const withoutOptional = buildSurvey([trustConcept], { weather: false, geo: false });
    const schemaWith = buildSurveyAnalyticsSchema({ survey: withWeather, readyResponseCount: 1 });
    const schemaWithout = buildSurveyAnalyticsSchema({ survey: withoutOptional, readyResponseCount: 1 });
    const withValues = buildSegmentCatalog({
      survey: withWeather,
      schema: schemaWith,
      rows: [record("r1", mapperOutput({ trust: 4, temp: 12, country: "ES" }))],
    });
    const emptyOptional = buildSegmentCatalog({
      survey: withoutOptional,
      schema: schemaWithout,
      rows: [record("r1", mapperOutput({ trust: 4 }))],
    });

    expect(withValues.context.some((field) => field.field === "context.climate.temp_outdoor_c")).toBe(true);
    expect(withValues.geography.length).toBeGreaterThan(0);
    expect(emptyOptional.context.some((field) => field.field.includes("climate"))).toBe(false);
    expect(emptyOptional.geography).toEqual([]);
  });

  it("offers audience labels as context filter options", () => {
    const survey = buildSurvey([trustConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 2 });
    const catalog = buildSegmentCatalog({
      survey,
      schema,
      rows: [
        record("r1", mapperOutput({ trust: 4 }), {
          token: "aud_a",
          label: "Pilot cohort A",
        }),
        record("r2", mapperOutput({ trust: 3 }), {
          token: "aud_b",
          label: "Pilot cohort B",
        }),
      ],
    });

    const audienceField = catalog.context.find(
      (field) => field.field === "response.audience_label",
    );

    expect(audienceField?.kind).toBe("choice");
    if (audienceField?.kind !== "choice") {
      throw new Error("Audience label field should be a choice context field.");
    }
    expect(audienceField.values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "Pilot cohort A" }),
        expect.objectContaining({ value: "Pilot cohort B" }),
      ]),
    );
  });

  it("builds a different tree for a survey without modulators", () => {
    const survey = buildSurvey([trustConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 1 });
    const catalog = buildSegmentCatalog({
      survey,
      schema,
      rows: [record("r1", mapperOutput({ trust: 4 }))],
    });
    expect(catalog.dimensions[0]?.supportingFactors).toEqual([]);
    expect(catalog.dimensions[0]?.conditionalModules).toEqual([]);
    expect(catalog.dimensions[0]?.facets.length).toBeGreaterThan(0);
  });

  it("exposes one or more modulators as aggregated supporting factors without their facets", () => {
    const survey = buildSurvey([trustConcept, overrideConcept, savingsConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 1 });
    const catalog = buildSegmentCatalog({
      survey,
      schema,
      rows: [record("r1", mapperOutput({ trust: 4, override: 3, savings: 4 }))],
    });
    const supporting = catalog.dimensions.flatMap((dimension) => dimension.supportingFactors);
    expect(supporting.map((factor) => factor.conceptKey).sort()).toEqual([
      "manual_override_need",
      "savings_motivation",
    ]);
    expect(supporting.every((factor) => !("facets" in factor))).toBe(true);
    expect(catalog.dimensions.flatMap((dimension) => dimension.facets).every((facet) => facet.conceptKey === "trust_in_automation")).toBe(true);
  });

  it("uses the analytics schema version rather than a hardcoded schemaVersion", () => {
    const survey = buildSurvey([trustConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 1 });
    schema.schema_version = 99;
    const catalog = buildSegmentCatalog({
      survey,
      schema,
      rows: [record("r1", mapperOutput({ trust: 4 }))],
    });
    expect(catalog.schemaVersion).toBe(99);
    expect(catalog.schemaVersion).toBe(schema.schema_version ?? 1);
  });
});

describe("segment summary, storage and comparison", () => {
  const survey = buildSurvey([trustConcept, assetsConcept]);
  const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 3 });
  const rows = [
    record("r1", mapperOutput({ trust: 5, assets: ["ev"] })),
    record("r2", mapperOutput({ trust: 3, assets: ["ev"] })),
    record("r3", mapperOutput({ trust: 1, assets: ["heat_pump"] })),
  ];

  it("matches Overview n for the empty segment and never returns row identities", () => {
    const overview = buildSurveyOverviewData({
      survey,
      schema,
      rows,
      collectedResponseCount: 3,
      collectedResponseWindow: { firstRespondedAt: null, lastRespondedAt: null },
    });
    const summary = buildSegmentExplorerSummary({
      schema,
      rows,
      definition: emptySegmentDefinition({
        surveyId: survey.id,
        schemaNamespace: schema.schema_namespace,
        measurementHash: schema.measurement_hash,
      }),
    });
    expect(summary.matchedN).toBe(overview.context.analysedResponseCount);
    expect(summary.analysedN).toBe(3);
    expect(JSON.stringify(summary)).not.toContain("response_id");
    expect(JSON.stringify(summary)).not.toContain("answers_json");
    expect(JSON.stringify(summary)).not.toContain("mapper_output");
    expect(summary.axes[0]?.bands).toHaveLength(3);
  });

  it("previews matched, share and outside without running the full analysis", () => {
    const whole = previewSegmentSample({ schema, rows, definition: definition() });
    expect(whole).toMatchObject({ matchedN: 3, analysedN: 3, outsideN: 0, share: 1 });
    const high = previewSegmentSample({
      schema,
      rows,
      definition: toggleSemanticBand(definition(), "profile.trust_in_automation.value", "high"),
    });
    expect(high.matchedN).toBe(1);
    expect(high.outsideN).toBe(2);
    expect(high.share).toBeCloseTo(1 / 3);
    expect(JSON.stringify(high)).not.toContain("response_id");
  });

  it("marks defining conditions and narrows when a condition is added", () => {
    const empty = buildSegmentExplorerSummary({ schema, rows, definition: definition() });
    const high = buildSegmentExplorerSummary({
      schema,
      rows,
      definition: toggleSemanticBand(definition(), "profile.trust_in_automation.value", "high"),
    });
    const replaced = buildSegmentExplorerSummary({
      schema,
      rows,
      definition: toggleSemanticBand(definition(), "profile.trust_in_automation.value", "medium"),
    });
    expect(high.matchedN).toBeLessThanOrEqual(empty.matchedN);
    expect(high.matchedN).toBe(1);
    expect(replaced.matchedN).toBe(1);
    const both = buildSegmentExplorerSummary({
      schema,
      rows,
      definition: {
        ...toggleSemanticBand(definition(), "profile.trust_in_automation.value", "high"),
        conditions: [
          { kind: "semantic_band", field: "profile.trust_in_automation.value", band: "high" },
          { kind: "contains", field: "profile.owned_der_assets.value", value: "heat_pump" },
        ],
      },
    });
    expect(both.matchedN).toBeLessThanOrEqual(high.matchedN);
    expect(high.axes[0]?.defining).toBe(true);
    expect(high.readableConditions[0]?.defining).toBe(true);
    const withAsset = buildSegmentExplorerSummary({
      schema,
      rows,
      definition: {
        ...definition(),
        conditions: [{ kind: "contains", field: "profile.owned_der_assets.value", value: "ev" }],
      },
    });
    expect(withAsset.readableConditions[0]?.detail).toBe("Has Electric vehicle");
  });

  it("stores named segments and a two-slot tray against survey and hash", () => {
    const adapter = memoryAdapter();
    const measurementHash = survey.measurement_hash ?? null;
    saveNamedSegment(
      {
        surveyId: survey.id,
        measurementHash,
        name: "High trust",
        definition: toggleSemanticBand(definition(), "profile.trust_in_automation.value", "high"),
      },
      adapter,
    );
    expect(readSavedSegments(survey.id, measurementHash, adapter)).toHaveLength(1);
    expect(readSavedSegments(survey.id, "other-hash", adapter)).toEqual([]);

    const first = addToComparisonTray(
      { version: 1, slots: [null, null] },
      toggleSemanticBand(definition(), "profile.trust_in_automation.value", "high"),
    );
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    const duplicate = addToComparisonTray(first.tray, first.tray.slots[0]!);
    expect(duplicate).toEqual({ ok: false, reason: "duplicate" });
    const whole = addToComparisonTray(first.tray, definition());
    expect(whole.ok).toBe(true);
    if (!whole.ok) {
      return;
    }
    expect(whole.tray.slots[1] && isWholeSampleDefinition(whole.tray.slots[1])).toBe(true);
    const full = addToComparisonTray(whole.tray, toggleSemanticBand(definition(), "profile.trust_in_automation.value", "low"));
    expect(full).toEqual({ ok: false, reason: "full" });
    writeComparisonTray(survey.id, measurementHash, whole.tray, adapter);
    expect(readComparisonTray(survey.id, measurementHash, adapter).slots[0]).not.toBeNull();
    expect(removeComparisonSlot(whole.tray, 0).slots[0]).toBeNull();
  });

  it("discards stored definitions that fail full validation", () => {
    const adapter = memoryAdapter();
    const measurementHash = survey.measurement_hash ?? null;
    const valid = toggleSemanticBand(definition(), "profile.trust_in_automation.value", "high");
    const now = "2026-01-01T00:00:00.000Z";
    adapter.setItem(
      savedSegmentsStorageKey(survey.id, measurementHash),
      JSON.stringify({
        version: 1,
        surveyId: survey.id,
        measurementHash,
        records: [
          { id: "ok", name: "High trust", createdAt: now, updatedAt: now, definition: valid },
          {
            id: "bad-field",
            name: "Broken field",
            createdAt: now,
            updatedAt: now,
            definition: {
              ...valid,
              conditions: [{ kind: "eq", field: "profile.missing.value", value: "x" }],
            },
          },
          {
            id: "bad-namespace",
            name: "Broken namespace",
            createdAt: now,
            updatedAt: now,
            definition: { ...valid, schemaNamespace: "other_schema" },
          },
        ],
      }),
    );
    expect(readSavedSegments(survey.id, measurementHash, adapter, schema)).toEqual([
      expect.objectContaining({ id: "ok", name: "High trust" }),
    ]);

    adapter.setItem(
      comparisonTrayStorageKey(survey.id, measurementHash),
      JSON.stringify({
        version: 1,
        slots: [{ ...valid, schemaNamespace: "other_schema" }, valid],
      }),
    );
    expect(readComparisonTray(survey.id, measurementHash, adapter, schema).slots).toEqual([
      null,
      expect.objectContaining({ surveyId: survey.id }),
    ]);
  });

  it("resolves labels from the shared resolver rather than Energy Flexibility maps", () => {
    expect(getEvidenceLabel("interpretive_signal")).toBe(SINGLE_ITEM_SIGNAL_LABEL);
    expect(getEvidenceLabel("facet_subscore")).toBe(MULTI_ITEM_FACET_SCORE_LABEL);
    expect(
      getBandLabel("thermal_comfort_norms", "high", {
        schemaNamespace: "flexpulse_behavioural_schema",
        schemaVersion: 1,
        fields: [],
      }),
    ).toBe("Stricter");
    expect(
      getBandLabel("trust_in_automation", "high", {
        schemaNamespace: "flexpulse_behavioural_schema",
        schemaVersion: 1,
        fields: [],
      }),
    ).toBe("Confidence");
    expect(getAssetValueLabel("ev")).toBe("Electric vehicle");
    expect(getAssetValueLabel("pv_system")).toBe("Solar photovoltaic system");
    expect(
      getConceptDescription("trust_in_automation", {
        schemaNamespace: "flexpulse_behavioural_schema",
        schemaVersion: 1,
        fields: [],
      }),
    ).toMatch(/automated household energy control/i);
  });
});

describe("segment band labels", () => {
  const context = {
    schemaNamespace: "flexpulse_behavioural_schema",
    schemaVersion: 1,
    fields: [],
  };

  it("uses construct-specific labels for higher_is_more and higher_is_stricter axes", () => {
    expect(getScoreDirectionNote("flexibility_willingness", context)).toBeNull();
    expect(getBandLabel("flexibility_willingness", "high", context)).toBe("Favourable");
    expect(getBandLabel("flexibility_willingness", "medium", context)).toBe("Not clearly favourable");
    expect(getBandLabel("flexibility_willingness", "low", context)).toBe("Unfavourable");
    expect(getScoreDirectionNote("thermal_comfort_norms", context)).toMatch(/stricter/i);
    expect(getBandLabel("thermal_comfort_norms", "high", context)).toBe("Stricter");
    expect(getBandLabel("thermal_comfort_norms", "medium", context)).toBe("Intermediate");
    expect(getBandLabel("thermal_comfort_norms", "low", context)).toBe("More permissive thermal norms");
    expect(getBandLabel("trust_in_automation", "high", context)).toBe("Confidence");
    expect(getBandLabel("awareness_of_energy_systems", "high", context)).toBe("High familiarity");
  });

  it("falls back to neutral band labels for unknown concepts", () => {
    expect(getBandLabel("unknown_future_construct", "high", context)).toBe("Upper band");
    expect(getBandLabel("unknown_future_construct", "medium", context)).toBe("Intermediate band");
    expect(getBandLabel("unknown_future_construct", "low", context)).toBe("Lower band");
  });
});

describe("segment score control mode", () => {
  const field = "profile.trust_in_automation.value";

  it("follows the active definition and keeps the user mode when the condition is cleared", () => {
    const withBand = toggleSemanticBand(definition(), field, "high");
    const withRange = setNumericRange(withBand, field, 2, 3);
    expect(withRange.conditions.filter((condition) => condition.field === field)).toHaveLength(1);
    expect(scoreControlMode("band", getFieldBand(withRange, field), getFieldRange(withRange, field))).toBe("range");
    expect(scoreControlMode("range", getFieldBand(withBand, field), getFieldRange(withBand, field))).toBe("band");
    const cleared = setNumericRange(withRange, field, 1, 5);
    expect(getFieldBand(cleared, field)).toBeNull();
    expect(getFieldRange(cleared, field)).toBeNull();
    expect(scoreControlMode("range", getFieldBand(cleared, field), getFieldRange(cleared, field))).toBe("range");
  });
});

describe("segment inclusive date bounds", () => {
  const survey = buildSurvey([trustConcept], { weather: true });
  const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 4 });
  const rows = [
    { ...record("start", mapperOutput({ trust: 3 })), responded_at: "2026-08-16T00:00:00.000Z" },
    { ...record("noon", mapperOutput({ trust: 3 })), responded_at: "2026-08-16T12:00:00.000Z" },
    { ...record("end", mapperOutput({ trust: 3 })), responded_at: "2026-08-16T23:59:59.999Z" },
    { ...record("next", mapperOutput({ trust: 3 })), responded_at: "2026-08-17T00:00:00.000Z" },
    { ...record("later", mapperOutput({ trust: 3 })), responded_at: "2026-08-18T09:00:00.000Z" },
  ];

  it("includes the whole final UTC day and excludes the next midnight", () => {
    expect(utcInclusiveDateBounds("2026-08-16", "2026-08-16")).toEqual({
      startInclusive: "2026-08-16T00:00:00.000Z",
      endExclusive: "2026-08-17T00:00:00.000Z",
    });
    const sameDay = applySurveyAnalyticsFilters({
      schema,
      rows,
      filters: compileSegmentDefinition(
        definition([{ kind: "date_range", field: "response.responded_at", min: "2026-08-16", max: "2026-08-16" }]),
      ),
    }).map((row) => row.response_id);
    expect(sameDay).toEqual(["start", "noon", "end"]);

    const span = applySurveyAnalyticsFilters({
      schema,
      rows,
      filters: compileSegmentDefinition(
        definition([{ kind: "date_range", field: "response.responded_at", min: "2026-08-16", max: "2026-08-18" }]),
      ),
    }).map((row) => row.response_id);
    expect(span).toEqual(["start", "noon", "end", "next", "later"]);
  });

  it("keeps the chosen dates in the URL and chips", () => {
    const source = definition([
      { kind: "date_range", field: "response.responded_at", min: "2026-08-16", max: "2026-08-16" },
    ]);
    const decoded = decodeSegmentDefinition(encodeSegmentDefinition(source));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.definition.conditions).toEqual(source.conditions);
    }
    expect(formatVisibleDate("2026-08-16")).toBe("16 Aug 2026");
    expect(buildSegmentExplorerSummary({ schema, rows, definition: source }).readableConditions[0]?.detail).toBe(
      "16 Aug 2026 → 16 Aug 2026",
    );
  });
});

describe("segment commit limit", () => {
  const survey = buildSurvey([trustConcept, assetsConcept, dfcConcept], { weather: true });
  const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 1 });
  const field = "profile.owned_der_assets.value";

  function filled(extra: SegmentDefinition["conditions"] = []) {
    return definition([
      ...Array.from({ length: 16 - extra.length }, (_, index) => ({
        kind: "contains" as const,
        field,
        value: `asset-${index}`,
      })),
      ...extra,
    ]);
  }

  it("accepts the 16th condition and rejects a 17th from every filter family", () => {
    const atLimit = filled();
    expect(commitSegmentDefinition({ next: atLimit, schema }).ok).toBe(true);
    expect(
      commitSegmentDefinition({
        next: definition([...atLimit.conditions, { kind: "contains", field, value: "extra" }]),
        schema,
      }).ok,
    ).toBe(false);

    const families: SegmentDefinition["conditions"] = [
      { kind: "semantic_band", field: "profile.trust_in_automation.value", band: "high" },
      { kind: "eq", field: "context.country_code", value: "ES" },
      { kind: "eq", field: "context.survey_language", value: "English" },
      { kind: "date_range", field: "response.responded_at", min: "2026-08-16", max: "2026-08-16" },
      { kind: "numeric_range", field: "context.climate.temp_outdoor_c", min: 10, max: 20 },
      { kind: "applicability", field: "profile.declared_flexibility_capability.facets.ev_charging.value", applicable: true },
    ];
    for (const condition of families) {
      expect(
        commitSegmentDefinition({
          next: definition([...atLimit.conditions, condition]),
          schema,
        }).ok,
      ).toBe(false);
    }
  });

  it("allows edits, band/range swaps and replace-after-remove at the limit", () => {
    const withBand = filled([
      { kind: "semantic_band", field: "profile.trust_in_automation.value", band: "high" },
    ]);
    const replaced = setNumericRange(withBand, "profile.trust_in_automation.value", 2, 3);
    expect(commitSegmentDefinition({ next: replaced, schema }).ok).toBe(true);
    expect(replaced.conditions).toHaveLength(16);

    const edited = setEquality(filled([{ kind: "eq", field: "context.country_code", value: "ES" }]), "context.country_code", "FR");
    expect(commitSegmentDefinition({ next: edited, schema }).ok).toBe(true);

    const removed = toggleMembership(filled(), field, "asset-0", "contains");
    expect(removed.conditions).toHaveLength(15);
    const added = toggleMembership(removed, field, "replacement", "contains");
    expect(commitSegmentDefinition({ next: added, schema }).ok).toBe(true);
    expect(added.conditions).toHaveLength(16);
  });

  it("does not apply an invalid URL payload", () => {
    expect(decodeSegmentDefinition("%%%not-base64%%%").ok).toBe(false);
    expect(
      commitSegmentDefinition({
        next: definition([{ kind: "eq", field: "profile.missing.value", value: "x" }]),
        schema,
      }).ok,
    ).toBe(false);
  });
});

describe("segment analysis draft vs analysed", () => {
  const draft = definition([{ kind: "semantic_band", field: "profile.trust_in_automation.value", band: "high" }]);
  const other = definition([{ kind: "semantic_band", field: "profile.trust_in_automation.value", band: "low" }]);

  it("does not treat a preloaded URL draft as analysed", () => {
    expect(isSegmentAnalysisStale(draft, null)).toBe(false);
    expect(canRunSegmentAnalysis(draft, null, "idle")).toBe(true);
    expect(getAnalyseActionLabel(draft, null, "idle")).toBe("Analyse segment");
    expect(getAnalyseActionLabel(definition(), null, "idle")).toBe("Analyse whole sample");
  });

  it("marks the result stale only after an analysis and a later draft change", () => {
    expect(isSegmentAnalysisStale(draft, draft)).toBe(false);
    expect(canRunSegmentAnalysis(draft, draft, "ready")).toBe(false);
    expect(getAnalyseActionLabel(draft, draft, "ready")).toBe("Analysis up to date");
    expect(isSegmentAnalysisStale(other, draft)).toBe(true);
    expect(canRunSegmentAnalysis(other, draft, "ready")).toBe(true);
    expect(getAnalyseActionLabel(other, draft, "ready")).toBe("Update analysis");
    expect(canRunSegmentAnalysis(other, draft, "loading")).toBe(false);
    expect(getAnalyseActionLabel(other, draft, "loading")).toBe("Analysing…");
    expect(canExportSegmentAnalysis("ready", false, draft)).toBe(true);
    expect(canExportSegmentAnalysis("ready", true, draft)).toBe(false);
    expect(canExportSegmentAnalysis("idle", false, null)).toBe(false);
    expect(canExportSegmentAnalysis("ready", false, null)).toBe(false);
  });
});

describe("segment analysis result", () => {
  const survey = buildSurvey(
    [trustConcept, overrideConcept, assetsConcept, dfcConcept, thermalConcept],
    { weather: true },
  );
  const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 4 });
  const rows = [
    record("r1", mapperOutput({ trust: 5, override: 2, assets: ["ev"], dfc: 4, ev: 4, thermal: 4, country: "ES" })),
    record("r2", mapperOutput({ trust: 3, override: 3, assets: ["ev"], dfc: 3, ev: 3, thermal: 3, country: "FR" })),
    record("r3", mapperOutput({ trust: 1, override: 5, assets: ["heat_pump"], dfc: 2, ev: 2, thermal: 2, country: "IE" })),
    record("r4", mapperOutput({ trust: 5, override: 2, assets: ["ev"], dfc: 5, ev: 5, thermal: 5, country: "ES" })),
  ];

  it("describes chips locally without needing an analysis result", () => {
    const local = describeReadableConditions(
      definition([{ kind: "contains", field: "profile.owned_der_assets.value", value: "ev" }]),
      schema,
    );
    expect(local).toEqual([
      {
        field: "profile.owned_der_assets.value",
        label: expect.any(String),
        detail: "Has Electric vehicle",
        defining: true,
      },
    ]);
  });

  it("keeps selectedN + outsideN = analysedN and hides differentiators for the whole sample", () => {
    const whole = buildSegmentAnalysis({ schema, rows, definition: definition() });
    expect(whole.sample.selectedN + whole.sample.outsideN).toBe(whole.sample.analysedN);
    expect(whole.sample.selectedN).toBe(4);
    expect(whole.sample.outsideN).toBe(0);
    expect(whole.differentiators.available).toBe(false);
    expect(whole.differentiators.reason).toBe("whole_sample");
    expect(whole.differentiators.scores).toEqual([]);
    expect(whole.differentiators.categories).toEqual([]);
    expect(assertAggregateSegmentAnalysis(whole)).toEqual({
      hasResponseId: false,
      hasAnswers: false,
      hasMapperOutput: false,
    });
  });

  it("compares the selected segment with the disjoint exterior and excludes defining scores", () => {
    const highTrust = buildSegmentAnalysis({
      schema,
      rows,
      definition: definition([{ kind: "semantic_band", field: "profile.trust_in_automation.value", band: "high" }]),
    });
    expect(highTrust.sample.selectedN).toBe(2);
    expect(highTrust.sample.outsideN).toBe(2);
    expect(highTrust.sample.selectedN + highTrust.sample.outsideN).toBe(highTrust.sample.analysedN);
    expect(highTrust.differentiators.available).toBe(true);
    expect(highTrust.profileAxes.find((axis) => axis.conceptKey === "trust_in_automation")?.defining).toBe(true);
    expect(highTrust.differentiators.scores.map((item) => item.conceptKey)).not.toContain("trust_in_automation");
    expect(highTrust.differentiators.scores.map((item) => item.conceptKey)).toEqual(
      expect.arrayContaining(["declared_flexibility_capability", "thermal_comfort_norms"]),
    );
    expect(highTrust.profileAxes.find((axis) => axis.conceptKey === "thermal_comfort_norms")?.directionNote).toMatch(
      /stricter/i,
    );
    expect(highTrust.profileAxes.find((axis) => axis.conceptKey === "thermal_comfort_norms")?.bands[0]?.label).toBe(
      "Stricter",
    );
  });

  it("does not error when the exterior is empty or the segment is empty", () => {
    const allEnglish = buildSegmentAnalysis({
      schema,
      rows,
      definition: definition([{ kind: "eq", field: "context.survey_language", value: "English" }]),
    });
    expect(allEnglish.sample.selectedN).toBe(4);
    expect(allEnglish.sample.outsideN).toBe(0);
    expect(allEnglish.differentiators.available).toBe(false);
    expect(allEnglish.differentiators.reason).toBe("empty_outside");

    const none = buildSegmentAnalysis({
      schema,
      rows,
      definition: definition([{ kind: "eq", field: "context.country_code", value: "XX" }]),
    });
    expect(none.sample.selectedN).toBe(0);
    expect(none.sample.outsideN).toBe(4);
    expect(none.profileAxes).toEqual([]);
    expect(none.differentiators.available).toBe(false);
    expect(none.differentiators.reason).toBe("empty_segment");
  });

  it("describes a single matching response without requiring a complement", () => {
    const onlyIreland = buildSegmentAnalysis({
      schema,
      rows,
      definition: definition([{ kind: "eq", field: "context.country_code", value: "IE" }]),
    });
    expect(onlyIreland.sample.selectedN).toBe(1);
    const trust = onlyIreland.profileAxes.find((axis) => axis.conceptKey === "trust_in_automation");
    expect(trust?.median).toBe(1);
    expect(trust?.q1).toBe(1);
    expect(trust?.q3).toBe(1);
    expect(onlyIreland.differentiators.available).toBe(true);
  });

  it("keeps defining categorical fields out of the differentiator ranking", () => {
    const spain = buildSegmentAnalysis({
      schema,
      rows,
      definition: definition([{ kind: "eq", field: "context.country_code", value: "ES" }]),
    });
    expect(spain.differentiators.categories.map((item) => item.field)).not.toContain("context.country_code");
  });

  it("exposes facets, supporting factors, catalog DFC modules and asset penetration", () => {
    const highTrust = buildSegmentAnalysis({
      schema,
      rows,
      definition: definition([{ kind: "semantic_band", field: "profile.trust_in_automation.value", band: "high" }]),
    });
    expect(highTrust.facets.some((facet) => facet.conceptKey === "trust_in_automation")).toBe(true);
    expect(highTrust.facets.every((facet) => facet.conceptKey !== "manual_override_need")).toBe(true);
    expect(highTrust.facets.find((facet) => facet.facet === "reliability")?.definingParent).toBe(true);
    expect(highTrust.facets.find((facet) => facet.facet === "reliability")?.evidenceLabel).toBe(SINGLE_ITEM_SIGNAL_LABEL);
    expect(highTrust.supportingFactors.map((factor) => factor.conceptKey)).toContain("manual_override_need");
    expect(highTrust.supportingFactors[0]).not.toHaveProperty("facets");
    expect(highTrust.supportingFactors[0]?.dimensionLabel).toBeTruthy();
    expect(highTrust.conditionalModules?.conceptKey).toBe("declared_flexibility_capability");
    expect(highTrust.conditionalModules?.modules.map((module) => module.setKey)).toEqual(["ev_charging"]);
    expect(highTrust.conditionalModules?.modules.map((module) => module.label)).not.toContain("Washing machine");
    const evModule = highTrust.conditionalModules?.modules[0];
    expect((evModule?.applicableN ?? 0) + (evModule?.notApplicableN ?? 0)).toBe(highTrust.sample.selectedN);
    expect(highTrust.assets.map((asset) => asset.label)).toEqual(expect.arrayContaining(["Electric vehicle"]));
    expect(highTrust.assets.find((asset) => asset.value === "ev")?.disclosure).toBe("suppressed");
    expect(highTrust.assets.find((asset) => asset.value === "ev")?.segmentCount).toBeNull();
    expect(assertAggregateSegmentAnalysis(highTrust)).toEqual({
      hasResponseId: false,
      hasAnswers: false,
      hasMapperOutput: false,
    });
  });

  it("computes internal variation, suppresses small geo cells and omits weather without valid readings", () => {
    const highTrust = buildSegmentAnalysis({
      schema,
      rows,
      definition: definition([{ kind: "semantic_band", field: "profile.trust_in_automation.value", band: "high" }]),
    });
    expect(highTrust.internalVariation.every((item) => item.conceptKey !== "trust_in_automation")).toBe(true);
    expect(highTrust.internalVariation.every((item) => item.normalisedIqr >= 0 && item.bandEntropy >= 0)).toBe(true);
    expect(highTrust.geography).toEqual([]);
    expect(highTrust.weather).toEqual([]);
    expect(highTrust.insights.length).toBeGreaterThan(0);
    expect(highTrust.insights.length).toBeLessThanOrEqual(3);
    expect(highTrust.insights.some((item) => item.observedPattern.toLowerCase().includes("trust in automation") && item.kind === "score_difference")).toBe(false);
    expect(highTrust.associations).toEqual([]);
  });

  it("omits DFC, supporting factors and assets when the survey schema does not include them", () => {
    const leanSurvey = buildSurvey([trustConcept]);
    const leanSchema = buildSurveyAnalyticsSchema({ survey: leanSurvey, readyResponseCount: 2 });
    const leanRows = [
      record("a", mapperOutput({ trust: 5 })),
      record("b", mapperOutput({ trust: 2 })),
    ];
    const result = buildSegmentAnalysis({
      schema: leanSchema,
      rows: leanRows,
      definition: definition([{ kind: "semantic_band", field: "profile.trust_in_automation.value", band: "high" }]),
    });
    expect(result.supportingFactors).toEqual([]);
    expect(result.conditionalModules).toBeNull();
    expect(result.assets).toEqual([]);
    expect(result.facets.length).toBeGreaterThan(0);
  });
});

describe("segment analysis context", () => {
  it("keeps areas at or above the privacy threshold and drops smaller cells", () => {
    const survey = buildSurvey([trustConcept], { geo: true });
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 6 });
    const rows = [
      ...Array.from({ length: 5 }, (_, index) =>
        record(`es-${index}`, mapperOutput({ trust: 4, country: "ES" })),
      ),
      record("fr-1", mapperOutput({ trust: 2, country: "FR" })),
    ];
    const result = buildSegmentAnalysis({
      schema,
      rows,
      definition: definition([{ kind: "eq", field: "context.country_code", value: "ES" }]),
    });
    expect(SEGMENT_CELL_MIN_N).toBe(5);
    const countries = result.geography.filter((row) => row.field === "context.country_code");
    expect(countries.map((row) => row.value)).toEqual(["ES"]);
    expect(countries[0]?.analysedCount).toBe(5);
    expect(countries[0]?.penetration).toBe(1);
    expect(result.geography.map((row) => row.value)).not.toContain("FR");
    expect(result.geography.every((row) => row.analysedCount >= SEGMENT_CELL_MIN_N)).toBe(true);
  });

  it("exposes valid weather context and Spearman pairs when the sample is large enough", () => {
    const survey = buildSurvey([trustConcept, thermalConcept, overrideConcept], { weather: true });
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 6 });
    const rows = [
      record("a", mapperOutput({ trust: 5, thermal: 2, override: 2, temp: 8 })),
      record("b", mapperOutput({ trust: 4, thermal: 3, override: 3, temp: 10 })),
      record("c", mapperOutput({ trust: 4, thermal: 4, override: 2, temp: 12 })),
      record("d", mapperOutput({ trust: 3, thermal: 3, override: 4, temp: 11 })),
      record("e", mapperOutput({ trust: 2, thermal: 5, override: 5, temp: 9 })),
      record("f", mapperOutput({ trust: 5, thermal: 2, override: 1, temp: 7 })),
    ];
    const result = buildSegmentAnalysis({ schema, rows, definition: definition() });
    expect(result.weather[0]?.field).toBe("context.climate.temp_outdoor_c");
    expect(result.weather[0]?.n).toBe(6);
    expect(result.weather[0]?.min).toBe(7);
    expect(result.weather[0]?.max).toBe(12);
    expect(result.associations.length).toBeGreaterThan(0);
    expect(result.associations.every((item) => item.pairedN >= 5)).toBe(true);
    expect(result.insights.every((item) => item.kind !== "score_difference")).toBe(true);
  });
});

describe("segment analysis corrections", () => {
  it("uses the production weather_ok flag and ignores the test-only ok flag", () => {
    const survey = buildSurvey([trustConcept], { weather: true });
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 2 });
    expect(schema.schema_version).toBe(1);
    expect(isUsableWeatherQuality("weather_ok")).toBe(true);
    expect(isUsableWeatherQuality("ok")).toBe(false);
    const real = buildSegmentAnalysis({
      schema,
      rows: [
        record("a", mapperOutput({ trust: 4, temp: 11, weatherFlag: "weather_ok" })),
        record("b", mapperOutput({ trust: 2, temp: 9, weatherFlag: "weather_ok" })),
      ],
      definition: definition(),
    });
    expect(real.weather[0]?.n).toBe(2);
    const staleFlag = buildSegmentAnalysis({
      schema,
      rows: [
        record("a", mapperOutput({ trust: 4, temp: 11, weatherFlag: "ok" })),
        record("b", mapperOutput({ trust: 2, temp: 9, weatherFlag: "ok" })),
      ],
      definition: definition(),
    });
    expect(staleFlag.weather).toEqual([]);
  });

  it("describes whole-sample assets without a fake exterior comparison", () => {
    const survey = buildSurvey([trustConcept, assetsConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 6 });
    const rows = Array.from({ length: 6 }, (_, index) =>
      record(`r${index}`, mapperOutput({ trust: 3, assets: index < 5 ? ["ev", "heat_pump"] : ["ev"] })),
    );
    const whole = buildSegmentAnalysis({ schema, rows, definition: definition() });
    expect(whole.sample.comparisonAvailable).toBe(false);
    expect(whole.assets.every((asset) => asset.comparisonAvailable === false)).toBe(true);
    expect(whole.assets.every((asset) => asset.outsideShare == null && asset.deltaPercentagePoints == null)).toBe(true);
    expect(whole.assets.find((asset) => asset.value === "ev")?.segmentShare).toBe(1);
    expect(whole.insights.some((item) => item.kind === "asset_difference")).toBe(false);
  });

  it("does not expose modulator facets even when the survey only measures a modulator", () => {
    const survey = buildSurvey([overrideConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 6 });
    const rows = [
      record("a", mapperOutput({ override: 5 })),
      record("b", mapperOutput({ override: 5 })),
      record("c", mapperOutput({ override: 4 })),
      record("d", mapperOutput({ override: 2 })),
      record("e", mapperOutput({ override: 1 })),
      record("f", mapperOutput({ override: 2 })),
    ];
    const result = buildSegmentAnalysis({
      schema,
      rows,
      definition: definition([{ kind: "eq", field: "context.survey_language", value: "English" }]),
    });
    expect(result.facets).toEqual([]);
    expect(result.supportingFactors.map((factor) => factor.conceptKey)).toEqual(["manual_override_need"]);
    expect(result.insights.some((item) => item.kind === "facet_contrast")).toBe(false);
  });

  it("only claims a within-construct facet contrast when two comparable facets exist", () => {
    const survey = buildSurvey([trustConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 10 });
    const rows = [
      record("a", mapperOutput({ trust: 5, country: "ES" })),
      record("b", mapperOutput({ trust: 5, country: "ES" })),
      record("c", mapperOutput({ trust: 4, country: "ES" })),
      record("d", mapperOutput({ trust: 5, country: "ES" })),
      record("e", mapperOutput({ trust: 4, country: "ES" })),
      record("f", mapperOutput({ trust: 2, country: "FR" })),
      record("g", mapperOutput({ trust: 1, country: "FR" })),
      record("h", mapperOutput({ trust: 2, country: "FR" })),
      record("i", mapperOutput({ trust: 1, country: "FR" })),
      record("j", mapperOutput({ trust: 2, country: "FR" })),
    ];
    rows[0].mapper_output.profile.trust_in_automation!.facets!.reliability.value = 5;
    rows[0].mapper_output.profile.trust_in_automation!.facets!.delegation.value = 1;
    rows[1].mapper_output.profile.trust_in_automation!.facets!.reliability.value = 5;
    rows[1].mapper_output.profile.trust_in_automation!.facets!.delegation.value = 1;
    rows[2].mapper_output.profile.trust_in_automation!.facets!.reliability.value = 5;
    rows[2].mapper_output.profile.trust_in_automation!.facets!.delegation.value = 2;
    rows[3].mapper_output.profile.trust_in_automation!.facets!.reliability.value = 5;
    rows[3].mapper_output.profile.trust_in_automation!.facets!.delegation.value = 1;
    rows[4].mapper_output.profile.trust_in_automation!.facets!.reliability.value = 4;
    rows[4].mapper_output.profile.trust_in_automation!.facets!.delegation.value = 2;
    const result = buildSegmentAnalysis({
      schema,
      rows,
      definition: definition([{ kind: "eq", field: "context.country_code", value: "ES" }]),
    });
    expect(result.facets.length).toBeGreaterThan(1);
    const facetInsight = result.insights.find((item) => item.kind === "facet_contrast");
    expect(facetInsight?.evidence?.cliffsDelta).not.toBeNull();
    expect(facetInsight?.worthExamining).not.toMatch(/add(ing)? another filter/i);
  });

  it("protects n=1 geo and contextual cells without blocking the aggregate profile", () => {
    const survey = buildSurvey([trustConcept], { geo: true });
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 6 });
    const rows = [
      record("high", mapperOutput({ trust: 5, country: "ES" })),
      ...Array.from({ length: 5 }, (_, index) =>
        record(`low-${index}`, mapperOutput({ trust: 2, country: "ES" })),
      ),
    ];
    const result = buildSegmentAnalysis({
      schema,
      rows,
      definition: definition([{ kind: "semantic_band", field: "profile.trust_in_automation.value", band: "high" }]),
    });
    expect(result.sample.selectedN).toBe(1);
    expect(result.profileAxes[0]?.median).toBe(5);
    expect(result.geography.every((row) => row.disclosure === "suppressed")).toBe(true);
    expect(result.geography.every((row) => row.segmentCount == null && row.penetration == null)).toBe(true);
    expect(JSON.stringify(result.geography)).not.toMatch(/"segmentCount":1/);
    expect(result.differentiators.categories.every((item) => item.disclosure === "suppressed")).toBe(true);
  });

  it("suppresses the complementary cell that would reconstruct a small count", () => {
    expect(
      [...discloseExclusiveCounts(
        [
          { key: "ES", count: 5 },
          { key: "FR", count: 1 },
        ],
        6,
      )].sort(),
    ).toEqual(["ES", "FR"]);
    expect(
      discloseExclusiveCounts(
        [
          { key: "ES", count: 12 },
          { key: "FR", count: 8 },
        ],
        20,
      ).size,
    ).toBe(0);

    const survey = buildSurvey([trustConcept], { geo: true });
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 14 });
    const rows = [
      ...Array.from({ length: 5 }, (_, index) =>
        record(`es-high-${index}`, mapperOutput({ trust: 5, country: "ES" })),
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        record(`es-low-${index}`, mapperOutput({ trust: 2, country: "ES" })),
      ),
      record("fr-high", mapperOutput({ trust: 5, country: "FR" })),
      ...Array.from({ length: 5 }, (_, index) =>
        record(`fr-low-${index}`, mapperOutput({ trust: 2, country: "FR" })),
      ),
    ];
    const result = buildSegmentAnalysis({
      schema,
      rows,
      definition: definition([{ kind: "semantic_band", field: "profile.trust_in_automation.value", band: "high" }]),
    });
    const countries = result.geography.filter((row) => row.field === "context.country_code");
    expect(countries).toHaveLength(2);
    expect(countries.every((row) => row.disclosure === "suppressed")).toBe(true);
    expect(countries.every((row) => row.segmentCount == null)).toBe(true);
  });

  it("keeps the largest IQR among all eligible variation rows", () => {
    const survey = buildSurvey([trustConcept, thermalConcept, overrideConcept, savingsConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 6 });
    const rows = [
      record("a", mapperOutput({ trust: 3, thermal: 1, override: 3, savings: 3 })),
      record("b", mapperOutput({ trust: 3, thermal: 1, override: 3, savings: 3 })),
      record("c", mapperOutput({ trust: 3, thermal: 5, override: 3, savings: 3 })),
      record("d", mapperOutput({ trust: 3, thermal: 5, override: 3, savings: 3 })),
      record("e", mapperOutput({ trust: 3, thermal: 5, override: 3, savings: 3 })),
      record("f", mapperOutput({ trust: 3, thermal: 1, override: 3, savings: 3 })),
    ];
    const result = buildSegmentAnalysis({ schema, rows, definition: definition() });
    const eligible =
      result.profileAxes.filter((axis) => !axis.defining).length +
      result.supportingFactors.filter((factor) => !factor.defining).length;
    expect(result.internalVariation).toHaveLength(eligible);
    const widest = result.internalVariation.reduce((max, item) => (item.iqr > max.iqr ? item : max));
    expect(widest.conceptKey).toBe("thermal_comfort_norms");
  });

  it("renders a true zero share as width 0", () => {
    expect(percentageBarWidth(0)).toBe(0);
    expect(percentageBarWidth(null)).toBe(0);
    expect(percentageBarWidth(0.25)).toBe(25);
  });

  it("keeps descriptives with a small n and withholds comparative semantic insights", () => {
    expect(SEGMENT_SEMANTIC_MIN_N).toBe(5);
    expect(SEGMENT_SEMANTIC_MIN_N).not.toBe(SEGMENT_CELL_MIN_N - 1);
    const survey = buildSurvey([trustConcept, thermalConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 7 });
    const rows = [
      record("high-a", mapperOutput({ trust: 5, thermal: 1 })),
      record("high-b", mapperOutput({ trust: 5, thermal: 5 })),
      record("high-c", mapperOutput({ trust: 4, thermal: 1 })),
      record("high-d", mapperOutput({ trust: 5, thermal: 5 })),
      ...Array.from({ length: 3 }, (_, index) =>
        record(`low-${index}`, mapperOutput({ trust: 1, thermal: 3 })),
      ),
    ];
    const smallOutside = buildSegmentAnalysis({
      schema,
      rows,
      definition: definition([{ kind: "semantic_band", field: "profile.trust_in_automation.value", band: "high" }]),
    });
    expect(smallOutside.sample.selectedN).toBe(4);
    expect(smallOutside.sample.outsideN).toBe(3);
    expect(smallOutside.profileAxes[0]?.median).toBeGreaterThan(0);
    expect(smallOutside.profileAxes[0]?.bands.some((band) => band.share > 0)).toBe(true);
    expect(smallOutside.insights.some((item) => item.kind === "score_difference")).toBe(false);
    expect(smallOutside.insights.some((item) => item.kind === "facet_contrast")).toBe(false);
    expect(smallOutside.insights.some((item) => item.kind === "asset_difference")).toBe(false);
  });

  it("allows an internal variation insight when the segment n is at least 5 even if the exterior is small", () => {
    const survey = buildSurvey([trustConcept, thermalConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 7 });
    const rows = [
      record("a", mapperOutput({ trust: 5, thermal: 1, country: "ES" })),
      record("b", mapperOutput({ trust: 5, thermal: 1, country: "ES" })),
      record("c", mapperOutput({ trust: 5, thermal: 5, country: "ES" })),
      record("d", mapperOutput({ trust: 5, thermal: 5, country: "ES" })),
      record("e", mapperOutput({ trust: 5, thermal: 3, country: "ES" })),
      record("f", mapperOutput({ trust: 1, thermal: 3, country: "FR" })),
      record("g", mapperOutput({ trust: 2, thermal: 3, country: "FR" })),
    ];
    const result = buildSegmentAnalysis({
      schema,
      rows,
      definition: definition([{ kind: "eq", field: "context.country_code", value: "ES" }]),
    });
    expect(result.sample.selectedN).toBe(5);
    expect(result.sample.outsideN).toBe(2);
    expect(result.insights.some((item) => item.kind === "score_difference")).toBe(false);
    expect(result.insights.some((item) => item.kind === "internal_variation")).toBe(true);
    expect(result.insights.find((item) => item.kind === "internal_variation")?.evidence?.selectedN).toBeGreaterThanOrEqual(
      SEGMENT_SEMANTIC_MIN_N,
    );
  });

  it("shows a neutral semantic state instead of fabricating an alternative reading", () => {
    const survey = buildSurvey([trustConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 6 });
    const rows = [
      record("high", mapperOutput({ trust: 5 })),
      ...Array.from({ length: 5 }, (_, index) => record(`low-${index}`, mapperOutput({ trust: 2 }))),
    ];
    const result = buildSegmentAnalysis({
      schema,
      rows,
      definition: definition([{ kind: "semantic_band", field: "profile.trust_in_automation.value", band: "high" }]),
    });
    expect(result.sample.selectedN).toBe(1);
    expect(result.profileAxes[0]?.median).toBe(5);
    expect(result.insights).toEqual([
      expect.objectContaining({
        kind: "none",
        observedPattern: SEMANTIC_INSUFFICIENT_EVIDENCE,
        potentialReading: "",
        worthExamining: "",
      }),
    ]);
  });

  it("hides geographic detail when the area complement has 1–4 cases", () => {
    const survey = buildSurvey([trustConcept], { geo: true });
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 11 });
    const rows = [
      ...Array.from({ length: 5 }, (_, index) =>
        record(`es-high-${index}`, mapperOutput({ trust: 5, country: "ES" })),
      ),
      record("es-low", mapperOutput({ trust: 2, country: "ES" })),
      ...Array.from({ length: 5 }, (_, index) =>
        record(`fr-low-${index}`, mapperOutput({ trust: 2, country: "FR" })),
      ),
    ];
    const result = buildSegmentAnalysis({
      schema,
      rows,
      definition: definition([{ kind: "semantic_band", field: "profile.trust_in_automation.value", band: "high" }]),
    });
    expect(result.sample.selectedN).toBe(5);
    expect(result.profileAxes[0]?.median).toBe(5);
    const countries = result.geography.filter((row) => row.field === "context.country_code");
    expect(countries.map((row) => row.value).sort()).toEqual(["ES", "FR"]);
    expect(countries.every((row) => row.disclosure === "suppressed")).toBe(true);
    expect(countries.every((row) => row.segmentCount == null && row.penetration == null)).toBe(true);
    expect(JSON.stringify(countries)).not.toMatch(/"segmentCount":5/);
  });

  it("exports the current analysed result as versioned aggregate JSON", () => {
    const survey = buildSurvey([trustConcept, overrideConcept]);
    const schema = buildSurveyAnalyticsSchema({ survey, readyResponseCount: 6 });
    schema.schema_version = 1;
    const rows = Array.from({ length: 6 }, (_, index) =>
      record(`r${index}`, mapperOutput({ trust: index < 3 ? 5 : 2, override: 3 })),
    );
    const analysis = buildSegmentAnalysis({
      schema,
      rows,
      definition: definition([{ kind: "semantic_band", field: "profile.trust_in_automation.value", band: "high" }]),
      generatedAt: "2026-08-17T09:00:00.000Z",
    });
    const file = buildSegmentAnalysisExport({ analysis, schema });
    const parsed = JSON.parse(file.body) as {
      exportVersion: string;
      analysisVersion: string;
      methodologyVersion: string;
      generatedAt: string;
      schemaNamespace: string;
      schemaVersion: number;
      measurementHash: string | null;
      analysis: typeof analysis;
    };
    expect(file.filename).toMatch(/^segment-analysis-survey-segments-/);
    expect(parsed).toEqual(
      expect.objectContaining({
        exportVersion: SEGMENT_ANALYSIS_EXPORT_VERSION,
        analysisVersion: SEGMENT_ANALYSIS_VERSION,
        methodologyVersion: SEGMENT_ANALYSIS_METHODOLOGY_VERSION,
        generatedAt: "2026-08-17T09:00:00.000Z",
        schemaNamespace: schema.schema_namespace,
        schemaVersion: 1,
        measurementHash: schema.measurement_hash,
      }),
    );
    expect(parsed.analysis.definition).toEqual(analysis.definition);
    expect(parsed.analysis.supportingFactors.map((factor) => factor.conceptKey)).toContain("manual_override_need");
    expect(segmentAnalysisExportContainsSensitiveField(parsed)).toBe(false);
    expect(file.body).not.toMatch(/response_id|answers_json|mapper_output|prolific/i);
    expect(canExportSegmentAnalysis("ready", false, analysis)).toBe(true);
    expect(canExportSegmentAnalysis("ready", true, analysis)).toBe(false);
  });
});

describe("Cliff’s delta", () => {
  it("returns the expected values for complete separation, ties and empty groups", () => {
    expect(computeCliffsDelta([3, 4, 5], [1, 2])).toBe(1);
    expect(computeCliffsDelta([1, 2], [3, 4, 5])).toBe(-1);
    expect(computeCliffsDelta([2, 2, 2], [2, 2])).toBe(0);
    expect(computeCliffsDelta([1], [1])).toBe(0);
    expect(computeCliffsDelta([], [1])).toBeNull();
    expect(computeCliffsDelta([1], [])).toBeNull();
  });
});

describe("segment URL priority helpers", () => {
  it("treats a missing URL payload as whole sample and does not read storage for the active segment", () => {
    const active = emptySegmentDefinition({
      surveyId: "survey-segments",
      schemaNamespace: "flexpulse_behavioural_schema",
      measurementHash: "measure-1",
    });
    expect(isWholeSampleDefinition(active)).toBe(true);
    expect(readSavedSegments("survey-segments", "measure-1", memoryAdapter())).toEqual([]);
  });
});
