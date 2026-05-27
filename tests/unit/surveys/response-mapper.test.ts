import { describe, expect, it } from "vitest";
import {
  createInitialMappingContract,
  createInitialSurveyDefinition,
  type PersistedSurvey,
} from "@/features/surveys/generator-types";
import { compileMappingContract } from "@/features/surveys/generator-mapping";
import {
  mapSurveyResponseToOutput,
  type ResponseEnrichmentRecord,
} from "@/features/surveys/response-mapper";

function buildPublishedSurveyFixture(): PersistedSurvey {
  const definition = createInitialSurveyDefinition("English", ["English"]);
  definition.questions = [
    {
      question_key: "Q_TRUST_01",
      type: "rating_scale",
      required: true,
      order: 1,
      scale: { min: 1, max: 5, step: 1, min_label: "Low", max_label: "High" },
    },
    {
      question_key: "Q_TRUST_02",
      type: "rating_scale",
      required: true,
      order: 2,
      scale: { min: 1, max: 5, step: 1, min_label: "Low", max_label: "High" },
    },
    {
      question_key: "Q_DER_01",
      type: "multiple_choice",
      required: true,
      order: 3,
      options: [
        { option_key: "heat_pump", value: "heat_pump" },
        { option_key: "ev", value: "ev" },
      ],
    },
  ];
  definition.translations.English.survey_title = "Baseline survey";
  definition.translations.English.questions = {
    Q_TRUST_01: { title: "I trust automation for home energy scheduling." },
    Q_TRUST_02: { title: "I trust automation to adjust some devices automatically." },
    Q_DER_01: { title: "Which flexible energy assets do you already have?" },
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
            intent: "Measure trust in reliability.",
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
        question_intents: [],
      },
      {
        concept_key: "country_code",
        evidence_source: "response_context",
        measurement_type: "context_passthrough",
        output_type: "string",
        aggregation_rule: "context_passthrough",
        threshold_profile: "none",
        minimum_answer_count: 0,
        question_keys: [],
        required_question_keys: [],
        question_intents: [],
        source_paths: ["response_context.country_code"],
      },
      {
        concept_key: "climate_context",
        evidence_source: "enrichment",
        measurement_type: "context_passthrough",
        output_type: "enum",
        aggregation_rule: "context_passthrough",
        threshold_profile: "none",
        minimum_answer_count: 0,
        question_keys: [],
        required_question_keys: [],
        question_intents: [],
        source_paths: ["response_enrichment.outdoor_temperature_c"],
      },
    ],
  };

  const mappingContract = createInitialMappingContract();
  mappingContract.mappings = [
    {
      question_key: "Q_TRUST_01",
      ontology_target: "flexpulse_behavioural_schema.trust_in_automation",
      expected_type: "number",
      required_for_mapping: true,
      transform_strategy: { kind: "numeric_range", min: 1, max: 5 },
    },
    {
      question_key: "Q_TRUST_02",
      ontology_target: "flexpulse_behavioural_schema.trust_in_automation",
      expected_type: "number",
      required_for_mapping: true,
      transform_strategy: { kind: "numeric_range", min: 1, max: 5 },
    },
    {
      question_key: "Q_DER_01",
      ontology_target: "flexpulse_behavioural_schema.owned_der_assets",
      expected_type: "string[]",
      required_for_mapping: true,
      transform_strategy: {
        kind: "enum_lookup",
        option_to_value: {
          heat_pump: "heat_pump",
          ev: "ev",
        },
      },
    },
  ];

  return {
    id: "survey_1",
    name: "Baseline survey",
    status: "published",
    created_by: "user_1",
    created_at: "2026-04-06T10:00:00.000Z",
    updated_at: "2026-04-06T10:00:00.000Z",
    published_at: "2026-04-06T10:10:00.000Z",
    default_language: "English",
    supported_languages: ["English"],
    definition_json: definition,
    mapping_contract_json: mappingContract,
    mapping_compiled_json: compileMappingContract(mappingContract),
    mapping_hash: "mapping_hash_v1",
    measurement_hash: "measurement_hash_v1",
  };
}

function buildEnrichment(): ResponseEnrichmentRecord {
  return {
    provider: "open_meteo",
    normalized_country_code: "ES",
    location_agg_code: "ES:city:valencia",
    location_agg_label: "Valencia",
    location_granularity: "city",
    centroid_lat: 39.4699,
    centroid_lon: -0.3763,
    normalized_location_json: {
      provider: "open_meteo_geocoding",
    },
    temp_outdoor_c: 18.2,
    humidity_pct: 61,
    observed_at: "2026-04-06T12:00:00Z",
    quality_flag: "weather_ok",
  };
}

describe("response mapper", () => {
  it("builds profile, context metadata and mapping metadata deterministically", () => {
    const output = mapSurveyResponseToOutput({
      survey: buildPublishedSurveyFixture(),
      answers: {
        Q_TRUST_01: 4,
        Q_TRUST_02: 5,
        Q_DER_01: ["heat_pump", "ev"],
      },
      submittedLanguage: "English",
      countryCodeRaw: "es",
      mappingHashAtSubmission: "mapping_hash_v1",
      measurementHashAtSubmission: "measurement_hash_v1",
      enrichment: buildEnrichment(),
    });

    expect(output.profile).toMatchObject({
      trust_in_automation: {
        value: 4.5,
        tag: "high",
        facets: {
          reliability: {
            value: 4,
            evidence_count: 1,
            evidence_level: "interpretive_signal",
          },
          delegation: {
            value: 5,
            evidence_count: 1,
            evidence_level: "interpretive_signal",
          },
        },
      },
      owned_der_assets: {
        value: ["heat_pump", "ev"],
      },
    });
    expect(output.context_metadata).toMatchObject({
      country_code: "ES",
      survey_language: "English",
      location: {
        agg_code: "ES:city:valencia",
        label: "Valencia",
        granularity: "city",
      },
      climate: {
        provider: "open_meteo",
        quality_flag: "weather_ok",
        temp_outdoor_c: 18.2,
      },
    });
    expect(output.mapping_metadata).toEqual({
      mapping_hash: "mapping_hash_v1",
      measurement_hash: "measurement_hash_v1",
      mapping_hash_at_submission: "mapping_hash_v1",
      measurement_hash_at_submission: "measurement_hash_v1",
      mapper_version: "v1",
      threshold_profile_version: "v1",
    });
  });

  it("falls back to the raw country code and keeps null when required slots are missing", () => {
    const survey = buildPublishedSurveyFixture();
    const output = mapSurveyResponseToOutput({
      survey,
      answers: {
        Q_TRUST_01: 4,
      },
      submittedLanguage: "English",
      countryCodeRaw: "hr",
      mappingHashAtSubmission: null,
      measurementHashAtSubmission: null,
      enrichment: null,
    });

    expect(output.profile.trust_in_automation).toEqual({
      value: null,
    });
    expect(output.context_metadata.country_code).toBe("HR");
    expect(output.context_metadata.location).toBeNull();
    expect(output.context_metadata.climate).toBeNull();
  });

  it("returns null when optional slots satisfy minimum_answer_count but required slots are missing", () => {
    const survey = buildPublishedSurveyFixture();
    survey.definition_json.survey_meta.measurement_plan_json = {
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
          question_keys: ["Q_TRUST_01", "Q_TRUST_02", "Q_TRUST_03", "Q_TRUST_04"],
          required_question_keys: ["Q_TRUST_01", "Q_TRUST_02"],
        },
      ],
    };

    survey.definition_json.questions.push(
      {
        question_key: "Q_TRUST_03",
        type: "rating_scale",
        required: false,
        order: 3,
        scale: { min: 1, max: 5, step: 1, min_label: "Low", max_label: "High" },
      },
      {
        question_key: "Q_TRUST_04",
        type: "rating_scale",
        required: false,
        order: 4,
        scale: { min: 1, max: 5, step: 1, min_label: "Low", max_label: "High" },
      },
    );

    const mapping = survey.mapping_contract_json;
    mapping.mappings.push(
      {
        question_key: "Q_TRUST_03",
        ontology_target: "flexpulse_behavioural_schema.trust_in_automation",
        expected_type: "number",
        required_for_mapping: false,
        transform_strategy: { kind: "numeric_range", min: 1, max: 5 },
      },
      {
        question_key: "Q_TRUST_04",
        ontology_target: "flexpulse_behavioural_schema.trust_in_automation",
        expected_type: "number",
        required_for_mapping: false,
        transform_strategy: { kind: "numeric_range", min: 1, max: 5 },
      },
    );
    survey.mapping_compiled_json = compileMappingContract(mapping);

    const output = mapSurveyResponseToOutput({
      survey,
      answers: {
        Q_TRUST_03: 4,
        Q_TRUST_04: 5,
      },
      submittedLanguage: "English",
      countryCodeRaw: null,
      mappingHashAtSubmission: null,
      measurementHashAtSubmission: null,
      enrichment: null,
    });

    expect(output.profile.trust_in_automation).toEqual({
      value: null,
    });
    expect(output.profile.trust_in_automation).not.toHaveProperty("facets");
  });

  it("returns null when a required question key has no compiled mapping entry", () => {
    const survey = buildPublishedSurveyFixture();
    const compiled = survey.mapping_compiled_json;
    if (!compiled) {
      throw new Error("Missing compiled mapping fixture.");
    }

    delete compiled.by_question_key.Q_TRUST_02;

    const output = mapSurveyResponseToOutput({
      survey,
      answers: {
        Q_TRUST_01: 4,
        Q_TRUST_02: 5,
      },
      submittedLanguage: "English",
      countryCodeRaw: "es",
      mappingHashAtSubmission: "mapping_hash_v1",
      measurementHashAtSubmission: "measurement_hash_v1",
      enrichment: null,
    });

    expect(output.profile.trust_in_automation).toEqual({
      value: null,
    });
  });

  it("uses plan-level evidence_level while keeping observed evidence_count", () => {
    const survey = buildPublishedSurveyFixture();
    const trustConcept =
      survey.definition_json.survey_meta.measurement_plan_json?.concepts.find(
        (concept) => concept.concept_key === "trust_in_automation",
      );

    if (!trustConcept?.question_intents) {
      throw new Error("Missing trust question intents in fixture.");
    }

    trustConcept.question_intents[1].facet = "reliability";
    trustConcept.required_question_keys = ["Q_TRUST_01"];

    const output = mapSurveyResponseToOutput({
      survey,
      answers: {
        Q_TRUST_01: 4,
        Q_TRUST_02: 5,
        Q_DER_01: ["heat_pump"],
      },
      submittedLanguage: "English",
      countryCodeRaw: "es",
      mappingHashAtSubmission: "mapping_hash_v1",
      measurementHashAtSubmission: "measurement_hash_v1",
      enrichment: null,
    });

    expect(output.profile.trust_in_automation?.facets?.reliability).toEqual({
      value: 4.5,
      evidence_count: 2,
      evidence_level: "facet_subscore",
    });
  });

  it("reverse-codes negative-polarity numeric items before aggregation", () => {
    const survey = buildPublishedSurveyFixture();
    const trustConcept =
      survey.definition_json.survey_meta.measurement_plan_json?.concepts.find(
        (concept) => concept.concept_key === "trust_in_automation",
      );

    if (!trustConcept?.question_intents) {
      throw new Error("Missing trust question intents in fixture.");
    }

    trustConcept.question_intents[1].polarity = "negative";

    const output = mapSurveyResponseToOutput({
      survey,
      answers: {
        Q_TRUST_01: 5,
        Q_TRUST_02: 5,
      },
      submittedLanguage: "English",
      countryCodeRaw: "es",
      mappingHashAtSubmission: "mapping_hash_v1",
      measurementHashAtSubmission: "measurement_hash_v1",
      enrichment: null,
    });

    expect(output.profile.trust_in_automation).toMatchObject({
      value: 3,
      tag: "medium",
      facets: {
        reliability: {
          value: 5,
          evidence_count: 1,
          evidence_level: "interpretive_signal",
        },
        delegation: {
          value: 1,
          evidence_count: 1,
          evidence_level: "interpretive_signal",
        },
      },
    });
  });
});
