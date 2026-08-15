import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ANALYTICS_V2_TABS,
} from "@/features/surveys/analytics/analytics-v2-tabs";
import {
  associationConstructs,
  buildInstrumentHealthData,
  buildInstrumentHealthExport,
  groupInstrumentHealthConstructs,
  instrumentHealthJsonContainsSensitiveField,
  type InstrumentHealthLoadedResponse,
  type InstrumentHealthSource,
} from "@/features/surveys/analytics/instrument-health";
import {
  INSTRUMENT_HEALTH_ANALYSIS_VERSION,
  INSTRUMENT_HEALTH_METHODOLOGY_VERSION,
  automatedSignalsActive,
  getInstrumentMeasurementRole,
  getSampleAdequacy,
  getSampleAdequacyLabel,
} from "@/features/surveys/analytics/instrument-health-semantics";
import { getDeclaredFlexibilityCapabilityAnalysisCatalog } from "@/features/surveys/declared-flexibility-capability-module";
import {
  createInitialMappingContract,
  createInitialSurveyDefinition,
  type PersistedSurvey,
} from "@/features/surveys/generator-types";
import { compileMappingContract, computeMappingHash, computeMeasurementHash } from "@/features/surveys/generator-mapping";
import { mapSurveyResponseToOutput } from "@/features/surveys/response-mapper";
import type { SubmittedSurveyAnswer } from "@/features/surveys/response-validation";
import { appRoutes } from "@/lib/config/routes";

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
  it("resolves measurement roles from the behavioural schema", () => {
    expect(getInstrumentMeasurementRole("manual_override_need")).toBe("descriptive_composite");
    expect(getInstrumentMeasurementRole("tariff_preference_orientation")).toBe("descriptive_composite");
    expect(getInstrumentMeasurementRole("declared_flexibility_capability")).toBe("conditional_module");
    expect(getInstrumentMeasurementRole("owned_der_assets")).toBe("not_applicable");
    expect(getInstrumentMeasurementRole("unknown_concept")).toBe("not_applicable");
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
    expect(tariff?.reliability.alpha).toBeNull();
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
    expect(data.multilingual.languageCount).toBe(2);
    expect(data.multilingual).not.toHaveProperty("advancedModels");
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
    expect(data.debrief?.currentlyEnabled).toBeNull();
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

  it("passes the current collected n into Instrument Health for cache freshness", () => {
    const workbench = readFileSync(
      path.join(process.cwd(), "src/app/(app)/surveys/[surveyId]/analytics-v2/analytics-v2-workbench.tsx"),
      "utf8",
    );
    expect(workbench).toContain("currentCollectedN={overviewData.context.collectedResponseCount}");
  });

  it("keeps DFC selectors in a horizontal row below the section title", () => {
    const overview = readFileSync(
      path.join(process.cwd(), "src/app/(app)/surveys/[surveyId]/analytics-v2/overview-panel.tsx"),
      "utf8",
    );
    const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    const titleIndex = overview.indexOf("{opportunity.title}");
    const selectorIndex = overview.indexOf('className="analytics-v2-dfc-selector"');
    const headerClose = overview.indexOf("</header>", titleIndex);

    expect(titleIndex).toBeGreaterThan(-1);
    expect(selectorIndex).toBeGreaterThan(headerClose);
    expect(css).toContain(".analytics-v2-dfc-selector {\n  display: flex;\n  flex-direction: row;");
    expect(css).toContain(".analytics-v2-panel__head h3");
    expect(css).toContain("font-size: 1.2rem");
  });
});

function likertQuestion(questionKey: string, order: number) {
  return {
    question_key: questionKey,
    type: "rating_scale" as const,
    required: true,
    order,
    scale: { min: 1, max: 5 },
  };
}

function likertIntent(
  questionKey: string,
  conceptSuffix: string,
  facet: string,
  polarity: "positive" | "negative" = "positive",
) {
  return {
    slot_key: `SLOT_${conceptSuffix}`,
    question_key: questionKey,
    facet,
    intent: facet,
    polarity,
  };
}

function numericMapping(questionKey: string, ontologyTarget: string) {
  return {
    question_key: questionKey,
    ontology_target: ontologyTarget,
    expected_type: "number" as const,
    required_for_mapping: true,
    transform_strategy: { kind: "numeric_range" as const, min: 1, max: 5 },
  };
}

function buildModulatorSurvey(): PersistedSurvey {
  const definition = createInitialSurveyDefinition("English", ["English"]);
  definition.questions = [
    likertQuestion("Q_SAVE_01", 1),
    likertQuestion("Q_SAVE_02", 2),
    likertQuestion("Q_OVERRIDE_01", 3),
  ];
  definition.translations.English.questions = {
    Q_SAVE_01: { title: "Saving money matters." },
    Q_SAVE_02: { title: "I would change habits for a lower bill." },
    Q_OVERRIDE_01: { title: "I need to be able to stop automation." },
  };
  definition.survey_meta.measurement_plan_json = {
    schema_version: 1,
    schema_namespace: "flexpulse_behavioural_schema",
    concepts: [
      {
        concept_key: "savings_motivation",
        evidence_source: "survey_questions",
        measurement_type: "multi_item_likert_mean",
        output_type: "number",
        aggregation_rule: "mean",
        threshold_profile: "likert_1_5_low_mid_high",
        minimum_answer_count: 2,
        question_keys: ["Q_SAVE_01", "Q_SAVE_02"],
        required_question_keys: ["Q_SAVE_01", "Q_SAVE_02"],
        question_intents: [
          likertIntent("Q_SAVE_01", "SAVE_01", "financial_salience"),
          likertIntent("Q_SAVE_02", "SAVE_02", "reward_responsiveness"),
        ],
      },
      {
        concept_key: "manual_override_need",
        evidence_source: "survey_questions",
        measurement_type: "single_item_direct",
        output_type: "number",
        aggregation_rule: "identity",
        threshold_profile: "likert_1_5_low_mid_high",
        minimum_answer_count: 1,
        question_keys: ["Q_OVERRIDE_01"],
        required_question_keys: ["Q_OVERRIDE_01"],
        question_intents: [likertIntent("Q_OVERRIDE_01", "OVERRIDE_01", "immediate_intervention_need")],
      },
    ],
  };
  const mappingContract = createInitialMappingContract();
  mappingContract.mappings = [
    numericMapping("Q_SAVE_01", "flexpulse_behavioural_schema.savings_motivation"),
    numericMapping("Q_SAVE_02", "flexpulse_behavioural_schema.savings_motivation"),
    numericMapping("Q_OVERRIDE_01", "flexpulse_behavioural_schema.manual_override_need"),
  ];
  return {
    id: "survey-modulators",
    name: "Modulator survey",
    status: "published",
    created_by: "owner-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    published_at: "2026-01-01T00:00:00.000Z",
    default_language: "English",
    supported_languages: ["English"],
    definition_json: definition,
    mapping_contract_json: mappingContract,
    mapping_compiled_json: compileMappingContract(mappingContract),
    mapping_hash: CURRENT_MAPPING,
    measurement_hash: CURRENT_HASH,
  };
}

function buildSingleModulatorSurvey(): PersistedSurvey {
  const definition = createInitialSurveyDefinition("English", ["English"]);
  definition.questions = [likertQuestion("Q_OVERRIDE_01", 1)];
  definition.translations.English.questions = {
    Q_OVERRIDE_01: { title: "I need to be able to stop automation." },
  };
  definition.survey_meta.measurement_plan_json = {
    schema_version: 1,
    schema_namespace: "flexpulse_behavioural_schema",
    concepts: [
      {
        concept_key: "manual_override_need",
        evidence_source: "survey_questions",
        measurement_type: "single_item_direct",
        output_type: "number",
        aggregation_rule: "identity",
        threshold_profile: "likert_1_5_low_mid_high",
        minimum_answer_count: 1,
        question_keys: ["Q_OVERRIDE_01"],
        required_question_keys: ["Q_OVERRIDE_01"],
        question_intents: [likertIntent("Q_OVERRIDE_01", "OVERRIDE_01", "immediate_intervention_need")],
      },
    ],
  };
  const mappingContract = createInitialMappingContract();
  mappingContract.mappings = [
    numericMapping("Q_OVERRIDE_01", "flexpulse_behavioural_schema.manual_override_need"),
  ];
  return {
    id: "survey-single-modulator",
    name: "Single modulator",
    status: "published",
    created_by: "owner-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    published_at: "2026-01-01T00:00:00.000Z",
    default_language: "English",
    supported_languages: ["English"],
    definition_json: definition,
    mapping_contract_json: mappingContract,
    mapping_compiled_json: compileMappingContract(mappingContract),
    mapping_hash: CURRENT_MAPPING,
    measurement_hash: CURRENT_HASH,
  };
}

function buildAxisWithModulatorsSurvey(): PersistedSurvey {
  const definition = createInitialSurveyDefinition("English", ["English", "Spanish"]);
  definition.questions = [
    likertQuestion("Q_TRUST_01", 1),
    likertQuestion("Q_TRUST_02", 2),
    likertQuestion("Q_SAVE_01", 3),
    likertQuestion("Q_SAVE_02", 4),
    { ...likertQuestion("Q_OVERRIDE_01", 5), required: false },
    likertQuestion("Q_EVENT_01", 6),
  ];
  definition.translations.English.questions = {
    Q_TRUST_01: { title: "I trust automation." },
    Q_TRUST_02: { title: "I dislike automation acting alone." },
    Q_SAVE_01: { title: "Saving money matters." },
    Q_SAVE_02: { title: "A lower bill is not a reason to change habits." },
    Q_OVERRIDE_01: { title: "I need to be able to stop automation." },
    Q_EVENT_01: { title: "Repeated events remain acceptable." },
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
          likertIntent("Q_TRUST_01", "TRUST_01", "reliability"),
          likertIntent("Q_TRUST_02", "TRUST_02", "autonomy_discomfort", "negative"),
        ],
      },
      {
        concept_key: "savings_motivation",
        evidence_source: "survey_questions",
        measurement_type: "multi_item_likert_mean",
        output_type: "number",
        aggregation_rule: "mean",
        threshold_profile: "likert_1_5_low_mid_high",
        minimum_answer_count: 2,
        question_keys: ["Q_SAVE_01", "Q_SAVE_02"],
        required_question_keys: ["Q_SAVE_01", "Q_SAVE_02"],
        question_intents: [
          likertIntent("Q_SAVE_01", "SAVE_01", "financial_salience"),
          likertIntent("Q_SAVE_02", "SAVE_02", "reward_responsiveness", "negative"),
        ],
      },
      {
        concept_key: "manual_override_need",
        evidence_source: "survey_questions",
        measurement_type: "single_item_direct",
        output_type: "number",
        aggregation_rule: "identity",
        threshold_profile: "likert_1_5_low_mid_high",
        minimum_answer_count: 1,
        question_keys: ["Q_OVERRIDE_01"],
        required_question_keys: ["Q_OVERRIDE_01"],
        question_intents: [likertIntent("Q_OVERRIDE_01", "OVERRIDE_01", "immediate_intervention_need")],
      },
      {
        concept_key: "event_frequency_tolerance",
        evidence_source: "survey_questions",
        measurement_type: "single_item_direct",
        output_type: "number",
        aggregation_rule: "identity",
        threshold_profile: "likert_1_5_low_mid_high",
        minimum_answer_count: 1,
        question_keys: ["Q_EVENT_01"],
        required_question_keys: ["Q_EVENT_01"],
        question_intents: [likertIntent("Q_EVENT_01", "EVENT_01", "repeat_acceptability")],
      },
    ],
  };
  const mappingContract = createInitialMappingContract();
  mappingContract.mappings = [
    numericMapping("Q_TRUST_01", "flexpulse_behavioural_schema.trust_in_automation"),
    numericMapping("Q_TRUST_02", "flexpulse_behavioural_schema.trust_in_automation"),
    numericMapping("Q_SAVE_01", "flexpulse_behavioural_schema.savings_motivation"),
    numericMapping("Q_SAVE_02", "flexpulse_behavioural_schema.savings_motivation"),
    { ...numericMapping("Q_OVERRIDE_01", "flexpulse_behavioural_schema.manual_override_need"), required_for_mapping: false },
    numericMapping("Q_EVENT_01", "flexpulse_behavioural_schema.event_frequency_tolerance"),
  ];
  return {
    id: "survey-axes-modulators",
    name: "Axes with modulators",
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

function buildReflectivePairSurvey(): PersistedSurvey {
  const definition = createInitialSurveyDefinition("English", ["English"]);
  definition.questions = [
    likertQuestion("Q_TRUST_01", 1),
    likertQuestion("Q_TRUST_02", 2),
    likertQuestion("Q_AWARE_01", 3),
    likertQuestion("Q_AWARE_02", 4),
    likertQuestion("Q_AWARE_03", 5),
  ];
  definition.translations.English.questions = {
    Q_TRUST_01: { title: "I trust automation." },
    Q_TRUST_02: { title: "I dislike automation acting alone." },
    Q_AWARE_01: { title: "I recognise time-varying prices." },
    Q_AWARE_02: { title: "I recognise shiftable loads." },
    Q_AWARE_03: { title: "I recognise automation limits." },
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
          likertIntent("Q_TRUST_01", "TRUST_01", "reliability"),
          likertIntent("Q_TRUST_02", "TRUST_02", "autonomy_discomfort", "negative"),
        ],
      },
      {
        concept_key: "awareness_of_energy_systems",
        evidence_source: "survey_questions",
        measurement_type: "multi_item_likert_mean",
        output_type: "number",
        aggregation_rule: "mean",
        threshold_profile: "likert_1_5_low_mid_high",
        minimum_answer_count: 2,
        question_keys: ["Q_AWARE_01", "Q_AWARE_02", "Q_AWARE_03"],
        required_question_keys: ["Q_AWARE_01", "Q_AWARE_02", "Q_AWARE_03"],
        question_intents: [
          likertIntent("Q_AWARE_01", "AWARE_01", "price_recognition"),
          likertIntent("Q_AWARE_02", "AWARE_02", "load_recognition"),
          likertIntent("Q_AWARE_03", "AWARE_03", "automation_scope"),
        ],
      },
    ],
  };
  const mappingContract = createInitialMappingContract();
  mappingContract.mappings = [
    numericMapping("Q_TRUST_01", "flexpulse_behavioural_schema.trust_in_automation"),
    numericMapping("Q_TRUST_02", "flexpulse_behavioural_schema.trust_in_automation"),
    numericMapping("Q_AWARE_01", "flexpulse_behavioural_schema.awareness_of_energy_systems"),
    numericMapping("Q_AWARE_02", "flexpulse_behavioural_schema.awareness_of_energy_systems"),
    numericMapping("Q_AWARE_03", "flexpulse_behavioural_schema.awareness_of_energy_systems"),
  ];
  return {
    id: "survey-reflective-pair",
    name: "Reflective pair",
    status: "published",
    created_by: "owner-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    published_at: "2026-01-01T00:00:00.000Z",
    default_language: "English",
    supported_languages: ["English"],
    definition_json: definition,
    mapping_contract_json: mappingContract,
    mapping_compiled_json: compileMappingContract(mappingContract),
    mapping_hash: CURRENT_MAPPING,
    measurement_hash: CURRENT_HASH,
  };
}

function buildDfcSurvey(): PersistedSurvey {
  const definition = createInitialSurveyDefinition("English", ["English"]);
  definition.questions = [
    {
      question_key: "Q_OWNED_DER_ASSETS_01",
      type: "multiple_choice",
      required: true,
      order: 1,
      options: [
        { option_key: "ev", value: "ev" },
        { option_key: "battery_storage", value: "battery_storage" },
      ],
    },
    {
      ...likertQuestion("Q_DFC_EV_CHARGING_OPERATIONAL_CONTROL", 2),
      visibility_rule: {
        source_question_key: "Q_OWNED_DER_ASSETS_01",
        operator: "contains_any",
        values: ["ev"],
      },
    },
    {
      ...likertQuestion("Q_DFC_EV_CHARGING_TEMPORAL_SLACK", 3),
      visibility_rule: {
        source_question_key: "Q_OWNED_DER_ASSETS_01",
        operator: "contains_any",
        values: ["ev"],
      },
    },
    {
      ...likertQuestion("Q_DFC_EV_CHARGING_SERVICE_PRESERVATION", 4),
      visibility_rule: {
        source_question_key: "Q_OWNED_DER_ASSETS_01",
        operator: "contains_any",
        values: ["ev"],
      },
    },
    {
      ...likertQuestion("Q_DFC_EV_CHARGING_HOUSEHOLD_COORDINATION", 5),
      visibility_rule: {
        source_question_key: "Q_OWNED_DER_ASSETS_01",
        operator: "contains_any",
        values: ["ev"],
      },
    },
  ];
  definition.translations.English.questions = {
    Q_OWNED_DER_ASSETS_01: { title: "Which assets do you have?" },
    Q_DFC_EV_CHARGING_OPERATIONAL_CONTROL: { title: "EV control" },
    Q_DFC_EV_CHARGING_TEMPORAL_SLACK: { title: "EV timing" },
    Q_DFC_EV_CHARGING_SERVICE_PRESERVATION: { title: "EV service" },
    Q_DFC_EV_CHARGING_HOUSEHOLD_COORDINATION: { title: "EV coordination" },
  };
  definition.survey_meta.measurement_plan_json = {
    schema_version: 1,
    schema_namespace: "flexpulse_behavioural_schema",
    concepts: [
      {
        concept_key: "owned_der_assets",
        evidence_source: "survey_questions",
        measurement_type: "multi_choice_tag_set",
        output_type: "string[]",
        aggregation_rule: "set_union",
        threshold_profile: "asset_inventory",
        minimum_answer_count: 1,
        question_keys: ["Q_OWNED_DER_ASSETS_01"],
        required_question_keys: ["Q_OWNED_DER_ASSETS_01"],
        question_intents: [],
      },
      {
        concept_key: "declared_flexibility_capability",
        evidence_source: "survey_questions",
        measurement_type: "multi_item_likert_mean",
        output_type: "number",
        aggregation_rule: "mean",
        threshold_profile: "likert_1_5_low_mid_high",
        minimum_answer_count: 4,
        question_keys: [
          "Q_DFC_EV_CHARGING_OPERATIONAL_CONTROL",
          "Q_DFC_EV_CHARGING_TEMPORAL_SLACK",
          "Q_DFC_EV_CHARGING_SERVICE_PRESERVATION",
          "Q_DFC_EV_CHARGING_HOUSEHOLD_COORDINATION",
        ],
        required_question_keys: [
          "Q_DFC_EV_CHARGING_OPERATIONAL_CONTROL",
          "Q_DFC_EV_CHARGING_TEMPORAL_SLACK",
          "Q_DFC_EV_CHARGING_SERVICE_PRESERVATION",
          "Q_DFC_EV_CHARGING_HOUSEHOLD_COORDINATION",
        ],
        question_intents: [
          { ...likertIntent("Q_DFC_EV_CHARGING_OPERATIONAL_CONTROL", "DFC_EV_OC", "ev_charging"), slot_key: "SLOT_DFC_EV_CHARGING_OPERATIONAL_CONTROL" },
          { ...likertIntent("Q_DFC_EV_CHARGING_TEMPORAL_SLACK", "DFC_EV_TS", "ev_charging"), slot_key: "SLOT_DFC_EV_CHARGING_TEMPORAL_SLACK" },
          { ...likertIntent("Q_DFC_EV_CHARGING_SERVICE_PRESERVATION", "DFC_EV_SP", "ev_charging"), slot_key: "SLOT_DFC_EV_CHARGING_SERVICE_PRESERVATION" },
          { ...likertIntent("Q_DFC_EV_CHARGING_HOUSEHOLD_COORDINATION", "DFC_EV_HC", "ev_charging"), slot_key: "SLOT_DFC_EV_CHARGING_HOUSEHOLD_COORDINATION" },
        ],
      },
    ],
  };
  const mappingContract = createInitialMappingContract();
  mappingContract.mappings = [
    {
      question_key: "Q_OWNED_DER_ASSETS_01",
      ontology_target: "flexpulse_behavioural_schema.owned_der_assets",
      expected_type: "string[]",
      required_for_mapping: true,
      transform_strategy: {
        kind: "enum_lookup",
        option_to_value: { ev: "ev", battery_storage: "battery_storage" },
      },
    },
    numericMapping("Q_DFC_EV_CHARGING_OPERATIONAL_CONTROL", "flexpulse_behavioural_schema.declared_flexibility_capability"),
    numericMapping("Q_DFC_EV_CHARGING_TEMPORAL_SLACK", "flexpulse_behavioural_schema.declared_flexibility_capability"),
    numericMapping("Q_DFC_EV_CHARGING_SERVICE_PRESERVATION", "flexpulse_behavioural_schema.declared_flexibility_capability"),
    numericMapping("Q_DFC_EV_CHARGING_HOUSEHOLD_COORDINATION", "flexpulse_behavioural_schema.declared_flexibility_capability"),
  ];
  return {
    id: "survey-dfc",
    name: "DFC survey",
    status: "published",
    created_by: "owner-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    published_at: "2026-01-01T00:00:00.000Z",
    default_language: "English",
    supported_languages: ["English"],
    definition_json: definition,
    mapping_contract_json: mappingContract,
    mapping_compiled_json: compileMappingContract(mappingContract),
    mapping_hash: CURRENT_MAPPING,
    measurement_hash: CURRENT_HASH,
  };
}

function buildTrustAndDfcSurvey(): PersistedSurvey {
  const survey = buildDfcSurvey();
  const definition = survey.definition_json;
  definition.questions.unshift(likertQuestion("Q_TRUST_01", 0), likertQuestion("Q_TRUST_02", 0));
  definition.translations.English.questions = {
    ...definition.translations.English.questions,
    Q_TRUST_01: { title: "I trust automation." },
    Q_TRUST_02: { title: "I dislike automation acting alone." },
  };
  definition.survey_meta.measurement_plan_json?.concepts.unshift({
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
      likertIntent("Q_TRUST_01", "TRUST_01", "reliability"),
      likertIntent("Q_TRUST_02", "TRUST_02", "autonomy_discomfort", "negative"),
    ],
  });
  survey.mapping_contract_json.mappings.unshift(
    numericMapping("Q_TRUST_01", "flexpulse_behavioural_schema.trust_in_automation"),
    numericMapping("Q_TRUST_02", "flexpulse_behavioural_schema.trust_in_automation"),
  );
  survey.mapping_compiled_json = compileMappingContract(survey.mapping_contract_json);
  survey.id = "survey-trust-dfc";
  survey.name = "Trust and DFC";
  return survey;
}

describe("instrument health schema-driven analysis", () => {
  it("keeps Energy Flexibility numeric calculations for trust and tariff", () => {
    const survey = buildSurvey();
    const data = buildInstrumentHealthData(
      buildSource(survey, [
        mappedResponse(survey, {
          Q_TRUST_01: 5,
          Q_TRUST_02: 1,
          Q_TARIFF_01: 4,
          Q_TARIFF_02: 4,
          Q_DER_01: ["ev"],
          Q_FLEX_01: 5,
        }),
        mappedResponse(survey, {
          Q_TRUST_01: 1,
          Q_TRUST_02: 5,
          Q_TARIFF_01: 2,
          Q_TARIFF_02: 2,
          Q_DER_01: ["heat_pump"],
        }),
      ]),
    );
    const trust = data.scopes.overall.constructs.find((construct) => construct.conceptKey === "trust_in_automation");
    const tariff = data.scopes.overall.constructs.find(
      (construct) => construct.conceptKey === "tariff_preference_orientation",
    );

    expect(trust?.reliability.alpha).toBeCloseTo(1);
    expect(trust?.items.find((item) => item.questionKey === "Q_TRUST_02")?.descriptives.mean).toBe(3);
    expect(tariff?.scoreDescriptives.mean).toBe(3);
    expect(data.integrity.scoringMismatchN).toBe(0);
  });

  it("analyses a second survey whose concepts are not Energy Flexibility axes", () => {
    const survey = buildModulatorSurvey();
    const data = buildInstrumentHealthData(
      buildSource(survey, [
        mappedResponse(survey, { Q_SAVE_01: 5, Q_SAVE_02: 4, Q_OVERRIDE_01: 5 }),
        mappedResponse(survey, { Q_SAVE_01: 2, Q_SAVE_02: 1, Q_OVERRIDE_01: 3 }),
      ]),
    );
    const savings = data.scopes.overall.constructs.find((construct) => construct.conceptKey === "savings_motivation");
    const override = data.scopes.overall.constructs.find((construct) => construct.conceptKey === "manual_override_need");

    expect(savings?.role).toBe("descriptive_composite");
    expect(override?.role).toBe("descriptive_composite");
    expect(savings?.conceptRole).toBe("behavioural_modulator");
    expect(override?.conceptRole).toBe("behavioural_modulator");
    expect(savings?.reliability.alpha).toBeNull();
    expect(override?.reliability.alpha).toBeNull();
    expect(savings?.reliability.itemTotalRange).toBeNull();
    expect(override?.itemCount).toBe(1);
    expect(data.scopes.overall.htmt).toEqual([]);
    expect(groupInstrumentHealthConstructs(data.scopes.overall.constructs).map((group) => group.key)).toEqual([
      "behavioural_modulator",
    ]);
  });

  it("computes reflective statistics without listing the concept in the dashboard", () => {
    const survey = buildReflectivePairSurvey();
    const data = buildInstrumentHealthData(
      buildSource(survey, [
        mappedResponse(survey, { Q_TRUST_01: 5, Q_TRUST_02: 1, Q_AWARE_01: 5, Q_AWARE_02: 4, Q_AWARE_03: 4 }),
        mappedResponse(survey, { Q_TRUST_01: 1, Q_TRUST_02: 5, Q_AWARE_01: 2, Q_AWARE_02: 1, Q_AWARE_03: 2 }),
        mappedResponse(survey, { Q_TRUST_01: 4, Q_TRUST_02: 2, Q_AWARE_01: 4, Q_AWARE_02: 4, Q_AWARE_03: 5 }),
      ]),
    );
    const awareness = data.scopes.overall.constructs.find(
      (construct) => construct.conceptKey === "awareness_of_energy_systems",
    );

    expect(awareness?.role).toBe("reflective_candidate");
    expect(awareness?.reliability.alpha).not.toBeNull();
    expect(awareness?.reliability.alphaCi95).not.toBeNull();
    expect(awareness?.reliability.itemTotalRange).not.toBeNull();
    expect(awareness?.items.every((item) => item.correctedItemTotal != null)).toBe(true);
    expect(awareness?.items.every((item) => item.alphaIfDeleted != null)).toBe(true);
    expect(data.scopes.overall.htmt.length).toBe(1);
    expect(data.scopes.overall.htmt[0]?.reference).toBe(0.85);
    expect(data.scopes.overall.htmt[0]?.n).toBe(3);
    expect(data.scopes.overall.htmt[0]?.value).not.toBeNull();
    expect(data.scopes.overall.htmt[0]?.overlapFlag).toBe(false);
    expect(data.scopes.overall.htmt[0]?.sampleAdequacy).toBe("descriptive_only");
    expect(data.scopes.overall.htmt[0]?.sampleAdequacyLabel).toBe(
      "Small applicable sample — descriptive only",
    );

    const panel = readFileSync(
      path.join(process.cwd(), "src/app/(app)/surveys/[surveyId]/analytics-v2/instrument-health-panel.tsx"),
      "utf8",
    );
    const engine = readFileSync(
      path.join(process.cwd(), "src/features/surveys/analytics/instrument-health.ts"),
      "utf8",
    );
    expect(panel).not.toMatch(/awareness_of_energy_systems/);
    expect(engine).not.toMatch(/awareness_of_energy_systems/);
  });

  it("does not treat a descriptive composite as reflective", () => {
    const survey = buildModulatorSurvey();
    const data = buildInstrumentHealthData(
      buildSource(survey, [
        mappedResponse(survey, { Q_SAVE_01: 5, Q_SAVE_02: 5, Q_OVERRIDE_01: 4 }),
        mappedResponse(survey, { Q_SAVE_01: 1, Q_SAVE_02: 2, Q_OVERRIDE_01: 2 }),
      ]),
    );
    const savings = data.scopes.overall.constructs.find((construct) => construct.conceptKey === "savings_motivation");
    expect(savings?.role).toBe("descriptive_composite");
    expect(savings?.reliability.interpretive).toBe(false);
    expect(savings?.items.every((item) => item.correctedItemTotal == null)).toBe(true);
  });

  it("does not compute alpha for a single item", () => {
    const survey = buildSurvey();
    const data = buildInstrumentHealthData(
      buildSource(survey, [
        mappedResponse(survey, {
          Q_TRUST_01: 4,
          Q_TRUST_02: 2,
          Q_TARIFF_01: 3,
          Q_TARIFF_02: 3,
          Q_DER_01: ["ev"],
          Q_FLEX_01: 4,
        }),
      ]),
    );
    const willingness = data.scopes.overall.constructs.find(
      (construct) => construct.conceptKey === "flexibility_willingness",
    );
    expect(willingness?.itemCount).toBe(1);
    expect(willingness?.reliability.alpha).toBeNull();
    expect(willingness?.reliability.reason).toContain("single item");
  });

  it("uses the canonical conditional-module catalog for applicability", () => {
    const survey = buildDfcSurvey();
    const catalog = getDeclaredFlexibilityCapabilityAnalysisCatalog();
    const withEv = mappedResponse(survey, {
      Q_OWNED_DER_ASSETS_01: ["ev"],
      Q_DFC_EV_CHARGING_OPERATIONAL_CONTROL: 4,
      Q_DFC_EV_CHARGING_TEMPORAL_SLACK: 4,
      Q_DFC_EV_CHARGING_SERVICE_PRESERVATION: 5,
      Q_DFC_EV_CHARGING_HOUSEHOLD_COORDINATION: 3,
    });
    const withoutEv = mappedResponse(survey, {
      Q_OWNED_DER_ASSETS_01: ["battery_storage"],
    });
    const data = buildInstrumentHealthData(buildSource(survey, [withEv, withoutEv]));
    const capability = data.scopes.overall.constructs.find(
      (construct) => construct.conceptKey === "declared_flexibility_capability",
    );
    const group = data.scopes.overall.conditionalModules[0];
    const ev = group?.modules.find((module) => module.setKey === "ev_charging");

    expect(capability?.role).toBe("conditional_module");
    expect(capability?.reliability.alpha).toBeNull();
    expect(group?.modules.map((module) => module.setKey)).toEqual(catalog.expectedGroups);
    expect(ev?.applicableN).toBe(1);
    expect(ev?.expectedFacets).toBe(4);
    expect(ev?.sampleAdequacy).toBe("descriptive_only");
  });

  it("keeps distribution signals separate from item coherence signals", () => {
    const survey = buildReflectivePairSurvey();
    const responses = Array.from({ length: 52 }, (_, index) =>
      mappedResponse(survey, {
        Q_TRUST_01: index < 40 ? 5 : 4,
        Q_TRUST_02: index < 40 ? 1 : 2,
        Q_AWARE_01: index < 40 ? 5 : 4,
        Q_AWARE_02: 3,
        Q_AWARE_03: index < 40 ? 5 : 4,
      }),
    );
    const data = buildInstrumentHealthData(buildSource(survey, responses));
    const awareness = data.scopes.overall.constructs.find(
      (construct) => construct.conceptKey === "awareness_of_energy_systems",
    );

    expect(awareness?.itemsWithDistributionSignals).toBeGreaterThan(0);
    expect(awareness?.itemsWithCoherenceSignals).toBeGreaterThanOrEqual(0);
    expect(awareness).not.toHaveProperty("noteCount");
    expect(awareness).not.toHaveProperty("interpretation");
    expect(awareness?.reliability.alpha).not.toBeNull();
  });

  it("uses sample cuts only to gate automated signals", () => {
    expect(getSampleAdequacy(29)).toBe("descriptive_only");
    expect(automatedSignalsActive(29)).toBe(false);
    expect(getSampleAdequacyLabel("descriptive_only")).toBe("Small applicable sample — descriptive only");
    expect(getSampleAdequacy(30)).toBe("preliminary");
    expect(getSampleAdequacy(49)).toBe("preliminary");
    expect(automatedSignalsActive(30)).toBe(true);
    expect(getSampleAdequacyLabel("preliminary")).toBe("Preliminary distribution");
    expect(getSampleAdequacy(50)).toBe("full");
    expect(automatedSignalsActive(50)).toBe(true);
    expect(getSampleAdequacyLabel("full")).toBeNull();
  });

  it("treats small applicable samples as descriptive only", () => {
    const survey = buildReflectivePairSurvey();
    const responses = Array.from({ length: 8 }, () =>
      mappedResponse(survey, {
        Q_TRUST_01: 5,
        Q_TRUST_02: 1,
        Q_AWARE_01: 5,
        Q_AWARE_02: 5,
        Q_AWARE_03: 5,
      }),
    );
    const data = buildInstrumentHealthData(buildSource(survey, responses));
    const awareness = data.scopes.overall.constructs.find(
      (construct) => construct.conceptKey === "awareness_of_energy_systems",
    );

    expect(awareness?.sampleAdequacy).toBe("descriptive_only");
    expect(awareness?.sampleAdequacyLabel).toBe("Small applicable sample — descriptive only");
    expect(awareness?.items.every((item) => item.flags.length === 0)).toBe(true);
    expect(awareness?.items[0]?.descriptives.n).toBe(8);
    expect(awareness?.items[0]?.descriptives.mean).toBe(5);
    expect(awareness?.scoreDescriptives.n).toBe(8);
  });

  it("keeps HTMT visible for n < 30 without activating an overlap signal", () => {
    const survey = buildReflectivePairSurvey();
    const responses = Array.from({ length: 8 }, (_, index) => {
      const score = (index % 5) + 1;
      return mappedResponse(survey, {
        Q_TRUST_01: score,
        Q_TRUST_02: 6 - score,
        Q_AWARE_01: score,
        Q_AWARE_02: score,
        Q_AWARE_03: score,
      });
    });
    const data = buildInstrumentHealthData(buildSource(survey, responses));
    const htmt = data.scopes.overall.htmt[0];

    expect(htmt?.n).toBe(8);
    expect(htmt?.status).toBe("computed");
    expect(htmt?.value).not.toBeNull();
    expect(htmt?.overlapFlag).toBe(false);
    expect(htmt?.sampleAdequacy).toBe("descriptive_only");
  });

  it("activates HTMT overlap signals when complete-case n is at least 50", () => {
    const survey = buildReflectivePairSurvey();
    const responses = Array.from({ length: 52 }, (_, index) => {
      const score = (index % 5) + 1;
      return mappedResponse(survey, {
        Q_TRUST_01: score,
        Q_TRUST_02: 6 - score,
        Q_AWARE_01: score,
        Q_AWARE_02: score,
        Q_AWARE_03: score,
      });
    });
    const data = buildInstrumentHealthData(buildSource(survey, responses));
    const htmt = data.scopes.overall.htmt[0];

    expect(htmt?.n).toBe(52);
    expect(htmt?.status).toBe("computed");
    expect(htmt?.value).toBeGreaterThanOrEqual(0.85);
    expect(htmt?.overlapFlag).toBe(true);
    expect(htmt?.sampleAdequacy).toBe("full");
  });

  it("includes the analysis methodology version in the cache key", () => {
    const survey = buildSurvey();
    const data = buildInstrumentHealthData(
      buildSource(survey, [
        mappedResponse(survey, {
          Q_TRUST_01: 4,
          Q_TRUST_02: 2,
          Q_TARIFF_01: 3,
          Q_TARIFF_02: 3,
          Q_DER_01: ["ev"],
          Q_FLEX_01: 4,
        }),
      ]),
    );

    expect(data.analysisVersion).toBe(INSTRUMENT_HEALTH_ANALYSIS_VERSION);
    expect(data.methodologyVersion).toBe(INSTRUMENT_HEALTH_METHODOLOGY_VERSION);
    expect(data.cacheKey).toContain(INSTRUMENT_HEALTH_ANALYSIS_VERSION);
    expect(data.cacheKey).toContain(INSTRUMENT_HEALTH_METHODOLOGY_VERSION);
  });

  it("does not decide roles by construct name in the dashboard or engine", () => {
    const panel = readFileSync(
      path.join(process.cwd(), "src/app/(app)/surveys/[surveyId]/analytics-v2/instrument-health-panel.tsx"),
      "utf8",
    );
    const engine = readFileSync(
      path.join(process.cwd(), "src/features/surveys/analytics/instrument-health.ts"),
      "utf8",
    );
    const semantics = readFileSync(
      path.join(process.cwd(), "src/features/surveys/analytics/instrument-health-semantics.ts"),
      "utf8",
    );

    expect(panel).not.toMatch(/thermal_comfort_norms/);
    expect(engine).not.toMatch(/conceptKey === "/);
    expect(semantics).not.toMatch(/REFLECTIVE_CANDIDATES/);
    expect(semantics).not.toMatch(/if \(conceptKey ===/);
  });

  it("does not change mapper output, measurement hash or mapping hash", () => {
    const survey = buildSurvey();
    const answers = {
      Q_TRUST_01: 4,
      Q_TRUST_02: 2,
      Q_TARIFF_01: 3,
      Q_TARIFF_02: 3,
      Q_DER_01: ["ev"],
      Q_FLEX_01: 4,
    } as Record<string, SubmittedSurveyAnswer>;
    const output = mapSurveyResponseToOutput({
      survey,
      answers,
      submittedLanguage: "English",
      countryCodeRaw: null,
      mappingHashAtSubmission: CURRENT_MAPPING,
      measurementHashAtSubmission: CURRENT_HASH,
      enrichment: null,
    });

    expect(output.profile.trust_in_automation?.value).toBe(4);
    expect(output.profile.tariff_preference_orientation?.value).toBe(3);
    expect(survey.definition_json.survey_meta.measurement_plan_json).not.toHaveProperty("analysis_model");
    expect(
      JSON.stringify(survey.definition_json.survey_meta.measurement_plan_json),
    ).not.toContain("analysis_model");
    expect(computeMeasurementHash(survey.definition_json.survey_meta.measurement_plan_json!)).toBe(
      computeMeasurementHash(structuredClone(survey.definition_json.survey_meta.measurement_plan_json!)),
    );
    expect(computeMappingHash(survey.mapping_contract_json)).toBe(
      computeMappingHash(structuredClone(survey.mapping_contract_json)),
    );
  });

  it("analyses an existing survey through its schema namespace and version", () => {
    const survey = buildSurvey();
    expect(survey.definition_json.survey_meta.measurement_plan_json?.schema_namespace).toBe(
      "flexpulse_behavioural_schema",
    );
    expect(survey.definition_json.survey_meta.measurement_plan_json?.schema_version).toBe(1);
    const data = buildInstrumentHealthData(
      buildSource(survey, [
        mappedResponse(survey, {
          Q_TRUST_01: 4,
          Q_TRUST_02: 2,
          Q_TARIFF_01: 3,
          Q_TARIFF_02: 3,
          Q_DER_01: ["ev"],
          Q_FLEX_01: 4,
        }),
      ]),
    );
    expect(data.scopes.overall.constructs.map((construct) => construct.conceptKey)).toEqual(
      expect.arrayContaining(["trust_in_automation", "tariff_preference_orientation", "flexibility_willingness"]),
    );
  });

  it("opens the methodology page from a new-tab link", () => {
    const panel = readFileSync(
      path.join(process.cwd(), "src/app/(app)/surveys/[surveyId]/analytics-v2/instrument-health-panel.tsx"),
      "utf8",
    );
    const page = readFileSync(
      path.join(process.cwd(), "src/app/(public)/docs/instrument-health/page.tsx"),
      "utf8",
    );

    expect(panel).toContain(`href={appRoutes.instrumentHealthMethodology}`);
    expect(panel).toContain('target="_blank"');
    expect(appRoutes.instrumentHealthMethodology).toBe("/docs/instrument-health");
    expect(page).toContain("How Instrument Health works");
    expect(page).toContain("Methodology version");
    expect(page).toContain("Sample adequacy");
    expect(page).toContain("n &lt; {policy.sampleAdequacy.descriptiveOnlyBelow}");
    expect(page).toContain("n ≥ {policy.sampleAdequacy.fullScreeningAtOrAbove}");
  });

  it("keeps respondent debrief optional", () => {
    const survey = buildSurvey();
    const withoutFeedback = buildInstrumentHealthData(
      buildSource(survey, [
        mappedResponse(survey, {
          Q_TRUST_01: 4,
          Q_TRUST_02: 2,
          Q_TARIFF_01: 3,
          Q_TARIFF_02: 3,
          Q_DER_01: ["ev"],
          Q_FLEX_01: 4,
        }),
      ]),
    );
    expect(withoutFeedback.debrief).toBeNull();
  });

  it("does not render a multilingual advanced table when only one language is present", () => {
    const survey = buildModulatorSurvey();
    const data = buildInstrumentHealthData(
      buildSource(survey, [mappedResponse(survey, { Q_SAVE_01: 4, Q_SAVE_02: 4, Q_OVERRIDE_01: 3 })]),
    );
    expect(data.multilingual.languageCount).toBe(1);
    expect(data.multilingual).not.toHaveProperty("advancedModels");

    const panel = readFileSync(
      path.join(process.cwd(), "src/app/(app)/surveys/[surveyId]/analytics-v2/instrument-health-panel.tsx"),
      "utf8",
    );
    expect(panel).toContain("data.multilingual.languageCount > 1");
    expect(panel).not.toContain("Only one language is present in the included sample.");
    expect(panel).not.toContain("Fewer than two reflective candidates");
    expect(panel).toContain("analytics-v2-health-detail-row");
    expect(panel).toContain("<InfoTip");
    expect(
      readFileSync(path.join(process.cwd(), "src/app/(app)/surveys/[surveyId]/analytics-v2/info-tip.tsx"), "utf8"),
    ).toContain("analytics-v2-health-tip__bubble");
    expect(panel).toContain("key={data.cacheKey}");
    expect(panel).toContain("formatGeneratedAt(data.generatedAt)");
    expect(panel).toContain("formatHtmtCell(cell)");
    expect(panel).toContain("useSyncExternalStore");
    expect(panel).not.toContain("setScopeKey(data.defaultScopeKey)");
    expect(panel).not.toContain("setSessionChecked");
    expect(panel).toContain("Export JSON");
    expect(panel).toContain("downloadInstrumentHealthExport(data)");
    expect(panel).toContain("Construct associations");
    expect(panel).toContain("Core axes + supporting factors");
    expect(panel).toContain("groupInstrumentHealthConstructs");
    expect(panel).toContain("is-supporting");
    expect(panel).not.toContain("Reflective construct associations");
    expect(panel).not.toContain("Exploratory construct associations");
  });

  it("exports the generated analysis as expanded JSON without sensitive fields", () => {
    const survey = buildReflectivePairSurvey();
    const data = buildInstrumentHealthData(
      buildSource(survey, [
        mappedResponse(survey, { Q_TRUST_01: 5, Q_TRUST_02: 1, Q_AWARE_01: 5, Q_AWARE_02: 4, Q_AWARE_03: 4 }),
      ]),
    );
    const file = buildInstrumentHealthExport(data);
    const parsed = JSON.parse(file.body) as typeof data;

    expect(file.filename).toMatch(/^instrument-health-survey-reflective-pair-.*\.json$/);
    expect(parsed.scopes.overall.constructs.length).toBe(data.scopes.overall.constructs.length);
    expect(parsed.scopes.overall.constructs[0]?.items.length).toBeGreaterThan(0);
    expect(instrumentHealthJsonContainsSensitiveField(parsed)).toBe(false);
  });
});

describe("instrument health behavioural modulators", () => {
  it("keeps Construct Health working without an empty supporting-factors group", () => {
    const survey = buildReflectivePairSurvey();
    const data = buildInstrumentHealthData(
      buildSource(survey, [
        mappedResponse(survey, { Q_TRUST_01: 5, Q_TRUST_02: 1, Q_AWARE_01: 5, Q_AWARE_02: 4, Q_AWARE_03: 4 }),
      ]),
    );
    const groups = groupInstrumentHealthConstructs(data.scopes.overall.constructs);

    expect(groups.map((group) => group.key)).toEqual(["primary_profile_axis"]);
    expect(data.scopes.overall.constructs.every((construct) => construct.conceptRole === "primary_profile_axis")).toBe(
      true,
    );
    expect(associationConstructs(data.scopes.overall.constructs, "core_and_supporting")).toHaveLength(2);
  });

  it("shows a single-item modulator as a supporting factor without alpha or HTMT", () => {
    const survey = buildSingleModulatorSurvey();
    const data = buildInstrumentHealthData(
      buildSource(survey, [mappedResponse(survey, { Q_OVERRIDE_01: 4 })]),
    );
    const override = data.scopes.overall.constructs.find(
      (construct) => construct.conceptKey === "manual_override_need",
    );
    const groups = groupInstrumentHealthConstructs(data.scopes.overall.constructs);

    expect(override?.conceptRole).toBe("behavioural_modulator");
    expect(override?.role).toBe("descriptive_composite");
    expect(override?.itemCount).toBe(1);
    expect(override?.items[0]?.facet).toBe("immediate_intervention_need");
    expect(override?.reliability.alpha).toBeNull();
    expect(override?.items[0]?.correctedItemTotal).toBeNull();
    expect(data.scopes.overall.htmt).toEqual([]);
    expect(groups).toEqual([
      expect.objectContaining({
        key: "behavioural_modulator",
        constructs: [expect.objectContaining({ conceptKey: "manual_override_need" })],
      }),
    ]);
  });

  it("keeps measurement-plan order and item distributions for several modulators", () => {
    const survey = buildModulatorSurvey();
    const data = buildInstrumentHealthData(
      buildSource(survey, [
        mappedResponse(survey, { Q_SAVE_01: 5, Q_SAVE_02: 4, Q_OVERRIDE_01: 5 }),
        mappedResponse(survey, { Q_SAVE_01: 2, Q_SAVE_02: 1, Q_OVERRIDE_01: 3 }),
      ]),
    );

    expect(data.scopes.overall.constructs.map((construct) => construct.conceptKey)).toEqual([
      "savings_motivation",
      "manual_override_need",
    ]);
    expect(data.scopes.overall.constructs.find((construct) => construct.conceptKey === "savings_motivation")?.items).toEqual(
      [
        expect.objectContaining({ questionKey: "Q_SAVE_01", descriptives: expect.objectContaining({ mean: 3.5 }) }),
        expect.objectContaining({ questionKey: "Q_SAVE_02", descriptives: expect.objectContaining({ mean: 2.5 }) }),
      ],
    );
  });

  it("aligns the canonical modulator score without reversing the respondent-facing item distribution", () => {
    const survey = buildAxisWithModulatorsSurvey();
    const data = buildInstrumentHealthData(
      buildSource(survey, [
        mappedResponse(survey, {
          Q_TRUST_01: 5,
          Q_TRUST_02: 1,
          Q_SAVE_01: 5,
          Q_SAVE_02: 5,
          Q_OVERRIDE_01: 4,
          Q_EVENT_01: 3,
        }),
      ]),
    );
    const savings = data.scopes.overall.constructs.find((construct) => construct.conceptKey === "savings_motivation");
    const negativeItem = savings?.items.find((item) => item.questionKey === "Q_SAVE_02");

    expect(negativeItem?.polarity).toBe("negative");
    expect(negativeItem?.reverseScored).toBe(true);
    expect(negativeItem?.descriptives.mean).toBe(5);
    expect(savings?.scoreDescriptives.mean).toBe(3);
  });

  it("uses applicable n for modulator scores and paired correlation n", () => {
    const survey = buildAxisWithModulatorsSurvey();
    const data = buildInstrumentHealthData(
      buildSource(survey, [
        mappedResponse(survey, {
          Q_TRUST_01: 5,
          Q_TRUST_02: 1,
          Q_SAVE_01: 5,
          Q_SAVE_02: 1,
          Q_OVERRIDE_01: 5,
          Q_EVENT_01: 4,
        }),
        mappedResponse(survey, {
          Q_TRUST_01: 2,
          Q_TRUST_02: 4,
          Q_SAVE_01: 2,
          Q_SAVE_02: 4,
          Q_EVENT_01: 2,
        }),
      ]),
    );
    const override = data.scopes.overall.constructs.find(
      (construct) => construct.conceptKey === "manual_override_need",
    );
    const pair = data.scopes.overall.correlations.find(
      (cell) =>
        cell.rowConceptKey === "savings_motivation" && cell.columnConceptKey === "manual_override_need",
    );

    expect(override?.applicableN).toBe(1);
    expect(pair?.n).toBe(1);
    expect(pair?.overlapFlag).toBe(false);
  });

  it("exposes axis-by-modulator and modulator-by-modulator association cells", () => {
    const survey = buildAxisWithModulatorsSurvey();
    const data = buildInstrumentHealthData(
      buildSource(survey, [
        mappedResponse(survey, {
          Q_TRUST_01: 5,
          Q_TRUST_02: 1,
          Q_SAVE_01: 5,
          Q_SAVE_02: 1,
          Q_OVERRIDE_01: 5,
          Q_EVENT_01: 4,
        }),
        mappedResponse(survey, {
          Q_TRUST_01: 2,
          Q_TRUST_02: 4,
          Q_SAVE_01: 2,
          Q_SAVE_02: 4,
          Q_OVERRIDE_01: 2,
          Q_EVENT_01: 2,
        }),
      ]),
    );
    const groups = groupInstrumentHealthConstructs(data.scopes.overall.constructs);
    const core = associationConstructs(data.scopes.overall.constructs, "core");
    const withSupporting = associationConstructs(data.scopes.overall.constructs, "core_and_supporting");

    expect(groups.map((group) => group.key)).toEqual(["primary_profile_axis", "behavioural_modulator"]);
    expect(core.map((construct) => construct.conceptKey)).toEqual(["trust_in_automation"]);
    expect(withSupporting.map((construct) => construct.conceptKey)).toEqual([
      "trust_in_automation",
      "savings_motivation",
      "manual_override_need",
      "event_frequency_tolerance",
    ]);
    expect(
      data.scopes.overall.correlations.some(
        (cell) =>
          cell.rowConceptKey === "trust_in_automation" && cell.columnConceptKey === "savings_motivation",
      ),
    ).toBe(true);
    expect(
      data.scopes.overall.correlations.some(
        (cell) =>
          cell.rowConceptKey === "savings_motivation" && cell.columnConceptKey === "event_frequency_tolerance",
      ),
    ).toBe(true);
    expect(data.scopes.overall.htmt).toEqual([]);
  });

  it("does not show concepts that the survey does not measure", () => {
    const survey = buildSingleModulatorSurvey();
    const data = buildInstrumentHealthData(
      buildSource(survey, [mappedResponse(survey, { Q_OVERRIDE_01: 3 })]),
    );

    expect(data.scopes.overall.constructs.map((construct) => construct.conceptKey)).toEqual([
      "manual_override_need",
    ]);
    expect(data.scopes.overall.constructs.some((construct) => construct.conceptKey === "trust_in_automation")).toBe(
      false,
    );
    expect(data.scopes.overall.constructs.some((construct) => construct.conceptKey === "flexibility_willingness")).toBe(
      false,
    );
  });

  it("respects language scopes for modulators", () => {
    const survey = buildAxisWithModulatorsSurvey();
    const data = buildInstrumentHealthData(
      buildSource(survey, [
        mappedResponse(survey, {
          Q_TRUST_01: 5,
          Q_TRUST_02: 1,
          Q_SAVE_01: 5,
          Q_SAVE_02: 1,
          Q_OVERRIDE_01: 5,
          Q_EVENT_01: 4,
        }),
        mappedResponse(
          survey,
          {
            Q_TRUST_01: 2,
            Q_TRUST_02: 4,
            Q_SAVE_01: 2,
            Q_SAVE_02: 4,
            Q_OVERRIDE_01: 2,
            Q_EVENT_01: 2,
          },
          { submittedLanguage: "Spanish" },
        ),
      ]),
    );
    const english = data.scopes["language:English"]?.constructs.find(
      (construct) => construct.conceptKey === "manual_override_need",
    );
    const spanish = data.scopes["language:Spanish"]?.constructs.find(
      (construct) => construct.conceptKey === "manual_override_need",
    );

    expect(data.scopes["language:English"]?.n).toBe(1);
    expect(data.scopes["language:Spanish"]?.n).toBe(1);
    expect(english?.applicableN).toBe(1);
    expect(spanish?.applicableN).toBe(1);
    expect(english?.scoreDescriptives.median).toBe(5);
    expect(spanish?.scoreDescriptives.median).toBe(2);
  });

  it("includes DFC in core associations and pairs only applicable capability scores", () => {
    const survey = buildTrustAndDfcSurvey();
    const data = buildInstrumentHealthData(
      buildSource(survey, [
        mappedResponse(survey, {
          Q_TRUST_01: 5,
          Q_TRUST_02: 1,
          Q_OWNED_DER_ASSETS_01: ["ev"],
          Q_DFC_EV_CHARGING_OPERATIONAL_CONTROL: 4,
          Q_DFC_EV_CHARGING_TEMPORAL_SLACK: 4,
          Q_DFC_EV_CHARGING_SERVICE_PRESERVATION: 5,
          Q_DFC_EV_CHARGING_HOUSEHOLD_COORDINATION: 3,
        }),
        mappedResponse(survey, {
          Q_TRUST_01: 2,
          Q_TRUST_02: 4,
          Q_OWNED_DER_ASSETS_01: ["ev"],
          Q_DFC_EV_CHARGING_OPERATIONAL_CONTROL: 2,
          Q_DFC_EV_CHARGING_TEMPORAL_SLACK: 2,
          Q_DFC_EV_CHARGING_SERVICE_PRESERVATION: 2,
          Q_DFC_EV_CHARGING_HOUSEHOLD_COORDINATION: 2,
        }),
        mappedResponse(survey, {
          Q_TRUST_01: 3,
          Q_TRUST_02: 3,
          Q_OWNED_DER_ASSETS_01: ["battery_storage"],
        }),
      ]),
    );
    const dfc = data.scopes.overall.constructs.find(
      (construct) => construct.conceptKey === "declared_flexibility_capability",
    );
    const trust = data.scopes.overall.constructs.find(
      (construct) => construct.conceptKey === "trust_in_automation",
    );
    const groups = groupInstrumentHealthConstructs(data.scopes.overall.constructs);
    const core = associationConstructs(data.scopes.overall.constructs, "core");
    const pair = data.scopes.overall.correlations.find(
      (cell) =>
        cell.rowConceptKey === "trust_in_automation" &&
        cell.columnConceptKey === "declared_flexibility_capability",
    );
    const applicableEv = data.scopes.overall.conditionalModules[0]?.modules.find(
      (module) => module.setKey === "ev_charging",
    );

    expect(dfc?.conceptRole).toBe("primary_profile_axis");
    expect(dfc?.role).toBe("conditional_module");
    expect(groups.find((group) => group.key === "conditional_module")?.constructs.map((construct) => construct.conceptKey)).toEqual([
      "declared_flexibility_capability",
    ]);
    expect(core.map((construct) => construct.conceptKey)).toEqual([
      "trust_in_automation",
      "declared_flexibility_capability",
    ]);
    expect(trust?.applicableN).toBe(3);
    expect(dfc?.applicableN).toBe(2);
    expect(applicableEv?.applicableN).toBe(2);
    expect(pair?.n).toBe(2);
    expect(pair?.spearmanRho).not.toBeNull();
    expect(pair?.overlapFlag).toBe(false);
  });
});
