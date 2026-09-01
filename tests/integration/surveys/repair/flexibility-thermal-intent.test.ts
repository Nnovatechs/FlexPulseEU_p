import { describe, expect, it } from "vitest";
import { computeContentHash } from "@/features/surveys/content-validator";
import { computeMeasurementHash } from "@/features/surveys/generator-mapping";
import {
  createInitialMappingContract,
  createInitialSurveyDefinition,
  type MeasurementPlan,
  type PersistedSurvey,
} from "@/features/surveys/generator-types";
import {
  FLEXIBILITY_THERMAL_INTENT_LEGACY_TEXT,
  FLEXIBILITY_THERMAL_INTENT_REPAIRED_TEXT,
  prepareFlexibilityThermalIntentRepair,
} from "@/features/surveys/measurement-plan-repairs";
import { computeMultilingualTranslationHash } from "@/features/surveys/translation-validation";

function buildFlexibilityMeasurementPlan(
  thermalIntent: string = FLEXIBILITY_THERMAL_INTENT_LEGACY_TEXT,
): MeasurementPlan {
  return {
    schema_version: 1,
    schema_namespace: "flexpulse_behavioural_schema",
    concepts: [
      {
        concept_key: "flexibility_willingness",
        evidence_source: "survey_questions",
        measurement_type: "multi_item_likert_mean",
        output_type: "number",
        aggregation_rule: "mean",
        threshold_profile: "likert_1_5_low_mid_high",
        minimum_answer_count: 4,
        question_keys: [
          "Q_FLEXIBILITY_WILLINGNESS_01",
          "Q_FLEXIBILITY_WILLINGNESS_02",
          "Q_FLEXIBILITY_WILLINGNESS_03",
          "Q_FLEXIBILITY_WILLINGNESS_04",
        ],
        required_question_keys: [
          "Q_FLEXIBILITY_WILLINGNESS_01",
          "Q_FLEXIBILITY_WILLINGNESS_02",
          "Q_FLEXIBILITY_WILLINGNESS_03",
          "Q_FLEXIBILITY_WILLINGNESS_04",
        ],
        question_intents: [
          {
            slot_key: "SLOT_FLEX_01",
            question_key: "Q_FLEXIBILITY_WILLINGNESS_01",
            facet: "participation_intention",
            intent: "Measure bounded programme participation willingness.",
            polarity: "positive",
          },
          {
            slot_key: "SLOT_FLEX_02",
            question_key: "Q_FLEXIBILITY_WILLINGNESS_02",
            facet: "appliance_shift_acceptance",
            intent: "Measure bounded appliance-shift willingness.",
            polarity: "positive",
          },
          {
            slot_key: "SLOT_FLEX_03",
            question_key: "Q_FLEXIBILITY_WILLINGNESS_03",
            facet: "temporary_thermal_adjustment_acceptance",
            intent: thermalIntent,
            polarity: "positive",
          },
          {
            slot_key: "SLOT_FLEX_04",
            question_key: "Q_FLEXIBILITY_WILLINGNESS_04",
            facet: "routine_disruption_boundary",
            intent: "Measure bounded routine-rescheduling willingness.",
            polarity: "positive",
          },
        ],
      },
    ],
  };
}

function buildDraftSurveyFixture(
  thermalIntent: string = FLEXIBILITY_THERMAL_INTENT_LEGACY_TEXT,
): PersistedSurvey {
  const definition = createInitialSurveyDefinition("English", ["English", "Spanish", "French"]);
  definition.questions = [
    {
      question_key: "Q_FLEXIBILITY_WILLINGNESS_01",
      type: "rating_scale",
      required: true,
      order: 1,
      scale: { min: 1, max: 5, min_label: "Strongly disagree", max_label: "Strongly agree" },
    },
    {
      question_key: "Q_FLEXIBILITY_WILLINGNESS_02",
      type: "rating_scale",
      required: true,
      order: 2,
      scale: { min: 1, max: 5, min_label: "Strongly disagree", max_label: "Strongly agree" },
    },
    {
      question_key: "Q_FLEXIBILITY_WILLINGNESS_03",
      type: "rating_scale",
      required: true,
      order: 3,
      scale: { min: 1, max: 5, min_label: "Strongly disagree", max_label: "Strongly agree" },
    },
    {
      question_key: "Q_FLEXIBILITY_WILLINGNESS_04",
      type: "rating_scale",
      required: true,
      order: 4,
      scale: { min: 1, max: 5, min_label: "Strongly disagree", max_label: "Strongly agree" },
    },
  ];
  definition.translations.English = {
    survey_title: "Flexibility draft",
    survey_description: "A candidate flexibility survey.",
    questions: {
      Q_FLEXIBILITY_WILLINGNESS_01: {
        title: "I would be willing to join a household flexibility programme.",
        scale: { min_label: "Strongly disagree", max_label: "Strongly agree" },
      },
      Q_FLEXIBILITY_WILLINGNESS_02: {
        title: "I would be willing to delay an appliance task by 2 hours.",
        scale: { min_label: "Strongly disagree", max_label: "Strongly agree" },
      },
      Q_FLEXIBILITY_WILLINGNESS_03: {
        title:
          "I would be willing to accept the indoor temperature being 2°C above or below my chosen setting for 2 hours during a high-demand period.",
        scale: { min_label: "Strongly disagree", max_label: "Strongly agree" },
      },
      Q_FLEXIBILITY_WILLINGNESS_04: {
        title: "I would be willing to reschedule a planned household task.",
        scale: { min_label: "Strongly disagree", max_label: "Strongly agree" },
      },
    },
  };
  definition.translations.Spanish = {
    survey_title: "Borrador de flexibilidad",
    survey_description: "Una encuesta candidata sobre flexibilidad.",
    questions: {
      Q_FLEXIBILITY_WILLINGNESS_01: {
        title: "Estaría dispuesto/a a unirme a un programa de flexibilidad doméstica.",
        scale: { min_label: "Totalmente en desacuerdo", max_label: "Totalmente de acuerdo" },
      },
      Q_FLEXIBILITY_WILLINGNESS_02: {
        title: "Estaría dispuesto/a a retrasar una tarea de un electrodoméstico durante 2 horas.",
        scale: { min_label: "Totalmente en desacuerdo", max_label: "Totalmente de acuerdo" },
      },
      Q_FLEXIBILITY_WILLINGNESS_03: {
        title:
          "Estaría dispuesto/a a aceptar que la temperatura interior esté 2 °C por encima o por debajo del ajuste que elijo durante 2 horas en un periodo de alta demanda.",
        scale: { min_label: "Totalmente en desacuerdo", max_label: "Totalmente de acuerdo" },
      },
      Q_FLEXIBILITY_WILLINGNESS_04: {
        title: "Estaría dispuesto/a a reprogramar una tarea doméstica ya planificada.",
        scale: { min_label: "Totalmente en desacuerdo", max_label: "Totalmente de acuerdo" },
      },
    },
  };
  definition.translations.French = {
    survey_title: "Brouillon de flexibilité",
    survey_description: "Une enquête candidate sur la flexibilité.",
    questions: {
      Q_FLEXIBILITY_WILLINGNESS_01: {
        title:
          "Je serais disposé(e) à rejoindre un programme de flexibilité pour le foyer.",
        scale: { min_label: "Tout à fait en désaccord", max_label: "Tout à fait d'accord" },
      },
      Q_FLEXIBILITY_WILLINGNESS_02: {
        title:
          "Je serais disposé(e) à décaler une tâche d'un appareil de 2 heures.",
        scale: { min_label: "Tout à fait en désaccord", max_label: "Tout à fait d'accord" },
      },
      Q_FLEXIBILITY_WILLINGNESS_03: {
        title:
          "Je serais disposé(e) à accepter que la température intérieure soit de 2 °C au-dessus ou au-dessous du réglage choisi pendant 2 heures lors d'une période de forte demande.",
        scale: { min_label: "Tout à fait en désaccord", max_label: "Tout à fait d'accord" },
      },
      Q_FLEXIBILITY_WILLINGNESS_04: {
        title:
          "Je serais disposé(e) à reprogrammer une tâche domestique déjà planifiée.",
        scale: { min_label: "Tout à fait en désaccord", max_label: "Tout à fait d'accord" },
      },
    },
  };
  definition.survey_meta.measurement_plan_json = buildFlexibilityMeasurementPlan(thermalIntent);

  const contentHash = computeContentHash(
    definition.questions,
    definition.translations.English,
  );
  const translationHash = computeMultilingualTranslationHash(definition, [
    "English",
    "Spanish",
    "French",
  ]);

  definition.survey_meta.validation_result = {
    validated_at: "2026-08-13T10:00:00.000Z",
    content_hash: contentHash,
    passed: true,
    issues: [],
  };
  definition.survey_meta.multilingual_validation_result = {
    validated_at: "2026-08-13T10:10:00.000Z",
    translation_hash: translationHash,
    validated_languages: ["English", "Spanish", "French"],
    passed: true,
    issues: [],
    language_statuses: [
      { language: "English", passed: true, issue_count: 0 },
      { language: "Spanish", passed: true, issue_count: 0 },
      { language: "French", passed: true, issue_count: 0 },
    ],
  };
  definition.survey_meta.expert_review_result = {
    schema_version: 1,
    baseline_content_hash: contentHash,
    baseline_copy_hash: translationHash,
    final_content_hash: contentHash,
    final_copy_hash: translationHash,
    applied_at: "2026-08-13T10:20:00.000Z",
    applied_by_user_id: "user-1",
    reviewer_type: "language_expert",
    review_basis: "Native review pass completed.",
    acknowledgement_version: "v1",
    changes: [],
  };

  return {
    id: "survey-flexibility-draft",
    name: "Flexibility draft",
    status: "draft",
    created_by: "user-1",
    created_at: "2026-08-13T09:00:00.000Z",
    updated_at: "2026-08-13T09:00:00.000Z",
    published_at: null,
    default_language: "English",
    supported_languages: ["English", "Spanish", "French"],
    definition_json: definition,
    mapping_contract_json: createInitialMappingContract(),
    mapping_compiled_json: null,
    mapping_hash: "mapping_hash_v1",
    measurement_hash: null,
  };
}

describe("flexibility thermal intent repair", () => {
  it("repairs only the target intent and preserves hashes and snapshots", () => {
    const survey = buildDraftSurveyFixture();

    const result = prepareFlexibilityThermalIntentRepair(survey);
    const updatedPlan = result.nextDefinition.survey_meta.measurement_plan_json;
    const updatedIntent = updatedPlan?.concepts[0].question_intents?.find(
      (intent) => intent.question_key === "Q_FLEXIBILITY_WILLINGNESS_03",
    );

    expect(result.changed).toBe(true);
    expect(updatedIntent?.intent).toBe(FLEXIBILITY_THERMAL_INTENT_REPAIRED_TEXT);
    expect(updatedIntent?.facet).toBe("temporary_thermal_adjustment_acceptance");
    expect(updatedIntent?.polarity).toBe("positive");
    expect(updatedIntent?.slot_key).toBe("SLOT_FLEX_03");
    expect(result.nextDefinition.questions).toEqual(survey.definition_json.questions);
    expect(result.nextDefinition.translations).toEqual(survey.definition_json.translations);
    expect(result.nextDefinition.survey_meta.validation_result).toEqual(
      survey.definition_json.survey_meta.validation_result,
    );
    expect(result.nextDefinition.survey_meta.multilingual_validation_result).toEqual(
      survey.definition_json.survey_meta.multilingual_validation_result,
    );
    expect(result.nextDefinition.survey_meta.expert_review_result).toEqual(
      survey.definition_json.survey_meta.expert_review_result,
    );
    expect(
      computeContentHash(
        result.nextDefinition.questions,
        result.nextDefinition.translations.English,
      ),
    ).toBe(survey.definition_json.survey_meta.validation_result?.content_hash);
    expect(
      computeMultilingualTranslationHash(result.nextDefinition, [
        "English",
        "Spanish",
        "French",
      ]),
    ).toBe(survey.definition_json.survey_meta.multilingual_validation_result?.translation_hash);
    expect(result.previousMeasurementHash).not.toBe(result.nextMeasurementHash);
  });

  it("is idempotent once the flexibility thermal intent has already been repaired", () => {
    const survey = buildDraftSurveyFixture(FLEXIBILITY_THERMAL_INTENT_REPAIRED_TEXT);

    const result = prepareFlexibilityThermalIntentRepair(survey);

    expect(result.changed).toBe(false);
    expect(result.previousMeasurementHash).toBe(
      computeMeasurementHash(
        survey.definition_json.survey_meta.measurement_plan_json as MeasurementPlan,
      ),
    );
  });

  it("rejects non-draft surveys", () => {
    const survey = {
      ...buildDraftSurveyFixture(),
      status: "published" as const,
      published_at: "2026-08-13T10:30:00.000Z",
    };

    expect(() => prepareFlexibilityThermalIntentRepair(survey)).toThrow(
      "Flexibility thermal intent repair only supports draft surveys.",
    );
  });

  it("rejects ambiguous flexibility thermal intents", () => {
    const survey = buildDraftSurveyFixture();
    const intents =
      survey.definition_json.survey_meta.measurement_plan_json?.concepts[0].question_intents;
    if (!intents) {
      throw new Error("Missing question intents.");
    }
    intents.push({
      slot_key: "SLOT_FLEX_05",
      question_key: "Q_FLEXIBILITY_WILLINGNESS_05",
      facet: "temporary_thermal_adjustment_acceptance",
      intent: FLEXIBILITY_THERMAL_INTENT_LEGACY_TEXT,
      polarity: "positive",
    });

    expect(() => prepareFlexibilityThermalIntentRepair(survey)).toThrow(
      "Flexibility thermal intent repair requires exactly one positive temporary_thermal_adjustment_acceptance intent.",
    );
  });
});
