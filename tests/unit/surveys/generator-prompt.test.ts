import { describe, expect, it } from "vitest";
import { deriveSchemaTargetsFromBehaviouralConceptKeys } from "@/features/ontology/flexpulse-behavioural-schema";
import { getGeneratorTargetConfigs } from "@/features/surveys/generator-config";
import {
  buildMeasurementPlannerPrompt,
  buildSurveyGeneratorPrompt,
} from "@/features/surveys/survey-generation-prompts";
import { createMeasurementPlanBlueprint } from "@/features/surveys/measurement-plan";

function countOccurrences(text: string, needle: string) {
  return text.split(needle).length - 1;
}

describe("measurement planner prompt", () => {
  it("uses explicit agent blocks instead of a flat instruction blob", () => {
    const behaviouralConceptKeys = ["trust_in_automation"];
    const schemaTargets = deriveSchemaTargetsFromBehaviouralConceptKeys(
      behaviouralConceptKeys,
    );
    const configs = getGeneratorTargetConfigs(schemaTargets);
    const baseMeasurementPlanBlueprint = createMeasurementPlanBlueprint(
      behaviouralConceptKeys,
    );

    const prompt = buildMeasurementPlannerPrompt({
      surveyName: "Flexibility trust survey",
      surveyDescription: "Study household attitudes toward automation.",
      defaultLanguage: "English",
      supportedLanguages: ["English", "Spanish"],
      behaviouralConceptKeys,
      schemaTargets,
      configs,
      baseMeasurementPlanBlueprint,
    });

    expect(prompt.system).toContain("Identity:");
    expect(prompt.system).toContain("Mission:");
    expect(prompt.system).toContain("Limits:");
    expect(prompt.system).toContain("System context:");
    expect(prompt.system).toContain("Decision principles:");
    expect(prompt.system).toContain("Output contract:");
    expect(prompt.system).toContain("Completion criterion:");
    expect(prompt.system).toContain(
      "the system is not providing a recommended total question budget",
    );
    expect(prompt.user).toContain("Application context:");
    expect(prompt.user).toContain("Server-provided planning envelope:");
    expect(prompt.user).toContain("slot_count");
    expect(prompt.user).toContain("Concept measurement contracts:");
    expect(prompt.user).toContain("Facet selection policy:");
    expect(prompt.user).toContain("Required construct-separation rules:");
    expect(prompt.user).toContain("candidate facets, non-exhaustive");
    expect(prompt.user).toContain("must not measure:");
    expect(prompt.user).toContain("high score means:");
    expect(prompt.user).toContain("Concept scores remain canonical downstream");
    expect(prompt.user).toContain("interpretive signal");
    expect(prompt.user).toContain("naming the mechanism, action, or trade-off");
    expect(prompt.user).not.toContain("oversight need");
    expect(prompt.user).toContain(
      "expectation that the system respects predefined operational boundaries",
    );
    expect(prompt.user).not.toContain("Recommended visible question budget");
    expect(prompt.user).not.toContain("target 3");
    expect(prompt.user).not.toContain("oversight_need");
  });

  it("injects repair feedback only when present", () => {
    const behaviouralConceptKeys = ["trust_in_automation"];
    const schemaTargets = deriveSchemaTargetsFromBehaviouralConceptKeys(
      behaviouralConceptKeys,
    );
    const configs = getGeneratorTargetConfigs(schemaTargets);
    const baseMeasurementPlanBlueprint = createMeasurementPlanBlueprint(
      behaviouralConceptKeys,
    );

    const prompt = buildMeasurementPlannerPrompt({
      surveyName: "Trust survey",
      surveyDescription: "",
      defaultLanguage: "English",
      supportedLanguages: ["English"],
      behaviouralConceptKeys,
      schemaTargets,
      configs,
      baseMeasurementPlanBlueprint,
      repairFeedback: [
        'measurement_planner_output: Planner selected unsupported measurement type "meaningless".',
      ],
    });

    expect(prompt.user).toContain(
      "Feedback from the previous invalid planning attempt:",
    );
    expect(prompt.user).toContain("Fix those issues while preserving");
  });

  it("allows context concepts to reach the planner as slot-free passthrough signals", () => {
    const behaviouralConceptKeys = ["trust_in_automation", "country_code"];
    const schemaTargets = deriveSchemaTargetsFromBehaviouralConceptKeys(
      behaviouralConceptKeys,
    );
    const configs = getGeneratorTargetConfigs(schemaTargets);
    const baseMeasurementPlanBlueprint = createMeasurementPlanBlueprint(
      behaviouralConceptKeys,
    );

    const prompt = buildMeasurementPlannerPrompt({
      surveyName: "Context-aware trust survey",
      surveyDescription: "",
      defaultLanguage: "English",
      supportedLanguages: ["English"],
      behaviouralConceptKeys,
      schemaTargets,
      configs,
      baseMeasurementPlanBlueprint,
    });

    expect(prompt.user).toContain("country_code");
    expect(prompt.user).toContain("evidence source: response_context");
    expect(prompt.user).toContain("slot capacity max: 0");
    expect(prompt.user).toContain("For context-only or quality-only concepts");
  });

  it("renders active planner boundaries only when both related concepts are selected", () => {
    const behaviouralConceptKeys = [
      "tariff_preference_orientation",
      "bill_stability_need",
    ];
    const schemaTargets = deriveSchemaTargetsFromBehaviouralConceptKeys(
      behaviouralConceptKeys,
    );
    const configs = getGeneratorTargetConfigs(schemaTargets);
    const baseMeasurementPlanBlueprint = createMeasurementPlanBlueprint(
      behaviouralConceptKeys,
    );

    const plannerPrompt = buildMeasurementPlannerPrompt({
      surveyName: "Economic flexibility survey",
      surveyDescription: "",
      defaultLanguage: "English",
      supportedLanguages: ["English"],
      behaviouralConceptKeys,
      schemaTargets,
      configs,
      baseMeasurementPlanBlueprint,
    });

    expect(plannerPrompt.user).toContain(
      "Tariff preference measures acceptance of a tariff structure; bill stability measures the underlying need for predictable expenditure.",
    );
    expect(plannerPrompt.user).not.toContain(
      "Trust measures readiness to rely; override measures the requirement to intervene.",
    );

    const writerPrompt = buildSurveyGeneratorPrompt({
      surveyName: "Economic flexibility survey",
      surveyDescription: "",
      defaultLanguage: "English",
      supportedLanguages: ["English"],
      schemaTargets,
      configs,
      measurementPlanBlueprint: {
        schema_version: 1,
        schema_namespace: "flexpulse_behavioural_schema",
        concepts: baseMeasurementPlanBlueprint.concepts.map((concept) => ({
          ...concept,
          measurement_type: "multi_item_likert_mean",
          aggregation_rule: "mean",
          threshold_profile: "likert_1_5_low_mid_high",
          minimum_answer_count: 2,
          question_slots: [
            {
              slot_key: `${concept.concept_key}_slot_1`,
              facet: "importance",
              intent: "Measure importance of the construct.",
              polarity: "positive",
            },
            {
              slot_key: `${concept.concept_key}_slot_2`,
              facet: "boundary_condition",
              intent: "Measure the limiting side of the construct.",
              polarity: "negative",
            },
          ],
        })),
      },
    });
    const tariffPreferenceConfig = configs.find(
      (config) => config.concept.concept_key === "tariff_preference_orientation",
    );
    const billStabilityConfig = configs.find(
      (config) => config.concept.concept_key === "bill_stability_need",
    );

    expect(writerPrompt.system).toContain(
      "write items that cover distinct facets rather than paraphrases",
    );
    expect(writerPrompt.system).toContain(
      "Write from the household respondent's point of view",
    );
    expect(writerPrompt.system).toContain(
      "selected canonical language",
    );
    expect(writerPrompt.system).toContain("Use one primary domain per item");
    expect(writerPrompt.system).toContain(
      "delaying laundry",
    );
    expect(writerPrompt.user).toContain(
      "Do not borrow content from neighboring constructs",
    );
    expect(writerPrompt.user).toContain("realistic household decision");
    expect(writerPrompt.user).toContain("willingness to delay");
    expect(writerPrompt.user).toContain(
      "network reliability",
    );
    expect(writerPrompt.user).toContain("lower-demand times");
    expect(writerPrompt.user).not.toContain("   - notes:");
    expect(tariffPreferenceConfig).toBeDefined();
    expect(
      countOccurrences(
        writerPrompt.user,
        tariffPreferenceConfig?.prompt_notes ?? "",
      ),
    ).toBe(1);
    expect(writerPrompt.user).toContain(
      `   - measurement goal: ${tariffPreferenceConfig?.semantic_guidance?.measurement_intent}`,
    );
    expect(writerPrompt.user).toContain(
      `   - excluded evidence: ${tariffPreferenceConfig?.semantic_guidance?.must_not_measure.join(" | ")}`,
    );
    expect(writerPrompt.user).toContain(
      `   - measurement goal: ${billStabilityConfig?.semantic_guidance?.measurement_intent}`,
    );
    expect(writerPrompt.user).toContain(
      `   - excluded evidence: ${billStabilityConfig?.semantic_guidance?.must_not_measure.join(" | ")}`,
    );
    expect(writerPrompt.user).not.toContain("measurement goal: undefined");
    expect(writerPrompt.user).not.toContain("excluded evidence: undefined");
    expect(writerPrompt.user).not.toContain("candidate facets, non-exhaustive");
    expect(writerPrompt.user).toContain(
      "For each slot, first identify the single respondent judgement that would provide the planned evidence.",
    );
    expect(writerPrompt.user).toContain(
      "Write one independently answerable claim about that judgement.",
    );
    expect(writerPrompt.user).toContain(
      "Ensure that the response anchors directly answer the wording used.",
    );
    expect(writerPrompt.user).toContain(
      "Compare sibling items under the same concept and ensure that each item captures distinct planned evidence rather than a paraphrase.",
    );
    expect(writerPrompt.user).not.toContain(
      "how to override it.",
    );
    expect(writerPrompt.user).toContain(
      "Do not turn explainability into manual override or prior approval.",
    );
    expect(writerPrompt.user).toContain("duration-only item");
    expect(writerPrompt.system).toContain("respondent-facing label");
    expect(writerPrompt.user).toContain("Same price most of the time");
    expect(writerPrompt.user).toContain("Not sure / I would need more information");
    expect(writerPrompt.user).toContain("facet: importance");
    expect(writerPrompt.user).toContain("polarity: negative");
  });

  it("keeps writer prompts valid for concepts without semantic guidance", () => {
    const behaviouralConceptKeys = ["preferred_tariff_model"];
    const schemaTargets = deriveSchemaTargetsFromBehaviouralConceptKeys(
      behaviouralConceptKeys,
    );
    const configs = getGeneratorTargetConfigs(schemaTargets);
    const baseMeasurementPlanBlueprint = createMeasurementPlanBlueprint(
      behaviouralConceptKeys,
    );

    const writerPrompt = buildSurveyGeneratorPrompt({
      surveyName: "Tariff choice survey",
      surveyDescription: "",
      defaultLanguage: "English",
      supportedLanguages: ["English"],
      schemaTargets,
      configs,
      measurementPlanBlueprint: {
        schema_version: 1,
        schema_namespace: "flexpulse_behavioural_schema",
        concepts: baseMeasurementPlanBlueprint.concepts.map((concept) => ({
          ...concept,
          measurement_type: "single_choice_enum",
          aggregation_rule: "identity",
          threshold_profile: "enum_identity",
          minimum_answer_count: 1,
          question_slots: [
            {
              slot_key: `${concept.concept_key}_slot_1`,
              facet: "tariff_choice",
              intent: "Measure preferred tariff model.",
              polarity: "neutral",
            },
          ],
        })),
      },
    });

    expect(writerPrompt.user).not.toContain("measurement goal: undefined");
    expect(writerPrompt.user).not.toContain("excluded evidence: undefined");
    expect(writerPrompt.user).not.toContain("   - measurement goal:");
    expect(writerPrompt.user).not.toContain("   - excluded evidence:");
    expect(writerPrompt.user).toContain("Measure preferred tariff model.");
    expect(writerPrompt.user).toContain("facet: tariff_choice");
    expect(writerPrompt.user).toContain("polarity: neutral");
  });

  it("omits inactive planner boundaries when the paired concept is not selected", () => {
    const behaviouralConceptKeys = ["trust_in_automation"];
    const schemaTargets = deriveSchemaTargetsFromBehaviouralConceptKeys(
      behaviouralConceptKeys,
    );
    const configs = getGeneratorTargetConfigs(schemaTargets);
    const baseMeasurementPlanBlueprint = createMeasurementPlanBlueprint(
      behaviouralConceptKeys,
    );

    const plannerPrompt = buildMeasurementPlannerPrompt({
      surveyName: "Trust survey",
      surveyDescription: "",
      defaultLanguage: "English",
      supportedLanguages: ["English"],
      behaviouralConceptKeys,
      schemaTargets,
      configs,
      baseMeasurementPlanBlueprint,
    });

    expect(plannerPrompt.user).not.toContain(
      "Trust measures readiness to rely; override measures the requirement to intervene.",
    );
  });

  it("tightens explainability notes away from override semantics", () => {
    const behaviouralConceptKeys = ["explainability_need"];
    const schemaTargets = deriveSchemaTargetsFromBehaviouralConceptKeys(
      behaviouralConceptKeys,
    );
    const configs = getGeneratorTargetConfigs(schemaTargets);
    const baseMeasurementPlanBlueprint = createMeasurementPlanBlueprint(
      behaviouralConceptKeys,
    );

    const plannerPrompt = buildMeasurementPlannerPrompt({
      surveyName: "Explainability survey",
      surveyDescription: "",
      defaultLanguage: "English",
      supportedLanguages: ["English"],
      behaviouralConceptKeys,
      schemaTargets,
      configs,
      baseMeasurementPlanBlueprint,
    });

    expect(plannerPrompt.user).not.toContain("how to override it next time");
    expect(plannerPrompt.user).toContain(
      "what consequences it had for comfort, costs, or device operation",
    );
  });
});
