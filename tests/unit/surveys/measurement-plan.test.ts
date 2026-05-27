import { describe, expect, it } from "vitest";
import {
  applyMeasurementPlannerOutput,
  createMeasurementPlanFromMappings,
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

describe("measurement plan", () => {
  it("creates survey-question slots for primary profile axes", () => {
    const blueprint = createMeasurementPlanBlueprint(["trust_in_automation"]);
    const trustPlan = blueprint.concepts[0];

    expect(trustPlan).toMatchObject({
      concept_key: "trust_in_automation",
      evidence_source: "survey_questions",
      output_type: "number",
      slot_capacity_max: 6,
    });
  });

  it("keeps context concepts outside question-key planning", () => {
    const blueprint = createMeasurementPlanBlueprint([
      "country_code",
      "climate_context",
      "mapping_requires_review",
    ]);

    expect(blueprint.concepts).toEqual([
      expect.objectContaining({
        concept_key: "country_code",
        evidence_source: "response_context",
        slot_capacity_max: 0,
        source_paths: ["response_context.country_code"],
      }),
      expect.objectContaining({
        concept_key: "climate_context",
        evidence_source: "enrichment",
        slot_capacity_max: 0,
      }),
      expect.objectContaining({
        concept_key: "mapping_requires_review",
        evidence_source: "pipeline_flags",
        slot_capacity_max: 0,
      }),
    ]);
  });

  it("materializes a final measurement plan by binding slots to question keys", () => {
    const blueprint = applyMeasurementPlannerOutput(
      createMeasurementPlanBlueprint(["flexibility_willingness"]),
      {
        concepts: [
          {
            concept_key: "flexibility_willingness",
            measurement_type: "multi_item_likert_median",
            aggregation_rule: "median",
            threshold_profile: "likert_1_5_low_mid_high",
            slot_count: 4,
            slot_intents: slotIntents(4),
          },
        ],
      },
    );
    const plan = materializeMeasurementPlan(blueprint, {
      SLOT_FLEXIBILITY_WILLINGNESS_01: "Q_FLEXIBILITY_WILLINGNESS_01",
      SLOT_FLEXIBILITY_WILLINGNESS_02: "Q_FLEXIBILITY_WILLINGNESS_02",
      SLOT_FLEXIBILITY_WILLINGNESS_03: "Q_FLEXIBILITY_WILLINGNESS_03",
      SLOT_FLEXIBILITY_WILLINGNESS_04: "Q_FLEXIBILITY_WILLINGNESS_04",
    });

    expect(plan.concepts[0]).toMatchObject({
      concept_key: "flexibility_willingness",
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
      minimum_answer_count: 4,
      question_intents: [
        expect.objectContaining({
          question_key: "Q_FLEXIBILITY_WILLINGNESS_01",
          facet: "facet_1",
        }),
        expect.objectContaining({
          question_key: "Q_FLEXIBILITY_WILLINGNESS_02",
          facet: "facet_2",
        }),
        expect.objectContaining({
          question_key: "Q_FLEXIBILITY_WILLINGNESS_03",
          facet: "facet_3",
        }),
        expect.objectContaining({
          question_key: "Q_FLEXIBILITY_WILLINGNESS_04",
          facet: "facet_4",
        }),
      ],
    });
  });

  it("applies planner output to refine the measurement blueprint before writing", () => {
    const blueprint = createMeasurementPlanBlueprint(["trust_in_automation"]);
    const planned = applyMeasurementPlannerOutput(blueprint, {
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
    });

    expect(planned.concepts[0]).toMatchObject({
      concept_key: "trust_in_automation",
      minimum_answer_count: 2,
      question_slots: [
        {
          slot_key: "SLOT_TRUST_IN_AUTOMATION_01",
          facet: "facet_1",
          intent: "Measure facet 1.",
          polarity: "positive",
        },
        {
          slot_key: "SLOT_TRUST_IN_AUTOMATION_02",
          facet: "facet_2",
          intent: "Measure facet 2.",
          polarity: "positive",
        },
      ],
    });
  });

  it("rejects planner outputs that omit a selected concept", () => {
    const blueprint = createMeasurementPlanBlueprint([
      "trust_in_automation",
      "awareness_of_energy_systems",
    ]);

    expect(() =>
      applyMeasurementPlannerOutput(blueprint, {
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
      }),
    ).toThrow(/did not return a concept plan/);
  });

  it("rejects planner outputs with incompatible slot counts", () => {
    const blueprint = createMeasurementPlanBlueprint(["trust_in_automation"]);

    expect(() =>
      applyMeasurementPlannerOutput(blueprint, {
        concepts: [
          {
            concept_key: "trust_in_automation",
            measurement_type: "single_item_direct",
            aggregation_rule: "identity",
            threshold_profile: "likert_1_5_low_mid_high",
            slot_count: 2,
            slot_intents: slotIntents(2),
          },
        ],
      }),
    ).toThrow(/exactly 1 question slot/);
  });

  it("derives a usable measurement plan from actual mapping entries", () => {
    const plan = createMeasurementPlanFromMappings(
      ["trust_in_automation", "country_code"],
      [
        {
          question_key: "Q_TRUST_AUTOMATION_TRUST_LEVEL_01",
          ontology_target: "flexpulse_behavioural_schema.trust_in_automation",
        },
        {
          question_key: "Q_TRUST_AUTOMATION_TRUST_LEVEL_02",
          ontology_target: "flexpulse_behavioural_schema.trust_in_automation",
        },
      ],
    );

    expect(plan.concepts).toEqual([
      expect.objectContaining({
        concept_key: "trust_in_automation",
        measurement_type: "multi_item_likert_median",
        question_keys: [
          "Q_TRUST_AUTOMATION_TRUST_LEVEL_01",
          "Q_TRUST_AUTOMATION_TRUST_LEVEL_02",
        ],
        required_question_keys: [
          "Q_TRUST_AUTOMATION_TRUST_LEVEL_01",
          "Q_TRUST_AUTOMATION_TRUST_LEVEL_02",
        ],
      }),
      expect.objectContaining({
        concept_key: "country_code",
        question_keys: [],
        source_paths: ["response_context.country_code"],
      }),
    ]);
  });

  it("preserves question intents when rebuilding a plan from unchanged mappings", () => {
    const existingPlan = materializeMeasurementPlan(
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

    const plan = createMeasurementPlanFromMappings(
      ["trust_in_automation"],
      [
        {
          question_key: "Q_TRUST_01",
          ontology_target: "flexpulse_behavioural_schema.trust_in_automation",
        },
        {
          question_key: "Q_TRUST_02",
          ontology_target: "flexpulse_behavioural_schema.trust_in_automation",
        },
      ],
      existingPlan,
    );

    expect(plan.concepts[0].question_intents).toEqual(existingPlan.concepts[0].question_intents);
  });

  it("drops preserved intents when rebuilt question keys no longer match", () => {
    const existingPlan = materializeMeasurementPlan(
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

    const plan = createMeasurementPlanFromMappings(
      ["trust_in_automation"],
      [
        {
          question_key: "Q_TRUST_01",
          ontology_target: "flexpulse_behavioural_schema.trust_in_automation",
        },
        {
          question_key: "Q_TRUST_03",
          ontology_target: "flexpulse_behavioural_schema.trust_in_automation",
        },
      ],
      existingPlan,
    );

    expect(plan.concepts[0].question_intents).toEqual([]);
  });
});
