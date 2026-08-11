import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeContentHash } from "@/features/surveys/content-validator";
import { computeMeasurementHash } from "@/features/surveys/generator-mapping";
import {
  createInitialMappingContract,
  createInitialSurveyDefinition,
  type MeasurementPlan,
  type MeasurementPlanEntry,
} from "@/features/surveys/generator-types";
import { computeMultilingualTranslationHash } from "@/features/surveys/translation-validation";

const { revalidatePath, getOwnedSurveyById, updateSurveyDraft } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  getOwnedSurveyById: vi.fn(),
  updateSurveyDraft: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath,
}));

vi.mock("@/features/surveys/generator-repository", () => ({
  getOwnedSurveyById,
  updateSurveyDraft,
  publishSurvey: vi.fn(),
  createSurveyDraft: vi.fn(),
  duplicateOwnedSurvey: vi.fn(),
  deleteOwnedSurveyDraft: vi.fn(),
  archiveOwnedSurvey: vi.fn(),
}));

function buildThermalMeasurementPlan(
  temporaryDeviationFacet = "temporary_deviation_tolerance",
): MeasurementPlan {
  return {
    schema_version: 1,
    schema_namespace: "flexpulse_behavioural_schema",
    concepts: [
      {
        concept_key: "thermal_comfort_norms",
        evidence_source: "survey_questions",
        measurement_type: "multi_item_likert_mean",
        output_type: "number",
        aggregation_rule: "mean",
        threshold_profile: "likert_1_5_low_mid_high_strict",
        minimum_answer_count: 4,
        question_keys: [
          "Q_THERMAL_COMFORT_NORMS_01",
          "Q_THERMAL_COMFORT_NORMS_02",
          "Q_THERMAL_COMFORT_NORMS_03",
          "Q_THERMAL_COMFORT_NORMS_04",
        ],
        required_question_keys: [
          "Q_THERMAL_COMFORT_NORMS_01",
          "Q_THERMAL_COMFORT_NORMS_02",
          "Q_THERMAL_COMFORT_NORMS_03",
          "Q_THERMAL_COMFORT_NORMS_04",
        ],
        question_intents: [
          {
            slot_key: "SLOT_THERMAL_01",
            question_key: "Q_THERMAL_COMFORT_NORMS_01",
            facet: "temperature_stability_requirement",
            intent: "Measure need for preserving indoor setpoint stability.",
            polarity: "positive",
          },
          {
            slot_key: "SLOT_THERMAL_02",
            question_key: "Q_THERMAL_COMFORT_NORMS_02",
            facet: temporaryDeviationFacet,
            intent: "Measure tolerance for a defined temporary indoor-temperature deviation.",
            polarity: "negative",
          },
          {
            slot_key: "SLOT_THERMAL_03",
            question_key: "Q_THERMAL_COMFORT_NORMS_03",
            facet: "recovery_expectation",
            intent: "Measure expected recovery after a defined temporary deviation.",
            polarity: "positive",
          },
          {
            slot_key: "SLOT_THERMAL_04",
            question_key: "Q_THERMAL_COMFORT_NORMS_04",
            facet: "comfort_variation_boundary",
            intent: "Measure the defined variation point where comfort becomes unacceptable.",
            polarity: "positive",
          },
        ],
      },
    ],
  };
}

function buildDraftSurveyFixture(temporaryDeviationFacet = "temporary_deviation_tolerance") {
  const definition = createInitialSurveyDefinition("English", ["English", "Spanish"]);
  definition.questions = [
    {
      question_key: "Q_THERMAL_COMFORT_NORMS_01",
      type: "rating_scale",
      required: true,
      order: 1,
      scale: { min: 1, max: 5, min_label: "Strongly disagree", max_label: "Strongly agree" },
    },
    {
      question_key: "Q_THERMAL_COMFORT_NORMS_02",
      type: "rating_scale",
      required: true,
      order: 2,
      scale: { min: 1, max: 5, min_label: "Strongly disagree", max_label: "Strongly agree" },
    },
    {
      question_key: "Q_THERMAL_COMFORT_NORMS_03",
      type: "rating_scale",
      required: true,
      order: 3,
      scale: { min: 1, max: 5, min_label: "Strongly disagree", max_label: "Strongly agree" },
    },
    {
      question_key: "Q_THERMAL_COMFORT_NORMS_04",
      type: "rating_scale",
      required: true,
      order: 4,
      scale: { min: 1, max: 5, min_label: "Strongly disagree", max_label: "Strongly agree" },
    },
  ];
  definition.translations.English = {
    survey_title: "Thermal comfort pilot",
    survey_description: "A candidate survey for pilot testing.",
    questions: {
      Q_THERMAL_COMFORT_NORMS_01: {
        title: "I want my chosen indoor temperature to stay stable while I am at home.",
        scale: { min_label: "Strongly disagree", max_label: "Strongly agree" },
      },
      Q_THERMAL_COMFORT_NORMS_02: {
        title:
          "I can tolerate the indoor temperature being 1°C above or below my chosen setting for 1 hour.",
        scale: { min_label: "Strongly disagree", max_label: "Strongly agree" },
      },
      Q_THERMAL_COMFORT_NORMS_03: {
        title:
          "After the indoor temperature is 1°C above or below my chosen setting for 1 hour, I expect it to return to my chosen temperature within 30 minutes.",
        scale: { min_label: "Strongly disagree", max_label: "Strongly agree" },
      },
      Q_THERMAL_COMFORT_NORMS_04: {
        title:
          "I would find it unacceptable if the indoor temperature were 2°C above or below my chosen setting for 1 hour.",
        scale: { min_label: "Strongly disagree", max_label: "Strongly agree" },
      },
    },
  };
  definition.translations.Spanish = {
    survey_title: "Piloto de confort térmico",
    survey_description: "Una encuesta candidata para pruebas piloto.",
    questions: {
      Q_THERMAL_COMFORT_NORMS_01: {
        title:
          "Quiero que la temperatura interior que elijo se mantenga estable mientras estoy en casa.",
        scale: { min_label: "Totalmente en desacuerdo", max_label: "Totalmente de acuerdo" },
      },
      Q_THERMAL_COMFORT_NORMS_02: {
        title:
          "Puedo tolerar que la temperatura interior esté 1 °C por encima o por debajo del ajuste que elijo durante 1 hora.",
        scale: { min_label: "Totalmente en desacuerdo", max_label: "Totalmente de acuerdo" },
      },
      Q_THERMAL_COMFORT_NORMS_03: {
        title:
          "Después de que la temperatura interior esté 1 °C por encima o por debajo del ajuste que elijo durante 1 hora, espero que vuelva a mi temperatura elegida en 30 minutos.",
        scale: { min_label: "Totalmente en desacuerdo", max_label: "Totalmente de acuerdo" },
      },
      Q_THERMAL_COMFORT_NORMS_04: {
        title:
          "Me resultaría inaceptable que la temperatura interior estuviera 2 °C por encima o por debajo del ajuste que elijo durante 1 hora.",
        scale: { min_label: "Totalmente en desacuerdo", max_label: "Totalmente de acuerdo" },
      },
    },
  };
  definition.survey_meta.measurement_plan_json = buildThermalMeasurementPlan(
    temporaryDeviationFacet,
  );

  const contentHash = computeContentHash(
    definition.questions,
    definition.translations.English,
  );
  const translationHash = computeMultilingualTranslationHash(definition, [
    "English",
    "Spanish",
  ]);

  definition.survey_meta.validation_result = {
    validated_at: "2026-08-09T12:00:00.000Z",
    content_hash: contentHash,
    passed: true,
    issues: [],
  };
  definition.survey_meta.multilingual_validation_result = {
    validated_at: "2026-08-09T12:10:00.000Z",
    translation_hash: translationHash,
    validated_languages: ["English", "Spanish"],
    passed: true,
    issues: [],
    language_statuses: [
      { language: "English", passed: true, issue_count: 0 },
      { language: "Spanish", passed: true, issue_count: 0 },
    ],
  };
  definition.survey_meta.expert_review_result = {
    schema_version: 1,
    baseline_content_hash: contentHash,
    baseline_copy_hash: translationHash,
    final_content_hash: contentHash,
    final_copy_hash: translationHash,
    applied_at: "2026-08-09T12:20:00.000Z",
    applied_by_user_id: "user-1",
    reviewer_type: "language_expert",
    review_basis: "Native review pass completed.",
    acknowledgement_version: "v1",
    changes: [],
  };

  return {
    id: "survey-thermal-draft",
    name: "Thermal draft",
    status: "draft" as const,
    created_by: "user-1",
    created_at: "2026-08-09T11:00:00.000Z",
    updated_at: "2026-08-09T11:00:00.000Z",
    published_at: null,
    default_language: "English",
    supported_languages: ["English", "Spanish"],
    definition_json: definition,
    mapping_contract_json: createInitialMappingContract(),
    mapping_compiled_json: null,
    mapping_hash: "mapping_hash_v1",
    measurement_hash: null,
  };
}

describe("thermal facet repair action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateSurveyDraft.mockImplementation(async (input) => ({
      ...buildDraftSurveyFixture("temporary_deviation_intolerance"),
      id: input.surveyId,
      definition_json: input.definition_json,
    }));
  });

  it("repairs only the temporary deviation facet and preserves review snapshots", async () => {
    const survey = buildDraftSurveyFixture();
    getOwnedSurveyById.mockResolvedValue(survey);

    const { repairDraftThermalComfortFacetSemantics } = await import(
      "@/features/surveys/actions"
    );

    const result = await repairDraftThermalComfortFacetSemantics(survey.id);

    expect(updateSurveyDraft).toHaveBeenCalledTimes(1);
    const updatePayload = updateSurveyDraft.mock.calls[0]?.[0];
    const updatedDefinition = updatePayload.definition_json;
    const updatedPlan = updatedDefinition.survey_meta.measurement_plan_json;
    const updatedThermalConcept = updatedPlan?.concepts.find(
      (concept: MeasurementPlanEntry) => concept.concept_key === "thermal_comfort_norms",
    );

    expect(
      updatedThermalConcept?.question_intents?.map(
        (intent: NonNullable<MeasurementPlanEntry["question_intents"]>[number]) =>
          intent.facet,
      ),
    ).toEqual([
      "temperature_stability_requirement",
      "temporary_deviation_intolerance",
      "recovery_expectation",
      "comfort_variation_boundary",
    ]);
    expect(updatedDefinition.questions).toEqual(survey.definition_json.questions);
    expect(updatedDefinition.translations).toEqual(survey.definition_json.translations);
    expect(updatedDefinition.survey_meta.validation_result).toEqual(
      survey.definition_json.survey_meta.validation_result,
    );
    expect(updatedDefinition.survey_meta.multilingual_validation_result).toEqual(
      survey.definition_json.survey_meta.multilingual_validation_result,
    );
    expect(updatedDefinition.survey_meta.expert_review_result).toEqual(
      survey.definition_json.survey_meta.expert_review_result,
    );
    expect(
      computeContentHash(updatedDefinition.questions, updatedDefinition.translations.English),
    ).toBe(survey.definition_json.survey_meta.validation_result?.content_hash);
    expect(
      computeMultilingualTranslationHash(updatedDefinition, ["English", "Spanish"]),
    ).toBe(
      survey.definition_json.survey_meta.multilingual_validation_result?.translation_hash,
    );
    expect(result.changed).toBe(true);
    expect(result.previousMeasurementHash).not.toBe(result.nextMeasurementHash);
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("is idempotent when the draft has already been repaired", async () => {
    const repairedSurvey = buildDraftSurveyFixture("temporary_deviation_intolerance");
    getOwnedSurveyById.mockResolvedValue(repairedSurvey);

    const { repairDraftThermalComfortFacetSemantics } = await import(
      "@/features/surveys/actions"
    );

    const result = await repairDraftThermalComfortFacetSemantics(repairedSurvey.id);

    expect(result.changed).toBe(false);
    expect(updateSurveyDraft).not.toHaveBeenCalled();
  });

  it("rejects non-draft surveys", async () => {
    getOwnedSurveyById.mockResolvedValue({
      ...buildDraftSurveyFixture(),
      status: "published",
      published_at: "2026-08-09T12:30:00.000Z",
    });

    const { repairDraftThermalComfortFacetSemantics } = await import(
      "@/features/surveys/actions"
    );

    await expect(
      repairDraftThermalComfortFacetSemantics("survey-thermal-published"),
    ).rejects.toThrow("Thermal facet repair only supports draft surveys.");
    expect(updateSurveyDraft).not.toHaveBeenCalled();
  });

  it("changes the measurement hash while leaving the existing draft column lifecycle untouched", async () => {
    const survey = buildDraftSurveyFixture();
    getOwnedSurveyById.mockResolvedValue(survey);

    const { repairDraftThermalComfortFacetSemantics } = await import(
      "@/features/surveys/actions"
    );

    const result = await repairDraftThermalComfortFacetSemantics(survey.id);

    expect(survey.measurement_hash).toBeNull();
    expect(result.previousMeasurementHash).toBe(
      computeMeasurementHash(
        survey.definition_json.survey_meta.measurement_plan_json as MeasurementPlan,
      ),
    );
    expect(result.nextMeasurementHash).not.toBe(result.previousMeasurementHash);
  });
});
