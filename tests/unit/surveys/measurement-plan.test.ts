import { describe, expect, it } from "vitest";
import {
  createMeasurementPlanFromMappings,
  createMeasurementPlanBlueprint,
  materializeMeasurementPlan,
} from "@/features/surveys/measurement-plan";

describe("measurement plan", () => {
  it("creates survey-question slots for primary profile axes", () => {
    const blueprint = createMeasurementPlanBlueprint(["trust_in_automation"]);
    const trustPlan = blueprint.concepts[0];

    expect(trustPlan).toMatchObject({
      concept_key: "trust_in_automation",
      evidence_source: "survey_questions",
      measurement_type: "multi_item_likert_median",
      minimum_answer_count: 2,
    });
    expect(trustPlan?.question_slots).toHaveLength(3);
    expect(trustPlan?.question_slots[0]).toMatchObject({
      role: "anchor",
      required: true,
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
        question_slots: [],
        source_paths: ["response_context.country_code"],
      }),
      expect.objectContaining({
        concept_key: "climate_context",
        evidence_source: "enrichment",
        question_slots: [],
      }),
      expect.objectContaining({
        concept_key: "mapping_requires_review",
        evidence_source: "pipeline_flags",
        question_slots: [],
      }),
    ]);
  });

  it("materializes a final measurement plan by binding slots to question keys", () => {
    const blueprint = createMeasurementPlanBlueprint(["flexibility_willingness"]);
    const plan = materializeMeasurementPlan(blueprint, {
      SLOT_FLEXIBILITY_WILLINGNESS_01: "Q_FLEXIBILITY_WILLINGNESS_01",
      SLOT_FLEXIBILITY_WILLINGNESS_02: "Q_FLEXIBILITY_WILLINGNESS_02",
      SLOT_FLEXIBILITY_WILLINGNESS_03: "Q_FLEXIBILITY_WILLINGNESS_03",
    });

    expect(plan.concepts[0]).toMatchObject({
      concept_key: "flexibility_willingness",
      question_keys: [
        "Q_FLEXIBILITY_WILLINGNESS_01",
        "Q_FLEXIBILITY_WILLINGNESS_02",
        "Q_FLEXIBILITY_WILLINGNESS_03",
      ],
      required_question_keys: [
        "Q_FLEXIBILITY_WILLINGNESS_01",
        "Q_FLEXIBILITY_WILLINGNESS_02",
      ],
      question_roles: {
        Q_FLEXIBILITY_WILLINGNESS_01: "anchor",
        Q_FLEXIBILITY_WILLINGNESS_02: "core",
        Q_FLEXIBILITY_WILLINGNESS_03: "core",
      },
    });
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
});
