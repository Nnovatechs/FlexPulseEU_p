import { describe, expect, it } from "vitest";
import {
  ANALYTICS_V2_TABS,
} from "@/features/surveys/analytics/analytics-v2-tabs";
import {
  buildInstrumentHealthData,
  instrumentHealthJsonContainsSensitiveField,
  type InstrumentHealthLoadedResponse,
  type InstrumentHealthSource,
} from "@/features/surveys/analytics/instrument-health";
import { getInstrumentMeasurementRole } from "@/features/surveys/analytics/instrument-health-semantics";
import {
  createInitialMappingContract,
  createInitialSurveyDefinition,
  type PersistedSurvey,
} from "@/features/surveys/generator-types";
import { compileMappingContract } from "@/features/surveys/generator-mapping";
import { mapSurveyResponseToOutput } from "@/features/surveys/response-mapper";
import type { SubmittedSurveyAnswer } from "@/features/surveys/response-validation";

const CURRENT_HASH = "measure-current";
const CURRENT_MAPPING = "map-current";

function buildSurvey(): PersistedSurvey {
  const definition = createInitialSurveyDefinition("English", ["English", "Spanish"]);
  definition.questions = [
    {
      question_key: "Q_TRUST_01",
      type: "rating_scale",
      required: true,
      order: 1,
      scale: { min: 1, max: 5 },
    },
    {
      question_key: "Q_TRUST_02",
      type: "rating_scale",
      required: true,
      order: 2,
      scale: { min: 1, max: 5 },
    },
    {
      question_key: "Q_TARIFF_01",
      type: "rating_scale",
      required: true,
      order: 3,
      scale: { min: 1, max: 5 },
    },
    {
      question_key: "Q_TARIFF_02",
      type: "rating_scale",
      required: true,
      order: 4,
      scale: { min: 1, max: 5 },
    },
    {
      question_key: "Q_DER_01",
      type: "multiple_choice",
      required: true,
      order: 5,
      options: [
        { option_key: "ev", value: "ev" },
        { option_key: "heat_pump", value: "heat_pump" },
      ],
    },
    {
      question_key: "Q_FLEX_01",
      type: "rating_scale",
      required: true,
      order: 6,
      scale: { min: 1, max: 5 },
      visibility_rule: {
        source_question_key: "Q_DER_01",
        operator: "contains_any",
        values: ["ev"],
      },
    },
  ];
  definition.translations.English.questions = {
    Q_TRUST_01: { title: "I trust automation." },
    Q_TRUST_02: { title: "I dislike automation acting alone." },
    Q_TARIFF_01: { title: "I accept time-of-use prices." },
    Q_TARIFF_02: { title: "I accept dynamic prices." },
    Q_DER_01: { title: "Which assets do you have?" },
    Q_FLEX_01: { title: "I can delay EV charging." },
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
        aggregation_rule: "mean",
        threshold_profile: "likert_1_5_low_mid_high",
        minimum_answer_count: 2,
        question_keys: ["Q_TRUST_01", "Q_TRUST_02"],
        required_question_keys: ["Q_TRUST_01", "Q_TRUST_02"],
        question_intents: [
          {
            slot_key: "SLOT_TRUST_01",
            question_key: "Q_TRUST_01",
            facet: "reliability",
            intent: "Trust reliability.",
            polarity: "positive",
          },
          {
            slot_key: "SLOT_TRUST_02",
            question_key: "Q_TRUST_02",
            facet: "autonomy_discomfort",
            intent: "Discomfort with unattended automation.",
            polarity: "negative",
          },
        ],
      },
      {
        concept_key: "tariff_preference_orientation",
        evidence_source: "survey_questions",
        measurement_type: "multi_item_likert_mean",
        output_type: "number",
        aggregation_rule: "mean",
        threshold_profile: "likert_1_5_low_mid_high",
        minimum_answer_count: 2,
        question_keys: ["Q_TARIFF_01", "Q_TARIFF_02"],
        required_question_keys: ["Q_TARIFF_01", "Q_TARIFF_02"],
        question_intents: [
          {
            slot_key: "SLOT_TARIFF_01",
            question_key: "Q_TARIFF_01",
            facet: "tou",
            intent: "Time-of-use acceptance.",
            polarity: "positive",
          },
          {
            slot_key: "SLOT_TARIFF_02",
            question_key: "Q_TARIFF_02",
            facet: "dynamic",
            intent: "Dynamic price acceptance.",
            polarity: "positive",
          },
        ],
      },
      {
        concept_key: "flexibility_willingness",
        evidence_source: "survey_questions",
        measurement_type: "single_item_direct",
        output_type: "number",
        aggregation_rule: "identity",
        threshold_profile: "likert_1_5_low_mid_high",
        minimum_answer_count: 1,
        question_keys: ["Q_FLEX_01"],
        required_question_keys: ["Q_FLEX_01"],
        question_intents: [
          {
            slot_key: "SLOT_FLEX_01",
            question_key: "Q_FLEX_01",
            facet: "ev_delay",
            intent: "Willingness to delay EV charging.",
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
      question_key: "Q_TARIFF_01",
      ontology_target: "flexpulse_behavioural_schema.tariff_preference_orientation",
      expected_type: "number",
      required_for_mapping: true,
      transform_strategy: { kind: "numeric_range", min: 1, max: 5 },
    },
    {
      question_key: "Q_TARIFF_02",
      ontology_target: "flexpulse_behavioural_schema.tariff_preference_orientation",
      expected_type: "number",
      required_for_mapping: true,
      transform_strategy: { kind: "numeric_range", min: 1, max: 5 },
    },
    {
      question_key: "Q_FLEX_01",
      ontology_target: "flexpulse_behavioural_schema.flexibility_willingness",
      expected_type: "number",
      required_for_mapping: false,
      transform_strategy: { kind: "numeric_range", min: 1, max: 5 },
    },
    {
      question_key: "Q_DER_01",
      ontology_target: "flexpulse_behavioural_schema.owned_der_assets",
      expected_type: "string[]",
      required_for_mapping: true,
      transform_strategy: {
        kind: "enum_lookup",
        option_to_value: { ev: "ev", heat_pump: "heat_pump" },
      },
    },
  ];

  return {
    id: "survey-health",
    name: "Health survey",
    status: "published",
    created_by: "owner-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    published_at: "2026-01-01T00:00:00.000Z",
    default_language: "English",
    supported_languages: ["English", "Spanish"],
    definition_json: definition,
    mapping_contract_json: mappingContract,
    mapping_compiled_json: compileMappingContract(mappingContract),
    mapping_hash: CURRENT_MAPPING,
    measurement_hash: CURRENT_HASH,
  };
}

function mappedResponse(
  survey: PersistedSurvey,
  answers: Record<string, SubmittedSurveyAnswer>,
  extra: Partial<InstrumentHealthLoadedResponse> = {},
): InstrumentHealthLoadedResponse {
  const persistedOutput = mapSurveyResponseToOutput({
    survey,
    answers,
    submittedLanguage: extra.submittedLanguage ?? "English",
    countryCodeRaw: null,
    mappingHashAtSubmission: extra.mappingHashAtSubmission ?? CURRENT_MAPPING,
    measurementHashAtSubmission: extra.measurementHashAtSubmission ?? CURRENT_HASH,
    enrichment: null,
  });

  return {
    pipelineStatus: extra.pipelineStatus ?? "ready",
    submittedLanguage: extra.submittedLanguage ?? "English",
    measurementHashAtSubmission: extra.measurementHashAtSubmission ?? CURRENT_HASH,
    mappingHashAtSubmission: extra.mappingHashAtSubmission ?? CURRENT_MAPPING,
    answers,
    persistedOutput,
  };
}

function buildSource(
  survey: PersistedSurvey,
  responses: InstrumentHealthLoadedResponse[],
  feedback: InstrumentHealthSource["feedback"] = [],
): InstrumentHealthSource {
  return { survey, responses, feedback };
}

function asFiniteNumberSafe(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

describe("instrument health roles", () => {
  it("never infers reflective for unknown concepts", () => {
    expect(getInstrumentMeasurementRole("manual_override_need")).toBe("descriptive_composite");
    expect(getInstrumentMeasurementRole("tariff_preference_orientation")).toBe("descriptive_composite");
    expect(getInstrumentMeasurementRole("declared_flexibility_capability")).toBe("conditional_module");
    expect(getInstrumentMeasurementRole("owned_der_assets")).toBe("not_applicable");
  });
});

describe("buildInstrumentHealthData", () => {
  it("reproduces mapper scores, reverses negative polarity in memory, and keeps raw item bars", () => {
    const survey = buildSurvey();
    const alignedHigh = mappedResponse(survey, {
      Q_TRUST_01: 5,
      Q_TRUST_02: 1,
      Q_TARIFF_01: 4,
      Q_TARIFF_02: 4,
      Q_DER_01: ["ev"],
      Q_FLEX_01: 5,
    });
    const alignedLow = mappedResponse(survey, {
      Q_TRUST_01: 1,
      Q_TRUST_02: 5,
      Q_TARIFF_01: 2,
      Q_TARIFF_02: 2,
      Q_DER_01: ["heat_pump"],
    });

    const data = buildInstrumentHealthData(buildSource(survey, [alignedHigh, alignedLow]));
    const trust = data.scopes.overall.constructs.find((construct) => construct.conceptKey === "trust_in_automation");
    const reversed = trust?.items.find((item) => item.questionKey === "Q_TRUST_02");

    expect(data.integrity.scoringMismatchN).toBe(0);
    expect(data.integrity.status).toBe("consistent");
    expect(trust?.reliability.alpha).toBeCloseTo(1);
    expect(reversed?.reverseScored).toBe(true);
    expect(reversed?.descriptives.mean).toBe(3);
    expect(reversed?.likertBins?.find((bin) => bin.value === 5)?.count).toBe(1);
  });

  it("treats a correct null score as not a mismatch and flags out-of-range answers", () => {
    const survey = buildSurvey();
    const notApplicable = mappedResponse(survey, {
      Q_TRUST_01: 4,
      Q_TRUST_02: 2,
      Q_TARIFF_01: 3,
      Q_TARIFF_02: 3,
      Q_DER_01: ["heat_pump"],
    });
    const outOfRange = mappedResponse(survey, {
      Q_TRUST_01: 4,
      Q_TRUST_02: 2,
      Q_TARIFF_01: 3,
      Q_TARIFF_02: 3,
      Q_DER_01: ["ev"],
      Q_FLEX_01: 9,
    });

    const data = buildInstrumentHealthData(buildSource(survey, [notApplicable, outOfRange]));
    const willingness = data.scopes.overall.constructs.find(
      (construct) => construct.conceptKey === "flexibility_willingness",
    );

    expect(asFiniteNumberSafe(notApplicable.persistedOutput?.profile.flexibility_willingness?.value)).toBeNull();
    expect(data.integrity.invalidNumericAnswerN).toBe(1);
    expect(data.integrity.status).toBe("review_required");
    expect(data.integrity.scoringMismatchN).toBe(0);
    expect(willingness?.items[0]?.eligibleN).toBe(1);
  });

  it("excludes other measurement hashes from the analysed sample", () => {
    const survey = buildSurvey();
    const current = mappedResponse(survey, {
      Q_TRUST_01: 4,
      Q_TRUST_02: 2,
      Q_TARIFF_01: 3,
      Q_TARIFF_02: 3,
      Q_DER_01: ["ev"],
      Q_FLEX_01: 4,
    });
    const stale: InstrumentHealthLoadedResponse = {
      ...mappedResponse(survey, {
        Q_TRUST_01: 1,
        Q_TRUST_02: 1,
        Q_TARIFF_01: 1,
        Q_TARIFF_02: 1,
        Q_DER_01: ["ev"],
        Q_FLEX_01: 1,
      }),
      measurementHashAtSubmission: "old-hash",
      answers: null,
    };

    const data = buildInstrumentHealthData(buildSource(survey, [current, stale]));
    expect(data.context.collectedN).toBe(2);
    expect(data.context.includedN).toBe(1);
    expect(data.context.excludedDifferentHashN).toBe(1);
    expect(data.scopes.overall.n).toBe(1);
  });

  it("uses visibility-rule eligible n rather than the full sample", () => {
    const survey = buildSurvey();
    const withEv = mappedResponse(survey, {
      Q_TRUST_01: 4,
      Q_TRUST_02: 2,
      Q_TARIFF_01: 3,
      Q_TARIFF_02: 3,
      Q_DER_01: ["ev"],
      Q_FLEX_01: 5,
    });
    const withoutEv = mappedResponse(survey, {
      Q_TRUST_01: 4,
      Q_TRUST_02: 2,
      Q_TARIFF_01: 3,
      Q_TARIFF_02: 3,
      Q_DER_01: ["heat_pump"],
    });

    const data = buildInstrumentHealthData(buildSource(survey, [withEv, withoutEv]));
    const willingness = data.scopes.overall.constructs.find(
      (construct) => construct.conceptKey === "flexibility_willingness",
    );
    const item = willingness?.items[0];

    expect(item?.eligibleN).toBe(1);
    expect(item?.answeredN).toBe(1);
    expect(willingness?.reliability.reason).toContain("single item");
  });

  it("does not treat tariff alpha as a pass/fail reflective criterion", () => {
    const survey = buildSurvey();
    const data = buildInstrumentHealthData(
      buildSource(survey, [
        mappedResponse(survey, {
          Q_TRUST_01: 5,
          Q_TRUST_02: 1,
          Q_TARIFF_01: 5,
          Q_TARIFF_02: 5,
          Q_DER_01: ["ev"],
          Q_FLEX_01: 4,
        }),
        mappedResponse(survey, {
          Q_TRUST_01: 1,
          Q_TRUST_02: 5,
          Q_TARIFF_01: 1,
          Q_TARIFF_02: 1,
          Q_DER_01: ["ev"],
          Q_FLEX_01: 2,
        }),
      ]),
    );
    const tariff = data.scopes.overall.constructs.find(
      (construct) => construct.conceptKey === "tariff_preference_orientation",
    );

    expect(tariff?.role).toBe("descriptive_composite");
    expect(tariff?.reliability.interpretive).toBe(false);
    expect(tariff?.reliability.status).toBe("not_applicable");
    expect(tariff?.reliability.secondaryAlpha).not.toBeNull();
    expect(tariff?.interpretation).toBe("Descriptive profile");
  });

  it("returns language scopes without mixing hashes and keeps advanced analysis as Not run", () => {
    const survey = buildSurvey();
    const english = mappedResponse(survey, {
      Q_TRUST_01: 4,
      Q_TRUST_02: 2,
      Q_TARIFF_01: 3,
      Q_TARIFF_02: 3,
      Q_DER_01: ["ev"],
      Q_FLEX_01: 4,
    });
    const spanish = mappedResponse(
      survey,
      {
        Q_TRUST_01: 3,
        Q_TRUST_02: 3,
        Q_TARIFF_01: 2,
        Q_TARIFF_02: 2,
        Q_DER_01: ["ev"],
        Q_FLEX_01: 3,
      },
      { submittedLanguage: "Spanish" },
    );

    const data = buildInstrumentHealthData(buildSource(survey, [english, spanish]));
    expect(data.scopes["language:Spanish"]?.n).toBe(1);
    expect(data.scopes["language:English"]?.n).toBe(1);
    expect(data.advancedValidation.display).toBe("Not run");
    expect(data.multilingual.advancedModels.every((row) => row.status === "Not run")).toBe(true);
  });

  it("does not send response ids, answers, postal codes or external refs in the DTO", () => {
    const survey = buildSurvey();
    const data = buildInstrumentHealthData(
      buildSource(
        survey,
        [
          mappedResponse(survey, {
            Q_TRUST_01: 4,
            Q_TRUST_02: 2,
            Q_TARIFF_01: 3,
            Q_TARIFF_02: 3,
            Q_DER_01: ["ev"],
            Q_FLEX_01: 4,
          }),
        ],
        [
          {
            easeRating: 4,
            questionSetVersion: "v1",
            textFieldFilledCount: 2,
          },
        ],
      ),
    );

    expect(instrumentHealthJsonContainsSensitiveField(data)).toBe(false);
    expect(data.debrief?.feedbackN).toBe(1);
    expect(data.debrief?.textFieldsReceivedN).toBe(2);
    expect(JSON.stringify(data.debrief)).not.toContain("unclear");
  });

  it("marks stored mapper mismatch as an integrity failure", () => {
    const survey = buildSurvey();
    const response = mappedResponse(survey, {
      Q_TRUST_01: 4,
      Q_TRUST_02: 2,
      Q_TARIFF_01: 3,
      Q_TARIFF_02: 3,
      Q_DER_01: ["ev"],
      Q_FLEX_01: 4,
    });
    response.persistedOutput = {
      ...response.persistedOutput!,
      profile: {
        ...response.persistedOutput!.profile,
        trust_in_automation: { value: 1.11 },
      },
    };

    const data = buildInstrumentHealthData(buildSource(survey, [response]));
    expect(data.integrity.scoringMismatchN).toBe(1);
    expect(data.integrity.status).toBe("review_required");
  });
});

describe("analytics v2 instrument health tab", () => {
  it("uses Instrument Health as the last tab label", () => {
    expect(ANALYTICS_V2_TABS.at(-1)?.label).toBe("Instrument Health");
    expect(ANALYTICS_V2_TABS.at(-1)?.key).toBe("diagnostics");
  });
});
