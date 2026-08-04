import { describe, expect, it } from "vitest";
import {
  DECLARED_FLEXIBILITY_CAPABILITY_CONCEPT_KEY,
  DECLARED_FLEXIBILITY_CAPABILITY_MODULE_VERSION,
  DFC_INVENTORY_QUESTION_KEY,
  createDeclaredFlexibilityCapabilityBlueprintArtifact,
  createDeclaredFlexibilityCapabilityDefinitionArtifacts,
  ensureDeclaredFlexibilityCapabilityDependencies,
  hasDeclaredFlexibilityCapability,
} from "@/features/surveys/declared-flexibility-capability-module";

describe("declared flexibility capability module v1", () => {
  it("detects DFC and adds its inventory dependency exactly once", () => {
    expect(hasDeclaredFlexibilityCapability(["trust_in_automation"])).toBe(false);
    expect(
      hasDeclaredFlexibilityCapability([
        DECLARED_FLEXIBILITY_CAPABILITY_CONCEPT_KEY,
      ]),
    ).toBe(true);
    expect(
      ensureDeclaredFlexibilityCapabilityDependencies([
        "trust_in_automation",
        DECLARED_FLEXIBILITY_CAPABILITY_CONCEPT_KEY,
      ]),
    ).toEqual([
      "trust_in_automation",
      DECLARED_FLEXIBILITY_CAPABILITY_CONCEPT_KEY,
      "owned_der_assets",
    ]);
    expect(
      ensureDeclaredFlexibilityCapabilityDependencies([
        DECLARED_FLEXIBILITY_CAPABILITY_CONCEPT_KEY,
        "owned_der_assets",
        "owned_der_assets",
      ]),
    ).toEqual([
      DECLARED_FLEXIBILITY_CAPABILITY_CONCEPT_KEY,
      "owned_der_assets",
    ]);
  });

  it("exposes five fixed sets with four stable component slots each", () => {
    const first = createDeclaredFlexibilityCapabilityBlueprintArtifact();
    const second = createDeclaredFlexibilityCapabilityBlueprintArtifact();

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.module_version).toBe(
      DECLARED_FLEXIBILITY_CAPABILITY_MODULE_VERSION,
    );
    expect(
      first.sets.map(({ set_key, triggering_assets }) => ({
        set_key,
        triggering_assets,
      })),
    ).toEqual([
      {
        set_key: "washing_machine_scheduling",
        triggering_assets: ["washing_machine"],
      },
      { set_key: "ev_charging", triggering_assets: ["ev"] },
      {
        set_key: "space_conditioning",
        triggering_assets: ["heat_pump", "air_conditioning"],
      },
      { set_key: "water_heating", triggering_assets: ["hot_water_tank"] },
      { set_key: "battery_operation", triggering_assets: ["battery_storage"] },
    ]);

    const questions = first.sets.flatMap((set) => set.questions);
    expect(questions).toHaveLength(20);
    expect(new Set(questions.map((question) => question.question_key)).size).toBe(20);
    expect(new Set(questions.map((question) => question.slot_key)).size).toBe(20);
    expect(
      first.sets.every(
        (set) =>
          set.questions.length === 4 &&
          set.questions.every(
            (question) =>
              question.facet === set.set_key &&
              question.polarity === "positive" &&
              question.visibility_rule.source_question_key ===
                DFC_INVENTORY_QUESTION_KEY &&
              question.visibility_rule.operator === "contains_any",
          ),
      ),
    ).toBe(true);
  });

  it("compiles an enriched inventory before twenty conditional Likert items", () => {
    const artifacts =
      createDeclaredFlexibilityCapabilityDefinitionArtifacts(7);
    const [inventory, ...capabilityQuestions] = artifacts.questions;

    expect(artifacts.module_version).toBe("v1");
    expect(artifacts.surveyMeta).toEqual({
      capability_module_version: "v1",
    });
    expect(artifacts.questions).toHaveLength(21);
    expect(inventory).toMatchObject({
      question_key: DFC_INVENTORY_QUESTION_KEY,
      type: "multiple_choice",
      required: true,
      order: 7,
      exclusive_option_keys: ["none_of_these", "not_sure"],
    });
    expect(inventory.options?.map((option) => option.option_key)).toEqual(
      expect.arrayContaining([
        "washing_machine",
        "air_conditioning",
        "none_of_these",
        "not_sure",
      ]),
    );
    expect(capabilityQuestions.every((question) => question.required)).toBe(true);
    expect(capabilityQuestions.map((question) => question.order)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 8),
    );
    expect(
      capabilityQuestions.every(
        (question) =>
          question.type === "rating_scale" &&
          question.scale?.min === 1 &&
          question.scale.max === 5 &&
          question.scale.step === 1 &&
          question.scale.min_label === undefined &&
          question.scale.max_label === undefined &&
          question.visibility_rule?.operator === "contains_any",
      ),
    ).toBe(true);
  });

  it("builds fixed mapping and mean-measurement artifacts", () => {
    const artifacts =
      createDeclaredFlexibilityCapabilityDefinitionArtifacts();
    const inventoryMapping = artifacts.mappingContract.mappings[0];
    const capabilityPlan = artifacts.measurementPlan.concepts.find(
      (concept) =>
        concept.concept_key === DECLARED_FLEXIBILITY_CAPABILITY_CONCEPT_KEY,
    );

    expect(artifacts.mappingContract.mappings).toHaveLength(21);
    expect(inventoryMapping).toMatchObject({
      question_key: DFC_INVENTORY_QUESTION_KEY,
      expected_type: "string[]",
      transform_strategy: {
        kind: "enum_lookup",
      },
    });
    if (inventoryMapping.transform_strategy.kind !== "enum_lookup") {
      throw new Error("Expected inventory enum mapping.");
    }
    expect(inventoryMapping.transform_strategy.option_to_value).not.toHaveProperty(
      "none_of_these",
    );
    expect(inventoryMapping.transform_strategy.option_to_value).not.toHaveProperty(
      "not_sure",
    );
    expect(capabilityPlan).toMatchObject({
      measurement_type: "multi_item_likert_mean",
      aggregation_rule: "mean",
      threshold_profile: "likert_1_5_low_mid_high",
      minimum_answer_count: 4,
    });
    expect(capabilityPlan?.question_keys).toHaveLength(20);
    expect(capabilityPlan?.required_question_keys).toEqual(
      capabilityPlan?.question_keys,
    );
    expect(capabilityPlan?.question_intents).toHaveLength(20);
    expect(
      new Set(capabilityPlan?.question_intents?.map((intent) => intent.facet)),
    ).toEqual(
      new Set([
        "washing_machine_scheduling",
        "ev_charging",
        "space_conditioning",
        "water_heating",
        "battery_operation",
      ]),
    );
  });
});
