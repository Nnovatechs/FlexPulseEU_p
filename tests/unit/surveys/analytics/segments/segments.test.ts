import { describe, expect, it } from "vitest";
import {
  addToComparisonTray,
  buildSegmentCatalog,
  buildSegmentExplorerSummary,
  commitSegmentDefinition,
  compileSegmentDefinition,
  decodeSegmentDefinition,
  emptySegmentDefinition,
  encodeSegmentDefinition,
  formatVisibleDate,
  getAssetValueLabel,
  getBandLabel,
  getConceptDescription,
  getEvidenceLabel,
  getFieldBand,
  getFieldRange,
  getScoreDirectionNote,
  isWholeSampleDefinition,
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
  setEquality,
  setNumericRange,
  SINGLE_ITEM_SIGNAL_LABEL,
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

function mapperOutput(input: {
  trust?: number;
  override?: number;
  savings?: number;
  assets?: string[];
  dfc?: number | null;
  ev?: number | null;
  country?: string;
  language?: string;
  temp?: number;
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
              quality_flag: "ok",
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

function record(id: string, output: MapperOutput): SurveyAnalyticsRecord {
  return {
    response_id: id,
    responded_at: "2026-01-01T00:00:00.000Z",
    audience_token: "default",
    audience_label: "Default",
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
    const source = definition([{ kind: "semantic_band", field: "profile.trust_in_automation.value", band: "high" }]);
    const encoded = encodeSegmentDefinition(source);
    const decoded = decodeSegmentDefinition(encoded);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(segmentDefinitionsEqual(decoded.definition, source)).toBe(true);
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
