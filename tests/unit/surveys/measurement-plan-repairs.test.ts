import { describe, expect, it } from "vitest";
import type { MeasurementPlan } from "@/features/surveys/generator-types";
import {
  THERMAL_COMFORT_LEGACY_FACET_KEY,
  THERMAL_COMFORT_REPAIRED_FACET_KEY,
  repairThermalComfortMeasurementPlan,
} from "@/features/surveys/measurement-plan-repairs";

function buildMeasurementPlan(
  temporaryDeviationFacet: string = THERMAL_COMFORT_LEGACY_FACET_KEY,
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
            slot_key: "SLOT_01",
            question_key: "Q_THERMAL_COMFORT_NORMS_01",
            facet: "temperature_stability_requirement",
            intent: "Measure stability requirement.",
            polarity: "positive",
          },
          {
            slot_key: "SLOT_02",
            question_key: "Q_THERMAL_COMFORT_NORMS_02",
            facet: temporaryDeviationFacet,
            intent: "Measure temporary deviation meaning.",
            polarity: "negative",
          },
          {
            slot_key: "SLOT_03",
            question_key: "Q_THERMAL_COMFORT_NORMS_03",
            facet: "recovery_expectation",
            intent: "Measure recovery expectation.",
            polarity: "positive",
          },
          {
            slot_key: "SLOT_04",
            question_key: "Q_THERMAL_COMFORT_NORMS_04",
            facet: "comfort_variation_boundary",
            intent: "Measure the boundary for defined variation.",
            polarity: "positive",
          },
        ],
      },
    ],
  };
}

describe("measurement plan repairs", () => {
  it("renames only the legacy thermal temporary-deviation facet", () => {
    const original = buildMeasurementPlan();

    const repaired = repairThermalComfortMeasurementPlan(original);

    expect(repaired.changed).toBe(true);
    expect(
      repaired.measurementPlan.concepts[0].question_intents?.map((intent) => intent.facet),
    ).toEqual([
      "temperature_stability_requirement",
      THERMAL_COMFORT_REPAIRED_FACET_KEY,
      "recovery_expectation",
      "comfort_variation_boundary",
    ]);
  });

  it("is idempotent once the thermal facet has already been repaired", () => {
    const repairedPlan = buildMeasurementPlan(THERMAL_COMFORT_REPAIRED_FACET_KEY);

    const repaired = repairThermalComfortMeasurementPlan(repairedPlan);

    expect(repaired.changed).toBe(false);
    expect(repaired.measurementPlan).toEqual(repairedPlan);
  });

  it("rejects mixed legacy and repaired thermal facet names", () => {
    const mixedPlan = buildMeasurementPlan();
    const intents = mixedPlan.concepts[0].question_intents;
    if (!intents) {
      throw new Error("Missing question intents.");
    }
    intents.push({
      slot_key: "SLOT_05",
      question_key: "Q_THERMAL_COMFORT_NORMS_05",
      facet: THERMAL_COMFORT_REPAIRED_FACET_KEY,
      intent: "Unexpected mixed repaired facet.",
      polarity: "negative",
    });

    expect(() => repairThermalComfortMeasurementPlan(mixedPlan)).toThrow(
      "Thermal comfort repair found mixed legacy and repaired temporary-deviation facets.",
    );
  });
});
