import { describe, expect, it } from "vitest";
import {
  createInitialMappingContract,
  createInitialSurveyDefinition,
  normalizeSurveyResponseContextConfig,
} from "@/features/surveys/generator-types";
import {
  validateGeneratedSurveyDraft,
  validateMeasurementPlannerConceptCoverage,
  validateMeasurementPlanBlueprint,
  validateSurveyDefinition,
  validateSurveyPublication,
} from "@/features/surveys/generator-validation";
import {
  applyMeasurementPlannerOutput,
  createMeasurementPlanBlueprint,
  materializeMeasurementPlan,
} from "@/features/surveys/measurement-plan";

function slotIntents(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    facet: `facet_${index + 1}`,
    intent: `Measure facet ${index + 1}.`,
    polarity: "positive" as const,
  }));
}

describe("survey definition validation — response context", () => {
  it("rejects postal code collection without country code collection", () => {
    const definition = createInitialSurveyDefinition("English", ["English"]);
    definition.translations.English.survey_title = "Baseline survey";
    definition.survey_meta.response_context = {
      collect_country_code: false,
      collect_postal_code: true,
      enrich_weather_context: false,
    };

    const issues = validateSurveyDefinition(definition, {
      require_complete_translations: false,
    });

    expect(
      issues.some((issue) => issue.code === "postal_code_requires_country_code"),
    ).toBe(true);
  });

  it("rejects weather enrichment without full location context", () => {
    const definition = createInitialSurveyDefinition("English", ["English"]);
    definition.translations.English.survey_title = "Baseline survey";
    definition.survey_meta.response_context = {
      collect_country_code: true,
      collect_postal_code: false,
      enrich_weather_context: true,
    };

    const issues = validateSurveyDefinition(definition, {
      require_complete_translations: false,
    });

    expect(
      issues.some(
        (issue) => issue.code === "weather_enrichment_requires_location_context",
      ),
    ).toBe(true);
  });

  it("normalizes response context so weather enrichment forces required inputs", () => {
    expect(
      normalizeSurveyResponseContextConfig({
        enrich_weather_context: true,
      }),
    ).toEqual({
      collect_country_code: true,
      collect_postal_code: true,
      enrich_weather_context: true,
    });
  });
});

describe("survey definition validation — conditional visibility", () => {
  it("blocks publication when a visibility source is not part of the survey", () => {
    const definition = createInitialSurveyDefinition("English", ["English"]);
    definition.translations.English.survey_title = "Conditional survey";
    definition.questions = [
      {
        question_key: "Q_DEPENDENT",
        type: "rating_scale",
        required: true,
        order: 2,
        scale: { min: 1, max: 5 },
        visibility_rule: {
          source_question_key: "Q_MISSING",
          operator: "contains_any",
          values: ["ev"],
        },
      },
    ];
    definition.translations.English.questions.Q_DEPENDENT = {
      title: "I can schedule EV charging.",
    };

    expect(
      validateSurveyPublication(
        definition,
        createInitialMappingContract(),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unknown_visibility_source" }),
      ]),
    );
  });
});

describe("survey definition validation — translated scale anchors", () => {
  it("requires localized anchors for DFC v1 rating scales", () => {
    const definition = createInitialSurveyDefinition("Spanish", [
      "Spanish",
      "French",
    ]);
    definition.survey_meta.capability_module_version = "v1";
    definition.questions = [
      {
        question_key: "Q_DFC_TEST",
        type: "rating_scale",
        required: true,
        order: 1,
        scale: { min: 1, max: 5, step: 1 },
      },
    ];
    definition.translations.Spanish = {
      survey_title: "Encuesta",
      questions: {
        Q_DFC_TEST: {
          title: "¿Hasta qué punto es cierto?",
          scale: {
            min_label: "Nada cierto",
            max_label: "Totalmente cierto",
          },
        },
      },
    };
    definition.translations.French = {
      survey_title: "Enquête",
      questions: {
        Q_DFC_TEST: {
          title: "Dans quelle mesure est-ce vrai ?",
          scale: {
            min_label: "Pas du tout vrai",
            max_label: "",
          },
        },
      },
    };

    expect(validateSurveyDefinition(definition)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_scale_max_label",
          path:
            "translations.French.questions.Q_DFC_TEST.scale.max_label",
        }),
      ]),
    );
  });

  it("keeps legacy rating scales valid when they predate scale anchors", () => {
    const definition = createInitialSurveyDefinition("English", ["English"]);
    definition.questions = [
      {
        question_key: "Q_LEGACY_SCALE",
        type: "rating_scale",
        required: true,
        order: 1,
        scale: { min: 1, max: 5, step: 1 },
      },
    ];
    definition.translations.English = {
      survey_title: "Legacy survey",
      questions: {
        Q_LEGACY_SCALE: {
          title: "How comfortable are you with this?",
        },
      },
    };

    expect(
      validateSurveyDefinition(definition).filter((issue) =>
        issue.code.startsWith("missing_scale_"),
      ),
    ).toEqual([]);
  });
});

describe("survey methodology validation", () => {
  it("rejects publication when the survey is missing a usable measurement plan", () => {
    const definition = createInitialSurveyDefinition("English", ["English"]);
    definition.translations.English.survey_title = "Trust survey";
    definition.questions = [
      {
        question_key: "Q_TRUST_01",
        type: "rating_scale",
        required: true,
        order: 1,
        scale: { min: 1, max: 5, step: 1, min_label: "Low", max_label: "High" },
      },
    ];
    definition.translations.English.questions = {
      Q_TRUST_01: { title: "I trust automation in home energy management." },
    };

    const contract = createInitialMappingContract();
    contract.mappings = [
      {
        question_key: "Q_TRUST_01",
        ontology_target: "flexpulse_behavioural_schema.trust_in_automation",
        expected_type: "number",
        required_for_mapping: true,
        transform_strategy: { kind: "numeric_range", min: 1, max: 5 },
      },
    ];

    const issues = validateSurveyPublication(definition, contract);

    expect(
      issues.some((issue) => issue.code === "missing_measurement_plan_concepts"),
    ).toBe(true);
  });

  it("rejects planner outputs that omit selected concepts", () => {
    const issues = validateMeasurementPlannerConceptCoverage(
      ["trust_in_automation", "awareness_of_energy_systems"],
      ["trust_in_automation"],
    );

    expect(
      issues.some((issue) => issue.code === "missing_planner_concept_key"),
    ).toBe(true);
  });

  it("rejects planner outputs that add unexpected concepts", () => {
    const issues = validateMeasurementPlannerConceptCoverage(
      ["trust_in_automation"],
      ["trust_in_automation", "awareness_of_energy_systems"],
    );

    expect(
      issues.some((issue) => issue.code === "unexpected_planner_concept_key"),
    ).toBe(true);
  });

  it("rejects planner blueprints that leave survey concepts without slots", () => {
    const blueprint = applyMeasurementPlannerOutput(
      createMeasurementPlanBlueprint(["trust_in_automation"]),
      {
        concepts: [
          {
            concept_key: "trust_in_automation",
            measurement_type: "multi_item_likert_median",
            aggregation_rule: "median",
            threshold_profile: "likert_1_5_low_mid_high",
            slot_count: 2,
            slot_intents: slotIntents(2),
          },
        ],
      },
    );
    blueprint.concepts[0].question_slots = [];
    const issues = validateMeasurementPlanBlueprint(
      blueprint,
    );

    expect(
      issues.some((issue) => issue.code === "missing_question_coverage"),
    ).toBe(true);
  });

  it("rejects planner blueprints with malformed slot keys", () => {
    const blueprint = applyMeasurementPlannerOutput(
      createMeasurementPlanBlueprint(["trust_in_automation"]),
      {
        concepts: [
          {
            concept_key: "trust_in_automation",
            measurement_type: "multi_item_likert_median",
            aggregation_rule: "median",
            threshold_profile: "likert_1_5_low_mid_high",
            slot_count: 2,
            slot_intents: slotIntents(2),
          },
        ],
      },
    );
    blueprint.concepts[0].question_slots = [
      {
        slot_key: 'SLOT_trust_in_automation_01},{"',
        facet: "malformed",
        intent: "Measure malformed slot.",
        polarity: "positive",
      },
    ];
    const issues = validateMeasurementPlanBlueprint(blueprint);

    expect(
      issues.some((issue) => issue.code === "invalid_measurement_slot_key"),
    ).toBe(true);
  });

  it("flags measurement plans that point to the wrong ontology target", () => {
    const definition = createInitialSurveyDefinition("English", ["English"]);
    definition.translations.English.survey_title = "Trust survey";
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
    ];
    definition.translations.English.questions = {
      Q_TRUST_01: { title: "I trust automation in home energy management." },
      Q_TRUST_02: { title: "I trust automation in home energy management." },
    };

    const contract = createInitialMappingContract();
    contract.mappings = [
      {
        question_key: "Q_TRUST_01",
        ontology_target: "flexpulse_behavioural_schema.flexibility_willingness",
        expected_type: "number",
        required_for_mapping: true,
        transform_strategy: { kind: "numeric_range", min: 1, max: 5 },
      },
      {
        question_key: "Q_TRUST_02",
        ontology_target: "flexpulse_behavioural_schema.flexibility_willingness",
        expected_type: "number",
        required_for_mapping: true,
        transform_strategy: { kind: "numeric_range", min: 1, max: 5 },
      },
    ];

    const plannedBlueprint = applyMeasurementPlannerOutput(
      createMeasurementPlanBlueprint(["trust_in_automation"]),
      {
        concepts: [
          {
            concept_key: "trust_in_automation",
            measurement_type: "multi_item_likert_median",
            aggregation_rule: "median",
            threshold_profile: "likert_1_5_low_mid_high",
            slot_count: 2,
            slot_intents: slotIntents(2),
          },
        ],
      },
    );
    const measurementPlan = materializeMeasurementPlan(plannedBlueprint, {
      SLOT_TRUST_IN_AUTOMATION_01: "Q_TRUST_01",
      SLOT_TRUST_IN_AUTOMATION_02: "Q_TRUST_02",
    });

    const issues = validateGeneratedSurveyDraft(
      definition,
      contract,
      measurementPlan,
    );

    expect(
      issues.some((issue) => issue.code === "measurement_mapping_target_mismatch"),
    ).toBe(true);
  });

  it("rejects survey question concepts with missing question intents", () => {
    const definition = createInitialSurveyDefinition("English", ["English"]);
    definition.translations.English.survey_title = "Trust survey";
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
    ];
    definition.translations.English.questions = {
      Q_TRUST_01: { title: "I trust automation in home energy management." },
      Q_TRUST_02: { title: "I trust automation in home energy management." },
    };

    const contract = createInitialMappingContract();
    contract.mappings = [
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
    ];

    const measurementPlan = materializeMeasurementPlan(
      applyMeasurementPlannerOutput(
        createMeasurementPlanBlueprint(["trust_in_automation"]),
        {
          concepts: [
            {
              concept_key: "trust_in_automation",
              measurement_type: "multi_item_likert_median",
              aggregation_rule: "median",
              threshold_profile: "likert_1_5_low_mid_high",
              slot_count: 2,
              slot_intents: slotIntents(2),
            },
          ],
        },
      ),
      {
        SLOT_TRUST_IN_AUTOMATION_01: "Q_TRUST_01",
        SLOT_TRUST_IN_AUTOMATION_02: "Q_TRUST_02",
      },
    );
    measurementPlan.concepts[0].question_intents = [];

    const issues = validateGeneratedSurveyDraft(
      definition,
      contract,
      measurementPlan,
    );

    expect(
      issues.some((issue) => issue.code === "question_intents_mismatch"),
    ).toBe(true);
  });

  it("rejects preferred_tariff_model mappings with unknown ontology values", () => {
    const definition = createInitialSurveyDefinition("English", ["English"]);
    definition.translations.English.survey_title = "Tariff survey";
    definition.questions = [
      {
        question_key: "Q_TARIFF_01",
        type: "single_choice",
        required: true,
        order: 1,
        options: [
          { option_key: "opt_1", value: "value_1" },
          { option_key: "opt_2", value: "value_2" },
        ],
      },
    ];
    definition.translations.English.questions = {
      Q_TARIFF_01: {
        title: "Which tariff model do you prefer?",
        options: {
          opt_1: "Option A",
          opt_2: "Option B",
        },
      },
    };

    const contract = createInitialMappingContract();
    contract.mappings = [
      {
        question_key: "Q_TARIFF_01",
        ontology_target: "flexpulse_behavioural_schema.preferred_tariff_model",
        expected_type: "string",
        required_for_mapping: true,
        transform_strategy: {
          kind: "enum_lookup",
          option_to_value: {
            opt_1: "time_of_use",
            opt_2: "unsupported_tariff_type",
          },
        },
      },
    ];

    const issues = validateSurveyPublication(definition, contract);

    expect(
      issues.some((issue) => issue.code === "unknown_tariff_ontology_value"),
    ).toBe(true);
  });
});
